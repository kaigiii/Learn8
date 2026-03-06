"""
模組名稱: app.services.llm.architect
功能描述: AI 架構師服務 (AI Architect Service)

此模組是後端業務邏輯 (Services) 與 LLM 抽象層 (Provider) 之間的橋樑。
負責將具體的業務需求 (如 "生成單元內容") 轉換為 LLM 能夠理解的 Prompt 組合。

主要函式:
    1. generate_course_syllabus (Legacy):
       - 舊版的大綱生成邏輯，目前主要由 SyllabusAgent 取代。

    2. refine_course_syllabus:
       - 功能: 根據使用者回饋 (Feedback) 修改大綱。

    3. generate_lesson_from_node:
       - 功能: 為單一節點生成多階段 (Multi-stage) 的課程內容。
       - 流程: 綁定 RAG 檔案 -> 組合 Prompt -> 呼叫 LLM -> 解析 JSON -> 補上 ID。

    4. generate_remedial_stage:
       - 功能: 生成補救教學內容 (當學生答錯時)。

    5. grade_feynman_attempt:
       - 功能: 對學生的「費曼解釋」進行評分與回饋。
"""

import json
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

from pydantic import BaseModel
from app.schemas.course import CoursePath, RefineSyllabusRequest, LessonNode
from app.schemas.lesson import LessonStage, SubmissionResponse
from app.services.rag_engine import RAGEngine
from app.services.file_service import FileService
from app.services.llm.base import BaseLLMProvider
from app.core.exceptions import LLMGenerationError
from app.services.activity_logger import activity_logger

# --- PROMPTS ---

from app.core.prompts import (
    REFINE_SYLLABUS_PROMPT,
    SYSTEM_PROMPT,
    SYLLABUS_SYSTEM_PROMPT,
    NODE_SYSTEM_PROMPT,
    REMEDIAL_SYSTEM_PROMPT,
    SYSTEM_PROMPT_FEYNMAN
)

# --- LOGIC ---

class AIArchitectService:
    def __init__(self, provider: BaseLLMProvider, rag_engine: RAGEngine, file_service: FileService):
        self.provider = provider
        self.rag_engine = rag_engine
        self.file_service = file_service

    async def refine_course_syllabus(self, current_syllabus: CoursePath, user_feedback: str, user_id: Optional[int] = None, project_folder: Optional[str] = None) -> Optional[CoursePath]:
        # Context Files
        files = self.file_service.list_files(user_id, project_folder) if user_id else []
        if files:
            full_paths = [self.file_service.get_upload_dir(user_id, project_folder) + "/" + f for f in files]
            self.provider.bind_files(full_paths)

        current_json = current_syllabus.model_dump_json()
        
        messages = [
            ("system", REFINE_SYLLABUS_PROMPT.format(current_syllabus=current_json, user_feedback=user_feedback)),
            ("user", "Refine the syllabus now.") # Format instructions handled by adapter if needed
        ]
    
        try:
            return await self.provider.generate_structured(messages, CoursePath)
        except Exception as e:
            activity_logger.error(f"Refinement Error: {e}")
            raise LLMGenerationError(f"Failed to refine syllabus: {e}")

    async def generate_course_syllabus(self, topic: str, user_id: Optional[int] = None, project_folder: Optional[str] = None) -> Optional[CoursePath]:
        # 1. RAG Retrieve
        context_chunks = await self.rag_engine.query_context(topic)
        context_str = "\\n\\n".join(context_chunks) if context_chunks else "General knowledge."
        
        # 2. Bind Files
        if user_id:
            files = self.file_service.list_files(user_id, project_folder)
            if files:
                full_paths = [self.file_service.get_upload_dir(user_id, project_folder) + "/" + f for f in files]
                self.provider.bind_files(full_paths)

        messages = [
            ("system", SYLLABUS_SYSTEM_PROMPT),
            ("user", f"Create a learning path for: {topic}. Context: {context_str}")
        ]
        
        try:
            result = await self.provider.generate_structured(messages, CoursePath)
            # Safeguard title
            if result and topic.strip():
                result.courseTitle = topic
                
            # Unlock the first node
            if result and result.units and result.units[0].nodes:
                result.units[0].nodes[0].status = "available"
                
            return result
        except Exception as e:
            activity_logger.error(f"Syllabus Gen Error: {e}")
            raise LLMGenerationError(f"Failed to generate course syllabus: {e}")

    # ... exists ...

    async def generate_lesson_from_node(self, node: LessonNode, topic: str, user_id: Optional[int] = None, project_folder: Optional[str] = None, profile: str = "General Learner") -> List[LessonStage]:
    
        # 1. Retrieve RAG Context
        context_chunks = await self.rag_engine.query_context(topic)
        rag_context = "\n\n".join(context_chunks) if context_chunks else "No specific database context found."
        
        # 2. Bind Local Application Files
        if user_id:
            files = self.file_service.list_files(user_id, project_folder)
            if files:
                 full_paths = [self.file_service.get_upload_dir(user_id, project_folder) + "/" + f for f in files]
                 self.provider.bind_files(full_paths)

        messages = [
            ("system", NODE_SYSTEM_PROMPT.format(profile=profile) + f"\n\nVector Database Context:\n{rag_context}"),
            ("user", f"TOPIC: {topic}\nNODE TITLE: {node.title}\nNODE DESC: {node.description}\nNODE TYPE: {node.type}")
        ]
        
        # Wrapper for List support
        class StageListWrapper(BaseModel):
            stages: List[LessonStage]

        try:
            wrapper = await self.provider.generate_structured(messages, StageListWrapper)
            if wrapper and wrapper.stages:
                # Post-process IDs
                for i, stage in enumerate(wrapper.stages):
                     stage.stageId = f"{node.id}-s{i}"
                return wrapper.stages
            return []
        except Exception as e:
            activity_logger.error(f"Node Gen Error: {e}")
            raise LLMGenerationError(f"Failed to generate lesson from node: {e}")

    # ...

    async def generate_remedial_stage(self, failed_stage: LessonStage, user_input: str, topic: str = "General") -> Optional[LessonStage]:
    
        messages = [
            ("system", REMEDIAL_SYSTEM_PROMPT),
            ("user", f"TOPIC: {topic}\\nFAILED STAGE: {failed_stage.model_dump_json()}\\nUSER INPUT: {user_input}")
        ]
        
        class LessonStageWrapper(BaseModel):
            stage: LessonStage

        try:
            wrapper = await self.provider.generate_structured(messages, LessonStageWrapper)
            return wrapper.stage if wrapper else None
        except Exception as e:
            activity_logger.error(f"Remedial Gen Error: {e}")
            raise LLMGenerationError(f"Failed to generate remedial stage: {e}")

    async def grade_feynman_attempt(self, user_explanation: str, topic: str) -> dict:
        context_chunks = await self.rag_engine.query_context(topic)
        context_str = "\\n\\n".join(context_chunks) if context_chunks else "General Knowledge"
        
        messages = [
            ("system", SYSTEM_PROMPT_FEYNMAN.format(topic=topic, context=context_str)),
            ("user", f"STUDENT EXPLANATION: {user_explanation}")
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
from app.services.llm.factory import get_llm_provider
from app.services.rag_engine import get_rag_engine
from app.services.file_service import get_file_service

def get_architect_service(
    provider: BaseLLMProvider = Depends(get_llm_provider),
    rag_engine: RAGEngine = Depends(get_rag_engine),
    file_service: FileService = Depends(get_file_service)
) -> AIArchitectService:
    return AIArchitectService(provider, rag_engine, file_service)
