import json
import os
import asyncio
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

from pydantic import BaseModel
from app.schemas.course_schema import CoursePath, RefineSyllabusRequest, LessonNode
from app.schemas.lesson_schema import LessonStage, SubmissionResponse, FailedStageRecord
from app.services.ai_engine.kb.rag_engine import RAGEngine
from app.services.infra.files.service import FileService
from app.services.ai_engine.clients.base_provider import BaseLLMProvider
from app.core.exceptions import LLMGenerationError
from app.core.config import settings
from app.services.domain.user.activity_logger import activity_logger

# --- PROMPTS ---

from app.services.ai_engine.agents.course_architect_prompts import (
    build_node_system_prompt,
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
        from app.services.ai_engine.agents.syllabus_agent import SyllabusAgent, AuditorOutput
        from app.services.ai_engine.agents.syllabus_prompts import AUDITOR_SYSTEM_PROMPT

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
            from app.services.domain.user.activity_logger import activity_logger
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

        # 1. Check if course has materials uploaded, and upload directly to Google server
        files_used = []
        if user_id and course_folder:
            files = self.file_service.list_files(user_id, course_folder)
            if files:
                files_used = [
                    str(self.file_service.get_upload_dir(user_id, course_folder) / f)
                    for f in files
                ]

        if settings.AI_LESSON_USE_FILE_API and files_used:
            self.provider.bind_files(files_used, use_google_file_api=True)
            rag_context = "Reference materials uploaded directly to Google servers. Focus generation on these materials."
        else:
            # Fallback to local RAG context if no files uploaded or if File API is disabled for lessons
            context_chunks = await self.rag_engine.query_context(topic, course_id=course_id)
            rag_context = (
                "\n\n".join(context_chunks)
                if context_chunks
                else "No specific database context found."
            )
            # Bind files locally as plain text if requested and File API is disabled for lessons
            if not settings.AI_LESSON_USE_FILE_API and include_full_files and files_used:
                self.provider.bind_files(files_used, use_google_file_api=False)

        from langchain_core.messages import HumanMessage, SystemMessage

        # 3. 建立系統提示訊息
        system_content = (
            build_node_system_prompt(allowed_components).format(profile=profile)
            + f"\n\nVector Database Context:\n{rag_context}"
        )
        if media_catalog:
            system_content += (
                "\n\nUse the media catalog ONLY for `ExplainerMedia` stages. "
                "If you want to show an image, you MUST set `mediaType` to `image` "
                "and provide `mediaIndex` from the catalog. "
                "Do NOT provide mediaUrl or fabricate URLs. "
                "Do NOT embed image data."
                "\n\n"
                + media_catalog
            )

        system_message = SystemMessage(content=system_content)

        # 4. 建立使用者提示與多模態圖片訊息
        user_content_parts = [
            {
                "type": "text",
                "text": f"TOPIC: {topic}\nNODE TITLE: {node.title}\nNODE DESC: {node.description}"
            }
        ]

        # 如果有圖片，則一併將實體圖片讀取為 Base64 數據並附在使用者訊息中，供 Vision LLM 視覺對比挑選
        if media_catalog and course_id is not None and user_id is not None and course_folder is not None:
            from app.db.session import SessionLocal
            from app.models.course_media_asset import CourseMediaAssetModel
            from app.services.infra.media.catalog import build_media_catalog
            import base64

            db = SessionLocal()
            try:
                assets = (
                    db.query(CourseMediaAssetModel)
                    .filter(CourseMediaAssetModel.course_id == course_id)
                    .order_by(
                        CourseMediaAssetModel.source_filename.asc(),
                        CourseMediaAssetModel.page_number.asc().nullslast(),
                        CourseMediaAssetModel.asset_index.asc().nullslast(),
                        CourseMediaAssetModel.id.asc(),
                    )
                    .all()
                )
                if assets:
                    catalog_items = build_media_catalog(assets)
                    upload_dir = self.file_service.get_upload_dir(user_id, course_folder)
                    
                    user_content_parts.append({
                        "type": "text",
                        "text": "\n\nBelow are the actual images in this course corresponding to the catalog indices. Please visually check them to match the slides:\n"
                    })

                    for item in catalog_items:
                        img_path = upload_dir / "images" / item.asset_filename
                        if os.path.exists(img_path):
                            try:
                                with open(img_path, "rb") as img_f:
                                    img_bytes = img_f.read()
                                ext = item.asset_filename.split(".")[-1]
                                if ext.lower() not in ["png", "jpeg", "jpg", "webp"]:
                                    ext = "png"
                                b64_img = base64.b64encode(img_bytes).decode("utf-8")
                                data_uri = f"data:image/{ext};base64,{b64_img}"

                                user_content_parts.append({
                                    "type": "text",
                                    "text": f"[IMAGE INDEX: {item.index}] Description: {item.description or 'No description'}"
                                })
                                user_content_parts.append({
                                    "type": "image_url",
                                    "image_url": {"url": data_uri}
                                })
                            except Exception as img_err:
                                activity_logger.warning(
                                    f"Failed to load catalog image {img_path} for slide architect: {img_err}"
                                )
            finally:
                db.close()

        user_message = HumanMessage(content=user_content_parts)
        messages = [system_message, user_message]

        # 用於支援 List 型別的 Pydantic Wrapper
        class StageListWrapper(BaseModel):
            stages: List[LessonStage]

        try:
            wrapper = await self.provider.generate_structured(
                messages, StageListWrapper, user_id=user_id
            )
            if wrapper and wrapper.stages:
                # 後處理：補上 ID
                for i, stage in enumerate(wrapper.stages):
                    stage.stageId = f"{node.id}-s{i}"
                # 執行動態註冊的組件擺放器 (如圍棋座標翻譯)
                from app.services.domain.learning.lesson_components.placer_registry import placer_registry
                import app.services.domain.learning.lesson_components.go.placer  # 強制載入並註冊圍棋 Placer
                
                placer_tasks = []
                for stage in wrapper.stages:
                    placer = placer_registry.get(stage.component)
                    if placer:
                        placer_tasks.append(placer(stage, self.provider))
                if placer_tasks:
                    await asyncio.gather(*placer_tasks)

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
        media_catalog: str | None = None,
    ) -> List[LessonStage]:
        if not failed_records:
            return []

        user_content = (
            "TOPIC: "
            + (topic or "General")
            + "\nFAILED RECORDS: "
            + json.dumps([record.model_dump() for record in failed_records], ensure_ascii=False)
        )

        if media_catalog:
            user_content += (
                "\n\nUse the media catalog ONLY for `ExplainerMedia` stages. "
                "Specify the `mediaType` as 'image' and provide the correct `mediaIndex` from the catalog below.\n\n"
                + media_catalog
            )

        messages = [
            ("system", build_remedial_system_prompt(learner_profile_summary)),
            ("user", user_content),
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
                # 執行動態註冊的組件擺放器 (如圍棋座標翻譯)
                from app.services.domain.learning.lesson_components.placer_registry import placer_registry
                import app.services.domain.learning.lesson_components.go.placer  # 強制載入並註冊圍棋 Placer
                
                placer_tasks = []
                for stage in wrapper.stages:
                    placer = placer_registry.get(stage.component)
                    if placer:
                        placer_tasks.append(placer(stage, self.provider))
                if placer_tasks:
                    await asyncio.gather(*placer_tasks)

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
        context_str = "No specific reference material provided."
        if course_id:
            context_chunks = await self.rag_engine.query_context(topic, course_id=course_id)
            if context_chunks:
                context_str = "\n\n".join(context_chunks)

        messages = [
            ("system", SYSTEM_PROMPT_FEYNMAN_STUDENT.format(topic=topic, context=context_str)),
        ]
        # Append history
        for msg in conversation_history:
            role = "user" if msg["role"] == "teacher" else "assistant"
            messages.append((role, msg["content"]))
        
        # Only append user_input if it's not already the last message in history
        if not conversation_history or conversation_history[-1]["content"] != user_input:
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
        round_count: int = 10,
        course_id: Optional[int] = None,
    ) -> str:
        context_chunks = await self.rag_engine.query_context(topic, course_id=course_id)
        context_str = "\n\n".join(context_chunks) if context_chunks else "General Knowledge"

        messages = [
            ("system", SYSTEM_PROMPT_FEYNMAN_ADVISOR.format(topic=topic, context=context_str, round_count=round_count)),
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
        course_id: Optional[int] = None,
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
        context_chunks = await self.rag_engine.query_context(retrieval_query or course_topic, course_id=course_id)
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
from app.services.ai_engine.clients.factory import get_llm_provider
from app.services.ai_engine.kb.rag_engine import get_rag_engine
from app.services.infra.files.service import get_file_service


def get_architect_service(
    provider: BaseLLMProvider = Depends(get_llm_provider),
    rag_engine: RAGEngine = Depends(get_rag_engine),
    file_service: FileService = Depends(get_file_service),
) -> AIArchitectService:
    return AIArchitectService(provider, rag_engine, file_service)
