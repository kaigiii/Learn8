from pathlib import Path
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.course import CourseModel
from app.models.lesson import LessonModel, LessonStageModel
from app.models.user import UserModel

class ExportService:
    @staticmethod
    def _normalize_stage_snapshot(snapshot: dict) -> dict:
        if not isinstance(snapshot, dict):
            return snapshot
        if snapshot.get("component") != "MultipleChoice":
            return snapshot

        config = snapshot.get("config") if isinstance(snapshot.get("config"), dict) else {}
        data = config.get("data") if isinstance(config.get("data"), dict) else {}
        if "correctOptionId" not in data:
            fallback = data.get("correctId") or data.get("correctAnswer")
            if fallback is not None:
                data["correctOptionId"] = fallback
                config["data"] = data
                snapshot["config"] = config
        return snapshot

    @staticmethod
    def get_node_stages(db: Session, course_id: int, node_id: str, user_id: int) -> list[dict]:
        # 1. 優先使用使用者自己生成並進行過的課程 Lesson
        lesson = (
            db.query(LessonModel)
            .filter(
                LessonModel.course_id == course_id,
                LessonModel.node_id == node_id,
                LessonModel.user_id == user_id,
            )
            .order_by(LessonModel.created_at.desc())
            .first()
        )
        
        # 2. 如果沒有，使用系統預設 public 使用者生成的 Lesson
        system_user = db.query(UserModel).filter(UserModel.email == "public@learn8.system").first()
        if not lesson and system_user:
            lesson = (
                db.query(LessonModel)
                .filter(
                    LessonModel.course_id == course_id,
                    LessonModel.node_id == node_id,
                    LessonModel.user_id == system_user.id,
                )
                .order_by(LessonModel.created_at.desc())
                .first()
            )
            
        # 3. 備用方案：透過主題 (topic) 來尋找系統使用者的 Lesson
        if not lesson and system_user:
            course = db.get(CourseModel, course_id)
            if course:
                lesson = (
                    db.query(LessonModel)
                    .filter(
                        LessonModel.course_topic == course.topic,
                        LessonModel.node_id == node_id,
                        LessonModel.user_id == system_user.id,
                    )
                    .order_by(LessonModel.created_at.desc())
                    .first()
                )

        if not lesson:
            return []

        stages = (
            db.query(LessonStageModel)
            .filter(LessonStageModel.lesson_id == lesson.id)
            .order_by(LessonStageModel.stage_order.asc())
            .all()
        )

        return [
            ExportService._normalize_stage_snapshot(s.stage_snapshot_json)
            for s in stages
            if isinstance(s.stage_snapshot_json, dict)
        ]

    @staticmethod
    def get_export_data(db: Session, course_id: int, user_id: int) -> dict:
        course = db.get(CourseModel, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        syllabus = course.syllabus_json or {}
        units = []

        for u in syllabus.get("units", []):
            unit_nodes = []
            for n in u.get("nodes", []):
                node_id = n.get("id") or n.get("nodeId")
                stages = ExportService.get_node_stages(db, course.id, node_id, user_id)
                unit_nodes.append({
                    "id": node_id,
                    "title": n.get("title", "Untitled Lesson"),
                    "description": n.get("description", ""),
                    "status": n.get("status", "locked"),
                    "stages": stages
                })
            units.append({
                "unitId": u.get("unitId", ""),
                "unitTitle": u.get("unitTitle", "Untitled Unit"),
                "unitDescription": u.get("unitDescription", ""),
                "nodes": unit_nodes
            })

        return {
            "courseTitle": course.title,
            "description": course.topic or "No description provided.",
            "units": units
        }

    @staticmethod
    def get_export_template() -> str:
        # 讀取 html 模板
        template_path = Path(__file__).parent.parent.parent.parent / "templates" / "offline_template.html"
        if not template_path.exists():
            template_path.parent.mkdir(parents=True, exist_ok=True)
            # 建立預設架構以防讀取失敗
            with open(template_path, "w", encoding="utf-8") as f:
                f.write("<!DOCTYPE html><html><head><meta charset='utf-8'><title>Offline Course</title><script src='https://cdn.tailwindcss.com'></script></head><body class='bg-slate-900 text-white'><div id='root'></div><script>window.process = { env: { NODE_ENV: 'production' } };</script><script>window.__COURSE_EXPORT_DATA__ = null; /* __EXPORT_DATA_PLACEHOLDER__ */;</script><script>/* __OFFLINE_PLAYER_JS__ */</script></body></html>")
        
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()

        # 讀取編譯好的 JavaScript 並嵌入
        js_path = Path(__file__).parent.parent.parent.parent / "static" / "offline_player.js"
        js_content = ""
        if js_path.exists():
            with open(js_path, "r", encoding="utf-8") as f:
                js_content = f.read()
        else:
            js_content = "console.error('Offline player JavaScript bundle not found. Please run npm run build:offline in frontend.');"
            
        template = template.replace("/* __OFFLINE_PLAYER_JS__ */", js_content)
        return template
