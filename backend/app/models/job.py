from sqlalchemy import Column, String, Integer, ForeignKey, JSON, DateTime
from sqlalchemy.sql import func
import uuid

from app.db.base_class import Base

class JobModel(Base):
    """
    非同步生成任務 (Generation Job)
    用來記錄需要長時間執行的 LLM 工作，作為 Server-Sent Events (SSE) 的狀態追蹤來源。
    """
    __tablename__ = "generation_jobs"

    # UUIDv4 as primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 關聯
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    
    # 任務類型 (SYLLABUS_GEN, QUESTIONNAIRE_GEN, etc.)
    job_type = Column(String(50), nullable=False)
    
    # 狀態 (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)
    status = Column(String(20), nullable=False, default="PENDING")
    
    # 執行進度 0-100
    progress = Column(Integer, default=0)
    
    # 顯示給前端看的進度訊息
    message = Column(String(255), nullable=True)
    
    # 執行結果的載體 (如 {"course_id": 123})
    result_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
