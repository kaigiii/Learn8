from datetime import timedelta
import hashlib
import secrets
from typing import Optional, Any
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings
from app.core.time import utc_now

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(subject: str | Any, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = utc_now() + expires_delta
    else:
        expire = utc_now() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt 針對輸入長度有 72 bytes 的限制；確保我們針對相同的截斷輸入進行驗證
    def _truncate_pw(pw: str) -> str:
        if pw is None:
            return pw
        b = pw.encode("utf-8")
        if len(b) <= 72:
            return pw
        return b[:72].decode("utf-8", errors="ignore")

    return pwd_context.verify(_truncate_pw(plain_password), hashed_password)


def validate_password_strength(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number"
    if not any(not c.isalnum() for c in password):
        return "Password must contain at least one special character"
    return None


def get_password_hash(password: str) -> str:
    # bcrypt 僅接受至多 72 bytes；進行決定性的字串截除以避免錯誤
    if password is None:
        raise ValueError("Password must not be None")
    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) > 72:
        pw_bytes = pw_bytes[:72]
        password = pw_bytes.decode("utf-8", errors="ignore")
    return pwd_context.hash(password)


def create_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
