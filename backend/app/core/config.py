
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Learna v3"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "supersecretkey123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 3000
    
    # Database
    DATABASE_URL: str = "sqlite:///./learna.db"
    
    # AI / LLM
    GOOGLE_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "freegemini" # google | freegemini | mock
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
