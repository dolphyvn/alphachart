import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import {
  AppState,
  Symbol,
  Timeframe,
  ChartType,
  Indicator,
  DrawingTool,
  WatchlistItem,
  OrderFlowData,
  OrderFlowConfig
} from '@/types';
import { DEFAULT_SYMBOLS, TIMEFRAMES, CHART_TYPES } from '@/lib/constants';

interface ChartStore extends AppState {
  // Actions
  setCurrentSymbol: (symbol: Symbol) => void;
  setCurrentTimeframe: (timeframe: Timeframe) => void;
  setChartType: (chartType: ChartType) => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Indicators
  addIndicator: (indicator: Indicator) => void;
  removeIndicator: (indicatorId: string) => void;
  updateIndicator: (indicatorId: string, updates: Partial<Indicator>) => void;
  clearIndicators: () => void;

  // Drawings
  setDrawings: (drawings: any[]) => void;
  addDrawing: (drawing: any) => void;
  removeDrawing: (drawingId: string) => void;
  updateDrawing: (drawingId: string, updates: any) => void;
  clearDrawings: () => void;

  // Watchlist
  setWatchlist: (watchlist: WatchlistItem[]) => void;
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (symbol: string) => void;
  updateWatchlistItem: (symbol: string, updates: Partial<WatchlistItem>) => void;

  // Order Flow
  setOrderFlowData: (data: OrderFlowData) => void;
  setOrderFlowConfig: (config: OrderFlowConfig) => void;
  updateOrderFlowConfig: (updates: Partial<OrderFlowConfig>) => void;

  // Layout
  resetLayout: () => void;
}

const defaultOrderFlowConfig: OrderFlowConfig = {
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
};

const initialState: Omit<AppState, 'layout'> = {
  currentSymbol: DEFAULT_SYMBOLS[0],
  currentTimeframe: TIMEFRAMES.find(t => t.value === '1m') || TIMEFRAMES[3],
  chartType: CHART_TYPES[0],
  theme: 'light',
  indicators: [],
  drawings: [],
  watchlist: [],
  orderFlow: {
    footprint: [],
    volumeProfile: [],
    cvd: []
  },
};

export const useChartStore = create<ChartStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,
      layout: {
        id: 'default',
        name: 'Default Layout',
        symbol: initialState.currentSymbol.symbol,
        timeframe: initialState.currentTimeframe.value,
        chartType: initialState.chartType,
        indicators: [],
        drawings: [],
        orderFlow: defaultOrderFlowConfig
      },

      setCurrentSymbol: (symbol) =>
        set((state) => ({
          currentSymbol: symbol,
          layout: { ...state.layout, symbol: symbol.symbol }
        }), false, 'setCurrentSymbol'),

      setCurrentTimeframe: (timeframe) =>
        set((state) => ({
          currentTimeframe: timeframe,
          layout: { ...state.layout, timeframe: timeframe.value }
        }), false, 'setCurrentTimeframe'),

      setChartType: (chartType) =>
        set((state) => ({
          chartType,
          layout: { ...state.layout, chartType }
        }), false, 'setChartType'),

      setTheme: (theme) =>
        set({ theme }, false, 'setTheme'),

      addIndicator: (indicator) =>
        set((state) => ({
          indicators: [...state.indicators, indicator],
          layout: { ...state.layout, indicators: [...state.layout.indicators, indicator] }
        }), false, 'addIndicator'),

      removeIndicator: (indicatorId) =>
        set((state) => ({
          indicators: state.indicators.filter(ind => ind.id !== indicatorId),
          layout: {
            ...state.layout,
            indicators: state.layout.indicators.filter(ind => ind.id !== indicatorId)
          }
        }), false, 'removeIndicator'),

      updateIndicator: (indicatorId, updates) =>
        set((state) => ({
          indicators: state.indicators.map(ind =>
            ind.id === indicatorId ? { ...ind, ...updates } : ind
          ),
          layout: {
            ...state.layout,
            indicators: state.layout.indicators.map(ind =>
              ind.id === indicatorId ? { ...ind, ...updates } : ind
            )
          }
        }), false, 'updateIndicator'),

      clearIndicators: () =>
        set((state) => ({
          indicators: [],
          layout: { ...state.layout, indicators: [] }
        }), false, 'clearIndicators'),

      setDrawings: (drawings) =>
        set((state) => ({
          drawings,
          layout: { ...state.layout, drawings }
        }), false, 'setDrawings'),

      addDrawing: (drawing) =>
        set((state) => ({
          drawings: [...state.drawings, drawing],
          layout: { ...state.layout, drawings: [...state.layout.drawings, drawing] }
        }), false, 'addDrawing'),

      removeDrawing: (drawingId) =>
        set((state) => ({
          drawings: state.drawings.filter(d => d.id !== drawingId),
          layout: {
            ...state.layout,
            drawings: state.layout.drawings.filter(d => d.id !== drawingId)
          }
        }), false, 'removeDrawing'),

      updateDrawing: (drawingId, updates) =>
        set((state) => ({
          drawings: state.drawings.map(d =>
            d.id === drawingId ? { ...d, ...updates } : d
          ),
          layout: {
            ...state.layout,
            drawings: state.layout.drawings.map(d =>
              d.id === drawingId ? { ...d, ...updates } : d
            )
          }
        }), false, 'updateDrawing'),

      clearDrawings: () =>
        set((state) => ({
          drawings: [],
          layout: { ...state.layout, drawings: [] }
        }), false, 'clearDrawings'),

      setWatchlist: (watchlist) =>
        set({ watchlist }, false, 'setWatchlist'),

      addToWatchlist: (item) =>
        set((state) => ({
          watchlist: state.watchlist.some(w => w.symbol === item.symbol)
            ? state.watchlist
            : [...state.watchlist, item]
        }), false, 'addToWatchlist'),

      removeFromWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.filter(item => item.symbol !== symbol)
        }), false, 'removeFromWatchlist'),

      updateWatchlistItem: (symbol, updates) =>
        set((state) => ({
          watchlist: state.watchlist.map(item =>
            item.symbol === symbol ? { ...item, ...updates } : item
          )
        }), false, 'updateWatchlistItem'),

      setOrderFlowData: (data) =>
        set({ orderFlow: data }, false, 'setOrderFlowData'),

      setOrderFlowConfig: (config) =>
        set((state) => ({
          layout: { ...state.layout, orderFlow: config }
        }), false, 'setOrderFlowConfig'),

      updateOrderFlowConfig: (updates) =>
        set((state) => ({
          layout: {
            ...state.layout,
            orderFlow: { ...state.layout.orderFlow, ...updates }
          }
        }), false, 'updateOrderFlowConfig'),

      resetLayout: () =>
        set((state) => ({
          layout: {
            id: 'default',
            name: 'Default Layout',
            symbol: state.currentSymbol.symbol,
            timeframe: state.currentTimeframe.value,
            chartType: state.chartType,
            indicators: [],
            drawings: [],
            orderFlow: defaultOrderFlowConfig
          }
        }), false, 'resetLayout'),
    })),
    {
      name: 'chart-store',
    }
  )
);