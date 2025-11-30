import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface FootprintBar {
    time: string;
    levels: {
        price: number;
        volume: number;
        bid_volume: number;
        ask_volume: number;
    }[];
}

export function useFootprint(symbol: string, timeframe: string, bars: any[]) {
    const [footprintData, setFootprintData] = useState<FootprintBar[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchFootprint = async () => {
            if (bars.length === 0) return;

            setIsLoading(true);
            try {
                // Get footprint for visible range
                const startTime = new Date(bars[0].timestamp * 1000).toISOString();
                const endTime = new Date(bars[bars.length - 1].timestamp * 1000).toISOString();

                const data = await apiClient.getFootprint(symbol, timeframe, startTime, endTime);
                setFootprintData(data);
            } catch (err) {
                console.error('Failed to fetch footprint data', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFootprint();
    }, [symbol, timeframe, bars]);

    return { footprintData, isLoading };
}
