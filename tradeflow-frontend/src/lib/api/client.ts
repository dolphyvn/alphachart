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
    }
};
