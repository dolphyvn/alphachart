from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import Pool
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class MariaDBManager:
    def __init__(self):
        self.engine = None
        self.session_factory = None

    async def connect(self):
        try:
            self.engine = create_async_engine(
                settings.MARIADB_URL,
                echo=settings.ENVIRONMENT == "development",
                pool_pre_ping=True,
                pool_recycle=3600,
            )
            self.session_factory = sessionmaker(
                self.engine, class_=AsyncSession, expire_on_commit=False
            )
            logger.info("Successfully connected to MariaDB")
        except Exception as e:
            logger.error(f"Failed to connect to MariaDB: {e}")
            raise e

    async def disconnect(self):
        if self.engine:
            await self.engine.dispose()
            logger.info("Disconnected from MariaDB")

    async def get_session(self) -> AsyncSession:
        if not self.session_factory:
            raise Exception("MariaDB not initialized")
        async with self.session_factory() as session:
            yield session

mariadb_manager = MariaDBManager()
