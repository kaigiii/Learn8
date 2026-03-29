import json
import asyncio
import asyncpg
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.config import settings
from app.api.dependencies import get_db, get_current_user
from app.domain.statuses import (
    ACTIVE_JOB_STATUSES,
    JobStatus,
    JobType,
    LessonFailedStageStatus,
    LessonSessionStatus,
    NodeStatus,
    RETRYABLE_GENERATION_JOB_TYPES,
    TERMINAL_JOB_STATUSES,
)
from app.models.job import JobModel
from app.models.course import CourseModel
from app.models.lesson import LessonFailedStageModel, LessonSessionModel
from app.schemas.course_schema import LessonNode
from app.services.commons.file_service import FileService
from app.services.workers.job_notifier import _notify_job_update
from app.services.workers.questionnaire_worker import run_questionnaire_generation_job
from app.services.workers.syllabus_worker import run_syllabus_generation_job
from app.services.workers.lesson_worker import (
    run_lesson_generation_job,
    run_remedial_generation_job,
)
from app.services.commons.course_lifecycle import (
    ensure_course_can_generate_questionnaire,
    ensure_course_can_generate_syllabus,
    mark_questionnaire_started,
    mark_syllabus_started,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
STALE_JOB_TIMEOUT = timedelta(minutes=10)


def _normalize_job_result_data(job: JobModel) -> dict:
    return job.result_data if isinstance(job.result_data, dict) else {}


def _job_matches_scope(
    job: JobModel,
    job_type: Optional[str] = None,
    course_id: Optional[int] = None,
    node_id: Optional[str] = None,
    session_id: Optional[int] = None,
) -> bool:
    if job_type and job.job_type != job_type:
        return False

    metadata = _normalize_job_result_data(job)

    if course_id is not None:
        if metadata.get("course_id") != course_id and job.course_id != course_id:
            return False

    if node_id is not None and metadata.get("node_id") != node_id:
        return False

    if session_id is not None and metadata.get("session_id") != session_id:
        return False

    return True


def _mark_stale_jobs(db: Session, user_id: int):
    cutoff = datetime.now(timezone.utc) - STALE_JOB_TIMEOUT

    stale_jobs = (
        db.query(JobModel)
        .filter(
            JobModel.user_id == user_id,
            JobModel.status.in_(ACTIVE_JOB_STATUSES),
            func.coalesce(JobModel.updated_at, JobModel.created_at) < cutoff,
        )
        .all()
    )
    for job in stale_jobs:
        job.status = JobStatus.STALE
        job.message = "Job expired after backend restart or timeout."
    if stale_jobs:
        db.commit()


def _create_retry_job(db: Session, current_user_id: int, job: JobModel, metadata: dict) -> JobModel:
    new_job = JobModel(
        user_id=current_user_id,
        course_id=job.course_id,
        job_type=job.job_type,
        status=JobStatus.PENDING,
        progress=0,
        message=f"Retrying {job.job_type}...",
        result_data=metadata,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job


@router.get("/{job_id}/stream")
async def stream_job_status(job_id: str):
    """
    建立 Server-Sent Events (SSE) 連線，透過 PostgreSQL LISTEN 即時推送任務進度。
    這支 API 實現了零延遲、零資料庫輪詢的事件驅動架構 (Event-Driven)。
    """

    async def event_generator():
        # 確保 asyncpg 能使用標準的 postgresql:// 連線字串
        db_url = settings.DATABASE_URL
        if db_url.startswith("postgresql+"):
            db_url = "postgresql://" + db_url.split("://", 1)[1]

        try:
            conn = await asyncpg.connect(db_url)
        except Exception as e:
            logger.error(f"SSE DB Connection failed: {e}")
            yield f"data: {json.dumps({'status': JobStatus.FAILED, 'message': '推播伺服器連線失敗'})}\n\n"
            return

        queue = asyncio.Queue()

        def notification_handler(connection, pid, channel, payload):
            asyncio.create_task(queue.put(payload))

        # 註冊監聽專屬頻道 "job_channel"
        await conn.add_listener("job_channel", notification_handler)

        try:
            # 建立連線的第一時間，先主動去查一次目前狀態 (避免錯過一開始的通知)
            row = await conn.fetchrow(
                "SELECT status, progress, message, result_data FROM generation_jobs WHERE id = $1",
                job_id,
            )

            if not row:
                yield f"data: {json.dumps({'status': JobStatus.FAILED, 'message': '找不到該任務 (Job not found)'})}\n\n"
                return

            # 傳送初次狀態
            initial_data = dict(row)
            if "result_data" in initial_data and isinstance(
                initial_data["result_data"], str
            ):
                try:
                    initial_data["result_data"] = json.loads(
                        initial_data["result_data"]
                    )
                except:
                    pass

            yield f"data: {json.dumps(initial_data)}\n\n"

            # 如果一查就發現已經做完了，直接中斷連線
            if initial_data.get("status") in TERMINAL_JOB_STATUSES:
                return

            # 開始進入掛起模式，等待 PostgreSQL 喚醒
            while True:
                # 系統沉睡於此，完全不消耗 CPU 也不查 DB
                payload_str = await queue.get()

                try:
                    data = json.loads(payload_str)
                except json.JSONDecodeError:
                    logger.warning(
                        f"[SSE WARNING] Received non-JSON payload for job {job_id[:8]}: {payload_str}"
                    )
                    continue  # Skip if payload is not valid JSON
                except Exception as e:
                    logger.error(
                        f"[SSE ERROR] Unexpected error parsing payload for job {job_id[:8]}: {e}"
                    )
                    continue

                # 確認這個推播是屬於這個人的 Job
                if data.get("job_id") != job_id:
                    continue

                row = await conn.fetchrow(
                    "SELECT status, progress, message, result_data FROM generation_jobs WHERE id = $1",
                    job_id,
                )
                if not row:
                    continue

                event_data = dict(row)
                event_data["job_id"] = job_id
                if "result_data" in event_data and isinstance(
                    event_data["result_data"], str
                ):
                    try:
                        event_data["result_data"] = json.loads(
                            event_data["result_data"]
                        )
                    except Exception:
                        pass

                logger.info(
                    f"[SSE SEND] {job_id[:8]} - status: {event_data.get('status')}, prog: {event_data.get('progress')}"
                )
                yield f"data: {json.dumps(event_data)}\n\n"

                if event_data.get("status") in TERMINAL_JOB_STATUSES:
                    logger.info(
                        f"[SSE CLOSE] Stream for {job_id[:8]} terminating normally due to final status."
                    )
                    break

        except asyncio.CancelledError:
            logger.info(f"[SSE CANCELLED] Stream for {job_id[:8]} was cancelled.")
        except Exception as e:
            logger.error(
                f"[SSE EXCEPTION] Unhandled exception in event_generator for {job_id[:8]}: {e}",
                exc_info=True,
            )
        finally:
            logger.info(f"[SSE DONE] Cleaning up listener for {job_id[:8]}")
            await conn.remove_listener("job_channel", notification_handler)
            await conn.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/active")
async def check_active_jobs(
    job_type: Optional[str] = None,
    course_id: Optional[int] = None,
    node_id: Optional[str] = None,
    session_id: Optional[int] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _mark_stale_jobs(db, current_user.id)

    active_job_query = (
        db.query(JobModel)
        .filter(
            JobModel.user_id == current_user.id,
            JobModel.status.in_((*ACTIVE_JOB_STATUSES, JobStatus.STALE)),
        )
    )

    if job_type:
        active_job_query = active_job_query.filter(JobModel.job_type == job_type)

    active_jobs = active_job_query.order_by(
        JobModel.status.in_(ACTIVE_JOB_STATUSES).desc(),
        JobModel.created_at.desc(),
    ).all()

    active_job = next(
        (
            job
            for job in active_jobs
            if _job_matches_scope(
                job,
                job_type=job_type,
                course_id=course_id,
                node_id=node_id,
                session_id=session_id,
            )
        ),
        None,
    )

    if active_job:
        retryable = (
            active_job.status == JobStatus.STALE
            and active_job.job_type in RETRYABLE_GENERATION_JOB_TYPES
        )
        return {
            "job_id": active_job.id,
            "status": active_job.status,
            "job_type": active_job.job_type,
            "progress": active_job.progress,
            "result_data": active_job.result_data,
            "message": active_job.message,
            "retryable": retryable,
        }
    return {"job_id": None}


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = (
        db.query(JobModel)
        .filter(JobModel.id == job_id, JobModel.user_id == current_user.id)
        .first()
    )

    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job.status in (
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.CANCELLED,
    ):
        return {
            "job_id": job.id,
            "status": job.status,
            "message": job.message,
        }

    _notify_job_update(
        db,
        job,
        job.progress or 0,
        "Generation cancelled by user.",
        status=JobStatus.CANCELLED,
    )
    return {
        "job_id": job.id,
        "status": job.status,
        "message": job.message,
    }


@router.post("/{job_id}/retry")
async def retry_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _mark_stale_jobs(db, current_user.id)

    job = (
        db.query(JobModel)
        .filter(JobModel.id == job_id, JobModel.user_id == current_user.id)
        .first()
    )

    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job.status in ACTIVE_JOB_STATUSES:
        return {
            "job_id": job.id,
            "status": job.status,
            "job_type": job.job_type,
            "result_data": job.result_data,
            "message": job.message,
        }

    if job.status != JobStatus.STALE:
        raise HTTPException(status_code=409, detail="Only stale jobs can be retried.")

    metadata = _normalize_job_result_data(job)
    file_service = FileService()

    if job.job_type == JobType.QUESTIONNAIRE_GENERATION:
        course_id = metadata.get("course_id")
        topic = metadata.get("topic")
        if not course_id or not topic:
            raise HTTPException(status_code=400, detail="Questionnaire retry metadata is incomplete.")
        course = (
            db.query(CourseModel)
            .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
            .first()
        )
        if not course:
            raise HTTPException(status_code=404, detail="Course not found for questionnaire retry.")
        ensure_course_can_generate_questionnaire(course)
        files_used = (
            file_service.list_files(current_user.id, course.folder_name)
            if course.folder_name
            else []
        )
        mark_questionnaire_started(course)
        new_job = _create_retry_job(db, current_user.id, job, metadata)
        background_tasks.add_task(
            run_questionnaire_generation_job,
            job_id=new_job.id,
            user_id=current_user.id,
            course_id=course_id,
            topic=topic,
            files_used=files_used,
        )
    elif job.job_type == JobType.SYLLABUS_GENERATION:
        topic = metadata.get("topic")
        course_id = metadata.get("course_id")
        if not topic:
            raise HTTPException(status_code=400, detail="Syllabus retry metadata is incomplete.")
        if not course_id:
            raise HTTPException(status_code=400, detail="Syllabus retry is missing course_id.")

        course_folder_name = None
        profile_summary = None
        full_text_context = ""
        files = []
        course = (
            db.query(CourseModel)
            .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
            .first()
        )
        if not course:
            raise HTTPException(status_code=404, detail="Course not found for syllabus retry.")
        ensure_course_can_generate_syllabus(course, regenerate=bool(course.syllabus_json))
        course_folder_name = course.folder_name
        if course.profile_json:
            profile_summary = course.profile_json.get("summary", "General Audience")
        files = (
            file_service.list_files(current_user.id, course_folder_name)
            if course_folder_name
            else []
        )
        for fname in files:
            if fname.startswith("."):
                continue
            fpath = file_service.get_upload_dir(current_user.id, course_folder_name) + "/" + fname
            content = file_service.read_file_content(
                fpath, max_chars=settings.MAX_COURSE_CONTEXT_BYTES
            )
            if content:
                full_text_context += f"\n--- Document: {fname} ---\n{content}\n"
        mark_syllabus_started(course)
        new_job = _create_retry_job(db, current_user.id, job, metadata)
        background_tasks.add_task(
            run_syllabus_generation_job,
            job_id=new_job.id,
            user_id=current_user.id,
            course_id=course_id,
            topic=topic,
            course_folder_name=course_folder_name,
            profile_summary=profile_summary,
            full_text_context=full_text_context,
            files_used=files,
            regenerate=bool(course.syllabus_json),
        )
    elif job.job_type == JobType.LESSON_GENERATION:
        topic = metadata.get("topic")
        node_id = metadata.get("node_id")
        course_id = metadata.get("course_id")
        if not topic or not node_id:
            raise HTTPException(status_code=400, detail="Lesson retry metadata is incomplete.")

        course_folder_name = None
        profile_summary = "General Learner"
        course = None
        if course_id:
            course = (
                db.query(CourseModel)
                .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
                .first()
            )
        if not course or not course.syllabus_json:
            raise HTTPException(status_code=404, detail="Course not found for lesson retry.")
        course_folder_name = course.folder_name
        if course.profile_json:
            profile_summary = course.profile_json.get("summary", "General Learner")

        node_payload = None
        for unit in course.syllabus_json.get("units", []):
            for node in unit.get("nodes", []):
                if node.get("id") == node_id:
                    node_payload = node
                    break
            if node_payload:
                break
        if not node_payload:
            raise HTTPException(status_code=404, detail="Node not found for lesson retry.")

        lesson_node = LessonNode(
            id=node_payload["id"],
            title=node_payload["title"],
            description=node_payload.get("description", ""),
            status=node_payload.get("status", NodeStatus.LOCKED),
        )
        new_job = _create_retry_job(db, current_user.id, job, metadata)
        background_tasks.add_task(
            run_lesson_generation_job,
            new_job.id,
            current_user.id,
            course_id,
            topic,
            lesson_node.model_dump(),
            course_folder_name,
            profile_summary,
        )
    elif job.job_type == JobType.REMEDIAL_GENERATION:
        session_id = metadata.get("session_id")
        if not session_id:
            raise HTTPException(status_code=400, detail="Remedial retry metadata is incomplete.")
        session = (
            db.query(LessonSessionModel)
            .filter(LessonSessionModel.id == session_id, LessonSessionModel.user_id == current_user.id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Lesson session not found for remedial retry.")

        failed_records = (
            db.query(LessonFailedStageModel)
            .filter(
                LessonFailedStageModel.lesson_session_id == session_id,
                LessonFailedStageModel.status.in_(
                    [
                        LessonFailedStageStatus.PENDING,
                        LessonFailedStageStatus.REMEDIAL_GENERATED,
                    ]
                ),
            )
            .order_by(LessonFailedStageModel.created_at.asc())
            .all()
        )
        failed_stages = [
            {
                "failedStage": record.stage_snapshot_json,
                "userInput": record.user_input_json,
            }
            for record in failed_records
        ]
        if not failed_stages:
            raise HTTPException(status_code=409, detail="No failed stages remain for remedial retry.")

        session.status = LessonSessionStatus.REMEDIAL_GENERATING
        db.commit()
        new_job = _create_retry_job(db, current_user.id, job, metadata)
        background_tasks.add_task(
            run_remedial_generation_job,
            new_job.id,
            current_user.id,
            session.course_topic,
            session.node_id,
            session.course_id,
            failed_stages,
            session.id,
        )
    else:
        raise HTTPException(status_code=400, detail="This job type is not retryable.")

    return {
        "job_id": new_job.id,
        "status": new_job.status,
        "job_type": new_job.job_type,
        "result_data": new_job.result_data,
        "message": new_job.message,
        "retryable": False,
    }
