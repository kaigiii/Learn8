import os
import uuid
from typing import Any, List, Dict, Optional
from pathlib import Path
import yaml
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.db import registry as _registry  # noqa: F401
from app.db.session import SessionLocal
from app.domain.statuses import CourseStatus, NodeStatus
from app.models.course import CourseModel, NodeModel
from app.models.lesson import LessonModel, LessonStageModel
from app.models.user import UserModel
from app.models.public_course import PublicCourseModel
from app.models.arena_question_pool import ArenaQuestionPoolModel, ArenaQuestionPoolItemModel

# 定義 public_courses 目錄的絕對或相對路徑
BASE_DIR = Path(__file__).resolve().parent.parent.parent
COURSES_DIR = BASE_DIR / "public_courses"

SYSTEM_EMAIL = "public@learn8.system"
SYSTEM_NAME = "Learn8 Public"

class PublicCourseRegistryLoader:
    def __init__(self):
        self.courses: Dict[str, Dict[str, Any]] = {}
        self._load_all()

    def _load_all(self):
        """從 public_courses 目錄中載入所有 YAML 檔案。"""
        from app.core.config import settings
        
        if not COURSES_DIR.exists():
            print(f"Warning: Public courses directory not found at {COURSES_DIR}")
            return

        enabled_courses = [c.strip() for c in settings.ENABLED_PUBLIC_COURSES.split(",") if c.strip()]

        for filename in os.listdir(COURSES_DIR):
            if filename.endswith(".yaml") or filename.endswith(".yml"):
                if enabled_courses and filename not in enabled_courses:
                    continue

                filepath = COURSES_DIR / filename
                with open(filepath, "r", encoding="utf-8") as f:
                    try:
                        data = yaml.safe_load(f)
                        if data:
                            # Store original filename for reference
                            data["_source_file"] = filename
                            # Use title or filename as key
                            self.courses[data.get("title", filename)] = data
                    except yaml.YAMLError as exc:
                        print(f"Error parsing YAML file {filepath}: {exc}")

    def sync_to_db(self, db: Session):
        """將載入的 YAML 課程同步至資料庫。"""
        if not self.courses:
            print("No public courses loaded to sync.")
            return

        print(f"Syncing {len(self.courses)} public courses to database...")
        system_user = self._get_or_create_system_user(db)
        db.commit()

        # Seed courses
        current_titles = list(self.courses.keys())
        for course_def in self.courses.values():
            self._seed_one_course(db, system_user, course_def)

        # Cleanup ones no longer in the list
        self._cleanup_orphaned_courses(db, system_user, current_titles)
        print("Public course synchronization complete.")

    def _get_or_create_system_user(self, db: Session) -> UserModel:
        user = db.query(UserModel).filter(UserModel.email == SYSTEM_EMAIL).first()
        if user is None:
            user = UserModel(
                email=SYSTEM_EMAIL,
                full_name=SYSTEM_NAME,
                hashed_password="!system-no-login",
                credits=999999,
                xp=0,
                level=1,
                xp_to_next_level=100,
            )
            db.add(user)
            db.flush()
            print(f"  Created system user: {SYSTEM_EMAIL} (id={user.id})")
        return user

    def _build_syllabus_json(self, course_def: dict) -> dict:
        units = []
        first_node = True
        for unit_def in course_def["units"]:
            nodes = []
            for node_def in unit_def["nodes"]:
                nodes.append({
                    "id": node_def["id"],
                    "title": node_def["title"],
                    "description": node_def.get("description", ""),
                    "status": "available" if first_node else "locked",
                    "hasGeneratedLesson": True,
                })
                first_node = False
            units.append({
                "unitId": unit_def["unitId"],
                "unitTitle": unit_def["unitTitle"],
                "unitDescription": unit_def.get("unitDescription", ""),
                "nodes": nodes,
            })
        return {
            "courseTitle": course_def["title"],
            "description": course_def["description"],
            "units": units,
        }

    def _build_stage_snapshot(self, stage_def: dict[str, Any]) -> dict[str, Any]:
        component = stage_def["component"]
        data = stage_def["data"]
        difficulty = stage_def.get("difficulty", "medium")
        topic = stage_def.get("topic", "Subject Detail")
        
        sid = str(uuid.uuid4())[:8]
        
        snapshot = {
            "stageId": f"stage-{sid}",
            "topic": topic,
            "skin": "Scientific",
            "component": component,
            "difficulty": difficulty,
            "recommendedDurationMinutes": 3,
            "config": {
                "data": data,
                "initialState": {},
            },
            "validation": {"type": "logic", "condition": None},
            "feedback": {"success": "Great job!", "error": "Not quite right. Try again!"},
        }
        
        if component == "ExplainerMedia":
            if "mediaType" not in snapshot["config"]["data"]:
                snapshot["config"]["data"]["mediaType"] = "none"
            if difficulty == "medium":
                snapshot["difficulty"] = "low"
                
        return snapshot

    def _cleanup_orphaned_courses(self, db: Session, user: UserModel, current_titles: list[str]) -> None:
        orphans = db.query(CourseModel).filter(
            CourseModel.user_id == user.id,
            CourseModel.title.not_in(current_titles)
        ).all()
        
        if orphans:
            print(f"  [Cleanup] Found {len(orphans)} orphaned courses to remove.")
            for course in orphans:
                print(f"    - Deleting: {course.title}")
                db.delete(course)
            db.flush()
            db.commit()

    def _seed_one_course(self, db: Session, user: UserModel, course_def: dict) -> None:
        title = course_def["title"]
        now = utc_now()

        # Upsert: delete existing to allow re-seeding
        existing = db.query(CourseModel).filter(
            CourseModel.user_id == user.id,
            CourseModel.title == title,
        ).first()
        
        syllabus = self._build_syllabus_json(course_def)
        if existing:
            # Update attributes instead of deleting
            existing.topic = course_def["topic"]
            existing.syllabus_json = syllabus
            existing.updated_at = now
            course = existing
            # Clean up old nodes and lessons to re-seed?
            # For simplicity, we'll keep the course but delete its children
            db.query(NodeModel).filter(NodeModel.course_id == course.id).delete()
            db.query(LessonModel).filter(LessonModel.course_id == course.id).delete()
            db.flush()
        else:
            course = CourseModel(
                user_id=user.id,
                title=title,
                topic=course_def["topic"],
                status=CourseStatus.READY,
                folder_name=str(uuid.uuid4()),
                profile_json={"summary": "System-generated public course."},
                draft_json={"topic": course_def["topic"]},
                syllabus_json=syllabus,
            )
            db.add(course)
            db.flush()

        for unit_def in course_def["units"]:
            for node_def in unit_def["nodes"]:
                is_first = node_def["id"] == course_def["units"][0]["nodes"][0]["id"]
                node_status = NodeStatus.AVAILABLE if is_first else NodeStatus.LOCKED

                db_node = NodeModel(
                    course_id=course.id,
                    node_id=node_def["id"],
                    title=node_def["title"],
                    status=node_status,
                    data={"description": node_def.get("description", "")},
                )
                db.add(db_node)

                stages_data = []
                for s_def in node_def["stages"]:
                    if "topic" not in s_def:
                        s_def["topic"] = node_def["title"]
                    stages_data.append(self._build_stage_snapshot(s_def))
                    s_def["data"] = stages_data[-1]["config"]["data"]

                lesson = LessonModel(
                    user_id=user.id,
                    course_id=course.id,
                    node_id=node_def["id"],
                    course_topic=course_def["topic"],
                    status="generated",
                    stage_count=len(stages_data),
                    question_count=len(stages_data),
                    estimated_duration_minutes=len(stages_data) * 3,
                    schema_version=2,
                    generator_provider="seed-script",
                    generator_model="yaml-content",
                    created_at=now,
                    updated_at=now,
                )
                db.add(lesson)
                db.flush()

                for idx, stage_snapshot in enumerate(stages_data):
                    stage_model = LessonStageModel(
                        lesson_id=lesson.id,
                        stage_uid=stage_snapshot["stageId"],
                        stage_order=idx,
                        stage_type="interactive",
                        topic=stage_snapshot["topic"],
                        skin=stage_snapshot["skin"],
                        component=stage_snapshot["component"],
                        difficulty=stage_snapshot.get("difficulty"),
                        recommended_duration_minutes=stage_snapshot.get("recommendedDurationMinutes"),
                        item_count=1,
                        schema_version=2,
                        content_json=stage_snapshot["config"]["data"],
                        validation_json=stage_snapshot["validation"],
                        feedback_json=stage_snapshot["feedback"],
                        stage_snapshot_json=stage_snapshot,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(stage_model)

        # Seed PublicCourseModel
        slug = title.lower().replace(" ", "-").replace("&", "and")
        public_course = db.query(PublicCourseModel).filter(PublicCourseModel.slug == slug).first()
        
        final_syllabus = self._build_syllabus_json(course_def)
        for u_i, unit in enumerate(final_syllabus["units"]):
            for n_i, node in enumerate(unit["nodes"]):
                node["stages"] = course_def["units"][u_i]["nodes"][n_i].get("stages", [])

        if public_course:
            # Update attributes instead of deleting
            public_course.title = title
            public_course.topic = course_def["topic"]
            public_course.description = course_def.get("description", "System generated public course")
            public_course.syllabus_json = final_syllabus
            public_course.updated_at = now
        else:
            public_course = PublicCourseModel(
                slug=slug,
                title=title,
                topic=course_def["topic"],
                description=course_def.get("description", "System generated public course"),
                difficulty="intermediate",
                is_published=True,
                is_arena_enabled=True,
                tags_json=["yaml-seeded"],
                syllabus_json=final_syllabus,
                created_at=now,
                updated_at=now,
            )
            db.add(public_course)
        
        db.flush()

        # Added: Automatically seed Arena Question Pool from syllabus
        self._seed_arena_pool(db, public_course, course_def)
        
        db.commit()

    def _seed_arena_pool(self, db: Session, public_course: PublicCourseModel, course_def: dict) -> None:
        """從課程定義中提取互動式題目並建立 Arena 題庫。"""
        # Create or update pool
        slug = f"{public_course.slug}-pool"
        pool = db.query(ArenaQuestionPoolModel).filter(
            ArenaQuestionPoolModel.public_course_id == public_course.id,
            ArenaQuestionPoolModel.slug == slug
        ).first()

        if pool:
            # Update pool and clear items for re-seeding
            pool.title = f"{public_course.title} Pool"
            pool.updated_at = utc_now()
            db.query(ArenaQuestionPoolItemModel).filter(ArenaQuestionPoolItemModel.pool_id == pool.id).delete()
            db.flush()
        else:
            pool = ArenaQuestionPoolModel(
                public_course_id=public_course.id,
                slug=slug,
                title=f"{public_course.title} Pool",
                description=f"Automated question pool for {public_course.title}",
                is_active=True,
                version=1,
            )
            db.add(pool)
            db.flush()

        # Extract items from units/nodes/stages
        for unit in course_def.get("units", []):
            for node in unit.get("nodes", []):
                for idx, stage in enumerate(node.get("stages", [])):
                    component = stage.get("component")
                    if component not in ["MultipleChoice", "Ordering", "MatchingPairs"]:
                        continue

                    data = stage.get("data", {})
                    question_key = f"{node['id']}-{idx}"
                    
                    # Normalize prompt and options based on component
                    prompt = ""
                    options = []
                    correct_option_id = None

                    if component == "MultipleChoice":
                        prompt = data.get("question", "")
                        options = data.get("options", [])
                        correct_option_id = str(data.get("correctOptionId", ""))
                    elif component == "MatchingPairs":
                        prompt = data.get("question") or node["title"]
                        options = data.get("pairs", [])
                    elif component == "Ordering":
                        prompt = data.get("question") or node["title"]
                        options = data.get("steps", [])

                    if not prompt:
                        continue

                    item = ArenaQuestionPoolItemModel(
                        pool_id=pool.id,
                        question_key=question_key,
                        question_type=component,
                        prompt=prompt,
                        options_json=options,
                        correct_option_id=correct_option_id,
                        difficulty=stage.get("difficulty") or "normal",
                        knowledge_tags_json=[],
                        explanation=data.get("explanation"),
                        source_unit_id=unit.get("unitId"),
                        source_node_id=node.get("id"),
                        is_active=True,
                    )
                    db.add(item)
        
        db.flush()

# Singleton 實例
registry = PublicCourseRegistryLoader()
