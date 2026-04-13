from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String

from app.core.time import utc_now
from app.db.base import Base


class ArenaSeasonModel(Base):
    __tablename__ = "arena_seasons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, nullable=False, default="upcoming", index=True)
    is_active = Column(Boolean, nullable=False, default=False, index=True)
    leaderboard_config_json = Column(JSON, nullable=True)
    reward_config_json = Column(JSON, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

