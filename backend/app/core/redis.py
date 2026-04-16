import logging
import redis.asyncio as aioredis
import redis as syncredis
from app.core.config import settings

logger = logging.getLogger(__name__)

# Async client for WebSockets
redis_client = aioredis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    health_check_interval=30
)

# Sync client for normal FastAPI synchronous routes
redis_sync_client = syncredis.from_url(
    settings.REDIS_URL,
    decode_responses=True
)

async def check_redis_health() -> bool:
    """Verify that Redis is healthy and reachable."""
    try:
        return await redis_client.ping()
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False
