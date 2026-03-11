import json
import logging
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.models.course import CourseModel, NodeModel
from app.services.ai_agents.syllabus_agent import SyllabusAgent
from app.services.ai_agents.questionnaire_agent import QuestionnaireAgent
from app.services.commons.activity_logger import ActivityLogger
from app.services.llm_clients.factory import LLMFactory
from app.services.knowledge_base.rag_engine import RAGEngine
from app.core.config import settings

logger = logging.getLogger(__name__)

def _notify_job_update(db: Session, job: JobModel, progress: int, message: str, status: str = None, result_data: dict = None):
    """
    更新資料庫中的 Job 狀態，並立刻發佈 PostgreSQL NOTIFY，讓 SSE 訂閱者能秒速收到變化。
    """
    job.progress = progress
    job.message = message
    if status is not None:
        job.status = status
    if result_data is not None:
        job.result_data = result_data
        
    db.commit()
    db.refresh(job)
    
    # 準備發送給 Pub/Sub 的 Payload
    rd = job.result_data
    if isinstance(rd, str):
        try:
            rd = json.loads(rd)
        except:
            pass

    payload = {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "result_data": rd
    }
    
    # 使用 PostgreSQL LISTEN/NOTIFY
    payload_str = json.dumps(payload)
    # Notice: psycopg2 execute needs text() for raw SQL parameters
    db.execute(
        text("SELECT pg_notify('job_channel', :payload)"), 
        {"payload": payload_str}
    )
    db.commit()


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
    existing_course_id: int = None
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
        
        # Log Start
        project_name = "No Project"
        if project_id:
             p = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
             if p: project_name = p.name

        ActivityLogger.log_syllabus_generate_start(
            user.id, user.email, project_id or 0, project_name,
            topic,
            user_prompt=None,
            rag_context_preview=full_text_context[:500] if full_text_context else None,
            questionnaire_profile=profile_summary,
            files_context=files_used if project_id else None
        )

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        agent = SyllabusAgent(provider, rag_engine)

        def cb(prog: int | None, msg: str):
            _notify_job_update(db, job, prog if prog is not None else job.progress, msg, status="PROCESSING")
        
        # 呼叫 LLM
        syllabus = await agent.run(
            topic, 
            user_id=user.id, 
            project_folder=project_folder_name, 
            project_id=project_id,
            profile_summary=profile_summary,
            context=full_text_context,
            progress_callback=cb
        )
        
        if not syllabus:
             raise Exception("LLM 未能成功產出大綱。")
             
        _notify_job_update(db, job, 85, "✅ 內容準備完成，正在儲存到資料庫...")

        # 儲存到 CourseDB
        if existing_course_id and regenerate:
            c_model = db.query(CourseModel).filter(CourseModel.id == existing_course_id).first()
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
                syllabus_json=syllabus.model_dump()
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
                    data=node.model_dump(exclude={"status", "title", "id"})
                )
                db.add(db_node)
        db.commit()
        
        # Log Complete
        ActivityLogger.log_syllabus_generate_complete(
            user.id, user.email, project_id or 0, project_name,
            topic, len(syllabus.units), sum(len(u.nodes) for u in syllabus.units),
            [u.unitTitle for u in syllabus.units]
        )
        ActivityLogger.log_credits_deduct(user.id, user.email, COST, "syllabus_generation", user.credits)

        _notify_job_update(
            db, job, 100, "🎉 課程建立完成！", 
            status="COMPLETED", 
            result_data={"course_id": c_model.id, "topic": topic}
        )

    except Exception as e:
        logger.error(f"Syllabus generation job failed: {e}")
        _notify_job_update(db, job, str(job.progress), f"生成失敗: {str(e)}", status="FAILED")
        
    finally:
        db.close()


async def run_questionnaire_generation_job(
    job_id: str,
    user_id: int,
    project_id: int,
    topic: str,
    files_used: list
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
            user.id, user.email, project_id, project.name if project else "No Project",
            topic, files_used
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
        ActivityLogger.log_credits_deduct(user.id, user.email, COST, "questionnaire_generation", user.credits)

        questions_list = [q.model_dump() for q in questions]

        _notify_job_update(
            db, job, 100, "✅ 問卷準備完畢！", 
            status="COMPLETED", 
            result_data={"questions": questions_list}
        )

    except Exception as e:
        logger.error(f"Questionnaire generation job failed: {e}")
        _notify_job_update(db, job, str(job.progress), f"生成失敗: {str(e)}", status="FAILED")
    
    finally:
        db.close()


async def run_lesson_generation_job(
    job_id: str,
    user_id: int,
    project_id: int,
    topic: str,
    node_data: dict,
    project_folder_name: str,
    profile_summary: str
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
        from app.services.ai_agents.architect import AIArchitectService
        file_service = FileService()
        architect_service = AIArchitectService(provider, rag_engine, file_service)
        
        _notify_job_update(db, job, 30, "🧠 AI 正在為您撰寫個人化講義...")

        from app.schemas.course import LessonNode
        node = LessonNode(**node_data)
        
        stages = await architect_service.generate_lesson_from_node(
            node, 
            topic, 
            user_id=user.id, 
            project_folder=project_folder_name,
            profile=profile_summary
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
            project_id=project_id
        )
        db.add(new_lesson)
        
        # 扣點數
        user.credits -= COST
        db.add(user)
        db.commit()
        ActivityLogger.log_credits_deduct(user.id, user.email, COST, "lesson_generation", user.credits)

        _notify_job_update(
            db, job, 100, "🎉 單元建立完成！", 
            status="COMPLETED", 
            result_data={"stages": stages_json}
        )

    except Exception as e:
        logger.error(f"Lesson generation job failed: {e}")
        _notify_job_update(db, job, str(job.progress), f"生成失敗: {str(e)}", status="FAILED")
    
    finally:
        db.close()
