from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.services.volume_profile_service import volume_profile_service, VolumeProfileService

router = APIRouter()

class ProfileRequest(BaseModel):
    symbol: str
    start_time: datetime
    end_time: datetime

@router.post("/session")
async def get_session_profile(
    request: ProfileRequest,
    service: VolumeProfileService = Depends(lambda: volume_profile_service)
):
    return await service.get_session_profile(request.symbol, request.start_time, request.end_time)
