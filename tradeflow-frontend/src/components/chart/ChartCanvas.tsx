'use client';

import React, { useRef, useEffect } from 'react';
import { ChartRenderer } from '@/lib/chart-engine/renderer';
import { Bar, Indicator } from '@/types/chart';

interface ChartCanvasProps {
    bars: Bar[];
    indicators?: Indicator[];
    width: number;
    height: number;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({ bars, indicators = [], width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<ChartRenderer | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        if (!rendererRef.current) {
            rendererRef.current = new ChartRenderer(canvasRef.current, width, height);
        } else {
            rendererRef.current.resize(width, height);
        }

        rendererRef.current.render(bars, indicators, []);

    }, [bars, indicators, width, height]);

    return (
        <canvas
            ref={canvasRef}
            className="block"
        />
    );
};
