from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Any
import yaml
import os
from pathlib import Path

from app.api.dependencies import get_db, get_current_user, get_current_arena_admin
from app.models.user import UserModel
from app.models.course import CourseModel
from app.core.config import settings
from app.schemas.course_schema import CoursePath
from app.domain.statuses import CourseStatus

router = APIRouter()

def _sync_course_nodes(db: Session, course: CourseModel, syllabus: dict):
    from app.models.course import NodeModel
    db.query(NodeModel).filter(NodeModel.course_id == course.id).delete()
    units = syllabus.get("units", [])
    for unit in units:
        for node in unit.get("nodes", []):
            db.add(
                NodeModel(
                    course_id=course.id,
                    node_id=node.get("id") or node.get("nodeId") or f"n_{id(node)}",
                    title=node.get("title") or node.get("unitTitle") or "Untitled Node",
                    status=node.get("status") or "available",
                    data={k: v for k, v in node.items() if k not in ["status", "title", "id", "nodeId", "unitTitle"]},
                )
            )

@router.post("", response_model=Any)
def create_custom_course(
    course_in: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    title = course_in.get("title", "New Course")
    syllabus = course_in.get("syllabus_json")
    if isinstance(syllabus, dict):
        if "courseTitle" not in syllabus:
            syllabus["courseTitle"] = title
        syllabus["isCustom"] = True
    else:
        syllabus = {"courseTitle": title, "isCustom": True, "units": []}

    course = CourseModel(
        title=title,
        user_id=current_user.id,
        is_published=False,
        status=CourseStatus.READY,
        syllabus_json=syllabus
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    _sync_course_nodes(db, course, syllabus)
    db.commit()
    return {"id": course.id, "title": course.title}

@router.get("", response_model=Any)
def list_custom_courses(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    stmt = select(CourseModel).where(CourseModel.user_id == current_user.id)
    courses = db.execute(stmt).scalars().all()
    return [{"id": c.id, "title": c.title, "is_published": c.is_published, "status": c.status} for c in courses]

@router.get("/{course_id}", response_model=Any)
def get_custom_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    course = db.get(CourseModel, course_id)
    if not course or course.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"id": course.id, "title": course.title, "syllabus_json": course.syllabus_json}

@router.put("/{course_id}", response_model=Any)
def update_custom_course(
    course_id: int,
    course_in: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    course = db.get(CourseModel, course_id)
    if not course or course.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if "title" in course_in:
        course.title = course_in["title"]
    if "syllabus_json" in course_in:
        syllabus = course_in["syllabus_json"]
        if isinstance(syllabus, dict):
            if "courseTitle" not in syllabus:
                syllabus["courseTitle"] = course_in.get("title") or course.title or "Untitled"
            syllabus["isCustom"] = True
        course.syllabus_json = syllabus
        _sync_course_nodes(db, course, syllabus)
    if "status" in course_in:
        course.status = course_in["status"]
    if "is_published" in course_in:
        course.is_published = course_in["is_published"]
        
    db.commit()
    db.refresh(course)
    return {"id": course.id, "title": course.title, "status": course.status, "is_published": course.is_published}

@router.post("/{course_id}/export-yaml", response_model=Any)
def export_course_to_yaml(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    course = db.get(CourseModel, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    # Serialize course to dict matching public_courses format
    yaml_data = {
        "id": f"custom_{course.id}",
        "title": course.title,
        "description": "User created course",
        "units": course.syllabus_json.get("units", []) if course.syllabus_json else []
    }
    
    yaml_filename = f"custom_{course.id}.yaml"
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    yaml_path = base_dir / "data" / "custom_published_courses" / yaml_filename
    
    os.makedirs(os.path.dirname(yaml_path), exist_ok=True)
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(yaml_data, f, allow_unicode=True, sort_keys=False)
        
    course.is_published = True
    course.status = "approved"

    from app.models.public_course import PublicCourseModel
    from app.arena.models.arena_question_pool import ArenaQuestionPoolModel, ArenaQuestionPoolItemModel
    from app.arena.services.admin_service import AdminService

    slug = f"custom-{course.id}"
    public_course = db.query(PublicCourseModel).filter(PublicCourseModel.slug == slug).first()
    if not public_course:
        public_course = PublicCourseModel(
            slug=slug,
            title=course.title,
            topic=course.topic or course.title,
            description=f"User created course by {course.user.email if course.user else 'user'}",
            is_published=True,
            is_featured_arena=True,
            tags_json=["Custom", "User Contributed"],
            syllabus_json=course.syllabus_json
        )
        db.add(public_course)
        db.flush()

    pool = db.query(ArenaQuestionPoolModel).filter(ArenaQuestionPoolModel.public_course_id == public_course.id).first()
    if not pool:
        pool = ArenaQuestionPoolModel(
            public_course_id=public_course.id,
            slug=slug,
            title=course.title,
            description=f"Arena Pool for {course.title}",
            is_active=True,
            version=1
        )
        db.add(pool)
        db.flush()

    admin_service = AdminService()
    extracted_questions = admin_service.extract_questions_from_syllabus(db, public_course.id)
    
    for raw_item in extracted_questions:
        q_key = raw_item["questionKey"]
        item = db.query(ArenaQuestionPoolItemModel).filter(
            ArenaQuestionPoolItemModel.pool_id == pool.id,
            ArenaQuestionPoolItemModel.question_key == q_key
        ).first()
        if not item:
            item = ArenaQuestionPoolItemModel(pool_id=pool.id, question_key=q_key)
            db.add(item)
            
        item.question_type = raw_item["questionType"] or "MultipleChoice"
        item.prompt = raw_item["prompt"] or "Multiple Choice Question"
        item.options_json = raw_item["options"]
        item.correct_option_id = raw_item.get("correctOptionId")
        item.difficulty = raw_item.get("difficulty") or "normal"
        item.knowledge_tags_json = raw_item.get("knowledgeTags") or []
        item.explanation = raw_item.get("explanation")
        item.source_unit_id = raw_item.get("sourceUnitId")
        item.source_node_id = raw_item.get("sourceNodeId")
        item.is_active = True
        
    db.commit()
    return {"status": "success", "file": yaml_filename}

@router.post("/{course_id}/fork", response_model=Any)
def fork_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    course = db.get(CourseModel, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    forked_course = CourseModel(
        title=f"{course.title} (Fork)",
        user_id=current_user.id,
        is_published=False,
        status=CourseStatus.READY,
        syllabus_json=course.syllabus_json
    )
    db.add(forked_course)
    db.commit()
    db.refresh(forked_course)
    _sync_course_nodes(db, forked_course, course.syllabus_json)
    db.commit()
    return {"id": forked_course.id, "title": forked_course.title}

@router.get("/admin/pending", response_model=Any)
def list_pending_courses(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    stmt = select(CourseModel).where(CourseModel.status == "under_review")
    courses = db.execute(stmt).scalars().all()
    return [{"id": c.id, "title": c.title, "is_published": c.is_published, "status": c.status} for c in courses]

@router.delete("/{course_id}", response_model=Any)
def delete_custom_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    course = db.get(CourseModel, course_id)
    if not course or course.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")
        
    db.delete(course)
    db.commit()
    return {"status": "success"}
