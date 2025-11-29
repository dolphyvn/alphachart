export class PriceScale {
    private height: number;
    private minPrice: number = 0;
    private maxPrice: number = 100;
    private padding: number = 0.1; // 10% padding

    constructor(height: number) {
        this.height = height;
    }

    setRange(min: number, max: number) {
        const range = max - min;
        this.minPrice = min - range * this.padding;
        this.maxPrice = max + range * this.padding;
    }

    priceToY(price: number): number {
        const range = this.maxPrice - this.minPrice;
        if (range === 0) return this.height / 2;
        return this.height - ((price - this.minPrice) / range) * this.height;
    }

    yToPrice(y: number): number {
        const range = this.maxPrice - this.minPrice;
        return this.maxPrice - (y / this.height) * range;
    }
}

export class TimeScale {
    private width: number;
    private barSpacing: number = 10; // Pixels per bar
    private offset: number = 0; // Scroll offset in pixels

    constructor(width: number) {
        this.width = width;
    }

    // Convert index to X coordinate
    indexToX(index: number): number {
        return index * this.barSpacing - this.offset;
    }

    // Convert X coordinate to index
    xToIndex(x: number): number {
        return Math.round((x + this.offset) / this.barSpacing);
    }

    setOffset(offset: number) {
        this.offset = offset;
    }

    getOffset() {
        return this.offset;
    }

    setBarSpacing(spacing: number) {
        this.barSpacing = spacing;
    }

    getBarSpacing() {
        return this.barSpacing;
    }
}
