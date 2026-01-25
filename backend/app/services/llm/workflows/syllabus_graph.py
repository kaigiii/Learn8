"""
模組名稱: app.services.syllabus_graph
功能描述: 課程大綱修正流程圖 (LangGraph Workflow)

定義了基於 LangGraph 的狀態機 (State Machine)，用於處理 "Refine Syllabus" 的多輪互動流程。
雖目前的實作為單一節點 (refine_step)，但預留了擴充為多步驟思考 (Think -> Critique -> Refine) 的能力。

主要元件:
    - SyllabusState (TypedDict): 定義流程中的共享狀態 (State Schema)。
    - refine_step (Node): 執行實際的 LLM 呼叫來修改大綱。
    - syllabus_graph (CompiledGraph): 編譯完成的可執行圖物件。

使用方式:
    `await syllabus_graph.ainvoke({...inputs...})`
"""

from typing import TypedDict, List, Dict, Optional
from langgraph.graph import StateGraph, END

from app.schemas.course import CoursePath
from app.services.llm.architect import refine_course_syllabus

class SyllabusState(TypedDict):
    topic: str
    syllabus: Optional[CoursePath]
    user_feedback: Optional[str]
    user_id: Optional[int]
    project_folder: Optional[str]
    history: List[Dict[str, str]]
    final_output: Optional[CoursePath]

async def refine_step(state: SyllabusState):
    """
    Node: Refines the syllabus using the Architect service.
    """
    if not state.get("syllabus") or not state.get("user_feedback"):
        return {}

    print(f"🔄 LangGraph: Refining syllabus for topic '{state['topic']}'...")
    
    new_syllabus = await refine_course_syllabus(
        current_syllabus=state["syllabus"],
        user_feedback=state["user_feedback"],
        user_id=state.get("user_id"),
        project_folder=state.get("project_folder")
    )
    
    if new_syllabus:
        return {"syllabus": new_syllabus, "final_output": new_syllabus}
    else:
        return {}

builder = StateGraph(SyllabusState)
builder.add_node("refine", refine_step)
builder.set_entry_point("refine")
builder.add_edge("refine", END)

syllabus_graph = builder.compile()
