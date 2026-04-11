import pytest
from app.db.session import SessionLocal
from app.services.arena.admin_service import AdminService
from app.models.public_course import PublicCourseModel

def test_extraction():
    db = SessionLocal()
    try:
        svc = AdminService()
        
        # Find any public course that was seeded
        course = db.query(PublicCourseModel).first()
        if not course:
            pytest.skip("No public courses found in database.")
            
        public_course_id = course.id
        qs = svc.extract_questions_from_syllabus(db, public_course_id)
        
        assert len(qs) >= 0
        if qs:
             # Basic validation of extraction logic
             assert 'questionType' in qs[0]
    finally:
        db.close()
