/**
 * Assigns each team a distinct maze cell to scatter to. Two guarantees, both requested after
 * the first playtest ("players should run far into different corners, not bunch up near each
 * other or near the door"):
 *
 * 1. Every assigned cell is at least `minDistance` BFS-steps from the entrance (relaxed down
 *    if a small maze can't satisfy it for the whole roster) — nobody loiters by the door.
 * 2. Cells are chosen via greedy farthest-point sampling over the maze's *graph* distance
 *    (BFS steps, not Euclidean/grid distance, since a maze's shortest path winds through
 *    corridors) rather than a plain shuffle — each pick maximizes its distance to the nearest
 *    already-placed team (and to the entrance, seeded as the first anchor), so the roster
 *    spreads into different corridors/corners instead of randomly clustering together even
 *    when they're individually far from the door.
 *
 * `reassignBlockedTeams` (used by ./choreography.ts) handles the separate "don't seat a team
 * directly on the seeker's route" requirement — that depends on the winner's path, which isn't
 * known until after this initial assignment, so it's a deliberate second pass rather than a
 * constraint built into the sampling here.
 */
import { makeRng } from '../../engine/canvasUtils';
import type { Grid } from './maze';
import { openCells } from './maze';
import { bfsDistances, cellKey, type Cell } from './pathfinding';

const SCATTER_SEED_OFFSET = 4001;
const TEAM_ORDER_SEED_OFFSET = 4051;
const REASSIGN_SEED_OFFSET = 4101;
const DEFAULT_MIN_DISTANCE = 3;

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = makeRng(seed);
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cellId(cell: Cell): string {
  return `${cell[0]},${cell[1]}`;
}

/**
 * Greedy farthest-point sampling: repeatedly picks the pool cell whose (graph) distance to the
 * nearest already-"occupied" cell — an `anchor` or a previous pick — is largest, breaking ties
 * with the seeded rng. Each pick costs one `bfsDistances` call (O(V)); for the small rosters
 * and maze sizes this mechanic uses, doing that once per pick is cheap.
 */
function pickSpreadCells(grid: Grid, pool: Cell[], count: number, seed: number, anchors: Cell[]): Cell[] {
  if (count <= 0 || pool.length === 0) return [];
  const rng = makeRng(seed);
  const w = grid[0].length;

  const remaining = pool.slice();
  const minDist = new Array<number>(remaining.length).fill(Infinity);

  const relaxWithSource = (source: Cell) => {
    const dist = bfsDistances(grid, source[0], source[1]);
    for (let i = 0; i < remaining.length; i++) {
      const [r, c] = remaining[i];
      const d = dist.get(cellKey(w, r, c)) ?? Infinity;
      if (d < minDist[i]) minDist[i] = d;
    }
  };
  for (const a of anchors) relaxWithSource(a);

  const picked: Cell[] = [];
  while (picked.length < count && remaining.length > 0) {
    let bestScore = -1;
    const bestIdx: number[] = [];
    for (let i = 0; i < remaining.length; i++) {
      const d = minDist[i];
      if (d > bestScore) {
        bestScore = d;
        bestIdx.length = 0;
        bestIdx.push(i);
      } else if (d === bestScore) {
        bestIdx.push(i);
      }
    }
    const chosenLocal = bestIdx[Math.floor(rng() * bestIdx.length)];
    const chosen = remaining[chosenLocal];
    picked.push(chosen);
    relaxWithSource(chosen);

    const lastIdx = remaining.length - 1;
    remaining[chosenLocal] = remaining[lastIdx];
    minDist[chosenLocal] = minDist[lastIdx];
    remaining.pop();
    minDist.pop();
  }
  return picked;
}

function candidatesAtLeast(grid: Grid, entrance: Cell, minDistance: number, need: number): Cell[] {
  const w = grid[0].length;
  const distances = bfsDistances(grid, entrance[0], entrance[1]);
  const allCells = openCells(grid);

  let threshold = minDistance;
  let candidates: Cell[] = [];
  while (threshold >= 1) {
    candidates = allCells.filter(([r, c]) => (distances.get(cellKey(w, r, c)) ?? 0) >= threshold);
    if (candidates.length >= need) break;
    threshold--;
  }
  if (candidates.length < need) {
    candidates = allCells.filter(([r, c]) => r !== entrance[0] || c !== entrance[1]);
  }
  return candidates;
}

export function computeScatterAssignment(
  grid: Grid,
  entrance: Cell,
  teamIds: string[],
  seed: number,
  minDistance = DEFAULT_MIN_DISTANCE
): Record<string, Cell> {
  if (teamIds.length === 0) return {};

  const candidates = candidatesAtLeast(grid, entrance, minDistance, teamIds.length);
  // The entrance is seeded as the first anchor, so the very first pick is simply "farthest
  // cell from the door", and every pick after that balances staying far from the door *and*
  // far from every team already placed.
  const picks = pickSpreadCells(grid, candidates, teamIds.length, seed + SCATTER_SEED_OFFSET, [entrance]);

  const shuffledTeamOrder = seededShuffle(teamIds, seed + TEAM_ORDER_SEED_OFFSET);
  const assignment: Record<string, Cell> = {};
  shuffledTeamOrder.forEach((teamId, i) => {
    assignment[teamId] = picks[i % Math.max(1, picks.length)];
  });
  return assignment;
}

/**
 * Moves any team currently sitting on a `blockedKeys` cell (part of the seeker's route to the
 * winner, or a cell adjacent to it — see choreography.ts) to a fresh cell that isn't blocked
 * and isn't already used by anyone else, chosen to stay well-spread from the rest of the
 * roster. Cells outside `blockedKeys` are excluded from the route by construction, so this
 * needs a single pass — a relocated team can never land back on a blocked cell.
 */
export function reassignBlockedTeams(
  grid: Grid,
  entrance: Cell,
  assignment: Record<string, Cell>,
  teamIds: string[],
  blockedKeys: Set<string>,
  seed: number
): Record<string, Cell> {
  const entranceKey = cellId(entrance);
  const blockedTeamIds = teamIds.filter((id) => blockedKeys.has(cellId(assignment[id])));
  if (blockedTeamIds.length === 0) return assignment;

  const next = { ...assignment };
  const usedKeys = new Set(Object.values(assignment).map(cellId));

  blockedTeamIds.forEach((teamId, i) => {
    let pool = openCells(grid).filter(([r, c]) => {
      const key = `${r},${c}`;
      return key !== entranceKey && !blockedKeys.has(key) && !usedKeys.has(key);
    });
    if (pool.length === 0) {
      // Pathological (a maze too small/blocked to have any free cell left) — last resort,
      // allow reusing an occupied-but-unblocked cell rather than leaving the team stranded.
      pool = openCells(grid).filter(([r, c]) => `${r},${c}` !== entranceKey && !blockedKeys.has(`${r},${c}`));
    }

    const anchors = Object.values(next);
    const [pick] = pickSpreadCells(grid, pool, 1, seed + REASSIGN_SEED_OFFSET + i, anchors);
    if (pick) {
      next[teamId] = pick;
      usedKeys.add(cellId(pick));
    }
  });

  return next;
}
