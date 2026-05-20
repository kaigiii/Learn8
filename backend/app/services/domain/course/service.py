import os
import yaml
from uuid import uuid4
from pathlib import Path
from sqlalchemy.orm import Session
from fastapi import HTTPException, BackgroundTasks

from app.models.course import CourseModel, NodeModel
from app.domain.statuses import CourseStatus
from app.core.config import settings

class CourseService:
    @staticmethod
    def sync_course_nodes(db: Session, course: CourseModel, syllabus: dict):
        """同步資料庫中的節點資訊，確保與課程大綱一致。"""
        db.query(NodeModel).filter(NodeModel.course_id == course.id).delete()
        units = syllabus.get("units", [])
        for unit in units:
            for node in unit.get("nodes", []):
                db.add(
                    NodeModel(
                        course_id=course.id,
                        node_id=node.get("id") or node.get("nodeId") or f"n_{uuid4().hex[:8]}",
                        title=node.get("title") or node.get("unitTitle") or "Untitled Node",
                        status=node.get("status") or "available",
                        data={"description": node.get("description", "")},
                    )
                )
        db.commit()

    @staticmethod
    def _map_component_to_stage(comp: dict) -> dict:
        """將單一組件映射為符合 YAML 格式的 Stage 結構。"""
        comp_type = comp.get("type", "ExplainerMedia")
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
            # Fallback: 排除掉一些管理用的內部欄位
            data = {k: v for k, v in comp.items() if k not in ["id", "type", "topic", "difficulty"]}
            
        return {
            "component": comp_type,
            "topic": comp.get("topic", "Lesson Detail"),
            "difficulty": comp.get("difficulty", "medium"),
            "data": data
        }

    @staticmethod
    def serialize_course_to_dict(db: Session, course: CourseModel) -> dict:
        """將課程及其節點組件序列化為符合公用課程格式的字典。"""
        units = []
        syllabus = course.syllabus_json or {}
        
        # 預先加載節點資料，避免在迴圈中頻繁查詢
        nodes = db.query(NodeModel).filter(NodeModel.course_id == course.id).all()
        node_map = {n.node_id: n.data.get("components", []) for n in nodes}

        for u in syllabus.get("units", []):
            unit_nodes = []
            for n in u.get("nodes", []):
                node_id = n.get("id") or n.get("nodeId")
                components = node_map.get(node_id, [])
                unit_nodes.append({
                    "id": node_id or str(uuid4()),
                    "title": n.get("title", "Untitled Lesson"),
                    "description": n.get("description", ""),
                    "stages": [CourseService._map_component_to_stage(c) for c in components]
                })
            units.append({
                "unitId": u.get("unitId", str(uuid4())),
                "unitTitle": u.get("unitTitle", "Untitled Unit"),
                "unitDescription": u.get("unitDescription", ""),
                "nodes": unit_nodes
            })

        return {
            "metadata": {
                "sourceCourseId": course.id,
                "type": "custom"
            },
            "title": course.title,
            "topic": course.topic or course.title,
            "description": "User contributed course from Creator Center.",
            "units": units
        }

    @staticmethod
    def publish_course_to_yaml(db: Session, course_id: int, background_tasks: BackgroundTasks) -> dict:
        """執行課程發佈流程：生成 YAML 並觸發背景同步。"""
        course = db.get(CourseModel, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
            
        yaml_data = CourseService.serialize_course_to_dict(db, course)
        
        yaml_filename = f"custom_{course.id}.yaml"
        yaml_path = settings.CUSTOM_COURSES_DIR / yaml_filename
        
        # 確保目錄存在
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(yaml_data, f, allow_unicode=True, sort_keys=False)
            
        # 更新原始課程狀態
        course.is_published = True
        course.status = "approved"
        db.commit()

        # 觸發背景同步
        from app.core.course_loader import registry
        background_tasks.add_task(registry.sync_one_file, yaml_path, db)
        
        return {"status": "success", "file": yaml_filename}

    @staticmethod
    def fork_course(db: Session, course_id: int, user_id: int) -> CourseModel:
        """複製課程及其結構。"""
        original = db.get(CourseModel, course_id)
        if not original:
            raise HTTPException(status_code=404, detail="Original course not found")
            
        forked = CourseModel(
            title=f"{original.title} (Fork)",
            user_id=user_id,
            is_published=False,
            status=CourseStatus.READY,
            syllabus_json=original.syllabus_json
        )
        db.add(forked)
        db.commit()
        db.refresh(forked)
        
        CourseService.sync_course_nodes(db, forked, original.syllabus_json)
        return forked

    @staticmethod
    def delete_course(db: Session, course_id: int, user_id: int, is_admin: bool = False):
        """刪除課程及其關聯的實體檔案。"""
        course = db.get(CourseModel, course_id)
        if not course or (course.user_id != user_id and not is_admin):
            raise HTTPException(status_code=404, detail="Course not found")
            
        yaml_path = settings.CUSTOM_COURSES_DIR / f"custom_{course.id}.yaml"
        if yaml_path.exists():
            os.remove(yaml_path)
            
        db.delete(course)
        db.commit()
