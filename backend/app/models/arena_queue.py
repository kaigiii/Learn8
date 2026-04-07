from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.core.time import utc_now_naive
from app.db.base import Base
from app.domain.arena_modes import ArenaMode
from app.domain.arena_statuses import ArenaQueueStatus


class ArenaQueueEntryModel(Base):
    __tablename__ = "arena_queue_entries"
    __table_args__ = (
        Index("ix_arena_queue_entries_status_created", "status", "created_at"),
        Index("ix_arena_queue_entries_course_status_created", "public_course_id", "status", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    season_id = Column(Integer, ForeignKey("arena_seasons.id", ondelete="SET NULL"), nullable=True, index=True)
    public_course_id = Column(Integer, ForeignKey("public_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    mode = Column(String, nullable=False, default=ArenaMode.COMPETITIVE, index=True)
    status = Column(String, nullable=False, default=ArenaQueueStatus.WAITING, index=True)
    matched_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    match_id = Column(Integer, ForeignKey("arena_matches.id", ondelete="SET NULL"), nullable=True, index=True)
    match_found_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    public_course = relationship("PublicCourseModel")
    user = relationship("UserModel", foreign_keys=[user_id])
    matched_user = relationship("UserModel", foreign_keys=[matched_user_id])
    match = relationship("ArenaMatchModel")
