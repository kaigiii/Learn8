import uuid
from typing import List
import os
import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.dependencies import get_db, get_current_user
from app.core.time import utc_now_naive
from app.domain.statuses import CourseStatus, JobStatus, JobType, NodeStatus
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.models.job import JobModel
from app.models.lesson import LessonModel
from app.schemas.course_schema import (
    CoursePath,
    CourseCreateRequest,
    CourseDraftRequest,
    CourseLifecycleStatus,
    CourseProfileUpdateRequest,
    CourseUpdateRequest,
    UpdateNodeStatusRequest,
)
from app.schemas.questionnaire_schema import LearnerProfile, QuestionnaireSubmitRequest
from app.services.ai_agents.questionnaire_agent import (
    QuestionnaireAgent,
    get_questionnaire_agent,
)
from app.services.commons.file_service import FileService, get_file_service
from app.services.commons.user_credits import has_sufficient_credits
from app.services.commons.course_lifecycle import (
    ensure_course_can_edit_draft,
    ensure_course_can_generate_questionnaire,
    ensure_course_can_submit_questionnaire,
    ensure_course_ready_for_learning,
    mark_questionnaire_completed,
    mark_questionnaire_started,
    sync_questionnaire_readiness_from_draft,
)
from app.services.knowledge_base.rag_engine import RAGEngine, get_rag_engine
from app.services.workers.questionnaire_worker import run_questionnaire_generation_job
from app.core.config import settings

router = APIRouter()


@router.get("", response_model=List[dict])
def get_courses(
    status: CourseLifecycleStatus | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(CourseModel).filter(CourseModel.user_id == current_user.id)
    if status:
        query = query.filter(CourseModel.status == status.value)

    # 依更新時間降序排列，預設顯示最新課程
    courses = query.order_by(CourseModel.updated_at.desc()).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "topic": c.topic,
            "status": c.status,
            "draft_json": c.draft_json,
            "folder_name": c.folder_name,
            "created_at": c.created_at,
        }
        for c in courses
    ]


@router.post("", response_model=dict)
def create_course(
    request: CourseCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_topic = request.topic or request.title
    course = CourseModel(
        user_id=current_user.id,
        title=request.title.strip(),
        topic=resolved_topic.strip(),
        status=request.status.value,
        folder_name=str(uuid.uuid4()),
        draft_json={"topic": resolved_topic.strip()},
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    return {
        "id": course.id,
        "title": course.title,
        "topic": course.topic,
        "status": course.status,
        "draft_json": course.draft_json,
        "folder_name": course.folder_name,
        "created_at": course.created_at,
    }


@router.get("/{course_id}", response_model=CoursePath)
def get_course_detail(
    course_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    ensure_course_ready_for_learning(course)

    if not course.syllabus_json:
        raise HTTPException(status_code=409, detail="Course syllabus is not ready yet")

    path = CoursePath(**course.syllabus_json)
    path.id = course.id
    path.topic = course.topic

    generated_node_ids = {
        row[0]
        for row in db.query(LessonModel.node_id)
        .filter(
            LessonModel.user_id == current_user.id,
            LessonModel.course_id == course.id,
        )
        .distinct()
        .all()
    }

    for unit in path.units:
        for node in unit.nodes:
            node.hasGeneratedLesson = node.id in generated_node_ids

    return path


@router.patch("/{course_id}", response_model=dict)
async def update_course(
    course_id: int,
    request: CourseUpdateRequest,
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

    syllabus_data = course.syllabus_json or {}
    syllabus_data["courseTitle"] = request.title.strip()
    course.title = request.title.strip()
    course.syllabus_json = syllabus_data
    flag_modified(course, "syllabus_json")
    course.updated_at = utc_now_naive()
    db.commit()
    db.refresh(course)

    return {
        "id": course.id,
        "courseTitle": course.title,
        "topic": course.topic,
        "status": course.status,
    }


@router.delete("/{course_id}", response_model=dict)
async def delete_course(
    course_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
    rag_engine: RAGEngine = Depends(get_rag_engine),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.folder_name:
        try:
            await rag_engine.delete_course_context(course.id)
        except Exception:
            pass
        file_service.delete_course_folder(current_user.id, course.folder_name)

    db.delete(course)
    db.commit()
    return {"status": "deleted"}


@router.get("/{course_id}/draft", response_model=dict)
async def get_course_draft(
    course_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return {"draft": course.draft_json or {}}


@router.put("/{course_id}/draft", response_model=dict)
async def save_course_draft(
    course_id: int,
    request: CourseDraftRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    ensure_course_can_edit_draft(course)

    course.draft_json = request.draft
    draft_topic = request.draft.get("topic")
    if isinstance(draft_topic, str) and draft_topic.strip():
        course.topic = draft_topic.strip()
        sync_questionnaire_readiness_from_draft(course)
    flag_modified(course, "draft_json")
    db.commit()
    return {"status": "saved"}


@router.put("/{course_id}/profile", response_model=dict)
async def save_course_profile(
    course_id: int,
    request: CourseProfileUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    ensure_course_can_submit_questionnaire(course)

    course.profile_json = request.profile
    flag_modified(course, "profile_json")
    mark_questionnaire_completed(course)
    db.commit()
    return {"status": "saved"}


@router.get("/{course_id}/files", response_model=List[str])
async def get_course_files(
    course_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.folder_name:
        return []

    return file_service.list_files(current_user.id, course.folder_name)


@router.delete("/{course_id}/files/{filename}")
async def delete_course_file(
    course_id: int,
    filename: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
    rag_engine: RAGEngine = Depends(get_rag_engine),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.folder_name:
        raise HTTPException(status_code=404, detail="Course does not have a materials folder")

    file_path = os.path.join(
        file_service.get_upload_dir(current_user.id, course.folder_name),
        filename,
    )
    if os.path.exists(file_path):
        os.remove(file_path)

    await rag_engine.delete_file_context(filename, course_id=course_id)
    return {"message": f"File {filename} deleted successfully"}


@router.post("/upload-document")
async def upload_course_document(
    file: UploadFile = File(...),
    course_id: int | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
    rag_engine: RAGEngine = Depends(get_rag_engine),
):
    if course_id is None:
        raise HTTPException(status_code=400, detail="course_id is required")

    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    ensure_course_can_edit_draft(course)
    if not course.folder_name:
        course.folder_name = str(uuid.uuid4())
        db.commit()
        db.refresh(course)

    try:
        file_service.save_upload_file(file, current_user.id, course.folder_name)
        await file.seek(0)
        await rag_engine.ingest_document(
            file,
            user_id=current_user.id,
            course_id=course_id,
            course_folder=course.folder_name,
        )
        return {"message": "File uploaded and ingested."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{course_id}/questionnaire")
async def generate_course_questionnaire(
    course_id: int,
    topic: str,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    ensure_course_can_generate_questionnaire(course)

    COST = settings.COST_QUESTIONNAIRE_GENERATION
    if not has_sufficient_credits(current_user, COST):
        raise HTTPException(
            status_code=402, detail=f"Insufficient credits. Need {COST}."
        )

    files_used = (
        file_service.list_files(current_user.id, course.folder_name)
        if course.folder_name
        else []
    )

    new_job = JobModel(
        user_id=current_user.id,
        job_type=JobType.QUESTIONNAIRE_GENERATION,
        status=JobStatus.PENDING,
        message="準備生成問卷中...",
        result_data={"course_id": course_id, "topic": topic},
    )
    db.add(new_job)
    mark_questionnaire_started(course)
    db.commit()
    db.refresh(new_job)

    background_tasks.add_task(
        run_questionnaire_generation_job,
        job_id=new_job.id,
        user_id=current_user.id,
        course_id=course_id,
        topic=topic,
        files_used=files_used,
    )

    return {"job_id": new_job.id, "status": JobStatus.PENDING}


@router.post("/{course_id}/questionnaire/submit", response_model=LearnerProfile)
async def submit_course_questionnaire(
    course_id: int,
    request: QuestionnaireSubmitRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    agent: QuestionnaireAgent = Depends(get_questionnaire_agent),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    ensure_course_can_submit_questionnaire(course)

    profile = await agent.summarize_responses(
        request.topic,
        request.submission,
        request.questions,
        preferred_language=current_user.preferred_language,
    )
    course.profile_json = profile.model_dump()
    mark_questionnaire_completed(course)
    flag_modified(course, "profile_json")
    db.commit()
    return profile


@router.patch("/{course_id}/node/{node_id}/status", response_model=CoursePath)
async def update_node_status(
    course_id: int,
    node_id: str,
    request: UpdateNodeStatusRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    def _fetch_course():
        return (
            db.query(CourseModel)
            .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
            .first()
        )

    course_record = await run_in_threadpool(_fetch_course)

    if not course_record:
        raise HTTPException(status_code=404, detail=f"Course {course_id} not found")

    ensure_course_ready_for_learning(course_record)

    syllabus_data = course_record.syllabus_json

    node_found = False
    units = syllabus_data.get("units", [])
    updates_to_sync = []

    def promote_next_node(next_node: dict) -> None:
        current_status = next_node.get("status")
        if current_status == NodeStatus.COMPLETED:
            return
        next_node["status"] = NodeStatus.AVAILABLE
        updates_to_sync.append((next_node["id"], NodeStatus.AVAILABLE))

    # 尋找目標節點並更新狀態，若狀態為 "completed" 則自動解鎖下一個節點
    for unit_idx, unit in enumerate(units):
        nodes = unit.get("nodes", [])
        for node_idx, node in enumerate(nodes):
            if node["id"] == node_id:
                node["status"] = request.status
                node_found = True
                updates_to_sync.append((node_id, request.status))

                # 若目前節點已完成，嘗試解鎖下一個學習節點
                if request.status == NodeStatus.COMPLETED:
                    if node_idx + 1 < len(nodes):
                        # 同一單元內的下一個節點
                        promote_next_node(nodes[node_idx + 1])
                    elif unit_idx + 1 < len(units):
                        # 跨單元解鎖：下個單元的第一個節點
                        next_unit = units[unit_idx + 1]
                        if next_unit.get("nodes"):
                            promote_next_node(next_unit["nodes"][0])
                break
        if node_found:
            break

    if not node_found:
        raise HTTPException(status_code=404, detail="Node not found in course")

    course_record.syllabus_json = syllabus_data
    flag_modified(course_record, "syllabus_json")

    def _update_db_nodes():
        for nid, nstatus in updates_to_sync:
            db_node = (
                db.query(NodeModel)
                .filter(
                    NodeModel.course_id == course_record.id, NodeModel.node_id == nid
                )
                .first()
            )
            if db_node:
                db_node.status = nstatus
                db_node.updated_at = utc_now_naive()

        db.commit()
        db.refresh(course_record)

    await run_in_threadpool(_update_db_nodes)

    path = CoursePath(**course_record.syllabus_json)
    path.id = course_record.id
    return path
