from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.domain.statuses import CourseStatus, NodeStatus


class CourseLifecycleStatus(str, Enum):
    draft = CourseStatus.DRAFT
    questionnaire_ready = CourseStatus.QUESTIONNAIRE_READY
    profiling = CourseStatus.PROFILING
    generating = CourseStatus.GENERATING
    ready = CourseStatus.READY
    archived = CourseStatus.ARCHIVED


class LessonNodeStatus(str, Enum):
    locked = NodeStatus.LOCKED
    available = NodeStatus.AVAILABLE
    completed = NodeStatus.COMPLETED


class LessonNode(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    id: str
    title: str
    description: str
    status: LessonNodeStatus = LessonNodeStatus.locked
    hasGeneratedLesson: bool = False


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
    isPublic: bool = False
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
