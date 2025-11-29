from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from app.db.timescale import timescale_manager
from app.core.caching import cache_key, cached

logger = logging.getLogger(__name__)

class VolumeProfileService:
    async def get_session_profile(
        self,
        symbol: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        Get Volume Profile for a specific session or time range.
        Aggregates volume at each price level.
        """
        # We query the volume_profile table which stores pre-aggregated data per session/time
        # Or we aggregate from there.
        
        query = """
            SELECT price_level, SUM(volume) as total_volume, 
                   SUM(bid_volume) as total_bid, SUM(ask_volume) as total_ask
            FROM volume_profile
            WHERE symbol = $1 
              AND time >= $2 
              AND time <= $3
            GROUP BY price_level
            ORDER BY price_level DESC
        """
        
        rows = await timescale_manager.fetch(query, symbol, start_time, end_time)
        
        profile = []
        point_of_control = {"price": 0, "volume": 0}
        total_volume = 0
        
        for row in rows:
            vol = float(row['total_volume'])
            price = float(row['price_level'])
            
            if vol > point_of_control["volume"]:
                point_of_control = {"price": price, "volume": vol}
                
            total_volume += vol
            
            profile.append({
                "price": price,
                "volume": vol,
                "bid": float(row['total_bid'] or 0),
                "ask": float(row['total_ask'] or 0),
                "delta": float(row['total_ask'] or 0) - float(row['total_bid'] or 0)
            })
            
        # Calculate Value Area (70% of volume)
        # 1. Sort by volume DESC to find highest volume nodes
        sorted_by_vol = sorted(profile, key=lambda x: x['volume'], reverse=True)
        
        target_vol = total_volume * 0.70
        current_vol = 0
        value_area_high = 0
        value_area_low = float('inf')
        
        for node in sorted_by_vol:
            current_vol += node['volume']
            price = node['price']
            if price > value_area_high:
                value_area_high = price
            if price < value_area_low:
                value_area_low = price
                
            if current_vol >= target_vol:
                break
                
        if value_area_low == float('inf'):
            value_area_low = 0
            
        return {
            "profile": profile,
            "poc": point_of_control["price"],
            "vah": value_area_high,
            "val": value_area_low,
            "total_volume": total_volume
        }

volume_profile_service = VolumeProfileService()
