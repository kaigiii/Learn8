from typing import List
from app.services.llm_clients.base import BaseLLMProvider
from app.schemas.questionnaire import Question, QuestionnaireSubmission, LearnerProfile
from app.services.knowledge_base.rag_engine import RAGEngine
from pydantic import BaseModel

GENERATE_QUESTIONS_PROMPT = """You are an expert educational psychologist.
Your task is to create a short, adaptive questionnaire (3-5 questions) for a student about to learn: "{topic}".
The goal is to understand their learning style, background knowledge, and personality to tailor the course.

Context from their uploaded materials:
{context}

Output a JSON object with:
- questions: List of objects {{ "id": string, "text": string, "type": "choice", "options": [string] }}

RULES:
1. GENERATE ONLY MULTIPLE CHOICE QUESTIONS.
2. MUST provide 2-5 concise options (e.g. A, B, C, D) for every question.
3. ALL questions must have options. Do NOT create open-ended questions.
4. Do NOT include "Other" or "Skip" options (the UI adds them automatically).
"""

SUMMARIZE_PROFILE_PROMPT = """You are an expert curriculum designer.
Analyze the following student responses to a pre-course questionnaire about "{topic}".

Questions & Answers:
{qa_pairs}

Create a concise "Learner Profile" that I can use to customize their syllabus.
Identify their:
1. Learning Style (Visual, Theoretical, Practical, etc.)
2. Knowledge Level (Beginner, Intermediate, Advanced)
3. Specific Interests
4. Tone preference

Output a JSON object with:
- summary: string (A paragraph describing the learner)
- attributes: dict (Key-value pairs of the identified traits)
"""

class QuestionList(BaseModel):
    questions: List[Question]

class QuestionnaireAgent:
    def __init__(self, provider: BaseLLMProvider, rag_engine: RAGEngine):
        self.provider = provider
        self.rag_engine = rag_engine

    async def generate_questions(self, topic: str, project_id: int = None) -> List[Question]:
        
        # Get context to make questions relevant
        context_chunks = await self.rag_engine.query_context(topic, k=2, project_id=project_id)
        context_str = "\\n".join(context_chunks) if context_chunks else "No specific context."

        messages = [
            ("system", GENERATE_QUESTIONS_PROMPT.format(topic=topic, context=context_str)),
            ("user", "Generate the questionnaire.")
        ]
        
        try:
            result = await self.provider.generate_structured(messages, QuestionList)
            return result.questions if result else []
        except Exception as e:
            print(f"Questionnaire Generation Error: {e}")
            return []

    async def summarize_responses(self, topic: str, submission: QuestionnaireSubmission, questions: List[Question]) -> LearnerProfile:
        
        # Map IDs to Text
        q_map = {q.id: q.text for q in questions}
        
        qa_pairs = []
        for resp in submission.responses:
            q_text = q_map.get(resp.question_id, "Unknown Question")
            qa_pairs.append(f"Q: {q_text}\nA: {resp.answer}")
            
        qa_str = "\n\n".join(qa_pairs)
        
        messages = [
            ("system", SUMMARIZE_PROFILE_PROMPT.format(topic=topic, qa_pairs=qa_str)),
            ("user", "Generate the learner profile.")
        ]
        
        try:
            return await self.provider.generate_structured(messages, LearnerProfile)
        except Exception as e:
            print(f"Profile Summarization Error: {e}")
            # Fallback
            return LearnerProfile(summary="Failed to generate profile.", attributes={})

from fastapi import Depends
from app.services.llm_clients.factory import get_llm_provider
from app.services.knowledge_base.rag_engine import get_rag_engine

def get_questionnaire_agent(
    provider: BaseLLMProvider = Depends(get_llm_provider),
    rag_engine: RAGEngine = Depends(get_rag_engine)
) -> QuestionnaireAgent:
    """FastAPI Dependency for QuestionnaireAgent"""
    return QuestionnaireAgent(provider, rag_engine)
