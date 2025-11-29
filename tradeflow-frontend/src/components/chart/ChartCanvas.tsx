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
    cvd?: any[];
    width: number;
    height: number;
    theme?: 'light' | 'dark';
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
    cvd = [],
    width,
    height,
    theme = 'light'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<ChartRenderer | null>(null);

    const isDragging = useRef(false);
    const dragTarget = useRef<'chart' | 'timeAxis' | 'priceAxis'>('chart');
    const lastX = useRef(0);
    const lastY = useRef(0);
    const currentDrawingId = useRef<string | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        if (!rendererRef.current) {
            rendererRef.current = new ChartRenderer(canvasRef.current, width, height, theme);
        } else {
            rendererRef.current.resize(width, height);
            rendererRef.current.setTheme(theme);
        }

        rendererRef.current.render(bars, indicators, drawings, volumeProfile, footprint, cvd);

    }, [bars, indicators, drawings, volumeProfile, footprint, cvd, width, height, theme]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!rendererRef.current) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const layout = rendererRef.current.getLayout();

        if (activeTool === 'cursor') {
            isDragging.current = true;
            lastX.current = e.clientX;
            lastY.current = e.clientY;

            // Hit test for axes
            if (x >= layout.priceAxisMainArea.x && x <= layout.priceAxisMainArea.x + layout.priceAxisMainArea.w) {
                dragTarget.current = 'priceAxis';
            } else if (y >= layout.timeAxisArea.y && y <= layout.timeAxisArea.y + layout.timeAxisArea.h) {
                dragTarget.current = 'timeAxis';
            } else {
                dragTarget.current = 'chart';
            }
        } else {
            // Start Drawing
            const point = rendererRef.current.getLogicalCoordinates(x, y, bars);
            const id = Math.random().toString(36).substr(2, 9);
            const newDrawing: Drawing = {
                id,
                type: activeTool as Drawing['type'],
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
                const dy = e.clientY - lastY.current;

                if (dragTarget.current === 'chart') {
                    const timeScale = rendererRef.current.getTimeScale();
                    timeScale.setOffset(timeScale.getOffset() - dx);
                } else if (dragTarget.current === 'timeAxis') {
                    const timeScale = rendererRef.current.getTimeScale();
                    // Zoom time scale
                    const zoomFactor = dx > 0 ? 1.02 : 0.98;
                    const newSpacing = Math.max(1, Math.min(100, timeScale.getBarSpacing() * (Math.abs(dx) > 0 ? (dx > 0 ? 1.05 : 0.95) : 1)));
                    timeScale.setBarSpacing(newSpacing);
                } else if (dragTarget.current === 'priceAxis') {
                    const priceScale = rendererRef.current.getPriceScale();
                    const currentScale = priceScale.getScale();
                    // Zoom price scale based on dy
                    // Dragging down (dy > 0) zooms out (decreases scale)
                    // Dragging up (dy < 0) zooms in (increases scale)
                    const zoomFactor = dy > 0 ? 0.95 : 1.05;
                    priceScale.setScale(currentScale * zoomFactor);
                }

                lastX.current = e.clientX;
                lastY.current = e.clientY;
                rendererRef.current.render(bars, indicators, drawings, volumeProfile, footprint, cvd);
            } else {
                // Hover effect for axes
                const layout = rendererRef.current.getLayout();
                if (x >= layout.priceAxisMainArea.x || y >= layout.timeAxisArea.y) {
                    canvasRef.current!.style.cursor = x >= layout.priceAxisMainArea.x ? 'ns-resize' : 'ew-resize';
                } else {
                    canvasRef.current!.style.cursor = 'crosshair';
                }
            }
        } else {
            if (currentDrawingId.current && onUpdateDrawing) {
                const point = rendererRef.current.getLogicalCoordinates(x, y, bars);
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
        dragTarget.current = 'chart';
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
        currentDrawingId.current = null;
        dragTarget.current = 'chart';
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (rendererRef.current) {
            const timeScale = rendererRef.current.getTimeScale();
            const newSpacing = Math.max(1, Math.min(100, timeScale.getBarSpacing() * (e.deltaY < 0 ? 1.1 : 0.9)));
            timeScale.setBarSpacing(newSpacing);
            rendererRef.current.render(bars, indicators, drawings, volumeProfile, footprint, cvd);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            className={`block w-full h-full`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
        />
    );
};
