"""
模組名稱: app.core.config
功能描述: 應用程式全域設定檔 (Application Configuration)

此模組負責管理後端應用程式所有的環境變數與設定參數。
使用 Pydantic 的 BaseSettings 類別來進行環境變數的讀取與驗證，
確保在不同環境 (Developer, Production) 下能安全地切換設定。

主要類別:
    - Settings: 設定模型，定義了所有可用的環境變數及其預設值。

主要屬性 (Attributes):
    - PROJECT_NAME (str): 專案名稱 (預設: "Learn8")
    - API_V1_STR (str): API 版本前綴 (預設: "/api/v1")
    - SECRET_KEY (str): 用於 JWT 加密簽名的密鑰 (應由 .env 讀取)
    - ALGORITHM (str): 加密演算法 (預設: "HS256")
    - ACCESS_TOKEN_EXPIRE_MINUTES (int): Access Token 的有效時間 (分鐘)
    - DATABASE_URL (str): 資料庫連線字串 (預設: SQLite)
    - GOOGLE_API_KEY (str): Google Gemini API 金鑰
    - LLM_PROVIDER (str): LLM 供應商選擇 (google | lmstudio)
    - GEMINI_MODEL (str): 使用的模型版本 (預設: "gemini-2.5-flash")

內部類別:
    - Config: 指定環境變數讀取規則 (大小寫敏感、讀取 .env 檔案)

實例化物件:
    - settings: 全域可用的設定實例，供其他模組 import 使用。
"""

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Learn8"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "supersecretkey123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 3000
    
    # Database
    DATABASE_URL: str = "sqlite:///./learn8_db/learn8.db"
    
    # AI / LLM
    GOOGLE_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "google" # google | lmstudio
    GEMINI_MODEL: str = "gemini-2.5-flash"
    LMSTUDIO_BASE_URL: str = "http://localhost:1234/v1"
    LMSTUDIO_MODEL: str = "mirothinker-v1.5-30b"
    LLM_TEMPERATURE: float = 0.7
    LMSTUDIO_MAX_TOKENS: int = 16384
    
    # RAG Settings
    RAG_ENABLE_QUERY_EXPANSION: bool = False
    RAG_TOP_K: int = 4
    RAG_SEARCH_K: int = 2
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 200
    
    # Workflow Settings
    SYLLABUS_CONCURRENCY_LIMIT: int = 3
    
    # Document Processing & Vision
    PDF_PARSE_STRATEGY: str = "hybrid" # basic | vision | hybrid
    VISION_LLM_PROVIDER: str = "google"
    VISION_GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # Application Limits & Pricing
    COST_SYLLABUS_GENERATION: int = 50
    COST_LESSON_GENERATION: int = 5
    COST_QUESTIONNAIRE_GENERATION: int = 5
    MAX_FILE_READ_BYTES: int = 50000
    MAX_COURSE_CONTEXT_BYTES: int = 30000
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
