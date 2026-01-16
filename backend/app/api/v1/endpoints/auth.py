"""
模組名稱: app.api.v1.endpoints.auth
功能描述: 認證相關 API (Authentication Endpoints)

處理使用者註冊、登入以及開發者快速登入功能。

路由列表:
    1. POST /register
        - 功能: 註冊新帳號。
        - 邏輯: 檢查 Email 是否重複 -> 雜湊密碼 -> 寫入 DB。

    2. POST /login
        - 功能: 一般登入。
        - 回傳: JWT Access Token (Bearer)。

    3. POST /dev-login
        - 功能: 開發者快速登入 (僅用於測試環境)。
        - 邏輯: 自動建立或登入 "dev@learna.ai" 帳號，免輸入密碼。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import UserModel
from app.schemas.auth import UserCreate, UserLogin, Token

router = APIRouter()

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = UserModel(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"message": "User created successfully"}

@router.post("/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(subject=db_user.email)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/dev-login", response_model=Token)
def dev_login(db: Session = Depends(get_db)):
    dev_email = "dev@learna.ai"
    db_user = db.query(UserModel).filter(UserModel.email == dev_email).first()
    
    if not db_user:
        hashed_password = get_password_hash("dev_password")
        db_user = UserModel(email=dev_email, hashed_password=hashed_password)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
    access_token = create_access_token(subject=db_user.email)
    return {"access_token": access_token, "token_type": "bearer"}
