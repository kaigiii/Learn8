"""
seed_public_courses.py  –  Populate public courses from YAML content.

Usage:
    cd backend
    python3.12 -m scripts.seed_public_courses
"""
from __future__ import annotations

import glob
import os
import uuid
from typing import Any

import yaml
from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
from app.db import registry as _registry  # noqa: F401  – ensures all models are mapped
from app.db.session import SessionLocal
from app.domain.statuses import CourseStatus, NodeStatus
from app.models.course import CourseModel, NodeModel
from app.models.lesson import LessonModel, LessonStageModel
from app.models.user import UserModel

# ---------------------------------------------------------------------------
# Content Configuration
# ---------------------------------------------------------------------------
SYSTEM_EMAIL = "public@learn8.system"
SYSTEM_NAME = "Learn8 Public"
CONTENT_DIR = os.path.join(os.path.dirname(__file__), "content/public_courses")

# Whitelist: Only YAML files listed here will be seeded.
# Any OTHER courses owned by the system user will be DELETED from the database.
ENABLED_COURSES = [
    "ai_neural_networks.yaml",
    "python_fundamentals.yaml",
    "world_history.yaml",
]

# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_courses_from_yaml() -> list[dict[str, Any]]:
    """Load only the courses specified in ENABLED_COURSES."""
    courses = []
    
    for filename in ENABLED_COURSES:
        file_path = os.path.join(CONTENT_DIR, filename)
        if not os.path.exists(file_path):
            print(f"  [Warning] Whitlisted file not found: {file_path}")
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = yaml.safe_load(f)
                if data:
                    # Store original filename for reference
                    data["_source_file"] = filename
                    courses.append(data)
                    print(f"  Loaded course: {data.get('title')} from {filename}")
            except Exception as e:
                print(f"  [Error] Failed to load {file_path}: {e}")
                
    return courses

# ---------------------------------------------------------------------------
# Stage Builders (Mapping YAML to Schema)
# ---------------------------------------------------------------------------

def build_stage_snapshot(stage_def: dict[str, Any]) -> dict[str, Any]:
    """
    Transforms a stage definition from YAML into the unified schema.
    Matches the logic previously in helper functions (_mc, _order, etc.)
    """
    component = stage_def["component"]
    data = stage_def["data"]
    difficulty = stage_def.get("difficulty", "medium")
    topic = stage_def.get("topic", "Subject Detail") # Fallback
    
    sid = str(uuid.uuid4())[:8]
    
    # Base structure
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
    
    # Specific adjustments if any (e.g. ExplainerMedia defaults)
    if component == "ExplainerMedia":
        if "mediaType" not in snapshot["config"]["data"]:
            snapshot["config"]["data"]["mediaType"] = "none"
        if difficulty == "medium": # Explainer is usually low difficulty
            snapshot["difficulty"] = "low"
            
    return snapshot

# ---------------------------------------------------------------------------
# Database Seeding Logic
# ---------------------------------------------------------------------------

def _get_or_create_system_user(db: Session) -> UserModel:
    """Find or create the system user that owns all public courses."""
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


def _build_syllabus_json(course_def: dict) -> dict:
    """Build the syllabus_json for a course, marking first node available."""
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


def _cleanup_orphaned_courses(db: Session, user: UserModel, current_titles: list[str]) -> None:
    """Delete any courses owned by the system user that are NOT in the current seed list."""
    orphans = db.query(CourseModel).filter(
        CourseModel.user_id == user.id,
        CourseModel.title.not_in(current_titles)
    ).all()
    
    if orphans:
        print(f"\n  [Cleanup] Found {len(orphans)} orphaned courses to remove:")
        for course in orphans:
            print(f"    - Deleting: {course.title} (id={course.id})")
            db.delete(course)
        db.flush()
        db.commit()


def _seed_one_course(db: Session, user: UserModel, course_def: dict) -> None:
    title = course_def["title"]

    # Upsert: delete existing to allow re-seeding
    existing = db.query(CourseModel).filter(
        CourseModel.user_id == user.id,
        CourseModel.title == title,
    ).first()
    if existing:
        print(f"    Overwriting existing course: {title} (id={existing.id})")
        db.delete(existing)
        db.flush()

    syllabus = _build_syllabus_json(course_def)
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

    node_count = 0
    stage_count = 0
    now = utc_now_naive()

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
            node_count += 1

            # Prepare Stages from definitions
            stages_data = []
            for s_def in node_def["stages"]:
                # Pass node title as default stage topic if not provided
                if "topic" not in s_def:
                    s_def["topic"] = node_def["title"]
                stages_data.append(build_stage_snapshot(s_def))
                
                # Also bake back the component specifically for the syllabus
                s_def["data"] = stages_data[-1]["config"]["data"]

            # Create Lesson
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

            # Create LessonStages
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
                stage_count += 1

    db.commit()

    # Now also seed the PublicCourseModel, ensuring it uses the fully enriched syllabus with baked stages
    from app.models.public_course import PublicCourseModel
    slug = title.lower().replace(" ", "-").replace("&", "and")
    
    public_course = (
        db.query(PublicCourseModel)
        .filter(PublicCourseModel.slug == slug)
        .first()
    )
    if public_course:
        db.delete(public_course)
        db.flush()

    # Re-build syllabus with all stages intact from the original course_def
    final_syllabus = _build_syllabus_json(course_def)
    # Inject stages back into the syllabus structurally
    for u_i, unit in enumerate(final_syllabus["units"]):
        for n_i, node in enumerate(unit["nodes"]):
            node["stages"] = course_def["units"][u_i]["nodes"][n_i].get("stages", [])

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
    db.commit()

    print(f"    ✓ {title}: {node_count} nodes, {stage_count} stages (course_id={course.id}, public_course_id={public_course.id})")


def main() -> None:
    db = SessionLocal()
    try:
        print("Seeding public courses from YAML content...")
        system_user = _get_or_create_system_user(db)
        db.commit()

        courses = load_courses_from_yaml()
        if not courses:
            print("No courses to seed.")
            # Still run cleanup if whitelist is empty
            _cleanup_orphaned_courses(db, system_user, [])
            return

        # Seed courses
        current_titles = [c["title"] for c in courses]
        for course_def in courses:
            _seed_one_course(db, system_user, course_def)

        # Cleanup ones no longer in the list
        _cleanup_orphaned_courses(db, system_user, current_titles)

        print(f"\nDone! {len(courses)} public courses seeded under {SYSTEM_EMAIL}.")
        print("System user ID:", system_user.id)
    finally:
        db.close()


if __name__ == "__main__":
    main()
