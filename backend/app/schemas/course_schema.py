from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel


class LessonNodeType(str, Enum):
    Concept = "concept"
    Exercise = "exercise"
    Quiz = "quiz"


class LessonNode(BaseModel):
    id: str
    title: str
    description: str
    type: LessonNodeType
    status: str = "locked"
    # 詳細規劃欄位
    recommended_component: Optional[str] = None  # 例如 "TextToken"
    instructional_goal: Optional[str] = None  # 例如 "Explain the definition of Matrix"


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
    history: List[Dict[str, str]] = []
    projectId: Optional[int] = None


class UpdateNodeStatusRequest(BaseModel):
    status: str
