import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.models.course import CourseModel
from app.models.user import UserModel
from app.api.dependencies import get_db, get_current_user

# Create TestClient
client = TestClient(app)

@pytest.fixture()
def local_db_session():
    # Set check_same_thread=False for multi-threaded access in TestClient
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

def test_syllabus_visibility_and_custom_states(local_db_session, local_user):
    # 1. Create a custom course (not published)
    course_draft = CourseModel(
        title="My Draft Course",
        topic="Draft Topic",
        user_id=local_user.id,
        is_published=False,
        status="ready",
        syllabus_json={
            "courseTitle": "My Draft Course",
            "topic": "Draft Topic",
            "isPublic": True,  # Seed dirty value from LLM to test if backend overrides it
            "isCustom": False,
            "units": []
        }
    )
    local_db_session.add(course_draft)
    local_db_session.commit()
    local_db_session.refresh(course_draft)

    # 2. Create a published course
    course_published = CourseModel(
        title="Published Course",
        topic="Published Topic",
        user_id=local_user.id,
        is_published=True,
        status="ready",
        syllabus_json={
            "courseTitle": "Published Course",
            "topic": "Published Topic",
            "isPublic": False,  # Seed dirty value to test if backend overrides it
            "isCustom": True,
            "units": []
        }
    )
    local_db_session.add(course_published)
    local_db_session.commit()
    local_db_session.refresh(course_published)

    # Dependency Overrides
    app.dependency_overrides[get_db] = lambda: local_db_session
    app.dependency_overrides[get_current_user] = lambda: local_user

    try:
        # Check draft course path mapping
        response = client.get(f"/api/v1/courses/{course_draft.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["isPublic"] is False
        assert data["isCustom"] is True

        # Check published course path mapping
        response = client.get(f"/api/v1/courses/{course_published.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["isPublic"] is True
        assert data["isCustom"] is False

    finally:
        app.dependency_overrides.clear()


def test_refine_syllabus_rules_and_admin_bypass(local_db_session, local_user):
    # 1. Create a published course
    course_published = CourseModel(
        title="Published Course",
        topic="Published Topic",
        user_id=local_user.id,
        is_published=True,
        status="ready",
        syllabus_json={
            "courseTitle": "Published Course",
            "topic": "Published Topic",
            "units": []
        }
    )
    local_db_session.add(course_published)
    local_db_session.commit()
    local_db_session.refresh(course_published)

    # 2. Define a standard user (non-admin)
    app.dependency_overrides[get_db] = lambda: local_db_session
    app.dependency_overrides[get_current_user] = lambda: local_user

    try:
        # Normal user trying to refine published course should get 403
        refine_payload = {
            "topic": "Published Topic",
            "currentSyllabus": {
                "id": course_published.id,
                "courseTitle": "Published Course",
                "units": []
            },
            "userFeedback": "Make it harder",
            "courseId": course_published.id
        }
        response = client.post("/api/v1/courses/refine-syllabus", json=refine_payload)
        assert response.status_code == 403
        assert "immutable" in response.json()["detail"] or "immutable" in response.json()["detail"].lower()

        # 3. Define an admin user (email matches admin emails in config)
        admin_user = UserModel(
            email="dev@learn8.ai",  # dev@learn8.ai is default dev admin
            hashed_password="hashed",
            credits=100,
        )
        local_db_session.add(admin_user)
        local_db_session.commit()
        local_db_session.refresh(admin_user)

        app.dependency_overrides[get_current_user] = lambda: admin_user

        # Admin user trying to refine should bypass the 403 check
        # We patch `syllabus_graph.ainvoke` to mock LLM execution
        from unittest.mock import patch, AsyncMock
        with patch("app.api.v1.endpoints.syllabus.syllabus_graph.ainvoke", new_callable=AsyncMock) as mock_invoke:
            from app.schemas.course_schema import CoursePath
            mock_invoke.return_value = {
                "syllabus": CoursePath(
                    id=course_published.id,
                    courseTitle="Refined Published Course",
                    units=[]
                )
            }
            response = client.post("/api/v1/courses/refine-syllabus", json=refine_payload)
            assert response.status_code == 200
            assert response.json()["courseTitle"] == "Refined Published Course"

    finally:
        app.dependency_overrides.clear()
