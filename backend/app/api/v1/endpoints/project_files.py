import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.services.commons.activity_logger import ActivityLogger
from app.services.knowledge_base.rag_engine import RAGEngine, get_rag_engine
from app.services.commons.file_service import FileService, get_file_service

router = APIRouter()


@router.get("/{project_id}/files", response_model=List[str])
def get_project_files(
    project_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
):
    db_project = (
        db.query(ProjectModel)
        .filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id)
        .first()
    )
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    return file_service.list_files(current_user.id, db_project.folder_name)


@router.delete("/{project_id}/files/{filename}")
async def delete_project_file(
    project_id: int,
    filename: str,
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

    try:
        # 1. 刪除實體檔案


        file_path = os.path.join(
            file_service.get_upload_dir(current_user.id, db_project.folder_name),
            filename,
        )
        if os.path.exists(file_path):
            os.remove(file_path)

        # 2. 刪除 RAG 向量索引
        await rag_engine.delete_file_context(project_id, filename)

        ActivityLogger.log_file_delete(
            current_user.id, current_user.email, project_id, db_project.name, filename
        )
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
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
    rag_engine: RAGEngine = Depends(get_rag_engine),
):
    project_folder_name = None
    if project_id:
        db_project = (
            db.query(ProjectModel)
            .filter(
                ProjectModel.id == project_id, ProjectModel.user_id == current_user.id
            )
            .first()
        )
        if not db_project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_folder_name = db_project.folder_name

    try:
        # 將檔案儲存至本地資料夾
        file_service.save_upload_file(file, current_user.id, project_folder_name)

        # 將文件內容讀取並寫入 RAG 向量資料庫
        await file.seek(0)
        await rag_engine.ingest_document(
            file, project_id, current_user.id, project_folder_name
        )

        ActivityLogger.log_file_upload(
            current_user.id,
            current_user.email,
            project_id,
            db_project.name if db_project else "Unknown",
            [file.filename],
        )
        return {"message": "File uploaded and ingested."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
