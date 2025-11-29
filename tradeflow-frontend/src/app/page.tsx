'use client';

import { ChartContainer } from '@/components/chart/ChartContainer';
import { Bar } from '@/types/chart';
import { useState, useEffect } from 'react';

// Generate dummy data
const generateData = (count: number): Bar[] => {
  const bars: Bar[] = [];
  let price = 100;
  let time = Math.floor(Date.now() / 1000) - count * 60;

  for (let i = 0; i < count; i++) {
    const open = price;
    const close = price + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random();
    const low = Math.min(open, close) - Math.random();
    const volume = Math.floor(Math.random() * 1000);

    bars.push({
      timestamp: time + i * 60,
      open,
      high,
      low,
      close,
      volume
    });

    price = close;
  }
  return bars;
};

export default function Home() {
  const [bars, setBars] = useState<Bar[]>([]);

  useEffect(() => {
    setBars(generateData(100));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-background text-foreground">
      <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-4xl font-bold tracking-tight">TradeFlow Pro</h1>
      </div>

      <div className="w-full max-w-7xl h-[600px] border rounded-xl shadow-sm">
        <ChartContainer bars={bars} />
      </div>
    </main>
  );
}
