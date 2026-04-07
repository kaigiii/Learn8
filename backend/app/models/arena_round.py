from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time import utc_now_naive
from app.db.base import Base
from app.domain.arena_statuses import ArenaRoundStatus


class ArenaRoundModel(Base):
    __tablename__ = "arena_rounds"
    __table_args__ = (
        UniqueConstraint("match_id", "round_index", name="uq_arena_rounds_match_round"),
        Index("ix_arena_rounds_match_status", "match_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("arena_matches.id", ondelete="CASCADE"), nullable=False, index=True)
    round_index = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default=ArenaRoundStatus.PENDING, index=True)
    question_snapshot_json = Column(JSON, nullable=False, default=dict)
    timer_seconds = Column(Integer, nullable=False, default=30)
    revealed_answer_json = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    deadline_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    match = relationship("ArenaMatchModel")
    answers = relationship(
        "ArenaAnswerModel",
        back_populates="round",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ArenaAnswerModel(Base):
    __tablename__ = "arena_answers"
    __table_args__ = (
        UniqueConstraint("round_id", "user_id", name="uq_arena_answers_round_user"),
        Index("ix_arena_answers_match_user", "match_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("arena_matches.id", ondelete="CASCADE"), nullable=False, index=True)
    round_id = Column(Integer, ForeignKey("arena_rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    answer_payload_json = Column(JSON, nullable=False, default=dict)
    is_correct = Column(Boolean, nullable=False, default=False)
    score_awarded = Column(Integer, nullable=False, default=0)
    response_time_ms = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, default=utc_now_naive, nullable=False)

    round = relationship("ArenaRoundModel", back_populates="answers")
    user = relationship("UserModel")
