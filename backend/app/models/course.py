from sqlalchemy import (
    Column,
    Integer,
    String,
    JSON,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.db.base import Base
import datetime


class CourseModel(Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_courses_project_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    topic = Column(String, index=True)
    title = Column(String)
    syllabus_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    user = relationship("UserModel", back_populates="courses")
    project = relationship("ProjectModel", back_populates="course")
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


class NodeModel(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"))
    node_id = Column(String, index=True)
    title = Column(String)
    status = Column(String, default="locked")
    data = Column(JSON)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    course = relationship("CourseModel", back_populates="nodes")
