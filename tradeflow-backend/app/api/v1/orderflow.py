from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.services.orderflow_service import orderflow_service, OrderFlowService

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
async def get_cvd(
    request: CVDRequest,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    return await service.get_cvd(request.symbol, request.timeframe, request.limit)

@router.post("/footprint")
async def get_footprint(
    request: FootprintRequest,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    return await service.get_footprint(request.symbol, request.timeframe, request.limit)

@router.post("/imbalances")
async def get_imbalances(
    request: ImbalanceRequest,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    return await service.detect_imbalances(request.symbol, request.timeframe, request.limit, request.ratio)
