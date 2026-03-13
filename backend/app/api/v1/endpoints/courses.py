from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.schemas.course_schema import CoursePath, UpdateNodeStatusRequest
import datetime

router = APIRouter()


@router.get("", response_model=List[dict])
def get_courses(
    project_id: int = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(CourseModel).filter(CourseModel.user_id == current_user.id)
    if project_id:
        query = query.filter(CourseModel.project_id == project_id)

    # 依更新時間降序排列，預設顯示最新課程
    courses = query.order_by(CourseModel.updated_at.desc()).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "topic": c.topic,
            "project_id": c.project_id,
            "created_at": c.created_at,
        }
        for c in courses
    ]


@router.get("/{course_id}", response_model=CoursePath)
def get_course_detail(
    course_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = (
        db.query(CourseModel)
        .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
        .first()
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    path = CoursePath(**course.syllabus_json)
    path.id = course.id
    path.topic = course.topic
    return path


@router.patch("/{course_id}/node/{node_id}/status", response_model=CoursePath)
async def update_node_status(
    course_id: int,
    node_id: str,
    request: UpdateNodeStatusRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    def _fetch_course():
        return (
            db.query(CourseModel)
            .filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id)
            .first()
        )

    course_record = await run_in_threadpool(_fetch_course)

    if not course_record:
        raise HTTPException(status_code=404, detail=f"Course {course_id} not found")

    syllabus_data = course_record.syllabus_json

    node_found = False
    units = syllabus_data.get("units", [])
    updates_to_sync = []

    # 尋找目標節點並更新狀態，若狀態為 "completed" 則自動解鎖下一個節點
    for unit_idx, unit in enumerate(units):
        nodes = unit.get("nodes", [])
        for node_idx, node in enumerate(nodes):
            if node["id"] == node_id:
                node["status"] = request.status
                node_found = True
                updates_to_sync.append((node_id, request.status))

                # 若目前節點已完成，嘗試解鎖下一個學習節點
                if request.status == "completed":
                    if node_idx + 1 < len(nodes):
                        # 同一單元內的下一個節點
                        next_node = nodes[node_idx + 1]
                        next_node["status"] = "available"
                        updates_to_sync.append((next_node["id"], "available"))
                    elif unit_idx + 1 < len(units):
                        # 跨單元解鎖：下個單元的第一個節點
                        next_unit = units[unit_idx + 1]
                        if next_unit.get("nodes"):
                            next_node = next_unit["nodes"][0]
                            next_node["status"] = "available"
                            updates_to_sync.append((next_node["id"], "available"))
                break
        if node_found:
            break

    if not node_found:
        raise HTTPException(status_code=404, detail="Node not found in course")

    course_record.syllabus_json = syllabus_data
    flag_modified(course_record, "syllabus_json")

    def _update_db_nodes():
        for nid, nstatus in updates_to_sync:
            db_node = (
                db.query(NodeModel)
                .filter(
                    NodeModel.course_id == course_record.id, NodeModel.node_id == nid
                )
                .first()
            )
            if db_node:
                db_node.status = nstatus
                db_node.updated_at = datetime.datetime.utcnow()

        db.commit()
        db.refresh(course_record)

    await run_in_threadpool(_update_db_nodes)

    path = CoursePath(**course_record.syllabus_json)
    path.id = course_record.id
    return path
