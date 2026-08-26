import { describe, it, expect } from 'vitest';
import { createSpeedScript } from './speedProfile';

const DURATION = 40;
const DISTANCE = 2800;

describe('createSpeedScript', () => {
  it('starts and ends at a standstill', () => {
    const { speedAt, durationSec } = createSpeedScript(DURATION, DISTANCE);
    expect(speedAt(0)).toBe(0);
    expect(speedAt(-1)).toBe(0);
    expect(speedAt(durationSec)).toBe(0);
    expect(speedAt(durationSec + 5)).toBe(0);
  });

  it('accelerates, then holds a cruise speed', () => {
    const { speedAt } = createSpeedScript(DURATION, DISTANCE);
    const early = speedAt(DURATION * 0.02);
    const later = speedAt(DURATION * 0.08);
    expect(later).toBeGreaterThan(early);

    const cruise1 = speedAt(DURATION * 0.2);
    const cruise2 = speedAt(DURATION * 0.4);
    expect(cruise1).toBeCloseTo(cruise2, 5);
  });

  it('accelerates again toward a faster finale speed, then brakes back down', () => {
    const { speedAt } = createSpeedScript(DURATION, DISTANCE);
    const cruise = speedAt(DURATION * 0.3);
    const finale = speedAt(DURATION * 0.62);
    expect(finale).toBeGreaterThan(cruise);

    const brakingStart = speedAt(DURATION * 0.82);
    const brakingLater = speedAt(DURATION * 0.97);
    expect(brakingLater).toBeLessThan(brakingStart);
  });

  it('is deterministic', () => {
    const { speedAt } = createSpeedScript(DURATION, DISTANCE);
    for (const t of [0, 1, 5, 10, 20, 30, 38, 40]) {
      expect(speedAt(t)).toBe(speedAt(t));
    }
  });

  it('covers roughly the requested distance over the requested duration', () => {
    const { speedAt, durationSec } = createSpeedScript(DURATION, DISTANCE);
    const steps = 4000;
    const dt = durationSec / steps;
    let distance = 0;
    for (let i = 0; i < steps; i++) distance += speedAt(i * dt) * dt;
    expect(distance).toBeGreaterThan(DISTANCE * 0.9);
    expect(distance).toBeLessThan(DISTANCE * 1.1);
  });

  it('scales up cruise speed for a shorter duration covering the same distance', () => {
    const short = createSpeedScript(30, DISTANCE);
    const long = createSpeedScript(60, DISTANCE);
    expect(short.speedAt(15)).toBeGreaterThan(long.speedAt(30));
  });
});
