from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from app.db.timescale import timescale_manager
from app.core.caching import cache_key, cached

logger = logging.getLogger(__name__)

class OrderFlowService:
    async def get_cvd(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Get Cumulative Volume Delta (CVD)
        CVD = Cumulative Sum of (Bid Volume - Ask Volume)
        """
        # Note: In Sierra Chart/TimescaleDB schema:
        # bid_volume = volume traded at bid (Sellers initiating)
        # ask_volume = volume traded at ask (Buyers initiating)
        # Delta = Ask Volume - Bid Volume
        
        query = """
            SELECT time, bid_volume, ask_volume
            FROM market_data
            WHERE symbol = $1 AND timeframe = $2
            ORDER BY time DESC
            LIMIT $3
        """
        
        rows = await timescale_manager.fetch(query, symbol, timeframe, limit)
        
        # Process in chronological order
        rows.reverse()
        
        cvd_data = []
        cumulative_delta = 0.0
        
        for row in rows:
            bid_vol = float(row['bid_volume'] or 0)
            ask_vol = float(row['ask_volume'] or 0)
            delta = ask_vol - bid_vol
            cumulative_delta += delta
            
            cvd_data.append({
                "timestamp": row['time'].isoformat(),
                "delta": delta,
                "cumulative_delta": cumulative_delta,
                "bid_volume": bid_vol,
                "ask_volume": ask_vol
            })
            
        # Return newest first if preferred by frontend, but usually charts want chronological
        # Let's return chronological (oldest first) as we reversed it
        return cvd_data

    async def get_footprint(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get Footprint (Volume at Price) data for each bar
        This requires querying the volume_profile table or aggregating tick data if available.
        Since we don't have a 'bar_profile' table yet, we might need to rely on what we have.
        
        If we are storing volume profile per session, that's different from per bar.
        For true footprint, we need volume at price PER BAR.
        
        Assuming we might not have granular per-bar-per-price data yet in the schema provided in Phase 1
        (which had `volume_profile` keyed by `session_start`), we might need to adjust or use a simplified version.
        
        However, for now, let's assume we can query `volume_profile` if it was designed for this, 
        OR we might need to create a `bar_statistics` table.
        
        Given the schema in Phase 1:
        CREATE TABLE volume_profile (
            time TIMESTAMPTZ NOT NULL, -- This is the time of the update/bar?
            symbol VARCHAR(50) NOT NULL,
            session_start TIMESTAMPTZ NOT NULL,
            price_level DOUBLE PRECISION NOT NULL,
            ...
        );
        
        If `time` is the bar time, then we can use it for footprint.
        """
        
        # Let's assume we want footprint for the last N bars.
        # We need to fetch the bars first to get their timestamps.
        bars_query = """
            SELECT time
            FROM market_data
            WHERE symbol = $1 AND timeframe = $2
            ORDER BY time DESC
            LIMIT $3
        """
        bars = await timescale_manager.fetch(bars_query, symbol, timeframe, limit)
        
        if not bars:
            return []
            
        start_time = bars[-1]['time']
        end_time = bars[0]['time']
        
        # Now fetch volume profile data for this time range
        # Note: This assumes volume_profile table stores data with 'time' matching the bar time
        vp_query = """
            SELECT time, price_level, volume, bid_volume, ask_volume
            FROM volume_profile
            WHERE symbol = $1 
              AND time >= $2 
              AND time <= $3
            ORDER BY time ASC, price_level DESC
        """
        
        vp_rows = await timescale_manager.fetch(vp_query, symbol, start_time, end_time)
        
        # Group by time
        footprint_data = {}
        for row in vp_rows:
            t = row['time'].isoformat()
            if t not in footprint_data:
                footprint_data[t] = []
            
            footprint_data[t].append({
                "price": float(row['price_level']),
                "volume": float(row['volume']),
                "bid": float(row['bid_volume'] or 0),
                "ask": float(row['ask_volume'] or 0),
                "delta": float(row['ask_volume'] or 0) - float(row['bid_volume'] or 0)
            })
            
        return [{"timestamp": k, "levels": v} for k, v in footprint_data.items()]

    async def detect_imbalances(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 100,
        ratio: float = 3.0
    ) -> List[Dict[str, Any]]:
        """
        Detect Diagonal Imbalances
        Ask at Price P > Bid at Price P-1 * ratio (Buying Imbalance)
        Bid at Price P > Ask at Price P+1 * ratio (Selling Imbalance)
        """
        footprints = await self.get_footprint(symbol, timeframe, limit)
        imbalances = []
        
        for bar in footprints:
            levels = bar['levels'] # Sorted by price DESC
            bar_imbalances = []
            
            # We need to access by index
            for i in range(len(levels) - 1):
                # Current level (higher price)
                curr = levels[i]
                # Next level (lower price)
                next_level = levels[i+1]
                
                # Diagonal calculation depends on tick size, but here we just compare adjacent levels in the array
                # Assuming levels are contiguous tick-by-tick. If not, this logic needs adjustment.
                
                # Buying Imbalance: Ask at Current > Bid at Next * Ratio
                if curr['ask'] > next_level['bid'] * ratio and curr['ask'] > 0 and next_level['bid'] > 0:
                    bar_imbalances.append({
                        "type": "buy",
                        "price": curr['price'],
                        "volume": curr['ask'],
                        "compared_to": next_level['bid']
                    })
                
                # Selling Imbalance: Bid at Next > Ask at Current * Ratio
                if next_level['bid'] > curr['ask'] * ratio and next_level['bid'] > 0 and curr['ask'] > 0:
                    bar_imbalances.append({
                        "type": "sell",
                        "price": next_level['price'],
                        "volume": next_level['bid'],
                        "compared_to": curr['ask']
                    })
            
            if bar_imbalances:
                imbalances.append({
                    "timestamp": bar['timestamp'],
                    "imbalances": bar_imbalances
                })
                
        return imbalances

orderflow_service = OrderFlowService()
