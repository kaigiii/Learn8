from fastapi import APIRouter, Depends, HTTPException
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
                    # Clean version: only store essential description, avoid dumping everything
                    data={"description": node.get("description", "")},
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
        old_val = course.is_published
        new_val = course_in["is_published"]
        course.is_published = new_val
        if not new_val:
            course.status = CourseStatus.READY
        
        # If unpublishing, remove the YAML file to actually take it off the public catalog
        if old_val and not new_val:
            yaml_filename = f"custom_{course.id}.yaml"
            base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
            yaml_path = base_dir / "data" / "custom_published_courses" / yaml_filename
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
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    course = db.get(CourseModel, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    # Serialize course to dict matching public_courses format
    def _map_component_to_stage(comp):
        comp_type = comp.get("type", "ExplainerMedia")
        # Standardized mapping to match official YAML expectations
        data = {}
        if comp_type == "ExplainerMedia":
            data = {
                "title": comp.get("topic", "Explanation"),
                "explanation": comp.get("content", ""),
                "bullets": comp.get("bullets") or []
            }
        elif comp_type == "MultipleChoice":
            data = {
                "question": comp.get("question", ""),
                "options": comp.get("options", []),
                "correctOptionId": comp.get("correctOptionId", "")
            }
        elif comp_type == "FeynmanMirror":
            data = {
                "prompt": comp.get("question", comp.get("content", "")),
                "sampleAnswer": comp.get("sampleAnswer", ""),
                "successFeedback": comp.get("successFeedback", ""),
                "errorFeedback": comp.get("errorFeedback", "")
            }
        else:
            # Clean fallback
            data = {k: v for k, v in comp.items() if k not in ["id", "type", "topic", "difficulty"]}
            
        return {
            "component": comp_type,
            "topic": comp.get("topic", "Lesson Detail"),
            "difficulty": comp.get("difficulty", "medium"),
            "data": data
        }

    # Serialize course to dict matching official_courses format
    units = []
    syllabus = course.syllabus_json or {}
    for u in syllabus.get("units", []):
        nodes = []
        for n in u.get("nodes", []):
            nodes.append({
                "id": n.get("id", str(uuid4())),
                "title": n.get("title", "Untitled Lesson"),
                "description": n.get("description", ""),
                "stages": [_map_component_to_stage(c) for c in n.get("components", [])]
            })
        units.append({
            "unitId": u.get("unitId", str(uuid4())),
            "unitTitle": u.get("unitTitle", "Untitled Unit"),
            "unitDescription": u.get("unitDescription", ""),
            "nodes": nodes
        })

    yaml_data = {
        "metadata": {
            "sourceCourseId": course.id,
            "type": "custom"
        },
        "title": course.title,
        "topic": course.topic or course.title,
        "description": "User contributed course from Creator Center.",
        "units": units
    }
    
    yaml_filename = f"custom_{course.id}.yaml"
    # Correct path: .parent.parent.parent.parent.parent to reach backend root
    base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
    yaml_path = base_dir / "data" / "custom_published_courses" / yaml_filename
    
    os.makedirs(os.path.dirname(yaml_path), exist_ok=True)
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(yaml_data, f, allow_unicode=True, sort_keys=False)
        
    # Mark the original custom course as approved/published
    course.is_published = True
    course.status = "approved"
    db.commit()

    # --- Trigger System-wide Reload ---
    # Instead of manual sync, we use the registry loader to ensure consistency
    from app.core.course_loader import registry
    registry._load_all()
    registry.sync_to_db(db)
    
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
    course = db.get(CourseModel, course_id)
    if not course or course.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")
        
    # Also delete associated YAML if it exists
    yaml_filename = f"custom_{course.id}.yaml"
    base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
    yaml_path = base_dir / "data" / "custom_published_courses" / yaml_filename
    if yaml_path.exists():
        os.remove(yaml_path)
        
    db.delete(course)
    db.commit()
    return {"status": "success"}
