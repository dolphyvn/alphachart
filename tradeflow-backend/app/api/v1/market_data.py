from fastapi import APIRouter, Header, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from app.core.security import verify_api_key
from app.services.market_data_service import MarketDataService

router = APIRouter()
logger = logging.getLogger(__name__)

class ChartInfo(BaseModel):
    symbol: str
    chart_number: int
    seconds_per_bar: int

class SierraChartBar(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    bid_volume: Optional[float] = None
    ask_volume: Optional[float] = None
    number_of_trades: Optional[int] = None
    open_interest: Optional[float] = None
    chart_info: ChartInfo
    
    @classmethod
    def parse_timestamp(cls, v):
        """Parse Sierra Chart timestamp: '2025-11-26 21:17:14'"""
        try:
            return datetime.strptime(v, "%Y-%m-%d %H:%M:%S")
        except:
            return datetime.fromisoformat(v.replace('Z', '+00:00'))

class SierraChartBatch(BaseModel):
    data: List[SierraChartBar]
    metadata: dict

@router.post("/")
async def receive_market_data(
    request: SierraChartBar,
    background_tasks: BackgroundTasks,
    x_api_key: Optional[str] = Header(None),
    service: MarketDataService = Depends()
):
    """
    Receive single bar from Sierra Chart
    
    Sierra Chart posts to this endpoint in real-time mode
    """
    # Verify API key
    if not verify_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    symbol = request.chart_info.symbol
    timeframe = f"{request.chart_info.seconds_per_bar}s"
    timestamp = request.parse_timestamp(request.timestamp)
    
    logger.info(f"Received bar: {symbol} @ {timestamp} ({timeframe})")
    
    # Store in TimescaleDB
    await service.store_bar(
        symbol=symbol,
        timeframe=timeframe,
        timestamp=timestamp,
        open=request.open,
        high=request.high,
        low=request.low,
        close=request.close,
        volume=request.volume,
        bid_volume=request.bid_volume,
        ask_volume=request.ask_volume,
        number_of_trades=request.number_of_trades,
        open_interest=request.open_interest
    )
    
    # Schedule background tasks
    background_tasks.add_task(
        service.aggregate_to_higher_timeframes,
        symbol, timeframe, timestamp
    )
    
    background_tasks.add_task(
        service.update_volume_profile,
        symbol, timestamp, request.close, request.volume,
        request.bid_volume, request.ask_volume
    )
    
    background_tasks.add_task(
        service.broadcast_tick,
        symbol, request.dict()
    )
    
    return {
        "status": "success",
        "symbol": symbol,
        "timeframe": timeframe
    }

@router.post("/batch")
async def receive_batch(
    request: SierraChartBatch,
    background_tasks: BackgroundTasks,
    x_api_key: Optional[str] = Header(None),
    service: MarketDataService = Depends()
):
    """
    Receive batch from Sierra Chart (Historical mode)
    
    Sierra Chart sends 50-100 bars per batch
    """
    if not verify_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    if not request.data:
        return {"status": "empty"}

    symbol = request.data[0].chart_info.symbol
    logger.info(f"Received batch: {len(request.data)} bars for {symbol}")
    
    # Bulk insert (fast!)
    stored_count = await service.store_batch(request.data)
    
    return {
        "status": "success",
        "bars_received": len(request.data),
        "bars_stored": stored_count,
        "symbol": symbol
    }

@router.get("/bars")
async def get_market_data(
    symbol: str,
    timeframe: str = "1m",
    limit: int = 500,
    service: MarketDataService = Depends()
):
    """
    Get market data for charting
    
    Supports all timeframes: 1s, 5s, 1m, 5m, 15m, 1h, 4h, 1d, 1w
    """
    bars = await service.get_bars(symbol, timeframe, limit)
    return bars

@router.get("/volume-profile")
async def get_volume_profile(
    symbol: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    service: MarketDataService = Depends()
):
    """
    Get volume profile for a specific range.
    If no time range provided, defaults to last 24 hours.
    """
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(days=1)
        
    profile = await service.get_volume_profile(symbol, start_time, end_time)
    return profile

@router.get("/footprint")
async def get_footprint(
    symbol: str,
    timeframe: str = "1m",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    service: MarketDataService = Depends()
):
    """
    Get footprint data (volume at price per bar).
    """
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(hours=1)
        
    footprint = await service.get_footprint_data(symbol, timeframe, start_time, end_time)
    return footprint
