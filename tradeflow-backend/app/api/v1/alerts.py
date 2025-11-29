from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from enum import Enum

from app.services.alert_service import alert_service, AlertService
from app.core.security import oauth2_scheme, create_access_token
from app.db.models import AlertType

# Mock getting current user for now, in real app we decode JWT
async def get_current_user_id(token: str = Depends(oauth2_scheme)):
    # TODO: Decode token and get user ID
    # For now, return a dummy ID
    return 1

router = APIRouter()

class AlertCreate(BaseModel):
    symbol_id: int
    alert_type: AlertType
    condition_config: Dict[str, Any]
    notification_channels: List[str] = ["email"]

class AlertResponse(BaseModel):
    id: int
    symbol_id: int
    alert_type: AlertType
    condition_config: Dict[str, Any]
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True

@router.post("/", response_model=AlertResponse)
async def create_alert(
    alert: AlertCreate,
    user_id: int = Depends(get_current_user_id),
    service: AlertService = Depends(lambda: alert_service)
):
    result = await service.create_alert(
        user_id=user_id,
        symbol_id=alert.symbol_id,
        alert_type=alert.alert_type,
        condition_config=alert.condition_config,
        notification_channels=alert.notification_channels
    )
    return AlertResponse(
        id=result.id,
        symbol_id=result.symbol_id,
        alert_type=result.alert_type,
        condition_config=result.condition_config,
        is_active=result.is_active,
        created_at=result.created_at.isoformat()
    )

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    user_id: int = Depends(get_current_user_id),
    service: AlertService = Depends(lambda: alert_service)
):
    alerts = await service.get_user_alerts(user_id)
    return [
        AlertResponse(
            id=a.id,
            symbol_id=a.symbol_id,
            alert_type=a.alert_type,
            condition_config=a.condition_config,
            is_active=a.is_active,
            created_at=a.created_at.isoformat()
        ) for a in alerts
    ]

@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: int,
    user_id: int = Depends(get_current_user_id),
    service: AlertService = Depends(lambda: alert_service)
):
    success = await service.delete_alert(alert_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success"}
