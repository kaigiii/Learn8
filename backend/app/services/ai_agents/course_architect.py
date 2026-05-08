import json
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

from pydantic import BaseModel
from app.schemas.course_schema import CoursePath, RefineSyllabusRequest, LessonNode
from app.schemas.lesson_schema import LessonStage, SubmissionResponse, FailedStageRecord
from app.services.knowledge_base.rag_engine import RAGEngine
from app.services.commons.file_service import FileService
from app.services.llm_clients.base_provider import BaseLLMProvider
from app.core.exceptions import LLMGenerationError
from app.services.commons.activity_logger import activity_logger

# --- PROMPTS ---

from app.services.ai_agents.course_architect_prompts import (
    REFINE_SYLLABUS_PROMPT,
    NODE_SYSTEM_PROMPT,
    build_node_system_prompt,
    REMEDIAL_SYSTEM_PROMPT,
    build_remedial_system_prompt,
    SYSTEM_PROMPT_FEYNMAN_STUDENT,
    SYSTEM_PROMPT_FEYNMAN_ADVISOR,
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
        course_folder: Optional[str] = None,
        learner_profile_summary: str = "",
    ) -> Optional[CoursePath]:
        from app.services.ai_agents.syllabus_agent import SyllabusAgent, AuditorOutput
        from app.services.ai_agents.syllabus_prompts import AUDITOR_SYSTEM_PROMPT

        refine_system_prompt = (
            AUDITOR_SYSTEM_PROMPT
            + f"\n\nCRITICAL USER REQUEST:\nThe user explicitly requested the following change: '{user_feedback}'.\nYou MUST prioritize and apply this specific modification if it aligns with pedagogical logic. Output the required tool actions to apply the change."
        )

        auditor_messages = [
            ("system", refine_system_prompt),
            ("user", f"Current Syllabus Draft:\n{current_syllabus.model_dump_json()}"),
        ]

        try:
            auditor_out = await self.provider.generate_structured(auditor_messages, AuditorOutput)
            if auditor_out and auditor_out.actions:
                agent = SyllabusAgent(self.provider)
                agent.apply_actions(current_syllabus, auditor_out.actions)
            return current_syllabus
        except Exception as e:
            from app.services.commons.activity_logger import activity_logger
            activity_logger.error(f"Syllabus Refine Error: {e}")
            return current_syllabus

    async def generate_lesson_from_node(
        self,
        node: LessonNode,
        topic: str,
        user_id: Optional[int] = None,
        course_folder: Optional[str] = None,
        course_id: Optional[int] = None,
        profile: str = "General Learner",
        allowed_components: Optional[List[str]] = None,
        media_catalog: str | None = None,
        include_full_files: bool = False,
    ) -> List[LessonStage]:

        # 1. 取得 RAG 上下文
        context_chunks = await self.rag_engine.query_context(topic, course_id=course_id)
        rag_context = (
            "\n\n".join(context_chunks)
            if context_chunks
            else "No specific database context found."
        )

        # 2. 綁定本地專案檔案 (僅在需要時開啟，避免 lesson generation 過度膨脹)
        if include_full_files and user_id:
            files = self.file_service.list_files(user_id, course_folder)
            if files:
                full_paths = [
                    self.file_service.get_upload_dir(user_id, course_folder) + "/" + f
                    for f in files
                ]
                self.provider.bind_files(full_paths)

        messages = [
            (
                "system",
                build_node_system_prompt(allowed_components).format(profile=profile)
                + f"\n\nVector Database Context:\n{rag_context}"
                + (
                    (
                        "\n\nUse the media catalog ONLY for `ExplainerMedia` stages. "
                        "If you want to show an image, you MUST set `mediaType` to `image` "
                        "and provide `mediaIndex` from the catalog. "
                        "Do NOT provide mediaUrl or fabricate URLs. "
                        "Do NOT embed image data."
                        "\n\n"
                        + media_catalog
                    )
                    if media_catalog
                    else ""
                ),
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

    async def generate_remedial_stages(
        self,
        failed_records: List[FailedStageRecord],
        topic: str = "General",
        learner_profile_summary: str = "",
    ) -> List[LessonStage]:
        if not failed_records:
            return []

        messages = [
            ("system", build_remedial_system_prompt(learner_profile_summary)),
            (
                "user",
                "TOPIC: "
                + (topic or "General")
                + "\nFAILED RECORDS: "
                + json.dumps([record.model_dump() for record in failed_records], ensure_ascii=False),
            ),
        ]

        class RemedialStageListWrapper(BaseModel):
            stages: List[LessonStage]

        try:
            wrapper = await self.provider.generate_structured(
                messages, RemedialStageListWrapper
            )
            if wrapper and wrapper.stages:
                for index, stage in enumerate(wrapper.stages):
                    stage.stageId = f"{failed_records[0].failedStage.stageId}-remedial-{index}"
                return wrapper.stages
            return []
        except Exception as e:
            activity_logger.error(f"Remedial Gen Error: {e}")
            raise LLMGenerationError(f"Failed to generate remedial stages: {e}")

    async def interact_feynman_round(
        self,
        topic: str,
        conversation_history: List[dict],
        user_input: str,
        course_id: Optional[int] = None,
    ) -> dict:
        messages = [
            ("system", SYSTEM_PROMPT_FEYNMAN_STUDENT.format(topic=topic)),
        ]
        # Append history
        for msg in conversation_history:
            role = "user" if msg["role"] == "teacher" else "assistant"
            messages.append((role, msg["content"]))
        
        messages.append(("user", user_input))

        try:
            class FeynmanStudentReply(BaseModel):
                reply: str
                isSatisfied: bool

            result = await self.provider.generate_structured(messages, FeynmanStudentReply)
            return result.model_dump()
        except Exception as e:
            activity_logger.error(f"Feynman Interaction Error: {e}")
            raise LLMGenerationError(f"Failed to process Feynman round: {e}")

    async def generate_feynman_remedial_suggestion(
        self,
        topic: str,
        course_id: Optional[int] = None,
    ) -> str:
        context_chunks = await self.rag_engine.query_context(topic, course_id=course_id)
        context_str = "\n\n".join(context_chunks) if context_chunks else "General Knowledge"

        messages = [
            ("system", SYSTEM_PROMPT_FEYNMAN_ADVISOR.format(topic=topic, context=context_str)),
            ("user", f"Explain how I could have taught '{topic}' better."),
        ]
        try:
            return await self.provider.generate_text(messages)
        except Exception as e:
            activity_logger.error(f"Feynman Advisor Error: {e}")
            raise LLMGenerationError(f"Failed to generate Feynman advice: {e}")

    async def answer_lesson_question(
        self,
        user_question: str,
        course_topic: str,
        course_title: str = "",
        node_title: str = "",
        node_description: str = "",
        active_phase: str = "primary",
        stage_index: int = 0,
        total_stages: int = 1,
        current_stage: Optional[LessonStage] = None,
        conversation: Optional[List[dict]] = None,
        user_id: Optional[int] = None,
        course_folder: Optional[str] = None,
        learner_profile_summary: str = "",
    ) -> str:
        retrieval_query = " | ".join(
            part
            for part in [
                course_topic,
                course_title,
                node_title,
                current_stage.topic if current_stage else "",
            ]
            if part
        )
        context_chunks = await self.rag_engine.query_context(retrieval_query or course_topic)
        rag_context = (
            "\n\n".join(context_chunks)
            if context_chunks
            else "No additional vector context found for this lesson."
        )

        # 課中問答只用 RAG，不再綁定全文檔案

        stage_summary = current_stage.model_dump() if current_stage else None
        recent_conversation = conversation[-6:] if conversation else []

        system_prompt = (
            "You are Learn8's in-lesson AI tutor.\n"
            "Your job is to help the learner understand the current lesson and stage.\n"
            "Stay inside the lesson context. Do not rewrite the syllabus and do not act like the course architect.\n"
            "Prefer hints, explanation, and step-by-step guidance over giving away the final answer immediately.\n"
            "If the learner explicitly asks to change the course outline, tell them to use the map-page syllabus architect.\n"
            "If lesson context is incomplete, say what assumption you are making.\n\n"
            f"Learner profile summary: {learner_profile_summary or 'Not provided.'}\n"
            f"Course topic: {course_topic or course_title or 'Unknown'}\n"
            f"Course title: {course_title or 'Unknown'}\n"
            f"Node title: {node_title or 'Unknown'}\n"
            f"Node description: {node_description or 'Unknown'}\n"
            f"Current phase: {active_phase or 'primary'}\n"
            f"Current stage position: {max(1, stage_index + 1)} / {max(1, total_stages)}\n"
            f"Current stage summary: {json.dumps(stage_summary, ensure_ascii=False) if stage_summary else 'None'}\n"
            f"Vector context: {rag_context}\n"
            f"Recent conversation: {json.dumps(recent_conversation, ensure_ascii=False)}"
        )

        messages = [
            ("system", system_prompt),
            ("user", user_question),
        ]
        try:
            return await self.provider.generate_text(messages)
        except Exception as e:
            activity_logger.error(f"Lesson Tutor Error: {e}")
            raise LLMGenerationError(f"Failed to answer lesson question: {e}")


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
