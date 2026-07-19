import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app as fastapi_app
from app.db.base import Base
from app.models.course import CourseModel
from app.models.user import UserModel
from app.api.dependencies import get_db, get_current_user
import app.db.registry

client = TestClient(fastapi_app)

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

@pytest.fixture()
def other_user(local_db_session):
    db_user = UserModel(
        email="other@learn8.ai",
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

def test_course_export_data_and_template(local_db_session, local_user, other_user):
    # 1. Create a course owned by local_user
    course = CourseModel(
        title="Python Course",
        topic="Python",
        user_id=local_user.id,
        is_published=False,
        status="ready",
        syllabus_json={
            "courseTitle": "Python Course",
            "units": [
                {
                    "unitId": "u1",
                    "unitTitle": "Unit 1",
                    "nodes": [
                        {"id": "n1", "title": "Node 1", "description": "Desc"}
                    ]
                }
            ]
        }
    )
    local_db_session.add(course)
    
    # 2. Create another user's course to test unauthorized access
    other_course = CourseModel(
        title="Private Course",
        topic="Private",
        user_id=other_user.id,
        is_published=False,
        status="ready",
        syllabus_json={
            "courseTitle": "Private Course",
            "units": []
        }
    )
    local_db_session.add(other_course)
    local_db_session.commit()

    # Setup overrides
    fastapi_app.dependency_overrides[get_db] = lambda: local_db_session
    fastapi_app.dependency_overrides[get_current_user] = lambda: local_user

    try:
        # Test 1: Fetch template for owned course
        response = client.get(f"/api/v1/courses/{course.id}/export-template")
        assert response.status_code == 200
        assert "template" in response.json()
        assert "Offline Course" in response.json()["template"] or "離線學習" in response.json()["template"]

        # Test 2: Fetch data for owned course
        response = client.get(f"/api/v1/courses/{course.id}/export-data")
        assert response.status_code == 200
        data = response.json()
        assert data["courseTitle"] == "Python Course"
        assert len(data["units"]) == 1
        assert data["units"][0]["unitTitle"] == "Unit 1"
        assert len(data["units"][0]["nodes"]) == 1
        assert data["units"][0]["nodes"][0]["title"] == "Node 1"

        # Test 3: Unauthorized export-data access to other's private course (should fail with 403)
        response = client.get(f"/api/v1/courses/{other_course.id}/export-data")
        assert response.status_code == 403

        # Test 4: Exporting non-existent course (should fail with 404)
        response = client.get(f"/api/v1/courses/99999/export-data")
        assert response.status_code == 404

    finally:
        fastapi_app.dependency_overrides.clear()
