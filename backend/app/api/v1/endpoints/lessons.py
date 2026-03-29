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
from app.core.time import utc_now_naive
from app.domain.statuses import (
    ACTIVE_JOB_STATUSES,
    ACTIVE_LESSON_SESSION_STATUSES,
    JobStatus,
    JobType,
    LessonFailedStageStatus,
    LessonSessionPhase,
    LessonSessionStatus,
    NodeStatus,
)
from app.models.course import CourseModel, NodeModel
from app.models.job import JobModel
from app.models.lesson import (
    LessonAttempt,
    LessonFailedStageModel,
    LessonModel,
    LessonRemedialModel,
    LessonSessionModel,
)
from app.models.user import UserModel
from app.schemas.course_schema import LessonNode
from app.schemas.lesson_schema import (
    FailedStageRecord,
    LessonComponentManifestItem,
    LessonComponentManifestResponse,
    LessonAssistantRequest,
    LessonAssistantResponse,
    LessonSessionCompleteRequest,
    LessonSessionPayload,
    LessonSessionSummaryPayload,
    LessonSessionStartRequest,
    LessonStage,
    RemedialGenerationRequest,
    SubmissionRequest,
    SubmissionResponse,
)
from app.services.ai_agents.course_architect import AIArchitectService, get_architect_service
from app.services.commons.user_credits import has_sufficient_credits
from app.services.commons.user_economy import (
    award_lesson_completion_xp,
)
from app.services.lesson_components.evaluator_registry import evaluator_registry
from app.services.lesson_components import evaluators as _lesson_component_evaluators  # noqa: F401
from app.services.workers.lesson_worker import (
    run_lesson_generation_job,
    run_remedial_generation_job,
)

router = APIRouter()
logger = logging.getLogger(__name__)

LESSON_STAGE_LIST_ADAPTER = TypeAdapter(List[LessonStage])


@router.get("/components", response_model=LessonComponentManifestResponse)
def get_lesson_component_manifest():
    from app.core.component_loader import registry

    items = []
    for component_name in registry.get_component_names():
        component = registry.get_component(component_name) or {}
        items.append(
            LessonComponentManifestItem(
                name=component_name,
                frontendRegistryKey=registry.get_frontend_registry_key(component_name)
                or component_name,
                module=str(component.get("module") or ""),
                description=str(component.get("description") or ""),
                allowedInRemedial=bool(component.get("allowed_in_remedial", False)),
                requiredConfigDataFields=registry.get_required_data_fields(component_name),
                optionalConfigDataFields=registry.get_optional_data_fields(component_name),
                submissionKeys=registry.get_submission_keys(component_name),
                schemaRequirements=str(component.get("schema_requirements") or ""),
            )
        )

    items.sort(key=lambda item: item.name)
    return LessonComponentManifestResponse(items=items)


def _coerce_stage_list(raw: Any) -> List[LessonStage]:
    if isinstance(raw, list):
        return LESSON_STAGE_LIST_ADAPTER.validate_python(raw)
    if isinstance(raw, dict):
        return [TypeAdapter(LessonStage).validate_python(raw)]
    return []


def _serialize_failed_record(record: LessonFailedStageModel) -> FailedStageRecord:
    return FailedStageRecord(
        failedStage=TypeAdapter(LessonStage).validate_python(record.stage_snapshot_json),
        userInput=record.user_input_json,
    )


def _build_session_payload(
    db: Session,
    session: LessonSessionModel,
    remedial_job_id: str | None = None,
    resumed_session: bool = False,
) -> LessonSessionPayload:
    primary_stages = _coerce_stage_list(session.primary_stages_json)
    remedial_stages = _coerce_stage_list(session.remedial_stages_json)
    active_stages = (
        remedial_stages
        if session.active_phase == LessonSessionPhase.REMEDIAL
        else primary_stages
    )
    pending_failed_count = (
        db.query(LessonFailedStageModel)
        .filter(
            LessonFailedStageModel.lesson_session_id == session.id,
            LessonFailedStageModel.status.in_(
                [
                    LessonFailedStageStatus.PENDING,
                    LessonFailedStageStatus.REMEDIAL_GENERATED,
                ]
            ),
        )
        .count()
    )

    return LessonSessionPayload(
        sessionId=session.id,
        status=session.status,
        activePhase=session.active_phase,
        rewardEligible=bool(session.reward_eligible),
        resumedSession=resumed_session,
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
            JobModel.job_type == JobType.REMEDIAL_GENERATION,
            JobModel.status.in_(ACTIVE_JOB_STATUSES),
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


def _resolve_course_folder_and_profile(
    db: Session, course_id: int | None, current_user_id: int
) -> tuple[str | None, str]:
    if not course_id:
        return None, ""

    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user_id)
        .first()
    )
    if not course:
        return None, ""

    return course.folder_name, (
        course.profile_json.get("summary", "")
        if isinstance(course.profile_json, dict)
        else ""
    )


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
    completed_at = session.completed_at or utc_now_naive()
    started_at = session.started_at or completed_at
    elapsed_seconds = max(0, int((completed_at - started_at).total_seconds()))
    total_stages = len(_coerce_stage_list(session.primary_stages_json)) + len(
        _coerce_stage_list(session.remedial_stages_json)
    )

    xp_gained = (
        _compute_session_xp(accuracy, session.hints_used_count or 0)
        if session.reward_eligible
        else 0
    )

    return LessonSessionSummaryPayload(
        sessionId=session.id,
        courseId=session.course_id,
        nodeId=session.node_id,
        status=session.status,
        activePhase=session.active_phase,
        rewardEligible=bool(session.reward_eligible),
        totalStages=total_stages,
        attemptedCount=len(attempts),
        correctCount=correct_count,
        incorrectCount=incorrect_count,
        skippedCount=skipped_count,
        accuracy=accuracy,
        elapsedSeconds=elapsed_seconds,
        elapsedLabel=_format_elapsed_label(elapsed_seconds),
        xpGained=xp_gained,
    )


def _award_session_completion_rewards(
    db: Session,
    session: LessonSessionModel,
    current_user: UserModel,
) -> None:
    if not session.reward_eligible:
        return

    summary = _build_session_summary_payload(db, session)
    if summary.xpGained <= 0:
        return

    award_lesson_completion_xp(
        db,
        current_user,
        session_id=session.id,
        amount=summary.xpGained,
        course_id=session.course_id,
        node_id=session.node_id,
        active_phase=session.active_phase,
        accuracy=summary.accuracy,
    )


def _is_course_node_already_completed(
    db: Session, course_id: int | None, node_id: str, current_user_id: int
) -> bool:
    if not course_id:
        return False

    course_record = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user_id)
        .first()
    )
    if not course_record:
        return False

    syllabus_data = course_record.syllabus_json or {}
    for unit in syllabus_data.get("units", []):
        for node in unit.get("nodes", []):
            if node.get("id") == node_id:
                return node.get("status") == NodeStatus.COMPLETED
    return False


def _find_stage_in_session(
    session: LessonSessionModel, stage_id: str
) -> tuple[LessonStage, str] | tuple[None, None]:
    for stage in _coerce_stage_list(session.primary_stages_json):
        if stage.stageId == stage_id:
            return stage, LessonSessionPhase.PRIMARY
    for stage in _coerce_stage_list(session.remedial_stages_json):
        if stage.stageId == stage_id:
            return stage, LessonSessionPhase.REMEDIAL
    return None, None


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

    evaluator = evaluator_registry.get(stage.component)
    if evaluator is not None:
        return await evaluator(stage, user_input, context_topic, architect_service)

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

    def promote_next_node(next_node: dict) -> None:
        current_status = next_node.get("status")
        if current_status == NodeStatus.COMPLETED:
            return
        next_node["status"] = NodeStatus.AVAILABLE
        updates_to_sync.append((next_node["id"], NodeStatus.AVAILABLE))

    for unit_idx, unit in enumerate(units):
        nodes = unit.get("nodes", [])
        for node_idx, node in enumerate(nodes):
            if node["id"] != node_id:
                continue
            node["status"] = NodeStatus.COMPLETED
            node_found = True
            updates_to_sync.append((node_id, NodeStatus.COMPLETED))
            if node_idx + 1 < len(nodes):
                promote_next_node(nodes[node_idx + 1])
            elif unit_idx + 1 < len(units):
                next_unit = units[unit_idx + 1]
                if next_unit.get("nodes"):
                    promote_next_node(next_unit["nodes"][0])
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
            db_node.updated_at = utc_now_naive()

    db.commit()
    db.refresh(course_record)


@router.post("/generate-lesson-from-node")
async def generate_lesson_from_node_endpoint(
    node: LessonNode,
    topic: str,
    background_tasks: BackgroundTasks,
    course_id: int | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    def _fetch_cached_lesson():
        query = db.query(LessonModel).filter(
            LessonModel.node_id == node.id,
            LessonModel.course_topic == topic,
            LessonModel.user_id == current_user.id,
        )
        if course_id is not None:
            query = query.filter(LessonModel.course_id == course_id)
        return query.order_by(LessonModel.created_at.desc()).first()

    cached_lesson = await run_in_threadpool(_fetch_cached_lesson)

    if cached_lesson:
        try:
            stages = _coerce_stage_list(cached_lesson.stage_json)
            if stages:
                return {
                    "status": JobStatus.COMPLETED,
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

    if not has_sufficient_credits(current_user, settings.COST_LESSON_GENERATION):
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {settings.COST_LESSON_GENERATION}.",
        )

    course_folder_name = None
    profile_summary = "General Learner"
    if course_id:

        def _fetch_course_lesson():
            return (
                db.query(CourseModel)
                .filter(
                    CourseModel.id == course_id,
                    CourseModel.user_id == current_user.id,
                )
                .first()
            )

        db_course = await run_in_threadpool(_fetch_course_lesson)
        if db_course:
            course_folder_name = db_course.folder_name
            if db_course.profile_json:
                profile_summary = db_course.profile_json.get(
                    "summary", "General Learner"
                )

    job_id = str(uuid.uuid4())
    new_job = JobModel(
        id=job_id,
        user_id=current_user.id,
        course_id=course_id,
        job_type=JobType.LESSON_GENERATION,
        status=JobStatus.PENDING,
        progress=0,
        message="Waiting for resources...",
        result_data={
            "course_id": course_id,
            "node_id": node.id,
            "topic": topic,
        },
    )
    db.add(new_job)
    db.commit()

    background_tasks.add_task(
        run_lesson_generation_job,
        job_id,
        current_user.id,
        course_id,
        topic,
        node.model_dump(),
        course_folder_name,
        profile_summary,
    )
    return {"job_id": job_id, "status": JobStatus.PENDING}


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
            LessonSessionModel.status.in_(ACTIVE_LESSON_SESSION_STATUSES),
        )
        .order_by(LessonSessionModel.created_at.desc())
        .first()
    )
    if existing_session:
        if existing_session.status == LessonSessionStatus.REMEDIAL_GENERATING:
            remedial_stages = _coerce_stage_list(existing_session.remedial_stages_json)
            if remedial_stages:
                existing_session.status = LessonSessionStatus.PLAYING_REMEDIAL
                existing_session.active_phase = LessonSessionPhase.REMEDIAL
                db.commit()
                db.refresh(existing_session)
                return _build_session_payload(
                    db, existing_session, resumed_session=True
                )

            remedial_job_id = _find_active_remedial_job_id(
                db, existing_session.id, current_user.id
            )
            if remedial_job_id:
                return _build_session_payload(
                    db,
                    existing_session,
                    remedial_job_id=remedial_job_id,
                    resumed_session=True,
                )

            # Recover stale sessions that were left in generating state without an active job.
            existing_session.status = LessonSessionStatus.PLAYING_PRIMARY
            existing_session.active_phase = LessonSessionPhase.PRIMARY
            db.commit()
            db.refresh(existing_session)

        return _build_session_payload(db, existing_session, resumed_session=True)

    cached_lesson = (
        db.query(LessonModel)
        .filter(
            LessonModel.user_id == current_user.id,
            LessonModel.course_id == request.courseId,
            LessonModel.node_id == request.nodeId,
            LessonModel.course_topic == request.topic,
        )
        .order_by(LessonModel.created_at.desc())
        .first()
    )

    session = LessonSessionModel(
        user_id=current_user.id,
        course_id=request.courseId,
        lesson_id=cached_lesson.id if cached_lesson else None,
        node_id=request.nodeId,
        course_topic=request.topic,
        status=LessonSessionStatus.PLAYING_PRIMARY,
        active_phase=LessonSessionPhase.PRIMARY,
        reward_eligible=not _is_course_node_already_completed(
            db, request.courseId, request.nodeId, current_user.id
        ),
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


@router.post("/assistant/respond", response_model=LessonAssistantResponse)
async def respond_to_lesson_question(
    request: LessonAssistantRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    architect_service: AIArchitectService = Depends(get_architect_service),
):
    session = None
    if request.sessionId is not None:
        session = (
            db.query(LessonSessionModel)
            .filter(
                LessonSessionModel.id == request.sessionId,
                LessonSessionModel.user_id == current_user.id,
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Lesson session not found")

    resolved_course_id = (
        session.course_id
        if session and session.course_id is not None
        else request.courseId
    )
    course_folder, learner_profile_summary = _resolve_course_folder_and_profile(
        db, resolved_course_id, current_user.id
    )

    answer = await architect_service.answer_lesson_question(
        user_question=request.userQuestion,
        course_topic=(
            request.courseTopic
            or (session.course_topic if session else "")
            or request.courseTitle
            or "Lesson"
        ),
        course_title=request.courseTitle or request.courseTopic or "",
        node_title=request.nodeTitle or (session.node_id if session else "") or "",
        node_description=request.nodeDescription or "",
        active_phase=(
            request.activePhase
            or (session.active_phase if session else LessonSessionPhase.PRIMARY)
        ),
        stage_index=max(0, int(request.stageIndex or 0)),
        total_stages=max(1, int(request.totalStages or 1)),
        current_stage=request.currentStage,
        conversation=[message.model_dump() for message in request.conversation],
        user_id=current_user.id,
        course_folder=course_folder,
        learner_profile_summary=learner_profile_summary,
    )
    return LessonAssistantResponse(answer=answer)


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

    if session.status not in (
        LessonSessionStatus.PLAYING_PRIMARY,
        LessonSessionStatus.PLAYING_REMEDIAL,
    ):
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
    if phase == LessonSessionPhase.PRIMARY and result == "incorrect":
        existing_failed_stage = (
            db.query(LessonFailedStageModel)
            .filter(
                LessonFailedStageModel.lesson_session_id == session.id,
                LessonFailedStageModel.stage_id == stage.stageId,
                LessonFailedStageModel.status.in_(
                    [
                        LessonFailedStageStatus.PENDING,
                        LessonFailedStageStatus.REMEDIAL_GENERATED,
                    ]
                ),
            )
            .first()
        )
        if existing_failed_stage:
            existing_failed_stage.user_input_json = normalized_input
            existing_failed_stage.evaluation_json = evaluation
            existing_failed_stage.updated_at = utc_now_naive()
        else:
            db.add(
                LessonFailedStageModel(
                    lesson_session_id=session.id,
                    user_id=current_user.id,
                    course_id=session.course_id,
                    node_id=session.node_id,
                    course_topic=session.course_topic,
                    stage_id=stage.stageId,
                    component=stage.component,
                    source_phase=phase,
                    status=LessonFailedStageStatus.PENDING,
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
    request: LessonSessionCompleteRequest,
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

    if session.status == LessonSessionStatus.COMPLETED:
        return _build_session_payload(db, session)

    if session.status != LessonSessionStatus.PLAYING_PRIMARY:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot complete primary lesson from state {session.status}.",
        )

    session.hints_used_count = max(0, int(request.hintsUsed or 0))

    failed_records = (
        db.query(LessonFailedStageModel)
        .filter(
            LessonFailedStageModel.lesson_session_id == session.id,
            LessonFailedStageModel.status == LessonFailedStageStatus.PENDING,
        )
        .order_by(LessonFailedStageModel.created_at.asc())
        .all()
    )

    if not failed_records:
        session.status = LessonSessionStatus.COMPLETED
        session.active_phase = LessonSessionPhase.PRIMARY
        session.completed_at = utc_now_naive()
        _award_session_completion_rewards(db, session, current_user)
        db.commit()
        _apply_course_node_completion(db, session.course_id, session.node_id, current_user.id)
        db.refresh(session)
        return _build_session_payload(db, session)

    job_id = str(uuid.uuid4())
    job = JobModel(
        id=job_id,
        user_id=current_user.id,
        course_id=session.course_id,
        job_type=JobType.REMEDIAL_GENERATION,
        status=JobStatus.PENDING,
        progress=0,
        message="Preparing remedial lesson...",
        result_data={
            "session_id": session.id,
            "course_id": session.course_id,
            "node_id": session.node_id,
            "topic": session.course_topic,
        },
    )
    db.add(job)
    session.status = LessonSessionStatus.REMEDIAL_GENERATING
    db.commit()

    background_tasks.add_task(
        run_remedial_generation_job,
        job_id,
        current_user.id,
        session.course_topic,
        session.node_id,
        session.course_id,
        [_serialize_failed_record(record).model_dump() for record in failed_records],
        session.id,
    )

    db.refresh(session)
    return _build_session_payload(db, session, remedial_job_id=job_id)


@router.post("/sessions/{session_id}/complete-remedial", response_model=LessonSessionPayload)
async def complete_remedial_lesson_session(
    session_id: int,
    request: LessonSessionCompleteRequest,
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

    if session.status == LessonSessionStatus.COMPLETED:
        return _build_session_payload(db, session)

    if session.status != LessonSessionStatus.PLAYING_REMEDIAL:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot complete remedial lesson from state {session.status}.",
        )

    session.hints_used_count = max(0, int(request.hintsUsed or 0))

    now = utc_now_naive()
    failed_records = (
        db.query(LessonFailedStageModel)
        .filter(
            LessonFailedStageModel.lesson_session_id == session.id,
            LessonFailedStageModel.status.in_(
                [
                    LessonFailedStageStatus.PENDING,
                    LessonFailedStageStatus.REMEDIAL_GENERATED,
                ]
            ),
        )
        .all()
    )
    for record in failed_records:
        record.status = LessonFailedStageStatus.RESOLVED
        record.resolved_at = now
        record.updated_at = now

    session.status = LessonSessionStatus.COMPLETED
    session.active_phase = LessonSessionPhase.REMEDIAL
    session.completed_at = now
    _award_session_completion_rewards(db, session, current_user)
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
                LessonFailedStageModel.status.in_(
                    [
                        LessonFailedStageStatus.PENDING,
                        LessonFailedStageStatus.REMEDIAL_GENERATED,
                    ]
                ),
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
                LessonFailedStageModel.status.in_(
                    [
                        LessonFailedStageStatus.PENDING,
                        LessonFailedStageStatus.REMEDIAL_GENERATED,
                    ]
                ),
            )
            .all()
        )
        failed_records = [_serialize_failed_record(record) for record in persisted_records]

    if not failed_records:
        return {"status": JobStatus.COMPLETED, "result_data": {"stages": []}}

    job_id = str(uuid.uuid4())
    new_job = JobModel(
        id=job_id,
        user_id=current_user.id,
        course_id=request.courseId,
        job_type=JobType.REMEDIAL_GENERATION,
        status=JobStatus.PENDING,
        progress=0,
        message="Waiting for remedial generation...",
        result_data={
            "session_id": request.sessionId,
            "course_id": request.courseId,
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
        request.courseId,
        [record.model_dump() for record in failed_records],
        request.sessionId,
    )
    return {"job_id": job_id, "status": JobStatus.PENDING}
