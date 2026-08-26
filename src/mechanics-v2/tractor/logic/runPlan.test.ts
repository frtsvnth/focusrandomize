import { describe, it, expect } from 'vitest';
import { buildRunPlan, type RunPlanInput } from './runPlan';

function teamIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `team-${i}`);
}

function baseInput(overrides: Partial<RunPlanInput> = {}): RunPlanInput {
  const ids = teamIds(8);
  return { teamIds: ids, winnerId: ids[0], seed: 12345, ...overrides };
}

describe('buildRunPlan', () => {
  it('is deterministic for a given seed', () => {
    const a = buildRunPlan(baseInput());
    const b = buildRunPlan(baseInput());
    expect(a).toEqual(b);
  });

  it('produces a different ejection order for a different seed', () => {
    const a = buildRunPlan(baseInput({ seed: 1 }));
    const b = buildRunPlan(baseInput({ seed: 2 }));
    expect(a.ejections.map((e) => e.teamId)).not.toEqual(b.ejections.map((e) => e.teamId));
  });

  it('never ejects the winner', () => {
    for (const seed of [1, 2, 3, 4, 5, 999]) {
      const plan = buildRunPlan(baseInput({ seed }));
      expect(plan.ejections.some((e) => e.teamId === baseInput().winnerId)).toBe(false);
    }
    // The winner also never appears in an 'ejection' timeline entry, only its own closeCall.
    const plan = buildRunPlan(baseInput());
    const winnerId = baseInput().winnerId;
    for (const event of plan.timeline) {
      if (event.type === 'ejection') expect(event.teamIds).not.toContain(winnerId);
    }
  });

  it('ejects exactly teamCount - 1 teams, one entry per losing team', () => {
    for (const n of [2, 3, 5, 8, 12, 20]) {
      const ids = teamIds(n);
      const plan = buildRunPlan(baseInput({ teamIds: ids, winnerId: ids[0] }));
      expect(plan.ejections).toHaveLength(n - 1);
      const ejectedIds = plan.ejections.map((e) => e.teamId).sort();
      expect(ejectedIds).toEqual(ids.slice(1).sort());
    }
  });

  it('keeps the total duration within 20-30s, even if a wild target is requested', () => {
    for (const target of [1, 10, 20, 25, 30, 60, 999]) {
      const plan = buildRunPlan(baseInput({ targetDurationSec: target }));
      expect(plan.durationSec).toBeGreaterThanOrEqual(20);
      expect(plan.durationSec).toBeLessThanOrEqual(30);
    }
  });

  it('shortens duration into a 6-10s range when reducedMotion is set, ignoring the normal 20-30s clamp', () => {
    for (const target of [1, 8, 20, 25, 999]) {
      const plan = buildRunPlan(baseInput({ targetDurationSec: target, reducedMotion: true }));
      expect(plan.durationSec).toBeGreaterThanOrEqual(6);
      expect(plan.durationSec).toBeLessThanOrEqual(10);
    }
  });

  it('still produces a full valid choreography (all ejections, one finale) when reducedMotion is set', () => {
    const ids = teamIds(8);
    const plan = buildRunPlan(baseInput({ teamIds: ids, winnerId: ids[0], reducedMotion: true }));
    expect(plan.ejections).toHaveLength(7);
    expect(plan.ejections.some((e) => e.teamId === ids[0])).toBe(false);
    expect(Number.isFinite(plan.finaleX)).toBe(true);
  });

  it('spaces ejections with shrinking gaps toward the finale', () => {
    const ids = teamIds(8);
    const plan = buildRunPlan(baseInput({ teamIds: ids, winnerId: ids[0] }));
    const gaps: number[] = [];
    const ejectionTimes = plan.timeline.filter((e) => e.type === 'ejection').map((e) => e.timeSec);
    for (let i = 1; i < ejectionTimes.length; i++) gaps.push(ejectionTimes[i] - ejectionTimes[i - 1]);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1] + 1e-9);
    }
  });

  it('places the finale strictly after every ejection bump', () => {
    const plan = buildRunPlan(baseInput());
    for (const e of plan.ejections) {
      expect(plan.finaleX).toBeGreaterThan(e.bumpX);
    }
  });

  it('uses only valid ejection styles, and "double" only for paired (10+ team) ejections', () => {
    const validStyles = new Set(['highArc', 'backflip', 'frontWall', 'double']);
    for (const n of [4, 8, 9, 10, 15, 25]) {
      const ids = teamIds(n);
      const plan = buildRunPlan(baseInput({ teamIds: ids, winnerId: ids[0], seed: n }));
      for (const e of plan.ejections) expect(validStyles.has(e.style)).toBe(true);
      if (n < 10) {
        expect(plan.ejections.every((e) => e.style !== 'double')).toBe(true);
      }
    }
  });

  it('pairs losers into double ejections at 10+ teams', () => {
    const ids = teamIds(11);
    const plan = buildRunPlan(baseInput({ teamIds: ids, winnerId: ids[0], seed: 7 }));
    const doubles = plan.ejections.filter((e) => e.style === 'double');
    expect(doubles.length).toBeGreaterThan(0);
    // Doubled teams share a bumpX with exactly one other doubled team.
    const byBumpX = new Map<number, number>();
    for (const e of doubles) byBumpX.set(e.bumpX, (byBumpX.get(e.bumpX) ?? 0) + 1);
    for (const count of byBumpX.values()) expect(count).toBeLessThanOrEqual(2);
  });

  it('handles the 1-team edge case without crashing: no ejections, still returns a finale', () => {
    const ids = teamIds(1);
    const plan = buildRunPlan(baseInput({ teamIds: ids, winnerId: ids[0] }));
    expect(plan.ejections).toHaveLength(0);
    expect(Number.isFinite(plan.finaleX)).toBe(true);
    expect(plan.timeline.some((e) => e.type === 'closeCall')).toBe(true);
  });

  it('handles the 2-team edge case: exactly one ejection, the loser', () => {
    const ids = teamIds(2);
    const plan = buildRunPlan(baseInput({ teamIds: ids, winnerId: ids[0] }));
    expect(plan.ejections).toHaveLength(1);
    expect(plan.ejections[0].teamId).toBe(ids[1]);
  });

  it('includes exactly one closeCall timeline entry, for the winner', () => {
    const plan = buildRunPlan(baseInput());
    const closeCalls = plan.timeline.filter((e) => e.type === 'closeCall');
    expect(closeCalls).toHaveLength(1);
    expect(closeCalls[0].teamIds).toEqual([baseInput().winnerId]);
  });
});
