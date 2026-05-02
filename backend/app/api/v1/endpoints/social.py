import random
import string
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_current_user
from app.models.user import UserModel
from app.models.friend import FriendModel
from app.models.group import GroupModel, GroupMemberModel
from app.arena.models.arena_rating import ArenaRatingModel
from app.arena.models.arena_room import ArenaInviteModel, ArenaRoomModel

router = APIRouter()

# --- Pydantic Schemas ---
class ArenaRoomInviteRequest(BaseModel):
    friend_id: int
    room_code: str

class FriendInviteRequest(BaseModel):
    friend_id: int

class FriendRespondRequest(BaseModel):
    friend_id: int
    action: str = Field(..., description="accept, reject, or block")

class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=255)

class GroupJoinRequest(BaseModel):
    invite_code: str = Field(..., min_length=4, max_length=20)


# --- Functions ---
def get_user_rating_and_rank(db: Session, user_id: int):
    rating = db.query(ArenaRatingModel).filter(ArenaRatingModel.user_id == user_id).first()
    if rating:
        return rating.rating, rating.rank_tier
    return 1000, "Bronze"


# --- Endpoint Methods ---

@router.get("/users")
def search_users(
    q: Optional[str] = Query(None, min_length=1),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """搜尋平台上的使用者 (排除自己)"""
    query = db.query(UserModel).filter(UserModel.id != current_user.id)
    if q:
        if q.strip().isdigit():
            query = query.filter(
                (UserModel.email.ilike(f"%{q}%")) |
                (UserModel.full_name.ilike(f"%{q}%")) |
                (UserModel.id == int(q.strip()))
            )
        else:
            query = query.filter(
                (UserModel.email.ilike(f"%{q}%")) |
                (UserModel.full_name.ilike(f"%{q}%"))
            )
    users = query.limit(20).all()
    
    result = []
    for u in users:
        rating, tier = get_user_rating_and_rank(db, u.id)
        result.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "rating": rating,
            "tier": tier
        })
    return result


@router.get("/friends")
def get_friends(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """獲取我的所有好友與邀請列表"""
    # 1. 我發送的好友邀請
    sent_invites = db.query(FriendModel).filter(FriendModel.user_id == current_user.id, FriendModel.status == "pending").all()
    # 2. 我收到的好友邀請
    received_invites = db.query(FriendModel).filter(FriendModel.friend_id == current_user.id, FriendModel.status == "pending").all()
    # 3. 雙向確認的好友列表
    friends1 = db.query(FriendModel).filter(FriendModel.user_id == current_user.id, FriendModel.status == "accepted").all()
    friends2 = db.query(FriendModel).filter(FriendModel.friend_id == current_user.id, FriendModel.status == "accepted").all()

    result_friends = []
    
    # 處理雙向好友
    for f in friends1:
        friend_user = db.query(UserModel).filter(UserModel.id == f.friend_id).first()
        if friend_user:
            rating, tier = get_user_rating_and_rank(db, friend_user.id)
            result_friends.append({
                "friend_record_id": f.id,
                "id": friend_user.id,
                "email": friend_user.email,
                "full_name": friend_user.full_name,
                "avatar_url": friend_user.avatar_url,
                "rating": rating,
                "tier": tier,
                "status": "accepted",
                "is_initiator": True
            })

    for f in friends2:
        friend_user = db.query(UserModel).filter(UserModel.id == f.user_id).first()
        if friend_user:
            rating, tier = get_user_rating_and_rank(db, friend_user.id)
            result_friends.append({
                "friend_record_id": f.id,
                "id": friend_user.id,
                "email": friend_user.email,
                "full_name": friend_user.full_name,
                "avatar_url": friend_user.avatar_url,
                "rating": rating,
                "tier": tier,
                "status": "accepted",
                "is_initiator": False
            })

    sent = []
    for f in sent_invites:
        friend_user = db.query(UserModel).filter(UserModel.id == f.friend_id).first()
        if friend_user:
            sent.append({
                "friend_record_id": f.id,
                "id": friend_user.id,
                "email": friend_user.email,
                "full_name": friend_user.full_name
            })

    received = []
    for f in received_invites:
        initiator = db.query(UserModel).filter(UserModel.id == f.user_id).first()
        if initiator:
            received.append({
                "friend_record_id": f.id,
                "id": initiator.id,
                "email": initiator.email,
                "full_name": initiator.full_name
            })

    return {
        "friends": result_friends,
        "sent_invites": sent,
        "received_invites": received
    }


@router.post("/friends/invite")
def invite_friend(
    req: FriendInviteRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """發送好友邀請"""
    if req.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="你不能加自己為好友")

    target_user = db.query(UserModel).filter(UserModel.id == req.friend_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="找不到該使用者")

    # 檢查是否已經存在關係
    existing = db.query(FriendModel).filter(
        ((FriendModel.user_id == current_user.id) & (FriendModel.friend_id == target_user.id)) |
        ((FriendModel.user_id == target_user.id) & (FriendModel.friend_id == current_user.id))
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="你們已經是好友了")
        elif existing.status == "pending":
            raise HTTPException(status_code=400, detail="邀請已經在處理中")
        else:
            raise HTTPException(status_code=400, detail="該對象已被封鎖或無法操作")

    # 建立新關係
    new_friend = FriendModel(
        user_id=current_user.id,
        friend_id=target_user.id,
        status="pending"
    )
    db.add(new_friend)
    db.commit()
    db.refresh(new_friend)

    return {"status": "ok", "message": "邀請已發出"}


@router.post("/friends/respond")
def respond_invite(
    req: FriendRespondRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """接受/拒絕邀請"""
    # 收到的邀請中，對方的 id 就是 req.friend_id
    f_record = db.query(FriendModel).filter(
        FriendModel.user_id == req.friend_id,
        FriendModel.friend_id == current_user.id,
        FriendModel.status == "pending"
    ).first()

    if not f_record:
        raise HTTPException(status_code=404, detail="找不到待處理的邀請")

    if req.action == "accept":
        f_record.status = "accepted"
        db.commit()
        return {"status": "ok", "message": "已接受好友邀請"}
    elif req.action == "reject":
        db.delete(f_record)
        db.commit()
        return {"status": "ok", "message": "已拒絕好友邀請"}
    else:
        raise HTTPException(status_code=400, detail="無效的操作動作")


@router.delete("/friends/{friend_id}")
def delete_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """解除好友關係"""
    f_record = db.query(FriendModel).filter(
        ((FriendModel.user_id == current_user.id) & (FriendModel.friend_id == friend_id)) |
        ((FriendModel.user_id == friend_id) & (FriendModel.friend_id == current_user.id))
    ).first()

    if not f_record:
        raise HTTPException(status_code=404, detail="好友關係不存在")

    db.delete(f_record)
    db.commit()
    return {"status": "ok", "message": "已解除好友關係"}


@router.post("/friends/arena-invite")
def invite_friend_to_arena(
    req: ArenaRoomInviteRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    room = db.query(ArenaRoomModel).filter(ArenaRoomModel.room_code == req.room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到該房間")

    invite = ArenaInviteModel(
        room_id=room.id,
        inviter_user_id=current_user.id,
        invitee_user_id=req.friend_id,
        status="pending"
    )
    db.add(invite)
    db.commit()
    return {"status": "ok", "message": "已成功發送房間邀請給好友"}


@router.get("/friends/arena-invites")
def get_arena_invites(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    invites = db.query(ArenaInviteModel).filter(
        ArenaInviteModel.invitee_user_id == current_user.id,
        ArenaInviteModel.status == "pending"
    ).all()

    results = []
    for invite in invites:
        room = db.query(ArenaRoomModel).filter(ArenaRoomModel.id == invite.room_id).first()
        inviter = db.query(UserModel).filter(UserModel.id == invite.inviter_user_id).first()
        if room and inviter:
            results.append({
                "id": invite.id,
                "room_code": room.room_code,
                "inviter_name": inviter.full_name or inviter.email.split("@")[0],
                "inviter_email": inviter.email
            })

    return {"status": "ok", "invites": results}


@router.post("/friends/arena-invites/{invite_id}/respond")
def respond_arena_invite(
    invite_id: int,
    action: str = Query(..., description="accept or ignore"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    invite = db.query(ArenaInviteModel).filter(
        ArenaInviteModel.id == invite_id,
        ArenaInviteModel.invitee_user_id == current_user.id
    ).first()

    if not invite:
        raise HTTPException(status_code=404, detail="找不到該邀請")

    if action == "accept":
        invite.status = "accepted"
        db.commit()
        return {"status": "ok", "action": "accept"}
    else:
        invite.status = "ignored"
        db.commit()
        return {"status": "ok", "action": "ignored"}


@router.get("/groups")
def get_groups(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """獲取我加入的所有群組與其內排行榜"""
    memberships = db.query(GroupMemberModel).filter(GroupMemberModel.user_id == current_user.id).all()
    
    result = []
    for mem in memberships:
        grp = db.query(GroupModel).filter(GroupModel.id == mem.group_id).first()
        if grp:
            # 獲取組內成員與其排行
            all_mems = db.query(GroupMemberModel).filter(GroupMemberModel.group_id == grp.id).all()
            mem_list = []
            for m in all_mems:
                u = db.query(UserModel).filter(UserModel.id == m.user_id).first()
                if u:
                    rating, tier = get_user_rating_and_rank(db, u.id)
                    mem_list.append({
                        "id": u.id,
                        "email": u.email,
                        "full_name": u.full_name,
                        "is_admin": m.is_admin,
                        "rating": rating,
                        "tier": tier
                    })
            # 按積分由高到低排序
            mem_list.sort(key=lambda x: x["rating"], reverse=True)

            result.append({
                "id": grp.id,
                "name": grp.name,
                "description": grp.description,
                "invite_code": grp.invite_code,
                "is_owner": grp.owner_id == current_user.id,
                "created_at": grp.created_at,
                "members": mem_list
            })
    return result


@router.post("/groups")
def create_group(
    req: GroupCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """建立群組"""
    # 生成一組唯一的隨機邀請碼
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        exists = db.query(GroupModel).filter(GroupModel.invite_code == code).first()
        if not exists:
            break

    new_group = GroupModel(
        name=req.name.strip(),
        description=req.description.strip() if req.description else "",
        invite_code=code,
        owner_id=current_user.id
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    # 同時將群組擁有者加入組員並設為管理員
    member = GroupMemberModel(
        group_id=new_group.id,
        user_id=current_user.id,
        is_admin=True
    )
    db.add(member)
    db.commit()

    return {"status": "ok", "invite_code": code, "id": new_group.id}


@router.post("/groups/join")
def join_group(
    req: GroupJoinRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """透過邀請碼加入群組"""
    grp = db.query(GroupModel).filter(GroupModel.invite_code == req.invite_code.strip().upper()).first()
    if not grp:
        raise HTTPException(status_code=404, detail="無效的群組邀請碼")

    # 檢查是否已在群組中
    existing = db.query(GroupMemberModel).filter(
        GroupMemberModel.group_id == grp.id,
        GroupMemberModel.user_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="您已經是此群組的成員了")

    # 新增成員
    member = GroupMemberModel(
        group_id=grp.id,
        user_id=current_user.id,
        is_admin=False
    )
    db.add(member)
    db.commit()

    return {"status": "ok", "message": f"成功加入 {grp.name}"}


@router.delete("/groups/{group_id}/leave")
def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """退出群組"""
    grp = db.query(GroupModel).filter(GroupModel.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="找不到該群組")

    if grp.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="群組擁有者無法直接退出，請聯絡管理員或解散群組")

    member = db.query(GroupMemberModel).filter(
        GroupMemberModel.group_id == group_id,
        GroupMemberModel.user_id == current_user.id
    ).first()

    if not member:
        raise HTTPException(status_code=400, detail="您不是該群組的成員")

    db.delete(member)
    db.commit()
    return {"status": "ok", "message": "已成功退出群組"}


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """解散群組 (限 Owner)"""
    grp = db.query(GroupModel).filter(GroupModel.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="找不到該群組")

    if grp.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="只有群組擁有者可以解散群組")

    db.delete(grp)
    db.commit()
    return {"status": "ok", "message": "群組已成功解散"}


@router.delete("/groups/{group_id}/members/{user_id}")
def remove_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """移除群組成員 (限 Owner)"""
    grp = db.query(GroupModel).filter(GroupModel.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="找不到該群組")

    if grp.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="只有群組擁有者可以移除成員")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="您不能將自己從群組中移除，請聯絡管理員或解散群組")

    member = db.query(GroupMemberModel).filter(
        GroupMemberModel.group_id == group_id,
        GroupMemberModel.user_id == user_id
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="該使用者不是該群組的成員")

    db.delete(member)
    db.commit()
    return {"status": "ok", "message": "成員已成功從群組移除"}

