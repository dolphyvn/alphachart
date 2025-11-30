import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  LineSeries,
  HistogramSeries
} from 'lightweight-charts';
import { CVDDatum, OrderFlowConfig } from '@/types';

interface CVDPaneProps {
  data: CVDDatum[];
  config: OrderFlowConfig['cvdSettings'];
  width: number;
  height: number;
  theme: 'light' | 'dark';
}

export function CVDPane({ data, config, width, height, theme }: CVDPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const cumulativeSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const deltaSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Debug: Log received data (only when length changes)
  useEffect(() => {
    if (data.length > 0) {
      console.log('CVD Pane received data:', data.length, 'items');
      console.log('CVD config:', config);
      console.log('First CVD data point:', data[0]);
    }
  }, [data.length]); // Only trigger when data length changes

  // Chart creation and destruction - only create once per component mount
  useEffect(() => {
    if (!containerRef.current) return;

    console.log('Creating CVD chart (first time)...');
    console.log('Container dimensions:', { width, height });
    console.log('Container element:', containerRef.current);

    // Initialize chart
    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: theme === 'dark' ? '#1a1a1a' : '#ffffff' },
        textColor: theme === 'dark' ? '#d1d5db' : '#374151',
        fontSize: 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#374151' : '#e5e7eb' },
        horzLines: { color: theme === 'dark' ? '#374151' : '#e5e7eb' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          width: 1,
          style: 3,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        autoScale: true,
      },
      leftPriceScale: {
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        autoScale: true,
        visible: config.showDelta,
      },
    });

    chartRef.current = chart;
    console.log('CVD chart created successfully');

    return () => {
      console.log('Disposing CVD chart...');
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      cumulativeSeriesRef.current = null;
      deltaSeriesRef.current = null;
    };
  }, []); // Empty dependency array - only create on mount

  // Series management when config changes
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    // Remove existing series
    if (cumulativeSeriesRef.current) {
      chart.removeSeries(cumulativeSeriesRef.current);
      cumulativeSeriesRef.current = null;
    }
    if (deltaSeriesRef.current) {
      chart.removeSeries(deltaSeriesRef.current);
      deltaSeriesRef.current = null;
    }

    // Add cumulative delta series (line chart)
    if (config.showCumulative) {
      const cumulativeSeries = chart.addSeries(LineSeries, {
        color: config.colorPositive,
        lineWidth: config.lineWidth as any, // Type assertion for compatibility
        title: 'CVD',
        priceScaleId: 'right',
        lastValueVisible: true,
        priceLineVisible: false,
      });

      cumulativeSeriesRef.current = cumulativeSeries;
    }

    // Add delta series (histogram)
    if (config.showDelta) {
      const deltaSeries = chart.addSeries(HistogramSeries, {
        color: '#4ade80', // Will be updated per bar
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'left',
        title: 'Delta',
        lastValueVisible: true,
        priceLineVisible: false,
      });

      deltaSeriesRef.current = deltaSeries;
    }

    // Update left price scale visibility
    chart.priceScale('left').applyOptions({
      visible: config.showDelta,
    });

  }, [config]);

  // Update chart when data changes
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    try {
      if (config.showCumulative && cumulativeSeriesRef.current) {
        const cumulativeData = data.map((datum) => {
          const time = convertTime(datum.time);
          const value = datum.cumulativeDelta || 0; // Handle null/undefined values
          return { time, value };
        }).filter(item => !isNaN(item.value)); // Filter out invalid values

        if (cumulativeData.length > 0) {
          cumulativeSeriesRef.current.setData(cumulativeData);
          console.log('Updated cumulative series with', cumulativeData.length, 'points');
        }
      }

      if (config.showDelta && deltaSeriesRef.current) {
        const deltaData = data.map((datum) => {
          const time = convertTime(datum.time);
          const value = datum.delta || 0; // Handle null/undefined values
          const color = datum.delta >= 0 ? config.colorPositive : config.colorNegative;
          return { time, value, color };
        }).filter(item => !isNaN(item.value)); // Filter out invalid values

        if (deltaData.length > 0) {
          deltaSeriesRef.current.setData(deltaData);
          console.log('Updated delta series with', deltaData.length, 'points');
        }
      }

      // Sync time scale with main chart and fit content
      setTimeout(() => {
        if (chartRef.current) {
          console.log('Fitting chart content...');
          chartRef.current.timeScale().fitContent();
        }
      }, 100);

    } catch (error) {
      console.error('Error updating CVD chart data:', error);
    }
  }, [data, config]);

  // Handle resize
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ width, height });
    }
  }, [width, height]);

  // Time conversion helper
  const convertTime = (time: string): Time => {
    const date = new Date(time);
    return Math.floor(date.getTime() / 1000) as Time;
  };

  // Calculate statistics
  const getStatistics = () => {
    if (!data.length) return null;

    const latest = data[data.length - 1];
    const totalDelta = latest?.cumulativeDelta || 0;
    const currentDelta = latest?.delta || 0;
    const totalVolume = latest?.volume || 0;

    const maxDelta = Math.max(...data.map(d => d.cumulativeDelta));
    const minDelta = Math.min(...data.map(d => d.cumulativeDelta));

    return {
      totalDelta,
      currentDelta,
      totalVolume,
      maxDelta,
      minDelta,
      deltaPercent: totalVolume > 0 ? (totalDelta / totalVolume) * 100 : 0,
    };
  };

  const stats = getStatistics();

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />

      {/* Statistics overlay */}
      {stats && (
        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur px-3 py-2 rounded-md text-xs z-20 pointer-events-none">
          <div className="space-y-1 font-mono">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">CVD:</span>
              <span className={`font-medium ${stats.totalDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.totalDelta >= 0 ? '+' : ''}{stats.totalDelta.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Delta:</span>
              <span className={`font-medium ${stats.currentDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.currentDelta >= 0 ? '+' : ''}{stats.currentDelta.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Delta%:</span>
              <span className={`font-medium ${stats.deltaPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.deltaPercent >= 0 ? '+' : ''}{stats.deltaPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur px-3 py-2 rounded-md text-xs z-20 pointer-events-none">
        <div className="flex gap-4">
          {config.showCumulative && (
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: config.colorPositive }}
              />
              <span>Cumulative</span>
            </div>
          )}
          {config.showDelta && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm" />
              <span>Delta</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}