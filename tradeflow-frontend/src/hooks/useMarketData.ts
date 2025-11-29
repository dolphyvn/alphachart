import { useState, useEffect, useCallback } from 'react';
import { apiClient, BarData } from '@/lib/api/client';
import { wsClient } from '@/lib/api/websocket';
import { Bar } from '@/types/chart';

export function useMarketData(symbol: string, timeframe: string) {
    const [bars, setBars] = useState<Bar[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch historical data
    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const data = await apiClient.getBars(symbol, timeframe);
                // Convert API data to internal Bar format
                const formattedBars: Bar[] = data.map(b => ({
                    timestamp: new Date(b.timestamp).getTime() / 1000, // Convert ISO to unix timestamp (seconds)
                    open: b.open,
                    high: b.high,
                    low: b.low,
                    close: b.close,
                    volume: b.volume
                })).reverse(); // Ensure chronological order (oldest first)

                setBars(formattedBars);
                setError(null);
            } catch (err) {
                console.error(err);
                setError('Failed to load market data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [symbol, timeframe]);

    // Handle real-time updates
    useEffect(() => {
        wsClient.connect();
        wsClient.subscribe([symbol]);

        const handleMessage = (message: any) => {
            if (message.type === 'tick' && message.symbol === symbol) {
                const tick = message.data;
                setBars(prevBars => {
                    if (prevBars.length === 0) return prevBars;

                    const lastBar = prevBars[prevBars.length - 1];
                    const tickTime = new Date(tick.timestamp).getTime() / 1000;

                    // Check if tick belongs to current bar or new bar
                    // This logic depends on timeframe. For simplicity assuming 1m timeframe alignment
                    // In a real app, we need robust timeframe logic

                    // Simple update logic: if tick is newer than last bar + timeframe, create new bar
                    // Otherwise update last bar

                    // For now, let's just update the last bar's close, high, low, volume
                    // This is a simplification. Real logic needs to handle bar closing.

                    const updatedBar = {
                        ...lastBar,
                        close: tick.price,
                        high: Math.max(lastBar.high, tick.price),
                        low: Math.min(lastBar.low, tick.price),
                        volume: lastBar.volume + (tick.volume || 0)
                    };

                    return [...prevBars.slice(0, -1), updatedBar];
                });
            }
        };

        wsClient.addMessageHandler(handleMessage);

        return () => {
            wsClient.unsubscribe([symbol]);
            wsClient.removeMessageHandler(handleMessage);
        };
    }, [symbol]);

    return { bars, isLoading, error };
}
