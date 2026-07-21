from typing import List, Optional, Any
from pydantic import BaseModel


class Question(BaseModel):
    id: str
    text: str
    type: str = "choice"
    options: Optional[List[str]] = None  # 設為可選以增加彈性


class QuestionnaireResponse(BaseModel):
    question_id: str
    answer: Any


class QuestionnaireSubmission(BaseModel):
    responses: List[QuestionnaireResponse]


class LearnerProfile(BaseModel):
    summary: str
    attributes: dict = {}
    learning_style: Optional[str] = None
    experience_level: Optional[str] = None
    goals: Optional[List[str]] = None


class QuestionnaireSubmitRequest(BaseModel):
    """問卷填寫的綜合請求格式。"""

    submission: QuestionnaireSubmission
    topic: str
    questions: List[Question]
    additional_notes: Optional[str] = None
