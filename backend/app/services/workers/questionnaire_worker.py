import logging
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.services.ai_agents.questionnaire_agent import QuestionnaireAgent
from app.services.commons.activity_logger import ActivityLogger
from app.services.llm_clients.factory import LLMFactory
from app.services.knowledge_base.rag_engine import RAGEngine
from app.core.config import settings
from app.services.workers.job_notifier import _notify_job_update

logger = logging.getLogger(__name__)


async def run_questionnaire_generation_job(
    job_id: str, user_id: int, project_id: int, topic: str, files_used: list
):
    """
    在背景獨立執行問卷生成的 Worker。
    """
    db = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == "CANCELLED":
            return

        _notify_job_update(db, job, 10, "準備生成個人化問卷...", status="PROCESSING")

        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        COST = settings.COST_QUESTIONNAIRE_GENERATION

        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()

        ActivityLogger.log_questionnaire_generate(
            user.id,
            user.email,
            project_id,
            project.name if project else "No Project",
            topic,
            files_used,
        )

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        agent = QuestionnaireAgent(provider, rag_engine)

        _notify_job_update(db, job, 40, "🤔 AI 正在思考最適合您的探索問題...")

        questions = await agent.generate_questions(topic, project_id=project_id)

        if not questions:
            raise Exception("未能成功生成問卷內容。")

        # 扣點數
        user.credits -= COST
        db.add(user)
        db.commit()
        ActivityLogger.log_credits_deduct(
            user.id, user.email, COST, "questionnaire_generation", user.credits
        )

        questions_list = [q.model_dump() for q in questions]

        _notify_job_update(
            db,
            job,
            100,
            "✅ 問卷準備完畢！",
            status="COMPLETED",
            result_data={"questions": questions_list},
        )

    except Exception as e:
        logger.error(f"Questionnaire generation job failed: {e}")
        _notify_job_update(
            db, job, str(job.progress), f"生成失敗: {str(e)}", status="FAILED"
        )

    finally:
        db.close()
