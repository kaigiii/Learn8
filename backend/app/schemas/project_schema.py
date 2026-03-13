from typing import Any
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: int
    name: str
    user_id: int
    created_at: Any

    class Config:
        from_attributes = True


class DraftRequest(BaseModel):
    """儲存專案草稿的請求格式。"""

    draft: dict
