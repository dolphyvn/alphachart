import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface VolumeProfileLevel {
    price: number;
    volume: number;
    bid_volume: number;
    ask_volume: number;
}

export function useVolumeProfile(symbol: string, bars: any[]) {
    const [profile, setProfile] = useState<VolumeProfileLevel[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (bars.length === 0) return;

            setIsLoading(true);
            try {
                // Get profile for visible range
                const startTime = new Date(bars[0].timestamp * 1000).toISOString();
                const endTime = new Date(bars[bars.length - 1].timestamp * 1000).toISOString();

                const data = await apiClient.getVolumeProfile(symbol, startTime, endTime);
                setProfile(data);
            } catch (err) {
                console.error('Failed to fetch volume profile', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [symbol, bars]);

    return { profile, isLoading };
}
