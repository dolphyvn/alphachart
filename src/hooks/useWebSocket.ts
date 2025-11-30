'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createRealtimeService, WebSocketMessage } from '@/lib/api/websocket';
import { Bar } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

interface UseWebSocketOptions {
  symbol: string;
  timeframe: string;
  enabled?: boolean;
}

export function useWebSocket({ symbol, timeframe, enabled = true }: UseWebSocketOptions) {
  const queryClient = useQueryClient();
  const serviceRef = useRef<ReturnType<typeof createRealtimeService> | null>(null);
  const lastUpdateTime = useRef<string | null>(null);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'bar' || message.type === 'tick') {
      const bar: Bar = message.data;

      // Prevent duplicate updates (throttle to 100ms minimum)
      const now = new Date().toISOString();
      if (lastUpdateTime.current && (Date.parse(now) - Date.parse(lastUpdateTime.current)) < 100) {
        return;
      }
      lastUpdateTime.current = now;

      // Update React Query cache with new bar data
      queryClient.setQueryData(
        ['market-data', symbol, timeframe],
        (oldData: Bar[] | undefined) => {
          if (!oldData) return [bar];

          // Find if the bar already exists
          const existingIndex = oldData.findIndex(existingBar =>
            existingBar.time === bar.time
          );

          if (existingIndex >= 0) {
            // Update existing bar
            const updatedData = [...oldData];
            updatedData[existingIndex] = bar;
            return updatedData;
          } else {
            // Add new bar and keep only the most recent ones
            const updatedData = [bar, ...oldData].slice(0, 500);
            return updatedData.sort((a, b) =>
              new Date(a.time).getTime() - new Date(b.time).getTime()
            );
          }
        }
      );

      console.log(`Received real-time update for ${symbol}:`, bar);
    } else if (message.type === 'error') {
      console.error('WebSocket error:', message.data);
    } else if (message.type === 'connected') {
      console.log('WebSocket connected successfully');
    } else if (message.type === 'disconnected') {
      console.log('WebSocket disconnected');
    }
  }, [symbol, timeframe, queryClient]);

  const handleConnected = useCallback(() => {
    console.log('Real-time connection established for', symbol);
  }, [symbol]);

  const handleDisconnected = useCallback(() => {
    console.log('Real-time connection lost for', symbol);
  }, [symbol]);

  const handleError = useCallback((error: Event) => {
    console.error('Real-time connection error:', error);
  }, []);

  useEffect(() => {
    if (!enabled || !symbol || !timeframe) {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
      return;
    }

    // Create new service instance
    serviceRef.current = createRealtimeService({
      symbol,
      timeframe,
      onMessage: handleWebSocketMessage,
      onConnected: handleConnected,
      onDisconnected: handleDisconnected,
      onError: handleError,
    });

    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, [symbol, timeframe, enabled, handleWebSocketMessage, handleConnected, handleDisconnected, handleError]);

  // Update subscription when symbol changes
  useEffect(() => {
    if (serviceRef.current && enabled) {
      serviceRef.current.updateSubscription(symbol);
    }
  }, [symbol, enabled]);

  const isConnected = serviceRef.current?.isConnected() || false;

  return {
    isConnected,
  };
}