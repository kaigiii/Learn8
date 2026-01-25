"""
模組名稱: app.schemas.project
功能描述: 專案管理資料架構 (Project Management Schemas)

定義專案 (Project) 的建立與回傳格式。

主要模型:
    1. ProjectCreate
        - 用途: 建立新專案時只需要提供名稱 (name)。
        - 備註: folder_name 由後端自動生成，不需要前端提供。

    2. ProjectResponse
        - 用途: 回傳專案詳細資訊，包含這 ID 與擁有者資訊。
        - Config: 設定 `from_attributes = True` 以支援從 SQLAlchemy Model 自動轉換。
"""

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
    """Request body for saving project draft."""
    draft: dict
