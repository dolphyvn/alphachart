import React from 'react';
import { Settings, BarChart3, Volume, TrendingUp, Activity } from 'lucide-react';
import { OrderFlowConfig } from '@/types';

interface OrderFlowControlsProps {
  config: OrderFlowConfig;
  onConfigChange: (config: OrderFlowConfig) => void;
  symbol: string;
  timeframe: string;
}

export function OrderFlowControls({
  config,
  onConfigChange,
  symbol,
  timeframe
}: OrderFlowControlsProps) {
  const handleTypeChange = (type: OrderFlowConfig['type']) => {
    onConfigChange({
      ...config,
      enabled: type !== 'none',
      type
    });
  };

  const handleCVDSettingChange = (key: keyof OrderFlowConfig['cvdSettings'], value: any) => {
    onConfigChange({
      ...config,
      cvdSettings: {
        ...config.cvdSettings,
        [key]: value
      }
    });
  };

  const handleVolumeProfileSettingChange = (key: keyof OrderFlowConfig['volumeProfileSettings'], value: any) => {
    onConfigChange({
      ...config,
      volumeProfileSettings: {
        ...config.volumeProfileSettings,
        [key]: value
      }
    });
  };

  const handleFootprintSettingChange = (key: keyof OrderFlowConfig['footprintSettings'], value: any) => {
    onConfigChange({
      ...config,
      footprintSettings: {
        ...config.footprintSettings,
        [key]: value
      }
    });
  };

  const flowTypes = [
    { value: 'none', label: 'None', icon: Settings, description: 'Disable order flow' },
    { value: 'cvd', label: 'CVD', icon: TrendingUp, description: 'Cumulative Volume Delta' },
    { value: 'volume-profile', label: 'Volume Profile', icon: Volume, description: 'Volume by price levels' },
    { value: 'footprint', label: 'Footprint', icon: BarChart3, description: 'Bid/Ask volume at each price' },
  ] as const;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Order Flow Settings</h3>
        <div className="text-xs text-muted-foreground">
          {symbol} • {timeframe}
        </div>
      </div>

      {/* Order Flow Type Selection */}
      <div>
        <label className="block text-sm font-medium mb-3">Order Flow Type</label>
        <div className="grid grid-cols-2 gap-2">
          {flowTypes.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              onClick={() => handleTypeChange(value)}
              className={`
                flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                ${config.type === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted'
                }
              `}
              title={description}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CVD Settings */}
      {config.type === 'cvd' && (
        <div className="space-y-4 p-3 border rounded-lg">
          <h4 className="text-sm font-medium">CVD Settings</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Positive Color</label>
              <input
                type="color"
                value={config.cvdSettings.colorPositive}
                onChange={(e) => handleCVDSettingChange('colorPositive', e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Negative Color</label>
              <input
                type="color"
                value={config.cvdSettings.colorNegative}
                onChange={(e) => handleCVDSettingChange('colorNegative', e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Line Width</label>
            <input
              type="range"
              min="1"
              max="5"
              value={config.cvdSettings.lineWidth}
              onChange={(e) => handleCVDSettingChange('lineWidth', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-center">{config.cvdSettings.lineWidth}px</div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.cvdSettings.showCumulative}
                onChange={(e) => handleCVDSettingChange('showCumulative', e.target.checked)}
                className="rounded"
              />
              Show Cumulative
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.cvdSettings.showDelta}
                onChange={(e) => handleCVDSettingChange('showDelta', e.target.checked)}
                className="rounded"
              />
              Show Delta
            </label>
          </div>
        </div>
      )}

      {/* Volume Profile Settings */}
      {config.type === 'volume-profile' && (
        <div className="space-y-4 p-3 border rounded-lg">
          <h4 className="text-sm font-medium">Volume Profile Settings</h4>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Color Scheme</label>
            <select
              value={config.volumeProfileSettings.colorScheme}
              onChange={(e) => handleVolumeProfileSettingChange('colorScheme', e.target.value as any)}
              className="w-full px-2 py-1 text-xs border rounded"
            >
              <option value="bidask">Bid/Ask</option>
              <option value="delta">Delta</option>
              <option value="volume">Volume</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Area Style</label>
            <select
              value={config.volumeProfileSettings.areaStyle}
              onChange={(e) => handleVolumeProfileSettingChange('areaStyle', e.target.value as any)}
              className="w-full px-2 py-1 text-xs border rounded"
            >
              <option value="solid">Solid</option>
              <option value="gradient">Gradient</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Value Area ({config.volumeProfileSettings.valueAreaPercent}%)
            </label>
            <input
              type="range"
              min="60"
              max="90"
              step="5"
              value={config.volumeProfileSettings.valueAreaPercent}
              onChange={(e) => handleVolumeProfileSettingChange('valueAreaPercent', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.volumeProfileSettings.showPOC}
                onChange={(e) => handleVolumeProfileSettingChange('showPOC', e.target.checked)}
                className="rounded"
              />
              Show POC
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.volumeProfileSettings.showVA}
                onChange={(e) => handleVolumeProfileSettingChange('showVA', e.target.checked)}
                className="rounded"
              />
              Show Value Area
            </label>
          </div>
        </div>
      )}

      {/* Footprint Settings */}
      {config.type === 'footprint' && (
        <div className="space-y-4 p-3 border rounded-lg">
          <h4 className="text-sm font-medium">Footprint Settings</h4>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Display Mode</label>
            <select
              value={config.footprintSettings.displayMode}
              onChange={(e) => handleFootprintSettingChange('displayMode', e.target.value as any)}
              className="w-full px-2 py-1 text-xs border rounded"
            >
              <option value="split">Split</option>
              <option value="stacked">Stacked</option>
              <option value="delta">Delta</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Color Scheme</label>
            <select
              value={config.footprintSettings.colorScheme}
              onChange={(e) => handleFootprintSettingChange('colorScheme', e.target.value as any)}
              className="w-full px-2 py-1 text-xs border rounded"
            >
              <option value="bidask">Bid/Ask</option>
              <option value="delta">Delta</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.footprintSettings.showNumbers}
                onChange={(e) => handleFootprintSettingChange('showNumbers', e.target.checked)}
                className="rounded"
              />
              Show Numbers
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.footprintSettings.showTotal}
                onChange={(e) => handleFootprintSettingChange('showTotal', e.target.checked)}
                className="rounded"
              />
              Show Total
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.footprintSettings.aggregateTrades}
                onChange={(e) => handleFootprintSettingChange('aggregateTrades', e.target.checked)}
                className="rounded"
              />
              Aggregate Trades
            </label>
          </div>
        </div>
      )}

      {/* Information */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Information</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>CVD:</strong> Shows cumulative delta between buying and selling pressure.
          </p>
          <p>
            <strong>Volume Profile:</strong> Displays volume distribution across price levels.
          </p>
          <p>
            <strong>Footprint:</strong> Shows bid/ask volume at each price level.
          </p>
        </div>
      </div>
    </div>
  );
}