"""
模組名稱: app.api.v1.endpoints.projects
功能描述: 專案管理 API (Project Management Endpoints)

處理專案的生命週期管理 (CRUD)。
檔案管理和問卷功能已拆分至獨立模組。

路由列表:
    1. POST / - 建立新專案
    2. GET / - 列出所有專案
    3. PATCH /{project_id} - 更新專案名稱
    4. DELETE /{project_id} - 刪除專案（含清理檔案與向量索引）
    5. PUT /{project_id}/draft - 儲存專案草稿
    6. GET /{project_id}/draft - 取得專案草稿
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate, DraftRequest
from app.services.file_service import FileService
from app.services.activity_logger import ActivityLogger

router = APIRouter()


@router.post("", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    folder_uuid = str(uuid.uuid4())
    db_project = ProjectModel(
        name=project.name,
        user_id=current_user.id,
        folder_name=folder_uuid
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    ActivityLogger.log_project_create(current_user.id, current_user.email, db_project.id, db_project.name)
    return db_project


@router.get("", response_model=List[ProjectResponse])
def get_projects(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).all()


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_name = db_project.name
    db_project.name = project_update.name
    db.commit()
    db.refresh(db_project)
    
    ActivityLogger.log_project_update(current_user.id, current_user.email, db_project.id, old_name, db_project.name)
    return db_project


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        from app.services.rag_engine import RAGEngine
        await RAGEngine.delete_project_context(project_id)

    except Exception as e:
        print(f"Error during cleanup: {e}")

    project_name = db_project.name
    db.delete(db_project)
    db.commit()
    
    ActivityLogger.log_project_delete(current_user.id, current_user.email, project_id, project_name)
    return {"message": "Project deleted"}


# --- Draft Operations ---

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
