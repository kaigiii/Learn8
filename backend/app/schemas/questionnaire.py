from typing import List, Optional, Any
from pydantic import BaseModel

class Question(BaseModel):
    id: str
    text: str
    type: str = "choice" 
    options: List[str] # Required now

class QuestionnaireResponse(BaseModel):
    question_id: str
    answer: Any

class QuestionnaireSubmission(BaseModel):
    responses: List[QuestionnaireResponse]

class LearnerProfile(BaseModel):
    summary: str
    attributes: dict = {} # E.g., style: visual, level: advanced
