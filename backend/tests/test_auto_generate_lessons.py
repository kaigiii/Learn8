import pytest
from unittest.mock import patch, AsyncMock
from app.models.course import CourseModel, NodeModel
from app.models.user import UserModel
from app.models.lesson import LessonModel
from app.models.job import JobModel
from app.domain.statuses import JobType, JobStatus
from app.services.infra.scheduler.workers.syllabus_worker import auto_generate_course_lessons

def _create_course_with_nodes(db_session, user_id: int) -> CourseModel:
    course = CourseModel(
        user_id=user_id,
        topic="FastAPI",
        title="FastAPI Course",
        status="ready",
        syllabus_json={"units": []},
    )
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)

    node1 = NodeModel(
        course_id=course.id,
        node_id="node-1",
        title="Introduction to FastAPI",
        status="available",
        data={"description": "FastAPI intro"},
    )
    node2 = NodeModel(
        course_id=course.id,
        node_id="node-2",
        title="Advanced FastAPI",
        status="locked",
        data={"description": "Advanced topics"},
    )
    db_session.add_all([node1, node2])
    db_session.commit()
    return course

@pytest.mark.anyio
async def test_auto_generate_course_lessons_success(db_session, user):
    course = _create_course_with_nodes(db_session, user.id)

    # Mock run_lesson_generation_job
    with patch("app.services.infra.scheduler.workers.lesson_worker.run_lesson_generation_job", new_callable=AsyncMock) as mock_run_job:
        with patch("app.services.infra.scheduler.workers.syllabus_worker.SessionLocal", return_value=db_session):
            await auto_generate_course_lessons(course_id=course.id, user_id=user.id)

            # Check that mock_run_job was called twice (once for each node)
            assert mock_run_job.call_count == 2

            # Check that job records were created in db
            jobs = db_session.query(JobModel).filter(
                JobModel.course_id == course.id,
                JobModel.job_type == JobType.LESSON_GENERATION
            ).all()
            assert len(jobs) == 2
            for job in jobs:
                assert job.status == JobStatus.PENDING

@pytest.mark.anyio
async def test_auto_generate_course_lessons_insufficient_credits(db_session, user):
    # Set user credits to 0
    user.credits = 0
    db_session.commit()
    course = _create_course_with_nodes(db_session, user.id)

    with patch("app.services.infra.scheduler.workers.lesson_worker.run_lesson_generation_job", new_callable=AsyncMock) as mock_run_job:
        with patch("app.services.infra.scheduler.workers.syllabus_worker.SessionLocal", return_value=db_session):
            await auto_generate_course_lessons(course_id=course.id, user_id=user.id)

            # Because credits are insufficient, no job should be triggered
            assert mock_run_job.call_count == 0

@pytest.mark.anyio
async def test_auto_generate_course_lessons_skips_existing(db_session, user):
    course = _create_course_with_nodes(db_session, user.id)

    # Add an existing lesson for node-1 to test that it gets skipped
    existing_lesson = LessonModel(
        user_id=user.id,
        course_id=course.id,
        node_id="node-1",
        course_topic="FastAPI",
        status="generated",
        schema_version=2,
    )
    db_session.add(existing_lesson)
    db_session.commit()

    with patch("app.services.infra.scheduler.workers.lesson_worker.run_lesson_generation_job", new_callable=AsyncMock) as mock_run_job:
        with patch("app.services.infra.scheduler.workers.syllabus_worker.SessionLocal", return_value=db_session):
            await auto_generate_course_lessons(course_id=course.id, user_id=user.id)

            # Only node-2 should be generated, node-1 should be skipped
            assert mock_run_job.call_count == 1
            # Check the generated job is indeed node-2
            calls = mock_run_job.call_args_list
            kwargs = calls[0][1]
            assert kwargs["node_data"]["id"] == "node-2"
