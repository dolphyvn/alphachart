import { Bar, Indicator, Drawing } from '@/types/chart';
import { PriceScale, TimeScale } from './scales';

export interface ChartTheme {
    background: string;
    text: string;
    grid: string;
    crosshair: string;
    candleUp: string;
    candleDown: string;
    wickUp: string;
    wickDown: string;
    volumeUp: string;
    volumeDown: string;
}

export const THEMES: Record<string, ChartTheme> = {
    light: {
        background: '#ffffff',
        text: '#333333',
        grid: '#e5e7eb',
        crosshair: '#9ca3af',
        candleUp: '#22c55e',
        candleDown: '#ef4444',
        wickUp: '#22c55e',
        wickDown: '#ef4444',
        volumeUp: 'rgba(34, 197, 94, 0.3)',
        volumeDown: 'rgba(239, 68, 68, 0.3)'
    },
    dark: {
        background: '#131722',
        text: '#d1d4dc',
        grid: '#2a2e39',
        crosshair: '#787b86',
        candleUp: '#089981',
        candleDown: '#f23645',
        wickUp: '#089981',
        wickDown: '#f23645',
        volumeUp: 'rgba(8, 153, 129, 0.3)',
        volumeDown: 'rgba(242, 54, 69, 0.3)'
    }
};

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export class ChartRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private priceScale: PriceScale;
    private timeScale: TimeScale;
    private theme: ChartTheme = THEMES.light;

    // Layout
    private mainArea: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private cvdArea: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private timeAxisArea: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private priceAxisMainArea: Rect = { x: 0, y: 0, w: 0, h: 0 };
    private priceAxisCVDArea: Rect = { x: 0, y: 0, w: 0, h: 0 };

    private readonly PRICE_AXIS_WIDTH = 60;
    private readonly TIME_AXIS_HEIGHT = 30;
    private readonly CVD_HEIGHT_RATIO = 0.2;

    constructor(canvas: HTMLCanvasElement, width: number, height: number, themeName: string = 'light') {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.width = width;
        this.height = height;
        this.setTheme(themeName);

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.calculateLayout();
        this.priceScale = new PriceScale(this.mainArea.h);
        this.timeScale = new TimeScale(this.mainArea.w);
    }

    setTheme(name: string) {
        this.theme = THEMES[name] || THEMES.light;
    }

    getTimeScale() {
        return this.timeScale;
    }

    getPriceScale() {
        return this.priceScale;
    }

    getLayout() {
        return {
            mainArea: this.mainArea,
            cvdArea: this.cvdArea,
            timeAxisArea: this.timeAxisArea,
            priceAxisMainArea: this.priceAxisMainArea,
            priceAxisCVDArea: this.priceAxisCVDArea
        };
    }

    private calculateLayout() {
        const chartW = this.width - this.PRICE_AXIS_WIDTH;
        const chartH = this.height - this.TIME_AXIS_HEIGHT;

        const cvdH = chartH * this.CVD_HEIGHT_RATIO;
        const mainH = chartH - cvdH;

        this.mainArea = { x: 0, y: 0, w: chartW, h: mainH };
        this.cvdArea = { x: 0, y: mainH, w: chartW, h: cvdH };

        this.priceAxisMainArea = { x: chartW, y: 0, w: this.PRICE_AXIS_WIDTH, h: mainH };
        this.priceAxisCVDArea = { x: chartW, y: mainH, w: this.PRICE_AXIS_WIDTH, h: cvdH };

        this.timeAxisArea = { x: 0, y: chartH, w: chartW, h: this.TIME_AXIS_HEIGHT };
    }

    getLogicalCoordinates(x: number, y: number, bars: Bar[]) {
        // Check if in main area
        if (x >= this.mainArea.x && x <= this.mainArea.x + this.mainArea.w &&
            y >= this.mainArea.y && y <= this.mainArea.y + this.mainArea.h) {
            const index = Math.round(this.timeScale.xToIndex(x));
            const price = this.priceScale.yToPrice(y);

            let timestamp = 0;
            if (index >= 0 && index < bars.length) {
                timestamp = bars[index].timestamp;
            } else if (bars.length > 0) {
                const lastBar = bars[bars.length - 1];
                const diff = index - (bars.length - 1);
                timestamp = lastBar.timestamp + diff; // Approx
            }
            return { timestamp, price };
        }
        return { timestamp: 0, price: 0 };
    }

    resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.calculateLayout();
        this.priceScale = new PriceScale(this.mainArea.h);
        this.timeScale = new TimeScale(this.mainArea.w);
    }

    private autoScale: boolean = true;

    // ... (existing properties)

    setAutoScale(enabled: boolean) {
        this.autoScale = enabled;
    }

    shiftPriceScale(dy: number) {
        this.autoScale = false;
        const range = this.priceScale.getMaxPrice() - this.priceScale.getMinPrice();
        const priceDelta = (dy / this.mainArea.h) * range;
        this.priceScale.setRange(
            this.priceScale.getMinPrice() + priceDelta,
            this.priceScale.getMaxPrice() + priceDelta
        );
    }

    render(bars: Bar[], indicators: Indicator[], drawings: Drawing[], volumeProfile?: any[], footprint?: any[], cvd?: any[]) {
        // Update Price Scale based on visible bars ONLY if autoScale is true
        if (this.autoScale && bars.length > 0) {
            const min = Math.min(...bars.map(b => b.low));
            const max = Math.max(...bars.map(b => b.high));
            this.priceScale.setRange(min, max);
        }

        // Clear canvas with theme background
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // --- Main Chart Area ---
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.mainArea.x, this.mainArea.y, this.mainArea.w, this.mainArea.h);
        this.ctx.clip();

        this.drawGrid(this.mainArea);

        if (volumeProfile && volumeProfile.length > 0) {
            this.drawVolumeProfile(volumeProfile);
        }

        if (footprint && footprint.length > 0) {
            this.drawFootprint(bars, footprint);
        } else {
            this.drawCandlesticks(bars);
        }

        this.drawIndicators(bars, indicators);
        this.drawDrawings(bars, drawings);

        this.ctx.restore();

        // --- CVD Area ---
        // Always draw CVD area background and separator to show layout
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.cvdArea.x, this.cvdArea.y, this.cvdArea.w, this.cvdArea.h);
        this.ctx.clip();

        // Draw separator
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.theme.grid;
        this.ctx.moveTo(this.cvdArea.x, this.cvdArea.y);
        this.ctx.lineTo(this.cvdArea.x + this.cvdArea.w, this.cvdArea.y);
        this.ctx.stroke();

        if (cvd && cvd.length > 0) {
            this.drawCVD(bars, cvd);
        }
        this.ctx.restore();

        // --- Axes ---
        this.drawTimeAxis(bars);
        this.drawPriceAxis(this.priceAxisMainArea, this.priceScale);

        // Draw CVD Price Axis
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(this.priceAxisCVDArea.x, this.priceAxisCVDArea.y, this.priceAxisCVDArea.w, this.priceAxisCVDArea.h);
        this.ctx.strokeStyle = this.theme.grid;
        this.ctx.strokeRect(this.priceAxisCVDArea.x, this.priceAxisCVDArea.y, this.priceAxisCVDArea.w, this.priceAxisCVDArea.h);
    }

    private drawTimeAxis(bars: Bar[]) {
        const area = this.timeAxisArea;
        this.ctx.save();
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(area.x, area.y, area.w, area.h);

        this.ctx.strokeStyle = this.theme.grid;
        this.ctx.beginPath();
        this.ctx.moveTo(area.x, area.y);
        this.ctx.lineTo(area.x + area.w, area.y);
        this.ctx.stroke();

        this.ctx.fillStyle = this.theme.text;
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        // Draw time labels
        // Simple implementation: every N pixels
        const pixelStep = 100;
        for (let x = 0; x < area.w; x += pixelStep) {
            const index = Math.round(this.timeScale.xToIndex(x));
            if (index >= 0 && index < bars.length) {
                const date = new Date(bars[index].timestamp * 1000);
                const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                this.ctx.fillText(label, x, area.y + 5);
            }
        }
        this.ctx.restore();
    }

    private drawPriceAxis(area: Rect, scale: PriceScale) {
        this.ctx.save();
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(area.x, area.y, area.w, area.h);

        this.ctx.strokeStyle = this.theme.grid;
        this.ctx.beginPath();
        this.ctx.moveTo(area.x, area.y);
        this.ctx.lineTo(area.x, area.y + area.h);
        this.ctx.stroke();

        this.ctx.fillStyle = this.theme.text;
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

        // Draw price labels
        // Simple implementation: 5 labels
        for (let i = 1; i < 5; i++) {
            const y = (area.h / 5) * i;
            const price = scale.yToPrice(y);
            this.ctx.fillText(price.toFixed(2), area.x + 5, area.y + y);
        }
        this.ctx.restore();
    }

    private drawCVD(bars: Bar[], cvd: any[]) {
        const area = this.cvdArea;
        const cvdHeight = area.h;

        const minCVD = Math.min(...cvd.map(c => c.cumulative_delta));
        const maxCVD = Math.max(...cvd.map(c => c.cumulative_delta));
        const range = maxCVD - minCVD || 1;

        const cvdY = (val: number) => {
            return area.y + cvdHeight - ((val - minCVD) / range) * cvdHeight;
        };

        this.ctx.beginPath();
        this.ctx.strokeStyle = '#f59e0b'; // Amber-500
        this.ctx.lineWidth = 2;

        let started = false;
        bars.forEach((bar, index) => {
            const x = this.timeScale.indexToX(index);
            // Clip X
            if (x < area.x || x > area.x + area.w) return;

            const point = cvd.find(c => Math.abs(new Date(c.time).getTime() - bar.timestamp * 1000) < 1000);

            if (point) {
                const y = cvdY(point.cumulative_delta);
                if (!started) {
                    this.ctx.moveTo(x, y);
                    started = true;
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        });
        this.ctx.stroke();

        // Draw zero line
        if (minCVD < 0 && maxCVD > 0) {
            const yZero = cvdY(0);
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.theme.crosshair;
            this.ctx.setLineDash([4, 4]);
            this.ctx.moveTo(area.x, yZero);
            this.ctx.lineTo(area.x + area.w, yZero);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    private drawFootprint(bars: Bar[], footprint: any[]) {
        const barSpacing = this.timeScale.getBarSpacing();
        const barWidth = barSpacing * 0.8;

        if (barWidth < 20) {
            this.drawCandlesticks(bars);
            return;
        }

        bars.forEach((bar, index) => {
            const x = this.timeScale.indexToX(index);
            if (x < this.mainArea.x - barWidth || x > this.mainArea.x + this.mainArea.w + barWidth) return;

            const barData = footprint.find(f => Math.abs(new Date(f.time).getTime() - bar.timestamp * 1000) < 1000);

            if (!barData) {
                this.drawCandle(bar, x, barWidth);
                return;
            }

            const yHigh = this.priceScale.priceToY(bar.high);
            const yLow = this.priceScale.priceToY(bar.low);
            const yOpen = this.priceScale.priceToY(bar.open);
            const yClose = this.priceScale.priceToY(bar.close);
            const isGreen = bar.close >= bar.open;

            this.ctx.strokeStyle = isGreen ? this.theme.candleUp : this.theme.candleDown;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - barWidth / 2, Math.min(yOpen, yClose), barWidth, Math.abs(yClose - yOpen));

            this.ctx.beginPath();
            this.ctx.moveTo(x, yHigh);
            this.ctx.lineTo(x, Math.min(yOpen, yClose));
            this.ctx.moveTo(x, Math.max(yOpen, yClose));
            this.ctx.lineTo(x, yLow);
            this.ctx.stroke();

            barData.levels.forEach((level: any) => {
                const y = this.priceScale.priceToY(level.price);
                const totalVol = level.bid_volume + level.ask_volume;
                if (totalVol === 0) return;

                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';

                this.ctx.fillStyle = this.theme.candleDown;
                this.ctx.fillText(Math.round(level.bid_volume).toString(), x - barWidth / 4, y);

                this.ctx.fillStyle = this.theme.candleUp;
                this.ctx.fillText(Math.round(level.ask_volume).toString(), x + barWidth / 4, y);
            });
        });
    }

    private drawCandle(bar: Bar, x: number, barWidth: number) {
        const yHigh = this.priceScale.priceToY(bar.high);
        const yLow = this.priceScale.priceToY(bar.low);
        const yOpen = this.priceScale.priceToY(bar.open);
        const yClose = this.priceScale.priceToY(bar.close);

        const isGreen = bar.close >= bar.open;
        this.ctx.fillStyle = isGreen ? this.theme.candleUp : this.theme.candleDown;
        this.ctx.strokeStyle = isGreen ? this.theme.wickUp : this.theme.wickDown;

        this.ctx.beginPath();
        this.ctx.moveTo(x, yHigh);
        this.ctx.lineTo(x, yLow);
        this.ctx.stroke();

        const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
        const bodyTop = Math.min(yOpen, yClose);
        this.ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    }

    private drawVolumeProfile(profile: any[]) {
        if (profile.length === 0) return;

        const maxVolume = Math.max(...profile.map(p => p.volume));
        const profileWidth = this.mainArea.w * 0.15;

        this.ctx.save();

        profile.forEach(level => {
            const y = this.priceScale.priceToY(level.price);
            const barWidth = (level.volume / maxVolume) * profileWidth;

            if (level.bid_volume > 0) {
                const bidWidth = (level.bid_volume / level.volume) * barWidth;
                this.ctx.fillStyle = this.theme.volumeUp;
                this.ctx.fillRect(this.mainArea.w - profileWidth, y - 2, bidWidth, 4);
            }

            if (level.ask_volume > 0) {
                const askWidth = (level.ask_volume / level.volume) * barWidth;
                const bidWidth = (level.bid_volume / level.volume) * barWidth;
                this.ctx.fillStyle = this.theme.volumeDown;
                this.ctx.fillRect(this.mainArea.w - profileWidth + bidWidth, y - 2, askWidth, 4);
            }
        });

        this.ctx.restore();
    }

    private drawDrawings(bars: Bar[], drawings: Drawing[]) {
        drawings.forEach(drawing => {
            if (drawing.points.length === 0) return;

            this.ctx.strokeStyle = drawing.color;
            this.ctx.lineWidth = drawing.lineWidth;
            this.ctx.fillStyle = drawing.color;

            const screenPoints = drawing.points.map(p => {
                const index = bars.findIndex(b => Math.abs(b.timestamp - p.timestamp) < 1);
                let estimatedIndex = index;
                if (index === -1 && bars.length > 0) {
                    const lastBar = bars[bars.length - 1];
                    const timeDiff = p.timestamp - lastBar.timestamp;
                    estimatedIndex = bars.length - 1 + Math.round(timeDiff);
                }

                return {
                    x: this.timeScale.indexToX(estimatedIndex),
                    y: this.priceScale.priceToY(p.price)
                };
            });

            this.ctx.beginPath();
            if (drawing.type === 'line' && screenPoints.length >= 2) {
                this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
                this.ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
            } else if (drawing.type === 'rect' && screenPoints.length >= 2) {
                const x = screenPoints[0].x;
                const y = screenPoints[0].y;
                const w = screenPoints[1].x - x;
                const h = screenPoints[1].y - y;
                this.ctx.strokeRect(x, y, w, h);
            }

            this.ctx.stroke();

            if (drawing.selected) {
                screenPoints.forEach(p => {
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                });
            }
        });
    }

    private drawIndicators(bars: Bar[], indicators: Indicator[]) {
        indicators.forEach(indicator => {
            if (!indicator.overlay) return;

            this.ctx.strokeStyle = indicator.color;
            this.ctx.lineWidth = 1.5;

            if (indicator.type === 'BOLLINGER') {
                this.drawBollingerBands(bars, indicator);
            } else {
                this.drawLineIndicator(bars, indicator);
            }
        });
    }

    private drawLineIndicator(bars: Bar[], indicator: Indicator) {
        this.ctx.beginPath();
        let started = false;

        bars.forEach((bar, index) => {
            const point = indicator.data.find(d => Math.abs(d.timestamp - bar.timestamp) < 1);

            if (point && typeof point.value === 'number') {
                const x = this.timeScale.indexToX(index);
                const y = this.priceScale.priceToY(point.value);

                if (!started) {
                    this.ctx.moveTo(x, y);
                    started = true;
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        });

        this.ctx.stroke();
    }

    private drawBollingerBands(bars: Bar[], indicator: Indicator) {
        const lines = ['upper', 'middle', 'lower'];

        lines.forEach(line => {
            this.ctx.beginPath();
            let started = false;
            this.ctx.setLineDash(line === 'middle' ? [] : [2, 2]);

            bars.forEach((bar, index) => {
                const point = indicator.data.find(d => Math.abs(d.timestamp - bar.timestamp) < 1);

                if (point && typeof point.value === 'object' && point.value[line] !== undefined) {
                    const x = this.timeScale.indexToX(index);
                    const y = this.priceScale.priceToY(point.value[line]);

                    if (!started) {
                        this.ctx.moveTo(x, y);
                        started = true;
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                }
            });
            this.ctx.stroke();
        });
        this.ctx.setLineDash([]);
    }

    private drawGrid(area: Rect) {
        this.ctx.strokeStyle = this.theme.grid;
        this.ctx.lineWidth = 0.5;

        for (let i = 1; i < 5; i++) {
            const y = (area.h / 5) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(area.x, area.y + y);
            this.ctx.lineTo(area.x + area.w, area.y + y);
            this.ctx.stroke();
        }

        for (let i = 1; i < 5; i++) {
            const x = (area.w / 5) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(area.x + x, area.y);
            this.ctx.lineTo(area.x + x, area.y + area.h);
            this.ctx.stroke();
        }
    }

    private drawCandlesticks(bars: Bar[]) {
        const barSpacing = this.timeScale.getBarSpacing();
        const barWidth = barSpacing * 0.8;

        bars.forEach((bar, index) => {
            const x = this.timeScale.indexToX(index);

            // Skip if out of view
            if (x < -barWidth || x > this.width + barWidth) return;

            const yHigh = this.priceScale.priceToY(bar.high);
            const yLow = this.priceScale.priceToY(bar.low);
            const yOpen = this.priceScale.priceToY(bar.open);
            const yClose = this.priceScale.priceToY(bar.close);

            const isGreen = bar.close >= bar.open;
            this.ctx.fillStyle = isGreen ? '#22c55e' : '#ef4444'; // Tailwind green-500 : red-500
            this.ctx.strokeStyle = isGreen ? '#22c55e' : '#ef4444';

            // Wick
            this.ctx.beginPath();
            this.ctx.moveTo(x, yHigh);
            this.ctx.lineTo(x, yLow);
            this.ctx.stroke();

            // Body
            const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
            const bodyTop = Math.min(yOpen, yClose);
            this.ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
        });
    }
}
