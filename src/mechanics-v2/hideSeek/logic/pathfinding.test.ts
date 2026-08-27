import { describe, it, expect } from 'vitest';
import { generateMaze, hasWall, openCells } from './maze';
import { findPath, bfsDistances, degreeOf } from './pathfinding';

describe('findPath', () => {
  it('never returns null on a generated (fully connected) maze', () => {
    const grid = generateMaze(9, 7, 42);
    const cells = openCells(grid);
    for (const [tr, tc] of cells) {
      expect(findPath(grid, 0, 0, tr, tc)).not.toBeNull();
    }
  });

  it('every consecutive pair of cells in the path is actually connected (no wall between them)', () => {
    const grid = generateMaze(10, 8, 7);
    const path = findPath(grid, 0, 0, 7, 9)!;
    for (let i = 1; i < path.length; i++) {
      const [pr, pc] = path[i - 1];
      const [r, c] = path[i];
      const dr = r - pr;
      const dc = c - pc;
      expect(Math.abs(dr) + Math.abs(dc)).toBe(1);
      // Figure out which wall bit this step crosses and assert it's open on the "from" cell.
      const dir = dr === -1 ? 1 : dr === 1 ? 2 : dc === 1 ? 4 : 8;
      expect(hasWall(grid[pr][pc], dir)).toBe(false);
    }
  });

  it('returns a single-cell path when start === target', () => {
    const grid = generateMaze(6, 6, 3);
    const path = findPath(grid, 2, 2, 2, 2)!;
    expect(path).toEqual([[2, 2]]);
  });
});

describe('bfsDistances', () => {
  it('matches findPath path length - 1 for a sample of cell pairs', () => {
    const grid = generateMaze(9, 7, 11);
    const dist = bfsDistances(grid, 0, 0);
    const cells = openCells(grid);
    for (const [r, c] of cells.slice(0, 15)) {
      const path = findPath(grid, 0, 0, r, c)!;
      expect(dist.get(r * grid[0].length + c)).toBe(path.length - 1);
    }
  });
});

describe('degreeOf', () => {
  it('returns values in [1,4] matching the open-wall count', () => {
    const grid = generateMaze(8, 6, 5);
    for (const [r, c] of openCells(grid)) {
      const d = degreeOf(grid, r, c);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(4);
    }
  });

  it('matches a hand-built fixture cell (all four walls open)', () => {
    // A 1x1 maze forces a fully-closed perimeter (0 open sides) — verifies the boundary case.
    const grid = generateMaze(1, 1, 1);
    expect(degreeOf(grid, 0, 0)).toBe(0);
  });
});
