from app.db.session import SessionLocal
from app.models.lesson import LessonModel, LessonStageModel
from app.models.public_course import PublicCourseModel
from sqlalchemy import func

db = SessionLocal()
try:
    public_courses = db.query(PublicCourseModel).all()
    for pc in public_courses:
        print(f"\nCourse: {pc.title} (ID: {pc.id})")
        
        # Check if there are any lessons for this course ID
        # Note: LessonModel.course_id might refer to CourseModel.id, 
        # but PublicCourseModel might be different. Let's check cross-ref.
        lesson_count = db.query(LessonModel).filter(LessonModel.course_id == pc.id).count()
        print(f"Associated lessons count: {lesson_count}")
        
        if lesson_count > 0:
            stages = (
                db.query(LessonStageModel.component, func.count(LessonStageModel.id))
                .join(LessonModel)
                .filter(LessonModel.course_id == pc.id)
                .group_by(LessonStageModel.component)
                .all()
            )
            print("Stage components found:")
            for comp, count in stages:
                print(f"  - {comp}: {count}")
finally:
    db.close()
