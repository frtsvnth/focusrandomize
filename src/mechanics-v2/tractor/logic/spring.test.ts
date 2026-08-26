import { describe, it, expect } from 'vitest';
import { Spring1D } from './spring';

function run(spring: Spring1D, target: number, steps: number, dt: number) {
  for (let i = 0; i < steps; i++) spring.update(target, dt);
  return spring.value;
}

describe('Spring1D', () => {
  it('converges toward a fixed target over time', () => {
    const spring = new Spring1D(0, 150, 20);
    const value = run(spring, 100, 600, 1 / 60);
    expect(value).toBeCloseTo(100, 0);
  });

  it('is deterministic for identical inputs', () => {
    const a = new Spring1D(0, 60, 8);
    const b = new Spring1D(0, 60, 8);
    for (let i = 0; i < 120; i++) {
      const target = Math.sin(i * 0.1) * 40;
      a.update(target, 1 / 60);
      b.update(target, 1 / 60);
    }
    expect(a.value).toBe(b.value);
    expect(a.velocity).toBe(b.velocity);
  });

  it('an underdamped spring overshoots a step target', () => {
    const spring = new Spring1D(0, 100, 4);
    let maxValue = 0;
    for (let i = 0; i < 120; i++) {
      spring.update(50, 1 / 60);
      maxValue = Math.max(maxValue, spring.value);
    }
    expect(maxValue).toBeGreaterThan(50);
  });

  it('reset snaps the value and clears velocity', () => {
    const spring = new Spring1D(0, 150, 20);
    spring.update(100, 1 / 60);
    spring.reset(10);
    expect(spring.value).toBe(10);
    expect(spring.velocity).toBe(0);
  });

  it('stays numerically stable through a single large dt (a dropped/backgrounded frame)', () => {
    // Matches the stiffest real spring in the scene (tractor pitch) — plain semi-implicit
    // Euler at dt=0.25 diverges exponentially for this stiffness; substepping must not.
    const spring = new Spring1D(0, 260, 26);
    spring.update(0.4, 0.25);
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(Math.abs(spring.value)).toBeLessThan(10);
  });

  it('still converges to the target after a run full of large, jittery dts', () => {
    const spring = new Spring1D(0, 260, 26);
    const dts = [0.25, 0.02, 0.18, 0.25, 0.01, 0.25, 0.03];
    for (let i = 0; i < 40; i++) {
      for (const dt of dts) spring.update(1, dt);
    }
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(spring.value).toBeCloseTo(1, 1);
  });
});
