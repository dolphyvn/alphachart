'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Bar } from '@/types';
import { apiClient } from '@/lib/api/client';
import { MockMarketDataService } from '@/lib/api/mock-service';

interface UseMarketDataOptions {
  symbol: string;
  timeframe: string;
  enabled?: boolean;
  refetchInterval?: number;
}

export function useMarketData({
  symbol,
  timeframe,
  enabled = true,
  refetchInterval = 1000, // Refresh every second by default
}: UseMarketDataOptions) {
  const queryClient = useQueryClient();
  const mockService = useRef(MockMarketDataService.getInstance());
  const realtimeIntervalRef = useRef<(() => void) | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['market-data', symbol, timeframe],
    queryFn: async () => {
      // Try to fetch from real API first
      try {
        const response = await apiClient.getMarketData(symbol, timeframe, 500);
        if (response.success && response.data) {
          return response.data;
        }
      } catch (error) {
        console.warn('API not available, using mock data:', error);
      }

      // Fallback to mock data
      return mockService.current.generateHistoricalData(500);
    },
    enabled: enabled && !!symbol && !!timeframe,
    refetchInterval: false, // We'll handle real-time updates ourselves
    staleTime: timeframe.includes('s') ? 500 : 30000, // 0.5s for seconds, 30s for minutes+
    retry: 1,
  });

  // Set up real-time updates for second-based timeframes
  useEffect(() => {
    if (!timeframe.includes('s') || !symbol || !enabled) {
      // Clean up any existing interval
      if (realtimeIntervalRef.current) {
        realtimeIntervalRef.current();
        realtimeIntervalRef.current = null;
      }
      return;
    }

    // Start real-time updates
    const cleanup = mockService.current.startRealtimeUpdates((newBar) => {
      queryClient.setQueryData(
        ['market-data', symbol, timeframe],
        (oldData: Bar[] | undefined) => {
          if (!oldData) return [newBar];

          // Remove the last bar if it's from the same second, then add the new bar
          const filteredData = oldData.filter(bar => bar.time !== newBar.time);
          return [...filteredData, newBar].slice(-500);
        }
      );
    }, refetchInterval);

    realtimeIntervalRef.current = cleanup;

    return () => {
      if (realtimeIntervalRef.current) {
        realtimeIntervalRef.current();
        realtimeIntervalRef.current = null;
      }
    };
  }, [symbol, timeframe, enabled, refetchInterval, queryClient]);

  // Function to update a single bar (for real-time updates)
  const updateBar = (newBar: Bar) => {
    queryClient.setQueryData(
      ['market-data', symbol, timeframe],
      (oldData: Bar[] | undefined) => {
        if (!oldData) return [newBar];

        // Find if the bar already exists
        const existingIndex = oldData.findIndex(bar => bar.time === newBar.time);

        if (existingIndex >= 0) {
          // Update existing bar
          const updatedData = [...oldData];
          updatedData[existingIndex] = newBar;
          return updatedData;
        } else {
          // Add new bar and keep only the most recent ones
          const updatedData = [newBar, ...oldData].slice(0, 500);
          return updatedData.sort((a, b) =>
            new Date(a.time).getTime() - new Date(b.time).getTime()
          );
        }
      }
    );
  };

  // Function to add multiple bars (for batch updates)
  const addBars = (newBars: Bar[]) => {
    queryClient.setQueryData(
      ['market-data', symbol, timeframe],
      (oldData: Bar[] | undefined) => {
        if (!oldData) return newBars;

        // Combine and deduplicate
        const combined = [...newBars, ...oldData];
        const uniqueBars = combined.filter((bar, index, self) =>
          index === self.findIndex(b => b.time === bar.time)
        );

        // Sort and limit
        return uniqueBars
          .sort((a, b) =>
            new Date(a.time).getTime() - new Date(b.time).getTime()
          )
          .slice(-500);
      }
    );
  };

  return {
    bars: data || [],
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    updateBar,
    addBars,
  };
}