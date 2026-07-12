from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from fastapi.responses import JSONResponse

from app.api.dependencies import get_db, get_current_user
from app.domain.statuses import CourseStatus, JobStatus, JobType
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.models.job import JobModel
from app.schemas.course_schema import CoursePath, RefineSyllabusRequest
from app.services.infra.scheduler.workers.syllabus_worker import run_syllabus_generation_job
from app.core.config import settings
from app.services.ai_engine.workflows.syllabus_workflow import syllabus_graph
from app.services.domain.user.activity_logger import ActivityLogger
from app.services.ai_engine.agents.course_architect import AIArchitectService, get_architect_service
from app.services.domain.course.lifecycle import (
    ensure_course_can_generate_syllabus,
    mark_syllabus_started,
)
from app.services.domain.user.credits import has_sufficient_credits
from app.services.domain.user.profile_context import build_generation_profile_context

router = APIRouter()


def _sync_course_nodes(db: Session, course: CourseModel, syllabus: CoursePath):
    db.query(NodeModel).filter(NodeModel.course_id == course.id).delete()
    for unit in syllabus.units:
        for node in unit.nodes:
            db.add(
                NodeModel(
                    course_id=course.id,
                    node_id=node.id,
                    title=node.title,
                    status=node.status,
                    data=node.model_dump(exclude={"status", "title", "id"}),
                )
            )


@router.post("/generate-syllabus")
async def generate_syllabus(
    topic: str,
    background_tasks: BackgroundTasks,
    course_id: int,
    regenerate: bool = False,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    def _fetch_course():
        return (
            db.query(CourseModel)
            .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
            .first()
        )

    course = await run_in_threadpool(_fetch_course)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.syllabus_json and not regenerate and course.status == CourseStatus.READY:
        syllabus_data = course.syllabus_json if isinstance(course.syllabus_json, dict) else {}
        path = CoursePath(**syllabus_data)
        path.id = course.id
        path.topic = course.topic
        
        is_published = bool(course.is_published)
        path.isPublic = is_published
        path.isCustom = not is_published
        
        return path

    ensure_course_can_generate_syllabus(course, regenerate=regenerate)

    # 點數檢查
    COST = settings.COST_SYLLABUS_GENERATION
    if not has_sufficient_credits(current_user, COST):
        raise HTTPException(status_code=402, detail="Insufficient credits")

    course_folder_name = course.folder_name
    profile_summary = None
    if course.profile_json:
        profile_summary = course.profile_json.get("summary", "General Audience")
    profile_summary = build_generation_profile_context(
        profile_summary,
        current_user.preferred_language,
        "General Audience",
    )

    # 準備檔案上下文
    full_text_context = ""
    files = []
    if course_folder_name:
        from app.services.infra.files.service import FileService

        file_service = FileService()
        files = file_service.list_files(current_user.id, course_folder_name)

        for fname in files:
            if fname.startswith("."):
                continue
            fpath = str(
                file_service.get_upload_dir(current_user.id, course_folder_name) / fname
            )
            content = file_service.read_file_content(
                fpath, max_chars=settings.MAX_COURSE_CONTEXT_BYTES
            )
            if content:
                full_text_context += f"\\n--- Document: {fname} ---\\n{content}\\n"

    # Check for existing active job to prevent duplication
    existing_job = (
        db.query(JobModel)
        .filter(
            JobModel.course_id == course_id,
            JobModel.job_type == JobType.SYLLABUS_GENERATION,
            JobModel.status.in_([JobStatus.PENDING, JobStatus.PROCESSING]),
        )
        .first()
    )
    if existing_job:
        return JSONResponse(
            status_code=202,
            content={"job_id": existing_job.id, "status": existing_job.status},
        )

    # 建立 PENDING 狀態的 Job
    new_job = JobModel(
        user_id=current_user.id,
        course_id=course.id,
        job_type=JobType.SYLLABUS_GENERATION,
        status=JobStatus.PENDING,
        message="正在排隊準備生成大綱...",
        result_data={
            "course_id": course.id,
            "topic": topic,
        },
    )
    db.add(new_job)
    mark_syllabus_started(course)
    db.commit()
    db.refresh(new_job)

    # 發送到背景執行
    background_tasks.add_task(
        run_syllabus_generation_job,
        job_id=new_job.id,
        user_id=current_user.id,
        course_id=course.id,
        topic=topic,
        course_folder_name=course_folder_name,
        profile_summary=profile_summary,
        full_text_context=full_text_context,
        files_used=files,
        regenerate=regenerate,
    )

    # 立刻回傳 202 Accepted 給前端
    return JSONResponse(
        status_code=202, content={"job_id": new_job.id, "status": JobStatus.PENDING}
    )


@router.post("/refine-syllabus", response_model=CoursePath)
async def refine_syllabus_endpoint(
    request: RefineSyllabusRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    architect_service: AIArchitectService = Depends(get_architect_service),
):
    course_folder_name = None
    course = None
    is_admin = False
    learner_profile_summary = build_generation_profile_context(
        None,
        current_user.preferred_language,
        "General Audience",
    )
    if request.courseId:
        from app.services.domain.user.service import UserService
        is_admin = UserService.is_admin(current_user)
        
        def _fetch_refine_course():
            query = db.query(CourseModel).filter(CourseModel.id == request.courseId)
            if not is_admin:
                query = query.filter(CourseModel.user_id == current_user.id)
            return query.first()

        course = await run_in_threadpool(_fetch_refine_course)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        if course.is_published and not is_admin:
            raise HTTPException(status_code=403, detail="Published courses are immutable and cannot be refined.")

        course_folder_name = course.folder_name
        learner_profile_summary = build_generation_profile_context(
            course.profile_json.get("summary")
            if isinstance(course.profile_json, dict)
            else None,
            current_user.preferred_language,
            "General Audience",
        )

    result = await syllabus_graph.ainvoke(
        {
            "topic": request.topic,
            "syllabus": request.currentSyllabus,
            "user_feedback": request.userFeedback,
            "history": request.history,
            "user_id": current_user.id,
            "course_folder": course_folder_name,
            "learner_profile_summary": learner_profile_summary,
            "architect_service": architect_service,
        }
    )

    if not result.get("syllabus"):
        raise HTTPException(
            status_code=500, detail="Refinement returned empty syllabus"
        )

    # 紀錄大綱修正事件
    ActivityLogger.log_syllabus_refine(
        current_user.id,
        current_user.email,
        request.courseId or 0,
        course.title if course else "Untitled Course",
        request.topic,
        request.userFeedback,
    )

    refined_syllabus = result["syllabus"]
    is_published = bool(course.is_published) if course else False
    refined_syllabus.isPublic = is_published
    refined_syllabus.isCustom = not is_published

    def _persist_refined_syllabus():
        course_id = request.currentSyllabus.id
        if not course_id:
            return

        query = db.query(CourseModel).filter(CourseModel.id == course_id)
        if not is_admin:
            query = query.filter(CourseModel.user_id == current_user.id)
        target_course = query.first()
        if not target_course:
            return

        target_course.title = refined_syllabus.courseTitle
        if refined_syllabus.topic:
            target_course.topic = refined_syllabus.topic
        target_course.syllabus_json = refined_syllabus.model_dump()
        flag_modified(target_course, "syllabus_json")
        _sync_course_nodes(db, target_course, refined_syllabus)
        db.commit()

    await run_in_threadpool(_persist_refined_syllabus)

    return refined_syllabus
