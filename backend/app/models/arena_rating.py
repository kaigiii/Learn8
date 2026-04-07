from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time import utc_now_naive
from app.db.base import Base
from app.domain.arena_ranks import ArenaRankTier


class ArenaRatingModel(Base):
    __tablename__ = "arena_ratings"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_arena_ratings_user"),
        Index("ix_arena_ratings_rating", "rating"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False, default=1000)
    rank_tier = Column(String, nullable=False, default=ArenaRankTier.BRONZE, index=True)
    wins = Column(Integer, nullable=False, default=0)
    losses = Column(Integer, nullable=False, default=0)
    draws = Column(Integer, nullable=False, default=0)
    ranked_matches = Column(Integer, nullable=False, default=0)
    best_rank_tier = Column(String, nullable=False, default=ArenaRankTier.BRONZE)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    created_at = Column(DateTime, default=utc_now_naive)

    user = relationship("UserModel")


class ArenaPlayerTopicRatingModel(Base):
    __tablename__ = "arena_player_topic_ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "public_course_id", name="uq_arena_player_topic_ratings_user_course"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    public_course_id = Column(Integer, ForeignKey("public_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False, default=1000)
    rank_tier = Column(String, nullable=False, default=ArenaRankTier.BRONZE)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    created_at = Column(DateTime, default=utc_now_naive)

    public_course = relationship("PublicCourseModel")


class ArenaRankHistoryModel(Base):
    __tablename__ = "arena_rank_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    season_id = Column(Integer, ForeignKey("arena_seasons.id", ondelete="SET NULL"), nullable=True, index=True)
    match_id = Column(Integer, ForeignKey("arena_matches.id", ondelete="SET NULL"), nullable=True, index=True)
    rating_before = Column(Integer, nullable=False, default=1000)
    rating_after = Column(Integer, nullable=False, default=1000)
    rating_delta = Column(Integer, nullable=False, default=0)
    rank_tier_before = Column(String, nullable=False, default=ArenaRankTier.BRONZE)
    rank_tier_after = Column(String, nullable=False, default=ArenaRankTier.BRONZE)
    created_at = Column(DateTime, default=utc_now_naive)

