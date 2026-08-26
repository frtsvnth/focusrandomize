import { describe, it, expect } from 'vitest';
import { computeSeatLayout, assignSeats, shuffleSeatOrder } from './seating';

const ROOMY = { availableWidth: 2000, seatWidth: 40 };
const TIGHT = { availableWidth: 200, seatWidth: 40 };

describe('computeSeatLayout', () => {
  it('keeps a single full-scale row when there is plenty of room', () => {
    for (const n of [1, 2, 5, 8]) {
      const layout = computeSeatLayout({ teamCount: n, ...ROOMY });
      expect(layout.rows).toBe(1);
      expect(layout.perRow).toEqual([n]);
      expect(layout.scale).toBe(1);
    }
  });

  it('splits into two rows and scales down when a single row would get too cramped', () => {
    const layout = computeSeatLayout({ teamCount: 12, ...TIGHT });
    expect(layout.rows).toBe(2);
    expect(layout.perRow[0] + layout.perRow[1]).toBe(12);
    expect(layout.scale).toBeLessThan(1);
    expect(layout.scale).toBeGreaterThanOrEqual(0.4);
  });

  it('scales down further as the roster grows for a fixed width', () => {
    const medium = computeSeatLayout({ teamCount: 14, ...TIGHT });
    const large = computeSeatLayout({ teamCount: 24, ...TIGHT });
    expect(large.scale).toBeLessThanOrEqual(medium.scale);
  });

  it('never returns a scale below the legibility floor', () => {
    const layout = computeSeatLayout({ teamCount: 60, ...TIGHT });
    expect(layout.scale).toBeGreaterThanOrEqual(0.4);
  });
});

describe('assignSeats', () => {
  it('produces exactly one slot per team, matching the row layout', () => {
    const layout = computeSeatLayout({ teamCount: 11, ...TIGHT });
    const slots = assignSeats(layout);
    expect(slots).toHaveLength(11);
    for (let row = 0; row < layout.rows; row++) {
      expect(slots.filter((s) => s.row === row)).toHaveLength(layout.perRow[row]);
    }
  });
});

describe('shuffleSeatOrder', () => {
  it('is deterministic for a given seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffleSeatOrder(items, 42)).toEqual(shuffleSeatOrder(items, 42));
  });

  it('is a permutation of the input', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffleSeatOrder(items, 7);
    expect(shuffled.slice().sort()).toEqual(items.slice().sort());
  });

  it('differs across seeds (for a large enough input)', () => {
    const items = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(shuffleSeatOrder(items, 1)).not.toEqual(shuffleSeatOrder(items, 2));
  });
});
