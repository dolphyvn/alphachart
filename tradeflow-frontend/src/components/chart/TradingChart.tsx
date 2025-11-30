'use client';

import React, { useEffect } from 'react';
import { useChart } from '@/hooks/useChart';
import { useMarketData } from '@/hooks/useMarketData';
import { Bar, Indicator, ChartType } from '@/types';

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  theme: 'light' | 'dark';
  chartType: ChartType;
  indicators: Indicator[];
  width?: number;
  height?: number;
  onBarUpdate?: (bar: Bar) => void;
}

export function TradingChart({
  symbol,
  timeframe,
  theme,
  chartType,
  indicators,
  width,
  height,
  onBarUpdate,
}: TradingChartProps) {
  const { bars, isLoading, error } = useMarketData({ symbol, timeframe });
  const {
    containerRef,
    isReady,
    updateData,
    addIndicator,
    removeIndicator,
    updateChartType,
    updateTheme,
    fitContent,
  } = useChart({ symbol, timeframe, theme, chartType, width, height });

  // Update chart data when bars change
  useEffect(() => {
    if (bars.length > 0 && isReady) {
      updateData(bars);
      setTimeout(() => fitContent(), 100); // Small delay to ensure rendering
    }
  }, [bars, isReady]);

  // Update chart type
  useEffect(() => {
    if (isReady) {
      updateChartType(chartType);
    }
  }, [chartType, isReady]);

  // Update theme
  useEffect(() => {
    if (isReady) {
      updateTheme(theme);
    }
  }, [theme, isReady]);

  // Manage indicators
  useEffect(() => {
    if (!isReady) return;

    // Clear existing indicators first
    // Note: In a real implementation, you'd track existing indicators
    // and only add/remove what's changed

    // Add indicators (this would need actual indicator data)
    indicators.forEach(indicator => {
      // For demo purposes, we'll generate fake indicator data
      const indicatorData = bars.map(() => Math.random() * 100);
      addIndicator(indicator, indicatorData);
    });
  }, [indicators, bars, isReady]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        <div className="text-center">
          <p className="text-lg font-semibold">Error loading chart data</p>
          <p className="text-sm opacity-75">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading && bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mx-auto mb-2"></div>
          <p className="text-sm">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ width, height }}
      />

      {/* Chart info overlay */}
      <div className="absolute top-4 left-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs">
        <div className="font-medium">{symbol}</div>
        <div className="text-muted-foreground">{timeframe}</div>
      </div>

      {/* Last price info */}
      {bars.length > 0 && (
        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs text-right">
          <div className="font-medium">{bars[bars.length - 1]?.close?.toFixed(4)}</div>
          <div className={bars[bars.length - 1]?.close >= bars[bars.length - 2]?.close ? 'text-green-500' : 'text-red-500'}>
            {bars[bars.length - 1]?.close >= bars[bars.length - 2]?.close ? '+' : ''}
            {(bars[bars.length - 1]?.close - bars[bars.length - 2]?.close)?.toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}