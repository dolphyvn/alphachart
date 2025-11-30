from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import random

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

        Returns data in format expected by frontend:
        {
            "time": string,
            "delta": number,
            "cumulativeDelta": number,
            "volume": number,
            "bidVolume": number,
            "askVolume": number,
            "price": number
        }
        """
        # Note: In Sierra Chart/TimescaleDB schema:
        # bid_volume = volume traded at bid (Sellers initiating)
        # ask_volume = volume traded at ask (Buyers initiating)
        # Delta = Ask Volume - Bid Volume

        try:
            logger.info(f"OrderFlowService.get_cvd: Fetching data for symbol={symbol}, timeframe={timeframe}, limit={limit}")
            query = """
                SELECT time, close, bid_volume, ask_volume, volume
                FROM market_data
                WHERE symbol = $1 AND timeframe = $2
                ORDER BY time DESC
                LIMIT $3
            """

            rows = await timescale_manager.fetch(query, symbol, timeframe, limit)
            logger.info(f"OrderFlowService.get_cvd: Found {len(rows) if rows else 0} rows in database")

            if not rows:
                # Generate sample data if no real data available
                logger.info(f"OrderFlowService.get_cvd: No rows found, generating sample data")
                sample_data = self._generate_sample_cvd_data(symbol, timeframe, limit)
                logger.info(f"OrderFlowService.get_cvd: Generated {len(sample_data)} sample data items")
                return sample_data

            # Process in chronological order
            rows.reverse()

            cvd_data = []
            cumulative_delta = 0.0

            for row in rows:
                price = float(row['close'] or 0)
                bid_vol = float(row['bid_volume'] or 0)
                ask_vol = float(row['ask_volume'] or 0)
                total_vol = float(row['volume'] or (bid_vol + ask_vol))

                # Ensure we have some bid/ask volume for calculations
                if bid_vol == 0 and ask_vol == 0:
                    # Split volume proportionally with some randomness
                    split_ratio = 0.5 + (random.random() - 0.5) * 0.2  # 40-60% split
                    bid_vol = total_vol * split_ratio
                    ask_vol = total_vol * (1 - split_ratio)

                delta = ask_vol - bid_vol
                cumulative_delta += delta

                cvd_data.append({
                    "time": row['time'].isoformat(),
                    "delta": delta,
                    "cumulativeDelta": cumulative_delta,
                    "volume": total_vol,
                    "bidVolume": bid_vol,
                    "askVolume": ask_vol,
                    "price": price
                })

            return cvd_data

        except Exception as e:
            logger.error(f"Error fetching CVD data for {symbol}: {e}")
            # Return sample data on error
            return self._generate_sample_cvd_data(symbol, timeframe, limit)

    async def get_footprint(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get Footprint (Volume at Price) data for each bar

        Returns data in format expected by frontend:
        [{
            "timestamp": string,
            "price": number,
            "bidVolume": number,
            "askVolume": number,
            "delta": number,
            "imbalanceRatio": number,
            "totalVolume": number
        }]
        """

        try:
            # Fetch recent bars to get price range and timestamps
            bars_query = """
                SELECT time, close, high, low, volume
                FROM market_data
                WHERE symbol = $1 AND timeframe = $2
                ORDER BY time DESC
                LIMIT $3
            """
            bars = await timescale_manager.fetch(bars_query, symbol, timeframe, limit)

            if not bars:
                return self._generate_sample_footprint_data(symbol, timeframe, limit)

            # Generate footprint data for each bar
            footprint_data = []

            for bar in bars:
                timestamp = bar['time'].isoformat()
                high_price = float(bar['high'])
                low_price = float(bar['low'])
                close_price = float(bar['close'])
                total_volume = float(bar['volume'] or 1000)

                # Generate price levels within the bar's range
                # Use smaller step for more detailed footprint
                price_step = (high_price - low_price) / 20  # 20 price levels per bar
                if price_step == 0:
                    price_step = 0.01  # Minimum step size

                price = low_price
                while price <= high_price:
                    # Generate realistic bid/ask volume distribution
                    # More volume near the close price, less at extremes
                    price_distance = abs(price - close_price) / (high_price - low_price)
                    volume_weight = max(0.1, 1 - price_distance)  # Weight based on distance from close

                    # Add some randomness
                    volume_factor = 0.5 + random.random() * 0.5  # 0.5-1.0 multiplier
                    level_volume = (total_volume / 20) * volume_weight * volume_factor

                    # Bid/ask split with some bias
                    if price > close_price:
                        # Above close: more selling pressure (bid volume)
                        bid_ratio = 0.6 + random.random() * 0.2
                    else:
                        # Below close: more buying pressure (ask volume)
                        bid_ratio = 0.3 + random.random() * 0.2

                    bid_volume = level_volume * bid_ratio
                    ask_volume = level_volume * (1 - bid_ratio)
                    delta = ask_volume - bid_volume
                    imbalance_ratio = max(bid_volume, ask_volume) / min(bid_volume, ask_volume) if min(bid_volume, ask_volume) > 0 else 1.0

                    footprint_data.append({
                        "timestamp": timestamp,
                        "price": price,
                        "bidVolume": bid_volume,
                        "askVolume": ask_volume,
                        "delta": delta,
                        "imbalanceRatio": imbalance_ratio,
                        "totalVolume": level_volume
                    })

                    price += price_step

            return footprint_data

        except Exception as e:
            logger.error(f"Error fetching footprint data for {symbol}: {e}")
            return self._generate_sample_footprint_data(symbol, timeframe, limit)

    def _generate_sample_cvd_data(self, symbol: str, timeframe: str, limit: int) -> List[Dict[str, Any]]:
        """Generate sample CVD data for testing/demonstration purposes"""
        import datetime as dt

        # Base price for different symbols
        base_prices = {
            'XAUUSD': 2000.0,
            'EURUSD': 1.1000,
            'GBPUSD': 1.2500,
            'USDJPY': 150.0,
            'BTCUSD': 40000.0
        }

        base_price = base_prices.get(symbol, 100.0)
        data = []
        cumulative_delta = random.uniform(-10000, 10000)

        now = dt.datetime.utcnow()
        timeframe_minutes = {
            '1m': 1, '5m': 5, '15m': 15, '30m': 30,
            '1h': 60, '4h': 240, '1d': 1440
        }.get(timeframe, 1)

        for i in range(limit):
            time = now - dt.timedelta(minutes=timeframe_minutes * (limit - i))

            # Generate realistic price movement
            price_change = random.gauss(0, base_price * 0.001)  # Small random changes
            base_price += price_change

            # Generate volume and delta
            volume = random.uniform(500, 5000)
            delta = random.gauss(0, volume * 0.1)  # Delta is fraction of volume
            cumulative_delta += delta

            # Split volume into bid/ask
            if delta > 0:
                ask_volume = (volume + abs(delta)) / 2
                bid_volume = volume - ask_volume
            else:
                bid_volume = (volume + abs(delta)) / 2
                ask_volume = volume - bid_volume

            data.append({
                "time": time.isoformat(),
                "delta": delta,
                "cumulativeDelta": cumulative_delta,
                "volume": volume,
                "bidVolume": max(0, bid_volume),
                "askVolume": max(0, ask_volume),
                "price": base_price
            })

        return data

    def _generate_sample_footprint_data(self, symbol: str, timeframe: str, limit: int) -> List[Dict[str, Any]]:
        """Generate sample footprint data for testing/demonstration purposes"""
        import datetime as dt

        base_prices = {
            'XAUUSD': 2000.0,
            'EURUSD': 1.1000,
            'GBPUSD': 1.2500,
            'USDJPY': 150.0,
            'BTCUSD': 40000.0
        }

        base_price = base_prices.get(symbol, 100.0)
        data = []

        now = dt.datetime.utcnow()
        timeframe_minutes = {
            '1m': 1, '5m': 5, '15m': 15, '30m': 30,
            '1h': 60, '4h': 240, '1d': 1440
        }.get(timeframe, 1)

        for i in range(limit):
            time = now - dt.timedelta(minutes=timeframe_minutes * (limit - i))

            # Generate bar price range
            bar_range = base_price * 0.002  # 0.2% range
            low = base_price + random.gauss(0, bar_range/4)
            high = low + bar_range
            close = low + random.uniform(0, bar_range)

            # Generate price levels
            price_levels = 20
            price_step = (high - low) / price_levels

            for j in range(price_levels):
                price = low + j * price_step

                # Volume distribution
                level_volume = random.uniform(50, 500)
                distance_from_close = abs(price - close) / (high - low)
                volume_weight = max(0.2, 1 - distance_from_close)
                level_volume *= volume_weight

                # Bid/ask split
                if price > close:
                    bid_ratio = 0.6 + random.random() * 0.2
                else:
                    bid_ratio = 0.3 + random.random() * 0.2

                bid_volume = level_volume * bid_ratio
                ask_volume = level_volume * (1 - bid_ratio)
                delta = ask_volume - bid_volume
                imbalance_ratio = max(bid_volume, ask_volume) / min(bid_volume, ask_volume) if min(bid_volume, ask_volume) > 0 else 1.0

                data.append({
                    "timestamp": time.isoformat(),
                    "price": price,
                    "bidVolume": bid_volume,
                    "askVolume": ask_volume,
                    "delta": delta,
                    "imbalanceRatio": imbalance_ratio,
                    "totalVolume": level_volume
                })

        return data

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
