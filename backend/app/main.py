"""
模組名稱: app.main
功能描述: 後端應用程式入口點 (Application Entry Point)

這是整個 FastAPI 後端服務的啟動檔案。負責初始化應用程式實例、
掛載中介軟體 (Middleware)、建立資料庫連線以及註冊 API 路由。

主要流程:
    1. 建立資料庫表格: `Base.metadata.create_all` (用於開發階段自動建表)。
    2. 初始化 FastAPI App: 設定標題與版本。
    3. 設定 CORS: 允許跨域請求 (目前設定為允許所有來源 "*" 用于開發)。
    4. 註冊路由: 將 `api_router` 掛載到 `/api/v1` 路徑下。

啟動方式:
    通常由 Uvicorn 執行此檔案: `uvicorn app.main:app --reload`
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.db.base import Base # Imports all models
from app.db.session import engine

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to Learna v3 API"}
