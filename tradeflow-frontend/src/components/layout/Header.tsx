'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, X, Settings, Layout, Loader } from 'lucide-react';
import { Symbol, Timeframe, ChartType, WatchlistItem } from '@/types';
import { TIMEFRAMES, CHART_TYPES, DEFAULT_SYMBOLS } from '@/lib/constants';
import { useChartStore } from '@/lib/stores/chart-store';
import { useAvailableSymbols, useSymbolSearch } from '@/hooks/useSymbols';

interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    currentSymbol,
    currentTimeframe,
    chartType,
    theme,
    setCurrentSymbol,
    setCurrentTimeframe,
    setChartType,
    watchlist,
    addToWatchlist,
  } = useChartStore();

  // Fetch available symbols from API
  const { data: availableSymbols, isLoading: symbolsLoading, error: symbolsError } = useAvailableSymbols();

  // Search symbols when query changes
  const { data: searchResults, isLoading: searchLoading } = useSymbolSearch(searchQuery);

  // Convert string symbols to Symbol objects or use search results
  const symbolsToShow = searchQuery
    ? (searchResults?.success ? searchResults.data : [])
    : (availableSymbols?.success ? (Array.isArray(availableSymbols.data) ? availableSymbols.data.map((symbol: string) => ({
        symbol,
        name: symbol, // Backend doesn't provide names yet
        asset_type: 'UNKNOWN',
        exchange: 'UNKNOWN'
      })) : []) : DEFAULT_SYMBOLS);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSymbolSelect = (symbol: Symbol) => {
    setCurrentSymbol(symbol);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const toggleWatchlist = (symbol: Symbol) => {
    const watchlistItem: WatchlistItem = {
      symbol: symbol.symbol,
      name: symbol.name,
      lastPrice: 0, // Would come from real data
      change: 0,
      changePercent: 0,
      volume: 0,
    };
    addToWatchlist(watchlistItem);
  };

  const isInWatchlist = (symbol: string) => {
    return watchlist.some(item => item.symbol === symbol);
  };

  return (
    <header className={`border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      <div className="flex h-16 items-center px-4 gap-4">
        {/* Left Section - Symbol Search */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-muted transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="font-medium">{currentSymbol.symbol}</span>
              <span className="text-sm text-muted-foreground">{currentSymbol.name}</span>
            </button>

            {/* Symbol Search Dropdown */}
            {isSearchOpen && (
              <div className="absolute top-full left-0 mt-1 w-96 bg-background border rounded-lg shadow-lg z-50">
                <div className="p-3 border-b">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search symbols..."
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {symbolsLoading && !searchQuery && (
                    <div className="p-4 text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Loading symbols...</p>
                    </div>
                  )}

                  {symbolsError && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-destructive">Error loading symbols</p>
                    </div>
                  )}

                  {searchLoading && (
                    <div className="p-4 text-center">
                      <Loader className="h-4 w-4 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground">Searching...</p>
                    </div>
                  )}

                  {!symbolsLoading && !symbolsError && symbolsToShow.length === 0 && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? 'No symbols found' : 'No symbols available'}
                      </p>
                    </div>
                  )}

                  {symbolsToShow.map((symbol) => (
                    <div
                      key={symbol.symbol}
                      className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleSymbolSelect(symbol)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{symbol.symbol}</div>
                          <div className="text-sm text-muted-foreground">{symbol.name}</div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-muted rounded">
                          {symbol.asset_type.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist(symbol);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isInWatchlist(symbol.symbol)
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isInWatchlist(symbol.symbol) ? '★' : '☆'}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t flex justify-end">
                  <button
                    onClick={() => setIsSearchOpen(false)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Section - Timeframe Selector */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((timeframe) => (
            <button
              key={timeframe.value}
              onClick={() => setCurrentTimeframe(timeframe)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentTimeframe.value === timeframe.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {timeframe.label}
            </button>
          ))}
        </div>

        {/* Right Section - Chart Type & Actions */}
        <div className="flex items-center gap-2">
          {/* Chart Type Selector */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            {CHART_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setChartType(type)}
                className={`px-2 py-1 rounded text-sm transition-colors ${
                  chartType.id === type.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={type.label}
              >
                {type.label.charAt(0)}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <button className="p-2 rounded-md hover:bg-muted transition-colors" title="Layout">
            <Layout className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-md hover:bg-muted transition-colors" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}