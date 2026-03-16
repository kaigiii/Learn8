from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.db.registry import Base
from app.db.session import engine
from app.models.user import UserModel
import shutil
import os

router = APIRouter()


def _reset_directory(path: str) -> None:
    if os.path.exists(path):
        shutil.rmtree(path)
    os.makedirs(path, exist_ok=True)


@router.post("/reset-db")
def reset_database(
    current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
):
    # 危險操作：刪除所有資料表、上傳檔案與向量資料庫後重新建立
    try:
        uploads_dir = os.path.join(os.getcwd(), "uploads")
        vector_db_dir = os.path.join(os.getcwd(), "chroma_db")

        # 1. 刪除使用者上傳檔案與向量資料庫
        _reset_directory(uploads_dir)
        _reset_directory(vector_db_dir)

        # 2. 刪除所有資料表
        Base.metadata.drop_all(bind=engine)

        # 3. 重新建立所有資料表
        Base.metadata.create_all(bind=engine)

        return {
            "message": "System reset complete. Database, uploads, and vector store were rebuilt."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-files")
def clear_files(current_user: UserModel = Depends(get_current_user)):
    # 危險操作：刪除 uploads 目錄下的所有檔案
    upload_dir = os.path.join(os.getcwd(), "uploads")

    try:
        if os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
            os.makedirs(upload_dir)  # 重新建立空資料夾
            return {"message": f"Deleted all files in {upload_dir}"}
        else:
            return {"message": "Uploads directory did not exist."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
