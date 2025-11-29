const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://ns3366383.ip-37-187-77.eu:8001/api/v1';

export interface BarData {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export const apiClient = {
    async getBars(symbol: string, timeframe: string, limit: number = 500): Promise<BarData[]> {
        const response = await fetch(`${API_BASE_URL}/market-data/bars?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`);
        if (!response.ok) {
            throw new Error('Failed to fetch market data');
        }
        const data = await response.json();
        return data;
    },

    async getSMA(symbol: string, timeframe: string, period: number = 14, limit: number = 500): Promise<any[]> {
        const response = await fetch(`${API_BASE_URL}/indicators/sma?symbol=${symbol}&timeframe=${timeframe}&period=${period}&limit=${limit}`);
        return response.json();
    },

    async getEMA(symbol: string, timeframe: string, period: number = 14, limit: number = 500): Promise<any[]> {
        const response = await fetch(`${API_BASE_URL}/indicators/ema?symbol=${symbol}&timeframe=${timeframe}&period=${period}&limit=${limit}`);
        return response.json();
    },

    async getRSI(symbol: string, timeframe: string, period: number = 14, limit: number = 500): Promise<any[]> {
        const response = await fetch(`${API_BASE_URL}/indicators/rsi?symbol=${symbol}&timeframe=${timeframe}&period=${period}&limit=${limit}`);
        return response.json();
    },

    async getMACD(symbol: string, timeframe: string, fast: number = 12, slow: number = 26, signal: number = 9, limit: number = 500): Promise<any[]> {
        const response = await fetch(`${API_BASE_URL}/indicators/macd?symbol=${symbol}&timeframe=${timeframe}&fast_period=${fast}&slow_period=${slow}&signal_period=${signal}&limit=${limit}`);
        return response.json();
    },

    async getBollinger(symbol: string, timeframe: string, period: number = 20, std_dev: number = 2, limit: number = 500): Promise<any[]> {
        const response = await fetch(`${API_BASE_URL}/indicators/bollinger?symbol=${symbol}&timeframe=${timeframe}&period=${period}&std_dev=${std_dev}&limit=${limit}`);
        return response.json();
    }
};
