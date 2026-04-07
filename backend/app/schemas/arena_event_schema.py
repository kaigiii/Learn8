from typing import Any, Optional

from pydantic import BaseModel, Field


class ArenaEventEnvelope(BaseModel):
    cursor: int
    eventId: str
    streamType: str
    roomCode: Optional[str] = None
    matchId: Optional[int] = None
    eventType: str
    version: int = 1
    payload: dict[str, Any] = Field(default_factory=dict)
    createdAt: str


class ArenaEventListResponse(BaseModel):
    items: list[ArenaEventEnvelope] = Field(default_factory=list)
