from pydantic_settings import BaseSettings, SettingsConfigDict

class ArenaSettings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True, 
        env_file=".env", 
        env_file_encoding='utf-8', 
        extra='ignore'
    )

    # Settings moved from core
    ARENA_ADMIN_EMAILS: str = ""
    ARENA_ROOM_IDLE_CLOSE_MINUTES: int = 15
    ARENA_QUEUE_EXPIRE_MINUTES: int = 3
    ARENA_MATCH_STALE_FINALIZE_SECONDS: int = 900
    
    # Hardcoded defaults moved to config
    ARENA_DEFAULT_RATING: int = 1000
    ARENA_DEFAULT_MAX_PLAYERS: int = 8
    ARENA_DEFAULT_ROUND_COUNT: int = 5
    ARENA_DEFAULT_ROUND_TIME_SECONDS: int = 30

arena_settings = ArenaSettings()
