from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_
from typing import List, Any
import yaml
import os
from uuid import uuid4
from pathlib import Path

from app.api.dependencies import get_db, get_current_user, get_current_arena_admin
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.models.lesson import LessonModel, LessonStageModel
from app.core.config import settings
from app.schemas.course_schema import CoursePath
from app.domain.statuses import CourseStatus
from app.services.domain.course.service import CourseService

router = APIRouter()

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
    CourseService.sync_course_nodes(db, course, syllabus)
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
    from app.services.domain.user.service import UserService
    is_admin = UserService.is_admin(current_user)
    if not course or (course.user_id != current_user.id and not is_admin):
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
        CourseService.sync_course_nodes(db, course, syllabus)
    if "status" in course_in:
        course.status = course_in["status"]
    if "is_published" in course_in:
        old_val = course.is_published
        new_val = course_in["is_published"]
        course.is_published = new_val
        if not new_val:
            course.status = CourseStatus.READY
        
        # If unpublishing, remove the YAML file to actually take it off the public catalog
        if old_val and not new_val:
            yaml_filename = f"custom_{course.id}.yaml"
            yaml_path = settings.CUSTOM_COURSES_DIR / yaml_filename
            if yaml_path.exists():
                os.remove(yaml_path)
            
            # Trigger sync to remove the system-owned course record
            from app.core.course_loader import registry
            registry._load_all()
            registry.sync_to_db(db)
            
    db.commit()
    db.refresh(course)
    return {"id": course.id, "title": course.title, "status": course.status, "is_published": course.is_published}

@router.post("/{course_id}/export-yaml", response_model=Any)
def export_course_to_yaml(
    course_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    result = CourseService.publish_course_to_yaml(db, course_id, background_tasks)
    return {**result, "message": "Course export started in background"}

@router.post("/{course_id}/fork", response_model=Any)
def fork_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    forked_course = CourseService.fork_course(db, course_id, current_user.id)
    return {"id": forked_course.id, "title": forked_course.title}

@router.get("/admin/pending", response_model=Any)
def list_pending_courses(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    # Show courses that are under review OR already approved but currently unpublished (so they can be re-published)
    stmt = select(CourseModel).where(
        CourseModel.status == "under_review"
    )
    courses = db.execute(stmt).scalars().all()
    results = []
    for c in courses:
        # Deep copy or construct a preview-ready syllabus
        syllabus = dict(c.syllabus_json or {})
        
        # Attach components from NodeModel to the syllabus for preview
        nodes = db.query(NodeModel).filter(NodeModel.course_id == c.id).all()
        node_map = {n.node_id: n.data.get("components", []) for n in nodes}
        
        if "units" in syllabus:
            for unit in syllabus["units"]:
                for node in unit.get("nodes", []):
                    node_id = node.get("id") or node.get("nodeId")
                    node["components"] = node_map.get(node_id, [])
        
        results.append({
            "id": c.id,
            "title": c.title,
            "is_published": c.is_published,
            "status": c.status,
            "syllabus_json": syllabus
        })
    return results

@router.delete("/{course_id}", response_model=Any)
def delete_custom_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    from app.services.domain.user.service import UserService
    is_admin = UserService.is_admin(current_user)
    CourseService.delete_course(db, course_id, current_user.id, is_admin=is_admin)
    return {"status": "success"}
