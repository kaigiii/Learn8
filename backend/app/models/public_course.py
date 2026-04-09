from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String

from app.core.time import utc_now_naive
from app.db.base import Base


class PublicCourseModel(Base):
    __tablename__ = "public_courses"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, nullable=False, unique=True, index=True)
    title = Column(String, nullable=False, index=True)
    topic = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    difficulty = Column(String, nullable=False, default="intermediate")
    is_published = Column(Boolean, nullable=False, default=False, index=True)
    is_arena_enabled = Column(Boolean, nullable=False, default=False, index=True)
    tags_json = Column(JSON, nullable=False, default=list)
    metadata_json = Column(JSON, nullable=True)
    syllabus_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

