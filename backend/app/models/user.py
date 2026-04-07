from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    credits = Column(Integer, default=50)
    xp = Column(Integer, default=0, nullable=False)
    level = Column(Integer, default=1, nullable=False)
    xp_to_next_level = Column(Integer, default=100, nullable=False)

    # 個人資料欄位
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    job_title = Column(String, nullable=True)  # 例如 "Full Stack Developer"
    education_level = Column(String, nullable=True)  # 例如 "Bachelor's Degree"
    preferred_language = Column(String, nullable=True)
    daily_learning_goal_minutes = Column(Integer, default=30)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)

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
    password_reset_tokens = relationship(
        "PasswordResetTokenModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    ledger_events = relationship(
        "UserLedgerEventModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lesson_generation_preferences = relationship(
        "LessonGenerationPreferenceModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    media_assets = relationship(
        "CourseMediaAssetModel",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
