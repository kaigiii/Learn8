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
    auto_generate_lessons: bool = False,
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
        # 準備實體檔案絕對路徑
        resolved_files = []
        if course_folder_name and files_used:
            from app.services.infra.files.service import FileService
            resolved_files = FileService().resolve_absolute_paths(
                files_used, user_id, course_folder_name
            )

        if resolved_files:
            provider.bind_files(resolved_files, use_google_file_api=settings.AI_SYLLABUS_GEN_USE_FILE_API)
        agent = SyllabusAgent(provider)

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

        additional_notes = None
        if existing_course and existing_course.profile_json:
            additional_notes = existing_course.profile_json.get("additional_notes")

        # 呼叫 LLM
        syllabus = await agent.run(
            topic,
            user_id=user.id,
            course_folder=course_folder_name,
            course_id=course_id,
            profile_summary=profile_summary,
            context=full_text_context,
            progress_callback=cb,
            additional_notes=additional_notes,
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
        
        is_published = bool(c_model.is_published)
        syllabus.isPublic = is_published
        syllabus.isCustom = not is_published
        
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

        # 自動生成所有關卡
        if auto_generate_lessons:
            import asyncio
            asyncio.create_task(
                auto_generate_course_lessons(
                    course_id=c_model.id,
                    user_id=user.id,
                )
            )

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


async def auto_generate_course_lessons(course_id: int, user_id: int):
    """
    背景非同步依序為課程下的所有節點（關卡）生成課程內容（Lessons）。
    """
    import uuid
    from app.models.course import CourseModel, NodeModel
    from app.models.user import UserModel
    from app.models.lesson import LessonModel
    from app.models.job import JobModel
    from app.domain.statuses import JobType, JobStatus
    from app.core.config import settings
    from app.services.domain.user.credits import has_sufficient_credits
    from app.services.domain.user.profile_context import build_generation_profile_context
    from app.schemas.course_schema import LessonNode
    from app.services.infra.scheduler.workers.lesson_worker import run_lesson_generation_job

    db = SessionLocal()
    try:
        course = db.query(CourseModel).filter(CourseModel.id == course_id).first()
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not course or not user:
            logger.warning(f"[AutoGenerate] Course {course_id} or User {user_id} not found.")
            return

        topic = course.topic or course.title
        profile_summary = None
        if course.profile_json:
            profile_summary = course.profile_json.get("summary", "General Audience")
        profile_context = build_generation_profile_context(
            profile_summary,
            user.preferred_language,
            "General Learner",
        )

        nodes = db.query(NodeModel).filter(NodeModel.course_id == course_id).all()
        logger.info(f"[AutoGenerate] Found {len(nodes)} nodes for course {course_id}. Starting sequential generation...")

        for node_model in nodes:
            # 檢查課程是否已被刪除或用戶取消
            db.refresh(course)
            if not course:
                logger.info(f"[AutoGenerate] Course {course_id} was deleted. Stopping auto-generation.")
                break

            # 1. 檢查是否已有生成的 Lesson
            existing_lesson = db.query(LessonModel).filter(
                LessonModel.node_id == node_model.node_id,
                LessonModel.course_id == course_id,
                LessonModel.user_id == user_id,
            ).first()
            if existing_lesson:
                logger.info(f"[AutoGenerate] Lesson for node {node_model.node_id} already exists. Skipping.")
                continue

            # 2. 檢查是否已有正在執行的生成 Job，避免重複生成
            existing_jobs = db.query(JobModel).filter(
                JobModel.course_id == course_id,
                JobModel.job_type == JobType.LESSON_GENERATION,
                JobModel.status.in_([JobStatus.PENDING, JobStatus.PROCESSING])
            ).all()

            node_already_generating = False
            for job in existing_jobs:
                if job.result_data and job.result_data.get("node_id") == node_model.node_id:
                    node_already_generating = True
                    break

            if node_already_generating:
                logger.info(f"[AutoGenerate] Lesson for node {node_model.node_id} is already generating. Skipping.")
                continue

            # 3. 點數餘額檢查
            db.refresh(user)
            if not has_sufficient_credits(user, settings.COST_LESSON_GENERATION):
                logger.warning(f"[AutoGenerate] User {user_id} has insufficient credits ({user.credits}) to generate node {node_model.node_id}. Stopping auto-generation.")
                break

            # 4. 準備 Schema 物件
            node_desc = node_model.data.get("description", "") if node_model.data else ""
            node_schema = LessonNode(
                id=node_model.node_id,
                title=node_model.title,
                description=node_desc,
                status=node_model.status,
                hasGeneratedLesson=False,
            )

            # 5. 建立 JobModel 用以追蹤與回報狀態
            job_id = str(uuid.uuid4())
            new_job = JobModel(
                id=job_id,
                user_id=user_id,
                course_id=course_id,
                job_type=JobType.LESSON_GENERATION,
                status=JobStatus.PENDING,
                progress=0,
                message="正在準備自動生成關卡內容...",
                result_data={
                    "course_id": course_id,
                    "node_id": node_model.node_id,
                    "topic": topic,
                },
            )
            db.add(new_job)
            db.commit()

            logger.info(f"[AutoGenerate] Triggering lesson generation for node {node_model.node_id} (Job ID: {job_id}).")

            # 6. 同步/循序等待生成（避免對 LLM 模型造成併發限制）
            await run_lesson_generation_job(
                job_id=job_id,
                user_id=user_id,
                course_id=course_id,
                topic=topic,
                node_data=node_schema.model_dump(),
                course_folder_name=course.folder_name,
                profile_summary=profile_context,
            )

        logger.info(f"[AutoGenerate] Sequential lesson generation completed for course {course_id}.")
    except Exception as e:
        logger.exception(f"[AutoGenerate] Exception occurred during auto lesson generation: {e}")
    finally:
        db.close()
