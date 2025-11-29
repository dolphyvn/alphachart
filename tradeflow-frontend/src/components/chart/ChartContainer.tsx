'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ChartCanvas } from './ChartCanvas';
import { Bar, Indicator, Drawing } from '@/types/chart';
import { DrawingTool } from '@/hooks/useDrawings';

interface ChartContainerProps {
    bars: Bar[];
    indicators?: Indicator[];
    drawings?: Drawing[];
    activeTool?: DrawingTool;
    onAddDrawing?: (drawing: Drawing) => void;
    onUpdateDrawing?: (id: string, updates: Partial<Drawing>) => void;
    volumeProfile?: any[];
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
    bars,
    indicators = [],
    drawings = [],
    activeTool = 'cursor',
    onAddDrawing,
    onUpdateDrawing,
    volumeProfile = []
}) => {
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
            <ChartCanvas
                bars={bars}
                indicators={indicators}
                drawings={drawings}
                activeTool={activeTool}
                onAddDrawing={onAddDrawing}
                onUpdateDrawing={onUpdateDrawing}
                volumeProfile={volumeProfile}
                width={dimensions.width}
                height={dimensions.height}
            />
        </div>
    );
};
