"""
模組名稱: app.api.v1.endpoints.system
功能描述: 系統管理與工具 API (System & Admin Endpoints)

提供系統層級的管理功能，主要用於開發測試與除錯。

路由列表:
    1. POST /reset-db
        - 對象: 僅限管理員或開發者。
        - 功能: "Factory Reset" —— 刪除所有資料表並重建。
        - 警告: 此操作不可逆，會清空所有使用者與課程資料。

    2. POST /clear-files
        - 對象: 僅限管理員。
        - 功能: 清空 `uploads/` 資料夾下的所有檔案。
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models.user import UserModel
import shutil
import os

router = APIRouter()

@router.post("/reset-db")
def reset_database(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DANGER: Drops all tables and recreates them.
    Effective 'Factory Reset' for the database.
    """
    try:
        # 1. Drop all tables
        Base.metadata.drop_all(bind=engine)
        
        # 2. Recreate all tables
        Base.metadata.create_all(bind=engine)
        
        return {"message": "Database has been reset successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear-files")
def clear_files(
    current_user: UserModel = Depends(get_current_user)
):
    """
    DANGER: Deletes all files in the uploads directory.
    """
    upload_dir = os.path.join(os.getcwd(), "uploads")
    
    try:
        if os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
            os.makedirs(upload_dir) # Recreate empty dir
            return {"message": f"Deleted all files in {upload_dir}"}
        else:
            return {"message": "Uploads directory did not exist."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
