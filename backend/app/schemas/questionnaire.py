from typing import List, Optional, Any
from pydantic import BaseModel

class Question(BaseModel):
    id: str
    text: str
    type: str = "choice" 
    options: Optional[List[str]] = None  # Made optional for flexibility

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
    """Combined request body for questionnaire submission."""
    submission: QuestionnaireSubmission
    topic: str
    questions: List[Question]
