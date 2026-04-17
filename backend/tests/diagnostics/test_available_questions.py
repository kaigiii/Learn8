import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.arena.config import arena_settings
from app.models.public_course import PublicCourseModel

@pytest.fixture
def api_client():
    return TestClient(app)

def test_available_questions_endpoint_logic(api_client, db_session):
    # This test ensures that the diagnostics endpoint for available questions works for admins
    
    # Temporarily authorize a test email
    test_email = "test@example.com"
    original_admins = arena_settings.ARENA_ADMIN_EMAILS
    arena_settings.ARENA_ADMIN_EMAILS = test_email
    
    try:
        # We need a course in the record
        course = db_session.query(PublicCourseModel).first()
        if not course:
            from tests.test_arena_foundation import _create_public_course
            course = _create_public_course(db_session)

        # We mock the dependency to return our test email
        from app.api.dependencies import get_current_user
        from app.models.user import UserModel
        
        mock_user = UserModel(email=test_email, full_name="Test Admin")
        
        app.dependency_overrides[get_current_user] = lambda: mock_user
        
        response = api_client.get(
            f"/api/v1/arena/admin/public-courses/{course.id}/available-questions"
        )
        
        # Clean up override
        app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "prompt" in data[0]
            assert "questionKey" in data[0]
    finally:
        arena_settings.ARENA_ADMIN_EMAILS = original_admins
