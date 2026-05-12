from typing import List, Optional

from pydantic import BaseModel, Field

from app.arena.schemas.arena_schema import ArenaModeEnum, ArenaRoomStatusEnum, ArenaRoomVisibilityEnum


class ArenaRoomCreateRequest(BaseModel):
    publicCourseId: int
    mode: ArenaModeEnum = ArenaModeEnum.private_room
    visibility: ArenaRoomVisibilityEnum = ArenaRoomVisibilityEnum.private
    maxPlayers: int = Field(default=4, ge=2, le=8)
    roundCount: int = Field(default=5, ge=1, le=20)
    roundTimeSeconds: int = Field(default=15, ge=10, le=120)


class ArenaRoomSettingsUpdateRequest(BaseModel):
    questionType: Optional[str] = Field(default=None, min_length=1)
    poolId: Optional[int] = Field(default=None, ge=1)


class ArenaRoomPlayerResponse(BaseModel):
    userId: int
    displayName: str
    avatarUrl: Optional[str] = None
    isHost: bool
    isReady: bool
    team: Optional[str] = None
    joinedAt: str
    connectionState: Optional[str] = None


class ArenaRoomResponse(BaseModel):
    roomCode: str
    hostUserId: int
    publicCourseId: int
    publicCourseTitle: str
    poolId: int
    poolTitle: Optional[str] = None
    selectedQuestionType: Optional[str] = None
    mode: str
    visibility: str
    status: ArenaRoomStatusEnum
    maxPlayers: int
    roundCount: int
    roundTimeSeconds: int
    playerCount: int
    canStart: bool
    players: List[ArenaRoomPlayerResponse]
    latestMatchId: Optional[int] = None
    createdAt: str
    updatedAt: str


class ArenaRoomReadyRequest(BaseModel):
    isReady: bool


class ArenaRoomTransferHostRequest(BaseModel):
    newHostUserId: int


class ArenaRoomKickPlayerRequest(BaseModel):
    userId: int


class ArenaRoomJoinRequest(BaseModel):
    roomCode: str = Field(min_length=4, max_length=12)


class ArenaRoomStartResponse(BaseModel):
    roomCode: str
    matchId: int
    status: str


class ArenaRoomCreateResponse(BaseModel):
    roomCode: str
    status: str
