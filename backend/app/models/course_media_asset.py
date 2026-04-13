from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.time import utc_now
from app.db.base import Base


class CourseMediaAssetModel(Base):
    __tablename__ = "course_media_assets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    source_filename = Column(String, nullable=False, index=True)
    asset_type = Column(String, nullable=False, default="image")
    asset_filename = Column(String, nullable=True)
    asset_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    page_number = Column(Integer, nullable=True)
    asset_index = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("UserModel", back_populates="media_assets")
    course = relationship("CourseModel", back_populates="media_assets")
