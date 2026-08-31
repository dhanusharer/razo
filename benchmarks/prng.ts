/**
 * Deterministic pseudo-random number generator (Mulberry32)
 * Ensures 100% reproducible benchmark datasets across runs.
 */
export class SeededPRNG {
  private state: number;

  constructor(seed: number = 42026) {
    this.state = seed >>> 0;
  }

  /**
   * Returns a pseudo-random float in range [0, 1)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer in range [min, max] (inclusive)
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Randomly chooses one element from an array
   */
  public choice<T>(array: T[]): T {
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }

  /**
   * Returns true with given probability (0 to 1)
   */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }
}
