/**
 * Procedural maze generator — recursive backtracker (DFS with backtracking), ported from
 * the /Users/fortyseventh/isometric-maze prototype's maze.js. A cell is a bitmask of which
 * sides have a wall (N/S/E/W); starting the DFS from a fixed corner and only ever removing
 * walls between the current cell and an unvisited neighbor guarantees the result is fully
 * connected (every cell reachable from the entrance) and has a closed outer perimeter,
 * without any extra bookkeeping.
 */
import { makeRng } from '../../engine/canvasUtils';

export const N = 1 << 0;
export const S = 1 << 1;
export const E = 1 << 2;
export const W = 1 << 3;

const OPPOSITE: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };
const DIRS: Record<number, [number, number]> = {
  [N]: [-1, 0],
  [S]: [1, 0],
  [E]: [0, 1],
  [W]: [0, -1],
};
const ALL_DIRS = [N, S, E, W];

export type Grid = number[][];

export function hasWall(cell: number, dir: number): boolean {
  return (cell & dir) !== 0;
}

export function generateMaze(width: number, height: number, seed: number): Grid {
  if (width < 1 || height < 1) throw new Error('Maze dimensions must be >= 1');
  const rng = makeRng(seed);

  const grid: Grid = Array.from({ length: height }, () => new Array(width).fill(N | S | E | W));
  const visited = Array.from({ length: height }, () => new Array(width).fill(false));
  const inBounds = (r: number, c: number) => r >= 0 && r < height && c >= 0 && c < width;

  const startR = 0;
  const startC = 0;
  visited[startR][startC] = true;
  const stack: [number, number][] = [[startR, startC]];

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const neighbors: [number, number, number][] = [];
    for (const dir of ALL_DIRS) {
      const [dr, dc] = DIRS[dir];
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && !visited[nr][nc]) neighbors.push([dir, nr, nc]);
    }

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const [dir, nr, nc] = neighbors[(rng() * neighbors.length) | 0];
    grid[r][c] &= ~dir;
    grid[nr][nc] &= ~OPPOSITE[dir];
    visited[nr][nc] = true;
    stack.push([nr, nc]);
  }

  return grid;
}

export function openCells(grid: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) cells.push([r, c]);
  }
  return cells;
}

export function neighborsOf(grid: Grid, r: number, c: number): [number, number][] {
  const result: [number, number][] = [];
  for (const dir of ALL_DIRS) {
    if (hasWall(grid[r][c], dir)) continue;
    const [dr, dc] = DIRS[dir];
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) result.push([nr, nc]);
  }
  return result;
}

/** Self-check: full connectivity from (0,0) + closed outer perimeter. */
export function validateMaze(grid: Grid): { total: number; reachable: number; connected: boolean; perimeterOk: boolean } {
  const h = grid.length;
  const w = grid[0].length;

  const seen = Array.from({ length: h }, () => new Array(w).fill(false));
  const stack: [number, number][] = [[0, 0]];
  seen[0][0] = true;
  let count = 0;
  while (stack.length) {
    const [r, c] = stack.pop()!;
    count++;
    for (const [nr, nc] of neighborsOf(grid, r, c)) {
      if (!seen[nr][nc]) {
        seen[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
  }

  let perimeterOk = true;
  for (let c = 0; c < w; c++) {
    if (!hasWall(grid[0][c], N)) perimeterOk = false;
    if (!hasWall(grid[h - 1][c], S)) perimeterOk = false;
  }
  for (let r = 0; r < h; r++) {
    if (!hasWall(grid[r][0], W)) perimeterOk = false;
    if (!hasWall(grid[r][w - 1], E)) perimeterOk = false;
  }

  return { total: h * w, reachable: count, connected: count === h * w, perimeterOk };
}
