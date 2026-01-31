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
        - 邏輯: 自動建立或登入 "dev@learn8.ai" 帳號，免輸入密碼。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import UserModel
from app.schemas.auth import UserCreate, UserLogin, Token, UserUpdate
from app.services.activity_logger import ActivityLogger

router = APIRouter()

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    try:
        # Password Validation
        password = user.password
        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        if not any(c.isupper() for c in password):
            raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
        if not any(c.islower() for c in password):
            raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in password):
            raise HTTPException(status_code=400, detail="Password must contain at least one number")

        db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = get_password_hash(user.password)
        db_user = UserModel(
            email=user.email, 
            hashed_password=hashed_password,
            full_name=user.full_name,
            phone_number=user.phone_number
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        ActivityLogger.log_register(db_user.id, db_user.email)
        return {"message": "User created successfully"}
    except HTTPException:
        # Re-raise HTTPExceptions (validation / client errors)
        raise
    except Exception as e:
        # For debugging: return error detail so frontend can show it
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        ActivityLogger.log_login_failed(user.email)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    ActivityLogger.log_login(db_user.id, db_user.email)
    access_token = create_access_token(subject=db_user.email)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/dev-login", response_model=Token)
def dev_login(db: Session = Depends(get_db)):
    dev_email = "dev@learn8.ai"
    db_user = db.query(UserModel).filter(UserModel.email == dev_email).first()
    
    if not db_user:
        hashed_password = get_password_hash("dev_password")
        db_user = UserModel(email=dev_email, hashed_password=hashed_password)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
    access_token = create_access_token(subject=db_user.email)
    return {"access_token": access_token, "token_type": "bearer"}

from app.schemas.auth import UserResponse

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return current_user



@router.put("/me", response_model=UserResponse)
def update_user_me(
    user_in: UserUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    if user_in.phone_number is not None:
        current_user.phone_number = user_in.phone_number
    if user_in.job_title is not None:
        current_user.job_title = user_in.job_title
    if user_in.education_level is not None:
        current_user.education_level = user_in.education_level
    if user_in.daily_learning_goal_minutes is not None:
        current_user.daily_learning_goal_minutes = user_in.daily_learning_goal_minutes
    
    # Collect changed fields for logging
    changed_fields = [k for k, v in user_in.model_dump(exclude_unset=True).items() if v is not None]
    
    db.commit()
    db.refresh(current_user)
    
    if changed_fields:
        ActivityLogger.log_profile_edit(current_user.id, current_user.email, changed_fields)
    
    return current_user

@router.delete("/me", status_code=204)
def delete_user_me(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Optional: Delete associated projects/progress if needed, 
    # but cascading deletes might handle this if set up in models.
    # For now, just delete the user.
    db.delete(current_user)
    db.commit()
    return

@router.post("/credits/topup", response_model=UserResponse)
def top_up_credits(amount: int = 100, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.credits += amount
    db.commit()
    db.refresh(current_user)
    
    ActivityLogger.log_credits_topup(current_user.id, current_user.email, amount, current_user.credits)
    return current_user
