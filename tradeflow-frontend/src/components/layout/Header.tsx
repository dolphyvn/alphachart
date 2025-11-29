import React from 'react';

interface HeaderProps {
    symbol: string;
    onSymbolChange: (s: string) => void;
    timeframe: string;
    onTimeframeChange: (t: string) => void;
    onAddIndicator: (type: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
    symbol, onSymbolChange, timeframe, onTimeframeChange, onAddIndicator
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
        </header>
    );
};
