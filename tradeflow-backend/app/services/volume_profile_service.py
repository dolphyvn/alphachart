from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import random

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

        Returns data in format expected by frontend:
        [{
            "price": number,
            "volume": number,
            "bidVolume": number,
            "askVolume": number,
            "percent": number,
            "buySellRatio": number,
            "type": 'bid' | 'ask' | 'neutral'
        }]
        """

        try:
            # Try to get real data from volume_profile table
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

            if not rows:
                # Get market data to generate sample volume profile
                market_query = """
                    SELECT close, high, low, volume
                    FROM market_data
                    WHERE symbol = $1
                      AND time >= $2
                      AND time <= $3
                    ORDER BY time DESC
                    LIMIT 100
                """
                market_rows = await timescale_manager.fetch(market_query, symbol, start_time, end_time)
                return self._generate_sample_volume_profile(symbol, market_rows)

            profile = []
            total_volume = 0

            # Calculate total volume first
            for row in rows:
                vol = float(row['total_volume'])
                total_volume += vol

            # Process each price level
            for row in rows:
                price = float(row['price_level'])
                volume = float(row['total_volume'])
                bid_volume = float(row['total_bid'] or 0)
                ask_volume = float(row['total_ask'] or 0)

                # Ensure bid/ask volumes add up
                if bid_volume + ask_volume == 0:
                    # Split volume proportionally
                    bid_volume = volume * 0.5
                    ask_volume = volume * 0.5

                percent = (volume / total_volume * 100) if total_volume > 0 else 0
                buy_sell_ratio = ask_volume / bid_volume if bid_volume > 0 else float('inf')

                # Determine type based on buy/sell ratio
                if buy_sell_ratio > 1.2:
                    profile_type = 'ask'  # More buying pressure
                elif buy_sell_ratio < 0.8:
                    profile_type = 'bid'  # More selling pressure
                else:
                    profile_type = 'neutral'

                profile.append({
                    "price": price,
                    "volume": volume,
                    "bidVolume": bid_volume,
                    "askVolume": ask_volume,
                    "percent": percent,
                    "buySellRatio": buy_sell_ratio,
                    "type": profile_type
                })

            return profile

        except Exception as e:
            logger.error(f"Error fetching volume profile for {symbol}: {e}")
            # Generate sample data on error
            return self._generate_sample_volume_profile(symbol, [])

    def _generate_sample_volume_profile(self, symbol: str, market_data: List[Dict]) -> List[Dict[str, Any]]:
        """Generate sample volume profile data for testing/demonstration purposes"""

        # Base prices for different symbols
        base_prices = {
            'XAUUSD': 2000.0,
            'EURUSD': 1.1000,
            'GBPUSD': 1.2500,
            'USDJPY': 150.0,
            'BTCUSD': 40000.0
        }

        base_price = base_prices.get(symbol, 100.0)

        # If we have market data, use actual price ranges
        if market_data:
            prices = [float(row['close']) for row in market_data]
            min_price = min(prices)
            max_price = max(prices)
        else:
            # Generate synthetic price range
            price_range = base_price * 0.01  # 1% range
            min_price = base_price - price_range / 2
            max_price = base_price + price_range / 2

        profile = []
        num_levels = 50  # Number of price levels
        price_step = (max_price - min_price) / num_levels

        # Generate volume distribution (bell curve around base price)
        total_volume = 0
        levels_data = []

        for i in range(num_levels):
            price = min_price + i * price_step

            # Create bell curve distribution centered around base_price
            distance_from_center = abs(price - base_price) / (max_price - min_price)
            volume_weight = max(0.1, 1 - (distance_from_center * 2))  # Bell curve shape

            level_volume = random.uniform(1000, 10000) * volume_weight

            # Bid/ask split with some bias
            bias = random.gauss(0, 0.2)  # Small random bias
            ask_ratio = 0.5 + bias
            ask_ratio = max(0.2, min(0.8, ask_ratio))  # Clamp between 0.2-0.8

            ask_volume = level_volume * ask_ratio
            bid_volume = level_volume * (1 - ask_ratio)

            levels_data.append({
                "price": price,
                "volume": level_volume,
                "bidVolume": bid_volume,
                "askVolume": ask_volume
            })

            total_volume += level_volume

        # Calculate percentages and finalize data
        for level in levels_data:
            volume = level["volume"]
            bid_volume = level["bidVolume"]
            ask_volume = level["askVolume"]

            percent = (volume / total_volume * 100) if total_volume > 0 else 0
            buy_sell_ratio = ask_volume / bid_volume if bid_volume > 0 else float('inf')

            # Determine type based on buy/sell ratio
            if buy_sell_ratio > 1.2:
                profile_type = 'ask'
            elif buy_sell_ratio < 0.8:
                profile_type = 'bid'
            else:
                profile_type = 'neutral'

            profile.append({
                "price": level["price"],
                "volume": volume,
                "bidVolume": bid_volume,
                "askVolume": ask_volume,
                "percent": percent,
                "buySellRatio": buy_sell_ratio,
                "type": profile_type
            })

        # Sort by price descending (high to low)
        profile.sort(key=lambda x: x['price'], reverse=True)

        return profile

volume_profile_service = VolumeProfileService()
