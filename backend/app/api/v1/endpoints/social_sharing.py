from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Any
import json

from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.course import CourseModel
from app.models.group_course import GroupCourseModel
from app.models.chat_message import ChatMessageModel
from app.models.friend import FriendModel
from app.models.group import GroupMemberModel
from app.arena.domain.arena_statuses import ArenaMatchStatus
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.api.v1.endpoints.chat import manager

router = APIRouter()

@router.post("/friend", response_model=Any)
async def share_course_with_friend(
    course_id: int,
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    course = db.get(CourseModel, course_id)
    if not course or course.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")
        
    # Create a course_share message
    content = {
        "id": course.id,
        "title": course.title,
        "action": "share"
    }
    message = ChatMessageModel(
        sender_id=current_user.id,
        recipient_id=friend_id,
        message_type="course_share",
        content=json.dumps(content)
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Broadcast WebSocket to friend and self
    msg_data = {
        "id": message.id,
        "sender_id": message.sender_id,
        "recipient_id": message.recipient_id,
        "group_id": message.group_id,
        "message_type": message.message_type,
        "content": message.content,
        "created_at": message.created_at.isoformat() if hasattr(message.created_at, "isoformat") else message.created_at
    }
    await manager.send_personal_message(msg_data, current_user.id)
    await manager.send_personal_message(msg_data, friend_id)

    return {"status": "success", "message_id": message.id}

@router.post("/group", response_model=Any)
async def share_course_with_group(
    course_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    course = db.get(CourseModel, course_id)
    if not course or course.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")
        
    # Check if group exists and user is a member
    stmt = select(GroupMemberModel).where(
        GroupMemberModel.group_id == group_id,
        GroupMemberModel.user_id == current_user.id
    )
    membership = db.execute(stmt).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
        
    group_course = GroupCourseModel(
        group_id=group_id,
        course_id=course_id,
        shared_by_id=current_user.id
    )
    db.add(group_course)
    
    # Also add a chat message to the group
    content = {
        "id": course.id,
        "title": course.title,
        "action": "share"
    }
    message = ChatMessageModel(
        sender_id=current_user.id,
        group_id=group_id,
        message_type="course_share",
        content=json.dumps(content)
    )
    db.add(message)
    
    db.commit()
    db.refresh(message)

    # Broadcast WebSocket to group members
    msg_data = {
        "id": message.id,
        "sender_id": message.sender_id,
        "recipient_id": message.recipient_id,
        "group_id": message.group_id,
        "message_type": message.message_type,
        "content": message.content,
        "created_at": message.created_at.isoformat() if hasattr(message.created_at, "isoformat") else message.created_at
    }
    members = db.execute(select(GroupMemberModel.user_id).where(GroupMemberModel.group_id == group_id)).scalars().all()
    for m_id in members:
        await manager.send_personal_message(msg_data, m_id)

    return {"status": "success", "group_course_id": group_course.id}

@router.get("/groups/{group_id}/courses", response_model=Any)
def get_group_courses(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    stmt = select(GroupCourseModel).where(GroupCourseModel.group_id == group_id)
    group_courses = db.execute(stmt).scalars().all()
    
    results = []
    for gc in group_courses:
        course = db.get(CourseModel, gc.course_id)
        if course:
            results.append({
                "group_course_id": gc.id,
                "course_id": course.id,
                "title": course.title,
                "shared_by": gc.shared_by_id,
                "created_at": gc.created_at
            })
    return results

@router.post("/groups/{group_id}/courses/{course_id}/import", response_model=Any)
def import_group_course(
    group_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    course = db.get(CourseModel, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    forked_course = CourseModel(
        title=f"{course.title} (Imported)",
        user_id=current_user.id,
        is_published=False,
        status=course.status or "ready",
        syllabus_json=course.syllabus_json
    )
    db.add(forked_course)
    db.commit()
    db.refresh(forked_course)
    return {"status": "success", "id": forked_course.id, "title": forked_course.title}

@router.get("/groups/{group_id}/active-matches", response_model=Any)
def get_group_active_matches(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    # Fetch user ids from group membership
    members_stmt = select(GroupMemberModel.user_id).where(GroupMemberModel.group_id == group_id)
    member_ids = db.execute(members_stmt).scalars().all()
    if not member_ids:
        return []

    # Filter by match players' user_id in the active matches
    matches_stmt = select(ArenaMatchModel).join(ArenaMatchPlayerModel).where(
        ArenaMatchPlayerModel.user_id.in_(member_ids),
        ArenaMatchModel.status.in_([ArenaMatchStatus.PENDING, ArenaMatchStatus.IN_PROGRESS])
    ).distinct()

    active_matches = db.execute(matches_stmt).scalars().all()
    results = []
    for m in active_matches:
        player_names = []
        for p in m.players:
            if p.user_id in member_ids:
                u = db.get(UserModel, p.user_id)
                if u:
                    player_names.append(u.full_name or u.email.split("@")[0])

        results.append({
            "match_id": m.id,
            "mode": m.mode,
            "status": m.status,
            "player_count": m.player_count,
            "players": player_names
        })

    return results
