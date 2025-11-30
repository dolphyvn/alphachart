from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.services.orderflow_service import orderflow_service, OrderFlowService
from app.services.volume_profile_service import volume_profile_service, VolumeProfileService

router = APIRouter()

class CVDRequest(BaseModel):
    symbol: str
    timeframe: str
    limit: int = 500

class FootprintRequest(BaseModel):
    symbol: str
    timeframe: str
    limit: int = 100

class ImbalanceRequest(BaseModel):
    symbol: str
    timeframe: str
    limit: int = 100
    ratio: float = 3.0

@router.post("/cvd")
async def get_cvd_post(
    request: CVDRequest,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    """POST endpoint for CVD data"""
    return await service.get_cvd(request.symbol, request.timeframe, request.limit)

@router.get("/cvd/{symbol}")
async def get_cvd_get(
    symbol: str,
    timeframe: str = Query(..., description="Timeframe (e.g., '1m', '5m', '1h')"),
    limit: int = Query(500, description="Number of bars to fetch"),
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    """GET endpoint for CVD data - matches frontend expectations"""
    return await service.get_cvd(symbol, timeframe, limit)

@router.post("/footprint")
async def get_footprint_post(
    request: FootprintRequest,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    """POST endpoint for Footprint data"""
    return await service.get_footprint(request.symbol, request.timeframe, request.limit)

@router.get("/footprint/{symbol}")
async def get_footprint_get(
    symbol: str,
    timeframe: str = Query(..., description="Timeframe (e.g., '1m', '5m', '1h')"),
    limit: int = Query(100, description="Number of bars to fetch"),
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    """GET endpoint for Footprint data - matches frontend expectations"""
    return await service.get_footprint(symbol, timeframe, limit)

@router.get("/volume-profile/{symbol}")
async def get_volume_profile_get(
    symbol: str,
    timeframe: str = Query(..., description="Timeframe (e.g., '1m', '5m', '1h')"),
    limit: int = Query(100, description="Number of bars to analyze"),
    service: VolumeProfileService = Depends(lambda: volume_profile_service)
):
    """GET endpoint for Volume Profile data - matches frontend expectations"""
    # Calculate time range based on timeframe
    end_time = datetime.utcnow()
    start_time = _calculate_start_time(end_time, timeframe, limit)
    return await service.get_session_profile(symbol, start_time, end_time)

@router.post("/imbalances")
async def get_imbalances_post(
    request: ImbalanceRequest,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    """POST endpoint for Imbalance data"""
    return await service.detect_imbalances(request.symbol, request.timeframe, request.limit, request.ratio)

@router.get("/imbalances/{symbol}")
async def get_imbalances_get(
    symbol: str,
    timeframe: str = Query(..., description="Timeframe (e.g., '1m', '5m', '1h')"),
    limit: int = Query(100, description="Number of bars to fetch"),
    ratio: float = Query(3.0, description="Imbalance ratio threshold"),
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    """GET endpoint for Imbalance data - matches frontend expectations"""
    return await service.detect_imbalances(symbol, timeframe, limit, ratio)

def _calculate_start_time(end_time: datetime, timeframe: str, limit: int) -> datetime:
    """Calculate start time based on timeframe and limit"""
    # Convert timeframe to seconds
    timeframe_seconds = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
        '4h': 14400,
        '1d': 86400,
    }

    seconds = timeframe_seconds.get(timeframe, 60)  # Default to 1 minute
    start_time = end_time.timestamp() - (seconds * limit)

    return datetime.fromtimestamp(start_time)
