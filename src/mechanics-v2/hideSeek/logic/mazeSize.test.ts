import { describe, it, expect } from 'vitest';
import { computeMazeSize } from './mazeSize';

// The adapter always passes this fixed landscape design resolution (screen size only scales
// the *display* via CSS, never the simulated field) — mirror that here.
const DESIGN = { designWidth: 1500, designHeight: 820 };

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

  it('yields a maze whose aspect ratio is close to the design resolution\'s own aspect', () => {
    const designAspect = DESIGN.designWidth / DESIGN.designHeight;
    for (const teamCount of [1, 8, 20]) {
      const { width, height } = computeMazeSize({ teamCount, ...DESIGN });
      expect(Math.abs(width / height - designAspect)).toBeLessThan(0.6);
    }
  });

  it('is a pure function of team count + design resolution, independent of any screen size', () => {
    // Same inputs must yield the same maze regardless of what real viewport called it.
    const a = computeMazeSize({ teamCount: 8, ...DESIGN });
    const b = computeMazeSize({ teamCount: 8, ...DESIGN });
    expect(a).toEqual(b);
  });

  it('keeps a typical roster\'s maze to a moderate cell count, not a sprawling one', () => {
    const { width, height } = computeMazeSize({ teamCount: 8, ...DESIGN });
    expect(width * height).toBeGreaterThan(150);
    expect(width * height).toBeLessThan(350);
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
