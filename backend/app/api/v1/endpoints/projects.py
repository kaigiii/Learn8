import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.schemas.project_schema import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    DraftRequest,
)
from app.services.commons.file_service import FileService, get_file_service
from app.services.commons.activity_logger import ActivityLogger
from app.services.knowledge_base.rag_engine import RAGEngine, get_rag_engine

router = APIRouter()


@router.post("", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folder_uuid = str(uuid.uuid4())
    db_project = ProjectModel(
        name=project.name, user_id=current_user.id, folder_name=folder_uuid
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    ActivityLogger.log_project_create(
        current_user.id, current_user.email, db_project.id, db_project.name
    )
    return db_project


@router.get("", response_model=List[ProjectResponse])
def get_projects(
    current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
):
    return db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).all()


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_project = (
        db.query(ProjectModel)
        .filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id)
        .first()
    )
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_name = db_project.name
    db_project.name = project_update.name
    db.commit()
    db.refresh(db_project)

    ActivityLogger.log_project_update(
        current_user.id, current_user.email, db_project.id, old_name, db_project.name
    )
    return db_project


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
    rag_engine: RAGEngine = Depends(get_rag_engine),
):
    db_project = (
        db.query(ProjectModel)
        .filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id)
        .first()
    )
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 清理專案關聯資源
    try:
        # 1. 刪除實體檔案資料夾
        file_service.delete_project_folder(current_user.id, db_project.folder_name)

        # 2. 刪除向量資料庫 (ChromaDB) 中的索引
        await rag_engine.delete_project_context(project_id)

    except Exception as e:
        print(f"清理專案資源 {project_id} 時發生錯誤: {e}")

    # 3. 由 ORM relationship + DB cascade 接手清理專案關聯資料
    project_name = db_project.name
    db.delete(db_project)
    db.commit()

    ActivityLogger.log_project_delete(
        current_user.id, current_user.email, project_id, project_name
    )
    return {"message": "Project deleted"}


# --- 草稿操作 (Draft Operations) ---


@router.put("/{project_id}/draft")
def save_project_draft(
    project_id: int,
    body: DraftRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    project = (
        db.query(ProjectModel)
        .filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id)
        .first()
    )
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
    project = (
        db.query(ProjectModel)
        .filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"draft": project.draft_json or {}}
