export class RingBuffer<T> {
    private buf: (T | undefined)[];
    private head = 0; // next write position
    private length = 0; // number of stored items (<= _capacity)
    private readonly _capacity: number;

    constructor(capacity: number) {
        if (capacity <= 0) throw new Error("ringbuffer capacity must be > 0");
        this._capacity = capacity;
        this.buf = new Array(capacity);
    }

    push(item: T): void {
        this.buf[this.head] = item;
        this.head = (this.head + 1) % this._capacity;
        if (this.length < this._capacity) this.length++;
    }

    size(): number {
        return this.length;
    }

    capacity(): number {
        return this._capacity;
    }

    // index: 0 => oldest, size()-1 => newest
    get(index: number): T | undefined {
        if (index < 0 || index >= this.length) return undefined;
        const start =
            (this.head - this.length + this._capacity) % this._capacity;
        return this.buf[(start + index) % this._capacity];
    }

    last(): T | undefined {
        if (this.length === 0) return undefined;
        const lastIdx = (this.head - 1 + this._capacity) % this._capacity;
        return this.buf[lastIdx];
    }

    toArray(): T[] {
        const out: T[] = [];
        for (let i = 0; i < this.length; i++) {
            const v = this.get(i);
            if (v !== undefined) out.push(v);
        }
        return out;
    }

    clear(): void {
        this.buf = new Array(this._capacity);
        this.head = 0;
        this.length = 0;
    }

    *[Symbol.iterator](): IterableIterator<T> {
        for (let i = 0; i < this.length; i++) {
            const v = this.get(i);
            if (v !== undefined) yield v;
        }
    }
}
