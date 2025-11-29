import numpy as np
import pandas as pd
from typing import List, Dict, Any

class IndicatorService:
    def calculate_sma(self, closes: List[float], period: int) -> List[float]:
        """Simple Moving Average"""
        if len(closes) < period:
            return []
        return pd.Series(closes).rolling(window=period).mean().fillna(0).tolist()
    
    def calculate_ema(self, closes: List[float], period: int) -> List[float]:
        """Exponential Moving Average"""
        if len(closes) < period:
            return []
        return pd.Series(closes).ewm(span=period, adjust=False).mean().fillna(0).tolist()
    
    def calculate_rsi(self, closes: List[float], period: int = 14) -> List[float]:
        """Relative Strength Index"""
        if len(closes) < period:
            return []
        closes_series = pd.Series(closes)
        delta = closes_series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(0).tolist()
    
    def calculate_macd(
        self,
        closes: List[float],
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> Dict[str, List[float]]:
        """MACD"""
        if len(closes) < slow:
            return {"macd": [], "signal": [], "histogram": []}
            
        closes_series = pd.Series(closes)
        ema_fast = closes_series.ewm(span=fast, adjust=False).mean()
        ema_slow = closes_series.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        
        return {
            "macd": macd_line.fillna(0).tolist(),
            "signal": signal_line.fillna(0).tolist(),
            "histogram": histogram.fillna(0).tolist()
        }
    
    def calculate_bollinger_bands(
        self,
        closes: List[float],
        period: int = 20,
        std_dev: float = 2.0
    ) -> Dict[str, List[float]]:
        """Bollinger Bands"""
        if len(closes) < period:
            return {"upper": [], "middle": [], "lower": []}
            
        closes_series = pd.Series(closes)
        sma = closes_series.rolling(window=period).mean()
        std = closes_series.rolling(window=period).std()
        
        upper = sma + (std * std_dev)
        lower = sma - (std * std_dev)
        
        return {
            "upper": upper.fillna(0).tolist(),
            "middle": sma.fillna(0).tolist(),
            "lower": lower.fillna(0).tolist()
        }
    
    def calculate_atr(
        self,
        highs: List[float],
        lows: List[float],
        closes: List[float],
        period: int = 14
    ) -> List[float]:
        """Average True Range"""
        if len(closes) < period:
            return []
            
        high = pd.Series(highs)
        low = pd.Series(lows)
        close = pd.Series(closes)
        
        tr1 = high - low
        tr2 = (high - close.shift()).abs()
        tr3 = (low - close.shift()).abs()
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(window=period).mean()
        
        return atr.fillna(0).tolist()

indicator_service = IndicatorService()
