from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
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

    def _parse_timeframe(self, timeframe: str) -> timedelta:
        mapping = {
            '1s': timedelta(seconds=1),
            '1m': timedelta(minutes=1),
            '5m': timedelta(minutes=5),
            '15m': timedelta(minutes=15),
            '1h': timedelta(hours=1),
            '4h': timedelta(hours=4),
            '1d': timedelta(days=1)
        }
        return mapping.get(timeframe, timedelta(minutes=1))

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
            
            query = """
                SELECT 
                    time_bucket($1, time) AS bucket,
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
                WHERE symbol = $2 AND timeframe = '1s'
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

    async def get_volume_profile(self, symbol: str, start_time: datetime, end_time: datetime) -> List[Dict[str, Any]]:
        """
        Get volume profile aggregated from 1s bars.
        Approximation: Uses 'close' price of 1s bar as the price level.
        """
        query = """
            SELECT 
                round(close::numeric, 2) as price, 
                sum(volume) as volume,
                sum(bid_volume) as bid_volume,
                sum(ask_volume) as ask_volume
            FROM market_data
            WHERE symbol = $1 AND timeframe = '1s' AND time >= $2 AND time <= $3
            GROUP BY price
            ORDER BY price DESC
        """
        
        rows = await timescale_manager.fetch(query, symbol, start_time, end_time)
        return [dict(row) for row in rows]

    async def get_footprint_data(self, symbol: str, timeframe: str, start_time: datetime, end_time: datetime) -> List[Dict[str, Any]]:
        """
        Get footprint data (volume at price per bar).
        Aggregates 1s data into the requested timeframe buckets, then groups by price level within each bucket.
        """
        interval = self._parse_timeframe(timeframe)
        
        query = """
            SELECT 
                time_bucket($1, time) AS bucket,
                round(close::numeric, 2) as price,
                sum(volume) as volume,
                sum(bid_volume) as bid_volume,
                sum(ask_volume) as ask_volume
            FROM market_data
            WHERE symbol = $2 AND timeframe = '1s' AND time >= $3 AND time <= $4
            GROUP BY bucket, price
            ORDER BY bucket DESC, price DESC
        """
        
        rows = await timescale_manager.fetch(query, interval, symbol, start_time, end_time)
        
        # Group by bucket (bar time)
        result = {}
        for row in rows:
            bucket = row['bucket'].isoformat()
            if bucket not in result:
                result[bucket] = []
            
            result[bucket].append({
                'price': float(row['price']),
                'volume': float(row['volume']),
                'bid_volume': float(row['bid_volume'] or 0),
                'ask_volume': float(row['ask_volume'] or 0)
            })
            
        return [{'time': k, 'levels': v} for k, v in result.items()]

    async def get_cvd_data(self, symbol: str, timeframe: str, start_time: datetime, end_time: datetime) -> List[Dict[str, Any]]:
        """
        Get Cumulative Volume Delta (CVD) data.
        """
        interval = self._parse_timeframe(timeframe)
        
        query = """
            SELECT 
                time_bucket($1, time) AS bucket,
                sum(bid_volume) as bid_volume,
                sum(ask_volume) as ask_volume
            FROM market_data
            WHERE symbol = $2 AND timeframe = '1s' AND time >= $3 AND time <= $4
            GROUP BY bucket
            ORDER BY bucket ASC
        """
        
        rows = await timescale_manager.fetch(query, interval, symbol, start_time, end_time)
        
        result = []
        cumulative_delta = 0
        for row in rows:
            bid_vol = row['bid_volume'] or 0
            ask_vol = row['ask_volume'] or 0
            delta = ask_vol - bid_vol # Buyers - Sellers
            cumulative_delta += delta
            
            result.append({
                'time': row['bucket'],
                'delta': delta,
                'cumulative_delta': cumulative_delta
            })
            
        return result

    async def get_available_symbols(self) -> List[str]:
        """
        Get list of all available symbols from the database
        """
        query = """
            SELECT DISTINCT symbol
            FROM market_data
            ORDER BY symbol ASC
        """
        rows = await timescale_manager.fetch(query)
        return [row['symbol'] for row in rows]

    async def get_symbol_info(self, symbol: str) -> dict:
        """
        Get detailed information about a specific symbol
        """
        # Get basic symbol stats
        query = """
            SELECT
                symbol,
                COUNT(*) as total_bars,
                MIN(time) as first_data_time,
                MAX(time) as last_data_time,
                COUNT(DISTINCT timeframe) as available_timeframes,
                AVG(volume) as avg_volume,
                MAX(volume) as max_volume,
                MIN(low) as min_price,
                MAX(high) as max_price
            FROM market_data
            WHERE symbol = $1
            GROUP BY symbol
        """
        rows = await timescale_manager.fetch(query, symbol)

        if not rows:
            return {"error": "Symbol not found"}

        row = rows[0]

        # Get available timeframes for this symbol
        timeframes_query = """
            SELECT DISTINCT timeframe
            FROM market_data
            WHERE symbol = $1
            ORDER BY timeframe
        """
        timeframe_rows = await timescale_manager.fetch(timeframes_query, symbol)
        timeframes = [row['timeframe'] for row in timeframe_rows]

        return {
            "symbol": row['symbol'],
            "total_bars": row['total_bars'],
            "first_data_time": row['first_data_time'].isoformat() if row['first_data_time'] else None,
            "last_data_time": row['last_data_time'].isoformat() if row['last_data_time'] else None,
            "available_timeframes": timeframes,
            "avg_volume": float(row['avg_volume']) if row['avg_volume'] else 0,
            "max_volume": float(row['max_volume']) if row['max_volume'] else 0,
            "price_range": {
                "min": float(row['min_price']) if row['min_price'] else 0,
                "max": float(row['max_price']) if row['max_price'] else 0
            }
        }

    async def broadcast_tick(self, symbol: str, data: dict):
        """Broadcast tick to WebSocket clients"""
        from app.services.websocket_service import ws_manager
        await ws_manager.broadcast_to_symbol(symbol, {
            "type": "tick",
            "symbol": symbol,
            "data": data
        })

market_data_service = MarketDataService()
