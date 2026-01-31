"""
模組名稱: app.core.security
功能描述: 安全認證工具組 (Security & Authentication Utilities)

此模組提供後端安全相關的核心功能，包括密碼加密雜湊 (Hashing) 與 
JWT (JSON Web Token) 的簽發與驗證。

主要依賴:
    - jose (python-jose): 用於處理 JWT 的編碼與解碼。
    - passlib (bcrypt): 用於安全的密碼雜湊處理。
    - app.core.config: 讀取 SECRET_KEY 與 ALGORITHM 設定。

全域變數:
    - pwd_context: CryptContext 實例，配置使用 bcrypt 演算法。

主要函式 (Functions):
    1. create_access_token(subject: str | Any, expires_delta: timedelta = None) -> str
        - 功能: 產生 JWT Access Token。
        - 參數:
            - subject: Token 的主體 (通常是 User ID 或 Username)。
            - expires_delta: (選填) Token 有效期限，若未填則使用預設值。
        - 回傳: 編碼後的 JWT 字串。

    2. verify_password(plain_password: str, hashed_password: str) -> bool
        - 功能: 驗證明文密碼是否與雜湊密碼匹配。
        - 參數:
            - plain_password: 使用者輸入的明文密碼。
            - hashed_password: 資料庫中儲存的雜湊密碼。
        - 回傳: 驗證成功回傳 True，否則 False。

    3. get_password_hash(password: str) -> str
        - 功能: 將明文密碼進行雜湊加密。
        - 參數:
            - password: 明文密碼。
        - 回傳: 加密後的雜湊字串 (用於存入資料庫)。
"""

from datetime import datetime, timedelta
from typing import Optional, Any
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(subject: str | Any, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt has a 72-byte input limit; ensure we verify against the same truncated input
    def _truncate_pw(pw: str) -> str:
        if pw is None:
            return pw
        b = pw.encode('utf-8')
        if len(b) <= 72:
            return pw
        return b[:72].decode('utf-8', errors='ignore')

    return pwd_context.verify(_truncate_pw(plain_password), hashed_password)

def get_password_hash(password: str) -> str:
    # bcrypt only accepts up to 72 bytes; truncate deterministically to avoid errors
    if password is None:
        raise ValueError("Password must not be None")
    pw_bytes = password.encode('utf-8')
    if len(pw_bytes) > 72:
        pw_bytes = pw_bytes[:72]
        password = pw_bytes.decode('utf-8', errors='ignore')
    return pwd_context.hash(password)
