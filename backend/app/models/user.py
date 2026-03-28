from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    credits = Column(Integer, default=50)

    # 個人資料欄位
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    job_title = Column(String, nullable=True)  # 例如 "Full Stack Developer"
    education_level = Column(String, nullable=True)  # 例如 "Bachelor's Degree"
    daily_learning_goal_minutes = Column(Integer, default=30)

    courses = relationship(
        "CourseModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lessons = relationship(
        "LessonModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_sessions = relationship(
        "LessonSessionModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_attempts = relationship(
        "LessonAttempt",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_failed_stages = relationship(
        "LessonFailedStageModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_remedials = relationship(
        "LessonRemedialModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    generation_jobs = relationship(
        "JobModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
