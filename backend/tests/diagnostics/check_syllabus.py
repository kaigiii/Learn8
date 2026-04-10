from app.db.session import SessionLocal
from app.models.public_course import PublicCourseModel
import json

db = SessionLocal()
try:
    courses = db.query(PublicCourseModel).all()
    print(f"Found {len(courses)} courses")
    for c in courses:
        print(f"\nCourse: {c.title}")
        syllabus = c.syllabus_json
        if syllabus:
            units = syllabus.get('units', [])
            print(f"Units count: {len(units)}")
            if units:
                nodes = units[0].get('nodes', [])
                print(f"Nodes in first unit: {len(nodes)}")
        
        metadata = c.metadata_json
        if metadata:
            arena_qs = metadata.get('arena_questions', [])
            print(f"Arena Questions in metadata: {len(arena_qs)}")
        else:
            print("No metadata_json")
finally:
    db.close()
