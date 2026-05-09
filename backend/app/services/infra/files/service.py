import os
import shutil
from fastapi import UploadFile, HTTPException
from app.services.domain.user.activity_logger import activity_logger
from app.core.config import settings
from pathlib import Path


class FileService:
    def get_upload_dir(self, user_id: int, course_folder: str = None) -> Path:
        base_path = settings.UPLOAD_DIR / str(user_id)
        if course_folder:
            base_path = base_path / course_folder
        return base_path

    def save_upload_file(
        self, file: UploadFile, user_id: int, course_folder: str = None
    ) -> str:
        upload_dir = self.get_upload_dir(user_id, course_folder)
        os.makedirs(upload_dir, exist_ok=True)

        file_path = upload_dir / file.filename

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return str(file_path.absolute())
        except Exception as e:
            activity_logger.error(f"File save failed for {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"File save failed: {str(e)}")

    def list_files(self, user_id: int, course_folder: str) -> list[str]:
        upload_dir = self.get_upload_dir(user_id, course_folder)
        if not os.path.exists(upload_dir):
            return []

        files = []
        for f in os.listdir(upload_dir):
            if not f.startswith("."):
                full_path = os.path.join(upload_dir, f)
                if os.path.isfile(full_path):
                    files.append(f)
        return files

    def delete_course_folder(self, user_id: int, course_folder: str):
        """遞迴刪除 course 的實體上傳目錄。"""
        if not course_folder:
            return

        target_dir = self.get_upload_dir(user_id, course_folder)

        # 安全檢查：確保我們刪除的是 uploads 目錄下的資料夾
        # (雖然 get_upload_dir 已經鎖定基礎路徑，但多一層預防總是好的)
        if os.path.exists(target_dir):
            try:
                shutil.rmtree(target_dir)
                activity_logger.info(f"Deleted course folder: {target_dir}")
            except Exception as e:
                activity_logger.error(
                    f"Error deleting course folder {target_dir}: {e}"
                )

    def read_file_content(self, file_path: str, max_chars: int = None) -> str:
        """使用 DocumentProcessor 讀取檔案內容字串。若過長則進行截斷。"""
        from app.services.ai_engine.kb.document_processor import DocumentProcessor
        from app.core.config import settings

        limit = max_chars if max_chars is not None else settings.MAX_FILE_READ_BYTES
        # 目前仍靜態呼叫 DocumentProcessor，依賴其類別方法
        return DocumentProcessor.read_content(file_path, max_chars=limit)


def get_file_service() -> FileService:
    """FastAPI Dependency for FileService"""
    return FileService()
