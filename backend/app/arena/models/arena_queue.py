from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.core.time import utc_now
from app.db.base import Base
from app.arena.domain.arena_modes import ArenaMode
from app.arena.domain.arena_statuses import ArenaQueueStatus


class ArenaQueueEntryModel(Base):
    __tablename__ = "arena_queue_entries"
    __table_args__ = (
        Index("ix_arena_queue_entries_status_created", "status", "created_at"),
        Index("ix_arena_queue_entries_course_status_created", "public_course_id", "status", "created_at"),
        Index("ix_arena_queue_entries_pool_status_created", "question_pool_id", "status", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    season_id = Column(Integer, ForeignKey("arena_seasons.id", ondelete="SET NULL"), nullable=True, index=True)
    public_course_id = Column(Integer, ForeignKey("public_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    question_pool_id = Column(Integer, ForeignKey("arena_question_pools.id", ondelete="SET NULL"), nullable=True, index=True)
    mode = Column(String, nullable=False, default=ArenaMode.COMPETITIVE, index=True)
    status = Column(String, nullable=False, default=ArenaQueueStatus.WAITING, index=True)
    matched_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    match_id = Column(Integer, ForeignKey("arena_matches.id", ondelete="SET NULL"), nullable=True, index=True)
    match_found_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    public_course = relationship("PublicCourseModel")
    question_pool = relationship("ArenaQuestionPoolModel")
    user = relationship("UserModel", foreign_keys=[user_id])
    matched_user = relationship("UserModel", foreign_keys=[matched_user_id])
    match = relationship("ArenaMatchModel")
