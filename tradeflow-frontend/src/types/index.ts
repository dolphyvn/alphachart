export interface Bar {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  bars: Bar[];
  timeframe: string;
}

export interface Symbol {
  symbol: string;
  name: string;
  exchange: string;
  asset_type: 'forex' | 'crypto' | 'stocks' | 'futures' | 'commodities';
  description?: string;
  tick_size?: number;
}

export interface Timeframe {
  label: string;
  value: string;
  seconds: number;
}

export interface ChartType {
  id: string;
  label: string;
  value: 'candlestick' | 'bar' | 'line' | 'area' | 'baseline';
}

export interface Indicator {
  id: string;
  name: string;
  type: string;
  inputs: Record<string, any>;
  outputs: {
    name: string;
    color: string;
    style: 'line' | 'histogram' | 'area';
  }[];
  priceScaleId?: string;
  visible?: boolean;
}

export interface DrawingTool {
  id: string;
  name: string;
  icon: string;
  type: 'line' | 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'circle' | 'fibonacci' | 'text';
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface OrderFlowData {
  footprint: {
    timestamp: string;
    price: number;
    bidVolume: number;
    askVolume: number;
    delta: number;
    imbalanceRatio: number;
  }[];
  volumeProfile: {
    price: number;
    volume: number;
    bidVolume: number;
    askVolume: number;
    percent: number;
  }[];
  cvd: {
    time: string;
    delta: number;
    cumulativeDelta: number;
  }[];
}

export interface ChartLayout {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  chartType: ChartType;
  indicators: Indicator[];
  drawings: any[];
  orderFlow: {
    enabled: boolean;
    type: 'footprint' | 'volume-profile' | 'cvd' | 'none';
  };
}

export interface AppState {
  currentSymbol: Symbol;
  currentTimeframe: Timeframe;
  chartType: ChartType;
  theme: 'light' | 'dark';
  layout: ChartLayout;
  indicators: Indicator[];
  drawings: any[];
  watchlist: WatchlistItem[];
  orderFlow: OrderFlowData;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}