import { describe, it, expect } from 'vitest';
import { generateMaze, validateMaze } from './maze';

describe('generateMaze', () => {
  it('is fully connected and closed at the perimeter, across sizes and seeds', () => {
    for (const [w, h] of [[4, 4], [5, 3], [9, 7], [14, 10], [2, 2], [1, 1]] as const) {
      for (const seed of [1, 2, 42, 999]) {
        const grid = generateMaze(w, h, seed);
        const report = validateMaze(grid);
        expect(report.connected).toBe(true);
        expect(report.perimeterOk).toBe(true);
        expect(report.total).toBe(w * h);
      }
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateMaze(9, 7, 12345);
    const b = generateMaze(9, 7, 12345);
    expect(a).toEqual(b);
  });

  it('produces a different layout for a different seed', () => {
    const a = generateMaze(9, 7, 1);
    const b = generateMaze(9, 7, 2);
    expect(a).not.toEqual(b);
  });

  it('always keeps the entrance cell (0,0) part of the connected component', () => {
    const grid = generateMaze(10, 8, 7);
    const report = validateMaze(grid);
    expect(report.reachable).toBe(report.total);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => generateMaze(0, 5, 1)).toThrow();
    expect(() => generateMaze(5, 0, 1)).toThrow();
  });
});
