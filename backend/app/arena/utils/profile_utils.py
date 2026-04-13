from __future__ import annotations
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.models.user import UserModel

def build_user_snapshot(user: UserModel) -> dict[str, Any]:
    """
    Extracts relevant display fields from a UserModel to create a historical snapshot.
    """
    return {
        "userId": user.id,
        "displayName": user.full_name or user.email.split("@")[0],
        "avatarUrl": user.avatar_url,
        "level": user.level,
        "xp": user.xp,
    }
