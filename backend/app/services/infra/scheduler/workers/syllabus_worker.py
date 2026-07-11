import logging
from app.domain.statuses import JobStatus
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.core.time import utc_now
from app.services.ai_engine.agents.syllabus_agent import SyllabusAgent
from app.services.domain.user.activity_logger import ActivityLogger
from app.services.ai_engine.clients.factory import LLMFactory
from app.services.ai_engine.kb.rag_engine import RAGEngine
from app.core.config import settings
from app.services.infra.scheduler.workers.job_notifier import _notify_job_update, _publish_job_notification
from app.services.domain.user.economy import spend_user_credits
from app.services.domain.course.lifecycle import (
    mark_syllabus_completed,
    mark_syllabus_failed,
)

logger = logging.getLogger(__name__)


def _is_cancelled(db, job_id: str) -> bool:
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    return job is None or job.status == JobStatus.CANCELLED


async def run_syllabus_generation_job(
    job_id: str,
    user_id: int,
    course_id: int | None,
    topic: str,
    course_folder_name: str | None,
    profile_summary: str,
    full_text_context: str,
    files_used: list,
    regenerate: bool = False,
):
    """
    在背景獨立執行課程大綱生成的 Worker。
    """
    db = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == JobStatus.CANCELLED:
            return

        _notify_job_update(
            db, job, 5, "開始籌備課程藍圖...", status=JobStatus.PROCESSING
        )

        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        COST = settings.COST_SYLLABUS_GENERATION

        # 準備紀錄開始執行事件
        course_name = "Untitled Course"
        existing_course = (
            db.query(CourseModel).filter(CourseModel.id == course_id).first()
            if course_id
            else None
        )
        if existing_course:
            course_name = existing_course.title

        ActivityLogger.log_syllabus_generate_start(
            user.id,
            user.email,
            course_id or 0,
            course_name,
            topic,
            user_prompt=None,
            rag_context_preview=full_text_context[:500] if full_text_context else None,
            questionnaire_profile=profile_summary,
            files_context=files_used if course_id else None,
        )

        provider = LLMFactory.create()
        if files_used:
            provider.bind_files(files_used, use_google_file_api=settings.AI_SYLLABUS_USE_FILE_API)
        rag_engine = RAGEngine(provider)
        agent = SyllabusAgent(provider, rag_engine)

        def cb(prog: int | None, msg: str):
            _notify_job_update(
                db,
                job,
                prog if prog is not None else job.progress,
                msg,
                status=JobStatus.PROCESSING,
            )

        from app.services.infra.scheduler.jobs.job_registry import JobRegistry
        JobRegistry.heartbeat(db, job)

        # 呼叫 LLM
        syllabus = await agent.run(
            topic,
            user_id=user.id,
            course_folder=course_folder_name,
            course_id=course_id,
            profile_summary=profile_summary,
            context=full_text_context,
            progress_callback=cb,
        )

        if _is_cancelled(db, job_id):
            return

        if not syllabus:
            raise Exception("LLM 未能成功產出大綱。")

        _notify_job_update(db, job, 85, "內容準備完成，正在儲存到資料庫...")

        c_model = db.query(CourseModel).filter(CourseModel.id == course_id).first()
        if not c_model:
            raise Exception(f"Course {course_id} not found.")
        c_model.title = syllabus.courseTitle
        c_model.topic = topic
        c_model.syllabus_json = syllabus.model_dump()
        c_model.updated_at = utc_now()
        mark_syllabus_completed(c_model)
        db.query(NodeModel).filter(NodeModel.course_id == c_model.id).delete()

        # 扣點數 (非常重要: 成功才扣)
        spend_user_credits(
            db,
            user,
            COST,
            reason="syllabus_generation",
            idempotency_scope="job:syllabus_generation_charge",
            idempotency_key=job_id,
            metadata={
                "source": "syllabus_generation",
                "job_id": job_id,
                "course_id": c_model.id,
            },
        )

        # 寫入 NodeDB
        for unit in syllabus.units:
            for node in unit.nodes:
                db_node = NodeModel(
                    course_id=c_model.id,
                    node_id=node.id,
                    title=node.title,
                    status=node.status,
                    data=node.model_dump(exclude={"status", "title", "id"}),
                )
                db.add(db_node)
        job.progress = 100
        job.message = "🎉 課程建立完成！"
        job.status = JobStatus.COMPLETED
        job.result_data = {"course_id": c_model.id, "topic": topic}
        db.commit()
        db.refresh(c_model)
        db.refresh(job)

        # 紀錄完成事件
        ActivityLogger.log_syllabus_generate_complete(
            user.id,
            user.email,
            c_model.id,
            c_model.title,
            topic,
            len(syllabus.units),
            sum(len(u.nodes) for u in syllabus.units),
            [u.unitTitle for u in syllabus.units],
        )
        _publish_job_notification(db, job)

    except Exception as e:
        logger.error(f"Syllabus generation job failed: {e}")
        failed_course = (
            db.query(CourseModel).filter(CourseModel.id == course_id).first()
            if course_id
            else None
        )
        db.rollback()
        if failed_course:
            mark_syllabus_failed(failed_course)
        if job is not None:
            job.progress = int(job.progress or 0)
            job.message = f"生成失敗: {str(e)}"
            job.status = JobStatus.FAILED
        db.commit()
        if job is not None:
            db.refresh(job)
            _publish_job_notification(db, job)

    finally:
        db.close()
