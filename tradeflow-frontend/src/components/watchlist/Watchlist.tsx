'use client';

import React, { useState } from 'react';
import { X, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { WatchlistItem, Symbol } from '@/types';
import { useChartStore } from '@/lib/stores/chart-store';
import { DEFAULT_SYMBOLS } from '@/lib/constants';

interface WatchlistProps {
  className?: string;
  onSymbolSelect?: (symbol: Symbol) => void;
}

export function Watchlist({ className = '', onSymbolSelect }: WatchlistProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { watchlist, setCurrentSymbol, removeFromWatchlist } = useChartStore();

  const filteredSymbols = DEFAULT_SYMBOLS.filter(symbol =>
    symbol.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    symbol.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSymbolClick = (item: WatchlistItem) => {
    const symbol = DEFAULT_SYMBOLS.find(s => s.symbol === item.symbol);
    if (symbol) {
      setCurrentSymbol(symbol);
      onSymbolSelect?.(symbol);
    }
  };

  const handleAddSymbol = (symbol: Symbol) => {
    const watchlistItem: WatchlistItem = {
      symbol: symbol.symbol,
      name: symbol.name,
      lastPrice: Math.random() * 1000, // Mock data
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 2,
      volume: Math.floor(Math.random() * 1000000),
    };
    onSymbolSelect?.(symbol);
    setIsAddDialogOpen(false);
    setSearchQuery('');
  };

  const formatPrice = (price: number) => {
    return price.toFixed(4);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div className={`border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-sm">Watchlist</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Add Symbol"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Toggle Expand"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add Symbol Dialog */}
      {isAddDialogOpen && (
        <div className="p-4 border-b">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbols to add..."
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <div className="mt-2 max-h-32 overflow-y-auto">
              {filteredSymbols.map((symbol) => (
                <div
                  key={symbol.symbol}
                  onClick={() => handleAddSymbol(symbol)}
                  className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                >
                  <div>
                    <div className="font-medium">{symbol.symbol}</div>
                    <div className="text-xs text-muted-foreground">{symbol.name}</div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-muted rounded">
                    {symbol.asset_type.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Watchlist Items */}
      {isExpanded && (
        <div className="overflow-y-auto">
          {watchlist.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <p>No symbols in watchlist</p>
              <p className="mt-1">Click the + button to add symbols</p>
            </div>
          ) : (
            watchlist.map((item) => (
              <div
                key={item.symbol}
                className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer transition-colors border-b"
                onClick={() => handleSymbolClick(item)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.symbol}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.name}</div>
                </div>
                <div className="text-right ml-2">
                  <div className="font-mono text-sm">{formatPrice(item.lastPrice)}</div>
                  <div className={`text-xs flex items-center justify-end gap-1 ${
                    item.change >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {item.change >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPercent(item.changePercent)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWatchlist(item.symbol);
                  }}
                  className="ml-2 p-1 hover:bg-muted rounded transition-colors"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}