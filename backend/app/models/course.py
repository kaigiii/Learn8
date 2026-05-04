from sqlalchemy import (
    Column,
    Integer,
    String,
    JSON,
    DateTime,
    ForeignKey,
    Boolean,
)
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utc_now
from app.domain.statuses import CourseStatus, NodeStatus


class CourseModel(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    topic = Column(String, index=True)
    title = Column(String)
    status = Column(String, nullable=False, default=CourseStatus.DRAFT, index=True)
    folder_name = Column(String, unique=True, nullable=True)
    is_published = Column(Boolean, default=False, nullable=False, index=True)
    profile_json = Column(JSON, nullable=True)
    draft_json = Column(JSON, nullable=True)
    syllabus_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("UserModel", back_populates="courses")
    nodes = relationship(
        "NodeModel",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_attempts = relationship(
        "LessonAttempt",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_sessions = relationship(
        "LessonSessionModel",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_failed_stages = relationship(
        "LessonFailedStageModel",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_remedials = relationship(
        "LessonRemedialModel",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_generation_preferences = relationship(
        "LessonGenerationPreferenceModel",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    media_assets = relationship(
        "CourseMediaAssetModel",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class NodeModel(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"))
    node_id = Column(String, index=True)
    title = Column(String)
    status = Column(String, default=NodeStatus.LOCKED)
    data = Column(JSON)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    course = relationship("CourseModel", back_populates="nodes")
