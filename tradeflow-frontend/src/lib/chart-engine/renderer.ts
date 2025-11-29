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
