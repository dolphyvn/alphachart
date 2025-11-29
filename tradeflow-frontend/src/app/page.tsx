'use client';

import { ChartContainer } from '@/components/chart/ChartContainer';
import { useMarketData } from '@/hooks/useMarketData';
import { useIndicators } from '@/hooks/useIndicators';
import { useState } from 'react';

export default function Home() {
  const [symbol, setSymbol] = useState('XAUUSD'); // Default symbol
  const [timeframe, setTimeframe] = useState('1s');

  const { bars, isLoading, error } = useMarketData(symbol, timeframe);
  const { indicators, addIndicator, removeIndicator } = useIndicators(symbol, timeframe);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-background text-foreground">
      <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-4xl font-bold tracking-tight">TradeFlow Pro</h1>
        <div className="flex gap-4 items-center">
          <div className="px-4 py-2 bg-muted rounded">
            Symbol: {symbol}
          </div>
          <div className="px-4 py-2 bg-muted rounded">
            Timeframe: {timeframe}
          </div>
          <div className="flex gap-2">
            <button onClick={() => addIndicator('SMA')} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
              + SMA
            </button>
            <button onClick={() => addIndicator('EMA')} className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700">
              + EMA
            </button>
            <button onClick={() => addIndicator('BOLLINGER')} className="px-3 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-700">
              + BB
            </button>
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
        <ChartContainer bars={bars} indicators={indicators} />

        {/* Active Indicators List */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {indicators.map(ind => (
            <div key={ind.id} className="flex items-center gap-2 bg-background/80 backdrop-blur px-3 py-1 rounded border shadow-sm text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ind.color }}></span>
              <span>{ind.name}</span>
              <button onClick={() => removeIndicator(ind.id)} className="ml-2 text-muted-foreground hover:text-destructive">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
