"""
模組名稱: app.models.user
功能描述: 使用者資料模型 (User Model)

定義了系統中的使用者帳戶資訊。

資料表 (Tables):
    1. users (UserModel)
        - 欄位:
            - email: 使用者信箱 (唯一識別)。
            - hashed_password: 加密後的密碼 (絕不明文儲存)。
        
備註:
    目前系統的設計偏向 MVP (Minimum Viable Product)，
    因此使用者模型較為精簡，未來可擴充加入 Profile、Preferences 等欄位。
"""

from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class UserModel(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    credits = Column(Integer, default=50)

    # Personal Profile Fields
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    job_title = Column(String, nullable=True)     # e.g., "Full Stack Developer"
    education_level = Column(String, nullable=True) # e.g., "Bachelor's Degree"
    daily_learning_goal_minutes = Column(Integer, default=30)
