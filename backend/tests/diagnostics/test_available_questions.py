import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.user import UserModel
from app.models.public_course import PublicCourseModel

def test_route():
    # This integration test uses the real SessionLocal
    db = SessionLocal()
    try:
        # Ensure a test user exists in the CI database
        # IMPORTANT: The token 'sub' claim expects the EMAIL for get_current_user
        email = "test-admin@learn8.ai"
        user = db.query(UserModel).filter(UserModel.email == email).first()
        if not user:
            user = UserModel(
                email=email,
                full_name="Test Admin",
                hashed_password="!no-login",
                credits=1000,
                xp=0,
                level=1,
                xp_to_next_level=100
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Fix: Pass EMAIL as the subject for the token
        token = create_access_token(user.email)
        
        # Ensure at least one public course exists (seeded in conftest.py)
        course = db.query(PublicCourseModel).first()
        if not course:
            pytest.skip("No public courses found. Skipping integration test.")

        client = TestClient(app)
        response = client.get(
            f"/api/v1/arena/admin/public-courses/{course.id}/available-questions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # We expect 200 if the course was correctly seeded
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            # Check for a sample field from ArenaAdminSyllabusQuestionResponse
            # Schema uses 'questionKey', not 'questionId'
            assert "questionKey" in data[0]
    finally:
        db.close()
