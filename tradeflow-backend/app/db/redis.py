import redis.asyncio as redis
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self):
        self.redis: Optional[redis.Redis] = None

    async def connect(self):
        try:
            self.redis = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                decode_responses=True,
                encoding="utf-8"
            )
            await self.redis.ping()
            logger.info("Successfully connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise e

    async def disconnect(self):
        if self.redis:
            await self.redis.close()
            logger.info("Disconnected from Redis")

    async def get(self, key: str) -> Optional[str]:
        return await self.redis.get(key)

    async def set(self, key: str, value: str, expire: int = None):
        await self.redis.set(key, value, ex=expire)

    async def delete(self, key: str):
        await self.redis.delete(key)
        
    async def delete_pattern(self, pattern: str):
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)

redis_manager = RedisManager()
