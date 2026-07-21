import asyncio
import logging
from enum import Enum
from typing import List, Optional, Any, Callable
from pydantic import BaseModel, Field

from app.domain.statuses import NodeStatus
from app.schemas.course_schema import CoursePath, Unit as CourseUnit, LessonNode as CourseNode
from app.services.ai_engine.clients.base_provider import BaseLLMProvider
from app.services.ai_engine.agents.syllabus_prompts import (
    PLANNER_SYSTEM_PROMPT,
    AUDITOR_SYSTEM_PROMPT,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

# --- 審核工具資料架構 (Auditor Actions Schemas) ---

class ActionType(str, Enum):
    UPDATE_COURSE_METADATA = "UPDATE_COURSE_METADATA"
    INSERT_UNITS = "INSERT_UNITS"
    UPDATE_UNITS = "UPDATE_UNITS"
    INSERT_NODES = "INSERT_NODES"
    UPDATE_NODES = "UPDATE_NODES"
    DELETE_NODES = "DELETE_NODES"


class UnitMetadataUpdate(BaseModel):
    unit_id: str
    unitTitle: Optional[str] = None
    unitDescription: Optional[str] = None


class NodeMetadataUpdate(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None


class ActionItem(BaseModel):
    action_type: ActionType
    courseTitle: Optional[str] = None
    description: Optional[str] = None

    units: Optional[List[CourseUnit]] = None
    after_unit_id: Optional[str] = None
    before_unit_id: Optional[str] = None
    index: Optional[int] = None

    unit_updates: Optional[List[UnitMetadataUpdate]] = Field(None, alias="updates")

    unit_id: Optional[str] = None
    nodes: Optional[List[CourseNode]] = None
    after_node_id: Optional[str] = None
    before_node_id: Optional[str] = None
    node_index: Optional[int] = Field(None, alias="index")

    node_updates: Optional[List[NodeMetadataUpdate]] = Field(None, alias="updates")
    node_ids: Optional[List[str]] = None


class AuditorOutput(BaseModel):
    reflection_critique: Optional[str] = Field(None, description="Self-reflection feedback for next turn.")
    actions: List[ActionItem] = Field(default_factory=list, description="List of batch actions to perform.")
    is_complete: bool = Field(False, description="Whether the auditor is fully satisfied.")


# --- 代理人引擎 (AGENT) ---

class SyllabusAgent:
    def __init__(self, provider: BaseLLMProvider):
        self.provider = provider

    def apply_actions(self, course: CoursePath, actions: List[ActionItem]):
        """在原有大綱草稿上，批次進行增刪修動作"""
        for action in actions:
            try:
                if action.action_type == ActionType.UPDATE_COURSE_METADATA:
                    if action.courseTitle:
                        course.courseTitle = action.courseTitle
                    if action.description:
                        course.description = action.description

                elif action.action_type == ActionType.INSERT_UNITS:
                    if action.units:
                        for u in action.units:
                            if action.after_unit_id:
                                idx = next((i for i, existing_u in enumerate(course.units) if existing_u.unitId == action.after_unit_id), -1)
                                if idx != -1:
                                    course.units.insert(idx + 1, u)
                                else:
                                    course.units.append(u)
                            elif action.before_unit_id:
                                idx = next((i for i, existing_u in enumerate(course.units) if existing_u.unitId == action.before_unit_id), -1)
                                if idx != -1:
                                    course.units.insert(idx, u)
                                else:
                                    course.units.append(u)
                            elif action.index is not None:
                                course.units.insert(action.index, u)
                            else:
                                course.units.append(u)

                elif action.action_type == ActionType.UPDATE_UNITS:
                    updates_to_use = action.unit_updates or []
                    for upd in updates_to_use:
                        for u in course.units:
                            if u.unitId == upd.unit_id:
                                if upd.unitTitle:
                                    u.unitTitle = upd.unitTitle
                                if upd.unitDescription:
                                    u.unitDescription = upd.unitDescription

                elif action.action_type == ActionType.INSERT_NODES:
                    if action.unit_id and action.nodes:
                        unit = next((u for u in course.units if u.unitId == action.unit_id), None)
                        if unit:
                            for n in action.nodes:
                                if action.after_node_id:
                                    idx = next((i for i, existing_n in enumerate(unit.nodes) if existing_n.id == action.after_node_id), -1)
                                    if idx != -1:
                                        unit.nodes.insert(idx + 1, n)
                                    else:
                                        unit.nodes.append(n)
                                elif action.before_node_id:
                                    idx = next((i for i, existing_n in enumerate(unit.nodes) if existing_n.id == action.before_node_id), -1)
                                    if idx != -1:
                                        unit.nodes.insert(idx, n)
                                    else:
                                        unit.nodes.append(n)
                                elif action.node_index is not None:
                                    unit.nodes.insert(action.node_index, n)
                                else:
                                    unit.nodes.append(n)

                elif action.action_type == ActionType.UPDATE_NODES:
                    updates_to_use = action.node_updates or []
                    for upd in updates_to_use:
                        for unit in course.units:
                            for n in unit.nodes:
                                if n.id == upd.id:
                                    if upd.title:
                                        n.title = upd.title
                                    if upd.description:
                                        n.description = upd.description

                elif action.action_type == ActionType.DELETE_NODES:
                    if action.node_ids:
                        for unit in course.units:
                            unit.nodes = [n for n in unit.nodes if n.id not in action.node_ids]
            except Exception as ex:
                logger.error(f"Error applying action {action.action_type}: {ex}")

    async def run(
        self,
        topic: str,
        user_id: Optional[int] = None,
        course_folder: Optional[str] = None,
        course_id: Optional[int] = None,
        profile_summary: str = None,
        context: str = None,
        progress_callback: Optional[Callable[[Optional[int], str], None]] = None,
        additional_notes: Optional[str] = None,
    ) -> Optional[CoursePath]:
        """Multi-Agent 整合大綱生成主要進入點 (New Flow)"""
        logger.info(f"🚀 [SyllabusAgent] Starting Multi-Agent generation for '{topic}'...")

        # 1. 呼叫 Planner Agent 生成初始大綱草稿
        if progress_callback:
            progress_callback(10, "📖 正在擷取知識庫並構思全局大綱草稿...")

        await asyncio.sleep(0.5)

        profile_str = profile_summary if profile_summary else "General Audience"
        
        user_prompt = f"Course Topic: {topic}\nProfile: {profile_str}\nKnowledge Base Context:\n{context or 'None'}"
        if additional_notes:
            user_prompt += f"\n\nUser's Special Instructions/Additional Notes:\n{additional_notes}"

        planner_messages = [
            ("system", PLANNER_SYSTEM_PROMPT),
            ("user", user_prompt),
        ]

        try:
            course_draft = await self.provider.generate_structured(planner_messages, CoursePath)
        except Exception as e:
            logger.error(f"Course Planner Agent Error: {e}")
            return None

        if not course_draft:
            logger.error("Course Planner produced no output.")
            return None

        logger.info(f"📋 [Planner] Blueprint Draft generated with {len(course_draft.units)} units.")

        # 2. 呼叫 Auditor Agent 進行審查與迭代
        if progress_callback:
            progress_callback(50, f"🔍 正在啟動 AI 審查機制，檢核「{topic}」課程細部節點...")

        max_reflections = getattr(settings, "MAX_SYLLABUS_AUDIT_REFLECTIONS", 3)
        reflection_count = 0
        critique_history: List[str] = []

        while reflection_count < max_reflections:
            reflection_count += 1
            if progress_callback:
                progress_callback(
                    50 + reflection_count * 10,
                    f"🔄 正在為「{topic}」進行第 {reflection_count} 次深度審核與單元微調..."
                )

            auditor_user_msg = (
                f"Here is the current syllabus draft:\n{course_draft.model_dump_json()}"
            )
            if critique_history:
                auditor_user_msg += f"\n\nPrevious Reflection Criticisms:\n" + "\n".join(critique_history)

            auditor_messages = [
                ("system", AUDITOR_SYSTEM_PROMPT),
                ("user", auditor_user_msg),
            ]

            try:
                auditor_out = await self.provider.generate_structured(auditor_messages, AuditorOutput)
            except Exception as e:
                logger.error(f"Auditor Error in turn {reflection_count}: {e}")
                break

            if not auditor_out:
                break

            # 批次變更套用
            if auditor_out.actions:
                action_names = ", ".join([a.action_type.value for a in auditor_out.actions])
                if progress_callback:
                    progress_callback(
                        None,
                        "🛠️ 正在優化課程大綱中的單元結構..."
                    )
                self.apply_actions(course_draft, auditor_out.actions)

            # 自我反思或停止
            if auditor_out.is_complete or not auditor_out.reflection_critique:
                logger.info(f"🎉 [Auditor Agent] Review successfully completed in {reflection_count} turns.")
                break

            critique_history.append(auditor_out.reflection_critique)
            logger.info(f"🔄 [Auditor] Reflection critique received: {auditor_out.reflection_critique}")

        # 3. 最終資料結構驗證
        try:
            course_path = CoursePath.model_validate(course_draft)
        except Exception as ve:
            logger.error(f"Validation Error on final CoursePath: {ve}")
            course_path = course_draft

        # 解鎖第一個節點
        if course_path.units and course_path.units[0].nodes:
            course_path.units[0].nodes[0].status = NodeStatus.AVAILABLE

        if progress_callback:
            progress_callback(100, f"🎉 課程大綱生成與審核完成，規劃出 {len(course_path.units)} 個單元。")

        return course_path


from fastapi import Depends
from app.services.ai_engine.clients.factory import get_llm_provider


def get_syllabus_agent(
    provider: BaseLLMProvider = Depends(get_llm_provider),
) -> SyllabusAgent:
    """FastAPI Dependency for SyllabusAgent"""
    return SyllabusAgent(provider)
