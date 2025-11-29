'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ChartCanvas } from './ChartCanvas';
import { Bar } from '@/types/chart';

interface ChartContainerProps {
    bars: Bar[];
}

export const ChartContainer: React.FC<ChartContainerProps> = ({ bars }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial size

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full min-h-[500px] bg-background border rounded-lg overflow-hidden relative">
            <div className="absolute top-4 left-4 z-10 text-sm font-medium text-muted-foreground">
                TradeFlow Pro Chart
            </div>
            <ChartCanvas bars={bars} width={dimensions.width} height={dimensions.height} />
        </div>
    );
};
