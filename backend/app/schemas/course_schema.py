from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class LessonNodeStatus(str, Enum):
    locked = "locked"
    available = "available"
    completed = "completed"


class LessonNode(BaseModel):
    id: str
    title: str
    description: str
    status: LessonNodeStatus = LessonNodeStatus.locked


class Unit(BaseModel):
    unitId: str
    unitTitle: str
    unitDescription: str  # 單元描述
    nodes: List[LessonNode]


class CoursePath(BaseModel):
    id: Optional[int] = None
    topic: Optional[str] = None  # 用於重新生成時保留主題
    courseTitle: str
    description: Optional[str] = None
    units: List[Unit]


class RefineSyllabusRequest(BaseModel):
    topic: str
    currentSyllabus: CoursePath
    userFeedback: str
    history: List[Dict[str, str]] = Field(default_factory=list)
    projectId: Optional[int] = None


class UpdateNodeStatusRequest(BaseModel):
    status: LessonNodeStatus
