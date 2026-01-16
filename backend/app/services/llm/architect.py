
import json
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

from app.schemas.course import CoursePath, RefineSyllabusRequest, LessonNode
from app.schemas.lesson import LessonStage, SubmissionResponse
from app.services.rag_engine import RAGEngine
from app.services.file_service import FileService
from app.services.llm.factory import LLMFactory

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

async def refine_course_syllabus(current_syllabus: CoursePath, user_feedback: str, user_id: Optional[int] = None, project_folder: Optional[str] = None) -> Optional[CoursePath]:
    provider = LLMFactory.create()
    
    # Context Files
    files = FileService.list_files(user_id, project_folder) if user_id else []
    if files:
        full_paths = [FileService.get_upload_dir(user_id, project_folder) + "/" + f for f in files]
        provider.bind_files(full_paths)

    current_json = current_syllabus.model_dump_json()
    
    messages = [
        ("system", REFINE_SYLLABUS_PROMPT.format(current_syllabus=current_json, user_feedback=user_feedback)),
        ("user", "Refine the syllabus now.") # Format instructions handled by adapter if needed
    ]
    
    try:
        return await provider.generate_structured(messages, CoursePath)
    except Exception as e:
        print(f"Refinement Error: {e}")
        return None

async def generate_course_syllabus(topic: str, user_id: Optional[int] = None, project_folder: Optional[str] = None) -> Optional[CoursePath]:
    # 1. RAG Retrieve
    context_chunks = RAGEngine.query_context(topic)
    context_str = "\\n\\n".join(context_chunks) if context_chunks else "General knowledge."
    
    # 2. Provider
    provider = LLMFactory.create()
    
    # 3. Bind Files
    if user_id:
        files = FileService.list_files(user_id, project_folder)
        if files:
            full_paths = [FileService.get_upload_dir(user_id, project_folder) + "/" + f for f in files]
            provider.bind_files(full_paths)

    messages = [
        ("system", SYLLABUS_SYSTEM_PROMPT),
        ("user", f"Create a learning path for: {topic}. Context: {context_str}")
    ]
    
    try:
        result = await provider.generate_structured(messages, CoursePath)
        # Safeguard title
        if result and topic.strip():
            result.courseTitle = topic
            
        # Unlock the first node
        if result and result.units and result.units[0].nodes:
            result.units[0].nodes[0].status = "available"
            
        return result
    except Exception as e:
        print(f"Syllabus Gen Error: {e}")
        return None

from pydantic import BaseModel

# ... exists ...

async def generate_lesson_from_node(node: LessonNode, topic: str, user_id: Optional[int] = None, project_folder: Optional[str] = None) -> List[LessonStage]:
    provider = LLMFactory.create()
    
    if user_id:
        files = FileService.list_files(user_id, project_folder)
        if files:
             full_paths = [FileService.get_upload_dir(user_id, project_folder) + "/" + f for f in files]
             provider.bind_files(full_paths)

    messages = [
        ("system", NODE_SYSTEM_PROMPT),
        ("user", f"TOPIC: {topic}\\nNODE TITLE: {node.title}\\nNODE DESC: {node.description}\\nNODE TYPE: {node.type}")
    ]
    
    # Wrapper for List support
    class StageListWrapper(BaseModel):
        stages: List[LessonStage]

    try:
        wrapper = await provider.generate_structured(messages, StageListWrapper)
        if wrapper and wrapper.stages:
            # Post-process IDs
            for i, stage in enumerate(wrapper.stages):
                 stage.stageId = f"{node.id}-s{i}"
            return wrapper.stages
        return []
    except Exception as e:
        print(f"Node Gen Error: {e}")
        return []
    except Exception as e:
        print(f"Node Gen Error: {e}")
        return None

# ...

async def generate_remedial_stage(failed_stage: LessonStage, user_input: str, topic: str = "General") -> Optional[LessonStage]:
    provider = LLMFactory.create()
    
    messages = [
        ("system", REMEDIAL_SYSTEM_PROMPT),
        ("user", f"TOPIC: {topic}\\nFAILED STAGE: {failed_stage.model_dump_json()}\\nUSER INPUT: {user_input}")
    ]
    
    class LessonStageWrapper(BaseModel):
        stage: LessonStage

    try:
        wrapper = await provider.generate_structured(messages, LessonStageWrapper)
        return wrapper.stage if wrapper else None
    except Exception as e:
        print(f"Remedial Gen Error: {e}")
        return None

async def grade_feynman_attempt(user_explanation: str, topic: str) -> dict:
    context_chunks = RAGEngine.query_context(topic)
    context_str = "\\n\\n".join(context_chunks) or "General Knowledge"
    
    messages = [
        ("system", SYSTEM_PROMPT_FEYNMAN.format(topic=topic, context=context_str)),
        ("user", f"STUDENT EXPLANATION: {user_explanation}")
    ]
    
    provider = LLMFactory.create()
    # Return dict
    try:
        # Check if provider has generate_structured for dict?
        # We can define a simplified pydantic model
        from pydantic import BaseModel
        class FeynmanGrade(BaseModel):
            isCorrect: bool
            feedback: str
            
        result = await provider.generate_structured(messages, FeynmanGrade)
        return result.model_dump()
    except Exception as e:
        print(f"Feynman Grade Error: {e}")
        return {"isCorrect": True, "feedback": "Good effort! (System Error)"}
