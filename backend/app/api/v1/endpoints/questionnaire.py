"""
模組名稱: app.api.v1.endpoints.questionnaire
功能描述: 學習者問卷 API (Learner Questionnaire Endpoints)

處理問卷的生成與提交，用於收集學習者偏好並生成個人化學習檔案。

路由列表:
    1. POST /{project_id}/questionnaire - 生成問卷問題
    2. POST /{project_id}/questionnaire/submit - 提交問卷並生成學習者檔案
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.schemas.questionnaire import Question, QuestionnaireSubmission, LearnerProfile, QuestionnaireSubmitRequest
from app.services.llm.agents.questionnaire_agent import QuestionnaireAgent
from app.services.activity_logger import ActivityLogger
from app.services.file_service import FileService

router = APIRouter()


@router.post("/{project_id}/questionnaire", response_model=List[Question])
async def generate_project_questionnaire(
    project_id: int,
    topic: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify project ownership
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Credit Check
    COST = 5
    if current_user.credits < COST:
        raise HTTPException(status_code=402, detail=f"Insufficient credits. Need {COST}.")

    # Get files for logging context
    files_used = FileService.list_files(current_user.id, project.folder_name)
    
    ActivityLogger.log_questionnaire_generate(
        current_user.id, current_user.email, project_id, project.name,
        topic, files_used
    )
    
    questions = await QuestionnaireAgent.generate_questions(topic, project_id=project_id)

    if questions:
        current_user.credits -= COST
        db.add(current_user)
        db.commit()
        ActivityLogger.log_credits_deduct(current_user.id, current_user.email, COST, "questionnaire_generation", current_user.credits)

    return questions


@router.post("/{project_id}/questionnaire/submit", response_model=LearnerProfile)
async def submit_project_questionnaire(
    project_id: int,
    request: QuestionnaireSubmitRequest,  # Now uses body schema
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    profile = await QuestionnaireAgent.summarize_responses(
        request.topic, 
        request.submission, 
        request.questions
    )

    # Save to DB
    project.profile_json = profile.model_dump()
    flag_modified(project, "profile_json")
    db.commit()
    
    # Enhanced Log: Include full profile details
    profile_details = (
        f"Summary: {profile.summary[:200]}... | "
        f"Style: {profile.learning_style or 'N/A'} | "
        f"Level: {profile.experience_level or 'N/A'} | "
        f"Goals: {', '.join(profile.goals[:3]) if profile.goals else 'N/A'}"
    )
    ActivityLogger.log_questionnaire_submit(
        current_user.id, current_user.email, project_id, project.name,
        request.topic, profile_details
    )

    return profile
