from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time import utc_now_naive
from app.db.base import Base
from app.domain.arena_statuses import ArenaMatchStatus


class ArenaMatchModel(Base):
    __tablename__ = "arena_matches"
    __table_args__ = (
        Index("ix_arena_matches_public_course_status", "public_course_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("arena_rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    public_course_id = Column(Integer, ForeignKey("public_courses.id", ondelete="RESTRICT"), nullable=False, index=True)
    mode = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default=ArenaMatchStatus.PENDING, index=True)
    room_snapshot_json = Column(JSON, nullable=False, default=dict)
    rules_snapshot_json = Column(JSON, nullable=False, default=dict)
    standings_json = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    public_course = relationship("PublicCourseModel")
    players = relationship(
        "ArenaMatchPlayerModel",
        back_populates="match",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ArenaMatchPlayerModel(Base):
    __tablename__ = "arena_match_players"
    __table_args__ = (
        UniqueConstraint("match_id", "user_id", name="uq_arena_match_players_match_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("arena_matches.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    final_rank = Column(Integer, nullable=True)
    score = Column(Integer, nullable=False, default=0)
    correct_count = Column(Integer, nullable=False, default=0)
    incorrect_count = Column(Integer, nullable=False, default=0)
    avg_response_ms = Column(Integer, nullable=True)
    rating_delta = Column(Integer, nullable=False, default=0)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive)

    match = relationship("ArenaMatchModel", back_populates="players")
    user = relationship("UserModel")

