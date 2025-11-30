'use client';

import { useEffect, useRef, useState } from 'react';
import { TradingChart } from '@/lib/chart-engine/chart';
import { Bar, Indicator, ChartType } from '@/types';

export interface UseChartOptions {
  symbol: string;
  timeframe: string;
  theme: 'light' | 'dark';
  chartType: ChartType;
  width?: number;
  height?: number;
}

export function useChart(options: UseChartOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<TradingChart | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new TradingChart({
      width: options.width || containerRef.current.clientWidth,
      height: options.height || containerRef.current.clientHeight,
      symbol: options.symbol,
      timeframe: options.timeframe,
      theme: options.theme,
    });

    chart.init(containerRef.current);
    chartRef.current = chart;
    setIsReady(true);

    return () => {
      chart.destroy();
      chartRef.current = null;
      setIsReady(false);
    };
  }, []);

  // Update symbol
  useEffect(() => {
    if (!chartRef.current || !isReady) return;

    chartRef.current.updateSize(
      options.width || containerRef.current?.clientWidth || 800,
      options.height || containerRef.current?.clientHeight || 600
    );
  }, [options.width, options.height]);

  // Update data
  const updateData = (bars: Bar[]) => {
    if (!chartRef.current || !isReady) return;
    chartRef.current.updateData(bars);
  };

  // Add indicator
  const addIndicator = (indicator: Indicator, data: number[]) => {
    if (!chartRef.current || !isReady) return;
    chartRef.current.addIndicator(indicator, data);
  };

  // Remove indicator
  const removeIndicator = (indicatorId: string) => {
    if (!chartRef.current || !isReady) return;
    chartRef.current.removeIndicator(indicatorId);
  };

  // Update chart type
  const updateChartType = (chartType: ChartType) => {
    if (!chartRef.current || !isReady) return;
    chartRef.current.updateChartType(chartType);
  };

  // Update theme
  const updateTheme = (theme: 'light' | 'dark') => {
    if (!chartRef.current || !isReady) return;
    chartRef.current.updateTheme(theme);
  };

  // Fit content
  const fitContent = () => {
    if (!chartRef.current || !isReady) return;
    chartRef.current.fitContent();
  };

  return {
    containerRef,
    isReady,
    updateData,
    addIndicator,
    removeIndicator,
    updateChartType,
    updateTheme,
    fitContent,
  };
}