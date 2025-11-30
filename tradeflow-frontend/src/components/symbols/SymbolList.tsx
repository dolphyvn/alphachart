'use client';

import React from 'react';
import { Loader, TrendingUp, TrendingDown } from 'lucide-react';
import { useAvailableSymbols } from '@/hooks/useSymbols';
import { useChartStore } from '@/lib/stores/chart-store';

export function SymbolList() {
  const { data: symbols, isLoading, error } = useAvailableSymbols();
  const { setCurrentSymbol, currentSymbol } = useChartStore();

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center">
          <Loader className="h-6 w-6 animate-spin mr-2" />
          <span>Loading symbols...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-destructive">
          Error loading symbols: {error.message}
        </div>
      </div>
    );
  }

  if (!symbols?.success || !symbols.data || symbols.data.length === 0) {
    return (
      <div className="p-4">
        <div className="text-muted-foreground">
          No symbols available
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="font-semibold mb-4">Available Symbols</h3>
      <div className="space-y-2">
        {symbols.data.map((symbol: string) => (
          <div
            key={symbol}
            onClick={() => setCurrentSymbol({
              symbol,
              name: symbol,
              asset_type: 'UNKNOWN',
              exchange: 'UNKNOWN'
            })}
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted ${
              currentSymbol.symbol === symbol ? 'bg-primary/10 border-primary' : 'bg-background'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{symbol}</div>
                <div className="text-sm text-muted-foreground">Live data</div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm">0.00%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}