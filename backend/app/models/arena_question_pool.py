from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time import utc_now_naive
from app.db.base import Base


class ArenaQuestionPoolModel(Base):
    __tablename__ = "arena_question_pools"
    __table_args__ = (
        UniqueConstraint("public_course_id", "slug", name="uq_arena_question_pools_course_slug"),
    )

    id = Column(Integer, primary_key=True, index=True)
    public_course_id = Column(Integer, ForeignKey("public_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    slug = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    version = Column(Integer, nullable=False, default=1)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    public_course = relationship("PublicCourseModel")
    items = relationship(
        "ArenaQuestionPoolItemModel",
        back_populates="pool",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ArenaQuestionPoolItemModel(Base):
    __tablename__ = "arena_question_pool_items"
    __table_args__ = (
        UniqueConstraint("pool_id", "question_key", name="uq_arena_question_pool_items_pool_question"),
        Index("ix_arena_question_pool_items_pool_difficulty", "pool_id", "difficulty"),
    )

    id = Column(Integer, primary_key=True, index=True)
    pool_id = Column(Integer, ForeignKey("arena_question_pools.id", ondelete="CASCADE"), nullable=False, index=True)
    question_key = Column(String, nullable=False, index=True)
    question_type = Column(String, nullable=False, default="MultipleChoice", index=True)
    prompt = Column(String, nullable=False)
    options_json = Column(JSON, nullable=False, default=list)
    correct_option_id = Column(String, nullable=True)
    difficulty = Column(String, nullable=False, default="normal", index=True)
    knowledge_tags_json = Column(JSON, nullable=False, default=list)
    explanation = Column(String, nullable=True)
    source_unit_id = Column(String, nullable=True)
    source_node_id = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    pool = relationship("ArenaQuestionPoolModel", back_populates="items")
