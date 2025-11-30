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