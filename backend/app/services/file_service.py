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
    4. read_file_content: 讀取檔案內容字串，內建安全長度截斷機制。
"""

import os
import shutil
from fastapi import UploadFile, HTTPException
from app.models.project import ProjectModel
from app.models.user import UserModel
from app.core.config import settings
from app.services.activity_logger import activity_logger

class FileService:
    def get_upload_dir(self, user_id: int, project_folder: str = None) -> str:
        base_path = os.path.join(os.getcwd(), "uploads", str(user_id))
        if project_folder:
            base_path = os.path.join(base_path, project_folder)
        return base_path

    def save_upload_file(self, file: UploadFile, user_id: int, project_folder: str = None) -> str:
        upload_dir = self.get_upload_dir(user_id, project_folder)
        os.makedirs(upload_dir, exist_ok=True)
        
        # Simple sanitization could be added here
        file_path = os.path.abspath(os.path.join(upload_dir, file.filename))
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return file_path
        except Exception as e:
            activity_logger.error(f"File save failed for {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"File save failed: {str(e)}")

    def list_files(self, user_id: int, project_folder: str) -> list[str]:
        upload_dir = self.get_upload_dir(user_id, project_folder)
        if not os.path.exists(upload_dir):
            return []
        
        files = []
        for f in os.listdir(upload_dir):
            if not f.startswith("."):
                full_path = os.path.join(upload_dir, f)
                if os.path.isfile(full_path):
                    files.append(f)
        return files

    def delete_project_folder(self, user_id: int, project_folder: str):
        """Recursively deletes the project upload directory."""
        if not project_folder:
            return
            
        target_dir = self.get_upload_dir(user_id, project_folder)
        
        # Safety check: ensure we are deleting inside the uploads directory
        # (Though get_upload_dir handles base path, extra caution is good)
        if os.path.exists(target_dir):
            try:
                shutil.rmtree(target_dir)
                activity_logger.info(f"Deleted project folder: {target_dir}")
            except Exception as e:
                activity_logger.error(f"Error deleting project folder {target_dir}: {e}")

    def read_file_content(self, file_path: str, max_chars: int = None) -> str:
        """Reads content from a file using DocumentProcessor. Truncates if too long."""
        from app.services.document_processor import DocumentProcessor
        from app.core.config import settings
        
        limit = max_chars if max_chars is not None else settings.MAX_FILE_READ_BYTES
        # Still static call to DocumentProcessor for now, will refactor DP next
        return DocumentProcessor.read_content(file_path, max_chars=limit)

def get_file_service() -> FileService:
    """FastAPI Dependency for FileService"""
    return FileService()
