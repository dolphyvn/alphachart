import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { Indicator } from '@/types/chart';

export function useIndicators(symbol: string, timeframe: string) {
    const [indicators, setIndicators] = useState<Indicator[]>([]);

    const addIndicator = useCallback(async (type: Indicator['type'], params: any = {}) => {
        try {
            let data: any[] = [];
            let color = '#2962FF'; // Default blue
            let name: string = type;

            switch (type) {
                case 'SMA':
                    data = await apiClient.getSMA(symbol, timeframe, params.period || 14);
                    color = '#2962FF';
                    name = `SMA (${params.period || 14})`;
                    break;
                case 'EMA':
                    data = await apiClient.getEMA(symbol, timeframe, params.period || 14);
                    color = '#FF6D00'; // Orange
                    name = `EMA (${params.period || 14})`;
                    break;
                case 'BOLLINGER':
                    data = await apiClient.getBollinger(symbol, timeframe, params.period || 20, params.std_dev || 2);
                    color = '#00B8D4'; // Cyan
                    name = `BB (${params.period || 20}, ${params.std_dev || 2})`;
                    break;
                case 'RSI':
                    data = await apiClient.getRSI(symbol, timeframe, params.period || 14);
                    color = '#7E57C2'; // Purple
                    name = `RSI (${params.period || 14})`;
                    break;
                case 'MACD':
                    data = await apiClient.getMACD(symbol, timeframe);
                    color = '#2962FF';
                    name = 'MACD (12, 26, 9)';
                    break;
            }

            const newIndicator: Indicator = {
                id: Math.random().toString(36).substr(2, 9),
                type,
                name,
                color,
                params,
                data: data.map(d => ({
                    timestamp: new Date(d.time).getTime() / 1000,
                    value: d.value !== undefined ? d.value : d // Handle object vs value
                })),
                overlay: ['SMA', 'EMA', 'BOLLINGER'].includes(type)
            };

            setIndicators(prev => [...prev, newIndicator]);
        } catch (err) {
            console.error('Failed to add indicator', err);
        }
    }, [symbol, timeframe]);

    const removeIndicator = useCallback((id: string) => {
        setIndicators(prev => prev.filter(i => i.id !== id));
    }, []);

    return { indicators, addIndicator, removeIndicator };
}
