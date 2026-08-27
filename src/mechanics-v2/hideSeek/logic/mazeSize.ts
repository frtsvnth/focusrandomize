/**
 * Maze size heuristic — a pure function of the scene's own "design resolution" (the same
 * concept Tractor uses: `width = Math.min(1500, innerWidth*0.92)`), not of `window.*`
 * directly, so it stays testable without a DOM. Mirrors the prototype's `autoSize()`
 * (area-based cell budget, split by aspect ratio) but floors the cell count well above the
 * team roster so scatter.ts always has plenty of candidates beyond its minimum-distance
 * cutoff, even for a large roster.
 */
import { clamp } from '../../engine/canvasUtils';

export interface MazeSizeInput {
  teamCount: number;
  designWidth: number;
  designHeight: number;
  reducedMotion?: boolean;
}

export interface MazeSize {
  width: number;
  height: number;
}

/** On-screen footprint (px) of one maze cell at the default intro fit-to-screen zoom. */
const CELL_PX = 70;

const MIN_W = 5;
const MAX_W = 30;
const MIN_H = 4;
const MAX_H = 26;
const MAX_CELLS = 480;

const MIN_W_REDUCED = 4;
const MAX_W_REDUCED = 10;
const MIN_H_REDUCED = 4;
const MAX_H_REDUCED = 8;
const MAX_CELLS_REDUCED = 60;

export function computeMazeSize({ teamCount, designWidth, designHeight, reducedMotion }: MazeSizeInput): MazeSize {
  const minW = reducedMotion ? MIN_W_REDUCED : MIN_W;
  const maxW = reducedMotion ? MAX_W_REDUCED : MAX_W;
  const minH = reducedMotion ? MIN_H_REDUCED : MIN_H;
  const maxH = reducedMotion ? MAX_H_REDUCED : MAX_H;
  const maxCells = reducedMotion ? MAX_CELLS_REDUCED : MAX_CELLS;

  const minCellsNeeded = Math.max(teamCount * 2, teamCount + 6);
  const areaCells = Math.round((designWidth * designHeight) / (CELL_PX * CELL_PX));
  // Cap by what the width/height bounds can even hold, so the loop below always converges.
  const maxCellsFeasible = Math.min(maxCells, maxW * maxH);
  const totalCells = clamp(Math.max(areaCells, minCellsNeeded), minW * minH, maxCellsFeasible);

  // Exhaustively scores every height in range (cheap — at most ~25 iterations) rather than a
  // single sqrt-based guess: picks whichever (width,height) pair both covers `totalCells` and
  // sits within 15% of the smallest possible covering product, preferring the one closest to
  // the design's own aspect ratio among those. A single "nearest square" guess tended to land
  // on an exact-but-elongated factor pair (e.g. 20x24 for a budget of 480) purely because it
  // divided evenly, even when a much more square 22x22 covered almost the same area — this
  // keeps a square design resolution (the mechanic always passes one — see
  // HideSeekAdapterV2.tsx) reliably yielding a square-ish maze instead of a lucky-divisor shape.
  const aspect = designWidth / Math.max(1, designHeight);
  const candidates: Array<{ width: number; height: number; product: number }> = [];
  for (let h = minH; h <= maxH; h++) {
    const w = clamp(Math.ceil(totalCells / h), minW, maxW);
    const product = w * h;
    if (product >= totalCells) candidates.push({ width: w, height: h, product });
  }

  let minProduct = Infinity;
  for (const c of candidates) minProduct = Math.min(minProduct, c.product);
  const slackCeiling = minProduct * 1.15;

  let best = candidates[0];
  let bestRatioDelta = Infinity;
  for (const c of candidates) {
    if (c.product > slackCeiling) continue;
    const ratioDelta = Math.abs(c.width / c.height - aspect);
    if (ratioDelta < bestRatioDelta) {
      bestRatioDelta = ratioDelta;
      best = c;
    }
  }

  return { width: best.width, height: best.height };
}
