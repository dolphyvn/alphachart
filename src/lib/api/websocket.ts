'use client';

import { Bar } from '@/types';

export interface WebSocketMessage {
  type: 'tick' | 'bar' | 'error' | 'connected' | 'disconnected';
  symbol?: string;
  data?: any;
  timestamp?: string;
}

export interface WebSocketOptions {
  symbol: string;
  timeframe: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private isDestroyed = false;
  private subscriptions: Set<string> = new Set();

  constructor(private options: WebSocketOptions) {
    this.connect();
  }

  private getWebSocketURL(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? '8001' : window.location.port;

    return `${protocol}://${host}:${port}/api/v1/ws/stream`;
  }

  private connect() {
    if (this.isConnecting || this.isDestroyed) return;

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.getWebSocketURL());

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.options.onConnected?.();

        // Subscribe to symbol after connection
        this.subscribe(this.options.symbol);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.options.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.options.onDisconnected?.();

        // Attempt to reconnect if not intentionally closed
        if (!this.isDestroyed && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.options.onError?.(error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.options.onError?.(error as Event);

      // Fallback to polling
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached or service destroyed');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  subscribe(symbol: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        action: 'subscribe',
        symbols: [symbol]
      };

      this.ws.send(JSON.stringify(message));
      this.subscriptions.add(symbol);

      console.log(`Subscribed to WebSocket updates for ${symbol}`);
    }
  }

  unsubscribe(symbol: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        action: 'unsubscribe',
        symbols: [symbol]
      };

      this.ws.send(JSON.stringify(message));
      this.subscriptions.delete(symbol);

      console.log(`Unsubscribed from WebSocket updates for ${symbol}`);
    }
  }

  updateSubscription(symbol: string) {
    // Clear current subscriptions and subscribe to new symbol
    const currentSymbol = this.options.symbol;
    if (currentSymbol && this.subscriptions.has(currentSymbol)) {
      this.unsubscribe(currentSymbol);
    }

    this.options.symbol = symbol;
    this.subscribe(symbol);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.isDestroyed = true;
    this.isConnecting = false;

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.subscriptions.clear();
  }
}

// Fallback polling service when WebSocket is not available
export class PollingService {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private options: WebSocketOptions) {}

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    const pollInterval = this.options.timeframe.includes('s') ? 1000 : 30000; // 1s for seconds, 30s for minutes+

    console.log(`Starting polling service for ${this.options.symbol} at ${pollInterval}ms intervals`);

    this.interval = setInterval(async () => {
      try {
        // Import API client dynamically to avoid SSR issues
        const { apiClient } = await import('./client');

        const response = await apiClient.getMarketData(
          this.options.symbol,
          this.options.timeframe,
          1 // Get just the latest bar
        );

        if (response.success && response.data && response.data.length > 0) {
          const latestBar = response.data[0];

          this.options.onMessage?.({
            type: 'bar',
            symbol: this.options.symbol,
            data: latestBar,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Polling service error:', error);
        this.options.onError?.(error as Event);
      }
    }, pollInterval);
  }

  stop() {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  updateSubscription(symbol: string) {
    this.options.symbol = symbol;
  }
}

// Factory function that creates WebSocket service with fallback to polling
export function createRealtimeService(options: WebSocketOptions): {
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  updateSubscription: (symbol: string) => void;
  disconnect: () => void;
  isConnected: () => boolean;
} {
  // Try WebSocket first, fallback to polling
  const wsService = new WebSocketService(options);

  // Start polling service as backup if WebSocket fails
  setTimeout(() => {
    if (!wsService.isConnected()) {
      console.log('WebSocket not available, falling back to polling');
      const pollingService = new PollingService(options);
      pollingService.start();

      return {
        subscribe: (symbol: string) => pollingService.updateSubscription(symbol),
        unsubscribe: () => pollingService.stop(),
        updateSubscription: (symbol: string) => pollingService.updateSubscription(symbol),
        disconnect: () => pollingService.stop(),
        isConnected: () => false
      };
    }
  }, 5000); // Wait 5 seconds for WebSocket to connect

  return {
    subscribe: (symbol: string) => wsService.subscribe(symbol),
    unsubscribe: (symbol: string) => wsService.unsubscribe(symbol),
    updateSubscription: (symbol: string) => wsService.updateSubscription(symbol),
    disconnect: () => wsService.disconnect(),
    isConnected: () => wsService.isConnected()
  };
}