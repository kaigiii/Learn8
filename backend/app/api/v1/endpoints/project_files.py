"""
模組名稱: app.api.v1.endpoints.project_files
功能描述: 專案檔案管理 API (Project File Management Endpoints)

處理專案內檔案的上傳、列表查詢與刪除。

路由列表:
    1. GET /{project_id}/files - 列出專案內所有檔案
    2. DELETE /{project_id}/files/{filename} - 刪除指定檔案
    3. POST /upload-pdf - 上傳 PDF 並觸發 RAG 索引
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.services.file_service import FileService
from app.services.activity_logger import ActivityLogger

router = APIRouter()


@router.get("/{project_id}/files", response_model=List[str])
def get_project_files(
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
        from app.services.rag_engine import RAGEngine
        await RAGEngine.delete_file_context(project_id, filename)

        ActivityLogger.log_file_delete(current_user.id, current_user.email, project_id, db_project.name, filename)
        return {"message": f"File {filename} deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-document")
async def upload_document(
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

        # Ingest Document into RAG
        from app.services.rag_engine import RAGEngine
        await file.seek(0)
        await RAGEngine.ingest_document(file, project_id, current_user.id, project_folder_name)
        
        ActivityLogger.log_file_upload(current_user.id, current_user.email, project_id, db_project.name if db_project else "Unknown", [file.filename])
        return {"message": "File uploaded and ingested."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
