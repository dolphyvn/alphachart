from fastapi import APIRouter, Header, HTTPException, BackgroundTasks, Depends, Request
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

@router.post("")
@router.post("/")
async def receive_market_data(
    request: Request,
    background_tasks: BackgroundTasks,
    x_api_key: Optional[str] = Header(None),
    service: MarketDataService = Depends()
):
    """
    Receive single bar from Sierra Chart

    Sierra Chart posts to this endpoint in real-time mode
    Accepts both /api/v1/market-data and /api/v1/market-data/
    """
    # Log the incoming request for debugging
    import json

    # Verify API key
    if not verify_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API Key")

    try:
        # Parse raw JSON to see what Sierra Chart is sending
        raw_data = await request.json()
        logger.info(f"Sierra Chart raw data: {json.dumps(raw_data, indent=2)}")

        # Try to validate against our expected format
        try:
            chart_bar = SierraChartBar(**raw_data)
            symbol = chart_bar.chart_info.symbol
            timeframe = f"{chart_bar.chart_info.seconds_per_bar}s"
            timestamp = chart_bar.parse_timestamp(chart_bar.timestamp)

            # Extract data from validated object
            open_price = chart_bar.open
            high_price = chart_bar.high
            low_price = chart_bar.low
            close_price = chart_bar.close
            volume = chart_bar.volume
            bid_volume = chart_bar.bid_volume or 0.0
            ask_volume = chart_bar.ask_volume or 0.0
            number_of_trades = chart_bar.number_of_trades or 0
            open_interest = chart_bar.open_interest

        except Exception as validation_error:
            logger.error(f"Sierra Chart data validation failed: {validation_error}")
            logger.error(f"Raw data was: {raw_data}")

            # Fallback: try to extract basic fields manually
            symbol = raw_data.get('symbol', 'UNKNOWN')
            timeframe = '1m'  # default
            timestamp = datetime.strptime(raw_data.get('timestamp', '2025-01-01 00:00:00'), "%Y-%m-%d %H:%M:%S")

            open_price = raw_data.get('open', 0.0)
            high_price = raw_data.get('high', 0.0)
            low_price = raw_data.get('low', 0.0)
            close_price = raw_data.get('close', 0.0)
            volume = raw_data.get('volume', 0.0)
            bid_volume = raw_data.get('bid_volume', 0.0)
            ask_volume = raw_data.get('ask_volume', 0.0)
            number_of_trades = raw_data.get('number_of_trades', 0)
            open_interest = raw_data.get('open_interest')

        logger.info(f"Processing bar: {symbol} @ {timestamp} ({timeframe}) O:{open_price} H:{high_price} L:{low_price} C:{close_price} V:{volume}")

        # Store in TimescaleDB
        await service.store_bar(
            symbol=symbol,
            timeframe=timeframe,
            timestamp=timestamp,
            open=open_price,
            high=high_price,
            low=low_price,
            close=close_price,
            volume=volume,
            bid_volume=bid_volume,
            ask_volume=ask_volume,
            number_of_trades=number_of_trades,
            open_interest=open_interest
        )

        # Schedule background tasks
        background_tasks.add_task(
            service.aggregate_to_higher_timeframes,
            symbol, timeframe, timestamp
        )

        background_tasks.add_task(
            service.update_volume_profile,
            symbol, timestamp, close_price, volume,
            bid_volume, ask_volume
        )

        background_tasks.add_task(
            service.broadcast_tick,
            symbol, raw_data
        )

        return {
            "status": "success",
            "symbol": symbol,
            "timeframe": timeframe,
            "timestamp": timestamp.isoformat()
        }

    except Exception as e:
        logger.error(f"Error processing Sierra Chart data: {str(e)}")
        raise HTTPException(status_code=422, detail=f"Error processing data: {str(e)}")

@router.post("/batch")
@router.post("/batch/")
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

@router.get("/cvd")
async def get_cvd(
    symbol: str,
    timeframe: str = "1m",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    service: MarketDataService = Depends()
):
    """
    Get Cumulative Volume Delta (CVD) data.
    """
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(hours=1)

    cvd = await service.get_cvd_data(symbol, timeframe, start_time, end_time)
    return cvd

@router.get("/symbols/{symbol}")
async def get_symbol_info(
    symbol: str,
    service: MarketDataService = Depends()
):
    """
    Get detailed information about a specific symbol
    """
    symbol_info = await service.get_symbol_info(symbol)
    return symbol_info

@router.get("/symbols")
async def get_available_symbols(
    service: MarketDataService = Depends()
):
    """
    Get list of all available symbols from the database
    """
    symbols = await service.get_available_symbols()
    return {"symbols": symbols}
