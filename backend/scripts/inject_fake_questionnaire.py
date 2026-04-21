import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import registry  # noqa: F401
from app.models.user import UserModel
from app.models.course import CourseModel
from app.domain.statuses import CourseStatus
from app.core.time import utc_now

TARGET_USER_EMAIL = "queeneye888@gmail.com"

def inject_fake_record():
    db: Session = SessionLocal()
    user = db.query(UserModel).filter(UserModel.email == TARGET_USER_EMAIL).first()
    if not user:
        print(f"User {TARGET_USER_EMAIL} not found.")
        return

    print(f"Injecting fake questionnaire record into user {user.email}'s library...")
    
    now = utc_now()
    
    topic = "Cognitive Psychology & Memory"
    
    # Define fake questionnaire data
    fake_questions = [
        {"id": "q1", "text": "你的專業背景為何？", "type": "choice", "options": ["醫學/生命科學", "資訊/工程", "商業/法律", "人文/社會科學"]},
        {"id": "q2", "text": "你偏好的學習步調？", "type": "choice", "options": ["快速概覽", "穩定進修", "深度研究"]},
        {"id": "q3", "text": "你對此主題的熟悉程度？", "type": "choice", "options": ["完全陌生", "略有耳聞", "具備基礎", "專業人士"]}
    ]
    
    fake_answers = {
        "q1": "資訊/工程",
        "q2": "快速概覽",
        "q3": "略有耳聞"
    }
    
    fake_profile = {
        "summary": "該學習者具備資訊工程背景，偏好快節奏的學習方式。目前對認知心理學處於初步探索階段，適合從資訊處理模型切入學習。",
        "learning_style": "Fast-paced, Engineering-focused",
        "experience_level": "Novice",
        "goals": ["理解記憶編碼與檢索程序", "將認知模型應用於軟體設計"],
        "attributes": {
            "background": "Software Engineer",
            "pace": "Fast"
        }
    }

    # Create the fake course (Draft In Progress / Profiling status)
    new_course = CourseModel(
        user_id=user.id,
        title=f"Course: {topic}",
        topic=topic,
        status=CourseStatus.PROFILING, # Completed questionnaire, ready for syllabus forging
        folder_name=str(uuid.uuid4()),
        profile_json=fake_profile,
        draft_json={
            "topic": topic,
            "questions": fake_questions,
            "answers": fake_answers,
            "notes": "希望能看到關於人工智慧與人類記憶對比的內容。"
        },
        syllabus_json=None,
        created_at=now,
        updated_at=now,
    )
    
    db.add(new_course)
    db.commit()
    
    print(f"Successfully injected fake questionnaire record (ID: {new_course.id}) for topic: {topic}")
    print("This will appear as 'Draft In Progress' in the library.")

if __name__ == "__main__":
    inject_fake_record()
