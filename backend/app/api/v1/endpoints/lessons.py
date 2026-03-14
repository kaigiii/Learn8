from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from pydantic import TypeAdapter

from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.lesson import LessonModel, LessonAttempt
from app.models.project import ProjectModel
from app.models.job import JobModel
from app.schemas.course_schema import LessonNode
from app.schemas.lesson_schema import (
    LessonStage,
    SubmissionRequest,
    SubmissionResponse,
    ComponentType,
    SkinType,
    Validation,
    ValidationType,
    Feedback,
    ModuleType,
    GenericConfig,
)
from app.services.ai_agents.course_architect import AIArchitectService, get_architect_service
from app.core.config import settings
from app.services.workers.lesson_worker import run_lesson_generation_job

router = APIRouter()


@router.post("/generate-lesson-from-node")
async def generate_lesson_from_node_endpoint(
    node: LessonNode,
    topic: str,
    background_tasks: BackgroundTasks,
    project_id: int = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    為特定節點生成多階段的學習內容 (Lesson Stages)。
    若 DB 中已有生成過的內容會優先回傳，以節省成本。
    成功生成後回傳 Job ID 供前端追蹤狀態。
    """
    # 1. Fetch from DB
    def _fetch_cached_lesson():
        query = db.query(LessonModel).filter(
            LessonModel.node_id == node.id,
            LessonModel.course_topic == topic,
            LessonModel.user_id == current_user.id,
        )
        if project_id:
            query = query.filter(LessonModel.project_id == project_id)
        return query.first()

    cached_lesson = await run_in_threadpool(_fetch_cached_lesson)

    if cached_lesson:

        # Check if legacy data (dict) or new data (list)
        data = cached_lesson.stage_json
        if isinstance(data, list):
            stages = TypeAdapter(List[LessonStage]).validate_python(data)
        elif isinstance(data, dict):
            # Establish backward compatibility: wrap single stage in list
            stages = [TypeAdapter(LessonStage).validate_python(data)]

        # Return mocked COMPLETED structure so frontend can handle it without SSE seamlessly
        return {
            "status": "COMPLETED",
            "result_data": {"stages": [s.model_dump() for s in stages]},
        }

    # Credit Check
    COST = settings.COST_LESSON_GENERATION
    if current_user.credits < COST:
        raise HTTPException(
            status_code=402, detail=f"Insufficient credits. Need {COST}."
        )

    # 2. Start Background Job
    project_folder_name = None
    profile_summary = "General Learner"
    if project_id:

        def _fetch_project_lesson():
            return (
                db.query(ProjectModel)
                .filter(
                    ProjectModel.id == project_id,
                    ProjectModel.user_id == current_user.id,
                )
                .first()
            )

        db_project = await run_in_threadpool(_fetch_project_lesson)
        if db_project:
            project_folder_name = db_project.folder_name
            if db_project.profile_json:
                profile_summary = db_project.profile_json.get(
                    "summary", "General Learner"
                )

    job_id = str(uuid.uuid4())

    new_job = JobModel(
        id=job_id,
        user_id=current_user.id,
        project_id=project_id,
        job_type="LESSON_GEN",
        status="PENDING",
        progress=0,
        message="Waiting for resources...",
    )
    db.add(new_job)
    db.commit()

    background_tasks.add_task(
        run_lesson_generation_job,
        job_id,
        current_user.id,
        project_id,
        topic,
        node.model_dump(),
        project_folder_name,
        profile_summary,
    )

    return {"job_id": job_id, "status": "PENDING"}


@router.post("/submit-answer", response_model=SubmissionResponse)
async def submit_answer(
    submission: SubmissionRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    architect_service: AIArchitectService = Depends(get_architect_service),
):
    """
    接收並處理學生提交的測驗或互動答案。
    根據答案正確與否決定繼續前進 (proceed) 或是生成補救教學 (remedial)。
    若為 FeynmanMirror 組件，會呼叫 AI 進行額外的審查與評分。
    """
    # Log the attempt for future analytics
    def _save_lesson_attempt():
        attempt = LessonAttempt(
            user_id=current_user.id,
            stage_id=submission.stageId,
            user_input=str(submission.userInput),
            is_correct=str(submission.isCorrect),
        )
        db.add(attempt)
        db.commit()

    await run_in_threadpool(_save_lesson_attempt)

    # 0. FeynmanMirror Validation (Static)
    if submission.component == "FeynmanMirror":
        grading = await architect_service.grade_feynman_attempt(
            str(submission.userInput), submission.context_topic or "Unknown"
        )

        if grading.get("isCorrect"):
            return SubmissionResponse(
                nextAction="proceed",
                message=grading.get("feedback", "Excellent explanation!"),
            )
        else:
            return SubmissionResponse(
                nextAction="remedial",
                message=grading.get("feedback", "Not quite. Try simpler terms."),
            )

    # 1. Client-side validated (default)
    if submission.isCorrect:
        return SubmissionResponse(
            nextAction="proceed", message="Great job! Moving to next stage."
        )

    # 2. Remedial Generation
    failed_stage = submission.failedStage
    if not failed_stage:
        raise HTTPException(
            status_code=400,
            detail="failedStage is required to generate a remedial lesson.",
        )

    remedial = await architect_service.generate_remedial_stage(
        failed_stage=failed_stage,
        user_input=str(submission.userInput),
        topic=submission.context_topic or "General Concept",
    )

    if remedial:
        return SubmissionResponse(
            nextAction="remedial",
            remedialStage=remedial,
            message="Let's review this concept with a simpler example.",
        )
    else:
        return SubmissionResponse(
            nextAction="proceed",  # Or retry
            message="Incorrect. Try again or move on.",
        )
