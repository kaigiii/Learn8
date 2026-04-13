from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.time import utc_now
from app.domain.statuses import (
    LessonFailedStageStatus,
    LessonSessionPhase,
    LessonSessionStatus,
)


class LessonModel(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        Index(
            "ix_lessons_user_course_node_topic",
            "user_id",
            "course_id",
            "node_id",
            "course_topic",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    node_id = Column(String, index=True)
    course_topic = Column(String, index=True)
    status = Column(String, nullable=False, default="generated", index=True)
    stage_count = Column(Integer, nullable=False, default=0)
    question_count = Column(Integer, nullable=False, default=0)
    estimated_duration_minutes = Column(Integer, nullable=True)
    schema_version = Column(Integer, nullable=False, default=2)
    generator_provider = Column(String, nullable=True)
    generator_model = Column(String, nullable=True)
    generation_metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("UserModel", back_populates="lessons")
    course = relationship("CourseModel")
    stages = relationship(
        "LessonStageModel",
        back_populates="lesson",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LessonStageModel.stage_order",
    )
    sessions = relationship(
        "LessonSessionModel",
        back_populates="lesson",
        passive_deletes=True,
    )


class LessonStageModel(Base):
    __tablename__ = "lesson_stages"
    __table_args__ = (
        UniqueConstraint("lesson_id", "stage_uid", name="uq_lesson_stages_lesson_stage_uid"),
        UniqueConstraint("lesson_id", "stage_order", name="uq_lesson_stages_lesson_stage_order"),
        Index("ix_lesson_stages_lesson_component", "lesson_id", "component"),
        Index("ix_lesson_stages_lesson_difficulty", "lesson_id", "difficulty"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(
        Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_uid = Column(String, nullable=False, index=True)
    stage_order = Column(Integer, nullable=False)
    stage_type = Column(String, nullable=False, default="interactive", index=True)
    topic = Column(String, nullable=False)
    skin = Column(String, nullable=False)
    component = Column(String, nullable=False, index=True)
    difficulty = Column(String, nullable=True, index=True)
    recommended_duration_minutes = Column(Integer, nullable=True)
    item_count = Column(Integer, nullable=False, default=1)
    schema_version = Column(Integer, nullable=False, default=2)
    content_json = Column(JSON, nullable=False, default=dict)
    validation_json = Column(JSON, nullable=False, default=dict)
    feedback_json = Column(JSON, nullable=False, default=dict)
    stage_snapshot_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    lesson = relationship("LessonModel", back_populates="stages")
    session_stages = relationship(
        "LessonSessionStageModel",
        back_populates="lesson_stage",
        passive_deletes=True,
    )
    attempts = relationship(
        "LessonAttempt",
        back_populates="lesson_stage",
        passive_deletes=True,
    )


class LessonAttempt(Base):
    __tablename__ = "lesson_attempts"

    id = Column(Integer, primary_key=True, index=True)
    lesson_session_id = Column(Integer, ForeignKey("lesson_sessions.id", ondelete="CASCADE"), index=True)
    lesson_session_stage_id = Column(
        Integer, ForeignKey("lesson_session_stages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    lesson_stage_id = Column(
        Integer, ForeignKey("lesson_stages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    node_id = Column(String, index=True)
    course_topic = Column(String, index=True)
    stage_id = Column(String, index=True)
    stage_order = Column(Integer, nullable=True, index=True)
    component = Column(String, nullable=True)
    phase = Column(String, nullable=True, default=LessonSessionPhase.PRIMARY)
    attempt_number = Column(Integer, nullable=False, default=1)
    result = Column(String, nullable=True, index=True)
    user_input = Column(String)
    is_correct = Column(String)  # 'true'/'false' 字串（若資料庫支援可改為 Boolean）
    user_input_json = Column(JSON, nullable=True)
    evaluation_json = Column(JSON, nullable=True)
    stage_snapshot_json = Column(JSON, nullable=True)
    is_correct_bool = Column(Boolean, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)

    lesson_session = relationship("LessonSessionModel", back_populates="attempts")
    lesson_session_stage = relationship("LessonSessionStageModel", back_populates="attempts")
    lesson_stage = relationship("LessonStageModel", back_populates="attempts")
    user = relationship("UserModel", back_populates="lesson_attempts")
    course = relationship("CourseModel", back_populates="lesson_attempts")


class LessonSessionModel(Base):
    __tablename__ = "lesson_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True, index=True)
    node_id = Column(String, nullable=False, index=True)
    course_topic = Column(String, nullable=False, index=True)
    status = Column(
        String, nullable=False, default=LessonSessionStatus.PLAYING_PRIMARY, index=True
    )
    active_phase = Column(String, nullable=False, default=LessonSessionPhase.PRIMARY)
    active_stage_order = Column(Integer, nullable=False, default=0)
    total_stage_count = Column(Integer, nullable=False, default=0)
    primary_stage_count = Column(Integer, nullable=False, default=0)
    remedial_stage_count = Column(Integer, nullable=False, default=0)
    schema_version = Column(Integer, nullable=False, default=2)
    hints_used_count = Column(Integer, nullable=False, default=0)
    reward_eligible = Column(Boolean, nullable=False, default=True)
    started_at = Column(DateTime(timezone=True), default=utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("UserModel", back_populates="lesson_sessions")
    course = relationship("CourseModel", back_populates="lesson_sessions")
    lesson = relationship("LessonModel", back_populates="sessions")
    attempts = relationship(
        "LessonAttempt",
        back_populates="lesson_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    session_stages = relationship(
        "LessonSessionStageModel",
        back_populates="lesson_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LessonSessionStageModel.stage_order",
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


class LessonSessionStageModel(Base):
    __tablename__ = "lesson_session_stages"
    __table_args__ = (
        UniqueConstraint(
            "lesson_session_id",
            "phase",
            "stage_uid",
            name="uq_lesson_session_stages_session_stage_uid",
        ),
        UniqueConstraint(
            "lesson_session_id",
            "phase",
            "stage_order",
            name="uq_lesson_session_stages_session_stage_order",
        ),
        Index("ix_lesson_session_stages_session_phase", "lesson_session_id", "phase"),
        Index("ix_lesson_session_stages_session_status", "lesson_session_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lesson_session_id = Column(
        Integer, ForeignKey("lesson_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_stage_id = Column(
        Integer, ForeignKey("lesson_stages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    lesson_remedial_stage_id = Column(
        Integer,
        ForeignKey("lesson_remedial_stages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    stage_uid = Column(String, nullable=False, index=True)
    stage_order = Column(Integer, nullable=False)
    phase = Column(String, nullable=False, default=LessonSessionPhase.PRIMARY, index=True)
    source_stage_uid = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="pending", index=True)
    topic = Column(String, nullable=False)
    skin = Column(String, nullable=False)
    component = Column(String, nullable=False, index=True)
    difficulty = Column(String, nullable=True, index=True)
    recommended_duration_minutes = Column(Integer, nullable=True)
    item_count = Column(Integer, nullable=False, default=1)
    schema_version = Column(Integer, nullable=False, default=2)
    content_json = Column(JSON, nullable=False, default=dict)
    validation_json = Column(JSON, nullable=False, default=dict)
    feedback_json = Column(JSON, nullable=False, default=dict)
    stage_snapshot_json = Column(JSON, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    lesson_session = relationship("LessonSessionModel", back_populates="session_stages")
    lesson_stage = relationship("LessonStageModel", back_populates="session_stages")
    lesson_remedial_stage = relationship("LessonRemedialStageModel", back_populates="session_stages")
    attempts = relationship(
        "LessonAttempt",
        back_populates="lesson_session_stage",
        passive_deletes=True,
    )
    failed_stage_records = relationship(
        "LessonFailedStageModel",
        back_populates="lesson_session_stage",
        passive_deletes=True,
    )


class LessonFailedStageModel(Base):
    __tablename__ = "lesson_failed_stages"

    id = Column(Integer, primary_key=True, index=True)
    lesson_session_id = Column(
        Integer, ForeignKey("lesson_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_session_stage_id = Column(
        Integer, ForeignKey("lesson_session_stages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    lesson_stage_id = Column(
        Integer, ForeignKey("lesson_stages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    node_id = Column(String, nullable=False, index=True)
    course_topic = Column(String, nullable=False, index=True)
    stage_id = Column(String, nullable=False, index=True)
    stage_order = Column(Integer, nullable=True, index=True)
    component = Column(String, nullable=True)
    difficulty = Column(String, nullable=True)
    recommended_duration_minutes = Column(Integer, nullable=True)
    item_count = Column(Integer, nullable=False, default=1)
    source_phase = Column(String, nullable=False, default=LessonSessionPhase.PRIMARY)
    status = Column(String, nullable=False, default=LessonFailedStageStatus.PENDING, index=True)
    stage_snapshot_json = Column(JSON, nullable=False)
    user_input_json = Column(JSON, nullable=True)
    evaluation_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    lesson_session = relationship("LessonSessionModel", back_populates="failed_stages")
    lesson_session_stage = relationship("LessonSessionStageModel", back_populates="failed_stage_records")
    user = relationship("UserModel", back_populates="lesson_failed_stages")
    course = relationship("CourseModel", back_populates="lesson_failed_stages")


class LessonRemedialModel(Base):
    __tablename__ = "lesson_remedials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    lesson_session_id = Column(Integer, ForeignKey("lesson_sessions.id", ondelete="CASCADE"), nullable=True)
    node_id = Column(String, index=True)
    course_topic = Column(String, index=True)
    stage_count = Column(Integer, nullable=False, default=0)
    question_count = Column(Integer, nullable=False, default=0)
    estimated_duration_minutes = Column(Integer, nullable=True)
    schema_version = Column(Integer, nullable=False, default=2)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("UserModel", back_populates="lesson_remedials")
    course = relationship("CourseModel", back_populates="lesson_remedials")
    lesson_session = relationship("LessonSessionModel", back_populates="remedials")
    stages = relationship(
        "LessonRemedialStageModel",
        back_populates="remedial",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LessonRemedialStageModel.stage_order",
    )


class LessonRemedialStageModel(Base):
    __tablename__ = "lesson_remedial_stages"
    __table_args__ = (
        UniqueConstraint(
            "lesson_remedial_id",
            "stage_uid",
            name="uq_lesson_remedial_stages_remedial_stage_uid",
        ),
        UniqueConstraint(
            "lesson_remedial_id",
            "stage_order",
            name="uq_lesson_remedial_stages_remedial_stage_order",
        ),
        Index("ix_lesson_remedial_stages_remedial_component", "lesson_remedial_id", "component"),
        Index("ix_lesson_remedial_stages_remedial_difficulty", "lesson_remedial_id", "difficulty"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lesson_remedial_id = Column(
        Integer, ForeignKey("lesson_remedials.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_uid = Column(String, nullable=False, index=True)
    stage_order = Column(Integer, nullable=False)
    stage_type = Column(String, nullable=False, default="interactive", index=True)
    topic = Column(String, nullable=False)
    skin = Column(String, nullable=False)
    component = Column(String, nullable=False, index=True)
    difficulty = Column(String, nullable=True, index=True)
    recommended_duration_minutes = Column(Integer, nullable=True)
    item_count = Column(Integer, nullable=False, default=1)
    schema_version = Column(Integer, nullable=False, default=2)
    content_json = Column(JSON, nullable=False, default=dict)
    validation_json = Column(JSON, nullable=False, default=dict)
    feedback_json = Column(JSON, nullable=False, default=dict)
    stage_snapshot_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    remedial = relationship("LessonRemedialModel", back_populates="stages")
    session_stages = relationship(
        "LessonSessionStageModel",
        back_populates="lesson_remedial_stage",
        passive_deletes=True,
    )
