import { makeRng } from '../../engine/canvasUtils';

/**
 * Pure road-profile generator — no Phaser, no DOM. `roadHeight(x)` is a deterministic
 * function of world x: a low-amplitude sine-sum ("washboard" background bumps) plus a
 * handful of seeded gaussian humps ("mega-kochki"), fading to a flat plateau at the end
 * of the course (where the ride settles for the reveal).
 *
 * Height convention: larger roadHeight(x) = terrain raised further off the baseline
 * (screen-space callers subtract it from a baseline y, since y grows downward).
 */

export interface RoadFeature {
  /** World x of the hump's peak. */
  x: number;
  /** Peak height of the hump, in world units. */
  amplitude: number;
  /** Gaussian width (stddev) of the hump, in world units. */
  sigma: number;
}

export interface RoadProfile {
  seed: number;
  /** Total world length of the course. */
  length: number;
  /** World x where the final flat plateau begins (before the fade-out finishes). */
  plateauStart: number;
  features: RoadFeature[];
  roadHeight(x: number): number;
}

export interface RoadProfileOptions {
  length?: number;
  plateauLength?: number;
  featureCount?: number;
  /**
   * Explicit hump centers, e.g. the `bumpX` values from logic/runPlan.ts's ejections — when
   * given, humps are placed at exactly these x's (still seeded amplitude/sigma) instead of
   * being spread out automatically, so the choreographed ejections and the terrain agree on
   * where the "mega-kochki" are. Overrides `featureCount`.
   */
  featureXPositions?: number[];
}

// Also mirrored in runPlan.ts's own DEFAULT_COURSE_LENGTH — both default to the same course
// length so bumpX/finaleX line up with the terrain when the scene doesn't pass an explicit one.
// Raised from 3200 (~56%) so the ride covers more ground in the same duration, i.e. a visibly
// faster base speed without changing how long a ride takes.
const DEFAULT_LENGTH = 5000;
const DEFAULT_PLATEAU_LENGTH = 420;
const DEFAULT_FEATURE_COUNT = 7;
const BACKGROUND_BUMP_WAVES = 3;
const BACKGROUND_BUMPINESS = 9;
const HUMP_MIN_AMPLITUDE = 40;
const HUMP_MAX_AMPLITUDE = 105;
const HUMP_MIN_SIGMA = 55;
const HUMP_MAX_SIGMA = 100;
const PLATEAU_FADE_LENGTH = 140;

const TWO_PI = Math.PI * 2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function generateRoadProfile(seed: number, options: RoadProfileOptions = {}): RoadProfile {
  const length = options.length ?? DEFAULT_LENGTH;
  const plateauLength = options.plateauLength ?? DEFAULT_PLATEAU_LENGTH;
  const featureCount = options.featureCount ?? DEFAULT_FEATURE_COUNT;
  const plateauStart = length - plateauLength;

  const rng = makeRng(seed);

  const bumpWaves = Array.from({ length: BACKGROUND_BUMP_WAVES }, (_, i) => ({
    freq: (0.006 + rng() * 0.01) * (i + 1),
    phase: rng() * TWO_PI,
    amp: (BACKGROUND_BUMPINESS * (0.5 + rng() * 0.5)) / (i + 1),
  }));

  let featureXs: number[];
  if (options.featureXPositions) {
    featureXs = options.featureXPositions;
  } else {
    const usableStart = length * 0.12;
    const usableEnd = plateauStart - 120;
    const span = Math.max(0, usableEnd - usableStart);
    const slot = span / (featureCount + 1);
    featureXs = Array.from({ length: featureCount }, (_, i) => {
      const jitter = (rng() - 0.5) * slot * 0.5;
      return usableStart + slot * (i + 1) + jitter;
    });
  }

  const features: RoadFeature[] = featureXs.map((x) => ({
    x,
    amplitude: HUMP_MIN_AMPLITUDE + rng() * (HUMP_MAX_AMPLITUDE - HUMP_MIN_AMPLITUDE),
    sigma: HUMP_MIN_SIGMA + rng() * (HUMP_MAX_SIGMA - HUMP_MIN_SIGMA),
  }));

  function backgroundBumps(x: number): number {
    let h = 0;
    for (const w of bumpWaves) h += Math.sin(x * w.freq + w.phase) * w.amp;
    return h;
  }

  function humps(x: number): number {
    let h = 0;
    for (const f of features) {
      const d = (x - f.x) / f.sigma;
      h += f.amplitude * Math.exp(-0.5 * d * d);
    }
    return h;
  }

  function roadHeight(x: number): number {
    const raw = backgroundBumps(x) + humps(x);
    if (x < plateauStart) return raw;
    const t = clamp01((x - plateauStart) / PLATEAU_FADE_LENGTH);
    return raw * (1 - smoothstep(t));
  }

  return { seed, length, plateauStart, features, roadHeight };
}
