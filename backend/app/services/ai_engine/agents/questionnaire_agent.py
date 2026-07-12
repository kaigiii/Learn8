import logging
from typing import List
from app.services.ai_engine.clients.base_provider import BaseLLMProvider
from app.schemas.questionnaire_schema import Question, QuestionnaireSubmission, LearnerProfile
from app.services.ai_engine.kb.rag_engine import RAGEngine
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.services.ai_engine.agents.questionnaire_prompts import (
    GENERATE_QUESTIONS_PROMPT,
    SUMMARIZE_PROFILE_PROMPT,
)


class QuestionList(BaseModel):
    questions: List[Question]


class QuestionnaireAgent:
    def __init__(self, provider: BaseLLMProvider, rag_engine: RAGEngine):
        self.provider = provider
        self.rag_engine = rag_engine

    async def generate_questions(
        self,
        topic: str,
        course_id: int = None,
        preferred_language: str | None = None,
        files_used: List[str] | None = None,
    ) -> List[Question]:

        from app.core.config import settings

        if settings.AI_QUESTIONNAIRE_USE_FILE_API and files_used:
            self.provider.bind_files(files_used, use_google_file_api=True)
            context_str = "Reference materials uploaded directly. Focus questionnaire on these materials."
        else:
            # 取得上下文以確保問題的關聯性
            context_chunks = await self.rag_engine.query_context(
                topic, k=2, course_id=course_id
            )
            context_str = (
                "\n".join(context_chunks) if context_chunks else "No specific context."
            )

        messages = [
            (
                "system",
                GENERATE_QUESTIONS_PROMPT.format(
                    topic=topic,
                    context=context_str,
                    preferred_language=preferred_language or "Follow the user's default language if available.",
                ),
            ),
            ("user", "Generate the questionnaire."),
        ]

        try:
            result = await self.provider.generate_structured(messages, QuestionList)
            return result.questions if result else []
        except Exception as e:
            logger.error(f"Questionnaire Generation Error: {e}")
            return []

    async def summarize_responses(
        self,
        topic: str,
        submission: QuestionnaireSubmission,
        questions: List[Question],
        preferred_language: str | None = None,
    ) -> LearnerProfile:

        # 將問題 ID 映射回完整文字
        q_map = {q.id: q.text for q in questions}

        qa_pairs = []
        for resp in submission.responses:
            q_text = q_map.get(resp.question_id, "Unknown Question")
            qa_pairs.append(f"Q: {q_text}\nA: {resp.answer}")

        qa_str = "\n\n".join(qa_pairs)

        messages = [
            (
                "system",
                SUMMARIZE_PROFILE_PROMPT.format(
                    topic=topic,
                    qa_pairs=qa_str,
                    preferred_language=preferred_language
                    or "Follow the user's default language if available.",
                ),
            ),
            ("user", "Generate the learner profile."),
        ]

        try:
            return await self.provider.generate_structured(messages, LearnerProfile)
        except Exception as e:
            logger.error(f"Profile Summarization Error: {e}")
            # 失敗時的回退機制
            return LearnerProfile(summary="Failed to generate profile.", attributes={})


from fastapi import Depends
from app.services.ai_engine.clients.factory import get_llm_provider
from app.services.ai_engine.kb.rag_engine import get_rag_engine


def get_questionnaire_agent(
    provider: BaseLLMProvider = Depends(get_llm_provider),
    rag_engine: RAGEngine = Depends(get_rag_engine),
) -> QuestionnaireAgent:
    """FastAPI Dependency for QuestionnaireAgent"""
    return QuestionnaireAgent(provider, rag_engine)
