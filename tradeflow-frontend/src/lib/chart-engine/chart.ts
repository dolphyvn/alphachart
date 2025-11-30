import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries, BarSeries, BaselineSeries } from 'lightweight-charts';
import { Bar, Indicator, ChartType } from '@/types';
import { CHART_COLORS } from '@/lib/constants';

export interface ChartOptions {
  width: number;
  height: number;
  theme: 'light' | 'dark';
  symbol: string;
  timeframe: string;
}

export class TradingChart {
  private chart: IChartApi | null = null;
  private container: HTMLElement | null = null;
  private series: Map<string, ISeriesApi<any>> = new Map();
  private options: ChartOptions;
  private resizeObserver: ResizeObserver | null = null;
  private barData: Bar[] = [];
  private onCrosshairMove?: ((bar: Bar | null, x: number, y: number) => void) | null;

  constructor(options: ChartOptions) {
    this.options = options;
  }

  init(container: HTMLElement) {
    this.container = container;
    this.createChart();
    this.setupResizeObserver();
  }

  private createChart() {
    if (!this.container) return;

    const colors = this.getThemeColors();

    this.chart = createChart(this.container, {
      width: this.options.width,
      height: this.options.height,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontSize: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: colors.text,
          width: 1,
          style: 3, // dashed
        },
        horzLine: {
          color: colors.text,
          width: 1,
          style: 3,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: this.options.timeframe.includes('s') || this.options.timeframe.includes('m'),
        borderColor: colors.grid,
      },
      rightPriceScale: {
        borderColor: colors.grid,
        autoScale: true,
      },
      localization: {
        priceFormatter: (price: number) => {
          return this.formatPrice(price);
        },
      },
    });

    // Add main candlestick series
    this.addCandlestickSeries();

    // Setup crosshair move listener
    this.setupCrosshairListener();
  }

  private getThemeColors() {
    return {
      background: CHART_COLORS.background[this.options.theme],
      grid: CHART_COLORS.grid[this.options.theme],
      text: CHART_COLORS.text[this.options.theme],
      candleUp: CHART_COLORS.candle.up[this.options.theme],
      candleDown: CHART_COLORS.candle.down[this.options.theme],
    };
  }

  private formatPrice(price: number): string {
    // Simple price formatter - can be enhanced based on symbol
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(5);
  }

  private setupResizeObserver() {
    if (!this.container || !this.chart) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0) return;

      const entry = entries[0];
      const { width, height } = entry.contentRect;

      if (width > 0 && height > 0) {
        this.chart?.applyOptions({
          width,
          height,
        });
        // Ensure data is visible after resize
        requestAnimationFrame(() => {
          this.chart?.timeScale().fitContent();
        });
      }
    });

    this.resizeObserver.observe(this.container);
  }

  private addCandlestickSeries() {
    if (!this.chart) return;

    const colors = this.getThemeColors();

    const candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      borderVisible: false,
      wickUpColor: colors.candleUp,
      wickDownColor: colors.candleDown,
      priceFormat: {
        type: 'price',
        precision: this.getPricePrecision(),
      },
    });

    this.series.set('candlestick', candlestickSeries);
  }

  private setupCrosshairListener() {
    if (!this.chart) return;

    this.chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !this.onCrosshairMove) {
        this.onCrosshairMove?.(null, 0, 0);
        return;
      }

      // Find the bar data for the current crosshair time
      const crosshairTime = param.time;
      const bar = this.findBarByTime(crosshairTime);

      if (bar && param.point) {
        this.onCrosshairMove(bar, param.point.x, param.point.y);
      } else {
        this.onCrosshairMove(null, 0, 0);
      }
    });
  }

  private findBarByTime(time: Time): Bar | null {
    if (this.barData.length === 0) return null;

    // Convert time to number for comparison
    let crosshairTimestamp: number;
    if (typeof time === 'number') {
      crosshairTimestamp = time;
    } else if (typeof time === 'string') {
      crosshairTimestamp = new Date(time).getTime() / 1000;
    } else {
      // BusinessDay type - handle it appropriately
      crosshairTimestamp = Date.parse(`${time.year}-${time.month.toString().padStart(2, '0')}-${time.day.toString().padStart(2, '0')}`) / 1000;
    }

    // Find the bar with closest time
    let closestBar = this.barData[0];
    const closestBarTimestamp = this.convertTimeToNumber(closestBar.time);
    let minDiff = Math.abs(crosshairTimestamp - closestBarTimestamp);

    for (const bar of this.barData) {
      const barTimestamp = this.convertTimeToNumber(bar.time);
      const diff = Math.abs(crosshairTimestamp - barTimestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closestBar = bar;
      }
    }

    // Only return if within reasonable tolerance (e.g., same timeframe)
    if (minDiff <= this.getTimeframeTolerance()) {
      return closestBar;
    }

    return null;
  }

  private getTimeframeTolerance(): number {
    // Return tolerance in seconds based on timeframe
    const timeframe = this.options.timeframe;
    if (timeframe.includes('s')) {
      return parseInt(timeframe) + 1;
    }
    if (timeframe.includes('m')) {
      return parseInt(timeframe) * 60 + 30;
    }
    if (timeframe.includes('h')) {
      return parseInt(timeframe) * 3600 + 1800;
    }
    if (timeframe.includes('D')) {
      return 86400; // 1 day
    }
    return 30; // default 30 seconds
  }

  setCrosshairMoveCallback(callback: (bar: Bar | null, x: number, y: number) => void) {
    this.onCrosshairMove = callback;
  }

  private getPricePrecision(): number {
    // Determine precision based on current symbol
    const symbol = this.options.symbol.toLowerCase();
    if (symbol.includes('jpy') || symbol.includes('usdjpy')) return 3;
    if (symbol.includes('crypto') || symbol.includes('btc') || symbol.includes('eth')) return 2;
    return 4; // forex default
  }

  updateData(bars: Bar[]) {
    const candlestickSeries = this.series.get('candlestick') as ISeriesApi<'Candlestick'>;
    if (!candlestickSeries || !bars.length) return;

    // Store bar data for tooltip
    this.barData = [...bars];

    // Convert bars to lightweight-charts format
    const chartData = bars.map(bar => ({
      time: this.convertTime(bar.time),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    // Sort by time
    chartData.sort((a, b) => (a.time as number) - (b.time as number));

    candlestickSeries.setData(chartData);
  }

  updateCandle(bar: Bar) {
    const candlestickSeries = this.series.get('candlestick') as ISeriesApi<'Candlestick'>;
    if (!candlestickSeries) return;

    try {
      const timeValue = this.convertTime(bar.time);

      // Ensure timeValue is a number for comparison
      const timestamp = typeof timeValue === 'number' ? timeValue : this.convertTimeToNumber(bar.time);

      // Check if this is newer than the last candle time
      if (this.barData.length > 0) {
        const lastBar = this.barData[this.barData.length - 1];
        const lastTimestamp = this.convertTimeToNumber(lastBar.time);

        // If this is the same time as the last candle, update it
        // If it's newer, add it as a new candle
        // If it's older, ignore it to prevent the "oldest data" error
        if (timestamp < lastTimestamp) {
          console.warn('Ignoring older candle data:', timestamp, 'last:', lastTimestamp);
          return;
        }
      }

      const updateData = {
        time: timeValue,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      };

      candlestickSeries.update(updateData);

      // Update bar data for tooltip
      const existingBarIndex = this.barData.findIndex(b =>
        this.convertTimeToNumber(b.time) === timestamp
      );

      if (existingBarIndex >= 0) {
        this.barData[existingBarIndex] = bar;
      } else if (timestamp >= this.convertTimeToNumber(this.barData[this.barData.length - 1]?.time || 0)) {
        this.barData.push(bar);
        // Keep only last 500 bars
        if (this.barData.length > 500) {
          this.barData = this.barData.slice(-500);
        }
      }
    } catch (error) {
      console.error('Error updating candle:', error, bar);
    }
  }

  addIndicator(indicator: Indicator, data: number[]) {
    if (!this.chart) return;

    let series: ISeriesApi<any>;

    switch (indicator.type) {
      case 'line':
        series = this.chart.addSeries(LineSeries, {
          color: indicator.outputs[0]?.color || CHART_COLORS.indicators[0],
          lineWidth: 2,
          title: indicator.name,
          priceScaleId: indicator.priceScaleId || 'right',
        });
        break;

      case 'histogram':
        series = this.chart.addSeries(HistogramSeries, {
          color: indicator.outputs[0]?.color || CHART_COLORS.indicators[0],
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: indicator.priceScaleId || 'right',
        });
        break;

      case 'area':
        series = this.chart.addSeries(AreaSeries, {
          topColor: indicator.outputs[0]?.color || CHART_COLORS.indicators[0],
          bottomColor: `${indicator.outputs[0]?.color || CHART_COLORS.indicators[0]}20`,
          lineColor: indicator.outputs[0]?.color || CHART_COLORS.indicators[0],
          lineWidth: 2,
          title: indicator.name,
          priceScaleId: indicator.priceScaleId || 'right',
        });
        break;

      default:
        series = this.chart.addSeries(LineSeries, {
          color: indicator.outputs[0]?.color || CHART_COLORS.indicators[0],
          lineWidth: 2,
          title: indicator.name,
          priceScaleId: indicator.priceScaleId || 'right',
        });
    }

    this.series.set(indicator.id, series);

    // Set indicator data
    const indicatorData = data.map((value, index) => ({
      time: this.convertTime(index), // This would need proper time mapping
      value: value,
    }));

    series.setData(indicatorData);
  }

  removeIndicator(indicatorId: string) {
    const series = this.series.get(indicatorId);
    if (series && this.chart) {
      this.chart.removeSeries(series);
      this.series.delete(indicatorId);
    }
  }

  updateChartType(chartType: ChartType) {
    // This would require recreating the main series
    // For now, we'll just update the current chart
    if (this.chart) {
      this.chart.timeScale().fitContent();
    }
  }

  updateTheme(theme: 'light' | 'dark') {
    if (!this.chart) return;

    const colors = {
      background: CHART_COLORS.background[theme],
      grid: CHART_COLORS.grid[theme],
      text: CHART_COLORS.text[theme],
    };

    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
    });

    this.options.theme = theme;
  }

  fitContent() {
    if (this.chart) {
      this.chart.timeScale().fitContent();
    }
  }

  private convertTime(time: string | number): Time {
    if (typeof time === 'number') {
      return time as Time;
    }

    // Convert ISO string to timestamp
    return (new Date(time).getTime() / 1000) as Time;
  }

  private convertTimeToNumber(time: string | number): number {
    if (typeof time === 'number') {
      return time;
    }

    // Convert ISO string to timestamp
    return new Date(time).getTime() / 1000;
  }

  updateSize(width: number, height: number) {
    this.options.width = width;
    this.options.height = height;

    if (this.chart) {
      this.chart.applyOptions({ width, height });
    }
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }

    this.series.clear();
  }
}