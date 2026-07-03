from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the directory where this file (config.py) is located
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True, 
        env_file=BASE_DIR / ".env", 
        extra="ignore"
    )

    PROJECT_NAME: str = "Learn8"
    API_V1_STR: str = "/api/v1"
    CORS_ALLOW_ORIGINS: str = "*"

    # VoxCPM (Audio Service)
    AUDIO_ENABLED: bool = True
    VOXCPM_URL: str = "http://127.0.0.1:15060/v1/audio/speech"
    VOXCPM_UPLOAD_URL: str = "http://127.0.0.1:15060/v1/audio/upload"

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
    JOB_STALE_TIMEOUT_MINUTES: int = 10

    # Database & Cache
    DATABASE_URL: str  # Required to be set in .env
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI / LLM
    GOOGLE_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "google"  # google | lmstudio
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
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
    MAX_SYLLABUS_AUDIT_REFLECTIONS: int = 2
    PLANNER_AGENT_MODEL: str = "gemini-3.1-flash-lite"
    AUDITOR_AGENT_MODEL: str = "gemini-3.1-flash-lite"

    # Document Processing & Vision
    PDF_PARSE_STRATEGY: str = "hybrid"  # basic | vision | hybrid
    VISION_LLM_PROVIDER: str = "google"
    VISION_GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    IMAGE_FILTER_ENABLED: bool = True
    IMAGE_FILTER_MODEL_PATH: str = str(BASE_DIR / "app" / "core" / "model.pth")
    IMAGE_FILTER_IMAGE_SIZE: int = 224

    # Application Limits & Pricing
    COST_SYLLABUS_GENERATION: int = 50
    COST_LESSON_GENERATION: int = 5
    COST_QUESTIONNAIRE_GENERATION: int = 5
    MAX_FILE_READ_BYTES: int = 50000
    MAX_COURSE_CONTEXT_BYTES: int = 100000

    # Paths (Centralized Path Management)
    @property
    def BASE_DIR(self) -> Path:
        return BASE_DIR

    @property
    def DATA_DIR(self) -> Path:
        return BASE_DIR / "data"

    @property
    def UPLOAD_DIR(self) -> Path:
        return self.DATA_DIR / "uploads"

    @property
    def PRESETS_DIR(self) -> Path:
        return self.DATA_DIR / "presets"

    @property
    def CUSTOM_COURSES_DIR(self) -> Path:
        return self.DATA_DIR / "custom_published_courses"

    @property
    def OFFICIAL_COURSES_DIR(self) -> Path:
        return self.DATA_DIR / "official_courses"

    @property
    def GAME_MODULES_DIR(self) -> Path:
        return self.DATA_DIR / "game_modules"

    @property
    def LOG_DIR(self) -> Path:
        return self.DATA_DIR / "logs"

    # Content Whitelists (Comma-separated filenames)
    ENABLED_PUBLIC_COURSES: str = "ai_neural_networks.yaml,python_fundamentals.yaml,world_history.yaml"
    ENABLED_GAME_MODULES: str = "ExplainerMedia.yaml,FeynmanMirror.yaml,MatchingPairs.yaml,MultipleChoice.yaml,Ordering.yaml"
    FEYNMAN_DEFAULT_MAX_ROUNDS: int = 8
    DEFAULT_VOICE_PRESET: str = "preset_01"

settings = Settings()
