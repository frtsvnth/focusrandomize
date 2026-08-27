import { describe, it, expect } from 'vitest';
import { generateMaze, neighborsOf } from './maze';
import { buildHideSeekPlan, type HideSeekPlanInput } from './choreography';

function teamIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `team-${i}`);
}

function baseInput(overrides: Partial<HideSeekPlanInput> = {}): HideSeekPlanInput {
  const ids = teamIds(8);
  const grid = generateMaze(12, 9, 42);
  return { teamIds: ids, targetTeamId: ids[0], grid, seed: 12345, ...overrides };
}

describe('buildHideSeekPlan', () => {
  it('is deterministic for a given seed', () => {
    const a = buildHideSeekPlan(baseInput());
    const b = buildHideSeekPlan(baseInput());
    expect(a).toEqual(b);
  });

  it('produces a different scatter assignment and/or chase path for a different seed', () => {
    const a = buildHideSeekPlan(baseInput({ seed: 1 }));
    const b = buildHideSeekPlan(baseInput({ seed: 2 }));
    const cellsA = a.scatter.map((s) => s.targetCell.join(','));
    const cellsB = b.scatter.map((s) => s.targetCell.join(','));
    expect(cellsA).not.toEqual(cellsB);
  });

  it('always ends the chase path at the target team\'s own scatter cell', () => {
    for (const seed of [1, 2, 3, 4, 5, 999]) {
      const plan = buildHideSeekPlan(baseInput({ seed }));
      const targetScatter = plan.scatter.find((s) => s.teamId === plan.targetTeamId)!;
      const lastChaseCell = plan.chasePath[plan.chasePath.length - 1].cell;
      expect(lastChaseCell).toEqual(targetScatter.targetCell);
    }
  });

  it('keeps the total duration within 17-25s, even if a wild target is requested', () => {
    for (const target of [1, 10, 17, 20, 25, 30, 999]) {
      const plan = buildHideSeekPlan(baseInput({ targetDurationSec: target }));
      expect(plan.durationSec).toBeGreaterThanOrEqual(17);
      expect(plan.durationSec).toBeLessThanOrEqual(25);
    }
  });

  it('shortens duration into a 6-10s range when reducedMotion is set', () => {
    for (const target of [1, 8, 20, 25, 999]) {
      const plan = buildHideSeekPlan(baseInput({ targetDurationSec: target, reducedMotion: true }));
      expect(plan.durationSec).toBeGreaterThanOrEqual(6);
      expect(plan.durationSec).toBeLessThanOrEqual(10);
    }
  });

  it('phase boundaries are strictly increasing and revealEnd equals durationSec', () => {
    const plan = buildHideSeekPlan(baseInput());
    const { introBeatEnd, introZoomEnd, holdEnd, scatterEnd, approachEnd, chaseEnd, revealEnd } = plan.phaseTimes;
    const seq = [introBeatEnd, introZoomEnd, holdEnd, scatterEnd, approachEnd, chaseEnd, revealEnd];
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1]);
    expect(revealEnd).toBeCloseTo(plan.durationSec, 9);
  });

  it('every team scatters to a distinct cell and finishes exactly at scatterEnd', () => {
    const plan = buildHideSeekPlan(baseInput());
    const cells = plan.scatter.map((s) => s.targetCell.join(','));
    expect(new Set(cells).size).toBe(cells.length);
    for (const s of plan.scatter) {
      const last = s.steps[s.steps.length - 1];
      expect(last.arriveSec).toBeCloseTo(plan.phaseTimes.scatterEnd, 9);
    }
  });

  it('total chase time always equals the derived chase duration, regardless of fakeout count', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const plan = buildHideSeekPlan(baseInput({ seed }));
      const chaseDurationSec = plan.phaseTimes.chaseEnd - plan.phaseTimes.approachEnd;
      const last = plan.chasePath[plan.chasePath.length - 1];
      expect(last.arriveSec - plan.phaseTimes.approachEnd).toBeCloseTo(chaseDurationSec, 9);
    }
  });

  it('never places a fakeout pause on the start cell or the final two cells of the chase', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const plan = buildHideSeekPlan(baseInput({ seed }));
      const n = plan.chasePath.length;
      expect(plan.chasePath[0].fakeoutPause).toBeFalsy();
      if (n >= 2) expect(plan.chasePath[n - 1].fakeoutPause).toBeFalsy();
      if (n >= 3) expect(plan.chasePath[n - 2].fakeoutPause).toBeFalsy();
    }
  });

  it('never has fakeout pauses when reducedMotion is set', () => {
    const plan = buildHideSeekPlan(baseInput({ reducedMotion: true }));
    expect(plan.chasePath.every((step) => !step.fakeoutPause)).toBe(true);
  });

  it('never seats a non-target team on or adjacent to the seeker\'s route', () => {
    const grid = generateMaze(16, 12, 77);
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const plan = buildHideSeekPlan(baseInput({ grid, seed }));
      const routeCells = new Set(plan.chasePath.map((s) => s.cell.join(',')));
      const routeNeighbors = new Set<string>();
      for (const step of plan.chasePath) {
        for (const n of neighborsOf(grid, step.cell[0], step.cell[1])) routeNeighbors.add(n.join(','));
      }
      for (const s of plan.scatter) {
        if (s.teamId === plan.targetTeamId) continue;
        const key = s.targetCell.join(',');
        expect(routeCells.has(key)).toBe(false);
        expect(routeNeighbors.has(key)).toBe(false);
      }
    }
  });

  it('handles the 1-team edge case without crashing', () => {
    const ids = teamIds(1);
    const grid = generateMaze(8, 6, 3);
    const plan = buildHideSeekPlan(baseInput({ teamIds: ids, targetTeamId: ids[0], grid }));
    expect(plan.scatter).toHaveLength(1);
    expect(plan.chasePath.length).toBeGreaterThan(0);
  });
});
