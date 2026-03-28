import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.dependencies import get_db, get_current_user
from app.core.security import (
    create_access_token,
    create_reset_token,
    get_password_hash,
    hash_reset_token,
    validate_password_strength,
    verify_password,
)
from app.models.user import UserModel
from app.models.password_reset import PasswordResetTokenModel
from app.schemas.auth_schema import (
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetResponse,
    Token,
    UserCreate,
    UserLogin,
    UserUpdate,
)
from app.services.commons.activity_logger import ActivityLogger
from app.core.config import settings

router = APIRouter()
EMAIL_RE = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _validate_email(email: str) -> None:
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")


def _remaining_lockout_minutes(locked_until: datetime) -> int:
    remaining = locked_until - datetime.now(timezone.utc)
    total_seconds = max(int(remaining.total_seconds()), 0)
    return max((total_seconds + 59) // 60, 1)


@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    try:
        normalized_email = _normalize_email(user.email)
        _validate_email(normalized_email)

        # 驗證密碼強度
        password = user.password
        password_error = validate_password_strength(password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)

        db_user = db.query(UserModel).filter(UserModel.email == normalized_email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed_password = get_password_hash(user.password)
        db_user = UserModel(
            email=normalized_email,
            hashed_password=hashed_password,
            full_name=_normalize_optional_text(user.full_name),
            phone_number=_normalize_optional_text(user.phone_number),
            password_changed_at=datetime.now(timezone.utc),
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        ActivityLogger.log_register(db_user.id, db_user.email)
        return {"message": "User created successfully"}
    except HTTPException:
        # 重新拋出已知的 HTTP 錯誤 (如驗證失敗)
        raise
    except Exception as e:
        # 捕捉未知錯誤並回傳給前端除錯
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    normalized_email = _normalize_email(user.email)
    _validate_email(normalized_email)

    db_user = db.query(UserModel).filter(UserModel.email == normalized_email).first()
    if not db_user:
        ActivityLogger.log_login_failed(normalized_email)
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if db_user.locked_until and db_user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=(
                "Your account is temporarily locked due to repeated failed sign-in attempts. "
                f"Try again in {_remaining_lockout_minutes(db_user.locked_until)} minute(s)."
            ),
        )

    if not verify_password(user.password, db_user.hashed_password):
        db_user.failed_login_attempts = (db_user.failed_login_attempts or 0) + 1
        if db_user.failed_login_attempts >= settings.AUTH_MAX_LOGIN_ATTEMPTS:
            db_user.locked_until = datetime.now(timezone.utc) + timedelta(
                minutes=settings.AUTH_LOCKOUT_MINUTES
            )
            ActivityLogger.log_account_locked(
                db_user.id, db_user.email, db_user.locked_until
            )
        db.commit()
        ActivityLogger.log_login_failed(normalized_email)
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    db_user.failed_login_attempts = 0
    db_user.locked_until = None
    db_user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    ActivityLogger.log_login(db_user.id, db_user.email)
    access_token = create_access_token(subject=db_user.email)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/forgot-password", response_model=PasswordResetResponse)
def forgot_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    normalized_email = _normalize_email(request.email)
    _validate_email(normalized_email)

    user = db.query(UserModel).filter(UserModel.email == normalized_email).first()
    ActivityLogger.log_password_reset_requested(normalized_email)

    response = PasswordResetResponse(
        message="If an account exists for that email, a password reset link has been issued."
    )

    if not user:
        return response

    reset_window_start = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_requests = (
        db.query(PasswordResetTokenModel)
        .filter(
            PasswordResetTokenModel.user_id == user.id,
            PasswordResetTokenModel.created_at >= reset_window_start,
        )
        .count()
    )
    if recent_requests >= settings.AUTH_MAX_RESET_REQUESTS_PER_HOUR:
        ActivityLogger.log_reset_rate_limited(normalized_email)
        return response

    db.query(PasswordResetTokenModel).filter(
        PasswordResetTokenModel.user_id == user.id,
        PasswordResetTokenModel.used_at.is_(None),
    ).delete()

    raw_token = create_reset_token()
    reset_token = PasswordResetTokenModel(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc)
        + timedelta(minutes=settings.AUTH_RESET_TOKEN_TTL_MINUTES),
    )
    db.add(reset_token)
    db.commit()

    if settings.AUTH_DEBUG_EXPOSE_RESET_TOKEN:
        response.reset_token = raw_token
        response.reset_path = f"/auth/reset-password?token={raw_token}"

    return response


@router.post("/reset-password", response_model=PasswordResetResponse)
def reset_password(request: PasswordResetConfirm, db: Session = Depends(get_db)):
    password_error = validate_password_strength(request.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    token_hash = hash_reset_token(request.token)
    reset_token = (
        db.query(PasswordResetTokenModel)
        .filter(PasswordResetTokenModel.token_hash == token_hash)
        .first()
    )

    if not reset_token or reset_token.used_at is not None:
        raise HTTPException(status_code=400, detail="This password reset link is invalid.")

    if reset_token.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This password reset link has expired.")

    user = db.query(UserModel).filter(UserModel.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This password reset link is invalid.")

    if verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Please choose a new password that differs from your current password.",
        )

    user.hashed_password = get_password_hash(request.password)
    reset_token.used_at = datetime.now(timezone.utc)
    user.password_changed_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0
    user.locked_until = None

    db.query(PasswordResetTokenModel).filter(
        PasswordResetTokenModel.user_id == user.id,
        PasswordResetTokenModel.id != reset_token.id,
        PasswordResetTokenModel.used_at.is_(None),
    ).delete()
    db.commit()

    ActivityLogger.log_password_reset_completed(user.id, user.email)
    return PasswordResetResponse(message="Password reset successful. You can now sign in.")


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


from app.schemas.auth_schema import UserResponse


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_user_me(
    user_in: UserUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
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

    # 蒐集有變更的欄位以供日誌紀錄
    changed_fields = [
        k for k, v in user_in.model_dump(exclude_unset=True).items() if v is not None
    ]

    db.commit()
    db.refresh(current_user)

    if changed_fields:
        ActivityLogger.log_profile_edit(
            current_user.id, current_user.email, changed_fields
        )

    return current_user


@router.delete("/me", status_code=204)
def delete_user_me(
    current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
):
    # 刪除使用者帳號及其所有關聯資料 (依賴資料庫的 cascading deletes 設定)
    db.delete(current_user)
    db.commit()
    return


@router.post("/credits/top-up", response_model=UserResponse)
def top_up_user_credits(
    amount: int = 100,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.credits += amount
    db.commit()
    db.refresh(current_user)

    ActivityLogger.log_credits_top_up(
        current_user.id, current_user.email, amount, current_user.credits
    )
    return current_user
