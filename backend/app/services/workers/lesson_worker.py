import logging
from app.core.component_loader import registry as component_registry
from app.domain.statuses import (
    JobStatus,
    LessonFailedStageStatus,
    LessonSessionPhase,
    LessonSessionStatus,
)
from app.core.time import utc_now_naive
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.models.user import UserModel
from app.services.commons.user_economy import spend_user_credits
from app.services.llm_clients.factory import LLMFactory
from app.services.knowledge_base.rag_engine import RAGEngine
from app.core.config import settings
from app.services.workers.job_notifier import _notify_job_update, _publish_job_notification

logger = logging.getLogger(__name__)


def _is_cancelled(db, job_id: str) -> bool:
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    return job is None or job.status == JobStatus.CANCELLED


async def run_lesson_generation_job(
    job_id: str,
    user_id: int,
    course_id: int | None,
    topic: str,
    node_data: dict,
    course_folder_name: str | None,
    profile_summary: str,
    allowed_components: list[str] | None = None,
):
    """
    在背景獨立執行單元課程生成的 Worker。
    """
    db = SessionLocal()
    job = None
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == JobStatus.CANCELLED:
            return

        _notify_job_update(
            db, job, 10, "準備生成單元課程內容...", status=JobStatus.PROCESSING
        )

        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        COST = settings.COST_LESSON_GENERATION

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        from app.services.commons.file_service import FileService
        from app.services.ai_agents.course_architect import AIArchitectService

        file_service = FileService()
        architect_service = AIArchitectService(provider, rag_engine, file_service)

        _notify_job_update(db, job, 30, "🧠 AI 正在為您撰寫個人化講義...")

        from app.schemas.course_schema import LessonNode

        node = LessonNode(**node_data)
        resolved_allowed_components = (
            list(allowed_components)
            if allowed_components
            else component_registry.get_component_names()
        )

        stages = await architect_service.generate_lesson_from_node(
            node,
            topic,
            user_id=user.id,
            course_folder=course_folder_name,
            profile=profile_summary,
            allowed_components=allowed_components,
        )

        if _is_cancelled(db, job_id):
            return

        if not stages:
            raise Exception("未能成功生成課程內容。")

        _notify_job_update(db, job, 80, "✅ 內容準備完成，正在儲存到資料庫...")

        # 寫入資料庫
        from app.models.lesson import LessonModel

        stages_json = [s.model_dump() for s in stages]
        generation_metadata = {
            "allowed_components": resolved_allowed_components,
            "source": "lesson_generation",
            "job_id": job_id,
            "course_id": course_id,
            "node_id": node.id,
        }
        existing_lesson_query = db.query(LessonModel).filter(
            LessonModel.node_id == node.id,
            LessonModel.course_topic == topic,
            LessonModel.user_id == user.id,
        )
        if course_id is not None:
            existing_lesson_query = existing_lesson_query.filter(
                LessonModel.course_id == course_id
            )

        existing_lesson = existing_lesson_query.order_by(LessonModel.created_at.desc()).first()

        if existing_lesson:
            existing_lesson.stage_json = stages_json
            existing_lesson.generation_metadata_json = generation_metadata
            existing_lesson.created_at = utc_now_naive()
            db.add(existing_lesson)
        else:
            new_lesson = LessonModel(
                node_id=node.id,
                course_topic=topic,
                stage_json=stages_json,
                generation_metadata_json=generation_metadata,
                user_id=user.id,
                course_id=course_id,
            )
            db.add(new_lesson)

        # 扣點數
        spend_user_credits(
            db,
            user,
            COST,
            reason="lesson_generation",
            idempotency_scope="job:lesson_generation_charge",
            idempotency_key=job_id,
            metadata={
                "source": "lesson_generation",
                "job_id": job_id,
                "course_id": course_id,
                "node_id": node.id,
            },
        )
        job.progress = 100
        job.message = "🎉 單元建立完成！"
        job.status = JobStatus.COMPLETED
        job.result_data = {
            "stages": stages_json,
            "allowed_components": resolved_allowed_components,
            "node_id": node.id,
            "course_id": course_id,
            "topic": topic,
        }
        db.commit()
        db.refresh(job)
        _publish_job_notification(db, job)

    except Exception as e:
        logger.error(f"Lesson generation job failed: {e}")
        db.rollback()
        if job is not None:
            job.progress = int(job.progress or 0)
            job.message = f"生成失敗: {str(e)}"
            job.status = JobStatus.FAILED
            db.commit()
            db.refresh(job)
            _publish_job_notification(db, job)

    finally:
        db.close()


async def run_remedial_generation_job(
    job_id: str,
    user_id: int,
    topic: str,
    node_id: str | None,
    course_id: int | None,
    failed_stages: list[dict],
    session_id: int | None = None,
    learner_profile_summary: str = "",
):
    """
    在背景獨立執行補救課程生成的 Worker。
    """
    db = SessionLocal()
    job = None
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == JobStatus.CANCELLED:
            return

        _notify_job_update(
            db, job, 10, "Analyzing failed stages...", status=JobStatus.PROCESSING
        )

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        from app.services.commons.file_service import FileService
        from app.services.ai_agents.course_architect import AIArchitectService
        from app.schemas.lesson_schema import FailedStageRecord

        file_service = FileService()
        architect_service = AIArchitectService(provider, rag_engine, file_service)

        _notify_job_update(db, job, 35, "Generating targeted remedial lesson...")

        failed_records = [FailedStageRecord(**record) for record in failed_stages]
        remedial_stages = await architect_service.generate_remedial_stages(
            failed_records,
            topic=topic or "General Concept",
            learner_profile_summary=learner_profile_summary,
        )

        if _is_cancelled(db, job_id):
            return

        if not remedial_stages:
            raise Exception("No remedial stages were generated.")

        stages_json = []
        for stage in remedial_stages:
            stage_payload = stage.model_dump()
            initial_state = (
                stage_payload.get("config", {}).get("initialState", {}) or {}
            )
            stage_payload["config"]["initialState"] = {
                **initial_state,
                "isRemedial": True,
            }
            stages_json.append(stage_payload)

        from app.models.lesson import (
            LessonFailedStageModel,
            LessonRemedialModel,
            LessonSessionModel,
        )

        remedial_record = (
            db.query(LessonRemedialModel)
            .filter(
                LessonRemedialModel.user_id == user_id,
                LessonRemedialModel.node_id == node_id,
                LessonRemedialModel.course_topic == topic,
                LessonRemedialModel.course_id == course_id,
            )
            .first()
        )
        if remedial_record:
            remedial_record.stage_json = stages_json
            remedial_record.lesson_session_id = session_id
            db.add(remedial_record)
        else:
            remedial_record = LessonRemedialModel(
                user_id=user_id,
                course_id=course_id,
                lesson_session_id=session_id,
                node_id=node_id,
                course_topic=topic,
                stage_json=stages_json,
            )
            db.add(remedial_record)

        if session_id:
            session = (
                db.query(LessonSessionModel)
                .filter(LessonSessionModel.id == session_id)
                .first()
            )
            if session:
                session.remedial_stages_json = stages_json
                session.status = LessonSessionStatus.PLAYING_REMEDIAL
                session.active_phase = LessonSessionPhase.REMEDIAL
                db.add(session)

            failed_records = (
                db.query(LessonFailedStageModel)
                .filter(
                    LessonFailedStageModel.lesson_session_id == session_id,
                    LessonFailedStageModel.status == LessonFailedStageStatus.PENDING,
                )
                .all()
            )
            for record in failed_records:
                record.status = LessonFailedStageStatus.REMEDIAL_GENERATED
                db.add(record)
        db.commit()

        _notify_job_update(
            db,
            job,
            100,
            "Remedial lesson is ready.",
            status=JobStatus.COMPLETED,
            result_data={"stages": stages_json, "session_id": session_id},
        )

    except Exception as e:
        logger.error(f"Remedial generation job failed: {e}")
        db.rollback()
        if job is not None:
            _notify_job_update(
                db,
                job,
                job.progress or 0,
                f"Remedial generation failed: {str(e)}",
                status=JobStatus.FAILED,
            )

    finally:
        db.close()
