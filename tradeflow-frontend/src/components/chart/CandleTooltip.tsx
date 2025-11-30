import React from 'react';
import { Bar } from '@/types';

interface CandleTooltipProps {
  bar: Bar | null;
  visible: boolean;
  x: number;
  y: number;
}

export function CandleTooltip({ bar, visible, x, y }: CandleTooltipProps) {
  if (!visible || !bar) return null;

  // Calculate derived values
  const bidVolume = bar.bid_volume || 0;
  const askVolume = bar.ask_volume || 0;
  const delta = askVolume - bidVolume;
  const totalVolume = bidVolume + askVolume || bar.volume || 1;
  const imbalance = Math.abs(bidVolume - askVolume) / totalVolume;
  const aggression = askVolume / Math.max(bidVolume, 1);
  const trades = bar.number_of_trades || 0;

  // Format time from timestamp
  const formatTime = (time: string | number) => {
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Format delta with sign
  const formatDelta = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value}`;
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  // Determine aggression text
  const getAggressionText = () => {
    if (aggression > 1) return `${formatPercentage(aggression)} buy`;
    return `${formatPercentage(2 - aggression)} sell`;
  };

  return (
    <div
      className="absolute z-50 px-3 py-2 text-xs bg-background border border-border rounded-md shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
      style={{
        left: `${x}px`,
        top: `${y - 8}px`,
      }}
    >
      <div className="space-y-1 font-mono">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Time:</span>
          <span className="font-medium">{formatTime(bar.time)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Close:</span>
          <span className="font-medium">{bar.close.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Volume:</span>
          <span className="font-medium">{Math.round(bar.volume)}</span>
        </div>
        {bidVolume > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Bid Vol:</span>
            <span className="font-medium text-red-500">{Math.round(bidVolume)}</span>
          </div>
        )}
        {askVolume > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Ask Vol:</span>
            <span className="font-medium text-green-500">{Math.round(askVolume)}</span>
          </div>
        )}
        {delta !== 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Delta:</span>
            <span className={`font-medium ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatDelta(Math.round(delta))}
            </span>
          </div>
        )}
        {trades > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Trades:</span>
            <span className="font-medium">{trades}</span>
          </div>
        )}
        {(bidVolume > 0 || askVolume > 0) && (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Aggression:</span>
              <span className={`font-medium ${aggression > 1 ? 'text-green-500' : 'text-red-500'}`}>
                {getAggressionText()}
              </span>
            </div>
            {imbalance > 0.01 && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Imbalance:</span>
                <span className="font-medium text-blue-500">
                  {formatPercentage(imbalance)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}