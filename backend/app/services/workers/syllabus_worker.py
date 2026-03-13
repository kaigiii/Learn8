import logging
import datetime
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.models.course import CourseModel, NodeModel
from app.services.ai_agents.syllabus_agent import SyllabusAgent
from app.services.commons.activity_logger import ActivityLogger
from app.services.llm_clients.factory import LLMFactory
from app.services.knowledge_base.rag_engine import RAGEngine
from app.core.config import settings
from app.services.workers.job_notifier import _notify_job_update

logger = logging.getLogger(__name__)


async def run_syllabus_generation_job(
    job_id: str,
    user_id: int,
    project_id: int,
    topic: str,
    project_folder_name: str,
    profile_summary: str,
    full_text_context: str,
    files_used: list,
    regenerate: bool = False,
    existing_course_id: int = None,
):
    """
    在背景獨立執行課程大綱生成的 Worker。
    """
    db = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == "CANCELLED":
            return

        _notify_job_update(db, job, 5, "開始籌備課程藍圖...", status="PROCESSING")

        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        COST = settings.COST_SYLLABUS_GENERATION

        # 準備紀錄開始執行事件
        project_name = "No Project"
        if project_id:
            p = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
            if p:
                project_name = p.name

        ActivityLogger.log_syllabus_generate_start(
            user.id,
            user.email,
            project_id or 0,
            project_name,
            topic,
            user_prompt=None,
            rag_context_preview=full_text_context[:500] if full_text_context else None,
            questionnaire_profile=profile_summary,
            files_context=files_used if project_id else None,
        )

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        agent = SyllabusAgent(provider, rag_engine)

        def cb(prog: int | None, msg: str):
            _notify_job_update(
                db,
                job,
                prog if prog is not None else job.progress,
                msg,
                status="PROCESSING",
            )

        # 呼叫 LLM
        syllabus = await agent.run(
            topic,
            user_id=user.id,
            project_folder=project_folder_name,
            project_id=project_id,
            profile_summary=profile_summary,
            context=full_text_context,
            progress_callback=cb,
        )

        if not syllabus:
            raise Exception("LLM 未能成功產出大綱。")

        _notify_job_update(db, job, 85, "✅ 內容準備完成，正在儲存到資料庫...")

        # 儲存到 CourseDB
        if existing_course_id and regenerate:
            c_model = (
                db.query(CourseModel)
                .filter(CourseModel.id == existing_course_id)
                .first()
            )
            c_model.title = syllabus.courseTitle
            c_model.syllabus_json = syllabus.model_dump()
            c_model.updated_at = datetime.datetime.utcnow()
            db.query(NodeModel).filter(NodeModel.course_id == c_model.id).delete()
        else:
            c_model = CourseModel(
                user_id=user.id,
                project_id=project_id,
                topic=topic,
                title=syllabus.courseTitle,
                syllabus_json=syllabus.model_dump(),
            )
            db.add(c_model)

        # 扣點數 (非常重要: 成功才扣)
        user.credits -= COST
        db.add(user)
        db.commit()
        db.refresh(c_model)

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
        db.commit()

        # 紀錄完成事件
        ActivityLogger.log_syllabus_generate_complete(
            user.id,
            user.email,
            project_id or 0,
            project_name,
            topic,
            len(syllabus.units),
            sum(len(u.nodes) for u in syllabus.units),
            [u.unitTitle for u in syllabus.units],
        )
        ActivityLogger.log_credits_deduct(
            user.id, user.email, COST, "syllabus_generation", user.credits
        )

        _notify_job_update(
            db,
            job,
            100,
            "🎉 課程建立完成！",
            status="COMPLETED",
            result_data={"course_id": c_model.id, "topic": topic},
        )

    except Exception as e:
        logger.error(f"Syllabus generation job failed: {e}")
        _notify_job_update(
            db, job, str(job.progress), f"生成失敗: {str(e)}", status="FAILED"
        )

    finally:
        db.close()
