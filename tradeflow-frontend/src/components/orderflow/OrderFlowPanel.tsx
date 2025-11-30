import React, { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Settings, X, Maximize2, Minimize2 } from 'lucide-react';
import { OrderFlowConfig, OrderFlowData, Bar } from '@/types';
import { CVDPane } from './CVDPane';
import { VolumeProfilePane } from './VolumeProfilePane';
import { FootprintChart } from './FootprintChart';
import { OrderFlowControls } from './OrderFlowControls';
import { useOrderFlow } from '@/hooks/useOrderFlow';

interface OrderFlowPanelProps {
  symbol: string;
  timeframe: string;
  config: OrderFlowConfig;
  onConfigChange: (config: OrderFlowConfig) => void;
  currentPrice?: number;
  theme: 'light' | 'dark';
  width?: number;
  height?: number;
  marketData?: Bar[];
  // Allow setting a fixed height override
  fixedHeight?: number;
}

export function OrderFlowPanel({
  symbol,
  timeframe,
  config,
  onConfigChange,
  currentPrice,
  theme,
  width = 800,
  height = 600,
  marketData
}: OrderFlowPanelProps) {
  const [showControls, setShowControls] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { orderFlowData, isLoading, error } = useOrderFlow({
    symbol,
    timeframe,
    enabled: config.enabled,
    type: config.type
  });

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!config.enabled || config.type === 'none') {
    return null;
  }

  // Calculate panel dimensions
  const controlsWidth = showControls ? 300 : 0;
  const chartWidth = width - controlsWidth;
  const chartHeight = height - 40; // Account for header

  const renderOrderFlowContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading order flow data...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-destructive">
            <p className="text-sm font-semibold">Error loading order flow data</p>
            <p className="text-xs opacity-75">{error}</p>
          </div>
        </div>
      );
    }

    if (!orderFlowData) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">No order flow data available</p>
        </div>
      );
    }

    switch (config.type) {
      case 'cvd':
        return (
          <CVDPane
            data={(orderFlowData as any)?.cvd || []}
            config={config.cvdSettings}
            width={chartWidth}
            height={chartHeight}
            theme={theme}
          />
        );

      case 'volume-profile':
        return (
          <VolumeProfilePane
            data={(orderFlowData as any)?.volumeProfile || []}
            config={config.volumeProfileSettings}
            width={chartWidth}
            height={chartHeight}
            theme={theme}
            currentPrice={currentPrice}
          />
        );

      case 'footprint':
        return (
          <FootprintChart
            data={(orderFlowData as any)?.footprint || []}
            config={config.footprintSettings}
            width={chartWidth}
            height={chartHeight}
            theme={theme}
            currentPrice={currentPrice}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`
        border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
        ${isExpanded ? 'fixed inset-0 z-50 bg-background' : ''}
      `}
      style={{
        width: isExpanded ? '100vw' : width,
        height: isExpanded ? '100vh' : height,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Order Flow</h3>
          <span className="text-xs text-muted-foreground capitalize">
            {config.type?.replace('-', ' ')}
          </span>
          {symbol && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{symbol}</span>
              {timeframe && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{timeframe}</span>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleControls}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Toggle Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={toggleExpanded}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onConfigChange({ ...config, enabled: false })}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Close Order Flow"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex h-full">
        <PanelGroup direction="horizontal">
          {/* Order Flow Display */}
          <Panel defaultSize={showControls ? 70 : 100} minSize={30}>
            <div className="h-full relative">
              {renderOrderFlowContent()}

              {/* Session Info Overlay */}
              {(orderFlowData as any)?.sessionInfo && (
                <div className="absolute top-4 left-4 bg-background/80 backdrop-blur px-3 py-2 rounded-md text-xs z-20 pointer-events-none">
                  <div className="space-y-1 font-mono">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">High:</span>
                      <span>{(orderFlowData as any).sessionInfo.high.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Low:</span>
                      <span>{(orderFlowData as any).sessionInfo.low.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Volume:</span>
                      <span>{(orderFlowData as any).sessionInfo.totalVolume.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Resize Handle */}
          {showControls && <PanelResizeHandle className="w-1 bg-border hover:bg-muted-foreground/50 transition-colors" />}

          {/* Controls Panel */}
          {showControls && (
            <Panel defaultSize={30} minSize={20} maxSize={40}>
              <div className="h-full overflow-y-auto border-l">
                <OrderFlowControls
                  config={config}
                  onConfigChange={onConfigChange}
                  symbol={symbol}
                  timeframe={timeframe}
                />
              </div>
            </Panel>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}