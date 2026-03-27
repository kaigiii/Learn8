from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.schemas.questionnaire_schema import (
    Question,
    QuestionnaireSubmission,
    LearnerProfile,
    QuestionnaireSubmitRequest,
)
from app.services.ai_agents.questionnaire_agent import (
    QuestionnaireAgent,
    get_questionnaire_agent,
)
from app.services.commons.activity_logger import ActivityLogger
from app.services.commons.file_service import FileService, get_file_service
from app.core.config import settings
from fastapi.concurrency import run_in_threadpool
from fastapi import BackgroundTasks
from fastapi.responses import JSONResponse
from app.models.job import JobModel
from app.services.workers.questionnaire_worker import run_questionnaire_generation_job

router = APIRouter()


@router.post("/{project_id}/questionnaire")
async def generate_project_questionnaire(
    project_id: int,
    topic: str,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_service: FileService = Depends(get_file_service),
):
    # 驗證專案所有權
    def _fetch_q_project():
        return (
            db.query(ProjectModel)
            .filter(
                ProjectModel.id == project_id, ProjectModel.user_id == current_user.id
            )
            .first()
        )

    project = await run_in_threadpool(_fetch_q_project)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Credit Check
    COST = settings.COST_QUESTIONNAIRE_GENERATION
    if current_user.credits < COST:
        raise HTTPException(
            status_code=402, detail=f"Insufficient credits. Need {COST}."
        )

    # 取得檔案列表以便後續 Logging
    files_used = file_service.list_files(current_user.id, project.folder_name)

    # 建立 PENDING 狀態的 Job
    new_job = JobModel(
        user_id=current_user.id,
        project_id=project_id,
        job_type="QUESTIONNAIRE_GEN",
        status="PENDING",
        message="準備生成問卷中...",
        result_data={"project_id": project_id, "topic": topic},
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    background_tasks.add_task(
        run_questionnaire_generation_job,
        job_id=new_job.id,
        user_id=current_user.id,
        project_id=project_id,
        topic=topic,
        files_used=files_used,
    )

    return JSONResponse(
        status_code=202, content={"job_id": new_job.id, "status": "PENDING"}
    )


@router.post("/{project_id}/questionnaire/submit", response_model=LearnerProfile)
async def submit_project_questionnaire(
    project_id: int,
    request: QuestionnaireSubmitRequest,  # Now uses body schema
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    agent: QuestionnaireAgent = Depends(get_questionnaire_agent),
):
    def _fetch_q_submit_project():
        return (
            db.query(ProjectModel)
            .filter(
                ProjectModel.id == project_id, ProjectModel.user_id == current_user.id
            )
            .first()
        )

    project = await run_in_threadpool(_fetch_q_submit_project)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    profile = await agent.summarize_responses(
        request.topic, request.submission, request.questions
    )

    # 儲存結果至資料庫
    def _update_project_profile():
        project.profile_json = profile.model_dump()
        flag_modified(project, "profile_json")
        db.commit()

    await run_in_threadpool(_update_project_profile)

    # 詳細紀錄：包含完整的學習者描述
    profile_details = (
        f"Summary: {profile.summary[:200]}... | "
        f"Style: {profile.learning_style or 'N/A'} | "
        f"Level: {profile.experience_level or 'N/A'} | "
        f"Goals: {', '.join(profile.goals[:3]) if profile.goals else 'N/A'}"
    )
    ActivityLogger.log_questionnaire_submit(
        current_user.id,
        current_user.email,
        project_id,
        project.name,
        request.topic,
        profile_details,
    )

    return profile
