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

---
---

# **PART 2: ADVANCED ORDER FLOW FEATURES**
## **Professional Scalping & Micro-Structure Analysis**

**Data Available:**
- ✅ 1-second OHLCV bars
- ✅ Bid/Ask volume per second
- ✅ Number of trades per second
- ✅ Open interest (optional)

These features will make TradeFlow Pro competitive with **Bookmap** and **Exocharts** for professional scalpers.

---

## **TASK 6: Micro-Footprint Panels (Per-Second Resolution)**
**Priority: VERY HIGH** | **Complexity: Medium** | **Value: ⭐⭐⭐⭐⭐**

### What It Is:
Display bid/ask volume at each price level **per 1-second bar**, not just aggregated. This shows the true order flow microstructure.

### Example Display:
```
Time: 14:32:45
4064.75   Ask: 11 | Bid:  5   [🟢 Buying]
4064.65   Ask:  2 | Bid: 10   [🔴 Selling]
4064.60   Ask:  1 | Bid:  4   [🔴 Selling]
```

### Backend Implementation:

#### **Step 1: Create Micro-Footprint API Endpoint**
**File:** `tradeflow-backend/app/api/v1/orderflow.py`

Add new endpoint:

```python
class MicroFootprintRequest(BaseModel):
    symbol: str
    start_time: str  # ISO timestamp
    end_time: str
    price_tick: float = 0.01  # Price granularity

@router.post("/micro-footprint")
async def get_micro_footprint(
    request: MicroFootprintRequest,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    """
    Get per-second footprint showing bid/ask at each price level
    Uses 1s bars to reconstruct price action
    """
    return await service.get_micro_footprint(
        request.symbol,
        request.start_time,
        request.end_time,
        request.price_tick
    )
```

#### **Step 2: Implement Service Method**
**File:** `tradeflow-backend/app/services/orderflow_service.py`

Add to OrderFlowService:

```python
async def get_micro_footprint(
    self,
    symbol: str,
    start_time: str,
    end_time: str,
    price_tick: float = 0.01
) -> List[Dict[str, Any]]:
    """
    Get micro-footprint: bid/ask volume at each price level per second

    Returns:
    [
        {
            "timestamp": "2025-11-30T14:32:45Z",
            "levels": [
                {"price": 4064.75, "bid": 5, "ask": 11, "delta": 6},
                {"price": 4064.65, "bid": 10, "ask": 2, "delta": -8},
                ...
            ]
        },
        ...
    ]
    """
    from datetime import datetime

    start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))

    # Query 1-second bars
    query = """
        SELECT
            time,
            close,
            volume,
            bid_volume,
            ask_volume,
            number_of_trades
        FROM market_data
        WHERE symbol = $1
          AND timeframe = '1s'
          AND time >= $2
          AND time <= $3
        ORDER BY time ASC
    """

    rows = await timescale_manager.fetch(query, symbol, start, end)

    result = []
    for row in rows:
        # Round price to tick size
        price_level = round(row['close'] / price_tick) * price_tick

        bid_vol = float(row['bid_volume'] or 0)
        ask_vol = float(row['ask_volume'] or 0)

        result.append({
            "timestamp": row['time'].isoformat(),
            "levels": [
                {
                    "price": price_level,
                    "bid": bid_vol,
                    "ask": ask_vol,
                    "delta": ask_vol - bid_vol,
                    "trades": row['number_of_trades'],
                    "imbalance_ratio": ask_vol / max(bid_vol, 1)
                }
            ]
        })

    return result
```

### Frontend Implementation:

#### **Step 3: Create Hook**
**File:** `src/hooks/useMicroFootprint.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useMicroFootprint(
  symbol: string,
  startTime: Date,
  endTime: Date,
  enabled = true
) {
  return useQuery({
    queryKey: ['microFootprint', symbol, startTime, endTime],
    queryFn: async () => {
      const response = await fetch(`${apiClient.baseURL}/api/v1/orderflow/micro-footprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          price_tick: 0.01,
        }),
      });
      return await response.json();
    },
    enabled: enabled && !!symbol,
    staleTime: 2000,
  });
}
```

#### **Step 4: Create Micro-Footprint Panel Component**
**File:** `src/components/chart/MicroFootprintPanel.tsx`

```typescript
'use client';

import React from 'react';
import { useMicroFootprint } from '@/hooks/useMicroFootprint';

interface MicroFootprintPanelProps {
  symbol: string;
  selectedTime: Date;
  visible: boolean;
}

export function MicroFootprintPanel({
  symbol,
  selectedTime,
  visible,
}: MicroFootprintPanelProps) {
  const startTime = new Date(selectedTime.getTime() - 30 * 1000); // 30 seconds before
  const endTime = new Date(selectedTime.getTime() + 30 * 1000); // 30 seconds after

  const { data, isLoading } = useMicroFootprint(symbol, startTime, endTime, visible);

  if (!visible || !data) return null;

  return (
    <div className="absolute right-36 top-4 w-72 max-h-[600px] overflow-auto bg-background border border-border rounded-lg shadow-xl p-4 z-50">
      <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
        <span>Micro-Footprint (1s)</span>
        <span className="text-xs text-muted-foreground">{symbol}</span>
      </h3>

      {isLoading ? (
        <div className="text-center text-xs text-muted-foreground py-4">Loading...</div>
      ) : (
        <div className="space-y-2 font-mono text-xs">
          {data.map((bar: any, idx: number) => (
            <div key={idx} className="border-b border-border pb-2">
              <div className="text-muted-foreground mb-1">
                {new Date(bar.timestamp).toLocaleTimeString()}
              </div>
              {bar.levels.map((level: any, lidx: number) => {
                const isBuying = level.ask > level.bid;
                const strongImbalance = level.imbalance_ratio > 2 || level.imbalance_ratio < 0.5;

                return (
                  <div
                    key={lidx}
                    className={`flex items-center justify-between p-1 rounded ${
                      strongImbalance ? (isBuying ? 'bg-green-500/10' : 'bg-red-500/10') : ''
                    }`}
                  >
                    <span className="w-20 text-right">{level.price.toFixed(2)}</span>
                    <span className="text-red-500 w-16 text-right">
                      B: {Math.round(level.bid)}
                    </span>
                    <span className="text-green-500 w-16 text-left">
                      A: {Math.round(level.ask)}
                    </span>
                    <span className={level.delta >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {level.delta >= 0 ? '🟢' : '🔴'}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## **TASK 7: Absorption Detection**
**Priority: HIGH** | **Complexity: Medium** | **Value: ⭐⭐⭐⭐**

### What It Is:
Detect when **price stalls** despite aggressive buying/selling. This indicates a passive wall absorbing orders.

### Detection Logic:
- Price range < 0.05% for 3-5 seconds
- High volume on one side (bid or ask)
- Delta strongly favors one side but price doesn't move

### Backend Implementation:

**File:** `tradeflow-backend/app/services/orderflow_service.py`

```python
async def detect_absorption(
    self,
    symbol: str,
    timeframe: str = '1s',
    lookback: int = 60
) -> List[Dict[str, Any]]:
    """
    Detect absorption zones where price stalls despite volume

    Returns:
    [
        {
            "timestamp": "2025-11-30T14:32:45Z",
            "price": 4064.75,
            "type": "bid_absorption",  # or "ask_absorption"
            "strength": 0.85,  # 0-1
            "volume": 450,
            "description": "Strong bid absorption at 4064.75"
        },
        ...
    ]
    """
    query = """
        SELECT
            time,
            open, high, low, close,
            volume,
            bid_volume,
            ask_volume,
            LAG(close, 1) OVER (ORDER BY time) as prev_close,
            LAG(close, 2) OVER (ORDER BY time) as prev_close_2,
            LAG(close, 3) OVER (ORDER BY time) as prev_close_3
        FROM market_data
        WHERE symbol = $1 AND timeframe = $2
        ORDER BY time DESC
        LIMIT $3
    """

    rows = await timescale_manager.fetch(query, symbol, timeframe, lookback)

    absorptions = []

    for i in range(3, len(rows)):
        row = rows[i]

        # Check if price is relatively flat (within 0.1%)
        price_range = abs(row['high'] - row['low'])
        avg_price = (row['high'] + row['low']) / 2
        price_flatness = price_range / avg_price

        if price_flatness < 0.001:  # Less than 0.1% range
            bid_vol = float(row['bid_volume'] or 0)
            ask_vol = float(row['ask_volume'] or 0)
            total_vol = bid_vol + ask_vol

            # Bid absorption: lots of selling into bid but price holds
            if bid_vol > ask_vol * 2 and total_vol > 100:
                absorptions.append({
                    "timestamp": row['time'].isoformat(),
                    "price": float(row['close']),
                    "type": "bid_absorption",
                    "strength": min(bid_vol / max(ask_vol, 1) / 5, 1.0),
                    "volume": total_vol,
                    "bid_volume": bid_vol,
                    "ask_volume": ask_vol,
                    "description": f"Bid absorption: {int(bid_vol)} vs {int(ask_vol)}"
                })

            # Ask absorption: lots of buying into ask but price holds
            elif ask_vol > bid_vol * 2 and total_vol > 100:
                absorptions.append({
                    "timestamp": row['time'].isoformat(),
                    "price": float(row['close']),
                    "type": "ask_absorption",
                    "strength": min(ask_vol / max(bid_vol, 1) / 5, 1.0),
                    "volume": total_vol,
                    "bid_volume": bid_vol,
                    "ask_volume": ask_vol,
                    "description": f"Ask absorption: {int(ask_vol)} vs {int(bid_vol)}"
                })

    return absorptions
```

### API Endpoint:

**File:** `tradeflow-backend/app/api/v1/orderflow.py`

```python
@router.post("/absorption")
async def detect_absorption(
    request: BaseModel,
    service: OrderFlowService = Depends(lambda: orderflow_service)
):
    return await service.detect_absorption(
        request.symbol,
        request.timeframe,
        request.lookback
    )
```

### Frontend: Display as Chart Markers

**File:** `src/components/chart/AbsorptionMarkers.tsx`

```typescript
'use client';

import React from 'react';

export function AbsorptionMarkers({ data, priceToY }: any) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {data.map((absorption: any, idx: number) => {
        const y = priceToY(absorption.price);
        const isBid = absorption.type === 'bid_absorption';

        return (
          <div
            key={idx}
            className="absolute"
            style={{
              top: `${y}px`,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <div
              className={`px-2 py-1 rounded text-xs font-bold ${
                isBid ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'
              }`}
            >
              {isBid ? '🛡️ BID ABS' : '🛡️ ASK ABS'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## **TASK 8: Exhaustion Detection**
**Priority: HIGH** | **Complexity: Medium** | **Value: ⭐⭐⭐⭐**

### What It Is:
Detect when a trend is **losing steam**:
- Delta weakens while price continues
- Volume collapses during breakout
- Diminishing bid/ask bursts

### Backend Implementation:

**File:** `tradeflow-backend/app/services/orderflow_service.py`

```python
async def detect_exhaustion(
    self,
    symbol: str,
    timeframe: str = '1s',
    lookback: int = 100
) -> List[Dict[str, Any]]:
    """
    Detect exhaustion signals

    Returns:
    [
        {
            "timestamp": "2025-11-30T14:32:45Z",
            "type": "bullish_exhaustion",  # or "bearish_exhaustion"
            "reason": "Volume collapse on breakout",
            "strength": 0.75,
            "price": 4064.75
        },
        ...
    ]
    """
    query = """
        SELECT
            time, close, volume, bid_volume, ask_volume,
            AVG(volume) OVER (ORDER BY time ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as avg_volume
        FROM market_data
        WHERE symbol = $1 AND timeframe = $2
        ORDER BY time DESC
        LIMIT $3
    """

    rows = await timescale_manager.fetch(query, symbol, timeframe, lookback)

    exhaustions = []

    for i in range(10, len(rows) - 1):
        curr = rows[i]
        prev = rows[i + 1]

        ask_vol = float(curr['ask_volume'] or 0)
        bid_vol = float(curr['bid_volume'] or 0)
        delta = ask_vol - bid_vol

        prev_ask = float(prev['ask_volume'] or 0)
        prev_bid = float(prev['bid_volume'] or 0)
        prev_delta = prev_ask - prev_bid

        # Bullish exhaustion: price rising but delta weakening
        if curr['close'] > prev['close'] and delta < prev_delta * 0.5:
            if curr['volume'] < curr['avg_volume'] * 0.6:  # Volume collapse
                exhaustions.append({
                    "timestamp": curr['time'].isoformat(),
                    "type": "bullish_exhaustion",
                    "reason": "Delta weakening + volume collapse",
                    "strength": 1 - (delta / max(prev_delta, 1)),
                    "price": float(curr['close']),
                    "delta": delta,
                    "prev_delta": prev_delta
                })

        # Bearish exhaustion: price falling but delta weakening
        elif curr['close'] < prev['close'] and delta > prev_delta * 0.5:
            if curr['volume'] < curr['avg_volume'] * 0.6:
                exhaustions.append({
                    "timestamp": curr['time'].isoformat(),
                    "type": "bearish_exhaustion",
                    "reason": "Delta weakening + volume collapse",
                    "strength": 1 - abs(delta / min(prev_delta, -1)),
                    "price": float(curr['close']),
                    "delta": delta,
                    "prev_delta": prev_delta
                })

    return exhaustions
```

---

## **TASK 9: 1-Second Volume Profile & Micro Nodes**
**Priority: MEDIUM** | **Complexity: Low** | **Value: ⭐⭐⭐⭐**

### What It Is:
Compute volume profile at **1-second resolution** to find micro support/resistance zones.

### Backend Implementation:

**File:** `tradeflow-backend/app/services/volume_profile_service.py`

```python
async def get_micro_volume_profile(
    self,
    symbol: str,
    start_time: datetime,
    end_time: datetime,
    price_tick: float = 0.01
) -> Dict[str, Any]:
    """
    Get 1-second resolution volume profile

    Returns micro POC, HVN (High Volume Nodes), LVN (Low Volume Nodes)
    """
    query = """
        SELECT
            FLOOR(close / $4) * $4 as price_level,
            SUM(volume) as total_volume,
            SUM(bid_volume) as total_bid,
            SUM(ask_volume) as total_ask
        FROM market_data
        WHERE symbol = $1
          AND timeframe = '1s'
          AND time >= $2
          AND time <= $3
        GROUP BY price_level
        ORDER BY total_volume DESC
    """

    rows = await timescale_manager.fetch(
        query, symbol, start_time, end_time, price_tick
    )

    if not rows:
        return {"profile": [], "micro_poc": None, "hvn": [], "lvn": []}

    # Calculate micro POC
    micro_poc = float(rows[0]['price_level'])

    # High Volume Nodes (top 20%)
    total_rows = len(rows)
    hvn_threshold = int(total_rows * 0.2)
    hvn = [float(row['price_level']) for row in rows[:hvn_threshold]]

    # Low Volume Nodes (bottom 20%)
    lvn = [float(row['price_level']) for row in rows[-hvn_threshold:]]

    return {
        "profile": [
            {
                "price": float(row['price_level']),
                "volume": float(row['total_volume']),
                "bid": float(row['total_bid'] or 0),
                "ask": float(row['total_ask'] or 0)
            }
            for row in rows
        ],
        "micro_poc": micro_poc,
        "hvn": hvn,
        "lvn": lvn
    }
```

---

## **TASK 10: Momentum & Burst Detection**
**Priority: HIGH** | **Complexity: Low** | **Value: ⭐⭐⭐⭐⭐**

### What It Is:
Detect **impulse moves** and label them:
- BUYING BURST
- SELLING BURST
- MICRO PULLBACK
- MICRO PUSH

### Backend Implementation:

**File:** `tradeflow-backend/app/services/orderflow_service.py`

```python
async def detect_bursts(
    self,
    symbol: str,
    timeframe: str = '1s',
    lookback: int = 60,
    threshold: float = 100.0
) -> List[Dict[str, Any]]:
    """
    Detect momentum bursts

    Returns:
    [
        {
            "timestamp": "2025-11-30T14:32:45Z",
            "type": "BUYING_BURST",
            "duration": 3,  # seconds
            "total_volume": 450,
            "avg_delta": 120,
            "label": "🚀 BUYING BURST"
        },
        ...
    ]
    """
    query = """
        SELECT time, close, volume, bid_volume, ask_volume
        FROM market_data
        WHERE symbol = $1 AND timeframe = $2
        ORDER BY time DESC
        LIMIT $3
    """

    rows = await timescale_manager.fetch(query, symbol, timeframe, lookback)
    rows.reverse()

    bursts = []
    i = 0

    while i < len(rows):
        row = rows[i]
        ask_vol = float(row['ask_volume'] or 0)
        bid_vol = float(row['bid_volume'] or 0)
        delta = ask_vol - bid_vol

        # Detect buying burst (consecutive positive delta)
        if ask_vol > threshold:
            start_idx = i
            total_vol = 0
            total_delta = 0
            count = 0

            while i < len(rows) and float(rows[i]['ask_volume'] or 0) > threshold:
                total_vol += float(rows[i]['volume'])
                total_delta += float(rows[i]['ask_volume'] or 0) - float(rows[i]['bid_volume'] or 0)
                count += 1
                i += 1

            if count >= 2:  # At least 2 consecutive seconds
                bursts.append({
                    "timestamp": rows[start_idx]['time'].isoformat(),
                    "type": "BUYING_BURST",
                    "duration": count,
                    "total_volume": total_vol,
                    "avg_delta": total_delta / count,
                    "label": "🚀 BUYING BURST",
                    "price": float(rows[start_idx]['close'])
                })

        # Detect selling burst
        elif bid_vol > threshold:
            start_idx = i
            total_vol = 0
            total_delta = 0
            count = 0

            while i < len(rows) and float(rows[i]['bid_volume'] or 0) > threshold:
                total_vol += float(rows[i]['volume'])
                total_delta += float(rows[i]['bid_volume'] or 0) - float(rows[i]['ask_volume'] or 0)
                count += 1
                i += 1

            if count >= 2:
                bursts.append({
                    "timestamp": rows[start_idx]['time'].isoformat(),
                    "type": "SELLING_BURST",
                    "duration": count,
                    "total_volume": total_vol,
                    "avg_delta": total_delta / count,
                    "label": "💥 SELLING BURST",
                    "price": float(rows[start_idx]['close'])
                })

        i += 1

    return bursts
```

### Frontend: Display as Labels on Chart

Use lightweight-charts markers:

```typescript
// In chart engine
addBurstMarkers(bursts: any[]) {
  const markers = bursts.map(burst => ({
    time: new Date(burst.timestamp).getTime() / 1000,
    position: burst.type === 'BUYING_BURST' ? 'belowBar' : 'aboveBar',
    color: burst.type === 'BUYING_BURST' ? '#22c55e' : '#ef4444',
    shape: 'arrowUp',
    text: burst.label,
  }));

  this.candlestickSeries.setMarkers(markers);
}
```

---

## **TASK 11: Tape Reconstruction (Partial)**
**Priority: MEDIUM** | **Complexity: Medium** | **Value: ⭐⭐⭐**

### What It Is:
Infer tape behavior from aggregated data:
- Trade size (volume / number_of_trades)
- Trade speed (trades per second)
- Buy vs sell initiation

### Backend Implementation:

```python
async def reconstruct_tape(
    self,
    symbol: str,
    timeframe: str = '1s',
    lookback: int = 100
) -> List[Dict[str, Any]]:
    """
    Reconstruct tape signals from 1s data
    """
    query = """
        SELECT
            time, volume, bid_volume, ask_volume, number_of_trades
        FROM market_data
        WHERE symbol = $1 AND timeframe = $2
        ORDER BY time DESC
        LIMIT $3
    """

    rows = await timescale_manager.fetch(query, symbol, timeframe, lookback)

    tape_signals = []

    for row in rows:
        num_trades = row['number_of_trades'] or 1
        avg_trade_size = row['volume'] / num_trades

        bid_vol = float(row['bid_volume'] or 0)
        ask_vol = float(row['ask_volume'] or 0)

        # Determine if hitting bid or ask
        hit_side = "HIT_ASK" if ask_vol > bid_vol else "HIT_BID"

        tape_signals.append({
            "timestamp": row['time'].isoformat(),
            "trades_per_second": num_trades,
            "avg_trade_size": avg_trade_size,
            "hit_side": hit_side,
            "aggression": "AGGRESSIVE" if num_trades > 10 else "PASSIVE"
        })

    return tape_signals
```

---

## **TASK 12: Liquidity Sweep Detection**
**Priority: HIGH** | **Complexity: Medium** | **Value: ⭐⭐⭐⭐⭐**

### What It Is:
Detect **stop hunts** and **liquidity grabs**:
- Sudden volume spike
- High bid/ask imbalance
- Wick breaking a level
- Immediate reversal

### Backend Implementation:

```python
async def detect_liquidity_sweeps(
    self,
    symbol: str,
    timeframe: str = '1s',
    lookback: int = 60
) -> List[Dict[str, Any]]:
    """
    Detect liquidity sweeps (stop hunts)
    """
    query = """
        SELECT
            time, open, high, low, close, volume, bid_volume, ask_volume,
            LAG(high, 1) OVER (ORDER BY time) as prev_high,
            LAG(low, 1) OVER (ORDER BY time) as prev_low,
            AVG(volume) OVER (ORDER BY time ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as avg_volume
        FROM market_data
        WHERE symbol = $1 AND timeframe = $2
        ORDER BY time DESC
        LIMIT $3
    """

    rows = await timescale_manager.fetch(query, symbol, timeframe, lookback)

    sweeps = []

    for i in range(1, len(rows) - 1):
        curr = rows[i]
        next_bar = rows[i - 1]

        # Detect upside liquidity sweep
        wick_high = curr['high'] - max(curr['open'], curr['close'])
        body_range = abs(curr['close'] - curr['open'])

        # Large wick above + volume spike + reversal
        if (wick_high > body_range * 2 and
            curr['volume'] > curr['avg_volume'] * 1.5 and
            next_bar['close'] < curr['high']):

            sweeps.append({
                "timestamp": curr['time'].isoformat(),
                "type": "UPSIDE_SWEEP",
                "swept_level": float(curr['high']),
                "reversal_price": float(next_bar['close']),
                "volume": float(curr['volume']),
                "label": "⚡ LIQUIDITY SWEEP (UP)"
            })

        # Detect downside liquidity sweep
        wick_low = min(curr['open'], curr['close']) - curr['low']

        if (wick_low > body_range * 2 and
            curr['volume'] > curr['avg_volume'] * 1.5 and
            next_bar['close'] > curr['low']):

            sweeps.append({
                "timestamp": curr['time'].isoformat(),
                "type": "DOWNSIDE_SWEEP",
                "swept_level": float(curr['low']),
                "reversal_price": float(next_bar['close']),
                "volume": float(curr['volume']),
                "label": "⚡ LIQUIDITY SWEEP (DOWN)"
            })

    return sweeps
```

---

## **TASK 13: Session VWAP + Bands**
**Priority: HIGH** | **Complexity: Low** | **Value: ⭐⭐⭐⭐**

### What It Is:
Volume-Weighted Average Price with standard deviation bands. Essential for institutional trading.

### Backend Implementation:

```python
async def calculate_vwap(
    self,
    symbol: str,
    session_start: datetime,
    session_end: datetime,
    std_dev_multiplier: float = 2.0
) -> Dict[str, Any]:
    """
    Calculate VWAP and standard deviation bands
    """
    query = """
        SELECT
            time,
            close,
            volume,
            SUM(close * volume) OVER (ORDER BY time) / SUM(volume) OVER (ORDER BY time) as vwap
        FROM market_data
        WHERE symbol = $1
          AND timeframe = '1s'
          AND time >= $2
          AND time <= $3
        ORDER BY time ASC
    """

    rows = await timescale_manager.fetch(query, symbol, session_start, session_end)

    # Calculate standard deviation
    import numpy as np

    vwap_data = []
    for row in rows:
        vwap_val = float(row['vwap'])

        # Calculate rolling std dev (simplified)
        prices = [float(r['close']) for r in rows[:rows.index(row)+1]]
        std_dev = np.std(prices) if len(prices) > 1 else 0

        vwap_data.append({
            "timestamp": row['time'].isoformat(),
            "vwap": vwap_val,
            "upper_band": vwap_val + (std_dev * std_dev_multiplier),
            "lower_band": vwap_val - (std_dev * std_dev_multiplier),
            "price": float(row['close'])
        })

    return {
        "data": vwap_data,
        "session_start": session_start.isoformat(),
        "session_end": session_end.isoformat()
    }
```

### Frontend: Display as Overlay Lines

```typescript
// Add VWAP lines to chart
addVWAPLines(vwapData: any[]) {
  const vwapSeries = this.chart.addLineSeries({
    color: '#FFA726',
    lineWidth: 2,
    title: 'VWAP',
  });

  const upperBandSeries = this.chart.addLineSeries({
    color: '#42A5F5',
    lineWidth: 1,
    lineStyle: 2,
    title: 'VWAP +2σ',
  });

  const lowerBandSeries = this.chart.addLineSeries({
    color: '#42A5F5',
    lineWidth: 1,
    lineStyle: 2,
    title: 'VWAP -2σ',
  });

  const data = vwapData.map(d => ({
    time: new Date(d.timestamp).getTime() / 1000,
    value: d.vwap,
  }));

  vwapSeries.setData(data);
  // ... similar for bands
}
```

---

## **ADVANCED FEATURES TESTING CHECKLIST:**

- [ ] Micro-footprint panel shows 1-second bid/ask breakdown
- [ ] Absorption detection marks zones on chart
- [ ] Exhaustion signals appear on weakening trends
- [ ] Micro volume profile calculates POC/HVN/LVN
- [ ] Burst detection labels buying/selling surges
- [ ] Tape reconstruction shows trade speed and size
- [ ] Liquidity sweep detection catches stop hunts
- [ ] VWAP with bands displays correctly
- [ ] All features update in real-time with WebSocket
- [ ] Performance remains smooth with 1s data

---

## **API ENDPOINTS SUMMARY (ADVANCED):**

Add to `tradeflow-backend/app/api/v1/orderflow.py`:

```python
@router.post("/micro-footprint") - Micro-footprint per second
@router.post("/absorption") - Absorption detection
@router.post("/exhaustion") - Exhaustion signals
@router.post("/micro-volume-profile") - 1s volume profile
@router.post("/bursts") - Momentum burst detection
@router.post("/tape") - Tape reconstruction
@router.post("/liquidity-sweeps") - Liquidity sweep detection
@router.post("/vwap") - VWAP calculation
```

---

## **PRIORITY IMPLEMENTATION ORDER (ADVANCED):**

1. **🥇 Liquidity Sweep Detection** (highest trader value)
2. **🥈 Momentum Burst Detection** (easy + high impact)
3. **🥉 VWAP + Bands** (professional standard)
4. **4️⃣ Absorption Detection** (competitive edge)
5. **5️⃣ Micro-Footprint Panels** (scalper feature)
6. **6️⃣ Exhaustion Detection** (reversal trading)
7. **7️⃣ Micro Volume Profile** (support/resistance)
8. **8️⃣ Tape Reconstruction** (nice-to-have)

---

## **FINAL NOTES:**

With these advanced features, **TradeFlow Pro will compete directly with:**
- ✅ Bookmap (order flow visualization)
- ✅ Exocharts (micro-structure analysis)
- ✅ Sierra Chart (professional footprint)
- ✅ TradingView Premium (institutional features)

Your **1-second data with bid/ask volume** is the foundation for ALL of these features. This puts you ahead of 90% of charting platforms.
