'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { Bar } from '@/types/chart';

interface TVChartProps {
    bars: Bar[];
    cvd?: any[];
    theme?: 'light' | 'dark';
    width?: number;
    height?: number;
}

export const TVChart: React.FC<TVChartProps> = ({
    bars,
    cvd = [],
    theme = 'light',
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const cvdSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    // Colors based on theme
    const colors = theme === 'dark' ? {
        background: '#131722',
        text: '#d1d4dc',
        grid: '#2a2e39',
        candleUp: '#089981',
        candleDown: '#f23645',
        cvdColor: '#f59e0b'
    } : {
        background: '#ffffff',
        text: '#333333',
        grid: '#e5e7eb',
        candleUp: '#22c55e',
        candleDown: '#ef4444',
        cvdColor: '#f59e0b'
    };

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        // Initialize Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: colors.background },
                textColor: colors.text,
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            timeScale: {
                timeVisible: true,
                secondsVisible: true,
            },
        });

        chartRef.current = chart;

        // Main Candlestick Series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: colors.candleUp,
            downColor: colors.candleDown,
            borderVisible: false,
            wickUpColor: colors.candleUp,
            wickDownColor: colors.candleDown,
        });
        candleSeriesRef.current = candleSeries;

        // CVD Series (Line) - Placed at bottom using separate scale
        const cvdSeries = chart.addSeries(LineSeries, {
            color: colors.cvdColor,
            lineWidth: 2,
            priceScaleId: 'cvd', // Separate scale
            priceFormat: {
                type: 'volume',
            },
        });
        cvdSeriesRef.current = cvdSeries;

        // Configure Scales to create "panes"
        chart.priceScale('right').applyOptions({
            scaleMargins: {
                top: 0.05,
                bottom: 0.25, // Leave space for CVD
            },
        });

        chart.priceScale('cvd').applyOptions({
            scaleMargins: {
                top: 0.8, // Start at 80% height
                bottom: 0,
            },
        });

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []); // Run once on mount

    // Update Data and Theme
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current || !cvdSeriesRef.current) return;

        // Update Theme Options
        chartRef.current.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: colors.background },
                textColor: colors.text,
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
        });

        candleSeriesRef.current.applyOptions({
            upColor: colors.candleUp,
            downColor: colors.candleDown,
            wickUpColor: colors.candleUp,
            wickDownColor: colors.candleDown,
        });

        // Map Data
        // Lightweight charts expects time in seconds (UTCTimestamp)
        const candleData = bars.map(bar => ({
            time: bar.timestamp as Time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        }));

        // Sort data by time just in case
        candleData.sort((a, b) => (a.time as number) - (b.time as number));
        candleSeriesRef.current.setData(candleData);

        // Map CVD Data
        if (cvd.length > 0) {
            const cvdData = cvd.map(c => ({
                time: (new Date(c.time).getTime() / 1000) as Time,
                value: c.cumulative_delta
            }));
            cvdData.sort((a, b) => (a.time as number) - (b.time as number));
            cvdSeriesRef.current.setData(cvdData);
        }

    }, [bars, cvd, theme, colors]);

    return (
        <div ref={chartContainerRef} className="w-full h-full" />
    );
};
