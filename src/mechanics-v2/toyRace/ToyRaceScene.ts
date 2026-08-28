import * as Phaser from 'phaser';
import type { Team } from '../../domain/types';
import type { SoundV2Api } from '../adapter';
import { makeRng, clamp } from '../engine/canvasUtils';
import {
  buildTrackPath,
  buildDecorations,
  fitProjection,
  normalAt,
  isoDepth,
  TRACK_HALF_WIDTH,
  type Projection,
  type Decoration,
} from './track';
import {
  VEHICLE_KEYS,
  VEHICLE_FRAME_SIZE,
  VEHICLE_FRAME_COUNT,
  vehicleAssetUrl,
  type VehicleKey,
} from './vehicles';
import { PROP_KEYS, propAssetUrl } from './props';

export interface ToyRaceInitData {
  teams: Team[];
  targetTeam: Team;
  seed: number;
  width: number;
  height: number;
  sound: SoundV2Api;
  onFinish: (winner: Team) => void;
}

/** Non-target cars can never cross this ceiling on their own — only the target may finish first. */
const PROGRESS_CAP = 0.965;
const FINISH_HOLD_MS = 900;

/**
 * The rotation frames were baked with the car spun around its vertical axis while the
 * (fixed) isometric camera looked on. These two constants map a world-space heading angle
 * to the closest baked frame; tuned by eye against the actual bake, not derived analytically.
 */
const FRAME_ANGLE_OFFSET_DEG = 270;
const FRAME_DIRECTION: 1 | -1 = -1;

function frameForHeading(headingRad: number): number {
  const deg = Phaser.Math.RadToDeg(headingRad) * FRAME_DIRECTION + FRAME_ANGLE_OFFSET_DEG;
  const norm = ((deg % 360) + 360) % 360;
  return Math.round(norm / (360 / VEHICLE_FRAME_COUNT)) % VEHICLE_FRAME_COUNT;
}

interface CarState {
  team: Team;
  isTarget: boolean;
  laneOffset: number;
  speedMul: number;
  startDelaySec: number;
  badgeLift: number;
  progress: number;
  dustTimer: number;
  sprite: Phaser.GameObjects.Sprite;
  badge: Phaser.GameObjects.Container;
}

export default class ToyRaceScene extends Phaser.Scene {
  private raceData!: ToyRaceInitData;
  private rng!: () => number;
  private path!: Phaser.Curves.Path;
  private projection!: Projection;
  private decorations: Decoration[] = [];
  private cars: CarState[] = [];
  private durationSec = 12;
  private elapsedRaceSec = 0;
  private winnerDeclared = false;
  private finishedCalled = false;
  private finishTimerMs = 0;
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('ToyRace');
  }

  init(data: ToyRaceInitData) {
    this.raceData = data;
    this.rng = makeRng(data.seed);
    this.cars = [];
    this.winnerDeclared = false;
    this.finishedCalled = false;
    this.finishTimerMs = 0;
    this.elapsedRaceSec = 0;
  }

  preload() {
    for (const key of VEHICLE_KEYS) {
      this.load.spritesheet(key, vehicleAssetUrl(key), {
        frameWidth: VEHICLE_FRAME_SIZE,
        frameHeight: VEHICLE_FRAME_SIZE,
      });
    }
    for (const key of PROP_KEYS) {
      this.load.image(key, propAssetUrl(key));
    }
  }

  create() {
    // Track shape is drawn from the race's own seeded rng first, so the whole per-race
    // sequence (shape, then duration, then car speeds/lanes below) stays reproducible from
    // a single seed — same "controlled randomness" model as the rest of the app.
    this.path = buildTrackPath(this.rng);
    this.decorations = buildDecorations(this.path);
    this.projection = fitProjection(
      this.path,
      this.raceData.width,
      this.raceData.height,
      this.decorations
    );
    this.durationSec = 10 + this.rng() * 5;

    this.drawBackground();
    this.drawTrack();
    this.spawnDecorations();
    this.createEmitters();
    this.spawnCars();
  }

  update(_time: number, deltaMs: number) {
    if (!this.path) return;
    // Generous ceiling (not a tight 60fps-oriented clamp): progress accumulation is a plain
    // sum with no physics/forces, so large dt is safe — this only guards against one huge
    // jump if the tab was backgrounded for a while, without slowing the race down on a
    // genuinely low-FPS machine (a tight clamp here silently causes slow-motion races).
    const dt = Math.min(0.25, deltaMs / 1000);
    this.elapsedRaceSec += dt;

    for (const car of this.cars) {
      this.advanceCar(car, dt);

      const p = this.path.getPoint(car.progress);
      const tangent = this.path.getTangent(car.progress);
      const n = normalAt(this.path, car.progress);
      const wobble = Math.sin(this.time.now / 1000 * 5 + car.laneOffset * 11) * 0.03;
      const wx = p.x + n.x * (car.laneOffset + wobble);
      const wy = p.y + n.y * (car.laneOffset + wobble);
      const screen = this.projection.toScreen(wx, wy);
      const depth = isoDepth(wx, wy);

      car.sprite.setPosition(screen.x, screen.y);
      car.sprite.setDepth(depth);
      car.sprite.setFrame(frameForHeading(Math.atan2(tangent.y, tangent.x)));

      car.badge.setPosition(screen.x, screen.y - car.sprite.displayHeight * car.badgeLift);
      car.badge.setDepth(2_000_000 + depth);

      if (car.progress > 0.015 && car.progress < 1) {
        car.dustTimer += dt;
        if (car.dustTimer > 0.11) {
          car.dustTimer = 0;
          this.dustEmitter.explode(2, screen.x - 8, screen.y + car.sprite.displayHeight * 0.28);
        }
      }

      if (!this.winnerDeclared && car.isTarget && car.progress >= 1) {
        this.declareWinner(screen.x, screen.y);
      }
    }

    if (this.winnerDeclared && !this.finishedCalled) {
      this.finishTimerMs += deltaMs;
      if (this.finishTimerMs > FINISH_HOLD_MS) {
        this.finishedCalled = true;
        this.raceData.onFinish(this.raceData.targetTeam);
      }
    }
  }

  private advanceCar(car: CarState, dt: number) {
    if (this.elapsedRaceSec < car.startDelaySec) return;
    const step = (car.speedMul / this.durationSec) * dt;
    if (car.isTarget || this.winnerDeclared) {
      car.progress = clamp(car.progress + step, 0, 1);
    } else {
      car.progress = clamp(car.progress + step, 0, PROGRESS_CAP);
    }
  }

  private declareWinner(screenX: number, screenY: number) {
    this.winnerDeclared = true;
    this.finishTimerMs = 0;
    this.raceData.sound.playFanfare();
    this.confettiEmitter.explode(90, screenX, screenY);
  }

  private spawnCars() {
    const n = this.raceData.teams.length;
    this.raceData.teams.forEach((team, idx) => {
      const vehicleKey: VehicleKey = VEHICLE_KEYS[idx % VEHICLE_KEYS.length];
      const isTarget = team.id === this.raceData.targetTeam.id;
      const laneOffset =
        n <= 1 ? 0 : ((idx - (n - 1) / 2) / Math.max(1, n - 1)) * TRACK_HALF_WIDTH * 1.6;
      const speedMul = isTarget ? 1.0 + this.rng() * 0.16 : 0.76 + this.rng() * 0.28;
      // Staggered grid start (like real starting grids) so cars don't launch as one clump.
      const startDelaySec = (idx / Math.max(1, n - 1)) * 0.5 + this.rng() * 0.15;
      // Cars bunched close together (e.g. queued at the finish cap) get name badges at
      // different heights so the labels fan out instead of stacking on top of each other.
      const badgeLift = 0.62 + (idx % 4) * 0.34;

      const sprite = this.add.sprite(0, 0, vehicleKey, 0);
      sprite.setOrigin(0.5, 0.8);
      const trackPixelWidth = TRACK_HALF_WIDTH * 2 * this.projection.scale;
      const size = Math.max(64, trackPixelWidth * (0.74 + this.rng() * 0.1));
      sprite.setDisplaySize(size, size);

      const badge = this.createBadge(team);

      this.cars.push({
        team,
        isTarget,
        laneOffset,
        speedMul,
        startDelaySec,
        badgeLift,
        progress: 0,
        dustTimer: this.rng() * 0.1,
        sprite,
        badge,
      });
    });
  }

  private createBadge(team: Team): Phaser.GameObjects.Container {
    const text = this.add
      .text(0, 0, team.name, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: '800',
        color: '#f8fafc',
      })
      .setOrigin(0, 0.5);

    const padX = 10;
    const padY = 5;
    const dotR = 3.5;
    const gap = 7;
    const h = text.height + padY * 2;
    const w = dotR * 2 + gap + text.width + padX * 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x0b1220, 0.76);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const dotColor = Phaser.Display.Color.HexStringToColor(team.color).color;
    bg.fillStyle(dotColor, 1);
    bg.fillCircle(-w / 2 + padX + dotR, 0, dotR);

    text.setPosition(-w / 2 + padX + dotR * 2 + gap, 0);

    const container = this.add.container(0, 0, [bg, text]);
    container.setDepth(2_000_000);
    return container;
  }

  private createEmitters() {
    const dustTexture = this.makeCircleTexture('toyrace-dust', 5, 0xffffff);
    this.dustEmitter = this.add.particles(0, 0, dustTexture, {
      lifespan: 420,
      speed: { min: 12, max: 45 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: 0xe8dcc0,
      emitting: false,
    });
    this.dustEmitter.setDepth(5_000_000);

    const confettiTexture = this.makeCircleTexture('toyrace-confetti', 4, 0xffffff);
    const tints = this.raceData.teams.map((t) => Phaser.Display.Color.HexStringToColor(t.color).color);
    this.confettiEmitter = this.add.particles(0, 0, confettiTexture, {
      lifespan: 950,
      speed: { min: 90, max: 280 },
      angle: { min: 0, max: 360 },
      gravityY: 280,
      scale: { start: 1, end: 0.35 },
      alpha: { start: 1, end: 0 },
      tint: tints,
      emitting: false,
    });
    this.confettiEmitter.setDepth(5_000_001);
  }

  private makeCircleTexture(key: string, radius: number, color: number): string {
    if (this.textures.exists(key)) return key;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
    return key;
  }

  private drawBackground() {
    const g = this.add.graphics();
    g.setDepth(-1_000_000);
    g.fillGradientStyle(0x2f6b3a, 0x2f6b3a, 0x1c4526, 0x1c4526, 1);
    g.fillRect(0, 0, this.raceData.width, this.raceData.height);
  }

  private drawTrack() {
    const g = this.add.graphics();
    g.setDepth(-500_000);
    const samples = 72;
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = this.path.getPoint(t);
      const n = normalAt(this.path, t);
      left.push(
        this.projection.toScreen(p.x + n.x * TRACK_HALF_WIDTH, p.y + n.y * TRACK_HALF_WIDTH)
      );
      right.push(
        this.projection.toScreen(p.x - n.x * TRACK_HALF_WIDTH, p.y - n.y * TRACK_HALF_WIDTH)
      );
    }

    // asphalt ribbon
    g.fillStyle(0x3c4250, 1);
    g.beginPath();
    g.moveTo(left[0].x, left[0].y);
    for (const pt of left) g.lineTo(pt.x, pt.y);
    for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i].x, right[i].y);
    g.closePath();
    g.fillPath();

    // curb edges
    g.lineStyle(4, 0xffffff, 0.85);
    g.beginPath();
    g.moveTo(left[0].x, left[0].y);
    for (const pt of left) g.lineTo(pt.x, pt.y);
    g.strokePath();
    g.beginPath();
    g.moveTo(right[0].x, right[0].y);
    for (const pt of right) g.lineTo(pt.x, pt.y);
    g.strokePath();

    // dashed centerline
    g.lineStyle(3, 0xf4d35e, 0.6);
    for (let i = 0; i < samples; i += 2) {
      const t1 = i / samples;
      const t2 = (i + 1) / samples;
      const p1 = this.path.getPoint(t1);
      const p2 = this.path.getPoint(t2);
      const s1 = this.projection.toScreen(p1.x, p1.y);
      const s2 = this.projection.toScreen(p2.x, p2.y);
      g.beginPath();
      g.moveTo(s1.x, s1.y);
      g.lineTo(s2.x, s2.y);
      g.strokePath();
    }

    this.drawFinishLine();
  }

  private drawFinishLine() {
    const g = this.add.graphics();
    g.setDepth(-400_000);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t0 = 0.975 + (i / steps) * 0.02;
      const t1 = 0.975 + ((i + 1) / steps) * 0.02;
      const p0 = this.path.getPoint(Math.min(t0, 1));
      const p1 = this.path.getPoint(Math.min(t1, 1));
      const n0 = normalAt(this.path, Math.min(t0, 1));
      const n1 = normalAt(this.path, Math.min(t1, 1));
      const a = this.projection.toScreen(
        p0.x + n0.x * TRACK_HALF_WIDTH,
        p0.y + n0.y * TRACK_HALF_WIDTH
      );
      const b = this.projection.toScreen(
        p0.x - n0.x * TRACK_HALF_WIDTH,
        p0.y - n0.y * TRACK_HALF_WIDTH
      );
      const c = this.projection.toScreen(
        p1.x - n1.x * TRACK_HALF_WIDTH,
        p1.y - n1.y * TRACK_HALF_WIDTH
      );
      const d = this.projection.toScreen(
        p1.x + n1.x * TRACK_HALF_WIDTH,
        p1.y + n1.y * TRACK_HALF_WIDTH
      );
      g.fillStyle(i % 2 === 0 ? 0x111318 : 0xffffff, 1);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.lineTo(c.x, c.y);
      g.lineTo(d.x, d.y);
      g.closePath();
      g.fillPath();
    }
  }

  private spawnDecorations() {
    const trackPixelWidth = TRACK_HALF_WIDTH * 2 * this.projection.scale;
    for (const d of this.decorations) {
      const screen = this.projection.toScreen(d.x, d.y);
      const sprite = this.add.image(screen.x, screen.y, d.kind);
      sprite.setOrigin(0.5, 0.86);
      const size = trackPixelWidth * 0.34 * d.scale;
      sprite.setDisplaySize(size, size);
      sprite.setDepth(isoDepth(d.x, d.y) - 0.001);
    }
  }
}
