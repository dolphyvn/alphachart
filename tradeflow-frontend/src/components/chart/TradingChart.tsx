'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useChart } from '@/hooks/useChart';
import { useMarketData } from '@/hooks/useMarketData';
import { Bar, Indicator, ChartType } from '@/types';
import { CandleTooltip } from './CandleTooltip';
import { CVDPane } from '../orderflow/CVDPane';
import { VolumeProfilePane } from '../orderflow/VolumeProfilePane';
import { FootprintChart } from '../orderflow/FootprintChart';
import { OrderFlowControls } from '../orderflow/OrderFlowControls';
import { useOrderFlow } from '@/hooks/useOrderFlow';

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  theme: 'light' | 'dark';
  chartType: ChartType;
  indicators: Indicator[];
  width?: number;
  height?: number;
  onBarUpdate?: (bar: Bar) => void;
  orderFlowConfig?: any;
  marketData?: Bar[];
  currentPrice?: number;
  onOrderFlowConfigChange?: (config: any) => void;
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
  orderFlowConfig,
  marketData,
  currentPrice,
  onOrderFlowConfigChange,
}: TradingChartProps) {
  const { bars, isLoading, error } = useMarketData({ symbol, timeframe });
  const { orderFlowData, isLoading: orderFlowLoading } = useOrderFlow({
    symbol,
    timeframe,
    enabled: orderFlowConfig?.enabled || false,
    type: orderFlowConfig?.type || 'none'
  });
  const [showOrderFlowControls, setShowOrderFlowControls] = useState(false);
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
  const isSettingTooltipRef = React.useRef(false); // Prevent tooltip updates during data load

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
        // Delay tooltip updates briefly after candle updates to prevent loops
        isSettingTooltipRef.current = true;
        updateCandle(lastBar);
        setTimeout(() => {
          isSettingTooltipRef.current = false;
        }, 10);
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
  const handleCrosshairMove = useCallback((bar: Bar | null, x: number, y: number) => {
    // Skip tooltip updates during initial data load to prevent infinite loops
    if (!isLoadedRef.current || isSettingTooltipRef.current) {
      return;
    }

    // Debounce rapid updates by only setting state when values actually change
    setTooltipState(prev => {
      // Check if the bar or position actually changed
      if (
        prev.bar?.timestamp === bar?.timestamp &&
        prev.x === x &&
        prev.y === y &&
        prev.visible === !!bar
      ) {
        return prev; // No change, return previous state
      }

      if (bar) {
        return {
          bar,
          visible: true,
          x,
          y,
        };
      } else {
        return {
          ...prev,
          visible: false,
        };
      }
    });
  }, []); // Remove containerRef dependency since we don't use it anymore

  useEffect(() => {
    if (!isReady) return;

    setCrosshairMoveCallback(handleCrosshairMove);
  }, [isReady, setCrosshairMoveCallback, handleCrosshairMove]);

  // Render order flow panes - memoized to prevent infinite re-renders
  const renderOrderFlowPanes = React.useCallback(() => {
    console.log('renderOrderFlowPanes called:', {
      enabled: orderFlowConfig?.enabled,
      type: orderFlowConfig?.type,
      hasData: !!orderFlowData,
      dataLength: Array.isArray((orderFlowData as any)?.cvd) ? (orderFlowData as any).cvd.length : 0
    });

    if (!orderFlowConfig?.enabled || orderFlowConfig?.type === 'none') {
      console.log('Returning null - order flow disabled or type none');
      return null;
    }

    const paneHeight = 150; // Height for each order flow pane
    const actualBars = marketData || bars;

    switch (orderFlowConfig.type) {
      case 'cvd':
        console.log('Rendering CVD pane');
        return (
          <div className="border-t" style={{ height: `${paneHeight}px` }} key="cvd-pane">
            <CVDPane
              data={(orderFlowData as any)?.cvd || []}
              config={orderFlowConfig.cvdSettings}
              width={width || 800}
              height={paneHeight}
              theme={theme}
            />
          </div>
        );

      case 'volume-profile':
        return (
          <div className="border-t" style={{ height: `${paneHeight}px` }}>
            <VolumeProfilePane
              data={(orderFlowData as any)?.volumeProfile || []}
              config={orderFlowConfig.volumeProfileSettings}
              width={width || 800}
              height={paneHeight}
              theme={theme}
              currentPrice={currentPrice || (actualBars.length > 0 ? actualBars[actualBars.length - 1].close : undefined)}
            />
          </div>
        );

      case 'footprint':
        return (
          <div className="border-t" style={{ height: `${paneHeight * 2}px` }}>
            <FootprintChart
              data={(orderFlowData as any)?.footprint || []}
              config={orderFlowConfig.footprintSettings}
              width={width || 800}
              height={paneHeight * 2}
              theme={theme}
              currentPrice={currentPrice || (actualBars.length > 0 ? actualBars[actualBars.length - 1].close : undefined)}
            />
          </div>
        );

      default:
        return null;
    }
  }, [orderFlowConfig, orderFlowData, width, theme, marketData, bars, currentPrice]);

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
    <div className="flex flex-col w-full h-full">
      {/* Main Chart */}
      <div className="relative flex-1">
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
        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs z-20">
          <div className="font-medium">{symbol}</div>
          <div className="text-muted-foreground">{timeframe}</div>
        </div>

        {/* Order Flow Controls Button */}
        <div className="absolute top-4 left-32 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs z-20">
          <button
            onClick={() => setShowOrderFlowControls(!showOrderFlowControls)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            <span>Order Flow</span>
            {orderFlowConfig?.enabled && (
              <span className="text-xs opacity-75">
                {orderFlowConfig.type === 'cvd' ? 'CVD' :
                 orderFlowConfig.type === 'volume-profile' ? 'VP' :
                 orderFlowConfig.type === 'footprint' ? 'FP' : ''}
              </span>
            )}
          </button>
        </div>

        {/* Order Flow Controls Panel */}
        {showOrderFlowControls && onOrderFlowConfigChange && (
          <div className="absolute top-12 left-4 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-4 z-30 w-80">
            <OrderFlowControls
              config={orderFlowConfig || {
                enabled: false,
                type: 'none',
                cvdSettings: {
                  colorPositive: '#22c55e',
                  colorNegative: '#ef4444',
                  lineWidth: 2,
                  showCumulative: true,
                  showDelta: true,
                },
                volumeProfileSettings: {
                  areaStyle: 'gradient',
                  colorScheme: 'bidask',
                  showPOC: true,
                  showVA: true,
                  valueAreaPercent: 70,
                },
                footprintSettings: {
                  displayMode: 'split',
                  colorScheme: 'bidask',
                  showNumbers: true,
                  showTotal: true,
                  aggregateTrades: true,
                },
              }}
              onConfigChange={onOrderFlowConfigChange}
              symbol={symbol}
              timeframe={timeframe}
            />
            <button
              onClick={() => setShowOrderFlowControls(false)}
              className="absolute top-2 right-2 p-1 rounded hover:bg-muted"
            >
              ×
            </button>
          </div>
        )}

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

      {/* Order Flow Panes */}
      {renderOrderFlowPanes()}

      {/* Order Flow Loading Overlay */}
      {orderFlowLoading && orderFlowConfig?.enabled && orderFlowConfig?.type !== 'none' && (
        <div className="flex items-center justify-center border-t bg-muted/20" style={{ height: '40px' }}>
          <div className="text-xs text-muted-foreground">Loading order flow data...</div>
        </div>
      )}
    </div>
  );
}