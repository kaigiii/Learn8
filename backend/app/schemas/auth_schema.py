from pydantic import BaseModel

from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    job_title: Optional[str] = None
    education_level: Optional[str] = None
    daily_learning_goal_minutes: Optional[int] = None
    # email/password 的更新可於日後視需求加入


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    credits: int
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    job_title: Optional[str] = None
    education_level: Optional[str] = None
    daily_learning_goal_minutes: int = 30
