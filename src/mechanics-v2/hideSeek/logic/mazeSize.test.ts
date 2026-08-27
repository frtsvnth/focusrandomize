import { describe, it, expect } from 'vitest';
import { computeMazeSize } from './mazeSize';

// The adapter now always passes a fixed square design resolution (screen size only scales the
// *display* via CSS, never the simulated field) — mirror that here.
const DESIGN = { designWidth: 1600, designHeight: 1600 };

describe('computeMazeSize', () => {
  it('always yields at least 2x the team count in total cells', () => {
    for (const teamCount of [1, 2, 4, 8, 12, 20, 32]) {
      const { width, height } = computeMazeSize({ teamCount, ...DESIGN });
      expect(width * height).toBeGreaterThanOrEqual(2 * teamCount);
    }
  });

  it('stays within its own [min,max] bounds', () => {
    for (const teamCount of [1, 8, 20, 32]) {
      const { width, height } = computeMazeSize({ teamCount, ...DESIGN });
      expect(width).toBeGreaterThanOrEqual(5);
      expect(width).toBeLessThanOrEqual(30);
      expect(height).toBeGreaterThanOrEqual(4);
      expect(height).toBeLessThanOrEqual(26);
    }
  });

  it('does not shrink as the team count grows, for a fixed design resolution', () => {
    let prevCells = 0;
    for (const teamCount of [1, 4, 8, 16, 32]) {
      const { width, height } = computeMazeSize({ teamCount, ...DESIGN });
      expect(width * height).toBeGreaterThanOrEqual(prevCells);
      prevCells = width * height;
    }
  });

  it('yields a roughly square maze for a square design resolution', () => {
    for (const teamCount of [1, 8, 20]) {
      const { width, height } = computeMazeSize({ teamCount, ...DESIGN });
      expect(Math.abs(width - height)).toBeLessThanOrEqual(2);
    }
  });

  it('is a pure function of team count + design resolution, independent of any screen size', () => {
    // Same inputs must yield the same maze regardless of what real viewport called it.
    const a = computeMazeSize({ teamCount: 8, designWidth: 1600, designHeight: 1600 });
    const b = computeMazeSize({ teamCount: 8, designWidth: 1600, designHeight: 1600 });
    expect(a).toEqual(b);
  });

  it('reduced motion always stays within its own tighter per-dimension cap', () => {
    for (const teamCount of [1, 8, 16, 25]) {
      const { width, height } = computeMazeSize({ teamCount, ...DESIGN, reducedMotion: true });
      expect(width).toBeLessThanOrEqual(10);
      expect(height).toBeLessThanOrEqual(8);
      // The algorithm now prefers a square-ish shape over the smallest possible covering
      // product (see mazeSize.ts's comment) — 8x8=64 beats a leaner-but-elongated 10x6=60.
      expect(width * height).toBeLessThanOrEqual(80);
    }
  });
});
