export class Rng {
  private s: number;

  constructor(seed = (Math.random() * 1e9) >>> 0) {
    this.s = seed || 1;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }

  pick<T>(xs: readonly T[]): T {
    return xs[this.int(0, xs.length - 1)]!;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
