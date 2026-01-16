
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
