import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint

from app.core.time import utc_now_naive
from app.db.base import Base


class ArenaEventModel(Base):
    __tablename__ = "arena_events"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_arena_events_event_id"),
        Index("ix_arena_events_room_cursor", "room_code", "id"),
        Index("ix_arena_events_match_cursor", "match_id", "id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(36), nullable=False, default=lambda: str(uuid.uuid4()))
    stream_type = Column(String, nullable=False, index=True)
    room_code = Column(String(12), nullable=True, index=True)
    match_id = Column(Integer, ForeignKey("arena_matches.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    payload_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=utc_now_naive, nullable=False)
