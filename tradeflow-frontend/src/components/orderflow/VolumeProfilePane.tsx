import React, { useMemo } from 'react';
import { VolumeProfileLevel, OrderFlowConfig } from '@/types';

interface VolumeProfilePaneProps {
  data: VolumeProfileLevel[];
  config: OrderFlowConfig['volumeProfileSettings'];
  width: number;
  height: number;
  theme: 'light' | 'dark';
  currentPrice?: number;
}

export function VolumeProfilePane({
  data,
  config,
  width,
  height,
  theme,
  currentPrice
}: VolumeProfilePaneProps) {
  // Calculate statistics and processed data
  const { processedLevels, poc, valueAreaHigh, valueAreaLow, totalVolume } = useMemo(() => {
    if (!data.length) {
      return {
        processedLevels: [],
        poc: null,
        valueAreaHigh: null,
        valueAreaLow: null,
        totalVolume: 0
      };
    }

    // Sort data by volume descending
    const sortedData = [...data].sort((a, b) => b.volume - a.volume);

    // Find Point of Control (POC) - price with highest volume
    const poc = sortedData[0];

    // Calculate Value Area (default 70% of total volume)
    const valueAreaPercent = config.valueAreaPercent / 100;
    const targetVolume = data.reduce((sum, level) => sum + level.volume, 0) * valueAreaPercent;

    let accumulatedVolume = 0;
    let valueAreaHigh = poc.price;
    let valueAreaLow = poc.price;

    // Expand around POC to reach target volume
    const pocIndex = data.findIndex(level => level.price === poc.price);
    let highIndex = pocIndex;
    let lowIndex = pocIndex;

    while (accumulatedVolume < targetVolume && (highIndex > 0 || lowIndex < data.length - 1)) {
      if (highIndex > 0 && (lowIndex >= data.length - 1 || data[highIndex - 1].volume >= data[lowIndex + 1].volume)) {
        highIndex--;
        accumulatedVolume += data[highIndex].volume;
        valueAreaHigh = data[highIndex].price;
      } else if (lowIndex < data.length - 1) {
        lowIndex++;
        accumulatedVolume += data[lowIndex].volume;
        valueAreaLow = data[lowIndex].price;
      }
    }

    // Process levels for rendering
    const processedLevels = data.map(level => {
      const maxVolume = Math.max(...data.map(d => d.volume));
      const width = (level.volume / maxVolume) * 100;

      let backgroundColor, borderColor;

      if (config.colorScheme === 'bidask') {
        const buyRatio = level.bidVolume / level.volume;
        const sellRatio = level.askVolume / level.volume;

        if (buyRatio > 0.6) {
          backgroundColor = `rgba(34, 197, 94, ${0.3 + buyRatio * 0.4})`; // Green
          borderColor = '#22c55e';
        } else if (sellRatio > 0.6) {
          backgroundColor = `rgba(239, 68, 68, ${0.3 + sellRatio * 0.4})`; // Red
          borderColor = '#ef4444';
        } else {
          backgroundColor = 'rgba(156, 163, 175, 0.3)'; // Gray
          borderColor = '#9ca3af';
        }
      } else if (config.colorScheme === 'delta') {
        const delta = level.bidVolume - level.askVolume;
        const deltaRatio = Math.abs(delta) / level.volume;

        if (delta > 0) {
          backgroundColor = `rgba(34, 197, 94, ${0.3 + deltaRatio * 0.4})`;
          borderColor = '#22c55e';
        } else {
          backgroundColor = `rgba(239, 68, 68, ${0.3 + deltaRatio * 0.4})`;
          borderColor = '#ef4444';
        }
      } else { // volume
        const intensity = level.volume / maxVolume;
        backgroundColor = `rgba(59, 130, 246, ${0.2 + intensity * 0.6})`;
        borderColor = '#3b82f6';
      }

      return {
        ...level,
        width,
        backgroundColor,
        borderColor,
        isPOC: level.price === poc.price,
        isValueArea: level.price >= valueAreaLow && level.price <= valueAreaHigh,
      };
    });

    return {
      processedLevels,
      poc,
      valueAreaHigh,
      valueAreaLow,
      totalVolume: data.reduce((sum, level) => sum + level.volume, 0)
    };
  }, [data, config.valueAreaPercent, config.colorScheme]);

  const barHeight = Math.max(20, Math.min(40, height / processedLevels.length));

  return (
    <div className="relative w-full h-full p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold">Volume Profile</h3>
        {totalVolume > 0 && (
          <div className="text-xs text-muted-foreground">
            Total Vol: {totalVolume.toFixed(0)}
          </div>
        )}
      </div>

      {/* Volume Profile Display */}
      <div className="relative h-full overflow-y-auto">
        {processedLevels.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No volume profile data available</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {processedLevels.map((level) => (
              <div
                key={level.price}
                className="relative flex items-center"
                style={{ height: `${barHeight}px` }}
              >
                {/* Price label */}
                <div className="absolute left-0 text-xs font-mono w-16 text-right pr-2">
                  {level.price.toFixed(2)}
                </div>

                {/* Volume bar */}
                <div
                  className="relative ml-20 h-full flex items-center"
                  style={{ width: `${width - 120}px` }}
                >
                  <div
                    className={`h-full rounded-sm border-l-2 ${
                      config.areaStyle === 'gradient' ? 'opacity-80' : ''
                    }`}
                    style={{
                      width: `${level.width}%`,
                      backgroundColor: level.backgroundColor,
                      borderColor: level.borderColor,
                      ...(config.areaStyle === 'gradient' && {
                        background: `linear-gradient(90deg, ${level.backgroundColor} 0%, transparent 100%)`
                      })
                    }}
                  >
                    {/* POC indicator */}
                    {config.showPOC && level.isPOC && (
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-2 h-2 bg-orange-500 rounded-full ml-1" />
                        <span className="ml-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
                          POC
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Volume info */}
                  <div className="absolute right-0 flex items-center gap-2 text-xs font-mono">
                    {config.colorScheme === 'bidask' && (
                      <>
                        <span className="text-green-500">
                          {Math.round(level.bidVolume)}
                        </span>
                        <span className="text-red-500">
                          {Math.round(level.askVolume)}
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">
                      {Math.round(level.volume)}
                    </span>
                    <span className="text-muted-foreground">
                      ({level.percent.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Current price indicator */}
                {currentPrice && Math.abs(currentPrice - level.price) < 0.01 && (
                  <div className="absolute left-0 right-0 h-0.5 bg-blue-500 z-10" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Value Area Indicator */}
      {config.showVA && poc && valueAreaHigh && valueAreaLow && (
        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur px-3 py-2 rounded-md text-xs z-20">
          <div className="space-y-1 font-mono">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">VA High:</span>
              <span>{valueAreaHigh.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">VA Low:</span>
              <span>{valueAreaLow.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">POC:</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {poc.price.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">VA Range:</span>
              <span>{(valueAreaHigh - valueAreaLow).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur px-3 py-2 rounded-md text-xs z-20">
        <div className="flex flex-col gap-1">
          {config.colorScheme === 'bidask' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-sm" />
                <span>Bid Volume</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-sm" />
                <span>Ask Volume</span>
              </div>
            </>
          )}
          {config.colorScheme === 'delta' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-sm" />
                <span>Buy Delta</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-sm" />
                <span>Sell Delta</span>
              </div>
            </>
          )}
          {config.colorScheme === 'volume' && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span>Volume</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}