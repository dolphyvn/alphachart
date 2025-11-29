from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel

from app.services.indicator_service import indicator_service, IndicatorService
from app.services.market_data_service import MarketDataService

router = APIRouter()

class IndicatorRequest(BaseModel):
    symbol: str
    timeframe: str
    limit: int = 500
    
class SMARequest(IndicatorRequest):
    period: int = 14

class EMARequest(IndicatorRequest):
    period: int = 14

class RSIRequest(IndicatorRequest):
    period: int = 14

class MACDRequest(IndicatorRequest):
    fast: int = 12
    slow: int = 26
    signal: int = 9

class BollingerRequest(IndicatorRequest):
    period: int = 20
    std_dev: float = 2.0

@router.post("/sma")
async def get_sma(
    request: SMARequest,
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(request.symbol, request.timeframe, request.limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    # Reverse to have chronological order for calculation if get_bars returns newest first
    # Usually indicators need oldest to newest. get_bars returns ORDER BY time DESC (newest first)
    closes.reverse()
    
    values = indicator_service.calculate_sma(closes, request.period)
    
    # Return newest first to match chart data
    values.reverse()
    return {"values": values}

@router.post("/ema")
async def get_ema(
    request: EMARequest,
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(request.symbol, request.timeframe, request.limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    values = indicator_service.calculate_ema(closes, request.period)
    
    values.reverse()
    return {"values": values}

@router.post("/rsi")
async def get_rsi(
    request: RSIRequest,
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(request.symbol, request.timeframe, request.limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    values = indicator_service.calculate_rsi(closes, request.period)
    
    values.reverse()
    return {"values": values}

@router.post("/macd")
async def get_macd(
    request: MACDRequest,
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(request.symbol, request.timeframe, request.limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    result = indicator_service.calculate_macd(closes, request.fast, request.slow, request.signal)
    
    # Reverse all lists
    result["macd"].reverse()
    result["signal"].reverse()
    result["histogram"].reverse()
    
    return result

@router.post("/bollinger")
async def get_bollinger(
    request: BollingerRequest,
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(request.symbol, request.timeframe, request.limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    result = indicator_service.calculate_bollinger_bands(closes, request.period, request.std_dev)
    
    result["upper"].reverse()
    result["middle"].reverse()
    result["lower"].reverse()
    
    return result
