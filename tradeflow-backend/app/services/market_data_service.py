from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from app.db.timescale import timescale_manager
from app.db.redis import redis_manager
from app.core.caching import cache_key

logger = logging.getLogger(__name__)

class MarketDataService:
    async def store_bar(
        self,
        symbol: str,
        timeframe: str,
        timestamp: datetime,
        open: float,
        high: float,
        low: float,
        close: float,
        volume: float,
        bid_volume: Optional[float] = None,
        ask_volume: Optional[float] = None,
        number_of_trades: Optional[int] = None,
        open_interest: Optional[float] = None
    ):
        """Store single bar in TimescaleDB"""
        query = """
            INSERT INTO market_data (
                time, symbol, timeframe, open, high, low, close,
                volume, bid_volume, ask_volume, number_of_trades, open_interest
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (time, symbol, timeframe) DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume,
                bid_volume = EXCLUDED.bid_volume,
                ask_volume = EXCLUDED.ask_volume,
                number_of_trades = EXCLUDED.number_of_trades,
                open_interest = EXCLUDED.open_interest
        """
        
        await timescale_manager.execute(
            query,
            timestamp, symbol, timeframe, open, high, low, close,
            volume, bid_volume, ask_volume, number_of_trades, open_interest
        )
        
        # Invalidate cache
        cache_key_pattern = f"market_data:{symbol}:*"
        await redis_manager.delete_pattern(cache_key_pattern)
    
    async def store_batch(self, bars: List) -> int:
        """Bulk insert for historical data"""
        # Note: asyncpg doesn't support executemany with ON CONFLICT easily without a loop or unnest
        # For simplicity and performance, we'll use a transaction and loop or COPY if possible.
        # Here we will use a loop for now, but in production COPY is better.
        # Actually, let's use executemany but we need to handle the object attributes.
        
        data_tuples = []
        for bar in bars:
            timestamp = bar.parse_timestamp(bar.timestamp)
            symbol = bar.chart_info.symbol
            timeframe = f"{bar.chart_info.seconds_per_bar}s"
            
            data_tuples.append((
                timestamp, symbol, timeframe,
                bar.open, bar.high, bar.low, bar.close,
                bar.volume, bar.bid_volume, bar.ask_volume,
                bar.number_of_trades, bar.open_interest
            ))
            
        query = """
            INSERT INTO market_data (
                time, symbol, timeframe, open, high, low, close,
                volume, bid_volume, ask_volume, number_of_trades, open_interest
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (time, symbol, timeframe) DO NOTHING
        """
        
        # We use executemany here. Note: ON CONFLICT DO NOTHING is used for batch to avoid errors,
        # but it means updates won't happen. For historical backfill this is usually fine.
        if not timescale_manager.pool:
             await timescale_manager.connect()
             
        async with timescale_manager.pool.acquire() as connection:
            await connection.executemany(query, data_tuples)
            
        return len(data_tuples)

    async def get_bars(self, symbol: str, timeframe: str, limit: int = 500) -> List[Dict[str, Any]]:
        query = """
            SELECT * FROM market_data 
            WHERE symbol = $1 AND timeframe = $2
            ORDER BY time DESC
            LIMIT $3
        """
        rows = await timescale_manager.fetch(query, symbol, timeframe, limit)
        return [dict(row) for row in rows]

    async def aggregate_to_higher_timeframes(self, symbol: str, timeframe: str, timestamp: datetime):
        # Placeholder for aggregation logic
        pass

    async def update_volume_profile(self, symbol: str, timestamp: datetime, close: float, volume: float, bid_vol: float, ask_vol: float):
        # Placeholder for volume profile update
        pass

    async def broadcast_tick(self, symbol: str, data: dict):
        # Placeholder for websocket broadcast
        pass
