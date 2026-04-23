import os
import sys
import asyncio
import json
import uuid
import argparse
from sqlalchemy.orm import Session
from sqlalchemy import text

# 確保腳本能找到 app 模組
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.models.job import JobModel
from app.models.lesson import LessonModel, LessonStageModel
from app.domain.statuses import JobStatus, CourseStatus, NodeStatus
from app.core.security import get_password_hash

# --- 設定 ---
TARGET_USER_EMAIL = "demo@gmail.com"
TOPIC = "Cardiovascular System"

# --- 完整教學數據 (15 節點) ---
FULL_NODES = [
    {"id": "heart-1-1", "title": "CVS Overview", "description": "Circulation basics.", "stages": [{"component": "ExplainerMedia", "data": {"title": "The Closed Circuit", "explanation": "The CVS is a closed circuit.", "bullets": ["Pulmonary", "Systemic"]}}, {"component": "MultipleChoice", "data": {"question": "Function of Pulmonary?", "options": [{"id": "a", "text": "Supply O2"}, {"id": "b", "text": "Eliminate CO2"}], "correctOptionId": "b"}}]},
    {"id": "heart-1-2", "title": "Heart Overview", "description": "Size and location.", "stages": []},
    {"id": "heart-1-3", "title": "External Anatomy", "description": "Base and Apex.", "stages": []},
    {"id": "heart-1-4", "title": "Pericardium", "description": "Protective sac.", "stages": []},
    {"id": "heart-1-5", "title": "Heart Wall Layers", "description": "The 3 layers.", "stages": []},
    {"id": "heart-1-6", "title": "Right Atrium", "description": "Receiving blood.", "stages": []},
    {"id": "heart-1-7", "title": "Right Ventricle", "description": "To lungs.", "stages": []},
    {"id": "heart-1-8", "title": "Left Atrium & Ventricle", "description": "To body.", "stages": []},
    {"id": "heart-1-9", "title": "Heart Valves", "description": "AV & SL valves.", "stages": []},
    {"id": "heart-1-10", "title": "Sulci & Skeleton", "description": "Grooves.", "stages": []},
    {"id": "heart-1-11", "title": "Coronary Arteries", "description": "Supply.", "stages": []},
    {"id": "heart-1-12", "title": "Coronary Veins", "description": "Drainage.", "stages": []},
    {"id": "heart-1-13", "title": "Nerve Supply", "description": "Control.", "stages": []},
    {"id": "heart-1-14", "title": "Conduction System", "description": "Electrical.", "stages": []},
    {"id": "heart-1-15", "title": "Cycle & Sounds", "description": "Lub-dub.", "stages": []}
]

COURSE_DATA = {
    "title": "Cardiovascular System",
    "topic": "Human Heart Anatomy & Physiology",
    "description": "A comprehensive deep dive into the human heart.",
    "units": [
        {"unitId": "u1", "unitTitle": "Foundations", "unitDescription": "Basics.", "nodes": FULL_NODES[0:3]},
        {"unitId": "u2", "unitTitle": "Walls", "unitDescription": "Layers.", "nodes": FULL_NODES[3:6]},
        {"unitId": "u3", "unitTitle": "Right Heart", "unitDescription": "Right side.", "nodes": FULL_NODES[6:9]},
        {"unitId": "u4", "unitTitle": "Left Heart", "unitDescription": "Left side.", "nodes": FULL_NODES[9:12]},
        {"unitId": "u5", "unitTitle": "Conduction", "unitDescription": "Electrical.", "nodes": FULL_NODES[12:15]}
    ]
}

def build_syllabus_json(cid: int, course_def: dict) -> dict:
    units = []
    node_index = 0
    for unit_def in course_def["units"]:
        nodes = []
        for node_def in unit_def["nodes"]:
            status = NodeStatus.AVAILABLE if node_index < 2 else NodeStatus.LOCKED
            nodes.append({"id": node_def["id"], "title": node_def["title"], "description": node_def.get("description", ""), "status": status, "hasGeneratedLesson": True})
            node_index += 1
        units.append({"unitId": unit_def["unitId"], "unitTitle": unit_def["unitTitle"], "unitDescription": unit_def["unitDescription"], "nodes": nodes})
    return {"id": cid, "topic": course_def["topic"], "courseTitle": course_def["title"], "description": course_def["description"], "isPublic": False, "units": units}

def notify_job(db: Session, job: JobModel, progress: int, message: str, status: str = None):
    job.progress = progress; job.message = message
    if status: job.status = status
    db.commit()
    payload = {"job_id": job.id, "status": job.status, "progress": job.progress, "message": job.message}
    db.execute(text("SELECT pg_notify('job_channel', :payload)"), {"payload": json.dumps(payload)})
    db.commit()

async def simulate_questionnaire(db: Session, user: UserModel, course: CourseModel):
    print(f"🚀 Simulating Questionnaire for Course {course.id}...")
    job = JobModel(id=str(uuid.uuid4()), user_id=user.id, job_type="QUESTIONNAIRE_GEN", status=JobStatus.PROCESSING, progress=0, message="Initializing...")
    db.add(job); db.commit()
    for p, m in [(40, "📚 分析學習目標..."), (100, "✨ 生成完畢")]:
        await asyncio.sleep(0.5); notify_job(db, job, p, m, status=JobStatus.COMPLETED if p==100 else None)
    course.draft_json = {"questions": [{"id": "q1", "type": "multiple_choice", "text": "你的專業背景？", "options": ["醫學", "一般"]}]}
    course.status = CourseStatus.QUESTIONNAIRE_READY
    db.commit()

async def simulate_syllabus(db: Session, user: UserModel, course: CourseModel):
    print(f"🚀 Simulating Syllabus for Course {course.id}...")
    job = JobModel(id=str(uuid.uuid4()), user_id=user.id, job_type="SYLLABUS_GEN", status=JobStatus.PROCESSING, progress=0, message="Architecting...")
    db.add(job); db.commit()
    notify_job(db, job, 10, "📖 正在擷取醫學文獻..."); await asyncio.sleep(0.5)
    
    curr_p = 20
    node_idx = 0
    for i, unit in enumerate(COURSE_DATA["units"]):
        notify_job(db, job, curr_p + 5, f"⏳ 正在規劃單元 {i+1}: {unit['unitTitle']}...")
        await asyncio.sleep(0.5)
        for n_data in unit["nodes"]:
            node = NodeModel(node_id=n_data["id"], course_id=course.id, title=n_data["title"], data={"description": n_data["description"]}, status=NodeStatus.AVAILABLE if node_idx < 2 else NodeStatus.LOCKED)
            db.add(node); db.flush()
            lesson = LessonModel(user_id=user.id, course_id=course.id, node_id=node.node_id, course_topic=TOPIC, status="generated", stage_count=len(n_data["stages"]), estimated_duration_minutes=2, schema_version=2)
            db.add(lesson); db.flush()
            for idx, s_data in enumerate(n_data["stages"]):
                snapshot = {"stageId": f"s{idx}", "topic": node.title, "skin": "Scientific", "component": s_data["component"], "config": {"data": s_data["data"], "initialState": {}}, "validation": {"type": "logic", "condition": None}, "feedback": {"success": "G", "error": "E"}}
                db.add(LessonStageModel(lesson_id=lesson.id, stage_uid=snapshot["stageId"], stage_order=idx, topic=node.title, component=s_data["component"], skin="Scientific", content_json=s_data["data"], validation_json=snapshot["validation"], feedback_json=snapshot["feedback"], stage_snapshot_json=snapshot))
            node.has_generated_lesson = True; node_idx += 1
        curr_p += 15; notify_job(db, job, curr_p, f"✅ 單元 {i+1} 完稿。")
        await asyncio.sleep(0.5)

    course.syllabus_json = build_syllabus_json(course.id, COURSE_DATA)
    course.status = CourseStatus.READY
    notify_job(db, job, 100, "課程大綱已就緒！", status=JobStatus.COMPLETED)
    db.commit()
    print(f"\n🎉 ALL DONE! Ready at: http://localhost:3000/courses/{course.id}")

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=int, help="Force hijacking a specific course ID")
    args = parser.parse_query = parser.parse_args()
    
    db = SessionLocal()
    try:
        user = db.query(UserModel).filter(UserModel.email == TARGET_USER_EMAIL).first()
        if not user:
            user = UserModel(email=TARGET_USER_EMAIL, hashed_password=get_password_hash("password123"), full_name="Demo User", credits=5000)
            db.add(user); db.commit(); db.refresh(user)

        if args.id:
            course = db.query(CourseModel).filter(CourseModel.id == args.id).first()
        else:
            course = db.query(CourseModel).filter(CourseModel.user_id == user.id).order_by(CourseModel.created_at.desc()).first()
        
        if not course:
            print("❌ No course found. Please create one in the UI first!")
            return

        print(f"🎯 Hijacking Course [ID: {course.id}]")
        db.execute(text("DELETE FROM generation_jobs WHERE result_data->>'course_id' = :cid"), {"cid": str(course.id)})
        db.commit()
        await simulate_questionnaire(db, user, course)
        await simulate_syllabus(db, user, course)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
