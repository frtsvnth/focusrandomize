import { describe, it, expect } from 'vitest';
import { generateRoadProfile } from './road';

describe('generateRoadProfile', () => {
  it('is deterministic for a given seed', () => {
    const a = generateRoadProfile(12345);
    const b = generateRoadProfile(12345);

    expect(a.features).toEqual(b.features);
    expect(a.length).toBe(b.length);
    expect(a.plateauStart).toBe(b.plateauStart);

    const samples = [0, 50, 200, 777, 1500, 2400, 3000, 3199];
    for (const x of samples) {
      expect(a.roadHeight(x)).toBe(b.roadHeight(x));
    }
  });

  it('produces a different profile for a different seed', () => {
    const a = generateRoadProfile(1);
    const b = generateRoadProfile(2);

    expect(a.features).not.toEqual(b.features);
    expect(a.roadHeight(1000)).not.toBe(b.roadHeight(1000));
  });

  it('flattens out to (approximately) zero on the final plateau', () => {
    const profile = generateRoadProfile(999);
    expect(Math.abs(profile.roadHeight(profile.length - 1))).toBeLessThan(0.5);
    expect(Math.abs(profile.roadHeight(profile.length))).toBeLessThan(0.5);
  });

  it('places every feature within the course length', () => {
    const profile = generateRoadProfile(42);
    for (const f of profile.features) {
      expect(f.x).toBeGreaterThan(0);
      expect(f.x).toBeLessThan(profile.plateauStart);
    }
  });

  it('respects custom length/plateau/featureCount options', () => {
    const profile = generateRoadProfile(7, { length: 1000, plateauLength: 200, featureCount: 3 });
    expect(profile.length).toBe(1000);
    expect(profile.plateauStart).toBe(800);
    expect(profile.features).toHaveLength(3);
  });

  it('places humps at exact explicit x positions when given (for runPlan.ts ejections to line up)', () => {
    const bumpXs = [300, 900, 1450];
    const profile = generateRoadProfile(7, { featureXPositions: bumpXs });
    expect(profile.features.map((f) => f.x)).toEqual(bumpXs);
    // amplitude/sigma are still seeded, not fixed/degenerate.
    for (const f of profile.features) {
      expect(f.amplitude).toBeGreaterThan(0);
      expect(f.sigma).toBeGreaterThan(0);
    }
  });
});
