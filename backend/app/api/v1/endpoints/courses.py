"""
模組名稱: app.api.v1.endpoints.courses
功能描述: 課程與大綱管理 API (Course Management Endpoints)

負責課程大綱 (Syllabus) 的生成、查詢、修正以及學習進度的更新。
這是 Learna v3 的核心業務邏輯入口。

路由列表:
    1. GET /
        - 功能: 列出當前使用者的所有課程。
        - 支援依 project_id 篩選。

    2. GET /{course_id}
        - 功能: 取得指定課程的完整大綱 (Syllabus JSON)。

    3. POST /generate-syllabus
        - 功能: AI 自動生成課程大綱。
        - 流程:
            1. 檢查是否已有相同主題的課程 (Cache Check)。
            2. 呼叫 `SyllabusAgent` 進行 Agentic Workflow 生成。
            3. 將生成結果存入 DB (同時建立 Course 與 Nodes 紀錄)。

    4. POST /refine-syllabus
        - 功能: 根據使用者回饋修正大綱。
        - 工具: 使用 LangGraph (syllabus_graph) 進行多輪對話修正。

    5. PATCH /{course_id}/node/{node_id}/status
        - 功能: 更新學習節點狀態 (如從 locked -> available -> completed)。
        - 邏輯: 當節點完成時，會自動解鎖下一個節點 (連鎖解鎖邏輯)。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.api.deps import get_db, get_current_user
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.models.project import ProjectModel
from app.schemas.course import CoursePath, RefineSyllabusRequest, UpdateNodeStatusRequest, LessonNode
from app.services.llm.agents.syllabus_agent import SyllabusAgent


from app.services.syllabus_graph import syllabus_graph
import datetime

router = APIRouter()

@router.get("", response_model=List[dict])
def get_courses(project_id: int = None, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(CourseModel).filter(CourseModel.user_id == current_user.id)
    if project_id:
        query = query.filter(CourseModel.project_id == project_id)
    
    # Sort by updated_at desc to default to latest course
    courses = query.order_by(CourseModel.updated_at.desc()).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "topic": c.topic,
            "project_id": c.project_id,
            "created_at": c.created_at
        } for c in courses
    ]

@router.get("/{course_id}", response_model=CoursePath)
def get_course_detail(course_id: int, current_user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(CourseModel).filter(
        CourseModel.id == course_id,
        CourseModel.user_id == current_user.id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    path = CoursePath(**course.syllabus_json)
    path.id = course.id
    path.topic = course.topic # Populate topic
    return path

@router.post("/generate-syllabus", response_model=CoursePath)
async def generate_syllabus(
    topic: str,
    project_id: int = None,
    regenerate: bool = False,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(CourseModel).filter(
        CourseModel.user_id == current_user.id,
        CourseModel.topic == topic
    )
    if project_id:
        query = query.filter(CourseModel.project_id == project_id)
    existing_course = query.first()
    
    if existing_course and not regenerate:
        path = CoursePath(**existing_course.syllabus_json)
        path.id = existing_course.id
        path.topic = existing_course.topic
        return path

    project_folder_name = None
    if project_id:
         db_project = db.query(ProjectModel).filter(
             ProjectModel.id == project_id,
             ProjectModel.user_id == current_user.id
         ).first()
         if db_project:
             project_folder_name = db_project.folder_name

    # OLD: syllabus = await generate_course_syllabus(topic, user_id=current_user.id, project_folder=project_folder_name)
    # NEW: Agentic Workflow
    syllabus = await SyllabusAgent.run(topic, user_id=current_user.id, project_folder=project_folder_name, project_id=project_id)
    if not syllabus:
         raise HTTPException(status_code=404, detail="Failed to generate syllabus.")
    
    if existing_course and regenerate:
        # Update existing
        existing_course.title = syllabus.courseTitle
        existing_course.syllabus_json = syllabus.model_dump()
        existing_course.updated_at = datetime.datetime.utcnow()
        
        # Clear old nodes
        db.query(NodeModel).filter(NodeModel.course_id == existing_course.id).delete()
        
        new_course = existing_course # Reuse object reference for below
    else:
        new_course = CourseModel(
            user_id=current_user.id,
            project_id=project_id,
            topic=topic,
            title=syllabus.courseTitle,
            syllabus_json=syllabus.model_dump()
        )
        db.add(new_course)
    
    db.commit()
    db.refresh(new_course)

    # Populate ID
    syllabus.id = new_course.id
    syllabus.topic = topic

    for unit in syllabus.units:
        for node in unit.nodes:
            db_node = NodeModel(
                course_id=new_course.id,
                node_id=node.id,
                title=node.title,
                status=node.status,
                data=node.model_dump(exclude={"status", "title", "id"})
            )
            db.add(db_node)
    db.commit()

    return syllabus

@router.post("/refine-syllabus", response_model=CoursePath)
async def refine_syllabus_endpoint(
    request: RefineSyllabusRequest, 
    current_user: UserModel = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    project_folder_name = None
    if request.projectId:
         db_project = db.query(ProjectModel).filter(
             ProjectModel.id == request.projectId,
             ProjectModel.user_id == current_user.id
         ).first()
         if db_project:
             project_folder_name = db_project.folder_name
    
    result = await syllabus_graph.ainvoke({
        "topic": request.topic,
        "syllabus": request.currentSyllabus,
        "user_feedback": request.userFeedback,
        "history": request.history,
        "user_id": current_user.id,
        "project_folder": project_folder_name
    })
    
    if not result.get("syllabus"):
         raise HTTPException(status_code=500, detail="Refinement returned empty syllabus")
    
    # Update DB if we had an ID (refinement usually works on existing course?)
    # For now, just return result
    return result["syllabus"]

@router.patch("/{course_id}/node/{node_id}/status", response_model=CoursePath)
async def update_node_status(
    course_id: int, 
    node_id: str, 
    request: UpdateNodeStatusRequest, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"DEBUG: update_node_status course_id={course_id} node_id={node_id} user={current_user.id}")
    course_record = db.query(CourseModel).filter(
        CourseModel.id == course_id,
        CourseModel.user_id == current_user.id
    ).first()

    if not course_record:
        raise HTTPException(status_code=404, detail=f"Course {course_id} not found")
        
    syllabus_data = course_record.syllabus_json
    
    node_found = False
    units = syllabus_data.get("units", [])
    updates_to_sync = [] 
    
    for unit in units:
        for i, node in enumerate(unit.get("nodes", [])):
            if node["id"] == node_id:
                node["status"] = request.status
                node_found = True
                updates_to_sync.append((node_id, request.status))
                
                if request.status == "completed":
                    if i + 1 < len(unit["nodes"]):
                        next_node = unit["nodes"][i+1]
                        next_node["status"] = "available"
                        updates_to_sync.append((next_node['id'], "available"))
                    else:
                        current_unit_index = units.index(unit)
                        if current_unit_index + 1 < len(units):
                            next_unit = units[current_unit_index + 1]
                            if next_unit.get("nodes"):
                                next_node = next_unit["nodes"][0]
                                next_node["status"] = "available"
                                updates_to_sync.append((next_node['id'], "available"))
                break
        if node_found: break
        
    if not node_found:
            print(f"DEBUG: Node {node_id} not found in course {course_id}")
            raise HTTPException(status_code=404, detail="Node not found in course")

    course_record.syllabus_json = syllabus_data
    flag_modified(course_record, "syllabus_json")
    
    for nid, nstatus in updates_to_sync:
        db_node = db.query(NodeModel).filter(
            NodeModel.course_id == course_record.id,
            NodeModel.node_id == nid
        ).first()
        if db_node:
            db_node.status = nstatus
            db_node.updated_at = datetime.datetime.utcnow()
    
    db.commit()
    db.refresh(course_record)
    
    path = CoursePath(**course_record.syllabus_json)
    path.id = course_record.id
    return path
