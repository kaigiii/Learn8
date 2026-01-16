"""
模組名稱: app.models.lesson
功能描述: 課程內容與學習紀錄模型 (Lesson Content & Attempts)

定義了實際生成的教學內容以及學生的答題紀錄。

資料表 (Tables):
    1. lessons (LessonModel)
        - 描述: 儲存 AI 針對特定節點 (Node) 生成的詳細教學內容。
        - 欄位:
            - node_id: 對應的節點 ID。
            - course_topic: 課程主題上下文。
            - stage_json: 核心欄位，儲存多階段 (Multi-stage) 的課程內容 List。
              包含教學 (Instruction)、練習 (Practice)、測驗 (Assessment) 等階段的完整設定。

    2. lesson_attempts (LessonAttempt)
        - 描述: 記錄學生在互動過程中的每一次答題嘗試。
        - 用途: 用於數據分析、學習歷程追蹤，以及 AI 補救教學的依據。
        - 欄位:
            - stage_id: 嘗試的階段 ID。
            - user_input: 學生的輸入內容 (可能是選項、程式碼或文字解釋)。
            - is_correct: 答題是否正確。
"""

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
