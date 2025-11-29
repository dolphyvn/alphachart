'use client';

import { ChartContainer } from '@/components/chart/ChartContainer';
import { useMarketData } from '@/hooks/useMarketData';
import { useIndicators } from '@/hooks/useIndicators';
import { useDrawings } from '@/hooks/useDrawings';
import { useVolumeProfile } from '@/hooks/useVolumeProfile';
import { useFootprint } from '@/hooks/useFootprint';
import { useCVD } from '@/hooks/useCVD';
import { Header } from '@/components/layout/Header';
import { useState } from 'react';

export default function Home() {
  const [symbol, setSymbol] = useState('XAUUSD'); // Default symbol
  const [timeframe, setTimeframe] = useState('1s');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const { bars, isLoading, error } = useMarketData(symbol, timeframe);
  const { indicators, addIndicator, removeIndicator } = useIndicators(symbol, timeframe);
  const { drawings, activeTool, setActiveTool, addDrawing, updateDrawing } = useDrawings();
  const { profile: volumeProfile } = useVolumeProfile(symbol, bars);
  const { footprintData } = useFootprint(symbol, timeframe, bars);
  const { cvdData } = useCVD(symbol, timeframe, bars);

  return (
    <main className={`flex min-h-screen flex-col ${theme === 'dark' ? 'dark' : ''} bg-background text-foreground`}>
      <Header
        symbol={symbol}
        onSymbolChange={setSymbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onAddIndicator={addIndicator}
        activeTool={activeTool}
        onToolChange={setActiveTool}
      />

      {/* Theme Toggle (Temporary UI) */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
        >
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>

      <div className="flex-1 w-full relative min-h-[600px]">
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
        <ChartContainer
          bars={bars}
          indicators={indicators}
          drawings={drawings}
          activeTool={activeTool}
          onAddDrawing={addDrawing}
          onUpdateDrawing={updateDrawing}
          volumeProfile={volumeProfile}
          footprint={footprintData}
          cvd={cvdData}
          theme={theme}
        />

        {/* Active Indicators List */}
        <div className="absolute top-16 left-4 z-10 flex flex-col gap-2">
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
