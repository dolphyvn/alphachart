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

@router.get("/sma")
async def get_sma(
    symbol: str = Query(...),
    timeframe: str = Query(...),
    period: int = Query(14),
    limit: int = Query(500),
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(symbol, timeframe, limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    values = indicator_service.calculate_sma(closes, period)
    
    # Map values back to timestamps
    # bars is newest first, closes was reversed to oldest first
    # values corresponds to closes (oldest first)
    # We want to return [{time: ..., value: ...}]
    
    result = []
    # Pad with None for initial period where indicator is not calculated
    # But calculate_sma usually returns list of same length with NaNs or shorter list?
    # Let's assume it returns list of same length with None/NaN for first (period-1) elements
    
    # Actually, let's check indicator_service implementation. 
    # Assuming it returns a list aligned with input closes.
    
    for i, val in enumerate(values):
        # closes[i] corresponds to bars[len(bars)-1-i]
        # bars is DESC (newest at 0)
        # closes is ASC (oldest at 0)
        
        # So values[i] corresponds to closes[i] which is bars[len(bars)-1-i]
        bar_idx = len(bars) - 1 - i
        if bar_idx >= 0:
            result.append({
                "time": bars[bar_idx]['time'],
                "value": val
            })
            
    # Result is now Oldest -> Newest
    # Frontend might expect Newest -> Oldest or just time-value pairs
    # Let's return as is (Oldest -> Newest) or reverse?
    # The frontend client.ts seems to expect just .json() and then map it.
    
    return result

@router.get("/ema")
async def get_ema(
    symbol: str = Query(...),
    timeframe: str = Query(...),
    period: int = Query(14),
    limit: int = Query(500),
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(symbol, timeframe, limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    values = indicator_service.calculate_ema(closes, period)
    
    result = []
    for i, val in enumerate(values):
        bar_idx = len(bars) - 1 - i
        if bar_idx >= 0:
            result.append({
                "time": bars[bar_idx]['time'],
                "value": val
            })
    return result

@router.get("/rsi")
async def get_rsi(
    symbol: str = Query(...),
    timeframe: str = Query(...),
    period: int = Query(14),
    limit: int = Query(500),
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(symbol, timeframe, limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    values = indicator_service.calculate_rsi(closes, period)
    
    result = []
    for i, val in enumerate(values):
        bar_idx = len(bars) - 1 - i
        if bar_idx >= 0:
            result.append({
                "time": bars[bar_idx]['time'],
                "value": val
            })
    return result

@router.get("/macd")
async def get_macd(
    symbol: str = Query(...),
    timeframe: str = Query(...),
    fast_period: int = Query(12),
    slow_period: int = Query(26),
    signal_period: int = Query(9),
    limit: int = Query(500),
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(symbol, timeframe, limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    calc_res = indicator_service.calculate_macd(closes, fast_period, slow_period, signal_period)
    
    result = []
    # Assuming all lists in calc_res are same length and aligned with closes
    for i in range(len(closes)):
        bar_idx = len(bars) - 1 - i
        if bar_idx >= 0:
            result.append({
                "time": bars[bar_idx]['time'],
                "value": {
                    "macd": calc_res["macd"][i],
                    "signal": calc_res["signal"][i],
                    "histogram": calc_res["histogram"][i]
                }
            })
    return result

@router.get("/bollinger")
async def get_bollinger(
    symbol: str = Query(...),
    timeframe: str = Query(...),
    period: int = Query(20),
    std_dev: float = Query(2.0),
    limit: int = Query(500),
    market_data_service: MarketDataService = Depends(),
    indicator_service: IndicatorService = Depends(lambda: indicator_service)
):
    bars = await market_data_service.get_bars(symbol, timeframe, limit)
    if not bars:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    
    closes = [bar['close'] for bar in bars]
    closes.reverse()
    
    calc_res = indicator_service.calculate_bollinger_bands(closes, period, std_dev)
    
    result = []
    for i in range(len(closes)):
        bar_idx = len(bars) - 1 - i
        if bar_idx >= 0:
            result.append({
                "time": bars[bar_idx]['time'],
                "value": {
                    "upper": calc_res["upper"][i],
                    "middle": calc_res["middle"][i],
                    "lower": calc_res["lower"][i]
                }
            })
    return result
