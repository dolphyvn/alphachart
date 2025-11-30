import { Bar, Symbol, Timeframe, Indicator, OrderFlowData, APIResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Market Data
  async getMarketData(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<APIResponse<Bar[]>> {
    return this.request<Bar[]>(`/api/v1/market-data/bars?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`);
  }

  async getSymbolInfo(symbol: string): Promise<APIResponse<Symbol>> {
    return this.request<Symbol>(`/api/v1/symbols/${symbol}`);
  }

  async searchSymbols(query: string): Promise<APIResponse<Symbol[]>> {
    return this.request<Symbol[]>(`/api/v1/symbols/search?q=${encodeURIComponent(query)}`);
  }

  async getAvailableSymbols(): Promise<APIResponse<string[]>> {
    const response = await this.request<{ symbols: string[] }>('/api/v1/market-data/symbols');
    if (response.success && response.data) {
      return {
        success: true,
        data: response.data.symbols
      };
    }
    return {
      success: false,
      error: response.error || 'Failed to fetch symbols'
    };
  }

  // Indicators
  async calculateIndicator(
    symbol: string,
    timeframe: string,
    indicatorType: string,
    inputs: Record<string, any>
  ): Promise<APIResponse<Indicator>> {
    return this.request<Indicator>(`/api/v1/indicators/${indicatorType}`, {
      method: 'POST',
      body: JSON.stringify({
        symbol,
        timeframe,
        inputs,
      }),
    });
  }

  // Order Flow
  async getFootprintData(
    symbol: string,
    startTime: string,
    endTime: string
  ): Promise<APIResponse<OrderFlowData['footprint']>> {
    return this.request<OrderFlowData['footprint']>(`/api/v1/orderflow/footprint/${symbol}`, {
      method: 'POST',
      body: JSON.stringify({ startTime, endTime }),
    });
  }

  async getVolumeProfile(
    symbol: string,
    startTime: string,
    endTime: string
  ): Promise<APIResponse<OrderFlowData['volumeProfile']>> {
    return this.request<OrderFlowData['volumeProfile']>(`/api/v1/volume-profile/${symbol}`, {
      method: 'POST',
      body: JSON.stringify({ startTime, endTime }),
    });
  }

  async getCumulativeDelta(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<APIResponse<OrderFlowData['cvd']>> {
    return this.request<OrderFlowData['cvd']>(`/api/v1/orderflow/cvd/${symbol}?timeframe=${timeframe}&limit=${limit}`);
  }

  // WebSocket endpoint
  getWebSocketURL(): string {
    const wsProtocol = this.baseURL.startsWith('https') ? 'wss' : 'ws';
    return `${wsProtocol}://${this.baseURL.replace(/^https?:\/\//, '')}/api/v1/ws/stream`;
  }
}

export const apiClient = new ApiClient();