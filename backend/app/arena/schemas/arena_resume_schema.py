from typing import Literal, Optional

from pydantic import BaseModel


class ArenaResumeResponse(BaseModel):
    destination: Literal["none", "queue", "lobby", "match"]
    roomCode: Optional[str] = None
    matchId: Optional[int] = None
    queueId: Optional[int] = None
