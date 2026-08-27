import { describe, it, expect } from 'vitest';
import { generateMaze } from './maze';
import { bfsDistances, cellKey } from './pathfinding';
import { computeScatterAssignment } from './scatter';

function teamIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `team-${i}`);
}

describe('computeScatterAssignment', () => {
  it('assigns every team a cell at least minDistance from the entrance', () => {
    const grid = generateMaze(12, 9, 5);
    const entrance: [number, number] = [0, 0];
    const ids = teamIds(8);
    const assignment = computeScatterAssignment(grid, entrance, ids, 5, 3);
    const distances = bfsDistances(grid, 0, 0);
    const w = grid[0].length;
    for (const id of ids) {
      const [r, c] = assignment[id];
      expect(distances.get(cellKey(w, r, c))).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every team a distinct cell', () => {
    const grid = generateMaze(12, 9, 5);
    const ids = teamIds(10);
    const assignment = computeScatterAssignment(grid, [0, 0], ids, 5, 3);
    const cells = ids.map((id) => assignment[id].join(','));
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('is deterministic for a fixed seed and differs for a different seed', () => {
    const grid = generateMaze(12, 9, 5);
    const ids = teamIds(6);
    const a = computeScatterAssignment(grid, [0, 0], ids, 5, 3);
    const b = computeScatterAssignment(grid, [0, 0], ids, 5, 3);
    expect(a).toEqual(b);
    const c = computeScatterAssignment(grid, [0, 0], ids, 999, 3);
    expect(c).not.toEqual(a);
  });

  it('relaxes the distance threshold instead of crashing on a maze too small for the requested minDistance', () => {
    const grid = generateMaze(3, 3, 1); // 9 cells, 8 non-entrance
    const ids = teamIds(5);
    const assignment = computeScatterAssignment(grid, [0, 0], ids, 1, 3);
    const cells = ids.map((id) => assignment[id].join(','));
    expect(new Set(cells).size).toBe(cells.length);
    for (const id of ids) {
      expect(assignment[id]).not.toEqual([0, 0]);
    }
  });

  it('never assigns the entrance cell itself', () => {
    const grid = generateMaze(10, 8, 3);
    const ids = teamIds(12);
    const assignment = computeScatterAssignment(grid, [0, 0], ids, 3, 3);
    for (const id of ids) {
      expect(assignment[id]).not.toEqual([0, 0]);
    }
  });
});
