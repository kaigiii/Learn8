from app.db.session import SessionLocal
from app.db import registry
from app.services.arena.admin_service import AdminService
import json

def test():
    db = SessionLocal()
    svc = AdminService()
    # public_course_id 6 is Python Fundamentals
    qs = svc.extract_questions_from_syllabus(db, 6)
    
    counts = {}
    for q in qs:
        t = q['questionType']
        counts[t] = counts.get(t, 0) + 1
        
    print(f"Total extracted: {len(qs)}")
    print("Counts by type:")
    for k, v in counts.items():
        print(f"  {k}: {v}")
        
    if qs:
        print("\nSample question:")
        print(json.dumps(qs[0], indent=2))

if __name__ == "__main__":
    test()
