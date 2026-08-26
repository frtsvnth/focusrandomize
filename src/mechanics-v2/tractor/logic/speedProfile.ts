import { easeOutCubic, easeInCubic } from '../../engine/canvasUtils';

/**
 * Pure speed-over-time script — no Phaser. Four phases: accelerate from a stop, cruise,
 * accelerate again toward the finale, then brake back to a stop, sized so the ride covers
 * `targetDistance` over `durationSec` — the caller (the scene) integrates x by accumulating
 * `speedAt(t) * dt` each frame, and needs the vehicle to actually arrive at runPlan.ts's
 * `finaleX` within the plan's own duration for the choreography to land on time.
 */

const ACCEL_FRACTION = 0.1;
const CRUISE_FRACTION = 0.42;
const FINALE_FRACTION = 0.2;
const BRAKE_FRACTION = 0.28;
/** How much faster the "sprint to the finale" phase is than cruise speed. */
const FINALE_SPEED_MULT = 1.55;

export interface SpeedScript {
  durationSec: number;
  speedAt(t: number): number;
}

export function createSpeedScript(durationSec: number, targetDistance: number): SpeedScript {
  const accelT = durationSec * ACCEL_FRACTION;
  const cruiseT = durationSec * CRUISE_FRACTION;
  const finaleT = durationSec * FINALE_FRACTION;
  const brakeT = durationSec * BRAKE_FRACTION;
  const k = FINALE_SPEED_MULT;

  // Distance under each eased phase, as a fraction of (peak speed * phase duration) — exact
  // for easeOutCubic/easeInCubic's average value over [0,1]. Solve for the cruise speed that
  // makes the whole scripted ride cover targetDistance.
  const weight = 0.75 * accelT + cruiseT + (1 + (k - 1) * 0.25) * finaleT + 0.75 * k * brakeT;
  const cruiseSpeed = weight > 0 ? targetDistance / weight : 0;
  const finaleSpeed = cruiseSpeed * k;

  const t1 = accelT;
  const t2 = t1 + cruiseT;
  const t3 = t2 + finaleT;
  const t4 = t3 + brakeT;

  function speedAt(t: number): number {
    if (t <= 0) return 0;
    if (accelT > 0 && t < t1) return cruiseSpeed * easeOutCubic(t / accelT);
    if (t < t2) return cruiseSpeed;
    if (finaleT > 0 && t < t3) return cruiseSpeed + (finaleSpeed - cruiseSpeed) * easeInCubic((t - t2) / finaleT);
    if (brakeT > 0 && t < t4) return finaleSpeed * (1 - easeInCubic((t - t3) / brakeT));
    return 0;
  }

  return { durationSec, speedAt };
}
