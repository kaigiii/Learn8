from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.core.time import utc_now
from app.db.base import Base


class LessonGenerationPreferenceModel(Base):
    __tablename__ = "lesson_generation_preferences"
    __table_args__ = (
        Index(
            "ix_lesson_generation_preferences_user_course_node",
            "user_id",
            "course_id",
            "node_id",
            unique=True,
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id = Column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    node_id = Column(String, nullable=True, index=True)
    allowed_components_json = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("UserModel", back_populates="lesson_generation_preferences")
    course = relationship("CourseModel", back_populates="lesson_generation_preferences")
