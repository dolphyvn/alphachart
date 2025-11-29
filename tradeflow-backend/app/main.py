from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging
import time

# Import routers (commented out until they are implemented to avoid errors)
from app.api.v1 import (
    auth, market_data, indicators,
    # charts,
    orderflow, volume_profile, alerts,
    # workspaces, social, websocket
)
from app.config import settings
# from app.core.monitoring import setup_monitoring
from app.db.mariadb import mariadb_manager
from app.db.timescale import timescale_manager
from app.db.redis import redis_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting TradeFlow Pro API...")
    await mariadb_manager.connect()
    await timescale_manager.connect()
    await redis_manager.connect()
    # setup_monitoring(app)
    logger.info("✓ All systems operational")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await mariadb_manager.disconnect()
    await timescale_manager.disconnect()
    await redis_manager.disconnect()

app = FastAPI(
    title="TradeFlow Pro API",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    process_time = time.time() - start
    response.headers["X-Process-Time"] = f"{process_time:.3f}"
    return response

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(market_data.router, prefix="/api/v1/market-data", tags=["Market Data"])
# app.include_router(charts.router, prefix="/api/v1/charts", tags=["Charts"])
app.include_router(indicators.router, prefix="/api/v1/indicators", tags=["Indicators"])
app.include_router(orderflow.router, prefix="/api/v1/orderflow", tags=["Order Flow"])
app.include_router(volume_profile.router, prefix="/api/v1/volume-profile", tags=["Volume Profile"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
# app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["Workspaces"])
# app.include_router(social.router, prefix="/api/v1/social", tags=["Social"])
# app.include_router(websocket.router, prefix="/api/v1/ws", tags=["WebSocket"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
