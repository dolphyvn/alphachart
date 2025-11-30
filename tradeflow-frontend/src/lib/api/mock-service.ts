import { Bar } from '@/types';

export class MockMarketDataService {
  private static instance: MockMarketDataService;
  private basePrice: number;
  private lastTimestamp: number;

  private constructor() {
    this.basePrice = 2000;
    this.lastTimestamp = Date.now() - 500 * 1000; // Start 500 bars ago
  }

  static getInstance(): MockMarketDataService {
    if (!MockMarketDataService.instance) {
      MockMarketDataService.instance = new MockMarketDataService();
    }
    return MockMarketDataService.instance;
  }

  generateHistoricalData(count: number = 500): Bar[] {
    const bars: Bar[] = [];
    let currentPrice = this.basePrice;

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(this.lastTimestamp + (i * 1000)).toISOString();

      // Generate OHLC data
      const volatility = 0.001;
      const trend = Math.sin(i * 0.01) * 0.0005;
      const change = (Math.random() - 0.5) * volatility + trend;

      const open = currentPrice;
      const close = open + (change * open);
      const high = Math.max(open, close) + (Math.random() * 0.0005 * open);
      const low = Math.min(open, close) - (Math.random() * 0.0005 * open);
      const volume = Math.floor(Math.random() * 1000) + 100;

      bars.push({
        time: timestamp,
        open: Number(open.toFixed(4)),
        high: Number(high.toFixed(4)),
        low: Number(low.toFixed(4)),
        close: Number(close.toFixed(4)),
        volume,
      });

      currentPrice = close;
    }

    this.basePrice = currentPrice;
    this.lastTimestamp = Date.now();

    return bars;
  }

  generateNextBar(lastBar?: Bar): Bar {
    const now = new Date().toISOString();
    const currentPrice = lastBar?.close || this.basePrice;

    const volatility = 0.001;
    const trend = Math.sin(Date.now() * 0.0001) * 0.0005;
    const change = (Math.random() - 0.5) * volatility + trend;

    const open = currentPrice;
    const close = open + (change * open);
    const high = Math.max(open, close) + (Math.random() * 0.0005 * open);
    const low = Math.min(open, close) - (Math.random() * 0.0005 * open);
    const volume = Math.floor(Math.random() * 1000) + 100;

    return {
      time: now,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume,
    };
  }

  startRealtimeUpdates(callback: (bar: Bar) => void, interval: number = 1000): () => void {
    const intervalId = setInterval(() => {
      const newBar = this.generateNextBar();
      callback(newBar);
    }, interval);

    return () => clearInterval(intervalId);
  }
}