'use client';

import React, { useState } from 'react';
import { Plus, X, Settings, Trash2 } from 'lucide-react';
import { Indicator } from '@/types';
import { INDICATORS, CHART_COLORS } from '@/lib/constants';
import { useChartStore } from '@/lib/stores/chart-store';

interface IndicatorsPanelProps {
  className?: string;
}

export function IndicatorsPanel({ className = '' }: IndicatorsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { indicators, addIndicator, removeIndicator, updateIndicator } = useChartStore();

  const handleAddIndicator = (indicatorType: typeof INDICATORS[0]) => {
    const newIndicator: Indicator = {
      id: `${indicatorType.id}_${Date.now()}`,
      name: indicatorType.name,
      type: indicatorType.type,
      inputs: getIndicatorInputs(indicatorType.id),
      outputs: getIndicatorOutputs(indicatorType.id),
      priceScaleId: indicatorType.type === 'oscillator' ? 'oscillator' : 'right',
    };

    addIndicator(newIndicator);
    setIsAddDialogOpen(false);
  };

  const getIndicatorInputs = (indicatorId: string): Record<string, any> => {
    switch (indicatorId) {
      case 'sma':
      case 'ema':
        return { period: 20 };
      case 'bb':
        return { period: 20, stdDev: 2 };
      case 'rsi':
        return { period: 14 };
      case 'macd':
        return { fast: 12, slow: 26, signal: 9 };
      case 'atr':
        return { period: 14 };
      case 'stoch':
        return { k: 14, d: 3, smooth: 3 };
      default:
        return {};
    }
  };

  const getIndicatorOutputs = (indicatorId: string): Indicator['outputs'] => {
    const colorIndex = Math.floor(Math.random() * CHART_COLORS.indicators.length);
    const color = CHART_COLORS.indicators[colorIndex];

    switch (indicatorId) {
      case 'sma':
      case 'ema':
        return [{ name: 'value', color, style: 'line' }];
      case 'bb':
        return [
          { name: 'upper', color, style: 'line' },
          { name: 'middle', color, style: 'line' },
          { name: 'lower', color, style: 'line' },
        ];
      case 'rsi':
        return [{ name: 'rsi', color, style: 'line' }];
      case 'macd':
        return [
          { name: 'macd', color, style: 'line' },
          { name: 'signal', color: CHART_COLORS.indicators[colorIndex + 1] || CHART_COLORS.indicators[0], style: 'line' },
          { name: 'histogram', color: CHART_COLORS.indicators[colorIndex + 2] || CHART_COLORS.indicators[0], style: 'histogram' },
        ];
      case 'volume':
        return [{ name: 'volume', color, style: 'histogram' }];
      case 'atr':
        return [{ name: 'atr', color, style: 'line' }];
      case 'stoch':
        return [
          { name: 'k', color, style: 'line' },
          { name: 'd', color: CHART_COLORS.indicators[colorIndex + 1] || CHART_COLORS.indicators[0], style: 'line' },
        ];
      default:
        return [{ name: 'value', color, style: 'line' }];
    }
  };

  const handleToggleVisibility = (indicatorId: string) => {
    updateIndicator(indicatorId, {
      visible: !indicators.find(ind => ind.id === indicatorId)?.visible,
    });
  };

  const handleUpdateSettings = (indicatorId: string, inputName: string, value: any) => {
    const indicator = indicators.find(ind => ind.id === indicatorId);
    if (indicator) {
      updateIndicator(indicatorId, {
        inputs: {
          ...indicator.inputs,
          [inputName]: value,
        },
      });
    }
  };

  return (
    <div className={`border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-sm">Indicators</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Add Indicator"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Toggle Expand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add Indicator Dialog */}
      {isAddDialogOpen && (
        <div className="p-4 border-b">
          <h3 className="font-medium text-sm mb-3">Add Indicator</h3>
          <div className="space-y-1">
            {INDICATORS.map((indicator) => (
              <div
                key={indicator.id}
                onClick={() => handleAddIndicator(indicator)}
                className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
              >
                <div>
                  <div className="font-medium text-sm">{indicator.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{indicator.type}</div>
                </div>
                <button className="text-primary hover:text-primary/80">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Indicators */}
      {isExpanded && (
        <div className="overflow-y-auto">
          {indicators.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <p>No indicators applied</p>
              <p className="mt-1">Click the + button to add indicators</p>
            </div>
          ) : (
            indicators.map((indicator) => (
              <div key={indicator.id} className="border-b">
                {/* Indicator Header */}
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {indicator.outputs.map((output, index) => (
                        <div
                          key={index}
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: output.color }}
                        />
                      ))}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{indicator.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{indicator.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Settings"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeIndicator(indicator.id)}
                      className="p-1 hover:bg-muted rounded transition-colors text-red-500"
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Indicator Settings (simplified) */}
                {Object.entries(indicator.inputs).length > 0 && (
                  <div className="px-3 pb-3">
                    <div className="space-y-2">
                      {Object.entries(indicator.inputs).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground capitalize min-w-16">
                            {key}:
                          </label>
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => handleUpdateSettings(indicator.id, key, Number(e.target.value))}
                            className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}