"""
模組名稱: app.schemas.auth
功能描述: 認證資料架構 (Authentication Schemas)

定義與使用者註冊、登入及權杖 (Token) 相關的 Pydantic 模型。
負責 API 請求主體 (Request Body) 的驗證與序列化。

主要模型:
    1. Token
        - 用途: 回傳給前端的 JWT 資訊。
        - 欄位: access_token, token_type (Bearer)。

    2. UserCreate
        - 用途: 註冊新使用者時的請求格式。
        - 欄位: email, password (明文，後端會加密)。

    3. UserLogin
        - 用途: 使用者登入時的請求格式。
"""

from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    credits: int

