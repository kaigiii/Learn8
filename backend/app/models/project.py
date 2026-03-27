from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base
import datetime


class ProjectModel(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String, index=True)
    folder_name = Column(String, unique=True, nullable=False)
    profile_json = Column(JSON, nullable=True)
    draft_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("UserModel", back_populates="projects")
    course = relationship(
        "CourseModel",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lessons = relationship(
        "LessonModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_sessions = relationship(
        "LessonSessionModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_attempts = relationship(
        "LessonAttempt",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_failed_stages = relationship(
        "LessonFailedStageModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_remedials = relationship(
        "LessonRemedialModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    generation_jobs = relationship(
        "JobModel",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
