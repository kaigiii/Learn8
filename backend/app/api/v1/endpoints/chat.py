import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_, desc

from app.api.dependencies import get_db, get_current_user, get_current_user_for_stream
from app.models.user import UserModel
from app.models.chat_message import ChatMessageModel
from app.core.redis import redis_sync_client
from app.models.friend import FriendModel
from app.models.group import GroupMemberModel

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # user_id -> List[WebSocket]
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        # Mark user as online in Redis
        try:
            redis_sync_client.setex(f"presence:user:{user_id}", 35, "online")
        except:
            pass

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                try:
                    redis_sync_client.delete(f"presence:user:{user_id}")
                except:
                    pass

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@router.get("/friends/{friend_id}")
def get_friend_chat_history(
    friend_id: int,
    limit: int = 50,
    before_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    query = select(ChatMessageModel).where(
        or_(
            and_(ChatMessageModel.sender_id == current_user.id, ChatMessageModel.recipient_id == friend_id),
            and_(ChatMessageModel.sender_id == friend_id, ChatMessageModel.recipient_id == current_user.id)
        )
    ).order_by(desc(ChatMessageModel.created_at), desc(ChatMessageModel.id))

    if before_id:
        query = query.where(ChatMessageModel.id < before_id)
        
    query = query.limit(limit)
    messages = db.execute(query).scalars().all()
    
    # Return in chronological order
    return list(reversed([{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "recipient_id": msg.recipient_id,
        "message_type": msg.message_type,
        "content": msg.content,
        "created_at": msg.created_at
    } for msg in messages]))

@router.get("/groups/{group_id}")
def get_group_chat_history(
    group_id: int,
    limit: int = 50,
    before_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    # Check membership
    stmt = select(GroupMemberModel).where(
        GroupMemberModel.group_id == group_id,
        GroupMemberModel.user_id == current_user.id
    )
    membership = db.execute(stmt).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    query = select(ChatMessageModel).where(
        ChatMessageModel.group_id == group_id
    ).order_by(desc(ChatMessageModel.created_at), desc(ChatMessageModel.id))

    if before_id:
        query = query.where(ChatMessageModel.id < before_id)
        
    query = query.limit(limit)
    messages = db.execute(query).scalars().all()
    
    return list(reversed([{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "group_id": msg.group_id,
        "message_type": msg.message_type,
        "content": msg.content,
        "created_at": msg.created_at
    } for msg in messages]))

@router.websocket("/ws")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user_for_stream)
):
    if not current_user:
        await websocket.close(code=1008)
        return
        
    await manager.connect(websocket, current_user.id)
    try:
        while True:
            # Refresh presence on activity
            try:
                redis_sync_client.setex(f"presence:user:{current_user.id}", 35, "online")
            except:
                pass

            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
                action = data.get("action")
                
                if action == "send_friend_message":
                    friend_id = data.get("friend_id")
                    content = data.get("content")
                    if friend_id and content:
                        # Save to DB
                        message = ChatMessageModel(
                            sender_id=current_user.id,
                            recipient_id=friend_id,
                            message_type="text",
                            content=content
                        )
                        db.add(message)
                        db.commit()
                        db.refresh(message)
                        
                        msg_data = {
                            "id": message.id,
                            "sender_id": message.sender_id,
                            "recipient_id": message.recipient_id,
                            "message_type": message.message_type,
                            "content": message.content,
                            "created_at": message.created_at.isoformat()
                        }
                        
                        # Send back to sender
                        await manager.send_personal_message(msg_data, current_user.id)
                        # Send to recipient
                        await manager.send_personal_message(msg_data, friend_id)

                elif action == "send_group_message":
                    group_id = data.get("group_id")
                    content = data.get("content")
                    if group_id and content:
                        # Check membership
                        stmt = select(GroupMemberModel).where(
                            GroupMemberModel.group_id == group_id,
                            GroupMemberModel.user_id == current_user.id
                        )
                        membership = db.execute(stmt).scalar_one_or_none()
                        if membership:
                            # Save to DB
                            message = ChatMessageModel(
                                sender_id=current_user.id,
                                group_id=group_id,
                                message_type="text",
                                content=content
                            )
                            db.add(message)
                            db.commit()
                            db.refresh(message)
                            
                            msg_data = {
                                "id": message.id,
                                "sender_id": message.sender_id,
                                "group_id": message.group_id,
                                "message_type": message.message_type,
                                "content": message.content,
                                "created_at": message.created_at.isoformat()
                            }
                            
                            # Broadcast to all group members
                            members = db.execute(
                                select(GroupMemberModel.user_id).where(GroupMemberModel.group_id == group_id)
                            ).scalars().all()
                            
                            for m_id in members:
                                await manager.send_personal_message(msg_data, m_id)

            except json.JSONDecodeError:
                pass
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user.id)
