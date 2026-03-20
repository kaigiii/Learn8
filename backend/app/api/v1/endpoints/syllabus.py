from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse

from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.course import CourseModel
from app.models.project import ProjectModel
from app.models.job import JobModel
from app.schemas.course_schema import CoursePath, RefineSyllabusRequest
from app.services.workers.syllabus_worker import run_syllabus_generation_job
from app.core.config import settings
from app.services.workflows.syllabus_workflow import syllabus_graph
from app.services.commons.activity_logger import ActivityLogger
from app.services.ai_agents.course_architect import AIArchitectService, get_architect_service

router = APIRouter()


@router.post("/generate-syllabus")
async def generate_syllabus(
    topic: str,
    background_tasks: BackgroundTasks,
    project_id: int = None,
    regenerate: bool = False,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    def _fetch_existing():
        query = db.query(CourseModel).filter(CourseModel.user_id == current_user.id)
        if project_id:
            # Product rule: one project owns exactly one course journey.
            return (
                query.filter(CourseModel.project_id == project_id)
                .order_by(CourseModel.updated_at.desc())
                .first()
            )

        return (
            query.filter(CourseModel.topic == topic)
            .order_by(CourseModel.updated_at.desc())
            .first()
        )

    existing_course = await run_in_threadpool(_fetch_existing)

    should_return_cached = existing_course is not None and not regenerate

    if should_return_cached:
        path = CoursePath(**existing_course.syllabus_json)
        path.id = existing_course.id
        path.topic = existing_course.topic
        return path

    # 點數檢查
    COST = settings.COST_SYLLABUS_GENERATION
    if current_user.credits < COST:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    project_folder_name = None
    profile_summary = None
    db_project = None
    if project_id:

        def _fetch_project():
            return (
                db.query(ProjectModel)
                .filter(
                    ProjectModel.id == project_id,
                    ProjectModel.user_id == current_user.id,
                )
                .first()
            )

        db_project = await run_in_threadpool(_fetch_project)
        if db_project:
            project_folder_name = db_project.folder_name
            if db_project.profile_json:
                profile_summary = db_project.profile_json.get(
                    "summary", "General Audience"
                )

    # 準備檔案上下文
    full_text_context = ""
    files = []
    if project_id and project_folder_name:
        from app.services.commons.file_service import FileService

        file_service = FileService()
        files = file_service.list_files(current_user.id, project_folder_name)

        for fname in files:
            if fname.startswith("."):
                continue
            fpath = (
                file_service.get_upload_dir(current_user.id, project_folder_name)
                + "/"
                + fname
            )
            content = file_service.read_file_content(
                fpath, max_chars=settings.MAX_COURSE_CONTEXT_BYTES
            )
            if content:
                full_text_context += f"\\n--- Document: {fname} ---\\n{content}\\n"

    # 建立 PENDING 狀態的 Job
    new_job = JobModel(
        user_id=current_user.id,
        project_id=project_id,
        job_type="SYLLABUS_GEN",
        status="PENDING",
        message="正在排隊準備生成大綱...",
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # 發送到背景執行
    background_tasks.add_task(
        run_syllabus_generation_job,
        job_id=new_job.id,
        user_id=current_user.id,
        project_id=project_id,
        topic=topic,
        project_folder_name=project_folder_name,
        profile_summary=profile_summary,
        full_text_context=full_text_context,
        files_used=files,
        regenerate=regenerate,
        existing_course_id=existing_course.id if existing_course else None,
    )

    # 立刻回傳 202 Accepted 給前端
    return JSONResponse(
        status_code=202, content={"job_id": new_job.id, "status": "PENDING"}
    )


@router.post("/refine-syllabus", response_model=CoursePath)
async def refine_syllabus_endpoint(
    request: RefineSyllabusRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    architect_service: AIArchitectService = Depends(get_architect_service),
):
    project_folder_name = None
    db_project = None
    if request.projectId:

        def _fetch_refine_project():
            return (
                db.query(ProjectModel)
                .filter(
                    ProjectModel.id == request.projectId,
                    ProjectModel.user_id == current_user.id,
                )
                .first()
            )

        db_project = await run_in_threadpool(_fetch_refine_project)
        if db_project:
            project_folder_name = db_project.folder_name

    result = await syllabus_graph.ainvoke(
        {
            "topic": request.topic,
            "syllabus": request.currentSyllabus,
            "user_feedback": request.userFeedback,
            "history": request.history,
            "user_id": current_user.id,
            "project_folder": project_folder_name,
            "architect_service": architect_service,
        }
    )

    if not result.get("syllabus"):
        raise HTTPException(
            status_code=500, detail="Refinement returned empty syllabus"
        )

    # 紀錄大綱修正事件
    project_name = db_project.name if request.projectId and db_project else "No Project"
    ActivityLogger.log_syllabus_refine(
        current_user.id,
        current_user.email,
        request.projectId or 0,
        project_name,
        request.topic,
        request.userFeedback,
    )

    return result["syllabus"]
