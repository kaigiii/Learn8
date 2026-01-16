
from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel

class LessonNodeType(str, Enum):
    Concept = 'concept'
    Exercise = 'exercise'
    Quiz = 'quiz'

class LessonNode(BaseModel):
    id: str
    title: str
    description: str
    type: LessonNodeType
    status: str = "locked"
    # Detailed Planning Fields
    recommended_component: Optional[str] = None # e.g. "TextToken"
    instructional_goal: Optional[str] = None # e.g. "Explain the definition of Matrix"

class Unit(BaseModel):
    unitId: str
    unitTitle: str
    unitDescription: str # Added description
    nodes: List[LessonNode]

class CoursePath(BaseModel):
    id: Optional[int] = None
    courseTitle: str
    units: List[Unit]

class RefineSyllabusRequest(BaseModel):
    topic: str
    currentSyllabus: CoursePath
    userFeedback: str
    history: List[Dict[str, str]] = [] 
    projectId: Optional[int] = None

class UpdateNodeStatusRequest(BaseModel):
    status: str 
