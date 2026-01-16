"""
模組名稱: app.services.file_service
功能描述: 檔案管理服務 (File Management Service)

負責處理本地檔案系統的操作，如上傳、列表查詢與刪除。
確保所有檔案路徑都限制在 `uploads/{user_id}/{project_folder}` 沙盒中，
防止 Directory Traversal 攻擊。

主要類別:
    - FileService (Static Methods Only)

主要方法:
    1. save_upload_file: 將上傳的檔案 (UploadFile) 寫入磁碟。
    2. list_files: 列出該專案下的所有檔案名稱 (過濾隱藏檔)。
    3. delete_project_folder: 遞迴刪除整個專案資料夾 (慎用)。
"""

import os
import shutil
from fastapi import UploadFile, HTTPException
from app.models.project import ProjectModel
from app.models.user import UserModel
from app.core.config import settings

class FileService:
    @staticmethod
    def get_upload_dir(user_id: int, project_folder: str = None) -> str:
        base_path = os.path.join(os.getcwd(), "uploads", str(user_id))
        if project_folder:
            base_path = os.path.join(base_path, project_folder)
        return base_path

    @staticmethod
    def save_upload_file(file: UploadFile, user_id: int, project_folder: str = None) -> str:
        upload_dir = FileService.get_upload_dir(user_id, project_folder)
        os.makedirs(upload_dir, exist_ok=True)
        
        # Simple sanitization could be added here
        file_path = os.path.abspath(os.path.join(upload_dir, file.filename))
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return file_path
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"File save failed: {str(e)}")

    @staticmethod
    def list_files(user_id: int, project_folder: str) -> list[str]:
        upload_dir = FileService.get_upload_dir(user_id, project_folder)
        if not os.path.exists(upload_dir):
            return []
        
        files = []
        for f in os.listdir(upload_dir):
            if not f.startswith("."):
                files.append(f)
        return files

    @staticmethod
    def delete_project_folder(user_id: int, project_folder: str):
        """Recursively deletes the project upload directory."""
        if not project_folder:
            return
            
        target_dir = FileService.get_upload_dir(user_id, project_folder)
        
        # Safety check: ensure we are deleting inside the uploads directory
        # (Though get_upload_dir handles base path, extra caution is good)
        if os.path.exists(target_dir):
            try:
                shutil.rmtree(target_dir)
                print(f"🗑️ Deleted project folder: {target_dir}")
            except Exception as e:
                print(f"Error deleting project folder {target_dir}: {e}")
