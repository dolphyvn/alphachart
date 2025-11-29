'use client';

import React, { useRef, useEffect, useState } from 'react';
// import { ChartCanvas } from './ChartCanvas';
import { TVChart } from './TVChart';
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
    footprint?: any[];
    cvd?: any[];
    theme?: 'light' | 'dark';
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
    bars,
    indicators = [],
    drawings = [],
    activeTool = 'cursor',
    onAddDrawing,
    onUpdateDrawing,
    volumeProfile = [],
    footprint = [],
    cvd = [],
    theme = 'light'
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
                TradeFlow Pro Chart (Lightweight Charts)
            </div>
            {/* <ChartCanvas
                bars={bars}
                indicators={indicators}
                drawings={drawings}
                activeTool={activeTool}
                onAddDrawing={onAddDrawing}
                onUpdateDrawing={onUpdateDrawing}
                volumeProfile={volumeProfile}
                footprint={footprint}
                cvd={cvd}
                width={dimensions.width}
                height={dimensions.height}
                theme={theme}
            /> */}
            <TVChart
                bars={bars}
                cvd={cvd}
                theme={theme}
            />
        </div>
    );
};
