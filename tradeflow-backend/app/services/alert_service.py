from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.mariadb import mariadb_manager
from app.db.models import Alert, AlertType
from app.services.market_data_service import market_data_service

logger = logging.getLogger(__name__)

class AlertService:
    async def create_alert(
        self,
        user_id: int,
        symbol_id: int,
        alert_type: AlertType,
        condition_config: Dict[str, Any],
        notification_channels: List[str]
    ) -> Alert:
        async with mariadb_manager.get_session() as session:
            alert = Alert(
                user_id=user_id,
                symbol_id=symbol_id,
                alert_type=alert_type,
                condition_config=condition_config,
                notification_channels=notification_channels,
                is_active=True
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)
            return alert

    async def get_user_alerts(self, user_id: int) -> List[Alert]:
        async with mariadb_manager.get_session() as session:
            result = await session.execute(select(Alert).where(Alert.user_id == user_id))
            return result.scalars().all()

    async def delete_alert(self, alert_id: int, user_id: int) -> bool:
        async with mariadb_manager.get_session() as session:
            result = await session.execute(
                delete(Alert).where(Alert.id == alert_id, Alert.user_id == user_id)
            )
            await session.commit()
            return result.rowcount > 0

    async def check_price_alert(self, alert: Alert, current_price: float):
        """
        Check if price alert condition is met.
        Condition config example: {"operator": ">", "price": 100.0}
        """
        config = alert.condition_config
        operator = config.get("operator")
        target_price = config.get("price")
        
        if not operator or not target_price:
            return False
            
        if operator == ">" and current_price > target_price:
            return True
        elif operator == "<" and current_price < target_price:
            return True
        elif operator == ">=" and current_price >= target_price:
            return True
        elif operator == "<=" and current_price <= target_price:
            return True
            
        return False

    async def process_tick(self, symbol: str, price: float):
        """
        Process incoming tick and check active alerts for the symbol.
        This would typically be called by the market data ingestion pipeline or a worker.
        """
        # 1. Get symbol ID (cache this mapping ideally)
        # For now, we'll skip symbol_id lookup and assume we can query by symbol name if we joined tables,
        # but our Alert model uses symbol_id.
        # Let's assume we have a way to map symbol string to ID.
        pass 

alert_service = AlertService()
