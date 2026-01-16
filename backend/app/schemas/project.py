
from typing import Any
from pydantic import BaseModel

class ProjectCreate(BaseModel):
    name: str

class ProjectResponse(BaseModel):
    id: int
    name: str
    user_id: int
    created_at: Any
    
    class Config:
        from_attributes = True
