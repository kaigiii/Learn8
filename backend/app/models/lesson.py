from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import relationship
from app.db.base import Base
import datetime


class LessonModel(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        Index(
            "ix_lessons_user_project_node_topic",
            "user_id",
            "project_id",
            "node_id",
            "course_topic",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    node_id = Column(String, index=True)
    course_topic = Column(String, index=True)
    stage_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("UserModel", back_populates="lessons")
    project = relationship("ProjectModel", back_populates="lessons")
    sessions = relationship(
        "LessonSessionModel",
        back_populates="lesson",
        passive_deletes=True,
    )


class LessonAttempt(Base):
    __tablename__ = "lesson_attempts"

    id = Column(Integer, primary_key=True, index=True)
    lesson_session_id = Column(Integer, ForeignKey("lesson_sessions.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    node_id = Column(String, index=True)
    course_topic = Column(String, index=True)
    stage_id = Column(String, index=True)
    component = Column(String, nullable=True)
    phase = Column(String, nullable=True, default="primary")
    user_input = Column(String)
    is_correct = Column(String)  # 'true'/'false' 字串（若資料庫支援可改為 Boolean）
    user_input_json = Column(JSON, nullable=True)
    evaluation_json = Column(JSON, nullable=True)
    stage_snapshot_json = Column(JSON, nullable=True)
    is_correct_bool = Column(Boolean, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    lesson_session = relationship("LessonSessionModel", back_populates="attempts")
    user = relationship("UserModel", back_populates="lesson_attempts")
    project = relationship("ProjectModel", back_populates="lesson_attempts")
    course = relationship("CourseModel", back_populates="lesson_attempts")


class LessonSessionModel(Base):
    __tablename__ = "lesson_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True, index=True)
    node_id = Column(String, nullable=False, index=True)
    course_topic = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="playing_primary", index=True)
    active_phase = Column(String, nullable=False, default="primary")
    primary_stages_json = Column(JSON, nullable=False, default=list)
    remedial_stages_json = Column(JSON, nullable=True)
    hints_used_count = Column(Integer, nullable=False, default=0)
    reward_eligible = Column(Boolean, nullable=False, default=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    user = relationship("UserModel", back_populates="lesson_sessions")
    project = relationship("ProjectModel", back_populates="lesson_sessions")
    course = relationship("CourseModel", back_populates="lesson_sessions")
    lesson = relationship("LessonModel", back_populates="sessions")
    attempts = relationship(
        "LessonAttempt",
        back_populates="lesson_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    failed_stages = relationship(
        "LessonFailedStageModel",
        back_populates="lesson_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    remedials = relationship(
        "LessonRemedialModel",
        back_populates="lesson_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class LessonFailedStageModel(Base):
    __tablename__ = "lesson_failed_stages"

    id = Column(Integer, primary_key=True, index=True)
    lesson_session_id = Column(
        Integer, ForeignKey("lesson_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    node_id = Column(String, nullable=False, index=True)
    course_topic = Column(String, nullable=False, index=True)
    stage_id = Column(String, nullable=False, index=True)
    component = Column(String, nullable=True)
    source_phase = Column(String, nullable=False, default="primary")
    status = Column(String, nullable=False, default="pending", index=True)
    stage_snapshot_json = Column(JSON, nullable=False)
    user_input_json = Column(JSON, nullable=True)
    evaluation_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    resolved_at = Column(DateTime, nullable=True)

    lesson_session = relationship("LessonSessionModel", back_populates="failed_stages")
    user = relationship("UserModel", back_populates="lesson_failed_stages")
    project = relationship("ProjectModel", back_populates="lesson_failed_stages")
    course = relationship("CourseModel", back_populates="lesson_failed_stages")


class LessonRemedialModel(Base):
    __tablename__ = "lesson_remedials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    lesson_session_id = Column(Integer, ForeignKey("lesson_sessions.id", ondelete="CASCADE"), nullable=True)
    node_id = Column(String, index=True)
    course_topic = Column(String, index=True)
    stage_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    user = relationship("UserModel", back_populates="lesson_remedials")
    project = relationship("ProjectModel", back_populates="lesson_remedials")
    lesson_session = relationship("LessonSessionModel", back_populates="remedials")
