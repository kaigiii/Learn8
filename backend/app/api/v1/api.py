"""
模組名稱: app.api.v1.api
功能描述: API 路由中心 (Central Router)

此模組負責彙整 V1 版本所有的子路由 (Sub-routers)。
透過 `api_router.include_router` 將不同功能的 endpoints 註冊到主應用程式中。

路由結構:
    - /auth: 認證相關 (登入、註冊)。
    - /projects: 專案管理 (建立、刪除、檔案上傳)。
    - /courses: 課程大綱管理 (生成、查詢、狀態更新)。
    - /lessons: 單元內容生成與互動 (提交答案、生成補救教學)。
    - /system: 系統層級功能 (健康檢查等)。

這種結構設計確保了 API 的擴充性與模組化，避免單一檔案過於龐大。
"""

from fastapi import APIRouter
from app.api.v1.endpoints import auth, projects, courses, lessons, system

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(system.router, prefix="/system", tags=["system"]) # Paths like /submit-answer
