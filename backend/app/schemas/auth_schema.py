from pydantic import BaseModel, Field

from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=120)
    phone_number: Optional[str] = Field(default=None, max_length=40)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    phone_number: Optional[str] = Field(default=None, max_length=40)
    job_title: Optional[str] = Field(default=None, max_length=120)
    education_level: Optional[str] = Field(default=None, max_length=120)
    preferred_language: Optional[str] = Field(default=None, max_length=80)
    daily_learning_goal_minutes: Optional[int] = None
    # email/password 的更新可於日後視需求加入


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    password: str = Field(min_length=8, max_length=128)


class PasswordResetResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None
    reset_path: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    credits: int
    xp: int = 0
    level: int = 1
    xp_to_next_level: int = 100
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    job_title: Optional[str] = None
    education_level: Optional[str] = None
    preferred_language: Optional[str] = None
    daily_learning_goal_minutes: int = 30


class UserLedgerEventResponse(BaseModel):
    id: int
    event_type: str
    event_key: Optional[str] = None
    credits_delta: int
    xp_delta: int
    credits_balance_after: int
    xp_balance_after: int
    level_after: int
    metadata_json: Optional[dict] = None
    created_at: str


class UserLedgerResponse(BaseModel):
    items: list[UserLedgerEventResponse]
    total: int
