/**
 * Pure hide-and-seek choreography — no Three.js. Turns a winner (already decided by
 * engine/selectionEngine.ts's selectNextTeam) into a full script: where every team scatters
 * to, when, and the seeker's own path/timing to the winner's cell. Like tractor/logic/
 * runPlan.ts, this is deliberately scripted, not simulated — `targetTeamId` is never
 * re-derived, it just flows straight through into the scatter assignment and the seeker's
 * final destination.
 *
 * The whole show must fit in <=25s (<=10s under reducedMotion). Every phase duration below
 * is a fixed constant except the chase, which absorbs whatever's left of the requested
 * total — so the sum of all phases always lands exactly on `durationSec` by construction,
 * not just "usually".
 */
import { clamp, makeRng } from '../../engine/canvasUtils';
import { neighborsOf, type Grid } from './maze';
import { computeScatterAssignment, reassignBlockedTeams } from './scatter';
import { degreeOf, findPath, type Cell } from './pathfinding';

const NORMAL_MIN = 17;
const NORMAL_MAX = 25;
const NORMAL_DEFAULT = 23;
const REDUCED_MIN = 6;
const REDUCED_MAX = 10;
const REDUCED_DEFAULT = 8;

interface PhaseConstants {
  introBeat: number;
  introZoom: number;
  hold: number;
  scatterMax: number;
  approach: number;
  reveal: number;
  chaseMin: number;
  chaseMax: number;
}

const PHASE_NORMAL: PhaseConstants = {
  introBeat: 0.3,
  introZoom: 1.0,
  hold: 1.0,
  scatterMax: 3.0,
  approach: 2.0,
  reveal: 1.2,
  chaseMin: 8.5,
  chaseMax: 16.5,
};

const PHASE_REDUCED: PhaseConstants = {
  introBeat: 0.15,
  introZoom: 0.5,
  hold: 0.4,
  scatterMax: 1.2,
  approach: 0.8,
  reveal: 0.6,
  chaseMin: 2.35,
  chaseMax: 6.35,
};

// Kept low so every team still gets most of scatterMax to actually walk — teams now scatter
// into far corners (see scatter.ts's farthest-point sampling), and a big stagger fraction
// would leave a late-departing team with too little time to cover a long path.
const SCATTER_STAGGER_FRACTION = 0.15;
const FAKEOUT_SEED_OFFSET = 7001;
const FAKEOUT_PAUSE_SEC_NORMAL = 0.5;

export interface HideSeekPhaseTimes {
  introBeatEnd: number;
  introZoomEnd: number;
  holdEnd: number;
  scatterEnd: number;
  approachEnd: number;
  chaseEnd: number;
  revealEnd: number;
}

export interface TeamScatterStep {
  cell: Cell;
  arriveSec: number;
}

export interface TeamScatterPlan {
  teamId: string;
  targetCell: Cell;
  path: Cell[];
  steps: TeamScatterStep[];
  departSec: number;
}

export interface ChaseStep {
  cell: Cell;
  arriveSec: number;
  fakeoutPause?: boolean;
}

export interface HideSeekPlan {
  durationSec: number;
  phaseTimes: HideSeekPhaseTimes;
  entrance: Cell;
  scatter: TeamScatterPlan[];
  chasePath: ChaseStep[];
  targetTeamId: string;
}

export interface HideSeekPlanInput {
  teamIds: string[];
  targetTeamId: string;
  grid: Grid;
  entrance?: Cell;
  seed: number;
  targetDurationSec?: number;
  reducedMotion?: boolean;
}

function fixedSum(p: PhaseConstants): number {
  return p.introBeat + p.introZoom + p.hold + p.scatterMax + p.approach + p.reveal;
}

function cellId(cell: Cell): string {
  return `${cell[0]},${cell[1]}`;
}

/** Every cell the seeker's route to `targetCell` passes through, plus each of those cells'
 *  direct neighbors (a one-step buffer so a hiding team isn't standing right at the corridor's
 *  elbow either) — used to keep every *other* team off the seeker's route (see
 *  scatter.ts's `reassignBlockedTeams`) so the seeker never visibly walks past someone it
 *  hasn't "found" yet. The target's own cell is deliberately not blocked — that's the
 *  destination, not something to route around. */
function buildRouteBlockedCells(grid: Grid, entrance: Cell, targetCell: Cell): Set<string> {
  const path = findPath(grid, entrance[0], entrance[1], targetCell[0], targetCell[1]) ?? [entrance, targetCell];
  const blocked = new Set<string>();
  for (const cell of path) {
    blocked.add(cellId(cell));
    for (const n of neighborsOf(grid, cell[0], cell[1])) blocked.add(cellId(n));
  }
  blocked.delete(cellId(targetCell));
  return blocked;
}

function buildScatterPlan(
  grid: Grid,
  entrance: Cell,
  assignment: Record<string, Cell>,
  teamIds: string[],
  holdEnd: number,
  scatterEnd: number,
  scatterMax: number
): TeamScatterPlan[] {
  const n = teamIds.length;
  return teamIds.map((teamId, i) => {
    const targetCell = assignment[teamId];
    const path = findPath(grid, entrance[0], entrance[1], targetCell[0], targetCell[1]) ?? [entrance, targetCell];
    const departOffset = n <= 1 ? 0 : (i / (n - 1)) * SCATTER_STAGGER_FRACTION * scatterMax;
    const departSec = holdEnd + departOffset;
    const stepCount = Math.max(1, path.length - 1);
    const perStepSec = (scatterEnd - departSec) / stepCount;
    const steps: TeamScatterStep[] = path.slice(1).map((cell, idx) => ({
      cell,
      arriveSec: idx === stepCount - 1 ? scatterEnd : departSec + (idx + 1) * perStepSec,
    }));
    return { teamId, targetCell, path, steps, departSec };
  });
}

function buildChasePath(
  grid: Grid,
  entrance: Cell,
  targetCell: Cell,
  approachEnd: number,
  chaseDurationSec: number,
  seed: number,
  reducedMotion: boolean
): ChaseStep[] {
  const path = findPath(grid, entrance[0], entrance[1], targetCell[0], targetCell[1]) ?? [entrance, targetCell];

  const eligible: number[] = [];
  for (let i = 2; i < path.length - 2; i++) {
    const [r, c] = path[i];
    if (degreeOf(grid, r, c) >= 3) eligible.push(i);
  }

  const fakeoutPauseSec = reducedMotion ? 0 : FAKEOUT_PAUSE_SEC_NORMAL;
  const rng = makeRng(seed + FAKEOUT_SEED_OFFSET);
  let fakeoutCount = 0;
  if (!reducedMotion && eligible.length > 0) {
    fakeoutCount = Math.min(2, eligible.length, rng() < 0.5 ? 1 : 2);
  }

  const fakeoutIndices = new Set<number>();
  const pool = eligible.slice();
  for (let k = 0; k < fakeoutCount && pool.length > 0; k++) {
    const j = Math.floor(rng() * pool.length);
    fakeoutIndices.add(pool[j]);
    pool.splice(j, 1);
  }

  const stepCount = Math.max(1, path.length - 1);
  const walkBudget = chaseDurationSec - fakeoutIndices.size * fakeoutPauseSec;
  const perStepSec = walkBudget / stepCount;

  const chasePath: ChaseStep[] = [{ cell: path[0], arriveSec: approachEnd, fakeoutPause: fakeoutIndices.has(0) }];
  let t = approachEnd;
  for (let i = 1; i < path.length; i++) {
    const prevPaused = fakeoutIndices.has(i - 1);
    t += perStepSec + (prevPaused ? fakeoutPauseSec : 0);
    const arriveSec = i === path.length - 1 ? approachEnd + chaseDurationSec : t;
    chasePath.push({ cell: path[i], arriveSec, fakeoutPause: fakeoutIndices.has(i) });
  }
  return chasePath;
}

export function buildHideSeekPlan(input: HideSeekPlanInput): HideSeekPlan {
  const { teamIds, targetTeamId, grid, seed } = input;
  const entrance: Cell = input.entrance ?? [0, 0];
  const reducedMotion = !!input.reducedMotion;
  const phaseConst = reducedMotion ? PHASE_REDUCED : PHASE_NORMAL;

  const minDuration = reducedMotion ? REDUCED_MIN : NORMAL_MIN;
  const maxDuration = reducedMotion ? REDUCED_MAX : NORMAL_MAX;
  const defaultDuration = reducedMotion ? REDUCED_DEFAULT : NORMAL_DEFAULT;
  const durationSec = clamp(input.targetDurationSec ?? defaultDuration, minDuration, maxDuration);

  const fixed = fixedSum(phaseConst);
  const chaseDurationSec = clamp(durationSec - fixed, phaseConst.chaseMin, phaseConst.chaseMax);

  const introBeatEnd = phaseConst.introBeat;
  const introZoomEnd = introBeatEnd + phaseConst.introZoom;
  const holdEnd = introZoomEnd + phaseConst.hold;
  const scatterEnd = holdEnd + phaseConst.scatterMax;
  const approachEnd = scatterEnd + phaseConst.approach;
  const chaseEnd = approachEnd + chaseDurationSec;
  const revealEnd = chaseEnd + phaseConst.reveal;

  const phaseTimes: HideSeekPhaseTimes = {
    introBeatEnd,
    introZoomEnd,
    holdEnd,
    scatterEnd,
    approachEnd,
    chaseEnd,
    revealEnd,
  };

  let assignment = computeScatterAssignment(grid, entrance, teamIds, seed);
  // The target's cell is fixed the moment it's assigned — never touched by the reassignment
  // pass below, since it's the seeker's actual destination, not a "blocking" hazard.
  const targetCell = assignment[targetTeamId];

  const blockedCells = buildRouteBlockedCells(grid, entrance, targetCell);
  const otherTeamIds = teamIds.filter((id) => id !== targetTeamId);
  assignment = reassignBlockedTeams(grid, entrance, assignment, otherTeamIds, blockedCells, seed);

  const scatter = buildScatterPlan(grid, entrance, assignment, teamIds, holdEnd, scatterEnd, phaseConst.scatterMax);
  const chasePath = buildChasePath(grid, entrance, targetCell, approachEnd, chaseDurationSec, seed, reducedMotion);

  return { durationSec, phaseTimes, entrance, scatter, chasePath, targetTeamId };
}
