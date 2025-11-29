from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache

class Settings(BaseSettings):
    # App
    APP_NAME: str = "TradeFlow Pro"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "development_secret_key"  # Default for dev
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # MariaDB
    MARIADB_HOST: str = "localhost"
    MARIADB_PORT: int = 3307
    MARIADB_USER: str = "tradeflow"
    MARIADB_PASSWORD: str = "tradeflow"
    MARIADB_DATABASE: str = "tradeflow_db"
    
    # TimescaleDB
    TIMESCALE_HOST: str = "localhost"
    TIMESCALE_PORT: int = 5433
    TIMESCALE_USER: str = "tradeflow"
    TIMESCALE_PASSWORD: str = "tradeflow"
    TIMESCALE_DATABASE: str = "market_data_db"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6380
    REDIS_PASSWORD: str = ""
    
    # JWT
    JWT_SECRET_KEY: str = "development_jwt_secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # WebSocket
    WS_MAX_CONNECTIONS_PER_USER: int = 5
    
    # Caching
    CACHE_TTL_MARKET_DATA: int = 1  # seconds
    CACHE_TTL_INDICATORS: int = 5
    
    @property
    def MARIADB_URL(self) -> str:
        return f"mysql+aiomysql://{self.MARIADB_USER}:{self.MARIADB_PASSWORD}@{self.MARIADB_HOST}:{self.MARIADB_PORT}/{self.MARIADB_DATABASE}"
    
    @property
    def TIMESCALE_URL(self) -> str:
        return f"postgresql://{self.TIMESCALE_USER}:{self.TIMESCALE_PASSWORD}@{self.TIMESCALE_HOST}:{self.TIMESCALE_PORT}/{self.TIMESCALE_DATABASE}"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
