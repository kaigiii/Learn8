from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")

    PROJECT_NAME: str = "Learn8"
    API_V1_STR: str = "/api/v1"
    CORS_ALLOW_ORIGINS: str = "*"

    # Security
    SECRET_KEY: str = "supersecretkey123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 3000
    AUTH_MAX_LOGIN_ATTEMPTS: int = 5
    AUTH_LOCKOUT_MINUTES: int = 15
    AUTH_MAX_RESET_REQUESTS_PER_HOUR: int = 3
    AUTH_RESET_TOKEN_TTL_MINUTES: int = 30
    AUTH_DEBUG_EXPOSE_RESET_TOKEN: bool = False
    AUTH_ENABLE_DEV_LOGIN: bool = False
    AUTH_DEV_LOGIN_EMAIL: str = "dev@learn8.ai"
    AUTH_DEV_LOGIN_PASSWORD: str = "dev_password"
    ARENA_ADMIN_EMAILS: str = ""
    ARENA_ROOM_IDLE_CLOSE_MINUTES: int = 15
    JOB_STALE_TIMEOUT_MINUTES: int = 10

    # Database
    DATABASE_URL: str  # Required to be set in .env

    # AI / LLM
    GOOGLE_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "google"  # google | lmstudio
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
    ARENA_QUEUE_EXPIRE_MINUTES: int = 3
    ARENA_MATCH_STALE_FINALIZE_SECONDS: int = 900

    # Document Processing & Vision
    PDF_PARSE_STRATEGY: str = "hybrid"  # basic | vision | hybrid
    VISION_LLM_PROVIDER: str = "google"
    VISION_GEMINI_MODEL: str = "gemini-2.5-flash"

    # Application Limits & Pricing
    COST_SYLLABUS_GENERATION: int = 50
    COST_LESSON_GENERATION: int = 5
    COST_QUESTIONNAIRE_GENERATION: int = 5
    MAX_FILE_READ_BYTES: int = 50000
    MAX_COURSE_CONTEXT_BYTES: int = 30000

    # Content Whitelists (Comma-separated filenames)
    ENABLED_PUBLIC_COURSES: str = "ai_neural_networks.yaml,python_fundamentals.yaml,world_history.yaml"
    ENABLED_GAME_MODULES: str = "ExplainerMedia.yaml,FeynmanMirror.yaml,MatchingPairs.yaml,MultipleChoice.yaml,Ordering.yaml"

settings = Settings()
