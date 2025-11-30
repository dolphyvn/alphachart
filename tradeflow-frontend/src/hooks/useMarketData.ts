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
  refetchInterval = 1000, // Keep for fallback or other uses, though WS replaces polling
}: UseMarketDataOptions) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['market-data', symbol, timeframe],
    queryFn: async () => {
      // Try to fetch from real API first
      try {
        const response = await apiClient.getMarketData(symbol, timeframe, 500);
        if (response.success && response.data) {
          // Ensure bars have the correct structure for tooltip functionality
          const normalizedBars = response.data.map((bar: any) => ({
            ...bar,
            bid_volume: bar.bid_volume || bar.BidVolume || 0,
            ask_volume: bar.ask_volume || bar.AskVolume || 0,
            number_of_trades: bar.number_of_trades || bar.NumberOfTrades || 0,
          }));

          // Validate and sort bars by time
          const validBars = normalizedBars.filter((bar: any) => {
            if (!bar.time || !bar.close || typeof bar.close !== 'number') {
              console.warn('Invalid bar data filtered out:', bar);
              return false;
            }
            const barTime = new Date(bar.time);
            return !isNaN(barTime.getTime());
          });

          // Sort by time (oldest first)
          validBars.sort((a: any, b: any) => {
            const timeA = new Date(a.time).getTime();
            const timeB = new Date(b.time).getTime();
            return timeA - timeB;
          });

          return validBars;
        }
        throw new Error(response.error || 'Failed to fetch data');
      } catch (error) {
        console.warn('API fetch failed:', error);
        return []; // Return empty array instead of mock data on failure
      }
    },
    enabled: enabled && !!symbol && !!timeframe,
    refetchInterval: false, // We'll handle real-time updates via WebSocket
    staleTime: Infinity, // Data is kept fresh by WebSocket updates
    retry: 1,
  });

  // WebSocket Connection Logic
  useEffect(() => {
    if (!enabled || !symbol) return;

    const connectWebSocket = () => {
      const wsUrl = apiClient.getWebSocketURL();
      console.log('Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket Connected');
        // Subscribe to symbol
        ws.send(JSON.stringify({
          action: 'subscribe',
          symbols: [symbol]
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle different message types
          if (message.type === 'pong' || message.status === 'subscribed') return;

          // Assuming message is a Bar object or contains bar data
          // Adjust this based on actual backend message structure
          // The backend broadcast_tick sends: { type: 'trade', symbol: ..., data: { ...bar } }
          // Or if it sends raw bar data directly

          const newBar = message.data || message;

          // Validate the bar data before processing
          if (newBar && typeof newBar.close === 'number' && !isNaN(newBar.close)) {
            // Validate time field
            if (!newBar.time) {
              console.warn('WebSocket message missing time field:', newBar);
              return;
            }

            // Check if time is valid
            const barTime = new Date(newBar.time);
            if (isNaN(barTime.getTime())) {
              console.warn('WebSocket message has invalid time format:', newBar.time, newBar);
              return;
            }

            updateBar(newBar);
          } else {
            console.warn('WebSocket message invalid bar data:', message);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e, event.data);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket Disconnected');
        // Attempt reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [symbol, enabled, queryClient]);

  // Function to update a single bar (for real-time updates)
  const updateBar = (newBar: Bar) => {
    // Ensure newBar has the correct structure for tooltip functionality
    const normalizedBar = {
      ...newBar,
      bid_volume: newBar.bid_volume || (newBar as any).BidVolume || 0,
      ask_volume: newBar.ask_volume || (newBar as any).AskVolume || 0,
      number_of_trades: newBar.number_of_trades || (newBar as any).NumberOfTrades || 0,
    };

    queryClient.setQueryData(
      ['market-data', symbol, timeframe],
      (oldData: Bar[] | undefined) => {
        if (!oldData) return [normalizedBar];

        try {
          // Ensure newBar has a proper time format
          const barTime = new Date(normalizedBar.time).getTime();

          if (isNaN(barTime)) {
            console.warn('Invalid bar time format:', normalizedBar.time);
            return oldData;
          }

          // Find if we should update the last bar or add a new one
          const lastBar = oldData[oldData.length - 1];
          if (!lastBar) return [...oldData, normalizedBar];

          const lastBarTime = new Date(lastBar.time).getTime();

          if (isNaN(lastBarTime)) {
            console.warn('Invalid last bar time format:', lastBar.time);
            return [...oldData, normalizedBar];
          }

          if (barTime === lastBarTime) {
            // Update existing bar (candle update)
            const updatedData = [...oldData];
            updatedData[updatedData.length - 1] = normalizedBar;
            return updatedData;
          } else if (barTime > lastBarTime) {
            // Add new bar
            return [...oldData, normalizedBar].slice(-500); // Keep last 500
          } else {
            // Ignore older data to prevent chart errors
            console.warn('Ignoring older bar data:', new Date(normalizedBar.time).toISOString(), 'last:', new Date(lastBar.time).toISOString());
            return oldData;
          }
        } catch (error) {
          console.error('Error processing bar update:', error, normalizedBar);
          return oldData;
        }
      }
    );
  };

  // Function to add multiple bars (for batch updates)
  const addBars = (newBars: Bar[]) => {
    // Ensure newBars have the correct structure for tooltip functionality
    const normalizedBars = newBars.map(bar => ({
      ...bar,
      bid_volume: bar.bid_volume || (bar as any).BidVolume || 0,
      ask_volume: bar.ask_volume || (bar as any).AskVolume || 0,
      number_of_trades: bar.number_of_trades || (bar as any).NumberOfTrades || 0,
    }));

    queryClient.setQueryData(
      ['market-data', symbol, timeframe],
      (oldData: Bar[] | undefined) => {
        if (!oldData) return normalizedBars;

        // Combine and deduplicate
        const combined = [...normalizedBars, ...oldData];
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