export interface Bar {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid_volume?: number;
  ask_volume?: number;
  number_of_trades?: number;
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

export interface FootprintBar {
  timestamp: string;
  price: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  imbalanceRatio: number;
  totalVolume: number;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  percent: number;
  buySellRatio: number;
  type: 'bid' | 'ask' | 'neutral';
}

export interface CVDDatum {
  time: string;
  delta: number;
  cumulativeDelta: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  price: number;
}

export interface OrderFlowData {
  footprint: FootprintBar[];
  volumeProfile: VolumeProfileLevel[];
  cvd: CVDDatum[];
  sessionInfo?: {
    sessionStart: string;
    sessionEnd: string;
    high: number;
    low: number;
    totalVolume: number;
    totalDelta: number;
  };
}

export interface OrderFlowConfig {
  enabled: boolean;
  type: 'footprint' | 'volume-profile' | 'cvd' | 'none';
  cvdSettings: {
    colorPositive: string;
    colorNegative: string;
    lineWidth: number;
    showCumulative: boolean;
    showDelta: boolean;
  };
  volumeProfileSettings: {
    areaStyle: 'solid' | 'gradient';
    colorScheme: 'bidask' | 'delta' | 'volume';
    showPOC: boolean; // Point of Control
    showVA: boolean;  // Value Area
    valueAreaPercent: number;
  };
  footprintSettings: {
    displayMode: 'split' | 'stacked' | 'delta';
    colorScheme: 'bidask' | 'delta';
    showNumbers: boolean;
    showTotal: boolean;
    aggregateTrades: boolean;
  };
}

export interface ChartLayout {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  chartType: ChartType;
  indicators: Indicator[];
  drawings: any[];
  orderFlow: OrderFlowConfig;
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