'use client';

import React, { useRef, useEffect } from 'react';
import { ChartRenderer } from '@/lib/chart-engine/renderer';
import { Bar, Indicator, Drawing } from '@/types/chart';
import { DrawingTool } from '@/hooks/useDrawings';

interface ChartCanvasProps {
    bars: Bar[];
    indicators?: Indicator[];
    drawings?: Drawing[];
    activeTool?: DrawingTool;
    onAddDrawing?: (drawing: Drawing) => void;
    onUpdateDrawing?: (id: string, updates: Partial<Drawing>) => void;
    volumeProfile?: any[];
    footprint?: any[];
    width: number;
    height: number;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
    bars,
    indicators = [],
    drawings = [],
    activeTool = 'cursor',
    onAddDrawing,
    onUpdateDrawing,
    volumeProfile = [],
    footprint = [],
    width,
    height
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<ChartRenderer | null>(null);

    const isDragging = useRef(false);
    const lastX = useRef(0);
    const currentDrawingId = useRef<string | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        if (!rendererRef.current) {
            rendererRef.current = new ChartRenderer(canvasRef.current, width, height);
        } else {
            rendererRef.current.resize(width, height);
        }

        rendererRef.current.render(bars, indicators, drawings, volumeProfile, footprint);

    }, [bars, indicators, drawings, volumeProfile, footprint, width, height]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!rendererRef.current) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'cursor') {
            isDragging.current = true;
            lastX.current = e.clientX;
        } else {
            // Start Drawing
            const point = rendererRef.current.getLogicalCoordinates(x, y, bars);
            const id = Math.random().toString(36).substr(2, 9);
            const newDrawing: Drawing = {
                id,
                type: activeTool as Drawing['type'], // 'line' | 'rect' | 'circle'
                points: [point],
                color: '#2962FF',
                lineWidth: 2,
                selected: true
            };

            if (onAddDrawing) {
                onAddDrawing(newDrawing);
                currentDrawingId.current = id;
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!rendererRef.current) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'cursor') {
            if (isDragging.current) {
                const dx = e.clientX - lastX.current;
                const timeScale = rendererRef.current.getTimeScale();
                timeScale.setOffset(timeScale.getOffset() - dx);
                lastX.current = e.clientX;
                rendererRef.current.render(bars, indicators, drawings, volumeProfile, footprint);
            }
        } else {
            if (currentDrawingId.current && onUpdateDrawing) {
                const point = rendererRef.current.getLogicalCoordinates(x, y, bars);
                // Update the drawing with the new point (end point)
                // We need to know the current state of the drawing to append or update
                // For simplicity, we assume we are dragging the second point

                // We can't easily access the current drawing state here without passing it or finding it
                // But we know we just added it.

                // Actually, we need to update the points array.
                // Since we don't have the previous points here easily without looking up in `drawings`,
                // let's assume we are setting the 2nd point.

                const drawing = drawings.find(d => d.id === currentDrawingId.current);
                if (drawing) {
                    const newPoints = [drawing.points[0], point];
                    onUpdateDrawing(currentDrawingId.current, { points: newPoints });
                }
            }
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        currentDrawingId.current = null;
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
        currentDrawingId.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (rendererRef.current) {
            const timeScale = rendererRef.current.getTimeScale();
            const newSpacing = Math.max(1, Math.min(100, timeScale.getBarSpacing() * (e.deltaY < 0 ? 1.1 : 0.9)));
            timeScale.setBarSpacing(newSpacing);
            rendererRef.current.render(bars, indicators, drawings, volumeProfile, footprint);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            className={`block w-full h-full ${activeTool === 'cursor' ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
        />
    );
};
