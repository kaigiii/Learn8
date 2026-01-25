"""
模組名稱: app.models.project
功能描述: 專案資料模型 (Project Model)

定義了使用者的專案 (Workspace) 概念。
專案是 Learn8 的核心隔離單位，所有的上傳檔案 (PDF) 與 RAG 向量索引
都基於 Project 進行實體隔離。

資料表 (Tables):
    1. projects (ProjectModel)
        - 欄位:
            - name: 顯示給使用者看的專案名稱。
            - folder_name: 系統內部使用的資料夾名稱 (UUID)，確保唯一性與路徑安全。
            - user_id: 專案擁有者。

安全機制:
    - folder_name 必須是唯一的，且通常由系統自動生成 (UUID4)，
      避免使用者輸入惡意路徑或發生名稱衝突。
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import datetime

class ProjectModel(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    folder_name = Column(String, unique=True, nullable=False)
    profile_json = Column(JSON, nullable=True)
    draft_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
