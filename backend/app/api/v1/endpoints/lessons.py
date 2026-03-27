import datetime
import logging
import uuid
from typing import Any, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import TypeAdapter
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.dependencies import get_db, get_current_user
from app.core.config import settings
from app.models.course import CourseModel, NodeModel
from app.models.job import JobModel
from app.models.lesson import (
    LessonAttempt,
    LessonFailedStageModel,
    LessonModel,
    LessonRemedialModel,
    LessonSessionModel,
)
from app.models.project import ProjectModel
from app.models.user import UserModel
from app.schemas.course_schema import LessonNode
from app.schemas.lesson_schema import (
    FailedStageRecord,
    LessonSessionPayload,
    LessonSessionSummaryPayload,
    LessonSessionStartRequest,
    LessonStage,
    RemedialGenerationRequest,
    SubmissionRequest,
    SubmissionResponse,
)
from app.services.ai_agents.course_architect import AIArchitectService, get_architect_service
from app.services.workers.lesson_worker import (
    run_lesson_generation_job,
    run_remedial_generation_job,
)

router = APIRouter()
logger = logging.getLogger(__name__)

LESSON_STAGE_LIST_ADAPTER = TypeAdapter(List[LessonStage])


def _coerce_stage_list(raw: Any) -> List[LessonStage]:
    if isinstance(raw, list):
        return LESSON_STAGE_LIST_ADAPTER.validate_python(raw)
    if isinstance(raw, dict):
        return [TypeAdapter(LessonStage).validate_python(raw)]
    return []


def _normalize_ordering_item(item: Any) -> str:
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return (
            item.get("text")
            or item.get("label")
            or item.get("content")
            or item.get("id")
            or str(item)
        )
    return str(item)


def _serialize_failed_record(record: LessonFailedStageModel) -> FailedStageRecord:
    return FailedStageRecord(
        failedStage=TypeAdapter(LessonStage).validate_python(record.stage_snapshot_json),
        userInput=record.user_input_json,
    )


def _build_session_payload(
    db: Session, session: LessonSessionModel, remedial_job_id: str | None = None
) -> LessonSessionPayload:
    primary_stages = _coerce_stage_list(session.primary_stages_json)
    remedial_stages = _coerce_stage_list(session.remedial_stages_json)
    active_stages = remedial_stages if session.active_phase == "remedial" else primary_stages
    pending_failed_count = (
        db.query(LessonFailedStageModel)
        .filter(
            LessonFailedStageModel.lesson_session_id == session.id,
            LessonFailedStageModel.status.in_(["pending", "remedial_generated"]),
        )
        .count()
    )

    return LessonSessionPayload(
        sessionId=session.id,
        status=session.status,
        activePhase=session.active_phase,
        pendingFailedCount=pending_failed_count,
        primaryStages=primary_stages,
        remedialStages=remedial_stages,
        activeStages=active_stages,
        remedialJobId=remedial_job_id,
    )


def _find_active_remedial_job_id(db: Session, session_id: int, user_id: int) -> str | None:
    jobs = (
        db.query(JobModel)
        .filter(
            JobModel.user_id == user_id,
            JobModel.job_type == "REMEDIAL_GEN",
            JobModel.status.in_(["PENDING", "PROCESSING"]),
        )
        .order_by(JobModel.created_at.desc())
        .all()
    )

    for job in jobs:
        result_data = job.result_data if isinstance(job.result_data, dict) else {}
        if result_data.get("session_id") == session_id:
            return job.id

    return None


def _compute_session_accuracy(correct_count: int, incorrect_count: int) -> int:
    total_answered = correct_count + incorrect_count
    if total_answered == 0:
        return 100
    return round((correct_count / total_answered) * 100)


def _compute_session_xp(accuracy: int, hints_used: int = 0) -> int:
    base_xp = 30
    bonus = int((accuracy / 100) * 20)
    hint_penalty = hints_used * 5
    return max(10, base_xp + bonus - hint_penalty)


def _format_elapsed_label(elapsed_seconds: int) -> str:
    minutes = elapsed_seconds // 60
    seconds = elapsed_seconds % 60
    return f"{minutes}m {str(seconds).zfill(2)}s"


def _build_session_summary_payload(
    db: Session, session: LessonSessionModel
) -> LessonSessionSummaryPayload:
    attempts = (
        db.query(LessonAttempt)
        .filter(LessonAttempt.lesson_session_id == session.id)
        .all()
    )

    correct_count = 0
    incorrect_count = 0
    skipped_count = 0
    for attempt in attempts:
        evaluation = attempt.evaluation_json if isinstance(attempt.evaluation_json, dict) else {}
        user_input = attempt.user_input_json if isinstance(attempt.user_input_json, dict) else {}
        is_skipped = bool(evaluation.get("skipped")) or bool(user_input.get("skipped"))
        if is_skipped:
            skipped_count += 1
        elif attempt.is_correct_bool:
            correct_count += 1
        else:
            incorrect_count += 1

    accuracy = _compute_session_accuracy(correct_count, incorrect_count)
    completed_at = session.completed_at or datetime.datetime.utcnow()
    started_at = session.started_at or completed_at
    elapsed_seconds = max(0, int((completed_at - started_at).total_seconds()))
    total_stages = len(_coerce_stage_list(session.primary_stages_json)) + len(
        _coerce_stage_list(session.remedial_stages_json)
    )

    return LessonSessionSummaryPayload(
        sessionId=session.id,
        courseId=session.course_id,
        nodeId=session.node_id,
        status=session.status,
        activePhase=session.active_phase,
        totalStages=total_stages,
        attemptedCount=len(attempts),
        correctCount=correct_count,
        incorrectCount=incorrect_count,
        skippedCount=skipped_count,
        accuracy=accuracy,
        elapsedSeconds=elapsed_seconds,
        elapsedLabel=_format_elapsed_label(elapsed_seconds),
        xpGained=_compute_session_xp(accuracy),
    )


def _find_stage_in_session(
    session: LessonSessionModel, stage_id: str
) -> tuple[LessonStage, str] | tuple[None, None]:
    for stage in _coerce_stage_list(session.primary_stages_json):
        if stage.stageId == stage_id:
            return stage, "primary"
    for stage in _coerce_stage_list(session.remedial_stages_json):
        if stage.stageId == stage_id:
            return stage, "remedial"
    return None, None


def _normalize_multiple_choice_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        selected_option_id = user_input.get("selectedOptionId") or user_input.get(
            "selected_option_id"
        )
    else:
        selected_option_id = user_input
    return {"selectedOptionId": str(selected_option_id or "")}


def _normalize_ordering_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        order = user_input.get("order") or user_input.get("steps") or []
    else:
        order = user_input or []
    return {"order": [_normalize_ordering_item(item) for item in list(order)]}


def _normalize_matching_input(user_input: Any) -> dict:
    if isinstance(user_input, dict):
        matches = user_input.get("matches", user_input)
    else:
        matches = {}
    return {"matches": {str(k): str(v) for k, v in dict(matches).items()}}


def _is_skipped_submission(user_input: Any) -> bool:
    return isinstance(user_input, dict) and bool(user_input.get("skipped"))


async def _evaluate_submission(
    stage: LessonStage,
    user_input: Any,
    context_topic: str,
    architect_service: AIArchitectService,
) -> tuple[str, str, dict, dict]:
    if _is_skipped_submission(user_input):
        normalized_input = {"skipped": True}
        evaluation = {"status": "skipped", "skipped": True}
        return (
            "skipped",
            "Skipped for now. This question will be recorded as skipped and not sent to remedial review.",
            normalized_input,
            evaluation,
        )

    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    validation = (
        stage.validation.condition
        if isinstance(stage.validation.condition, dict)
        else {}
    )

    if stage.component == "MultipleChoice":
        normalized_input = _normalize_multiple_choice_input(user_input)
        correct_option_id = (
            data.get("correctId")
            or data.get("correctOptionId")
            or validation.get("correctId")
            or validation.get("correctOptionId")
            or ""
        )
        is_correct = normalized_input["selectedOptionId"] == str(correct_option_id)
        evaluation = {
            "selectedOptionId": normalized_input["selectedOptionId"],
            "correctOptionId": str(correct_option_id),
        }
        return (
            "correct" if is_correct else "incorrect",
            stage.feedback.success if is_correct else stage.feedback.error,
            normalized_input,
            evaluation,
        )

    if stage.component == "Ordering":
        normalized_input = _normalize_ordering_input(user_input)
        expected_order = [
            _normalize_ordering_item(item) for item in list(data.get("steps", []))
        ]
        is_correct = normalized_input["order"] == expected_order
        evaluation = {
            "submittedOrder": normalized_input["order"],
            "expectedOrder": expected_order,
        }
        return (
            "correct" if is_correct else "incorrect",
            stage.feedback.success if is_correct else stage.feedback.error,
            normalized_input,
            evaluation,
        )

    if stage.component == "MatchingPairs":
        normalized_input = _normalize_matching_input(user_input)
        expected_pairs = {
            str(pair.get("left", "")): str(pair.get("right", ""))
            for pair in list(data.get("pairs", []))
        }
        is_correct = normalized_input["matches"] == expected_pairs
        evaluation = {
            "submittedMatches": normalized_input["matches"],
            "expectedMatches": expected_pairs,
        }
        return (
            "correct" if is_correct else "incorrect",
            stage.feedback.success if is_correct else stage.feedback.error,
            normalized_input,
            evaluation,
        )

    if stage.component == "FeynmanMirror":
        explanation = ""
        if isinstance(user_input, dict):
            explanation = str(user_input.get("explanation") or "").strip()
        else:
            explanation = str(user_input or "").strip()

        normalized_input = {"explanation": explanation}
        grading = await architect_service.grade_feynman_attempt(
            explanation,
            context_topic or stage.topic,
            prompt=str(data.get("prompt") or stage.topic),
            sample_answer=str(data.get("sampleAnswer") or ""),
        )
        is_correct = bool(grading.get("isCorrect"))
        evaluation = {
            "prompt": str(data.get("prompt") or stage.topic),
            "sampleAnswer": str(data.get("sampleAnswer") or ""),
            "grading": grading,
        }
        return (
            "correct" if is_correct else "incorrect",
            grading.get("feedback", stage.feedback.success if is_correct else stage.feedback.error),
            normalized_input,
            evaluation,
        )

    normalized_input = {"raw": user_input}
    is_correct = bool(user_input)
    evaluation = {"raw": user_input}
    return (
        "correct" if is_correct else "incorrect",
        stage.feedback.success if is_correct else stage.feedback.error,
        normalized_input,
        evaluation,
    )


def _apply_course_node_completion(
    db: Session,
    course_id: int,
    node_id: str,
    current_user_id: int,
):
    course_record = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user_id)
        .first()
    )
    if not course_record:
        raise HTTPException(status_code=404, detail=f"Course {course_id} not found")

    syllabus_data = course_record.syllabus_json
    node_found = False
    units = syllabus_data.get("units", [])
    updates_to_sync = []

    for unit_idx, unit in enumerate(units):
        nodes = unit.get("nodes", [])
        for node_idx, node in enumerate(nodes):
            if node["id"] != node_id:
                continue
            node["status"] = "completed"
            node_found = True
            updates_to_sync.append((node_id, "completed"))
            if node_idx + 1 < len(nodes):
                next_node = nodes[node_idx + 1]
                next_node["status"] = "available"
                updates_to_sync.append((next_node["id"], "available"))
            elif unit_idx + 1 < len(units):
                next_unit = units[unit_idx + 1]
                if next_unit.get("nodes"):
                    next_node = next_unit["nodes"][0]
                    next_node["status"] = "available"
                    updates_to_sync.append((next_node["id"], "available"))
            break
        if node_found:
            break

    if not node_found:
        raise HTTPException(status_code=404, detail="Node not found in course")

    course_record.syllabus_json = syllabus_data
    flag_modified(course_record, "syllabus_json")

    for nid, nstatus in updates_to_sync:
        db_node = (
            db.query(NodeModel)
            .filter(NodeModel.course_id == course_record.id, NodeModel.node_id == nid)
            .first()
        )
        if db_node:
            db_node.status = nstatus
            db_node.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(course_record)


@router.post("/generate-lesson-from-node")
async def generate_lesson_from_node_endpoint(
    node: LessonNode,
    topic: str,
    background_tasks: BackgroundTasks,
    project_id: int = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
        try:
            stages = _coerce_stage_list(cached_lesson.stage_json)
            if stages:
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

    if current_user.credits < settings.COST_LESSON_GENERATION:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {settings.COST_LESSON_GENERATION}.",
        )

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
        result_data={"project_id": project_id, "node_id": node.id, "topic": topic},
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


@router.post("/sessions/start", response_model=LessonSessionPayload)
async def start_lesson_session(
    request: LessonSessionStartRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_session = (
        db.query(LessonSessionModel)
        .filter(
            LessonSessionModel.user_id == current_user.id,
            LessonSessionModel.course_id == request.courseId,
            LessonSessionModel.node_id == request.nodeId,
            LessonSessionModel.status.in_(
                ["playing_primary", "remedial_generating", "playing_remedial"]
            ),
        )
        .order_by(LessonSessionModel.created_at.desc())
        .first()
    )
    if existing_session:
        if existing_session.status == "remedial_generating":
            remedial_stages = _coerce_stage_list(existing_session.remedial_stages_json)
            if remedial_stages:
                existing_session.status = "playing_remedial"
                existing_session.active_phase = "remedial"
                db.commit()
                db.refresh(existing_session)
                return _build_session_payload(db, existing_session)

            remedial_job_id = _find_active_remedial_job_id(
                db, existing_session.id, current_user.id
            )
            if remedial_job_id:
                return _build_session_payload(
                    db, existing_session, remedial_job_id=remedial_job_id
                )

            # Recover stale sessions that were left in generating state without an active job.
            existing_session.status = "playing_primary"
            existing_session.active_phase = "primary"
            db.commit()
            db.refresh(existing_session)

        return _build_session_payload(db, existing_session)

    cached_lesson = (
        db.query(LessonModel)
        .filter(
            LessonModel.user_id == current_user.id,
            LessonModel.project_id == request.projectId,
            LessonModel.node_id == request.nodeId,
            LessonModel.course_topic == request.topic,
        )
        .order_by(LessonModel.created_at.desc())
        .first()
    )

    session = LessonSessionModel(
        user_id=current_user.id,
        project_id=request.projectId,
        course_id=request.courseId,
        lesson_id=cached_lesson.id if cached_lesson else None,
        node_id=request.nodeId,
        course_topic=request.topic,
        status="playing_primary",
        active_phase="primary",
        primary_stages_json=[stage.model_dump() for stage in request.primaryStages],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _build_session_payload(db, session)


@router.get("/sessions/{session_id}", response_model=LessonSessionPayload)
async def get_lesson_session(
    session_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(LessonSessionModel)
        .filter(
            LessonSessionModel.id == session_id,
            LessonSessionModel.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lesson session not found")
    return _build_session_payload(db, session)


@router.get("/sessions/{session_id}/summary", response_model=LessonSessionSummaryPayload)
async def get_lesson_session_summary(
    session_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(LessonSessionModel)
        .filter(
            LessonSessionModel.id == session_id,
            LessonSessionModel.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lesson session not found")

    return _build_session_summary_payload(db, session)


@router.post("/submit-answer", response_model=SubmissionResponse)
async def submit_answer(
    submission: SubmissionRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    architect_service: AIArchitectService = Depends(get_architect_service),
):
    session = (
        db.query(LessonSessionModel)
        .filter(
            LessonSessionModel.id == submission.sessionId,
            LessonSessionModel.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lesson session not found")

    if session.status not in ["playing_primary", "playing_remedial"]:
        raise HTTPException(
            status_code=409,
            detail=f"Lesson session is not accepting submissions in state {session.status}.",
        )

    stage, phase = _find_stage_in_session(session, submission.stageId)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found in lesson session")

    result, message, normalized_input, evaluation = await _evaluate_submission(
        stage,
        submission.userInput,
        submission.context_topic or session.course_topic or stage.topic,
        architect_service,
    )
    is_correct = result == "correct"

    attempt = LessonAttempt(
        lesson_session_id=session.id,
        user_id=current_user.id,
        project_id=session.project_id,
        course_id=session.course_id,
        node_id=session.node_id,
        course_topic=session.course_topic,
        stage_id=stage.stageId,
        component=stage.component,
        phase=phase,
        user_input=str(normalized_input),
        user_input_json=normalized_input,
        evaluation_json=evaluation,
        stage_snapshot_json=stage.model_dump(),
        is_correct=str(is_correct),
        is_correct_bool=is_correct,
    )
    db.add(attempt)

    recorded_failure = False
    if phase == "primary" and result == "incorrect":
        existing_failed_stage = (
            db.query(LessonFailedStageModel)
            .filter(
                LessonFailedStageModel.lesson_session_id == session.id,
                LessonFailedStageModel.stage_id == stage.stageId,
                LessonFailedStageModel.status.in_(["pending", "remedial_generated"]),
            )
            .first()
        )
        if existing_failed_stage:
            existing_failed_stage.user_input_json = normalized_input
            existing_failed_stage.evaluation_json = evaluation
            existing_failed_stage.updated_at = datetime.datetime.utcnow()
        else:
            db.add(
                LessonFailedStageModel(
                    lesson_session_id=session.id,
                    user_id=current_user.id,
                    project_id=session.project_id,
                    course_id=session.course_id,
                    node_id=session.node_id,
                    course_topic=session.course_topic,
                    stage_id=stage.stageId,
                    component=stage.component,
                    source_phase=phase,
                    status="pending",
                    stage_snapshot_json=stage.model_dump(),
                    user_input_json=normalized_input,
                    evaluation_json=evaluation,
                )
            )
        recorded_failure = True

    db.commit()

    return SubmissionResponse(
        nextAction="review_later" if result == "incorrect" else "proceed",
        result=result,
        recordedFailure=recorded_failure,
        evaluation=evaluation,
        message=message,
    )


@router.post("/sessions/{session_id}/complete-primary", response_model=LessonSessionPayload)
async def complete_primary_lesson_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(LessonSessionModel)
        .filter(
            LessonSessionModel.id == session_id,
            LessonSessionModel.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lesson session not found")

    if session.status == "completed":
        return _build_session_payload(db, session)

    if session.status != "playing_primary":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot complete primary lesson from state {session.status}.",
        )

    failed_records = (
        db.query(LessonFailedStageModel)
        .filter(
            LessonFailedStageModel.lesson_session_id == session.id,
            LessonFailedStageModel.status == "pending",
        )
        .order_by(LessonFailedStageModel.created_at.asc())
        .all()
    )

    if not failed_records:
        session.status = "completed"
        session.active_phase = "primary"
        session.completed_at = datetime.datetime.utcnow()
        db.commit()
        _apply_course_node_completion(db, session.course_id, session.node_id, current_user.id)
        db.refresh(session)
        return _build_session_payload(db, session)

    job_id = str(uuid.uuid4())
    job = JobModel(
        id=job_id,
        user_id=current_user.id,
        project_id=session.project_id,
        job_type="REMEDIAL_GEN",
        status="PENDING",
        progress=0,
        message="Preparing remedial lesson...",
        result_data={
            "session_id": session.id,
            "project_id": session.project_id,
            "node_id": session.node_id,
            "topic": session.course_topic,
        },
    )
    db.add(job)
    session.status = "remedial_generating"
    db.commit()

    background_tasks.add_task(
        run_remedial_generation_job,
        job_id,
        current_user.id,
        session.course_topic,
        session.node_id,
        session.project_id,
        [_serialize_failed_record(record).model_dump() for record in failed_records],
        session.id,
    )

    db.refresh(session)
    return _build_session_payload(db, session, remedial_job_id=job_id)


@router.post("/sessions/{session_id}/complete-remedial", response_model=LessonSessionPayload)
async def complete_remedial_lesson_session(
    session_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(LessonSessionModel)
        .filter(
            LessonSessionModel.id == session_id,
            LessonSessionModel.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lesson session not found")

    if session.status == "completed":
        return _build_session_payload(db, session)

    if session.status != "playing_remedial":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot complete remedial lesson from state {session.status}.",
        )

    now = datetime.datetime.utcnow()
    failed_records = (
        db.query(LessonFailedStageModel)
        .filter(
            LessonFailedStageModel.lesson_session_id == session.id,
            LessonFailedStageModel.status.in_(["pending", "remedial_generated"]),
        )
        .all()
    )
    for record in failed_records:
        record.status = "resolved"
        record.resolved_at = now
        record.updated_at = now

    session.status = "completed"
    session.active_phase = "remedial"
    session.completed_at = now
    db.commit()

    _apply_course_node_completion(db, session.course_id, session.node_id, current_user.id)
    db.refresh(session)
    return _build_session_payload(db, session)


@router.post("/generate-remedial-stages", response_model=List[LessonStage])
async def generate_remedial_stages_endpoint(
    request: RemedialGenerationRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    architect_service: AIArchitectService = Depends(get_architect_service),
):
    failed_records = request.failedStages
    if request.sessionId and not failed_records:
        persisted_records = (
            db.query(LessonFailedStageModel)
            .filter(
                LessonFailedStageModel.lesson_session_id == request.sessionId,
                LessonFailedStageModel.status.in_(["pending", "remedial_generated"]),
            )
            .all()
        )
        failed_records = [_serialize_failed_record(record) for record in persisted_records]

    if not failed_records:
        return []

    remedial_stages = await architect_service.generate_remedial_stages(
        failed_records,
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
    failed_records = request.failedStages
    if request.sessionId and not failed_records:
        persisted_records = (
            db.query(LessonFailedStageModel)
            .filter(
                LessonFailedStageModel.lesson_session_id == request.sessionId,
                LessonFailedStageModel.status.in_(["pending", "remedial_generated"]),
            )
            .all()
        )
        failed_records = [_serialize_failed_record(record) for record in persisted_records]

    if not failed_records:
        return {"status": "COMPLETED", "result_data": {"stages": []}}

    job_id = str(uuid.uuid4())
    new_job = JobModel(
        id=job_id,
        user_id=current_user.id,
        project_id=request.projectId,
        job_type="REMEDIAL_GEN",
        status="PENDING",
        progress=0,
        message="Waiting for remedial generation...",
        result_data={
            "session_id": request.sessionId,
            "project_id": request.projectId,
            "node_id": request.nodeId,
            "topic": request.topic,
        },
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
        [record.model_dump() for record in failed_records],
        request.sessionId,
    )
    return {"job_id": job_id, "status": "PENDING"}
