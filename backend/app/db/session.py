"""
模組名稱: app.db.session
功能描述: 資料庫連線階段 (Database Session)

此模組負責建立與資料庫的連線引擎 (Engine) 與會話工廠 (SessionLocal)。
應用程式在處理每個請求時，都會透過此處的 SessionLocal 產生一個獨立的資料庫會話。

主要物件:
    - engine: SQLAlchemy 連線引擎，負責底層的連線池管理。
      - connect_args={"check_same_thread": False}: 這是針對 SQLite 的特殊設定，允許跨執行緒存取。

    - SessionLocal: sessionmaker 產生的工廠函式。
      - autocommit=False: 關閉自動提交，確保交易 (Transaction) 安全。
      - autoflush=False: 關閉自動刷新，避免過早將變更寫入資料庫。

使用方式:
    通常搭配 `app.api.deps.get_db` 依賴注入使用，確保每個 Request 結束後 Session 會自動關閉。
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)

# [ADD] Ensure database directory exists for SQLite
if settings.DATABASE_URL.startswith("sqlite:///"):
    import os
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    # Remove file name to get directory
    db_dir = os.path.dirname(os.path.abspath(db_path))
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
