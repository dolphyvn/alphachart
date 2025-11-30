# **Implementation Prompt: Order Flow Visualizations for TradeFlow Pro**

## **Project Context**
You are working on TradeFlow Pro, a Next.js 16 + React 19 trading platform using:
- **Chart Library:** `lightweight-charts` v5.0.9
- **Backend:** FastAPI with TimescaleDB (order flow APIs already implemented)
- **State:** Zustand + TanStack Query
- **Styling:** Tailwind CSS + Radix UI

**Backend APIs Available:**
- `POST /api/v1/orderflow/cvd` - Returns CVD data
- `POST /api/v1/volume-profile/session` - Returns volume profile with POC/VAH/VAL
- `POST /api/v1/orderflow/footprint` - Returns footprint data
- `POST /api/v1/orderflow/imbalances` - Returns imbalance detection

---

## **TASK 1: Implement CVD (Cumulative Volume Delta) Indicator**
**Priority: HIGH** | **Complexity: Medium**

### Requirements:
1. **Create a separate chart pane BELOW the main candlestick chart** (like RSI/MACD in TradingView)
2. CVD should be a line chart showing cumulative delta over time
3. Include a zero line for reference
4. Color the line: green when CVD is positive, red when negative
5. Auto-scale the Y-axis for CVD values
6. Share the same time axis with the main chart (synchronized scrolling/zooming)

### Implementation Steps:

#### **Step 1: Create CVD Hook**
**File:** `src/hooks/useCVD.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useCVD(symbol: string, timeframe: string, limit = 500) {
  return useQuery({
    queryKey: ['cvd', symbol, timeframe, limit],
    queryFn: async () => {
      const response = await apiClient.calculateIndicator(
        symbol,
        timeframe,
        'cvd',
        { limit }
      );
      return response.data;
    },
    enabled: !!symbol && !!timeframe,
    staleTime: 5000,
    refetchInterval: 5000, // Update every 5 seconds
  });
}
```

#### **Step 2: Modify Chart Engine to Support Multiple Panes**
**File:** `src/lib/chart-engine/chart.ts`

Add methods to the `TradingChart` class:

```typescript
// Add to TradingChart class
private cvdChart: IChartApi | null = null;
private cvdSeries: ISeriesApi<'Line'> | null = null;

initCVDPane(container: HTMLDivElement) {
  // Create second chart instance for CVD
  this.cvdChart = createChart(container, {
    width: this.width,
    height: 150, // Fixed height for CVD pane
    layout: {
      background: { color: this.theme === 'dark' ? '#1a1a1a' : '#ffffff' },
      textColor: this.theme === 'dark' ? '#d1d4dc' : '#191919',
    },
    grid: {
      vertLines: { color: this.theme === 'dark' ? '#2a2e39' : '#e1e3eb' },
      horzLines: { color: this.theme === 'dark' ? '#2a2e39' : '#e1e3eb' },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: true,
      borderColor: this.theme === 'dark' ? '#2a2e39' : '#e1e3eb',
    },
    rightPriceScale: {
      borderColor: this.theme === 'dark' ? '#2a2e39' : '#e1e3eb',
    },
  });

  // Create line series for CVD
  this.cvdSeries = this.cvdChart.addLineSeries({
    color: '#2196F3',
    lineWidth: 2,
    priceLineVisible: false,
  });

  // Synchronize time scales
  if (this.chart) {
    this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const timeRange = this.chart!.timeScale().getVisibleRange();
      if (timeRange && this.cvdChart) {
        this.cvdChart.timeScale().setVisibleRange(timeRange);
      }
    });
  }

  return this.cvdChart;
}

updateCVDData(data: Array<{ timestamp: string; cumulative_delta: number }>) {
  if (!this.cvdSeries) return;

  const cvdData = data.map(d => ({
    time: new Date(d.timestamp).getTime() / 1000,
    value: d.cumulative_delta,
  }));

  this.cvdSeries.setData(cvdData);

  // Add zero line
  if (this.cvdChart) {
    this.cvdChart.addLineSeries({
      color: '#888888',
      lineWidth: 1,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
    }).setData(cvdData.map(d => ({ time: d.time, value: 0 })));
  }
}

destroyCVD() {
  if (this.cvdChart) {
    this.cvdChart.remove();
    this.cvdChart = null;
    this.cvdSeries = null;
  }
}
```

#### **Step 3: Create CVD Component**
**File:** `src/components/chart/CVDPane.tsx`

```typescript
'use client';

import React, { useRef, useEffect } from 'react';
import { TradingChart } from '@/lib/chart-engine/chart';
import { useCVD } from '@/hooks/useCVD';

interface CVDPaneProps {
  symbol: string;
  timeframe: string;
  theme: 'light' | 'dark';
  chartEngine: TradingChart | null;
}

export function CVDPane({ symbol, timeframe, theme, chartEngine }: CVDPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: cvdData, isLoading, error } = useCVD(symbol, timeframe);

  useEffect(() => {
    if (!containerRef.current || !chartEngine) return;

    chartEngine.initCVDPane(containerRef.current);

    return () => {
      chartEngine.destroyCVD();
    };
  }, [chartEngine]);

  useEffect(() => {
    if (cvdData && chartEngine) {
      chartEngine.updateCVDData(cvdData);
    }
  }, [cvdData, chartEngine]);

  return (
    <div className="relative w-full h-[150px] border-t border-border">
      <div ref={containerRef} className="w-full h-full" />

      {/* Label */}
      <div className="absolute top-2 left-2 text-xs font-medium text-muted-foreground bg-background/80 px-2 py-1 rounded">
        CVD (Cumulative Volume Delta)
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <div className="text-xs text-muted-foreground">Loading CVD...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <div className="text-xs text-destructive">CVD Error</div>
        </div>
      )}
    </div>
  );
}
```

#### **Step 4: Integrate CVD Pane into Main Layout**
**File:** `src/components/chart/TradingChart.tsx`

Modify to include CVD pane:

```typescript
// Add state for chart engine instance
const [chartEngineInstance, setChartEngineInstance] = useState<TradingChart | null>(null);

// In useChart hook, expose the engine instance
// Then in TradingChart component:

return (
  <div className="flex flex-col w-full h-full">
    {/* Main Chart */}
    <div className="flex-1 relative">
      {/* ...existing chart code... */}
    </div>

    {/* CVD Pane */}
    <CVDPane
      symbol={symbol}
      timeframe={timeframe}
      theme={theme}
      chartEngine={chartEngineInstance}
    />
  </div>
);
```

---

## **TASK 2: Implement Volume Profile with POC/VAH/VAL Lines**
**Priority: HIGH** | **Complexity: Medium**

### Requirements:
1. **Horizontal histogram** on the RIGHT side of the chart showing volume distribution
2. **POC line** (Point of Control) - horizontal line at highest volume price
3. **VAH/VAL lines** (Value Area High/Low) - 70% volume zone boundaries
4. Color-code volume bars: green for buying pressure, red for selling
5. Make the histogram semi-transparent overlay or fixed-width panel

### Implementation Steps:

#### **Step 1: Create Volume Profile Hook**
**File:** `src/hooks/useVolumeProfile.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useVolumeProfile(
  symbol: string,
  timeframe: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['volumeProfile', symbol, timeframe],
    queryFn: async () => {
      // Get last 24 hours by default
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

      return await apiClient.getVolumeProfile(
        symbol,
        startTime.toISOString(),
        endTime.toISOString()
      );
    },
    enabled: enabled && !!symbol,
    staleTime: 10000,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
```

#### **Step 2: Add Volume Profile Methods to Chart Engine**
**File:** `src/lib/chart-engine/chart.ts`

```typescript
// Add to TradingChart class
private pocLine: IPriceLine | null = null;
private vahLine: IPriceLine | null = null;
private valLine: IPriceLine | null = null;

addVolumeProfileLines(poc: number, vah: number, val: number) {
  if (!this.candlestickSeries) return;

  // Remove existing lines
  this.removeVolumeProfileLines();

  // POC line (yellow/gold)
  this.pocLine = this.candlestickSeries.createPriceLine({
    price: poc,
    color: '#FFA726',
    lineWidth: 2,
    lineStyle: 0, // Solid
    axisLabelVisible: true,
    title: 'POC',
  });

  // VAH line (blue)
  this.vahLine = this.candlestickSeries.createPriceLine({
    price: vah,
    color: '#42A5F5',
    lineWidth: 1,
    lineStyle: 2, // Dashed
    axisLabelVisible: true,
    title: 'VAH',
  });

  // VAL line (blue)
  this.valLine = this.candlestickSeries.createPriceLine({
    price: val,
    color: '#42A5F5',
    lineWidth: 1,
    lineStyle: 2, // Dashed
    axisLabelVisible: true,
    title: 'VAL',
  });
}

removeVolumeProfileLines() {
  if (this.candlestickSeries) {
    if (this.pocLine) this.candlestickSeries.removePriceLine(this.pocLine);
    if (this.vahLine) this.candlestickSeries.removePriceLine(this.vahLine);
    if (this.valLine) this.candlestickSeries.removePriceLine(this.valLine);
  }
  this.pocLine = null;
  this.vahLine = null;
  this.valLine = null;
}
```

#### **Step 3: Create Volume Profile Histogram Component**
**File:** `src/components/chart/VolumeProfileHistogram.tsx`

```typescript
'use client';

import React from 'react';

interface VolumeProfileData {
  price: number;
  volume: number;
  bid: number;
  ask: number;
  delta: number;
}

interface VolumeProfileHistogramProps {
  data: VolumeProfileData[];
  poc: number;
  vah: number;
  val: number;
  priceRange: { min: number; max: number };
  height: number;
}

export function VolumeProfileHistogram({
  data,
  poc,
  vah,
  val,
  priceRange,
  height,
}: VolumeProfileHistogramProps) {
  if (!data.length) return null;

  const maxVolume = Math.max(...data.map(d => d.volume));
  const priceToY = (price: number) => {
    const range = priceRange.max - priceRange.min;
    return ((priceRange.max - price) / range) * height;
  };

  return (
    <div className="absolute right-0 top-0 w-32 h-full pointer-events-none">
      <svg width="100%" height="100%" className="opacity-70">
        {data.map((level, idx) => {
          const y = priceToY(level.price);
          const barWidth = (level.volume / maxVolume) * 120; // Max 120px wide
          const isValueArea = level.price >= val && level.price <= vah;
          const isPOC = Math.abs(level.price - poc) < 0.01;

          // Color: green if more ask, red if more bid
          const color = level.ask > level.bid ? '#22c55e' : '#ef4444';

          return (
            <rect
              key={idx}
              x={128 - barWidth}
              y={y - 1}
              width={barWidth}
              height={2}
              fill={isPOC ? '#FFA726' : isValueArea ? color : '#666'}
              opacity={isPOC ? 1 : isValueArea ? 0.6 : 0.3}
            />
          );
        })}
      </svg>
    </div>
  );
}
```

#### **Step 4: Integrate Volume Profile into TradingChart**
**File:** `src/components/chart/TradingChart.tsx`

```typescript
import { useVolumeProfile } from '@/hooks/useVolumeProfile';
import { VolumeProfileHistogram } from './VolumeProfileHistogram';

// Inside TradingChart component:
const { data: volumeProfile } = useVolumeProfile(symbol, timeframe);
const [visiblePriceRange, setVisiblePriceRange] = useState({ min: 0, max: 0 });

// Update volume profile lines when data changes
useEffect(() => {
  if (volumeProfile && isReady && updateChartType) {
    const { poc, vah, val } = volumeProfile;
    // Call chart engine method to add lines
    chartEngine.addVolumeProfileLines(poc, vah, val);
  }
}, [volumeProfile, isReady]);

// Add to return JSX:
{volumeProfile && (
  <VolumeProfileHistogram
    data={volumeProfile.profile}
    poc={volumeProfile.poc}
    vah={volumeProfile.vah}
    val={volumeProfile.val}
    priceRange={visiblePriceRange}
    height={height || 600}
  />
)}
```

---

## **TASK 3: Implement Footprint Chart**
**Priority: MEDIUM** | **Complexity: HIGH**

### Requirements:
1. **Heatmap/matrix view** showing bid/ask volume at each price level per bar
2. Each cell shows bid volume (left) and ask volume (right)
3. Color cells based on imbalance ratio (green = buying, red = selling)
4. Click on a candle to show its footprint
5. Can be a modal/dialog or side panel

### Implementation Steps:

#### **Step 1: Create Footprint Hook**
**File:** `src/hooks/useFootprint.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useFootprint(
  symbol: string,
  timeframe: string,
  limit = 100,
  enabled = true
) {
  return useQuery({
    queryKey: ['footprint', symbol, timeframe, limit],
    queryFn: async () => {
      return await apiClient.getFootprintData(symbol, timeframe, limit);
    },
    enabled: enabled && !!symbol,
    staleTime: 5000,
  });
}
```

#### **Step 2: Create Footprint Dialog Component**
**File:** `src/components/chart/FootprintDialog.tsx`

```typescript
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FootprintLevel {
  price: number;
  volume: number;
  bid: number;
  ask: number;
  delta: number;
}

interface FootprintDialogProps {
  open: boolean;
  onClose: () => void;
  timestamp: string;
  levels: FootprintLevel[];
}

export function FootprintDialog({
  open,
  onClose,
  timestamp,
  levels,
}: FootprintDialogProps) {
  const maxVolume = Math.max(...levels.map(l => l.volume));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Footprint Chart - {new Date(timestamp).toLocaleString()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 font-mono text-xs">
          {levels.map((level, idx) => {
            const imbalance = level.ask / Math.max(level.bid, 1);
            const isImbalanced = imbalance > 2 || imbalance < 0.5;
            const color = imbalance > 1 ? 'bg-green-500/20' : 'bg-red-500/20';

            return (
              <div
                key={idx}
                className={`flex items-center gap-2 p-1 rounded ${isImbalanced ? color : ''}`}
              >
                <div className="w-16 text-right text-muted-foreground">
                  {level.price.toFixed(2)}
                </div>

                {/* Bid Volume (Left) */}
                <div className="w-20 text-right text-red-500 font-medium">
                  {Math.round(level.bid)}
                </div>

                {/* Volume Bar */}
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-green-500"
                    style={{
                      width: `${(level.volume / maxVolume) * 100}%`,
                    }}
                  />
                </div>

                {/* Ask Volume (Right) */}
                <div className="w-20 text-left text-green-500 font-medium">
                  {Math.round(level.ask)}
                </div>

                {/* Delta */}
                <div className={`w-16 text-right ${level.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {level.delta >= 0 ? '+' : ''}{Math.round(level.delta)}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### **Step 3: Add Footprint Click Handler to Chart**
**File:** `src/components/chart/TradingChart.tsx`

```typescript
const [footprintOpen, setFootprintOpen] = useState(false);
const [selectedBarTimestamp, setSelectedBarTimestamp] = useState<string | null>(null);
const { data: footprintData } = useFootprint(symbol, timeframe, 100, footprintOpen);

// Add click handler to chart (modify chart engine)
useEffect(() => {
  if (!isReady) return;

  const handleChartClick = (param: any) => {
    if (param.time) {
      const timestamp = new Date(param.time * 1000).toISOString();
      setSelectedBarTimestamp(timestamp);
      setFootprintOpen(true);
    }
  };

  chartEngine?.subscribeClick(handleChartClick);
}, [isReady, chartEngine]);

// Add to JSX:
{footprintOpen && footprintData && selectedBarTimestamp && (
  <FootprintDialog
    open={footprintOpen}
    onClose={() => setFootprintOpen(false)}
    timestamp={selectedBarTimestamp}
    levels={footprintData.find(d => d.timestamp === selectedBarTimestamp)?.levels || []}
  />
)}
```

---

## **TASK 4: Add Imbalance Markers**
**Priority: LOW** | **Complexity: Medium**

Create visual markers (triangles/arrows) on the chart at detected imbalance levels.

**File:** `src/components/chart/ImbalanceMarkers.tsx`

```typescript
// Render SVG markers on top of chart at specific price/time coordinates
// Use lightweight-charts markers API or custom overlay
```

---

## **TASK 5: Toggle Controls in IndicatorsPanel**
**Priority: MEDIUM** | **Complexity: Low**

Add checkboxes to enable/disable order flow features:

**File:** `src/components/indicators/IndicatorsPanel.tsx`

```typescript
// Add section:
<div className="space-y-2 p-4 border-t">
  <h3 className="font-semibold text-sm">Order Flow</h3>
  <label className="flex items-center gap-2">
    <input type="checkbox" onChange={(e) => setCVDEnabled(e.target.checked)} />
    <span className="text-sm">Show CVD</span>
  </label>
  <label className="flex items-center gap-2">
    <input type="checkbox" onChange={(e) => setVolumeProfileEnabled(e.target.checked)} />
    <span className="text-sm">Volume Profile (POC/VAH/VAL)</span>
  </label>
  <label className="flex items-center gap-2">
    <input type="checkbox" onChange={(e) => setImbalancesEnabled(e.target.checked)} />
    <span className="text-sm">Imbalance Detection</span>
  </label>
</div>
```

---

## **PRIORITY ORDER:**

1. **CVD Pane** (highest value, moderate effort)
2. **Volume Profile Lines** (high value, moderate effort)
3. **Volume Profile Histogram** (visual enhancement)
4. **Footprint Dialog** (advanced feature)
5. **Imbalance Markers** (nice-to-have)

---

## **TESTING CHECKLIST:**

- [ ] CVD pane appears below main chart
- [ ] CVD line updates in real-time
- [ ] Time axis is synchronized between main chart and CVD
- [ ] POC/VAH/VAL lines appear on main chart
- [ ] Volume profile histogram shows on right side
- [ ] Histogram colors reflect bid/ask imbalance
- [ ] Footprint dialog opens on candle click
- [ ] Footprint shows bid/ask at each price level
- [ ] All features work with different symbols/timeframes
- [ ] Toggle controls enable/disable features

---

## **ADDITIONAL NOTES:**

### **API Client Updates Required**

Ensure your API client has the correct method for fetching CVD data:

**File:** `src/lib/api/client.ts`

```typescript
async getCVD(symbol: string, timeframe: string, limit = 500) {
  const response = await fetch(`${this.baseURL}/api/v1/orderflow/cvd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, timeframe, limit }),
  });
  return await response.json();
}
```

### **UI Dialog Component**

If you don't have a Dialog component from Radix UI yet, install it:

```bash
npm install @radix-ui/react-dialog
```

Or create the component using the shadcn/ui pattern.

---

This implementation will give you professional-grade order flow analysis matching TradingView's capabilities!
