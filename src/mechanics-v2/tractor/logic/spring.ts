/**
 * Pure 1D spring-damper — no Phaser, no DOM. Semi-implicit Euler integration. Used to smooth
 * the tractor/trailer ride height and pitch toward the raw road profile instead of snapping
 * to it, so bumps read as suspension travel.
 *
 * `stiffness` and `damping` are plain per-second rate constants (not a damping *ratio*):
 * lower stiffness reacts more slowly (lag), and damping well below `2*sqrt(stiffness)`
 * (critical damping) leaves the spring underdamped, so it overshoots the target — the
 * "whip" effect used for the trailer.
 *
 * Semi-implicit Euler on a stiff spring is only numerically *stable* for small steps — a
 * single big `dt` (a dropped/backgrounded frame, a slow device) can make the discrete update
 * overshoot itself every step and blow up exponentially instead of converging. `update()`
 * guards against that by internally splitting a large dt into several smaller fixed steps,
 * so the caller never has to think about it and callers with very stiff springs (a tight
 * suspension) can't destabilize from one janky frame.
 */
const MAX_SUBSTEP_SEC = 1 / 60;

export class Spring1D {
  value: number;
  velocity: number;

  constructor(initial: number, private stiffness: number, private damping: number) {
    this.value = initial;
    this.velocity = 0;
  }

  update(target: number, dt: number): number {
    if (dt <= 0) return this.value;
    const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP_SEC));
    const subDt = dt / steps;
    for (let i = 0; i < steps; i++) {
      const accel = (target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += accel * subDt;
      this.value += this.velocity * subDt;
    }
    return this.value;
  }

  reset(value: number) {
    this.value = value;
    this.velocity = 0;
  }
}
