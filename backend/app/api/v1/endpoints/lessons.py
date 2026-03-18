from typing import List
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from pydantic import TypeAdapter

from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.lesson import LessonModel, LessonAttempt, LessonRemedialModel
from app.models.project import ProjectModel
from app.models.job import JobModel
from app.schemas.course_schema import LessonNode
from app.schemas.lesson_schema import (
    LessonStage,
    SubmissionRequest,
    SubmissionResponse,
    RemedialGenerationRequest,
)
from app.services.ai_agents.course_architect import AIArchitectService, get_architect_service
from app.core.config import settings
from app.services.workers.lesson_worker import (
    run_lesson_generation_job,
    run_remedial_generation_job,
)

router = APIRouter()
logger = logging.getLogger(__name__)


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

    def _fetch_cached_remedial():
        query = db.query(LessonRemedialModel).filter(
            LessonRemedialModel.node_id == node.id,
            LessonRemedialModel.course_topic == topic,
            LessonRemedialModel.user_id == current_user.id,
        )
        if project_id:
            query = query.filter(LessonRemedialModel.project_id == project_id)
        return query.order_by(LessonRemedialModel.updated_at.desc()).first()

    cached_lesson = await run_in_threadpool(_fetch_cached_lesson)
    cached_remedial = await run_in_threadpool(_fetch_cached_remedial)

    if cached_lesson:
        try:
            # Check if legacy data (dict) or new data (list)
            data = cached_lesson.stage_json
            if isinstance(data, list):
                stages = TypeAdapter(List[LessonStage]).validate_python(data)
            elif isinstance(data, dict):
                # Establish backward compatibility: wrap single stage in list
                stages = [TypeAdapter(LessonStage).validate_python(data)]
            else:
                stages = []

            if cached_remedial and isinstance(cached_remedial.stage_json, list):
                remedial_stages = TypeAdapter(List[LessonStage]).validate_python(
                    cached_remedial.stage_json
                )
                stages.extend(remedial_stages)

            if stages:
                # Return mocked COMPLETED structure so frontend can handle it without SSE seamlessly
                return {
                    "status": "COMPLETED",
                    "result_data": {"stages": [s.model_dump() for s in stages]},
                }
        except Exception as exc:
            logger.warning(
                "Ignoring cached lesson with unsupported or invalid stages. "
                "lesson_id=%s node_id=%s topic=%s error=%s",
                cached_lesson.id,
                node.id,
                topic,
                exc,
            )

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
    根據答案正確與否決定繼續前進，或將該失敗階段標記為課後補救教學候選。
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
                nextAction="review_later",
                message=grading.get(
                    "feedback",
                    "Not quite. We'll prepare a targeted review after this lesson.",
                ),
            )

    # 1. Client-side validated (default)
    if submission.isCorrect:
        return SubmissionResponse(
            nextAction="proceed", message="Great job! Moving to next stage."
        )

    return SubmissionResponse(
        nextAction="review_later",
        message="Incorrect. We'll queue a targeted review for after this lesson.",
    )


@router.post("/generate-remedial-stages", response_model=List[LessonStage])
async def generate_remedial_stages_endpoint(
    request: RemedialGenerationRequest,
    current_user: UserModel = Depends(get_current_user),
    architect_service: AIArchitectService = Depends(get_architect_service),
):
    if not request.failedStages:
        return []

    remedial_stages = await architect_service.generate_remedial_stages(
        request.failedStages,
        topic=request.topic or "General Concept",
    )
    return remedial_stages


@router.post("/generate-remedial-stages-async")
async def generate_remedial_stages_async_endpoint(
    request: RemedialGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not request.failedStages:
        return {"status": "COMPLETED", "result_data": {"stages": []}}

    job_id = str(uuid.uuid4())
    new_job = JobModel(
        id=job_id,
        user_id=current_user.id,
        project_id=None,
        job_type="REMEDIAL_GEN",
        status="PENDING",
        progress=0,
        message="Waiting for remedial generation...",
    )
    db.add(new_job)
    db.commit()

    background_tasks.add_task(
        run_remedial_generation_job,
        job_id,
        current_user.id,
        request.topic,
        request.nodeId,
        request.projectId,
        [record.model_dump() for record in request.failedStages],
    )

    return {"job_id": job_id, "status": "PENDING"}
