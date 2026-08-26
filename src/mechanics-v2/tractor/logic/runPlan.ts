import { clamp, makeRng } from '../../engine/canvasUtils';

/**
 * Pure ride choreography — no Phaser. Turns a winner (already decided by
 * engine/selectionEngine.ts's selectNextTeam) into a full script: which losing team gets
 * thrown from the trailer at which mega-hump, in what style, and when — building up to the
 * winner's own close-call at the very end. `bumpX` values are meant to be passed straight
 * into logic/road.ts's `generateRoadProfile(seed, { featureXPositions })` so the terrain's
 * humps land exactly where the choreography needs them.
 *
 * This is deliberately scripted, not simulated: the winner is decided up front and never
 * appears in `ejections` — the ride just performs the reveal.
 */

export type EjectionStyle = 'highArc' | 'backflip' | 'frontWall' | 'double';

export interface Ejection {
  teamId: string;
  /** World x (same units as logic/road.ts) where this team's hump/ejection happens. */
  bumpX: number;
  style: EjectionStyle;
  /** This elimination gets an extra "almost didn't happen" beat before it does. */
  fakeout?: boolean;
}

export type TimelineEventType = 'ejection' | 'closeCall';

export interface TimelineEvent {
  type: TimelineEventType;
  timeSec: number;
  x: number;
  teamIds: string[];
}

export interface RunPlan {
  ejections: Ejection[];
  /** World x of the winner's close-call, at/near the course's finishing plateau. */
  finaleX: number;
  timeline: TimelineEvent[];
  durationSec: number;
}

export interface RunPlanInput {
  teamIds: string[];
  winnerId: string;
  seed: number;
  /** Clamped into [MIN_DURATION, MAX_DURATION]. */
  targetDurationSec?: number;
  /** Must match the `length` given to road.ts's generateRoadProfile for bumpX/finaleX to
   * land where intended. Defaults to road.ts's own default course length (3200). */
  courseLength?: number;
  /** Accessibility mode: clamps duration into a much shorter [REDUCED_MIN, REDUCED_MAX]
   * range instead of the normal 20-30s — the scene itself is responsible for dropping
   * camera/particle flourishes (via its own reducedMotion flag), this only shortens the ride. */
  reducedMotion?: boolean;
}

const MIN_DURATION = 20;
const MAX_DURATION = 30;
const DEFAULT_DURATION = 25;
const REDUCED_MIN_DURATION = 6;
const REDUCED_MAX_DURATION = 10;
const REDUCED_DEFAULT_DURATION = 8;
const DEFAULT_COURSE_LENGTH = 3200;

/** At 10+ teams, pair losers up two-to-a-hump so the pacing budget can still cover everyone. */
const DOUBLE_EJECTION_TEAM_THRESHOLD = 10;
const FRONT_WALL_CHANCE = 0.12;
const FAKEOUT_CHANCE = 0.25;

// Fraction of the ride reserved before the first ejection / after the last one (for the
// winner's close-call and the final reveal) — the rest is divided among the ejections
// themselves, with each gap shorter than the last (pacing accelerates toward the finale).
const INTRO_RATIO = 0.12;
const OUTRO_RATIO = 0.1;

// Keep bumps off the very start of the course and well clear of the flattening plateau —
// mirrors logic/road.ts's own `usableStart`/`usableEnd` margins.
const USABLE_START_RATIO = 0.12;
const USABLE_END_RATIO = 0.82;

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = makeRng(seed);
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickSoloStyle(rng: () => number): EjectionStyle {
  if (rng() < FRONT_WALL_CHANCE) return 'frontWall';
  return rng() < 0.5 ? 'highArc' : 'backflip';
}

export function buildRunPlan(input: RunPlanInput): RunPlan {
  const { teamIds, winnerId, seed, reducedMotion } = input;
  const courseLength = input.courseLength ?? DEFAULT_COURSE_LENGTH;
  const minDuration = reducedMotion ? REDUCED_MIN_DURATION : MIN_DURATION;
  const maxDuration = reducedMotion ? REDUCED_MAX_DURATION : MAX_DURATION;
  const defaultDuration = reducedMotion ? REDUCED_DEFAULT_DURATION : DEFAULT_DURATION;
  const durationSec = clamp(input.targetDurationSec ?? defaultDuration, minDuration, maxDuration);

  const losers = teamIds.filter((id) => id !== winnerId);
  const shuffledLosers = seededShuffle(losers, seed + 1);

  const useDoubles = teamIds.length >= DOUBLE_EJECTION_TEAM_THRESHOLD;
  const groups: string[][] = [];
  if (useDoubles) {
    for (let i = 0; i < shuffledLosers.length; i += 2) {
      groups.push(shuffledLosers.slice(i, i + 2));
    }
  } else {
    for (const id of shuffledLosers) groups.push([id]);
  }

  const numEvents = groups.length;
  const styleRng = makeRng(seed + 2);

  const usableStart = courseLength * USABLE_START_RATIO;
  const usableEnd = courseLength * USABLE_END_RATIO;
  const introTime = durationSec * INTRO_RATIO;
  const eventsSpan = durationSec * (1 - INTRO_RATIO - OUTRO_RATIO);

  const ejections: Ejection[] = [];
  const timeline: TimelineEvent[] = [];

  if (numEvents > 0) {
    // Descending weights -> descending gaps: early eliminations are spaced further apart,
    // later ones come faster and faster as the reveal approaches.
    const weights = groups.map((_, i) => numEvents - i);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    let cumulativeTime = introTime;
    for (let i = 0; i < numEvents; i++) {
      cumulativeTime += (eventsSpan * weights[i]) / weightSum;
      const timeFraction = numEvents === 1 ? 1 : (cumulativeTime - introTime) / eventsSpan;
      const bumpX = usableStart + (usableEnd - usableStart) * clamp(timeFraction, 0, 1);

      const group = groups[i];
      const isDouble = group.length === 2;
      for (const teamId of group) {
        const style: EjectionStyle = isDouble ? 'double' : pickSoloStyle(styleRng);
        const fakeout = styleRng() < FAKEOUT_CHANCE || undefined;
        ejections.push({ teamId, bumpX, style, fakeout });
      }
      timeline.push({ type: 'ejection', timeSec: cumulativeTime, x: bumpX, teamIds: group });
    }
  }

  const finaleX = clamp(usableEnd + (courseLength - usableEnd) * 0.5, usableEnd, courseLength);
  const finaleTime =
    numEvents > 0 ? Math.min(introTime + eventsSpan + durationSec * OUTRO_RATIO * 0.6, durationSec) : durationSec * 0.5;
  timeline.push({ type: 'closeCall', timeSec: finaleTime, x: finaleX, teamIds: [winnerId] });

  return { ejections, finaleX, timeline, durationSec };
}
