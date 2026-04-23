import asyncio
import logging
from app.domain.statuses import JobStatus
from app.db.session import SessionLocal
from app.models.course import CourseModel
from app.models.job import JobModel
from app.models.user import UserModel
from app.services.ai_agents.questionnaire_agent import QuestionnaireAgent
from app.services.commons.activity_logger import ActivityLogger
from app.services.commons.user_economy import spend_user_credits
from app.services.llm_clients.factory import LLMFactory
from app.services.knowledge_base.rag_engine import RAGEngine
from app.core.config import settings
from app.services.workers.job_notifier import _notify_job_update, _publish_job_notification

logger = logging.getLogger(__name__)


def _is_cancelled(db, job_id: str) -> bool:
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    return job is None or job.status == JobStatus.CANCELLED


async def run_questionnaire_generation_job(
    job_id: str,
    user_id: int,
    topic: str,
    files_used: list,
    course_id: int | None = None,
):
    """
    在背景獨立執行問卷生成的 Worker。
    """
    db = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == JobStatus.CANCELLED:
            return

        _notify_job_update(
            db, job, 10, "準備生成個人化問卷...", status=JobStatus.PROCESSING
        )

        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        COST = settings.COST_QUESTIONNAIRE_GENERATION

        course = (
            db.query(CourseModel).filter(CourseModel.id == course_id).first()
            if course_id is not None
            else None
        )
        scope_id = course_id or 0
        scope_name = course.title if course is not None else "Untitled Course"

        ActivityLogger.log_questionnaire_generate(
            user.id,
            user.email,
            scope_id,
            scope_name,
            topic,
            files_used,
        )

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        agent = QuestionnaireAgent(provider, rag_engine)

        _notify_job_update(db, job, 20, "📚 正在掃描參考資料與上下文...")
        await asyncio.sleep(1)

        _notify_job_update(db, job, 40, "🤔 AI 正在思考最適合您的探索問題...")

        questions = await agent.generate_questions(
            topic,
            course_id=course_id,
            preferred_language=user.preferred_language,
        )

        _notify_job_update(db, job, 80, "🔍 正在優化問題描述與選項...")
        await asyncio.sleep(0.5)

        if _is_cancelled(db, job_id):
            return

        if not questions:
            raise Exception("未能成功生成問卷內容。")

        questions_list = [q.model_dump() for q in questions]

        spend_user_credits(
            db,
            user,
            COST,
            reason="questionnaire_generation",
            idempotency_scope="job:questionnaire_generation_charge",
            idempotency_key=job_id,
            metadata={
                "source": "questionnaire_generation",
                "job_id": job_id,
                "course_id": course_id,
            },
        )
        job.progress = 100
        job.message = "✅ 問卷準備完畢！"
        job.status = JobStatus.COMPLETED
        job.result_data = {"questions": questions_list}
        db.commit()
        db.refresh(job)
        _publish_job_notification(db, job)

    except Exception as e:
        logger.error(f"Questionnaire generation job failed: {e}")
        if job is not None:
            db.rollback()
            job.progress = int(job.progress or 0)
            job.message = f"生成失敗: {str(e)}"
            job.status = JobStatus.FAILED
            db.commit()
            db.refresh(job)
            _publish_job_notification(db, job)

    finally:
        db.close()
