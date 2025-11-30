'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, Maximize2, Grid3x3, Layers, BarChart3 } from 'lucide-react';
import { Header } from './Header';
import { Watchlist } from '../watchlist/Watchlist';
import { IndicatorsPanel } from '../indicators/IndicatorsPanel';
import { TradingChart } from '../chart/TradingChart';
import { OrderFlowPanel } from '../orderflow/OrderFlowPanel';
import { useChartStore } from '@/lib/stores/chart-store';
import { useMarketData } from '@/hooks/useMarketData';

type LayoutType = 'single' | 'dual-horizontal' | 'dual-vertical' | 'grid';

export function MainLayout() {
  const [layoutType, setLayoutType] = useState<LayoutType>('single');
  const [showWatchlist, setShowWatchlist] = useState(true);
  const [showIndicators, setShowIndicators] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    currentSymbol,
    currentTimeframe,
    chartType,
    theme,
    indicators,
    layout,
    setTheme,
    updateOrderFlowConfig,
  } = useChartStore();

  const { bars } = useMarketData({
    symbol: currentSymbol.symbol,
    timeframe: currentTimeframe.value
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const renderCharts = () => {
    const baseChartProps = {
      symbol: currentSymbol.symbol,
      timeframe: currentTimeframe.value,
      theme,
      chartType,
      indicators,
      orderFlowConfig: layout.orderFlow,
      marketData: bars,
      currentPrice: bars.length > 0 ? bars[bars.length - 1].close : undefined,
      onOrderFlowConfigChange: updateOrderFlowConfig,
    };

    switch (layoutType) {
      case 'dual-horizontal':
        return (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 border-b">
              <TradingChart {...baseChartProps} />
            </div>
            <div className="flex-1">
              <TradingChart {...baseChartProps} />
            </div>
          </div>
        );

      case 'dual-vertical':
        return (
          <div className="flex-1 flex">
            <div className="flex-1 border-r">
              <TradingChart {...baseChartProps} />
            </div>
            <div className="flex-1">
              <TradingChart {...baseChartProps} />
            </div>
          </div>
        );

      case 'grid':
        return (
          <div className="flex-1 grid grid-cols-2 grid-rows-2">
            <div className="border-r border-b">
              <TradingChart {...baseChartProps} />
            </div>
            <div className="border-b">
              <TradingChart {...baseChartProps} />
            </div>
            <div className="border-r">
              <TradingChart {...baseChartProps} />
            </div>
            <div>
              <TradingChart {...baseChartProps} />
            </div>
          </div>
        );

      default:
        return (
          <div className="flex-1">
            <TradingChart {...baseChartProps} />
          </div>
        );
    }
  };

  return (
    <div className={`h-screen flex flex-col bg-background ${theme}`}>
      {/* Header */}
      <Header />

      {/* Layout Controls Bar */}
      <div className="flex items-center justify-between px-4 py-1 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWatchlist(!showWatchlist)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showWatchlist
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Watchlist
          </button>
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showIndicators
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Indicators
          </button>
          <button
            onClick={() => updateOrderFlowConfig({
              enabled: !layout.orderFlow.enabled,
              type: !layout.orderFlow.enabled ? 'cvd' : 'none'
            })}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
              layout.orderFlow.enabled
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            Order Flow
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Options */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <button
              onClick={() => setLayoutType('single')}
              className={`p-1 rounded transition-colors ${
                layoutType === 'single'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Single Chart"
            >
              <Grid3x3 className="h-3 w-3" />
            </button>
            <button
              onClick={() => setLayoutType('dual-horizontal')}
              className={`p-1 rounded transition-colors ${
                layoutType === 'dual-horizontal'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Two Charts Horizontal"
            >
              <Layers className="h-3 w-3" style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button
              onClick={() => setLayoutType('dual-vertical')}
              className={`p-1 rounded transition-colors ${
                layoutType === 'dual-vertical'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Two Charts Vertical"
            >
              <Layers className="h-3 w-3" />
            </button>
            <button
              onClick={() => setLayoutType('grid')}
              className={`p-1 rounded transition-colors ${
                layoutType === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Four Charts Grid"
            >
              <Grid3x3 className="h-3 w-3" />
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Watchlist Sidebar */}
        {showWatchlist && (
          <div className="w-80 flex-shrink-0">
            <Watchlist />
          </div>
        )}

        {/* Chart Area */}
        {renderCharts()}

        {/* Indicators Panel */}
        {showIndicators && (
          <div className="w-80 flex-shrink-0">
            <IndicatorsPanel />
          </div>
        )}
      </div>
    </div>
  );
}