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
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    topic = Column(String, index=True)
    title = Column(String)
    syllabus_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )


class NodeModel(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    node_id = Column(String, index=True)
    title = Column(String)
    status = Column(String, default="locked")
    data = Column(JSON)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
