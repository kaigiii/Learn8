import json
from app.db.session import SessionLocal
from app.models.public_course import PublicCourseModel
from app.arena.models.arena_question_pool import ArenaQuestionPoolModel, ArenaQuestionPoolItemModel
from app.models.course import CourseModel
from app.models.lesson import LessonModel, LessonStageModel
from app.models.user import UserModel

db = SessionLocal()
try:
    print("--- Public Courses ---")
    pcs = db.query(PublicCourseModel).all()
    for pc in pcs:
        print(f"ID: {pc.id}, Title: {pc.title}, Has Syllabus: {bool(pc.syllabus_json)}")
        if pc.syllabus_json and pc.syllabus_json.get("units"):
            print(f"  First unit nodes: {len(pc.syllabus_json['units'][0].get('nodes', []))}")
            for n in pc.syllabus_json['units'][0].get('nodes', []):
                stages = n.get('stages', [])
                print(f"    Node {n.get('id')} has {len(stages)} stages")
                for s in stages:
                    print(f"      Stage type: {s.get('component')}")
    
    print("\n--- Arena Question Pools ---")
    pools = db.query(ArenaQuestionPoolModel).all()
    for pool in pools:
        print(f"Pool ID: {pool.id}, Public Course ID: {pool.public_course_id}, items: {len(pool.items)}")
        for i, item in enumerate(pool.items[:2]):
            print(f"  Item {i}: {item.component if hasattr(item, 'component') else item.question_type} - {item.prompt}")

    print("\n--- Regular Courses ---")
    courses = db.query(CourseModel).all()
    for c in courses:
        print(f"ID: {c.id}, Title: {c.title}")
        stages_count = db.query(LessonStageModel).join(LessonModel).filter(LessonModel.course_id == c.id).count()
        print(f"  Lesson stages: {stages_count}")

finally:
    db.close()
