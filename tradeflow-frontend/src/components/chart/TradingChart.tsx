'use client';

import React, { useEffect, useState } from 'react';
import { useChart } from '@/hooks/useChart';
import { useMarketData } from '@/hooks/useMarketData';
import { Bar, Indicator, ChartType } from '@/types';
import { CandleTooltip } from './CandleTooltip';

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
  const [tooltipState, setTooltipState] = useState<{
    bar: Bar | null;
    visible: boolean;
    x: number;
    y: number;
  }>({
    bar: null,
    visible: false,
    x: 0,
    y: 0,
  });

  const {
    containerRef,
    isReady,
    updateData,
    addIndicator,
    removeIndicator,
    updateChartType,
    updateTheme,
    fitContent,
    updateCandle,
    setCrosshairMoveCallback,
  } = useChart({ symbol, timeframe, theme, chartType, width, height });

  // Track state to differentiate between initial load and updates
  const prevSymbolRef = React.useRef(symbol);
  const prevTimeframeRef = React.useRef(timeframe);
  const isLoadedRef = React.useRef(false);

  // Reset loaded state on symbol/timeframe change
  useEffect(() => {
    if (symbol !== prevSymbolRef.current || timeframe !== prevTimeframeRef.current) {
      isLoadedRef.current = false;
      prevSymbolRef.current = symbol;
      prevTimeframeRef.current = timeframe;
    }
  }, [symbol, timeframe]);

  // Update chart data when bars change
  useEffect(() => {
    if (!isReady || bars.length === 0) return;

    if (!isLoadedRef.current) {
      // Initial load: set full data and fit content
      updateData(bars);
      setTimeout(() => fitContent(), 100);
      isLoadedRef.current = true;
    } else {
      // Real-time update: just update the last candle
      // This avoids resetting the view/zoom and is much more efficient
      const lastBar = bars[bars.length - 1];
      if (lastBar) {
        updateCandle(lastBar);
      }
    }
  }, [bars, isReady, updateData, updateCandle, fitContent]);

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

  // Setup crosshair move callback for tooltip
  useEffect(() => {
    if (!isReady) return;

    const handleCrosshairMove = (bar: Bar | null, x: number, y: number) => {
      if (containerRef.current && bar) {
        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = x;
        const relativeY = y;

        setTooltipState({
          bar,
          visible: true,
          x: relativeX,
          y: relativeY,
        });
      } else {
        setTooltipState(prev => ({ ...prev, visible: false }));
      }
    };

    setCrosshairMoveCallback(handleCrosshairMove);
  }, [isReady, containerRef, setCrosshairMoveCallback]);

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

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ width, height }}
      />

      {/* Candle Tooltip */}
      <CandleTooltip
        bar={tooltipState.bar}
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
      />

      {/* Loading Overlay */}
      {isLoading && bars.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading market data...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur z-10">
          <div className="text-center text-destructive">
            <p className="text-lg font-semibold">Error loading chart data</p>
            <p className="text-sm opacity-75">{error}</p>
          </div>
        </div>
      )}

      {/* Chart info overlay */}
      <div className="absolute top-4 left-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs z-20 pointer-events-none">
        <div className="font-medium">{symbol}</div>
        <div className="text-muted-foreground">{timeframe}</div>
      </div>

      {/* Last price info */}
      {bars.length > 0 && (
        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs text-right z-20 pointer-events-none">
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