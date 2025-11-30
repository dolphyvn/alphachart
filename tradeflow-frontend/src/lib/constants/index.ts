import { Timeframe, ChartType, Symbol, DrawingTool } from '@/types';

export const TIMEFRAMES: Timeframe[] = [
  { label: '5 Sec', value: '5s', seconds: 5 },
  { label: '10 Sec', value: '10s', seconds: 10 },
  { label: '30 Sec', value: '30s', seconds: 30 },
  { label: '1 Min', value: '1m', seconds: 60 },
  { label: '5 Min', value: '5m', seconds: 300 },
  { label: '15 Min', value: '15m', seconds: 900 },
  { label: '30 Min', value: '30m', seconds: 1800 },
  { label: '1 Hour', value: '1h', seconds: 3600 },
  { label: '4 Hour', value: '4h', seconds: 14400 },
  { label: '1 Day', value: '1D', seconds: 86400 },
  { label: '1 Week', value: '1W', seconds: 604800 },
  { label: '1 Month', value: '1M', seconds: 2592000 },
];

export const CHART_TYPES: ChartType[] = [
  { id: 'candlestick', label: 'Candlesticks', value: 'candlestick' },
  { id: 'bar', label: 'Bars', value: 'bar' },
  { id: 'line', label: 'Line', value: 'line' },
  { id: 'area', label: 'Area', value: 'area' },
  { id: 'baseline', label: 'Baseline', value: 'baseline' },
];

export const DEFAULT_SYMBOLS: Symbol[] = [
  { symbol: 'XAUUSD', name: 'Gold/US Dollar', exchange: 'FX', asset_type: 'forex' },
  { symbol: 'EURUSD', name: 'Euro/US Dollar', exchange: 'FX', asset_type: 'forex' },
  { symbol: 'GBPUSD', name: 'British Pound/US Dollar', exchange: 'FX', asset_type: 'forex' },
  { symbol: 'BTCUSD', name: 'Bitcoin/US Dollar', exchange: 'Binance', asset_type: 'crypto' },
  { symbol: 'ETHUSD', name: 'Ethereum/US Dollar', exchange: 'Binance', asset_type: 'crypto' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE', asset_type: 'stocks' },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', asset_type: 'stocks' },
];

export const DRAWING_TOOLS: DrawingTool[] = [
  { id: 'cursor', name: 'Cursor', icon: 'MousePointer', type: 'line' },
  { id: 'trendline', name: 'Trend Line', icon: 'TrendingUp', type: 'trendline' },
  { id: 'horizontal', name: 'Horizontal Line', icon: 'Minus', type: 'horizontal' },
  { id: 'vertical', name: 'Vertical Line', icon: 'Pipe', type: 'vertical' },
  { id: 'rectangle', name: 'Rectangle', icon: 'Square', type: 'rectangle' },
  { id: 'circle', name: 'Circle', icon: 'Circle', type: 'circle' },
  { id: 'fibonacci', name: 'Fibonacci', icon: 'Zap', type: 'fibonacci' },
  { id: 'text', name: 'Text', icon: 'Type', type: 'text' },
];

export const INDICATORS = [
  { id: 'sma', name: 'Simple Moving Average', type: 'overlay' },
  { id: 'ema', name: 'Exponential Moving Average', type: 'overlay' },
  { id: 'bb', name: 'Bollinger Bands', type: 'overlay' },
  { id: 'rsi', name: 'Relative Strength Index', type: 'oscillator' },
  { id: 'macd', name: 'MACD', type: 'oscillator' },
  { id: 'volume', name: 'Volume', type: 'oscillator' },
  { id: 'atr', name: 'Average True Range', type: 'oscillator' },
  { id: 'stoch', name: 'Stochastic', type: 'oscillator' },
];

export const CHART_COLORS = {
  background: {
    light: '#ffffff',
    dark: '#131722',
  },
  grid: {
    light: '#e5e7eb',
    dark: '#2a2e39',
  },
  text: {
    light: '#333333',
    dark: '#d1d4dc',
  },
  candle: {
    up: {
      light: '#22c55e',
      dark: '#089981',
    },
    down: {
      light: '#ef4444',
      dark: '#f23645',
    },
  },
  indicators: [
    '#2196F3', '#FF9800', '#4CAF50', '#9C27B0',
    '#00BCD4', '#FFC107', '#795548', '#607D8B',
    '#E91E63', '#3F51B5', '#009688', '#FF5722'
  ]
};