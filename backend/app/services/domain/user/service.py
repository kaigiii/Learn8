import io
import re
import os
import shutil
from pathlib import Path
from PIL import Image, UnidentifiedImageError
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from urllib.parse import quote

from app.core.config import settings
from app.models.user import UserModel

class UserService:
    AVATAR_FILENAME_RE = re.compile(r"^[^/\\\x00]+\.png$")
    EMAIL_RE = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)
    MAX_AVATAR_UPLOAD_BYTES = 20 * 1024 * 1024
    
    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def validate_email(email: str):
        if not UserService.EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Please enter a valid email address")

    @staticmethod
    def get_avatar_filename(email: str) -> str:
        normalized = UserService.normalize_email(email)
        safe_email = re.sub(r'[<>:"/\\|?*\x00-\x1F]+', "_", normalized).strip()
        return f"{safe_email}.png"

    @staticmethod
    def get_avatar_url(filename: str) -> str:
        return f"{settings.API_V1_STR}/auth/avatar-images/{quote(filename, safe='')}"

    @staticmethod
    async def process_and_save_avatar(file: UploadFile, user_email: str) -> str:
        """處理並儲存使用者頭像，返回檔案名稱。"""
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")
        if len(raw_bytes) > UserService.MAX_AVATAR_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Avatar image is too large (max 20MB).")

        try:
            with Image.open(io.BytesIO(raw_bytes)) as source:
                has_alpha = source.mode in ("RGBA", "LA") or (
                    source.mode == "P" and "transparency" in source.info
                )
                converted = source.convert("RGBA" if has_alpha else "RGB")
                
                avatar_dir = settings.UPLOAD_DIR / "avatar"
                avatar_dir.mkdir(parents=True, exist_ok=True)
                
                filename = UserService.get_avatar_filename(user_email)
                path = avatar_dir / filename
                converted.save(path, format="PNG")
                return filename
        except UnidentifiedImageError:
            raise HTTPException(status_code=400, detail="Unsupported image format.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process avatar: {str(e)}")

    @staticmethod
    def sync_legacy_avatar(db: Session, user: UserModel) -> bool:
        """確保舊版頭像 URL 指向正確的新格式檔案路徑。"""
        current_url = (user.avatar_url or "").strip()
        if not current_url or "/auth/avatar-images/" not in current_url:
            return False

        avatar_dir = settings.UPLOAD_DIR / "avatar"
        expected_filename = UserService.get_avatar_filename(user.email)
        expected_path = avatar_dir / expected_filename
        
        # 如果已經正確，就不重複處理
        if current_url.endswith(quote(expected_filename, safe='')):
            return False

        # 如果檔案不存在但有舊檔案，嘗試搬遷
        if not expected_path.exists():
            # 這裡可以加入搬遷邏輯，但為了簡化目前先重設 URL
            user.avatar_url = UserService.get_avatar_url(expected_filename)
            return True
            
        user.avatar_url = UserService.get_avatar_url(expected_filename)
        return True
