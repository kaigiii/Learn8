import os
import uuid
import hashlib
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
from app.arena.models.arena_question_pool import ArenaQuestionPoolModel, ArenaQuestionPoolItemModel
from app.core.config import settings

# 定義 public_courses 目錄的絕對或相對路徑
OFFICIAL_COURSES_DIR = settings.OFFICIAL_COURSES_DIR
CUSTOM_COURSES_DIR = settings.CUSTOM_COURSES_DIR

SYSTEM_EMAIL = "public@learn8.system"
SYSTEM_NAME = "Learn8 Public"

class PublicCourseRegistryLoader:
    def __init__(self):
        self.courses: Dict[str, Dict[str, Any]] = {}
        # Memory cache for hashes to skip unchanged files during a single runtime
        self._hash_cache: Dict[str, str] = {}
        self._load_all()

    def _load_all(self):
        """從官方與自定義目錄中載入所有 YAML 檔案。"""
        self.courses = {}
        from app.core.config import settings
        
        # 載入官方課程
        if OFFICIAL_COURSES_DIR.exists():
            enabled_courses = [c.strip() for c in settings.ENABLED_PUBLIC_COURSES.split(",") if c.strip()]
            for filename in os.listdir(OFFICIAL_COURSES_DIR):
                if filename.endswith(".yaml") or filename.endswith(".yml"):
                    if enabled_courses and filename not in enabled_courses:
                        continue
                    data = self._load_file(OFFICIAL_COURSES_DIR / filename)
                    if data:
                        self.courses[data.get("title", filename)] = data

        # 載入自定義發佈的課程 (全部載入，不受 ENABLED_PUBLIC_COURSES 限制)
        if CUSTOM_COURSES_DIR.exists():
            for filename in os.listdir(CUSTOM_COURSES_DIR):
                if filename.endswith(".yaml") or filename.endswith(".yml"):
                    data = self._load_file(CUSTOM_COURSES_DIR / filename)
                    if data:
                        self.courses[data.get("title", filename)] = data

    def _load_file(self, filepath: Path) -> Optional[dict]:
        """讀取單一 YAML 檔案並回傳資料。"""
        if not filepath.exists():
            return None
            
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                data = yaml.safe_load(f)
                if data:
                    data["_source_file"] = filepath.name
                    data["_file_hash"] = self._calculate_file_hash(filepath)
                    return data
            except yaml.YAMLError as exc:
                print(f"Error parsing YAML file {filepath}: {exc}")
        return None

    def _calculate_file_hash(self, filepath: Path) -> str:
        """計算檔案的 MD5 Hash。"""
        hasher = hashlib.md5()
        with open(filepath, "rb") as f:
            buf = f.read()
            hasher.update(buf)
        return hasher.hexdigest()

    def sync_one_file(self, filepath: Path, db: Session):
        """細粒度同步：僅同步指定的單一 YAML 檔案。"""
        data = self._load_file(filepath)
        if not data:
            print(f"  [Loader] Failed to load {filepath}, skipping sync.")
            return

        title = data.get("title", filepath.name)
        self.courses[title] = data
        
        system_user = self._get_or_create_system_user(db)
        self._seed_one_course(db, system_user, data)
        self._hash_cache[data["_source_file"]] = data["_file_hash"]
        db.commit()
        print(f"  [Loader] Successfully synced: {title}")

    def sync_to_db(self, db: Session):
        """將載入的 YAML 課程同步至資料庫 (增加 Hash 比對優化)。"""
        if not self.courses:
            print("No public courses loaded to sync.")
            return

        print(f"Syncing {len(self.courses)} public courses to database...")
        system_user = self._get_or_create_system_user(db)
        db.commit()

        # Seed courses
        current_titles = list(self.courses.keys())
        skipped_count = 0
        for course_def in self.courses.values():
            file_name = course_def["_source_file"]
            file_hash = course_def["_file_hash"]
            
            # 如果 Hash 沒變且不在啟動強制同步名單，則跳過
            if self._hash_cache.get(file_name) == file_hash:
                skipped_count += 1
                continue
                
            self._seed_one_course(db, system_user, course_def)
            self._hash_cache[file_name] = file_hash

        if skipped_count > 0:
            print(f"  [Loader] Skipped {skipped_count} unchanged courses (Hash match).")

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
            print(f"  [Cleanup] Found {len(orphans)} orphaned CourseModel entries to remove.")
            for course in orphans:
                print(f"    - Deleting CourseModel: {course.title}")
                db.delete(course)
        
        # Also cleanup PublicCourseModel
        current_slugs = [title.lower().replace(" ", "-").replace("&", "and") for title in current_titles]
        public_orphans = db.query(PublicCourseModel).filter(
            PublicCourseModel.slug.not_in(current_slugs)
        ).all()
        
        if public_orphans:
            print(f"  [Cleanup] Found {len(public_orphans)} orphaned PublicCourseModel entries to remove.")
            for pc in public_orphans:
                from app.arena.models.arena_room import ArenaRoomModel
                from app.arena.models.arena_match import ArenaMatchModel
                
                has_rooms = db.query(ArenaRoomModel.id).filter(ArenaRoomModel.public_course_id == pc.id).first() is not None
                has_matches = db.query(ArenaMatchModel.id).filter(ArenaMatchModel.public_course_id == pc.id).first() is not None
                
                if has_rooms or has_matches:
                    print(f"    - Skipping delete of PublicCourseModel '{pc.slug}' (ID {pc.id}) because it is still referenced by arena rooms/matches.")
                    # Mark as not published to hide from the UI
                    pc.is_published = False
                else:
                    print(f"    - Deleting PublicCourseModel: {pc.slug}")
                    db.delete(pc)

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
            existing.topic = course_def.get("topic", title)
            existing.syllabus_json = syllabus
            existing.updated_at = now
            course = existing
            # Clean up old nodes and lessons to re-seed
            db.query(NodeModel).filter(NodeModel.course_id == course.id).delete()
            db.query(LessonModel).filter(LessonModel.course_id == course.id).delete()
            db.flush()
        else:
            course = CourseModel(
                user_id=user.id,
                title=title,
                topic=course_def.get("topic", title),
                status=CourseStatus.READY,
                is_published=True,
                folder_name=str(uuid.uuid4()),
                profile_json={"summary": "System-generated public course."},
                draft_json={"topic": course_def.get("topic", title)},
                syllabus_json=syllabus,
            )
            db.add(course)
            db.flush()

        # Find the ID of the very first node to set it as available
        first_node_id = None
        units = course_def.get("units", [])
        if units and len(units) > 0 and units[0].get("nodes") and len(units[0]["nodes"]) > 0:
            first_node_id = units[0]["nodes"][0]["id"]

        for unit_def in units:
            for node_def in unit_def.get("nodes", []):
                is_first = first_node_id and node_def["id"] == first_node_id
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
            
            # YAML-driven visibility and featured status
            meta = course_def.get("metadata", {})
            public_course.is_published = meta.get("isPublished", True)
            public_course.is_featured_arena = meta.get("isFeatured", False)
            public_course.source_course_id = meta.get("sourceCourseId")
            
            if "tags" in meta:
                public_course.tags_json = meta["tags"]
            
            # Purge legacy arena questions from metadata residuals
            if isinstance(public_course.metadata_json, dict):
                public_course.metadata_json.pop("arena_questions", None)
            
            public_course.updated_at = now
        else:
            # YAML-driven visibility and featured status for NEW records
            meta = course_def.get("metadata", {})
            public_course = PublicCourseModel(
                slug=slug,
                title=title,
                topic=course_def["topic"],
                description=course_def.get("description", "System generated public course"),
                is_published=meta.get("isPublished", True),
                is_featured_arena=meta.get("isFeatured", False),
                source_course_id=meta.get("sourceCourseId"),
                tags_json=meta.get("tags", ["yaml-seeded"]),
                syllabus_json=final_syllabus,
                created_at=now,
                updated_at=now,
            )
            db.add(public_course)
        
        db.flush()

        # No longer automatically seeding Arena pool correctly here to prevent overwriting manual settings.
        # User manages pools via the Admin Arena Pool Builder.
        
        db.commit()

        
        db.flush()

# Singleton 實例
registry = PublicCourseRegistryLoader()
