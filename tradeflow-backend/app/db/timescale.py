import asyncpg
import logging
from typing import List, Any
from app.config import settings

logger = logging.getLogger(__name__)

class TimescaleManager:
    def __init__(self):
        self.pool = None

    async def connect(self):
        try:
            self.pool = await asyncpg.create_pool(
                dsn=settings.TIMESCALE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60
            )
            logger.info("Successfully connected to TimescaleDB")
        except Exception as e:
            logger.error(f"Failed to connect to TimescaleDB: {e}")
            raise e

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            logger.info("Disconnected from TimescaleDB")

    async def execute(self, query: str, *args):
        if not self.pool:
            raise Exception("TimescaleDB not initialized")
        async with self.pool.acquire() as connection:
            return await connection.execute(query, *args)

    async def fetch(self, query: str, *args) -> List[Any]:
        if not self.pool:
            raise Exception("TimescaleDB not initialized")
        async with self.pool.acquire() as connection:
            return await connection.fetch(query, *args)

    async def fetchrow(self, query: str, *args) -> Any:
        if not self.pool:
            raise Exception("TimescaleDB not initialized")
        async with self.pool.acquire() as connection:
            return await connection.fetchrow(query, *args)

timescale_manager = TimescaleManager()
