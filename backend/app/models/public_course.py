from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String

from app.core.time import utc_now
from app.db.base import Base


class PublicCourseModel(Base):
    __tablename__ = "public_courses"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, nullable=False, unique=True, index=True)
    title = Column(String, nullable=False, index=True)
    topic = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    is_published = Column(Boolean, nullable=False, default=False, index=True)
    is_featured_arena = Column(Boolean, nullable=False, default=False, index=True)
    tags_json = Column(JSON, nullable=False, default=list)
    metadata_json = Column(JSON, nullable=True)
    syllabus_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

