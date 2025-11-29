import { Bar, Indicator, Drawing } from '@/types/chart';
import { PriceScale, TimeScale } from './scales';

export class ChartRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private priceScale: PriceScale;
    private timeScale: TimeScale;

    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.width = width;
        this.height = height;

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.priceScale = new PriceScale(height);
        this.timeScale = new TimeScale(width);
    }

    getTimeScale() {
        return this.timeScale;
    }

    getLogicalCoordinates(x: number, y: number, bars: Bar[]) {
        const index = Math.round(this.timeScale.xToIndex(x));
        const price = this.priceScale.yToPrice(y);

        let timestamp = 0;
        if (index >= 0 && index < bars.length) {
            timestamp = bars[index].timestamp;
        } else if (bars.length > 0) {
            // Extrapolate
            const lastBar = bars[bars.length - 1];
            const diff = index - (bars.length - 1);
            // Assuming 1s bars for now, ideally use timeframe
            timestamp = lastBar.timestamp + diff;
        }

        return { timestamp, price };
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

        this.priceScale = new PriceScale(height);
        // TimeScale width update if needed
    }

    render(bars: Bar[], indicators: Indicator[], drawings: Drawing[]) {
        // Update Price Scale based on visible bars
        if (bars.length > 0) {
            const min = Math.min(...bars.map(b => b.low));
            const max = Math.max(...bars.map(b => b.high));
            this.priceScale.setRange(min, max);
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw grid
        this.drawGrid();

        // Draw candlesticks
        this.drawCandlesticks(bars);

        // Draw indicators
        this.drawIndicators(bars, indicators);

        // Draw drawings
        this.drawDrawings(bars, drawings);
    }

    private drawDrawings(bars: Bar[], drawings: Drawing[]) {
        drawings.forEach(drawing => {
            if (drawing.points.length === 0) return;

            this.ctx.strokeStyle = drawing.color;
            this.ctx.lineWidth = drawing.lineWidth;
            this.ctx.fillStyle = drawing.color; // For handles

            const screenPoints = drawing.points.map(p => {
                // Find closest bar index for timestamp
                // Optimization: Binary search would be better for large datasets
                const index = bars.findIndex(b => Math.abs(b.timestamp - p.timestamp) < 1); // Exact match or close enough
                // If not found (e.g. future timestamp), we might need to extrapolate index
                // For now, let's assume it exists or use linear interpolation if we had a proper time axis

                // Fallback: estimate index based on time difference from last bar if not found
                let estimatedIndex = index;
                if (index === -1 && bars.length > 0) {
                    const lastBar = bars[bars.length - 1];
                    const timeDiff = p.timestamp - lastBar.timestamp;
                    // Assuming 1s bars for now, but should use chart timeframe
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

            // Draw handles if selected
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
            if (!indicator.overlay) return; // Skip non-overlay indicators for now

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
            // Find matching indicator data
            // Assuming both are sorted, but for safety we find by timestamp
            // Optimization: could use a map or index tracking if performance is an issue
            const point = indicator.data.find(d => Math.abs(d.timestamp - bar.timestamp) < 1); // 1s tolerance

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
        // Draw Upper, Middle, Lower
        const lines = ['upper', 'middle', 'lower'];

        lines.forEach(line => {
            this.ctx.beginPath();
            let started = false;
            // Make middle line solid, others slightly thinner or dashed?
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
        this.ctx.setLineDash([]); // Reset
    }

    private drawGrid() {
        this.ctx.strokeStyle = '#e5e7eb'; // Tailwind gray-200
        this.ctx.lineWidth = 0.5;

        // Draw horizontal lines (price)
        for (let i = 1; i < 5; i++) {
            const y = (this.height / 5) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }

        // Draw vertical lines (time)
        for (let i = 1; i < 5; i++) {
            const x = (this.width / 5) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
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
