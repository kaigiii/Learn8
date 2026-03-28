from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class CourseLifecycleStatus(str, Enum):
    draft = "draft"
    questionnaire_ready = "questionnaire_ready"
    profiling = "profiling"
    generating = "generating"
    ready = "ready"
    archived = "archived"


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
    courseId: Optional[int] = None


class CourseUpdateRequest(BaseModel):
    title: str = Field(min_length=1)


class UpdateNodeStatusRequest(BaseModel):
    status: LessonNodeStatus


class CourseCreateRequest(BaseModel):
    title: str = Field(min_length=1)
    topic: Optional[str] = None
    status: CourseLifecycleStatus = CourseLifecycleStatus.draft


class CourseDraftRequest(BaseModel):
    draft: dict


class CourseProfileUpdateRequest(BaseModel):
    profile: dict
