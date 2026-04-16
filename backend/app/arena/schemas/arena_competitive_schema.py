from typing import Optional

from pydantic import BaseModel, Field


class ArenaCompetitiveQueueJoinRequest(BaseModel):
    publicCourseId: int
    poolId: Optional[int] = None # Preferred
    roundCount: int = Field(default=5, ge=1, le=20)
    roundTimeSeconds: int = Field(default=30, ge=10, le=120)


class ArenaCompetitiveQueueResponse(BaseModel):
    queueId: int
    status: str
    publicCourseId: int
    publicCourseTitle: str
    poolId: Optional[int] = None
    poolTitle: Optional[str] = None
    mode: str
    queuedAt: str
    expiresAt: Optional[str] = None
    matchId: Optional[int] = None
    matchedUserId: Optional[int] = None
