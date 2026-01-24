"""
模組名稱: app.services.llm.agents.syllabus_agent
功能描述: 課程大綱生成代理人 (Syllabus Generation Agent)

此 Agent 專責處理課程大綱的生成任務，採用 "Blueprint First" (先藍圖後細節) 的兩階段生成策略。
相比於舊版的單次生成，此方法更能確保課程結構的邏輯性與深度。

主要職責:
    1. Blueprint Generation (藍圖生成):
       - 階段目標: 規劃課程標題 (Title) 與單元列表 (Units)。
       - 提示詞: BLUEPRINT_SYSTEM_PROMPT。

    2. Unit Expansion (單元展開):
       - 階段目標: 針對每一個單元，逐一生成詳細的學習節點 (Nodes)。
       - 關鍵技術: RAG Context Injection。
         在展開每個單元時，會根據單元標題與目標 (Unit Goal) 去檢索 RAG 知識庫，
         確保生成的內容具有該領域的專業深度，而非泛泛而談。

主要方法:
    - run: Agent 入口點，協調上述兩個階段的流程。
"""
import asyncio
from typing import List, Optional, Any
from pydantic import BaseModel, Field

from app.schemas.course import CoursePath, Unit as CourseUnit, LessonNode as CourseNode
from app.services.rag_engine import RAGEngine
from app.services.llm.factory import LLMFactory
from app.services.file_service import FileService
from langchain_core.messages import SystemMessage, HumanMessage

# --- PROMPTS ---

BLUEPRINT_SYSTEM_PROMPT = """You are an expert curriculum designer.
Your task is to create a High-Level Blueprint for a course on the given TOPIC.
Do NOT generate detailed lessons yet. Just generate the UNITS (Chapters).

Output a JSON object with:
- courseTitle: string
- description: string
- units: List of objects { "unit_title": string, "unit_goal": string }
"""

UNIT_EXPANSION_SYSTEM_PROMPT = """You are a specialized content creator.
You are expanding a specific Unit into a learning path of Nodes.
Topic: {topic}
Unit: {unit_title}
Goal: {unit_goal}

Context from Knowledge Base:
{context}

Generate a list of Nodes for this Unit.
CRITICAL: The 'description' field MUST be detailed (3-5 sentences). It serves as the context for generating the full lesson later. Include key concepts, definitions, and what the student will learn.

Output a JSON object with:
- nodes: List of {{ "title": string, "description": string, "type": "video" | "article" | "quiz" | "exercise" }}
"""

# --- SCHEMAS ---

class BlueprintUnit(BaseModel):
    unit_title: str
    unit_goal: str

class Blueprint(BaseModel):
    courseTitle: str
    description: str
    units: List[BlueprintUnit]

class UnitNodes(BaseModel):
    nodes: List[CourseNode]

# --- AGENT ---

class SyllabusAgent:
    
    @staticmethod
    async def generate_blueprint(topic: str, provider, profile: str = "General Audience") -> Optional[Blueprint]:
        """Step 1: Generate high-level outline."""
        messages = [
            ("system", BLUEPRINT_SYSTEM_PROMPT),
            ("user", f"Create a course blueprint for: {topic}\nTarget Audience Profile: {profile}")
        ]
        try:
            return await provider.generate_structured(messages, Blueprint)
        except Exception as e:
            print(f"Blueprint Gen Error: {e}")
            return None

    @staticmethod
    async def expand_unit(topic: str, unit: BlueprintUnit, provider, project_id: Optional[int] = None, profile: str = "General Audience") -> List[CourseNode]:
        """Step 2: Expand a single unit using specific RAG context."""
        
        # Specific RAG for this unit
        search_query = f"{topic} {unit.unit_title} {unit.unit_goal}"
        context_chunks = await RAGEngine.query_context(search_query, k=3, project_id=project_id) # Async call
        context_str = "\\n\\n".join(context_chunks) if context_chunks else "General Knowledge"
        
        messages = [
            ("system", UNIT_EXPANSION_SYSTEM_PROMPT.format(
                topic=topic,
                unit_title=unit.unit_title,
                unit_goal=unit.unit_goal,
                context=context_str,
                profile=profile
            )),
            ("user", "Generate the nodes for this unit.")
        ]
        
        try:
            result = await provider.generate_structured(messages, UnitNodes)
            
            # Post-process: Add IDs if missing (LLM might skip them)
            nodes = result.nodes if result else []
            for i, node in enumerate(nodes):
                if not node.id:
                    node.id = f"node-{unit.unit_title[:3]}-{i}"
                node.status = "locked" # Default
            return nodes
        except Exception as e:
            print(f"Unit Expansion Error ({unit.unit_title}): {e}")
            return []

    @staticmethod
    async def run(
        topic: str, 
        user_id: Optional[int] = None, 
        project_folder: Optional[str] = None, 
        project_id: Optional[int] = None,
        profile_summary: str = None
    ) -> Optional[CoursePath]:
        """Main Entry Point"""
        print(f"🚀 [SyllabusAgent] Starting generation for '{topic}'...")
        print(f"👤 [SyllabusAgent] Profile: {profile_summary or 'Default'}")
        
        provider = LLMFactory.create()
        
        # Bind files if needed (Optional, usually RAG handles it, but for direct FreeGemini context)
        if user_id and hasattr(provider, 'bind_files'):
            files = FileService.list_files(user_id, project_folder)
            if files:
                full_paths = [FileService.get_upload_dir(user_id, project_folder) + "/" + f for f in files]
                provider.bind_files(full_paths)

        # 1. Generate Blueprint
        # Provide a default if None
        profile_str = profile_summary if profile_summary else "General Audience"
        blueprint = await SyllabusAgent.generate_blueprint(topic, provider, profile=profile_str)
        if not blueprint:
            return None
        
        print(f"📋 [SyllabusAgent] Blueprint generated: {len(blueprint.units)} units.")

        # 2. Iterate & Expand Units (Parallel or Serial? Serial is safer for rate limits, Parallel faster)
        # Let's do Serial for safety first.
        final_units: List[CourseUnit] = []
        
        for i, b_unit in enumerate(blueprint.units):
            print(f"  Doing Unit {i+1}: {b_unit.unit_title}...")
            nodes = await SyllabusAgent.expand_unit(topic, b_unit, provider, project_id=project_id, profile=profile_str)
            
            # Create Final Unit
            final_units.append(CourseUnit(
                unitId=f"unit-{i}",
                unitTitle=b_unit.unit_title,
                unitDescription=b_unit.unit_goal,
                nodes=nodes
            ))

        # 3. Assembly
        course_path = CoursePath(
            id=0, # Placeholder
            courseTitle=blueprint.courseTitle,
            description=blueprint.description,
            units=final_units
        )
        
        # Unlock first node
        if course_path.units and course_path.units[0].nodes:
            course_path.units[0].nodes[0].status = "available"
            
        print(f"✅ [SyllabusAgent] Finished. Total Units: {len(final_units)}")
        return course_path
