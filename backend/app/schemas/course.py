"""
模組名稱: app.schemas.course
功能描述: 課程與大綱資料架構 (Course Syllabus Schemas)

定義課程結構的 Pydantic 模型，這是學習路徑的核心骨架。
採用巢狀結構：CoursePath -> Units -> Nodes。

主要模型:
    1. LessonNode (學習節點)
        - 描述: 課程從中最小的學習單位。
        - 欄位:
             - status: 節點狀態 (locked/available/completed)。
             - recommended_component: AI 建議使用的遊戲化組件 (如 TextToken)。
             - instructional_goal: 該節點的具體教學目標。

    2. Unit (學習單元)
        - 描述: 由多個節點組成的章節。

    3. CoursePath (完整大綱)
        - 描述: 整個課程的藍圖。

    4. RefineSyllabusRequest
        - 用途: 使用者要求 AI "修正大綱" 時的請求格式。
        - 欄位: userFeedback (使用者的修改意見)。
"""

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
