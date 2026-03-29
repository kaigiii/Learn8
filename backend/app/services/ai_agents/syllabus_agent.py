import asyncio
import logging
from app.domain.statuses import NodeStatus
from typing import List, Optional, Any, Callable
from pydantic import BaseModel, Field

from app.schemas.course_schema import CoursePath, Unit as CourseUnit, LessonNode as CourseNode
from app.services.knowledge_base.rag_engine import RAGEngine
from app.services.llm_clients.base_provider import BaseLLMProvider
from app.services.commons.file_service import FileService
from app.services.ai_agents.syllabus_prompts import (
    BLUEPRINT_SYSTEM_PROMPT,
    UNIT_EXPANSION_SYSTEM_PROMPT,
)
from langchain_core.messages import SystemMessage, HumanMessage

logger = logging.getLogger(__name__)

# --- 資料架構 (SCHEMAS) ---


class BlueprintUnit(BaseModel):
    unit_title: str
    unit_goal: str


class Blueprint(BaseModel):
    courseTitle: str
    description: str
    units: List[BlueprintUnit]


class UnitNodes(BaseModel):
    nodes: List[CourseNode]


# --- 代理人引擎 (AGENT) ---


class SyllabusAgent:
    def __init__(self, provider: BaseLLMProvider, rag_engine: RAGEngine):
        self.provider = provider
        self.rag_engine = rag_engine

    async def generate_blueprint(
        self, topic: str, profile: str = "General Audience", context: str = None
    ) -> Optional[Blueprint]:
        """步驟 1: 生成高階架構藍圖 (Blueprint)"""

        user_prompt = f"Create a course blueprint for: {topic}\nTarget Audience Profile: {profile}"
        if context:
            user_prompt += (
                f"\n\nReference Material (Use this to structure the course):\n{context}"
            )

        messages = [("system", BLUEPRINT_SYSTEM_PROMPT), ("user", user_prompt)]
        try:
            return await self.provider.generate_structured(messages, Blueprint)
        except Exception as e:
            logger.error(f"Blueprint Gen Error: {e}")
            return None

    async def expand_unit(
        self,
        topic: str,
        unit: BlueprintUnit,
        course_id: Optional[int] = None,
        profile: str = "General Audience",
    ) -> List[CourseNode]:
        """步驟 2: 搭配 RAG 擴展單一單元的細節節點"""

        # 針對此單元進行精確的檢索
        search_query = f"{topic} {unit.unit_title} {unit.unit_goal}"
        context_chunks = await self.rag_engine.query_context(
            search_query, k=3, course_id=course_id
        )  # Async call
        context_str = (
            "\\n\\n".join(context_chunks) if context_chunks else "General Knowledge"
        )

        messages = [
            (
                "system",
                UNIT_EXPANSION_SYSTEM_PROMPT.format(
                    topic=topic,
                    unit_title=unit.unit_title,
                    unit_goal=unit.unit_goal,
                    context=context_str,
                    profile=profile,
                ),
            ),
            ("user", "Generate the nodes for this unit."),
        ]

        try:
            result = await self.provider.generate_structured(messages, UnitNodes)

            # 後處理：若 LLM 遺漏 ID 則自動補上
            nodes = result.nodes if result else []
            for i, node in enumerate(nodes):
                if not node.id:
                    node.id = f"node-{unit.unit_title[:3]}-{i}"
                node.status = NodeStatus.LOCKED  # Default
            return nodes
        except Exception as e:
            logger.error(f"Unit Expansion Error ({unit.unit_title}): {e}")
            return []

    async def run(
        self,
        topic: str,
        user_id: Optional[int] = None,
        course_folder: Optional[str] = None,
        course_id: Optional[int] = None,
        profile_summary: str = None,
        context: str = None,
        progress_callback: Optional[Callable[[Optional[int], str], None]] = None,
    ) -> Optional[CoursePath]:
        """代理人主要進入點 (Main Entry Point)"""
        logger.info(f"🚀 [SyllabusAgent] Starting generation for '{topic}'...")
        logger.info(f"👤 [SyllabusAgent] Profile: {profile_summary or 'Default'}")

        # 1. Generate Blueprint
        if progress_callback:
            progress_callback(10, "🧠 AI 正在閱讀文獻與設計總體架構...")

        profile_str = profile_summary if profile_summary else "General Audience"
        blueprint = await self.generate_blueprint(
            topic, profile=profile_str, context=context
        )
        if not blueprint:
            return None

        logger.info(f"📋 [SyllabusAgent] Blueprint generated: {len(blueprint.units)} units.")

        if progress_callback:
            progress_callback(
                20,
                f"✅ 架構設計完畢，共規劃 {len(blueprint.units)} 個單元。準備處理細節...",
            )

        # 2. Iterate & Expand Units Concurrently
        final_units: List[CourseUnit] = [None] * len(blueprint.units)

        from app.core.config import settings

        # Concurrency limit
        sem = asyncio.Semaphore(settings.SYLLABUS_CONCURRENCY_LIMIT)

        total_units = len(blueprint.units)
        completed_units = 0

        async def _process_unit(i: int, b_unit: BlueprintUnit):
            nonlocal completed_units
            async with sem:
                if progress_callback:
                    progress_callback(
                        None,
                        f"⏳ 正在規劃單元 {i + 1}/{total_units} 的學習路徑: {b_unit.unit_title}...",
                    )

                logger.info(f"  Doing Unit {i + 1}: {b_unit.unit_title}...")
                nodes = await self.expand_unit(
                    topic, b_unit, course_id=course_id, profile=profile_str
                )

                completed_units += 1
                if progress_callback:
                    # Scale progress from 20% to 80%
                    curr_prog = int(20 + (completed_units / total_units) * 60)
                    progress_callback(
                        curr_prog,
                        f"✅ 完稿單元 {i + 1}/{total_units}: {b_unit.unit_title}",
                    )

                final_units[i] = CourseUnit(
                    unitId=f"unit-{i}",
                    unitTitle=b_unit.unit_title,
                    unitDescription=b_unit.unit_goal,
                    nodes=nodes,
                )

        # 並行展開所有單元 (Concurrency)
        tasks = [_process_unit(i, u) for i, u in enumerate(blueprint.units)]
        await asyncio.gather(*tasks)

        # 3. 組裝最終大綱
        course_path = CoursePath(
            id=0,  # Placeholder
            courseTitle=blueprint.courseTitle,
            description=blueprint.description,
            units=final_units,
        )

        # 解鎖第一個節點
        if course_path.units and course_path.units[0].nodes:
            course_path.units[0].nodes[0].status = NodeStatus.AVAILABLE

        logger.info(f"✅ [SyllabusAgent] Finished. Total Units: {len(final_units)}")
        return course_path


from fastapi import Depends
from app.services.llm_clients.factory import get_llm_provider
from app.services.knowledge_base.rag_engine import get_rag_engine


def get_syllabus_agent(
    provider: BaseLLMProvider = Depends(get_llm_provider),
    rag_engine: RAGEngine = Depends(get_rag_engine),
) -> SyllabusAgent:
    """FastAPI Dependency for SyllabusAgent"""
    return SyllabusAgent(provider, rag_engine)
