"""
模組名稱: app.api.deps
功能描述: API 依賴注入 (Dependency Injection)

定義了 FastAPI 的 Depends 依賴項，供路由函式使用。
主要負責處理「通用」的任務，如資料庫連線管理與使用者身分驗證。

主要函式:
    1. get_db() -> Generator
        - 功能: 取得資料庫連線 (Session)。
        - 機制: 使用 yield 語法，確保請求結束後自動關閉連線 (db.close)。

    2. get_current_user(token, db) -> UserModel
        - 功能: 解析 JWT Token 並取得當前使用者物件。
        - 流程:
            1. 從 Header 取得 Bearer Token。
            2. 使用 SECRET_KEY 解碼 Token。
            3. 從 DB 查詢對應 email 的使用者。
        - 異常: 若 Token 無效或過期，拋出 HTTP 401 Unauthorized。
"""

from typing import Generator, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.config import settings
from app.models.user import UserModel

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserModel:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if user is None:
        raise credentials_exception
    return user
