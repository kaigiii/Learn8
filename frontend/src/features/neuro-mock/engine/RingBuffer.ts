/** Bounded storage; no ever-growing session arrays. */
export class RingBuffer<T> {
  private values: T[];
  private cursor = 0;
  private length = 0;
  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Invalid ring capacity");
    this.values = new Array<T>(capacity);
  }
  push(value: T) { this.values[this.cursor] = value; this.cursor = (this.cursor + 1) % this.capacity; this.length = Math.min(this.length + 1, this.capacity); }
  toArray(): T[] { return Array.from({ length: this.length }, (_, i) => this.values[(this.cursor - this.length + i + this.capacity) % this.capacity]); }
  clear() { this.cursor = 0; this.length = 0; }
}
