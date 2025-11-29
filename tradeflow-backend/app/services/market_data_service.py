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

    def _parse_timeframe(self, timeframe: str) -> str:
        mapping = {
            '1s': '1 second',
            '1m': '1 minute',
            '5m': '5 minutes',
            '15m': '15 minutes',
            '1h': '1 hour',
            '4h': '4 hours',
            '1d': '1 day'
        }
        return mapping.get(timeframe, '1 minute')

    async def get_bars(self, symbol: str, timeframe: str, limit: int = 500) -> List[Dict[str, Any]]:
        logger.info(f"Fetching bars for {symbol} {timeframe} limit={limit}")
        
        if timeframe == '1s':
            query = """
                SELECT * FROM market_data 
                WHERE symbol = $1 AND timeframe = $2
                ORDER BY time DESC
                LIMIT $3
            """
            rows = await timescale_manager.fetch(query, symbol, timeframe, limit)
            logger.info(f"Found {len(rows)} rows (raw)")
            return [dict(row) for row in rows]
        else:
            # On-the-fly aggregation from 1s data
            interval = self._parse_timeframe(timeframe)
            logger.info(f"Aggregation params: interval={interval}, symbol={symbol}, timeframe={timeframe}, limit={limit}")
            
            # DEBUG: Test simple group by
            try:
                test_query = "SELECT symbol, count(*) as cnt FROM market_data WHERE symbol = $1 GROUP BY symbol"
                test_rows = await timescale_manager.fetch(test_query, symbol)
                logger.info(f"Test query rows: {len(test_rows)}")
                if test_rows:
                    logger.info(f"Test row: {dict(test_rows[0])}")
            except Exception as e:
                logger.error(f"Test query failed: {e}")

            query = """
                SELECT 
                    time_bucket($1::interval, time)::text AS bucket,
                    $2 AS symbol,
                    $3 AS timeframe,
                    first(open, time) AS open,
                    max(high) AS high,
                    min(low) AS low,
                    last(close, time) AS close,
                    sum(volume) AS volume,
                    sum(bid_volume) AS bid_volume,
                    sum(ask_volume) AS ask_volume,
                    sum(number_of_trades) AS number_of_trades,
                    last(open_interest, time) AS open_interest
                FROM market_data
                WHERE symbol = $2
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT $4
            """
            rows = await timescale_manager.fetch(query, interval, symbol, timeframe, limit)
            logger.info(f"Found {len(rows)} rows (aggregated)")
            
            # Map bucket to time
            result = []
            for row in rows:
                d = dict(row)
                d['time'] = d.pop('bucket')
                result.append(d)
            return result

    async def aggregate_to_higher_timeframes(self, symbol: str, timeframe: str, timestamp: datetime):
        """
        Background task: Aggregate tick data to higher timeframes
        
        Example: 1s -> 1m, 5m, 15m, 1h, 4h, 1d
        """
        # This triggers TimescaleDB continuous aggregates
        # They auto-refresh based on policies we set
        # We can also manually refresh if needed
        # await timescale_manager.execute("CALL refresh_continuous_aggregate('market_data_1min', NULL, NULL)")
        pass

    async def update_volume_profile(
        self,
        symbol: str,
        timestamp: datetime,
        price: float,
        volume: float,
        bid_volume: Optional[float],
        ask_volume: Optional[float]
    ):
        """Update volume profile for current session"""
        # Determine session start (e.g., 00:00 UTC for daily)
        session_start = timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Round price to tick size (e.g., 0.01 for forex). 
        # Ideally fetch tick_size from symbols table, but for now hardcode or assume input is already rounded.
        # Let's assume input 'price' is the close price of the bar/tick.
        
        query = """
            INSERT INTO volume_profile (
                time, symbol, session_start, price_level,
                volume, bid_volume, ask_volume
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (time, symbol, session_start, price_level) DO UPDATE SET
                volume = volume_profile.volume + EXCLUDED.volume,
                bid_volume = volume_profile.bid_volume + EXCLUDED.bid_volume,
                ask_volume = volume_profile.ask_volume + EXCLUDED.ask_volume
        """
        
        await timescale_manager.execute(
            query,
            timestamp, symbol, session_start, price,
            volume, bid_volume or 0, ask_volume or 0
        )

    async def broadcast_tick(self, symbol: str, data: dict):
        """Broadcast tick to WebSocket clients"""
        from app.services.websocket_service import ws_manager
        await ws_manager.broadcast_to_symbol(symbol, {
            "type": "tick",
            "symbol": symbol,
            "data": data
        })

market_data_service = MarketDataService()
