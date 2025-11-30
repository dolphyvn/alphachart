import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface CVDDataPoint {
    time: string;
    delta: number;
    cumulative_delta: number;
}

export function useCVD(symbol: string, timeframe: string, bars: any[]) {
    const [cvdData, setCvdData] = useState<CVDDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchCVD = async () => {
            if (bars.length === 0) return;

            setIsLoading(true);
            try {
                // Get CVD for visible range
                const startTime = new Date(bars[0].timestamp * 1000).toISOString();
                const endTime = new Date(bars[bars.length - 1].timestamp * 1000).toISOString();

                const data = await apiClient.getCVD(symbol, timeframe, startTime, endTime);
                setCvdData(data);
            } catch (err) {
                console.error('Failed to fetch CVD data', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCVD();
    }, [symbol, timeframe, bars]);

    return { cvdData, isLoading };
}
