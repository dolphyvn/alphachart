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

    render(bars: Bar[], indicators: Indicator[], drawings: Drawing[], volumeProfile?: any[], footprint?: any[], cvd?: any[]) {
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

        // Draw volume profile (behind everything)
        if (volumeProfile && volumeProfile.length > 0) {
            this.drawVolumeProfile(volumeProfile);
        }

        // Draw footprint (replaces candlesticks if present)
        if (footprint && footprint.length > 0) {
            this.drawFootprint(bars, footprint);
        } else {
            // Draw candlesticks
            this.drawCandlesticks(bars);
        }

        // Draw CVD (overlay at bottom)
        if (cvd && cvd.length > 0) {
            this.drawCVD(bars, cvd);
        }

        // Draw indicators
        this.drawIndicators(bars, indicators);

        // Draw drawings
        this.drawDrawings(bars, drawings);
    }

    private drawCVD(bars: Bar[], cvd: any[]) {
        // Draw CVD as a line chart at the bottom 20% of the chart
        // Need a separate scale for CVD
        const cvdHeight = this.height * 0.2;
        const cvdTop = this.height - cvdHeight;

        const minCVD = Math.min(...cvd.map(c => c.cumulative_delta));
        const maxCVD = Math.max(...cvd.map(c => c.cumulative_delta));
        const range = maxCVD - minCVD || 1;

        const cvdY = (val: number) => {
            return cvdTop + cvdHeight - ((val - minCVD) / range) * cvdHeight;
        };

        this.ctx.beginPath();
        this.ctx.strokeStyle = '#f59e0b'; // Amber-500
        this.ctx.lineWidth = 2;

        let started = false;
        bars.forEach((bar, index) => {
            const x = this.timeScale.indexToX(index);
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

        // Draw zero line if visible
        if (minCVD < 0 && maxCVD > 0) {
            const yZero = cvdY(0);
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#9ca3af'; // Gray-400
            this.ctx.setLineDash([4, 4]);
            this.ctx.moveTo(0, yZero);
            this.ctx.lineTo(this.width, yZero);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    private drawFootprint(bars: Bar[], footprint: any[]) {
        const barSpacing = this.timeScale.getBarSpacing();
        const barWidth = barSpacing * 0.8;

        // Don't draw footprint if zoomed out too much
        if (barWidth < 20) {
            this.drawCandlesticks(bars);
            return;
        }

        bars.forEach((bar, index) => {
            const x = this.timeScale.indexToX(index);
            if (x < -barWidth || x > this.width + barWidth) return;

            // Find matching footprint data
            // Assuming footprint data is aligned with bars
            const barData = footprint.find(f => Math.abs(new Date(f.time).getTime() - bar.timestamp * 1000) < 1000); // 1s tolerance

            if (!barData) {
                // Fallback to candle
                this.drawCandle(bar, x, barWidth);
                return;
            }

            // Draw candle outline
            const yHigh = this.priceScale.priceToY(bar.high);
            const yLow = this.priceScale.priceToY(bar.low);
            const yOpen = this.priceScale.priceToY(bar.open);
            const yClose = this.priceScale.priceToY(bar.close);
            const isGreen = bar.close >= bar.open;

            this.ctx.strokeStyle = isGreen ? '#22c55e' : '#ef4444';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - barWidth / 2, Math.min(yOpen, yClose), barWidth, Math.abs(yClose - yOpen));

            // Wicks
            this.ctx.beginPath();
            this.ctx.moveTo(x, yHigh);
            this.ctx.lineTo(x, Math.min(yOpen, yClose));
            this.ctx.moveTo(x, Math.max(yOpen, yClose));
            this.ctx.lineTo(x, yLow);
            this.ctx.stroke();

            // Draw volume clusters
            const cellHeight = this.priceScale.priceToY(0) - this.priceScale.priceToY(0.01); // Approx height of 1 tick
            // Actually we should calculate height based on price levels in data

            barData.levels.forEach((level: any) => {
                const y = this.priceScale.priceToY(level.price);
                const totalVol = level.bid_volume + level.ask_volume;
                if (totalVol === 0) return;

                // Draw cell background based on delta? Or just text?
                // Let's draw text: Bid x Ask

                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';

                // Left side (Bid)
                this.ctx.fillStyle = '#ef4444'; // Sellers hit bid
                this.ctx.fillText(Math.round(level.bid_volume).toString(), x - barWidth / 4, y);

                // Right side (Ask)
                this.ctx.fillStyle = '#22c55e'; // Buyers lift ask
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
        this.ctx.fillStyle = isGreen ? '#22c55e' : '#ef4444';
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
    }

    private drawVolumeProfile(profile: any[]) {
        if (profile.length === 0) return;

        // Calculate max volume for scaling
        const maxVolume = Math.max(...profile.map(p => p.volume));
        const profileWidth = this.width * 0.15; // Use 15% of chart width

        this.ctx.save();
        this.ctx.globalAlpha = 0.3;

        profile.forEach(level => {
            const y = this.priceScale.priceToY(level.price);
            const barWidth = (level.volume / maxVolume) * profileWidth;

            // Draw bid volume (green)
            if (level.bid_volume > 0) {
                const bidWidth = (level.bid_volume / level.volume) * barWidth;
                this.ctx.fillStyle = '#22c55e';
                this.ctx.fillRect(this.width - profileWidth, y - 2, bidWidth, 4);
            }

            // Draw ask volume (red)
            if (level.ask_volume > 0) {
                const askWidth = (level.ask_volume / level.volume) * barWidth;
                const bidWidth = (level.bid_volume / level.volume) * barWidth;
                this.ctx.fillStyle = '#ef4444';
                this.ctx.fillRect(this.width - profileWidth + bidWidth, y - 2, askWidth, 4);
            }
        });

        this.ctx.restore();
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
