'use client';

import { ChartContainer } from '@/components/chart/ChartContainer';
import { useMarketData } from '@/hooks/useMarketData';
import { useState } from 'react';

export default function Home() {
  const [symbol, setSymbol] = useState('XAUUSD'); // Default symbol
  const [timeframe, setTimeframe] = useState('1m');

  const { bars, isLoading, error } = useMarketData(symbol, timeframe);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-background text-foreground">
      <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-4xl font-bold tracking-tight">TradeFlow Pro</h1>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-muted rounded">
            Symbol: {symbol}
          </div>
          <div className="px-4 py-2 bg-muted rounded">
            Timeframe: {timeframe}
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl h-[600px] border rounded-xl shadow-sm relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
            Loading...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20 text-red-500">
            {error}
          </div>
        )}
        <ChartContainer bars={bars} />
      </div>
    </main>
  );
}
