import { useState, useCallback } from 'react';
import { Drawing } from '@/types/chart';

export type DrawingTool = 'cursor' | 'line' | 'rect' | 'circle';

export function useDrawings() {
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
    const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);

    const addDrawing = useCallback((drawing: Drawing) => {
        setDrawings(prev => [...prev, drawing]);
    }, []);

    const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
        setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    }, []);

    const removeDrawing = useCallback((id: string) => {
        setDrawings(prev => prev.filter(d => d.id !== id));
    }, []);

    return {
        drawings,
        activeTool,
        setActiveTool,
        currentDrawing,
        setCurrentDrawing,
        addDrawing,
        updateDrawing,
        removeDrawing
    };
}
