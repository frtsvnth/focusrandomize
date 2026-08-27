/**
 * BFS pathfinding over the maze grid — every step costs the same (no weighted edges), so
 * BFS already gives shortest paths. Ported from the prototype's main.js `findPath`, plus
 * two small helpers (`bfsDistances`, `degreeOf`) the choreography needs that the prototype
 * didn't: distance-from-a-point-to-everywhere (for the "stay away from the entrance"
 * scatter rule) and open-direction count (for picking real junctions to hesitate at).
 */
import { type Grid, neighborsOf } from './maze';

export type Cell = [number, number];

/** Shortest path from (sr,sc) to (tr,tc), entrance-inclusive. Null only if unreachable
 *  (never happens on a maze that passed validateMaze). */
export function findPath(grid: Grid, sr: number, sc: number, tr: number, tc: number): Cell[] | null {
  const w = grid[0].length;
  const prev = new Map<number, Cell>();
  const queue: Cell[] = [[sr, sc]];
  const seen = new Set<number>([sr * w + sc]);
  let qi = 0;

  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    if (r === tr && c === tc) {
      const path: Cell[] = [[r, c]];
      let k = r * w + c;
      while (prev.has(k)) {
        const [pr, pc] = prev.get(k)!;
        path.push([pr, pc]);
        k = pr * w + pc;
      }
      return path.reverse();
    }
    for (const [nr, nc] of neighborsOf(grid, r, c)) {
      const k = nr * w + nc;
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, [r, c]);
      queue.push([nr, nc]);
    }
  }
  return null;
}

/** BFS distance (in steps) from (sr,sc) to every reachable cell. */
export function bfsDistances(grid: Grid, sr: number, sc: number): Map<number, number> {
  const w = grid[0].length;
  const dist = new Map<number, number>();
  const queue: Cell[] = [[sr, sc]];
  dist.set(sr * w + sc, 0);
  let qi = 0;

  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    const d = dist.get(r * w + c)!;
    for (const [nr, nc] of neighborsOf(grid, r, c)) {
      const k = nr * w + nc;
      if (dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push([nr, nc]);
    }
  }
  return dist;
}

export function cellKey(w: number, r: number, c: number): number {
  return r * w + c;
}

/** Number of open (wall-free) directions out of a cell — 1 = dead end, 3-4 = a real junction. */
export function degreeOf(grid: Grid, r: number, c: number): number {
  return neighborsOf(grid, r, c).length;
}
