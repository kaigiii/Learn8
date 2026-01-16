"""
模組名稱: app.models.course
功能描述: 課程體系資料模型 (Course & Node Models)

定義了構成課程大綱核心結構的資料表。

資料表 (Tables):
    1. courses (CourseModel)
        - 描述: 儲存課程大綱 (Syllabus) 的基本資訊。
        - 欄位:
            - topic: 使用者輸入的學習主題 (如 "Introduction to Python")。
            - syllabus_json: 完整的大綱結構 JSON (包含所有 Units 和 Nodes 的結構樹)。
            - project_id: 所屬專案 ID (外鍵)。

    2. nodes (NodeModel)
        - 描述: 扁平化儲存課程中的每一個學習節點 (Lesson Node)。
        - 目的: 方便快速查詢節點狀態，而不需要解析龐大的 syllabus_json。
        - 欄位:
            - node_id: 節點唯一識別碼 (如 "unit-1-node-2")。
            - status: 學習狀態 (locked | available | completed)。
            - data: 節點的詳細中繼資料 (Metadata)。

關聯性:
    - Course 與 Project 為多對一關係。
    - Node 與 Course 為多對一關係。
"""

from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import datetime

class CourseModel(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    topic = Column(String, index=True)
    title = Column(String)
    syllabus_json = Column(JSON) 
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class NodeModel(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    node_id = Column(String, index=True)
    title = Column(String)
    status = Column(String, default="locked") 
    data = Column(JSON)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
