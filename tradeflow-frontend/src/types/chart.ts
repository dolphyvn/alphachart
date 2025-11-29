export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicator {
  id: string;
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD';
  color: string;
  period?: number;
  data?: number[];
}

export interface Drawing {
  id: string;
  type: 'line' | 'rect' | 'circle';
  points: { timestamp: number; price: number }[]; // Logical coordinates
}
