import { makeRng } from '../../engine/canvasUtils';

/**
 * Pure seating layout — no Phaser. Given how much width is actually available in the
 * trailer bed and how wide one seat is at full size, decides how many rows and how much to
 * scale everyone down so the whole roster fits without seats overlapping. Pixel *placement*
 * (x/y of each seat) is still the scene's job; this only answers "how many rows, how big."
 */

export interface SeatSlot {
  /** 0 = front row (nearer the tractor / front wall), 1 = back row. */
  row: number;
  /** Position within the row, 0 = first seat. */
  col: number;
}

export interface SeatLayout {
  rows: number;
  perRow: number[];
  /** Uniform character scale-down so a crowded trailer still fits. */
  scale: number;
}

export interface SeatFitInput {
  teamCount: number;
  /** Usable seating width in the trailer bed, in px, at scale 1. */
  availableWidth: number;
  /** Footprint one seat needs (character width + gap) at scale 1, in px. */
  seatWidth: number;
}

const MIN_SCALE = 0.4;
/** Below this we'd rather split into two rows than keep shrinking a single one. */
const ONE_ROW_MIN_COMFORTABLE_SCALE = 0.82;

function scaleToFit(teamCount: number, rows: number, availableWidth: number, seatWidth: number): number {
  const perRow = Math.ceil(teamCount / rows);
  const needed = perRow * seatWidth;
  return needed > 0 ? Math.min(1, availableWidth / needed) : 1;
}

export function computeSeatLayout({ teamCount, availableWidth, seatWidth }: SeatFitInput): SeatLayout {
  if (teamCount <= 0) return { rows: 1, perRow: [0], scale: 1 };

  const oneRowScale = scaleToFit(teamCount, 1, availableWidth, seatWidth);
  if (teamCount <= 4 || oneRowScale >= ONE_ROW_MIN_COMFORTABLE_SCALE) {
    return { rows: 1, perRow: [teamCount], scale: Math.max(MIN_SCALE, oneRowScale) };
  }

  const front = Math.ceil(teamCount / 2);
  const back = teamCount - front;
  const twoRowScale = scaleToFit(teamCount, 2, availableWidth, seatWidth);
  return { rows: 2, perRow: [front, back], scale: Math.max(MIN_SCALE, twoRowScale) };
}

export function assignSeats(layout: SeatLayout): SeatSlot[] {
  const slots: SeatSlot[] = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.perRow[row]; col++) {
      slots.push({ row, col });
    }
  }
  return slots;
}

/** Deterministic seeded shuffle (Fisher-Yates) — same seed always gives the same seating order. */
export function shuffleSeatOrder<T>(items: T[], seed: number): T[] {
  const rng = makeRng(seed);
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
