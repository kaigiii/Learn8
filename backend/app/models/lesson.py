
from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey
from app.db.base_class import Base
import datetime

class LessonModel(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    node_id = Column(String, index=True)
    course_topic = Column(String, index=True)
    stage_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LessonAttempt(Base):
    __tablename__ = "lesson_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stage_id = Column(String, index=True)
    user_input = Column(String) 
    is_correct = Column(String) # 'true'/'false' or boolean if DB supports
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
