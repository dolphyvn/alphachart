import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { OrderFlowData } from '@/types';
import { apiClient } from '@/lib/api/client';

interface UseOrderFlowOptions {
  symbol: string;
  timeframe: string;
  enabled?: boolean;
  refetchInterval?: number;
  type: 'footprint' | 'volume-profile' | 'cvd' | 'none';
}

export function useOrderFlow({
  symbol,
  timeframe,
  enabled = true,
  refetchInterval = 5000,
  type
}: UseOrderFlowOptions) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orderflow', symbol, timeframe, type],
    queryFn: async () => {
      if (type === 'none') return null;

      console.log('Fetching order flow data for:', { symbol, timeframe, type });

      try {
        // Fetch order flow data based on type
        let response;
        switch (type) {
          case 'cvd':
            console.log('Making CVD API call...');
            response = await apiClient.getCumulativeDelta(symbol, timeframe, 500);
            console.log('CVD API response:', response);
            break;
          case 'volume-profile':
            response = await apiClient.getVolumeProfile(symbol,
              new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
              new Date().toISOString()
            );
            break;
          case 'footprint':
            response = await apiClient.getFootprintData(symbol,
              new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
              new Date().toISOString()
            );
            break;
          default:
            return null;
        }

        console.log('Order flow response structure:', {
          success: response.success,
          dataType: typeof response.data,
          dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
          data: response.data
        });

        if (response.success && response.data) {
          console.log('Returning order flow data with length:', Array.isArray(response.data) ? response.data.length : 'not array');

          // The backend returns the array directly, but frontend expects { cvd: [] }
          // Transform the response to match expected OrderFlowData structure
          if (type === 'cvd') {
            return { cvd: response.data };
          }

          return response.data;
        }
        throw new Error(response.error || 'Failed to fetch order flow data');
      } catch (error) {
        console.warn('Order flow API fetch failed:', error);
        // Return empty structure instead of null to prevent re-renders
        if (type === 'cvd') {
          return { cvd: [] };
        }
        return null;
      }
    },
    enabled: enabled && !!symbol && !!timeframe && type !== 'none',
    refetchInterval: false, // Disable auto-refetch for debugging
    staleTime: 0, // Disable cache for debugging
    retry: 1,
  });

  // WebSocket connection for real-time order flow updates
  useEffect(() => {
    if (!enabled || !symbol || type === 'none') return;

    const connectWebSocket = () => {
      const wsUrl = apiClient.getWebSocketURL();
      console.log(`Connecting to OrderFlow WebSocket: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('OrderFlow WebSocket Connected');
        // Subscribe to order flow updates
        ws.send(JSON.stringify({
          action: 'subscribe_orderflow',
          symbol,
          type,
          timeframe
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle different message types
          if (message.type === 'pong' || message.status === 'subscribed') return;
          if (message.type !== 'orderflow_update') return;

          const orderFlowUpdate = message.data;
          if (!orderFlowUpdate || orderFlowUpdate.symbol !== symbol) return;

          // Update the order flow data in the cache
          queryClient.setQueryData(
            ['orderflow', symbol, timeframe, type],
            (oldData: OrderFlowData | null) => {
              if (!oldData) return orderFlowUpdate;

              // Merge new data with existing data
              return mergeOrderFlowData(oldData, orderFlowUpdate, type);
            }
          );
        } catch (e) {
          console.error('Error parsing OrderFlow WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log('OrderFlow WebSocket Disconnected');
        // Attempt reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect OrderFlow WebSocket...');
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('OrderFlow WebSocket Error:', error);
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
  }, [symbol, timeframe, type, enabled, queryClient]);

  // Merge order flow data helper
  const mergeOrderFlowData = (
    oldData: OrderFlowData,
    newData: any,
    flowType: string
  ): OrderFlowData => {
    switch (flowType) {
      case 'cvd':
        return {
          ...oldData,
          cvd: mergeCVDData(oldData.cvd, newData.cvd || []),
          sessionInfo: newData.sessionInfo || oldData.sessionInfo
        };
      case 'volume-profile':
        return {
          ...oldData,
          volumeProfile: newData.volumeProfile || oldData.volumeProfile,
          sessionInfo: newData.sessionInfo || oldData.sessionInfo
        };
      case 'footprint':
        return {
          ...oldData,
          footprint: mergeFootprintData(oldData.footprint, newData.footprint || []),
          sessionInfo: newData.sessionInfo || oldData.sessionInfo
        };
      default:
        return oldData;
    }
  };

  const mergeCVDData = (oldCVD: any[], newCVD: any[]) => {
    if (!newCVD.length) return oldCVD;

    const merged = [...oldCVD];
    const latestTime = new Date(merged[merged.length - 1]?.time || 0).getTime();

    newCVD.forEach((newDatum) => {
      const datumTime = new Date(newDatum.time).getTime();
      if (datumTime > latestTime) {
        merged.push(newDatum);
      } else {
        // Update existing datum
        const existingIndex = merged.findIndex(d =>
          new Date(d.time).getTime() === datumTime
        );
        if (existingIndex >= 0) {
          merged[existingIndex] = newDatum;
        }
      }
    });

    // Keep last 500 data points
    return merged.slice(-500);
  };

  const mergeFootprintData = (oldFootprint: any[], newFootprint: any[]) => {
    if (!newFootprint.length) return oldFootprint;

    const merged = [...oldFootprint];
    const latestTime = new Date(merged[merged.length - 1]?.timestamp || 0).getTime();

    newFootprint.forEach((newBar) => {
      const barTime = new Date(newBar.timestamp).getTime();
      if (barTime > latestTime) {
        merged.push(newBar);
      } else {
        // Update existing bar
        const existingIndex = merged.findIndex(b =>
          new Date(b.timestamp).getTime() === barTime
        );
        if (existingIndex >= 0) {
          merged[existingIndex] = newBar;
        }
      }
    });

    // Keep last 500 bars
    return merged.slice(-500);
  };

  return {
    orderFlowData: data,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}