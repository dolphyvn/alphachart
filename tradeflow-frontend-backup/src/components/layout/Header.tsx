import React from 'react';
import { Indicator } from '@/types/chart';
import { DrawingTool } from '@/hooks/useDrawings';

interface HeaderProps {
    symbol: string;
    onSymbolChange: (s: string) => void;
    timeframe: string;
    onTimeframeChange: (t: string) => void;
    onAddIndicator: (type: Indicator['type']) => void;
    activeTool: DrawingTool;
    onToolChange: (tool: DrawingTool) => void;
}

export const Header: React.FC<HeaderProps> = ({
    symbol, onSymbolChange, timeframe, onTimeframeChange, onAddIndicator,
    activeTool, onToolChange
}) => {
    const timeframes = ['1s', '1m', '5m', '15m', '1h', '4h', '1d'];
    const symbols = ['XAUUSD', 'BTCUSD', 'EURUSD', 'ETHUSD'];

    return (
        <header className="flex items-center h-14 px-4 border-b bg-background border-border gap-4">
            <div className="font-bold text-lg mr-4 text-primary">TradeFlow</div>

            {/* Symbol Search */}
            <div className="relative">
                <select
                    value={symbol}
                    onChange={(e) => onSymbolChange(e.target.value)}
                    className="h-8 px-2 bg-muted rounded border border-input text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                >
                    {symbols.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="w-px h-6 bg-border mx-2" />

            {/* Timeframes */}
            <div className="flex items-center gap-1">
                {timeframes.map(tf => (
                    <button
                        key={tf}
                        onClick={() => onTimeframeChange(tf)}
                        className={`px-2 py-1 text-xs font-medium rounded hover:bg-muted transition-colors ${timeframe === tf ? 'text-primary bg-muted' : 'text-muted-foreground'}`}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            <div className="w-px h-6 bg-border mx-2" />

            {/* Indicators */}
            <div className="flex items-center gap-2">
                <button onClick={() => onAddIndicator('SMA')} className="px-3 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded transition-colors">
                    + SMA
                </button>
                <button onClick={() => onAddIndicator('EMA')} className="px-3 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded transition-colors">
                    + EMA
                </button>
                <button onClick={() => onAddIndicator('BOLLINGER')} className="px-3 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded transition-colors">
                    + BB
                </button>
            </div>

            <div className="w-px h-6 bg-border mx-2" />

            {/* Drawing Tools */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onToolChange('cursor')}
                    className={`p-1.5 rounded hover:bg-muted ${activeTool === 'cursor' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
                    title="Cursor"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="m13 13 6 6" /></svg>
                </button>
                <button
                    onClick={() => onToolChange('line')}
                    className={`p-1.5 rounded hover:bg-muted ${activeTool === 'line' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
                    title="Trend Line"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5" /></svg>
                </button>
                <button
                    onClick={() => onToolChange('rect')}
                    className={`p-1.5 rounded hover:bg-muted ${activeTool === 'rect' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
                    title="Rectangle"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
                </button>
            </div>
        </header>
    );
};
