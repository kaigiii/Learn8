"""
模組名稱: app.api.v1.endpoints.lessons
功能描述: 單元內容生成與互動 API (Lesson Content & Interaction Endpoints)

負責生成具體的學習內容 (Stages) 以及處理使用者的互動回饋。
此模組連接了 LLM Architect (生成端) 與 Frontend Player (互動端)。

路由列表:
    1. POST /generate-lesson-from-node
        - 功能: 為特定節點生成多階段的學習內容 (Lesson Stages)。
        - 緩存機制 (Caching): 若 DB 中已有生成過的內容，會優先回傳 (避免重複扣款與等待)。
        - 輸出: 回傳 List[LessonStage]，前端依序播放。

    2. POST /submit-answer
        - 功能: 處理學生提交的答案。
        - 邏輯:
            - Client-side 驗證通過 -> 記錄 Log -> 回傳 Proceed。
            - 失敗 -> 觸發 "Remedial Generation" (補救教學生成)。
            - FeynmanMirror 組件 -> 使用 AI 評分 (Grade) -> 回傳詳細評語。
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.lesson import LessonModel
from app.models.project import ProjectModel
from app.schemas.course import LessonNode
from app.schemas.lesson import LessonStage, SubmissionRequest, SubmissionResponse, ComponentType, SkinType, Validation, ValidationType, Feedback, ModuleType, TextTokenStage, TextTokenConfig, TextTokenData, PatternMatcherStage, PatternMatcherConfig, PatternMatcherData
from app.services.llm.architect import generate_lesson_from_node

router = APIRouter()

from typing import List

@router.post("/generate-lesson-from-node", response_model=List[LessonStage])
async def generate_lesson_from_node_endpoint(
    node: LessonNode, 
    topic: str, 
    project_id: int = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch from DB
    query = db.query(LessonModel).filter(
        LessonModel.node_id == node.id,
        LessonModel.course_topic == topic,
        LessonModel.user_id == current_user.id
    )
    if project_id:
        query = query.filter(LessonModel.project_id == project_id)
        
    cached_lesson = query.first()

    if cached_lesson:
        from pydantic import TypeAdapter
        # Check if legacy data (dict) or new data (list)
        data = cached_lesson.stage_json
        if isinstance(data, list):
             return TypeAdapter(List[LessonStage]).validate_python(data)
        elif isinstance(data, dict):
             # Establish backward compatibility: wrap single stage in list
             return [TypeAdapter(LessonStage).validate_python(data)]

    # 2. Generate
    project_folder_name = None
    if project_id:
         db_project = db.query(ProjectModel).filter(
             ProjectModel.id == project_id,
             ProjectModel.user_id == current_user.id
         ).first()
         if db_project:
             project_folder_name = db_project.folder_name

    stages = await generate_lesson_from_node(node, topic, user_id=current_user.id, project_folder=project_folder_name)
    if not stages:
         raise HTTPException(status_code=404, detail="Failed to generate lesson content.")
    
    # 3. Save
    # We serialize the list of models to a list of dicts
    stages_json = [s.model_dump() for s in stages]
    
    new_lesson = LessonModel(
        node_id=node.id,
        course_topic=topic,
        stage_json=stages_json, # Stores list now
        user_id=current_user.id,
        project_id=project_id
    )
    db.add(new_lesson)
    db.commit()
    
    return stages

from app.models.lesson import LessonAttempt

@router.post("/submit-answer", response_model=SubmissionResponse)
async def submit_answer(
    submission: SubmissionRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Log the attempt for future analytics
    attempt = LessonAttempt(
        user_id=current_user.id,
        stage_id=submission.stageId,
        user_input=str(submission.userInput),
        is_correct=str(submission.isCorrect)
    )
    db.add(attempt)
    db.commit()

    # 0. FeynmanMirror Validation (Static)
    if submission.component == "FeynmanMirror":
        grading = await grade_feynman_attempt(str(submission.userInput), submission.context_topic or "Unknown")
        
        if grading.get("isCorrect"):
            return SubmissionResponse(
                nextAction="proceed",
                message=grading.get("feedback", "Excellent explanation!")
            )
        else:
             return SubmissionResponse(
                nextAction="remedial",
                message=grading.get("feedback", "Not quite. Try simpler terms.")
             )

    # 1. Client-side validated (default)
    if submission.isCorrect:
        return SubmissionResponse(
            nextAction="proceed",
            message="Great job! Moving to next stage."
        )
    
    # 2. Remedial Generation
    dummy_failed_stage = TextTokenStage(
        stageId=submission.stageId,
        topic=submission.context_topic or "Unknown",
        module=ModuleType.Instruction, # Dummy default
        component=ComponentType.TextToken, # Dummy
        skin=SkinType.Classic,
        config=TextTokenConfig(data=TextTokenData(items=[]), initialState={}),
        validation=Validation(type=ValidationType.Exact, condition={}),
        feedback=Feedback(success="", error="")
    )
    
    remedial = await generate_remedial_stage(
        failed_stage=dummy_failed_stage, 
        user_input=str(submission.userInput),
        topic=submission.context_topic or "General Concept"
    )
    
    if remedial:
        return SubmissionResponse(
            nextAction="remedial",
            remedialStage=remedial,
            message="Let's review this concept with a simpler example."
        )
    else:
        return SubmissionResponse(
            nextAction="proceed", # Or retry
            message="Incorrect. Try again or move on."
        )
