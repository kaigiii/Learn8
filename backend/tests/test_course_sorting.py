import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.models.course import CourseModel
from app.models.user import UserModel
from app.api.dependencies import get_db, get_current_user
from app.api.v1.endpoints.lessons import _touch_course_updated_at

client = TestClient(app)


@pytest.fixture()
def local_db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def local_user(local_db_session):
    db_user = UserModel(
        email="test@learn8.ai",
        hashed_password="hashed",
        credits=100,
        xp=0,
        level=1,
        xp_to_next_level=100,
    )
    local_db_session.add(db_user)
    local_db_session.commit()
    local_db_session.refresh(db_user)
    return db_user


def test_courses_api_returns_updated_at(local_db_session, local_user):
    # Create a course
    course = CourseModel(
        title="Test Course 1",
        topic="Topic 1",
        user_id=local_user.id,
        status="ready",
    )
    local_db_session.add(course)
    local_db_session.commit()
    local_db_session.refresh(course)

    # Override dependencies
    app.dependency_overrides[get_db] = lambda: local_db_session
    app.dependency_overrides[get_current_user] = lambda: local_user

    try:
        response = client.get("/api/v1/courses")
        assert response.status_code == 200
        courses = response.json()
        assert len(courses) == 1
        assert "updated_at" in courses[0]
        assert courses[0]["updated_at"] is not None
    finally:
        app.dependency_overrides.clear()


def test_touch_course_updated_at_helper(local_db_session, local_user):
    # Create a course with older updated_at
    past_time = datetime.now(timezone.utc) - timedelta(hours=1)
    course = CourseModel(
        title="Test Course 2",
        topic="Topic 2",
        user_id=local_user.id,
        status="ready",
        updated_at=past_time,
    )
    local_db_session.add(course)
    local_db_session.commit()
    local_db_session.refresh(course)

    original_updated_at = course.updated_at

    # Call helper to touch/update updated_at
    _touch_course_updated_at(local_db_session, course.id, local_user.id)
    local_db_session.commit()
    local_db_session.refresh(course)

    # Verify that updated_at was indeed updated (newer than original_updated_at)
    assert course.updated_at > original_updated_at
