from sqlalchemy import Column, Integer, String
from app.db.base import Base


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    credits = Column(Integer, default=50)

    # 個人資料欄位
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    job_title = Column(String, nullable=True)  # 例如 "Full Stack Developer"
    education_level = Column(String, nullable=True)  # 例如 "Bachelor's Degree"
    daily_learning_goal_minutes = Column(Integer, default=30)
