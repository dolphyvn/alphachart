export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  timestamp: number;
  value: number | { [key: string]: number }; // Single value or object (e.g. {upper, middle, lower})
}

export interface Indicator {
  id: string;
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BOLLINGER';
  name: string;
  color: string;
  params: { [key: string]: any }; // e.g. { period: 14, std_dev: 2 }
  data: IndicatorData[];
  overlay: boolean; // True if drawn on price chart, false if separate pane
}

export interface Drawing {
  id: string;
  type: 'line' | 'rect' | 'circle';
  points: { timestamp: number; price: number }[]; // Logical coordinates
}
