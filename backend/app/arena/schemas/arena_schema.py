from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from app.arena.domain.arena_modes import ArenaMode
from app.arena.domain.arena_statuses import ArenaRoomStatus, ArenaRoomVisibility


class ArenaModeEnum(str, Enum):
    private_room = ArenaMode.PRIVATE_ROOM
    competitive = ArenaMode.COMPETITIVE


class ArenaRoomVisibilityEnum(str, Enum):
    private = ArenaRoomVisibility.PRIVATE
    public = ArenaRoomVisibility.PUBLIC


class ArenaRoomStatusEnum(str, Enum):
    lobby = ArenaRoomStatus.LOBBY
    in_match = ArenaRoomStatus.IN_MATCH
    closed = ArenaRoomStatus.CLOSED


class ArenaPublicCourseSummary(BaseModel):
    id: int  # This remains course_id for backward compatibility or becomes pool_id? 
    poolId: int
    slug: str
    title: str # User sees Pool Title
    courseTitle: str # Secondary info
    topic: str
    description: Optional[str] = None
    isFeatured: bool = False
    tags: List[str] = Field(default_factory=list)


class ArenaSeasonSummary(BaseModel):
    id: int
    name: str
    status: str
    isActive: bool
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
