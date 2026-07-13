import pytest
from unittest.mock import MagicMock, patch
import asyncio
from app.services.infra.scheduler.workers.syllabus_worker import run_syllabus_generation_job
from app.services.infra.scheduler.workers.questionnaire_worker import run_questionnaire_generation_job
from app.models.job import JobModel
from app.models.course import CourseModel

def test_syllabus_worker_resolves_absolute_paths(db_session, user):
    # 1. Create a mock job, user, and course
    course = CourseModel(
        title="Test Course",
        topic="Test Topic",
        user_id=user.id,
        folder_name="test_folder",
        syllabus_json={}
    )
    db_session.add(course)
    db_session.commit()

    job = JobModel(
        user_id=user.id,
        course_id=course.id,
        job_type="syllabus_generation",
        status="pending",
        message="Queued..."
    )
    db_session.add(job)
    db_session.commit()

    # 2. Mock LLMFactory and provider.bind_files
    mock_provider = MagicMock()
    mock_provider.bind_files = MagicMock()
    
    # Mock generation methods to avoid calling real APIs or returning empty mock schema
    async def mock_generate_structured(messages, schema, **kwargs):
        from app.schemas.course_schema import CoursePath
        return CoursePath(courseTitle="Test", units=[])
    mock_provider.generate_structured = mock_generate_structured

    # 3. Patch LLMFactory, FileService, SessionLocal, and Job Notification/Updates
    with patch("app.services.ai_engine.clients.factory.LLMFactory.create", return_value=mock_provider), \
         patch("app.services.infra.scheduler.workers.syllabus_worker.SessionLocal", return_value=db_session), \
         patch("app.services.infra.scheduler.workers.syllabus_worker._publish_job_notification"), \
         patch("app.services.infra.scheduler.workers.syllabus_worker._notify_job_update"), \
         patch("app.services.infra.files.service.FileService.list_files", return_value=["test_doc.pdf"]):
        
        try:
            asyncio.run(
                run_syllabus_generation_job(
                    job_id=job.id,
                    user_id=user.id,
                    course_id=course.id,
                    topic="Test Topic",
                    course_folder_name="test_folder",
                    profile_summary="General Audience",
                    full_text_context="",
                    files_used=["test_doc.pdf"]
                )
            )
        except Exception:
            pass

    # 4. Assert bind_files was called with absolute path
    assert mock_provider.bind_files.called
    called_args = mock_provider.bind_files.call_args[0][0]
    assert len(called_args) == 1
    file_path = called_args[0]
    assert "test_folder" in file_path
    assert "test_doc.pdf" in file_path
    assert file_path.startswith("/")

def test_questionnaire_worker_resolves_absolute_paths(db_session, user):
    course = CourseModel(
        title="Test Course",
        topic="Test Topic",
        user_id=user.id,
        folder_name="test_folder",
        syllabus_json={}
    )
    db_session.add(course)
    db_session.commit()

    job = JobModel(
        user_id=user.id,
        course_id=course.id,
        job_type="questionnaire_generation",
        status="pending",
        message="Queued..."
    )
    db_session.add(job)
    db_session.commit()

    mock_provider = MagicMock()
    mock_provider.bind_files = MagicMock()
    
    async def mock_generate_structured(messages, schema, **kwargs):
        from app.schemas.questionnaire_schema import LearnerProfile
        from app.services.ai_engine.agents.questionnaire_agent import QuestionList
        if schema == QuestionList:
            return QuestionList(questions=[])
        return LearnerProfile(summary="Mock summary", attributes={})
    mock_provider.generate_structured = mock_generate_structured

    with patch("app.services.ai_engine.clients.factory.LLMFactory.create", return_value=mock_provider), \
         patch("app.services.infra.scheduler.workers.questionnaire_worker.SessionLocal", return_value=db_session), \
         patch("app.services.infra.scheduler.workers.questionnaire_worker._publish_job_notification"), \
         patch("app.services.infra.scheduler.workers.questionnaire_worker._notify_job_update"):
        
        try:
            asyncio.run(
                run_questionnaire_generation_job(
                    job_id=job.id,
                    user_id=user.id,
                    course_id=course.id,
                    topic="Test Topic",
                    files_used=["test_doc.pdf"]
                )
            )
        except Exception:
            pass

    assert mock_provider.bind_files.called
    called_args = mock_provider.bind_files.call_args[0][0]
    assert len(called_args) == 1
    file_path = called_args[0]
    assert "test_folder" in file_path
    assert "test_doc.pdf" in file_path
    assert file_path.startswith("/")
