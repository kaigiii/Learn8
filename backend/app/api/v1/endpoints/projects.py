"""
模組名稱: app.api.v1.endpoints.projects
功能描述: 專案管理 API (Project Management Endpoints)

處理專案的生命週期管理 (CRUD) 以及檔案資源的綁定。
專案是 RAG 知識庫的邊界 (Boundary)，所有上傳的 PDF 都會被限制在特定專案中。

路由列表:
    1. POST / (Create)
        - 功能: 建立新專案，自動產生 UUID 資料夾名稱。

    2. DELETE /{project_id}
        - 功能: 完整刪除專案。
        - 清理流程:
            1. 刪除實體檔案 (FileService)。
            2. 刪除 RAG 向量索引 (RAGEngine)。
            3. 刪除資料庫紀錄。

    3. POST /upload-pdf
        - 功能: 上傳 PDF 文件。
        - 觸發: 若使用 Google RAG，則立即觸發 `ingest_pdf` 建立索引。
"""

import uuid
import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.file_service import FileService

router = APIRouter()

@router.post("", response_model=ProjectResponse)
def create_project(project: ProjectCreate, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    folder_uuid = str(uuid.uuid4())
    db_project = ProjectModel(
        name=project.name, 
        user_id=current_user.id,
        folder_name=folder_uuid
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("", response_model=List[ProjectResponse])
def get_projects(current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).all()

@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project_update: ProjectUpdate, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    db_project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_project.name = project_update.name
    db.commit()
    db.refresh(db_project)
    return db_project

@router.delete("/{project_id}")
async def delete_project(project_id: int, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    db_project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id, 
        ProjectModel.user_id == current_user.id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Cleaning up resources
    try:
        # 1. Delete Files
        FileService.delete_project_folder(current_user.id, db_project.folder_name)
        
        # 2. Delete Vector Context
        from app.core.config import settings
        if settings.LLM_PROVIDER.lower() != "freegemini":
             from app.services.rag_engine import RAGEngine
             await RAGEngine.delete_project_context(project_id)
             
    except Exception as e:
        print(f"Error during cleanup: {e}")
    
    db.delete(db_project)
    db.commit()
    return {"message": "Project deleted"}

@router.get("/{project_id}/files", response_model=List[str])
def get_project_files(project_id: int, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    db_project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return FileService.list_files(current_user.id, db_project.folder_name)

@router.delete("/{project_id}/files/{filename}")
async def delete_project_file(
    project_id: int, 
    filename: str, 
    current_user: UserModel = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    db_project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        # 1. Delete physical file
        FileService.delete_file(current_user.id, db_project.folder_name, filename)
        
        # 2. Delete RAG context
        from app.core.config import settings
        if settings.LLM_PROVIDER.lower() != "freegemini":
             from app.services.rag_engine import RAGEngine
             await RAGEngine.delete_file_context(project_id, filename)
             
        return {"message": f"File {filename} deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    project_id: int = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project_folder_name = None
    if project_id:
        db_project = db.query(ProjectModel).filter(
            ProjectModel.id == project_id,
            ProjectModel.user_id == current_user.id
        ).first()
        if not db_project:
             raise HTTPException(status_code=404, detail="Project not found")
        project_folder_name = db_project.folder_name
        
    try:
        # Save file locally
        FileService.save_upload_file(file, current_user.id, project_folder_name)
        
        # Consider moving RAG ingestion to background task or if provider is Google RAG
        # For now, adopting the logic: if FreeGemini -> Just save. If Google -> Ingest.
        from app.core.config import settings
        if settings.LLM_PROVIDER.lower() != "freegemini":
             from app.services.rag_engine import RAGEngine
             await file.seek(0)
             await RAGEngine.ingest_pdf(file, project_id)
             return {"message": "File uploaded and ingested (Google RAG)."}
        
        return {"message": f"File uploaded for User {current_user.id} (Project {project_id})."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.schemas.questionnaire import Question, QuestionnaireSubmission, LearnerProfile
from app.services.llm.agents.questionnaire_agent import QuestionnaireAgent

@router.post("/{project_id}/questionnaire", response_model=List[Question])
async def generate_project_questionnaire(
    project_id: int, 
    topic: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify project ownership
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Credit Check
    COST = 5
    if current_user.credits < COST:
         raise HTTPException(status_code=402, detail=f"Insufficient credits. Need {COST}.")
         
    questions = await QuestionnaireAgent.generate_questions(topic, project_id=project_id)
    
    if questions:
        current_user.credits -= COST
        db.add(current_user)
        db.commit()
    
    return questions

@router.post("/{project_id}/questionnaire/submit", response_model=LearnerProfile)
async def submit_project_questionnaire(
    project_id: int,
    submission: QuestionnaireSubmission,
    topic: str, # We need topic here or we need to store questions. Passing topic is easier for stateless LLM sum.
    questions: List[Question], # Pass back questions context for summarization
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    profile = await QuestionnaireAgent.summarize_responses(topic, submission, questions)
    
    # Save to DB
    project.profile_json = profile.model_dump()
    flag_modified(project, "profile_json")
    db.commit()
    
    return profile

from pydantic import BaseModel

class DraftRequest(BaseModel):
    draft: dict

@router.put("/{project_id}/draft")
def save_project_draft(
    project_id: int,
    body: DraftRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.draft_json = body.draft
    flag_modified(project, "draft_json")
    db.commit()
    return {"status": "saved"}

@router.get("/{project_id}/draft")
def get_project_draft(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"draft": project.draft_json or {}}
