
import uuid
import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.schemas.project import ProjectCreate, ProjectResponse
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
