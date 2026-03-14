import json
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

from pydantic import BaseModel
from app.schemas.course_schema import CoursePath, RefineSyllabusRequest, LessonNode
from app.schemas.lesson_schema import LessonStage, SubmissionResponse
from app.services.knowledge_base.rag_engine import RAGEngine
from app.services.commons.file_service import FileService
from app.services.llm_clients.base_provider import BaseLLMProvider
from app.core.exceptions import LLMGenerationError
from app.services.commons.activity_logger import activity_logger

# --- PROMPTS ---

from app.services.ai_agents.course_architect_prompts import (
    REFINE_SYLLABUS_PROMPT,
    NODE_SYSTEM_PROMPT,
    REMEDIAL_SYSTEM_PROMPT,
    SYSTEM_PROMPT_FEYNMAN,
)

# --- LOGIC ---


class AIArchitectService:
    def __init__(
        self,
        provider: BaseLLMProvider,
        rag_engine: RAGEngine,
        file_service: FileService,
    ):
        self.provider = provider
        self.rag_engine = rag_engine
        self.file_service = file_service

    async def refine_course_syllabus(
        self,
        current_syllabus: CoursePath,
        user_feedback: str,
        user_id: Optional[int] = None,
        project_folder: Optional[str] = None,
    ) -> Optional[CoursePath]:
        # 準備上下文檔案
        files = self.file_service.list_files(user_id, project_folder) if user_id else []
        if files:
            full_paths = [
                self.file_service.get_upload_dir(user_id, project_folder) + "/" + f
                for f in files
            ]
            self.provider.bind_files(full_paths)

        current_json = current_syllabus.model_dump_json()

        messages = [
            (
                "system",
                REFINE_SYLLABUS_PROMPT.format(
                    current_syllabus=current_json, user_feedback=user_feedback
                ),
            ),
            (
                "user",
                "Refine the syllabus now.",
            ),  # 格式要求由 Adapter 底層處理
        ]

        try:
            return await self.provider.generate_structured(messages, CoursePath)
        except Exception as e:
            activity_logger.error(f"Refinement Error: {e}")
            raise LLMGenerationError(f"Failed to refine syllabus: {e}")

    async def generate_lesson_from_node(
        self,
        node: LessonNode,
        topic: str,
        user_id: Optional[int] = None,
        project_folder: Optional[str] = None,
        profile: str = "General Learner",
    ) -> List[LessonStage]:

        # 1. 取得 RAG 上下文
        context_chunks = await self.rag_engine.query_context(topic)
        rag_context = (
            "\n\n".join(context_chunks)
            if context_chunks
            else "No specific database context found."
        )

        # 2. 綁定本地專案檔案
        if user_id:
            files = self.file_service.list_files(user_id, project_folder)
            if files:
                full_paths = [
                    self.file_service.get_upload_dir(user_id, project_folder) + "/" + f
                    for f in files
                ]
                self.provider.bind_files(full_paths)

        messages = [
            (
                "system",
                NODE_SYSTEM_PROMPT.format(profile=profile)
                + f"\n\nVector Database Context:\n{rag_context}",
            ),
            (
                "user",
                f"TOPIC: {topic}\nNODE TITLE: {node.title}\nNODE DESC: {node.description}",
            ),
        ]

        # 用於支援 List 型別的 Pydantic Wrapper
        class StageListWrapper(BaseModel):
            stages: List[LessonStage]

        try:
            wrapper = await self.provider.generate_structured(
                messages, StageListWrapper
            )
            if wrapper and wrapper.stages:
                # 後處理：補上 ID
                for i, stage in enumerate(wrapper.stages):
                    stage.stageId = f"{node.id}-s{i}"
                return wrapper.stages
            return []
        except Exception as e:
            activity_logger.error(f"Node Gen Error: {e}")
            raise LLMGenerationError(f"Failed to generate lesson from node: {e}")

    # ...

    async def generate_remedial_stage(
        self, failed_stage: LessonStage, user_input: str, topic: str = "General"
    ) -> Optional[LessonStage]:

        messages = [
            ("system", REMEDIAL_SYSTEM_PROMPT),
            (
                "user",
                f"TOPIC: {topic}\\nFAILED STAGE: {failed_stage.model_dump_json()}\\nUSER INPUT: {user_input}",
            ),
        ]

        class LessonStageWrapper(BaseModel):
            stage: LessonStage

        try:
            wrapper = await self.provider.generate_structured(
                messages, LessonStageWrapper
            )
            return wrapper.stage if wrapper else None
        except Exception as e:
            activity_logger.error(f"Remedial Gen Error: {e}")
            raise LLMGenerationError(f"Failed to generate remedial stage: {e}")

    async def grade_feynman_attempt(self, user_explanation: str, topic: str) -> dict:
        context_chunks = await self.rag_engine.query_context(topic)
        context_str = (
            "\\n\\n".join(context_chunks) if context_chunks else "General Knowledge"
        )

        messages = [
            ("system", SYSTEM_PROMPT_FEYNMAN.format(topic=topic, context=context_str)),
            ("user", f"STUDENT EXPLANATION: {user_explanation}"),
        ]

        try:

            class FeynmanGrade(BaseModel):
                isCorrect: bool
                feedback: str

            result = await self.provider.generate_structured(messages, FeynmanGrade)
            return result.model_dump()
        except Exception as e:
            activity_logger.error(f"Feynman Grade Error: {e}")
            raise LLMGenerationError(f"Failed to grade Feynman attempt: {e}")


from fastapi import Depends
from app.services.llm_clients.factory import get_llm_provider
from app.services.knowledge_base.rag_engine import get_rag_engine
from app.services.commons.file_service import get_file_service


def get_architect_service(
    provider: BaseLLMProvider = Depends(get_llm_provider),
    rag_engine: RAGEngine = Depends(get_rag_engine),
    file_service: FileService = Depends(get_file_service),
) -> AIArchitectService:
    return AIArchitectService(provider, rag_engine, file_service)
