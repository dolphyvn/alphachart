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

    const isDragging = useRef(false);
    const lastX = useRef(0);

    useEffect(() => {
        if (!canvasRef.current) return;

        if (!rendererRef.current) {
            rendererRef.current = new ChartRenderer(canvasRef.current, width, height);
        } else {
            rendererRef.current.resize(width, height);
        }

        rendererRef.current.render(bars, indicators, []);

    }, [bars, indicators, width, height]);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastX.current = e.clientX;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current && rendererRef.current) {
            const dx = e.clientX - lastX.current;
            const timeScale = rendererRef.current.getTimeScale();
            // Drag right -> move view left (decrease offset)
            // But wait, indexToX = index * spacing - offset
            // If we drag right (dx > 0), we want to see earlier bars (lower index).
            // So we should DECREASE offset? 
            // Let's try: offset -= dx
            timeScale.setOffset(timeScale.getOffset() - dx);
            lastX.current = e.clientX;
            rendererRef.current.render(bars, indicators, []);
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (rendererRef.current) {
            // Prevent default scrolling behavior if possible, but React synthetic events might be too late?
            // Usually need native listener for preventDefault on wheel.
            // But for now let's just update scale.

            const timeScale = rendererRef.current.getTimeScale();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Scroll down (positive) -> zoom out? Or zoom in?
            // Usually scroll up (negative) -> zoom in.
            // If deltaY < 0 (scroll up), zoomFactor = 1.1 (zoom in, bigger spacing)

            const newSpacing = Math.max(1, Math.min(100, timeScale.getBarSpacing() * (e.deltaY < 0 ? 1.1 : 0.9)));
            timeScale.setBarSpacing(newSpacing);

            rendererRef.current.render(bars, indicators, []);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            className="block cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
        />
    );
};
