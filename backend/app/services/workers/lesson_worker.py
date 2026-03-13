import logging
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.models.user import UserModel
from app.services.commons.activity_logger import ActivityLogger
from app.services.llm_clients.factory import LLMFactory
from app.services.knowledge_base.rag_engine import RAGEngine
from app.core.config import settings
from app.services.workers.job_notifier import _notify_job_update

logger = logging.getLogger(__name__)


async def run_lesson_generation_job(
    job_id: str,
    user_id: int,
    project_id: int,
    topic: str,
    node_data: dict,
    project_folder_name: str,
    profile_summary: str,
):
    """
    在背景獨立執行單元課程生成的 Worker。
    """
    db = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == "CANCELLED":
            return

        _notify_job_update(db, job, 10, "準備生成單元課程內容...", status="PROCESSING")

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

        stages = await architect_service.generate_lesson_from_node(
            node,
            topic,
            user_id=user.id,
            project_folder=project_folder_name,
            profile=profile_summary,
        )

        if not stages:
            raise Exception("未能成功生成課程內容。")

        _notify_job_update(db, job, 80, "✅ 內容準備完成，正在儲存到資料庫...")

        # 寫入資料庫
        from app.models.lesson import LessonModel

        stages_json = [s.model_dump() for s in stages]
        new_lesson = LessonModel(
            node_id=node.id,
            course_topic=topic,
            stage_json=stages_json,
            user_id=user.id,
            project_id=project_id,
        )
        db.add(new_lesson)

        # 扣點數
        user.credits -= COST
        db.add(user)
        db.commit()
        ActivityLogger.log_credits_deduct(
            user.id, user.email, COST, "lesson_generation", user.credits
        )

        _notify_job_update(
            db,
            job,
            100,
            "🎉 單元建立完成！",
            status="COMPLETED",
            result_data={"stages": stages_json},
        )

    except Exception as e:
        logger.error(f"Lesson generation job failed: {e}")
        _notify_job_update(
            db, job, str(job.progress), f"生成失敗: {str(e)}", status="FAILED"
        )

    finally:
        db.close()
