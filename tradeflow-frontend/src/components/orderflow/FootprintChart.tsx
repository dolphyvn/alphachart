import React, { useState, useMemo } from 'react';
import { FootprintBar, OrderFlowConfig } from '@/types';

interface FootprintChartProps {
  data: FootprintBar[];
  config: OrderFlowConfig['footprintSettings'];
  width: number;
  height: number;
  theme: 'light' | 'dark';
  currentPrice?: number;
}

interface FootprintCellProps {
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  delta: number;
  price: number;
  isCurrentPrice?: boolean;
  config: OrderFlowConfig['footprintSettings'];
  displayMode: 'split' | 'stacked' | 'delta';
  colorScheme: 'bidask' | 'delta';
}

function FootprintCell({
  bidVolume,
  askVolume,
  totalVolume,
  delta,
  price,
  isCurrentPrice,
  config,
  displayMode,
  colorScheme
}: FootprintCellProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getCellStyle = () => {
    if (displayMode === 'delta') {
      if (delta > 0) {
        return {
          backgroundColor: `rgba(34, 197, 94, ${Math.min(0.8, 0.2 + Math.abs(delta) / totalVolume)})`,
          borderColor: '#22c55e'
        };
      } else if (delta < 0) {
        return {
          backgroundColor: `rgba(239, 68, 68, ${Math.min(0.8, 0.2 + Math.abs(delta) / totalVolume)})`,
          borderColor: '#ef4444'
        };
      } else {
        return {
          backgroundColor: 'rgba(156, 163, 175, 0.1)',
          borderColor: '#9ca3af'
        };
      }
    } else {
      // bidask or stacked mode
      return {
        backgroundColor: 'rgba(249, 250, 251, 0.8)',
        borderColor: isCurrentPrice ? '#3b82f6' : '#e5e7eb'
      };
    }
  };

  const renderContent = () => {
    if (displayMode === 'delta') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-xs font-mono">
          <div className={delta >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(0)}
          </div>
          {config.showTotal && (
            <div className="text-muted-foreground text-[10px]">
              {totalVolume.toFixed(0)}
            </div>
          )}
        </div>
      );
    } else if (displayMode === 'split') {
      return (
        <div className="flex h-full">
          <div className="flex-1 flex items-center justify-center border-r border-gray-300 dark:border-gray-600">
            {config.showNumbers && (
              <span className="text-xs font-mono text-red-700 dark:text-red-300">
                {askVolume.toFixed(0)}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center">
            {config.showNumbers && (
              <span className="text-xs font-mono text-green-700 dark:text-green-300">
                {bidVolume.toFixed(0)}
              </span>
            )}
          </div>
        </div>
      );
    } else { // stacked
      return (
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center border-b border-gray-300 dark:border-gray-600">
            {config.showNumbers && (
              <span className="text-xs font-mono text-red-700 dark:text-red-300">
                {askVolume.toFixed(0)}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center">
            {config.showNumbers && (
              <span className="text-xs font-mono text-green-700 dark:text-green-300">
                {bidVolume.toFixed(0)}
              </span>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <div
      className={`
        relative border-l border-r border-t transition-colors cursor-pointer
        ${isCurrentPrice ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
        ${isHovered ? 'z-10 shadow-md' : ''}
      `}
      style={{
        height: '24px',
        ...getCellStyle(),
        borderWidth: '1px',
        borderStyle: 'solid'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {renderContent()}

      {/* Tooltip on hover */}
      {isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-background border border-border rounded shadow-lg whitespace-nowrap">
          <div className="space-y-1 font-mono">
            <div>Price: {price.toFixed(2)}</div>
            <div>Bid: {bidVolume.toFixed(0)}</div>
            <div>Ask: {askVolume.toFixed(0)}</div>
            <div>Delta: {delta >= 0 ? '+' : ''}{delta.toFixed(0)}</div>
            <div>Total: {totalVolume.toFixed(0)}</div>
            <div>Imbalance: {((Math.abs(delta) / totalVolume) * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FootprintChart({
  data,
  config,
  width,
  height,
  theme,
  currentPrice
}: FootprintChartProps) {
  // Process data to group by price levels
  const processedData = useMemo(() => {
    if (!data.length) return [];

    // Group bars by price and time ranges
    const priceMap = new Map<number, FootprintBar[]>();

    data.forEach(bar => {
      if (!priceMap.has(bar.price)) {
        priceMap.set(bar.price, []);
      }
      priceMap.get(bar.price)!.push(bar);
    });

    // Convert to array and sort by price (descending for display)
    return Array.from(priceMap.entries())
      .map(([price, bars]) => {
        const totalBidVolume = bars.reduce((sum, bar) => sum + bar.bidVolume, 0);
        const totalAskVolume = bars.reduce((sum, bar) => sum + bar.askVolume, 0);
        const totalVolume = totalBidVolume + totalAskVolume;
        const totalDelta = totalBidVolume - totalAskVolume;

        return {
          price,
          bidVolume: totalBidVolume,
          askVolume: totalAskVolume,
          totalVolume,
          delta: totalDelta,
          bars: bars.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
          latestTimestamp: bars[bars.length - 1]?.timestamp
        };
      })
      .sort((a, b) => b.price - a.price); // Highest price at top
  }, [data, config.aggregateTrades]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!processedData.length) return null;

    const totalVolume = processedData.reduce((sum, level) => sum + level.totalVolume, 0);
    const totalDelta = processedData.reduce((sum, level) => sum + level.delta, 0);
    const maxDelta = Math.max(...processedData.map(level => level.delta));
    const minDelta = Math.min(...processedData.map(level => level.delta));

    // Find price levels with highest buy/sell pressure
    const maxBuyPressure = processedData.reduce((max, level) =>
      level.bidVolume > max.bidVolume ? level : max
    );
    const maxSellPressure = processedData.reduce((max, level) =>
      level.askVolume > max.askVolume ? level : max
    );

    return {
      totalVolume,
      totalDelta,
      maxDelta,
      minDelta,
      deltaPercent: totalVolume > 0 ? (totalDelta / totalVolume) * 100 : 0,
      maxBuyPressure,
      maxSellPressure,
      levelsTraded: processedData.length
    };
  }, [processedData]);

  // Calculate visible rows
  const maxRows = Math.floor((height - 100) / 24); // Reserve space for header and stats
  const visibleData = processedData.slice(0, maxRows);

  return (
    <div className="relative w-full h-full p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold">Footprint Chart</h3>
        {statistics && (
          <div className="text-xs text-muted-foreground">
            Levels: {statistics.levelsTraded}
          </div>
        )}
      </div>

      {/* Column headers */}
      {config.showNumbers && (
        <div className="flex mb-2 text-xs text-muted-foreground">
          <div className="w-16 text-right pr-2">Price</div>
          <div className="flex-1">
            {config.displayMode === 'split' && (
              <div className="flex">
                <div className="flex-1 text-center">Ask</div>
                <div className="flex-1 text-center">Bid</div>
              </div>
            )}
            {config.displayMode === 'stacked' && (
              <div className="flex">
                <div className="flex-1 text-center">Ask / Bid</div>
              </div>
            )}
            {config.displayMode === 'delta' && (
              <div className="text-center">Delta</div>
            )}
          </div>
          <div className="w-24 text-right">Volume</div>
        </div>
      )}

      {/* Footprint display */}
      <div className="relative overflow-y-auto" style={{ height: `calc(100% - 120px)` }}>
        {visibleData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No footprint data available</p>
          </div>
        ) : (
          <div className="space-y-0">
            {visibleData.map((level) => (
              <div key={level.price} className="flex items-center">
                {/* Price label */}
                <div className="w-16 text-xs font-mono text-right pr-2">
                  {level.price.toFixed(2)}
                </div>

                {/* Footprint cell */}
                <div className="flex-1">
                  <FootprintCell
                    bidVolume={level.bidVolume}
                    askVolume={level.askVolume}
                    totalVolume={level.totalVolume}
                    delta={level.delta}
                    price={level.price}
                    isCurrentPrice={!!(currentPrice && Math.abs(currentPrice - level.price) < 0.01)}
                    config={config}
                    displayMode={config.displayMode}
                    colorScheme={config.colorScheme}
                  />
                </div>

                {/* Total volume */}
                {config.showTotal && (
                  <div className="w-24 text-xs font-mono text-right pl-2">
                    {level.totalVolume.toFixed(0)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics overlay */}
      {statistics && (
        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur px-3 py-2 rounded-md text-xs z-20">
          <div className="space-y-1 font-mono">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total Vol:</span>
              <span>{statistics.totalVolume.toFixed(0)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total Delta:</span>
              <span className={statistics.totalDelta >= 0 ? 'text-green-500' : 'text-red-500'}>
                {statistics.totalDelta >= 0 ? '+' : ''}{statistics.totalDelta.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Delta%:</span>
              <span className={statistics.deltaPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                {statistics.deltaPercent >= 0 ? '+' : ''}{statistics.deltaPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur px-3 py-2 rounded-md text-xs z-20">
        <div className="flex flex-col gap-1">
          {config.displayMode === 'split' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500/30 border border-red-500" />
                <span>Ask Volume</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500/30 border border-green-500" />
                <span>Bid Volume</span>
              </div>
            </>
          )}
          {config.displayMode === 'delta' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 border border-green-500" />
                <span>Buy Delta</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 border border-red-500" />
                <span>Sell Delta</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}