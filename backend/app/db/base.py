"""
模組名稱: app.db.base
功能描述: 資料庫模型匯入中心 (Database Model Imports)

此模組專門用於匯入所有的 SQLAlchemy ORM 模型 (Models)。
主要目的是讓 Alembic (資料庫遷移工具) 在自動生成遷移檔時，能夠偵測到所有的資料表定義。
若新增了 Model 卻未在此處匯入，Alembic 將無法追蹤該資料表的變更。

匯入清單:
    - Base: SQLAlchemy Base 類別
    - UserModel: 使用者資料表
    - ProjectModel: 專案資料表
    - CourseModel, NodeModel: 課程與節點資料表
    - LessonModel: 課程內容資料表
"""

from app.db.base_class import Base
from app.models.user import UserModel
from app.models.project import ProjectModel
from app.models.course import CourseModel, NodeModel
from app.models.lesson import LessonModel
from app.models.job import JobModel
