import type * as Phaser from 'phaser';
import type { Team } from '../../domain/types';
import type { SoundV2Api } from '../adapter';
import { clamp, lerp, easeOutCubic, easeOutBack, hexToRgb, makeRng } from '../engine/canvasUtils';
import { generateRoadProfile, type RoadProfile } from './logic/road';
import { createSpeedScript, type SpeedScript } from './logic/speedProfile';
import { Spring1D } from './logic/spring';
import { computeSeatLayout, shuffleSeatOrder, type SeatLayout } from './logic/seating';
import { buildRunPlan, type RunPlan, type Ejection, type EjectionStyle } from './logic/runPlan';
import { readThemePalette, isDarkPalette, type ScenePalette } from './palette';
import {
  buildSkyElementsTexture,
  buildHillsTexture,
  buildFieldTexture,
  buildForegroundTexture,
} from './textures';
import {
  buildTractorBodyTexture,
  buildWheelTexture,
  buildDriverTexture,
  buildTrailerBedTexture,
  buildTrailerFrontWallTexture,
  buildHeadlightConeTexture,
  TRAILER_FLOOR_FRACTION,
  TRAILER_WALL_FRACTION,
} from './vehicleTextures';
import { buildPersonHeadTexture, buildPersonBodyTexture, buildPersonArmTexture } from './passengerTextures';
import {
  buildDustTexture,
  buildStarTexture,
  buildSmokeTexture,
  buildClodTexture,
  buildHayTexture,
  buildConfettiTexture,
} from './effectsTextures';

export interface TractorInitData {
  teams: Team[];
  targetTeam: Team;
  seed: number;
  width: number;
  height: number;
  sound: SoundV2Api;
  onFinish: (winner: Team) => void;
  /** Fired once per losing team, right as they detach from the trailer. */
  onEject?: (team: Team) => void;
  /**
   * Disables every "juice" effect (camera shake/punch-zoom/push-in, hit-stop, slow-mo, speed
   * lines, squash & stretch) — the ride's choreography plays out identically either way, just
   * without the flourishes. The adapter currently only ever mounts this scene when the app's
   * own reducedMotion setting is off (it short-circuits to an instant reveal instead), so in
   * practice this is always false today — it's threaded through so the scene is correct if
   * that ever changes, and so the flag has one obvious place to live.
   */
  reducedMotion: boolean;
}

type PhysicsContainer = Phaser.GameObjects.Container & { body: Phaser.Physics.Arcade.Body };

const ROAD_BASELINE_FRACTION = 0.74;
const SKY_ELEMENTS_FACTOR = 0.1;
const HILLS_FACTOR = 0.25;
const FIELD_FACTOR = 0.5;
const FOREGROUND_FACTOR = 1.6;

const DEPTH_SKY = -1000;
const DEPTH_STARS = -950;
const DEPTH_SKY_ELEMENTS = -900;
const DEPTH_HILLS = -800;
const DEPTH_FIELD = -700;
const DEPTH_ROAD = -600;
const DEPTH_TRAILER = -550;
const DEPTH_DRAWBAR = -520;
const DEPTH_TRACTOR = -500;
const DEPTH_FOREGROUND = -100;

const CAMERA_LERP = 0.06;
const LOOKAHEAD_RATIO = 0.1;

// Tractor suspension: fairly stiff, mildly underdamped so a hard bump still gives a little bounce.
const TRACTOR_Y_STIFFNESS = 210;
const TRACTOR_Y_DAMPING = 22;
const TRACTOR_ANGLE_STIFFNESS = 260;
const TRACTOR_ANGLE_DAMPING = 26;

// Trailer: softer and less damped than the tractor — reacts later and overshoots more (whip).
const TRAILER_Y_STIFFNESS = 85;
const TRAILER_Y_DAMPING = 10;
const TRAILER_ANGLE_STIFFNESS = 95;
const TRAILER_ANGLE_DAMPING = 14;

// Wide enough to average out the peak instantaneous slope of a sharp gaussian hump — the
// road profile was tuned for how the ribbon *looks*, not for a vehicle-pitch derivative, so
// its raw slope can spike well past what a chassis tilt should ever show.
const SLOPE_SAMPLE_EPS = 34;
const MAX_PITCH_ANGLE_TRACTOR = (22 * Math.PI) / 180;
// The trailer bed is a long, thin shape — even a moderate tilt sweeps its far end through a
// big arc, so it gets a tighter cap than the tractor despite otherwise being the "whippier" spring.
const MAX_PITCH_ANGLE_TRAILER = (15 * Math.PI) / 180;
const IDLE_BOB_AMPLITUDE = 2.2;
const IDLE_BOB_FREQ = 2.1;
const IDLE_FADE_SPEED = 40;

const DEPTH_PASSENGER_BACK_ROW = -530;
const DEPTH_PASSENGER_FRONT_ROW = -525;
const DEPTH_EJECTED = -480;
const DEPTH_SMOKE = -478;
const DEPTH_DUST = -470;
const DEPTH_CLOD = -468;
const DEPTH_HAY = -466;
const DEPTH_TRAIL = -462;
const DEPTH_STAR = -460;
const DEPTH_CONFETTI = -450;
const DEPTH_UI = 20_000_000;

// How hard a passenger's own spring reacts to the trailer's motion (inertia, not a 1:1 copy —
// each passenger has its own spring so the reaction lags and settles independently).
const PASSENGER_LEAN_STIFFNESS = 90;
const PASSENGER_LEAN_DAMPING = 9;
const PASSENGER_BOB_STIFFNESS = 110;
const PASSENGER_BOB_DAMPING = 11;
const LEAN_REACTION_TIME = 0.16; // seconds of trailer angular velocity converted to lean radians
const BOB_REACTION_TIME = 0.1; // seconds of trailer vertical velocity converted to bob pixels
const MAX_LEAN_RAD = 0.6;

const IDLE_SWAY_FREQ = 1.6;
const ARM_BASE_LEFT = -0.55;
const ARM_BASE_RIGHT = 0.55;
const ARM_IDLE_AMPLITUDE = 0.06;
const ARM_FLAIL_AMPLITUDE = 0.85;
const ARM_FLAIL_FREQ = 16;

// A scheduled ejection triggers panic in its target this many seconds before the hump (the
// "1-1.5s" window from the brief), keyed off runPlan.ts's own ejections, not a crowd mood.
const PANIC_LEAD_TIME = 1.4;
const PANIC_SHAKE_AMPLITUDE = 2.5;
const PANIC_SHAKE_FREQ = 24;
/** A `fakeout` ejection shakes harder right before it happens — an "almost didn't" beat. */
const FAKEOUT_SHAKE_MULT = 1.7;

// Detach kinematics — velocities are px/s tuned for a ~560px-tall canvas, then scaled by the
// scene's actual height so the trajectory shape (and gravity) reads the same at any size.
const EJECT_REFERENCE_HEIGHT = 560;
const EJECT_GRAVITY = 1500;
const BOUNCE_DAMPING = 0.42;
const STAR_DURATION = 1.6;
const STAR_SPIN_SPEED = 4;
const WAVE_FREQ = 3;
const WAVE_AMPLITUDE = 0.45;
const WAVE_BASE = Math.PI * 0.82;

// --- Camera & impact "juice" — all disabled together when reducedMotion is set. Every
// envelope here is driven by *real* elapsed time (not the sim's own, possibly hit-stopped or
// slow-mo'd, dt), so shakes/zooms keep animating smoothly through a freeze or a slow-mo dip.
const CAMERA_ZOOM_BASE = 1;
const CAMERA_ZOOM_FINALE = 1.14;
/** World-x distance from the finale at which the slow push-in begins ramping up. */
const FINALE_PUSHIN_RANGE = 500;
const PUNCH_ZOOM_PEAK = 0.08;
const PUNCH_ZOOM_DURATION = 0.4;

const MICRO_SHAKE_MAX_OFFSET = 2.5;
/** |tractorYSpring.velocity| (px/s) that maps to the full micro-shake amplitude. */
const MICRO_SHAKE_VELOCITY_REF = 220;
const STRONG_SHAKE_DURATION_MS = 260;
const STRONG_SHAKE_INTENSITY = 0.018;

/** Freeze physics/springs for one impact frame — 60-100ms, per the brief. */
const HIT_STOP_MS = 80;
const SLOWMO_MIN_SCALE = 0.3;
const SLOWMO_RECOVER_SEC = 0.9;

const SPEED_LINES_MIN_SPEED = 300;
const SPEED_LINES_MAX_SPEED = 480;
const SPEED_LINES_COUNT = 7;

const SQUASH_STRETCH_DURATION = 0.35;
const SQUASH_AMOUNT = 0.16;

// --- Particles. Every emitter caps `maxParticles` conservatively; reduced-motion turns the
// continuous ambient ones (wheel dust, exhaust, hay) off entirely and thins out the one-shot
// impact/celebration bursts (landing, hump clods, confetti) rather than silencing them, per
// the brief's "minimum particles, not zero".
const REDUCED_MOTION_PARTICLE_SCALE = 0.25;

const WHEEL_DUST_MIN_SPEED = 40;
const WHEEL_DUST_INTERVAL = 0.13;
const WHEEL_DUST_MAX_PARTICLES = 26;

const EXHAUST_INTERVAL = 0.22;
/** px/s² of acceleration that maps to the thickest exhaust puff. */
const EXHAUST_ACCEL_REF = 220;
const EXHAUST_MAX_PARTICLES = 20;

const CLOD_BASE_COUNT = 8;
const CLOD_MAX_PARTICLES = 24;

const FLIGHT_TRAIL_INTERVAL = 0.05;
const FLIGHT_TRAIL_MAX_PARTICLES = 30;

const HAY_INTERVAL = 0.16;
/** |trailerYSpring.velocity| (px/s) above which the bed is bouncing hard enough to toss hay. */
const HAY_MIN_VELOCITY = 40;
const HAY_MAX_PARTICLES = 16;

const CONFETTI_BASE_COUNT = 90;
const CONFETTI_MAX_PARTICLES = 90;

// --- Sound. The engine/wind loops are keyed off SPEED_LINES_MAX_SPEED (already the scene's
// own reference top speed) so a fast ride reads as loud/high-pitched exactly when it also
// looks fast. Regular bumps are detected off the same suspension-velocity signal that already
// drives the micro-shake/hay triggers, capped below a mega-hump's fixed intensity of 1 so the
// two stay clearly distinct, per the brief ("мега-кочка — громче и ниже").
const BUMP_SOUND_VELOCITY_THRESHOLD = 90;
const BUMP_SOUND_VELOCITY_REF = 260;
const BUMP_SOUND_MAX_INTENSITY = 0.6;
const BUMP_SOUND_COOLDOWN = 0.22;

// --- Finale. Once the winner's close call resolves (updateCloseCall), the ride holds on the
// celebration for FINALE_GRACE_SEC of *real* time (not rideTime, so fast-forward doesn't
// shorten the payoff too) before calling tractorData.onFinish and handing control back to the
// app's own cinematic reveal, which draws on top of this scene rather than replacing it.
const FINALE_GRACE_SEC = 2.2;
const FINALE_GRACE_SEC_REDUCED = 1;
const VIGNETTE_FADE_IN_SEC = 0.6;
const VIGNETTE_MAX_ALPHA = 0.85;

// The winner never gets ejected, but stands up and waves in their seat once the close call
// resolves — reusing the seated rig rather than building a whole new "standing" pose.
const CELEBRATE_STAND_RAISE = 0.32; // fraction of personH the rig lifts, simulating standing up
const CELEBRATE_BOB_FREQ = 5;
const CELEBRATE_BOB_AMPLITUDE = 0.05; // fraction of personH
const CELEBRATE_ARM_UP = -2.35; // rad — both arms raised overhead
const CELEBRATE_WAVE_FREQ = 4.5;
const CELEBRATE_WAVE_AMPLITUDE = 0.4;

// Space/Enter during an active ride compresses whatever's left into ~FAST_FORWARD_TARGET_SEC
// of real time by scaling the ride's own virtual-time advancement — fixed once at activation
// (not recomputed every frame), so the remaining ride actually arrives instead of asymptotically
// approaching the finale forever.
const FAST_FORWARD_TARGET_SEC = 3;
const FAST_FORWARD_MAX_MULTIPLIER = 24;

// --- Dark-theme-only flourishes. Gated on palette.ts's isDarkPalette(), rebuilt on every
// theme change (repaintTheme()) since switching from a dark to a light theme mid-ride must
// remove them, and switching the other way must add them.
const STAR_COUNT = 22;
const STAR_MIN_SIZE = 4;
const STAR_MAX_SIZE = 10;
const STAR_TWINKLE_FREQ = 1.4;
const HEADLIGHT_LENGTH_FACTOR = 1.7; // × bodyW
const HEADLIGHT_HEIGHT_FACTOR = 0.55; // × bodyH

// --- Idle "engine judder" — a tiny, fast, speed-scaled jitter on top of the suspension
// springs, since the springs alone are too slow/smooth to read as a running engine at a
// standstill or crawl. Purely cosmetic, applied after the spring-driven position each frame.
const ENGINE_JUDDER_FREQ = 22;
const ENGINE_JUDDER_MAX_AMPLITUDE = 0.9;

interface StyleMotion {
  vx: number;
  vy: number;
  angularDeg: number;
}

/** Visually distinct launches per style — sign of vx is the tell: forward (frontWall) vs. back. */
const STYLE_MOTION: Record<EjectionStyle, StyleMotion> = {
  highArc: { vx: -150, vy: -560, angularDeg: 150 },
  backflip: { vx: -260, vy: -420, angularDeg: -520 },
  frontWall: { vx: 300, vy: -480, angularDeg: 320 },
  double: { vx: -170, vy: -520, angularDeg: 160 },
};

type PassengerState = 'seated' | 'panicking' | 'ejected';

interface PassengerRig {
  team: Team;
  container: Phaser.GameObjects.Container;
  armLeft: Phaser.GameObjects.Sprite;
  armRight: Phaser.GameObjects.Sprite;
  chipContainer: Phaser.GameObjects.Container;
  chipText: Phaser.GameObjects.Text;
  chipBg: Phaser.GameObjects.Graphics;
  seatX: number;
  seatY: number;
  leanSpring: Spring1D;
  bobSpring: Spring1D;
  phase: number;
  freqJitter: number;
  state: PassengerState;
  pendingEjection?: Ejection;
}

interface EjectedRig {
  rig: PassengerRig;
  ejection: Ejection;
  bounces: number;
  maxBounces: number;
  landed: boolean;
  landedAt: number;
  starSprites: Phaser.GameObjects.Sprite[];
  trailTimer: number;
}

interface VehicleLayout {
  bodyW: number;
  bodyH: number;
  rearWheelR: number;
  frontWheelR: number;
  rearWheelOffset: { x: number; y: number };
  frontWheelOffset: { x: number; y: number };
  bodyOffset: { x: number; y: number };
  driverOffset: { x: number; y: number };
  hitchOffset: { x: number; y: number };
  exhaustTipOffset: { x: number; y: number };
  trailerW: number;
  trailerH: number;
  bedOffset: { x: number; y: number };
  frontWallW: number;
  frontWallH: number;
  frontWallOffset: { x: number; y: number };
  frontAttachOffset: { x: number; y: number };
  hitchLength: number;
  trailerWheelR: number;
  trailerWheelOffsetA: { x: number; y: number };
  trailerWheelOffsetB: { x: number; y: number };
}

function computeLayout(height: number): VehicleLayout {
  const bodyH = height * 0.24;
  const bodyW = bodyH * 1.65;
  const rearWheelR = height * 0.095;
  const frontWheelR = height * 0.058;

  const rearWheelOffset = { x: -bodyW * 0.3, y: 0 };
  const frontWheelOffset = { x: bodyW * 0.34, y: rearWheelR - frontWheelR };
  const bodyOffset = {
    x: rearWheelOffset.x - 0.24 * bodyW,
    y: -rearWheelR * 0.15 - 0.76 * bodyH,
  };
  // Sized/placed so the driver's torso lands on the open seat drawn into the body texture
  // (vehicleTextures.ts's buildTractorBodyTexture) — an open platform, not an enclosed cab, so
  // there's no windshield frame for the driver sprite to visually sit "outside" of.
  const driverSize = bodyH * 0.42;
  const driverOffset = {
    x: bodyOffset.x + 0.24 * bodyW - driverSize * 0.5,
    y: bodyOffset.y + 0.1 * bodyH - driverSize * 0.62,
  };
  const hitchOffset = {
    x: bodyOffset.x + 0.06 * bodyW,
    y: bodyOffset.y + 0.62 * bodyH,
  };
  // Matches the exhaust cap baked into the body texture (vehicleTextures.ts's buildTractorBodyTexture).
  const exhaustTipOffset = {
    x: bodyOffset.x + 0.4825 * bodyW,
    y: bodyOffset.y + bodyH * 0.035,
  };

  // The trailer container's origin sits at the bed's horizontal CENTER (not its front edge):
  // rotating around the middle halves the lever arm for a given tilt, so the far end doesn't
  // sweep through an oversized arc on every whip.
  const trailerH = height * 0.3;
  const trailerW = trailerH * 1.5;
  const bedOffset = { x: -trailerW * 0.5, y: -0.78 * trailerH };
  // Wide enough to read as a board/gate rather than a stray pillar (a much taller-than-wide
  // panel was the "какие-то фиолетовые столбы" feedback — this is the fix).
  const frontWallW = trailerW * 0.22;
  const frontWallH = trailerH * 0.62;
  const frontWallOffset = { x: trailerW * 0.5 - frontWallW * 1.15, y: -frontWallH * 0.98 };
  const frontAttachOffset = { x: trailerW * 0.48, y: -trailerH * 0.08 };
  const hitchLength = bodyW * 0.55 + trailerW * 0.56;

  const trailerWheelR = trailerH * 0.16;
  const trailerWheelY = bedOffset.y + trailerH - trailerWheelR * 0.35;
  const trailerWheelOffsetA = { x: bedOffset.x + trailerW * 0.26, y: trailerWheelY };
  const trailerWheelOffsetB = { x: bedOffset.x + trailerW * 0.66, y: trailerWheelY };

  return {
    bodyW,
    bodyH,
    rearWheelR,
    frontWheelR,
    rearWheelOffset,
    frontWheelOffset,
    bodyOffset,
    driverOffset,
    hitchOffset,
    exhaustTipOffset,
    trailerW,
    trailerH,
    bedOffset,
    frontWallW,
    frontWallH,
    frontWallOffset,
    frontAttachOffset,
    hitchLength,
    trailerWheelR,
    trailerWheelOffsetA,
    trailerWheelOffsetB,
  };
}

function rotateOffset(x: number, y: number, angle: number): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function teamColorNumber(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

/**
 * Built from the runtime Phaser namespace (passed in after `await import('phaser')`)
 * rather than a static import, so this module never pulls Phaser into whatever chunk
 * imports it — only the adapter's dynamic import does.
 */
export function createTractorScene(PhaserNS: typeof Phaser): typeof Phaser.Scene {
  return class TractorScene extends PhaserNS.Scene {
    private tractorData!: TractorInitData;
    private palette!: ScenePalette;
    private roadProfile!: RoadProfile;
    private layout!: VehicleLayout;
    private baselineY = 0;
    private rideTime = 0;
    private virtualTractor = { x: 0, y: 0 };

    private skyElementsLayer!: Phaser.GameObjects.TileSprite;
    private hillsLayer!: Phaser.GameObjects.TileSprite;
    private fieldLayer!: Phaser.GameObjects.TileSprite;
    private foregroundLayer!: Phaser.GameObjects.TileSprite;
    private skyGraphics!: Phaser.GameObjects.Graphics;
    private roadGraphics!: Phaser.GameObjects.Graphics;

    private tractorContainer!: Phaser.GameObjects.Container;
    private trailerContainer!: Phaser.GameObjects.Container;
    private rearWheel!: Phaser.GameObjects.Sprite;
    private frontWheel!: Phaser.GameObjects.Sprite;
    private tractorBodySprite!: Phaser.GameObjects.Sprite;
    private driverSprite!: Phaser.GameObjects.Sprite;
    private trailerBedSprite!: Phaser.GameObjects.Sprite;
    private trailerFrontWallSprite!: Phaser.GameObjects.Sprite;
    private trailerWheelA!: Phaser.GameObjects.Sprite;
    private trailerWheelB!: Phaser.GameObjects.Sprite;
    private headlightSprite?: Phaser.GameObjects.Sprite;
    private starSprites: Phaser.GameObjects.Sprite[] = [];
    private starTextureKeys: string[] = [];
    private isDarkTheme = true;
    private drawbarGraphics!: Phaser.GameObjects.Graphics;

    // Cached texture keys for every palette-derived texture — kept so a live theme change can
    // remove + regenerate each one under its own same key, then re-bind it onto whatever's
    // displaying it (see repaintTheme()).
    private skyElementsKey = '';
    private hillsKey = '';
    private fieldKey = '';
    private foregroundKey = '';
    private bodyKey = '';
    private rearWheelKey = '';
    private frontWheelKey = '';
    private driverKey = '';
    private bedKey = '';
    private frontWallKey = '';
    private trailerWheelKey = '';
    private landingDustKey = '';
    private smokeKey = '';
    private wheelDustKey = '';
    private clodKey = '';
    private flightTrailKey = '';
    private hayKey = '';
    private headlightKey = '';
    private themeChangeListener = () => this.repaintTheme();

    private passengers: PassengerRig[] = [];
    private passengerByTeamId = new Map<string, PassengerRig>();
    private seatLayout!: SeatLayout;
    private personH = 0;

    private runPlan!: RunPlan;
    private speedScript!: SpeedScript;
    private nextEjectionIndex = 0;
    private closeCallDone = false;
    private effectsRng!: () => number;

    private ejectedRigs: EjectedRig[] = [];
    private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private starTextureKey = '';

    private wheelDustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private wheelDustTimer = 0;
    private exhaustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private exhaustTimer = 0;
    private prevSpeedForSmoke = 0;
    private clodEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private flightTrailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private hayEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private hayTimer = 0;
    private confettiEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

    private tractorYSpring!: Spring1D;
    private tractorAngleSpring!: Spring1D;
    private trailerYSpring!: Spring1D;
    private trailerAngleSpring!: Spring1D;

    private juiceEnabled = true;
    /** Real (unscaled) elapsed seconds since create() — juice envelopes run on this, not rideTime. */
    private realElapsedSec = 0;
    private lookAheadPx = 0;
    private hitStopRemainingMs = 0;
    private slowmoStartAt = -Infinity;
    private punchZoomStartAt = -Infinity;
    private squashStartAt = -Infinity;
    private speedLinesGraphics!: Phaser.GameObjects.Graphics;
    private bumpSoundCooldown = 0;

    private closeCallAt = -Infinity;
    private onFinishCalled = false;
    private vignetteGraphics!: Phaser.GameObjects.Graphics;
    private fastForwardActive = false;
    private fastForwardMultiplier = 1;
    private fastForwardListener = () => this.activateFastForward();

    constructor() {
      super('Tractor');
    }

    init(data: TractorInitData) {
      this.tractorData = data;
    }

    create() {
      const { width, height, seed, teams, targetTeam } = this.tractorData;
      this.palette = readThemePalette();
      this.isDarkTheme = isDarkPalette(this.palette);
      this.layout = computeLayout(height);
      this.baselineY = height * ROAD_BASELINE_FRACTION;
      this.rideTime = 0;
      this.realElapsedSec = 0;
      this.effectsRng = makeRng(seed + 9999);
      this.juiceEnabled = !this.tractorData.reducedMotion;
      this.hitStopRemainingMs = 0;
      this.slowmoStartAt = -Infinity;
      this.punchZoomStartAt = -Infinity;
      this.squashStartAt = -Infinity;
      this.wheelDustTimer = 0;
      this.exhaustTimer = 0;
      this.prevSpeedForSmoke = 0;
      this.hayTimer = 0;
      this.bumpSoundCooldown = 0;
      this.closeCallAt = -Infinity;
      this.onFinishCalled = false;
      this.fastForwardActive = false;
      this.fastForwardMultiplier = 1;

      // Sound is procedural WebAudio via the shared useSoundV2 hook (no audio files) — its
      // continuous engine/wind loops live as long-lived AudioNodes owned by the hook itself,
      // so they need an explicit stop when this scene goes away or they'd play on forever.
      // The fast-forward request comes in from TractorAdapterV2 via the game-level event bus
      // (it holds the Phaser.Game, not this Scene instance) — also torn down here.
      //
      // TractorAdapterV2's unmount cleanup calls `game.destroy(true)` — a *whole-game* teardown,
      // which fires each scene's 'destroy' event, not 'shutdown' ('shutdown' is for a scene
      // being stopped/restarted while the game keeps running, e.g. `scene.stop()`, which this
      // codebase never calls). Listening only for 'shutdown' meant this cleanup silently never
      // ran on the actual unmount path — the engine/wind drone kept humming until a full page
      // reload tore down the AudioContext itself. Bound to both so either teardown path works.
      this.game.events.on('tractor-fast-forward', this.fastForwardListener);
      this.game.events.on('tractor-theme-change', this.themeChangeListener);
      const stopSoundAndListeners = () => {
        this.tractorData.sound.stopEngine();
        this.tractorData.sound.stopWind();
        this.game.events.off('tractor-fast-forward', this.fastForwardListener);
        this.game.events.off('tractor-theme-change', this.themeChangeListener);
      };
      this.events.once('shutdown', stopSoundAndListeners);
      this.events.once('destroy', stopSoundAndListeners);

      // The choreography comes first: who ejects where/how, and where the finale is. The
      // terrain's mega-humps are then placed at exactly those bumpX's (see logic/road.ts).
      this.runPlan = buildRunPlan({
        teamIds: teams.map((t) => t.id),
        winnerId: targetTeam.id,
        seed,
        reducedMotion: this.tractorData.reducedMotion,
      });
      this.roadProfile = generateRoadProfile(seed, {
        featureXPositions: this.runPlan.ejections.map((e) => e.bumpX),
      });

      const targetDistance = Math.min(this.roadProfile.length, this.runPlan.finaleX + 260);
      this.speedScript = createSpeedScript(this.runPlan.durationSec, targetDistance);

      this.virtualTractor = { x: 0, y: this.baselineY };
      this.nextEjectionIndex = 0;
      this.closeCallDone = false;
      this.passengers = [];
      this.passengerByTeamId = new Map();
      this.ejectedRigs = [];

      this.drawSky(width, height);
      this.buildStars(width, height);
      this.buildParallaxLayers(width, height, seed);
      this.buildRoad();
      this.buildVehicle(seed);
      this.buildEjectionEffects();
      this.buildParticleEffects();
      this.buildSpeedLines();
      this.buildVignette();

      const startY = this.roadTopAt(0);
      this.tractorYSpring = new Spring1D(startY, TRACTOR_Y_STIFFNESS, TRACTOR_Y_DAMPING);
      this.tractorAngleSpring = new Spring1D(0, TRACTOR_ANGLE_STIFFNESS, TRACTOR_ANGLE_DAMPING);
      const trailerStartX = -this.layout.hitchLength;
      this.trailerYSpring = new Spring1D(this.roadTopAt(trailerStartX), TRAILER_Y_STIFFNESS, TRAILER_Y_DAMPING);
      this.trailerAngleSpring = new Spring1D(0, TRAILER_ANGLE_STIFFNESS, TRAILER_ANGLE_DAMPING);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, this.roadProfile.length, height);
      cam.setZoom(CAMERA_ZOOM_BASE);
      this.lookAheadPx = width * LOOKAHEAD_RATIO;
      cam.startFollow(this.virtualTractor, false, CAMERA_LERP, 0, -this.lookAheadPx, 0);
    }

    update(_time: number, deltaMs: number) {
      if (!this.roadProfile) return;
      const rawDt = Math.min(0.25, deltaMs / 1000);
      this.realElapsedSec += rawDt;

      let dt = this.updateHitStopAndSlowmo(deltaMs, rawDt);
      // Fast-forward only speeds up the ride's own virtual-time advancement (position, speed,
      // ejection triggering) — real-time-driven juice (camera shake, vignette fade) keeps its
      // normal pacing, and ejected characters' own Arcade-physics flights are untouched, so a
      // fast-forwarded montage still reads as a sequence of real little moments, just packed
      // close together, rather than a single unreadable blur.
      if (this.fastForwardActive) dt *= this.fastForwardMultiplier;
      // Speed is sampled at the *start* of this step, before rideTime advances — with a large
      // fast-forwarded dt, sampling after would let a single step's rideTime land past the end
      // of the brake phase, read speedAt()'s permanent 0 there, and stall short of finaleX
      // forever (the step that should have covered the last stretch of the brake ramp instead
      // covers nothing).
      const speed = this.speedScript.speedAt(this.rideTime);
      this.rideTime += dt;
      this.virtualTractor.x = clamp(this.virtualTractor.x + speed * dt, 0, this.roadProfile.length);
      // speedProfile.ts's distance calibration is an exact integral over continuous time; a
      // discrete forward-Euler simulation of it (worse with a chunky dt — a low frame rate, or
      // fast-forward) can undershoot by a few pixels, and since speedAt() is permanently 0 past
      // durationSec, that shortfall would otherwise never recover. Once the script's own
      // duration has fully elapsed, guarantee arrival rather than leaving the ride stuck just
      // short of the finale forever.
      if (this.rideTime >= this.runPlan.durationSec && !this.closeCallDone) {
        const minTractorX = this.runPlan.finaleX + this.layout.hitchLength;
        if (this.virtualTractor.x < minTractorX) {
          this.virtualTractor.x = Math.min(minTractorX, this.roadProfile.length);
        }
      }
      const tractorX = this.virtualTractor.x;
      const trailerX = tractorX - this.layout.hitchLength;

      const idle = IDLE_BOB_AMPLITUDE * Math.max(0, 1 - speed / IDLE_FADE_SPEED);
      const idleOffset = Math.sin(this.rideTime * IDLE_BOB_FREQ) * idle;

      const tractorTargetY = this.roadTopAt(tractorX) + idleOffset;
      const tractorTargetAngle = this.slopeAngleAt(tractorX, MAX_PITCH_ANGLE_TRACTOR);
      this.tractorYSpring.update(tractorTargetY, dt);
      this.tractorAngleSpring.update(tractorTargetAngle, dt);

      const trailerTargetY = this.roadTopAt(trailerX) + idleOffset;
      const trailerTargetAngle = this.slopeAngleAt(trailerX, MAX_PITCH_ANGLE_TRAILER);
      this.trailerYSpring.update(trailerTargetY, dt);
      this.trailerAngleSpring.update(trailerTargetAngle, dt);

      // Tiny fast judder on top of the (much slower/smoother) suspension spring — the spring
      // alone reads as "floating on a cloud" at a standstill; this is what actually sells
      // "engine running". Gated with the rest of the juice for reducedMotion.
      const judder = this.juiceEnabled
        ? Math.sin(this.realElapsedSec * ENGINE_JUDDER_FREQ) * ENGINE_JUDDER_MAX_AMPLITUDE
        : 0;
      this.tractorContainer.setPosition(tractorX, this.tractorYSpring.value + judder);
      this.tractorContainer.rotation = this.tractorAngleSpring.value;
      this.trailerContainer.setPosition(trailerX, this.trailerYSpring.value);
      this.trailerContainer.rotation = this.trailerAngleSpring.value;

      const wheelSpin = speed * dt;
      this.rearWheel.rotation += wheelSpin / this.layout.rearWheelR;
      this.frontWheel.rotation += wheelSpin / this.layout.frontWheelR;
      this.trailerWheelA.rotation += wheelSpin / this.layout.trailerWheelR;
      this.trailerWheelB.rotation += wheelSpin / this.layout.trailerWheelR;

      this.updateDrawbar();
      this.updateEjectionSchedule(trailerX, speed);
      this.updateCloseCall(trailerX, speed);
      this.updatePassengers(dt);
      this.updateEjectedPassengers(dt);

      // Juice runs on rawDt/realElapsedSec (never hit-stopped or slow-mo'd) so the camera can
      // keep punching/shaking through a frozen or slowed-down beat instead of freezing itself.
      this.updateCameraJuice(trailerX);
      this.updateSquashStretch();
      this.updateSpeedLines(speed);
      this.updateWheelDust(rawDt, speed);
      this.updateExhaustSmoke(rawDt, speed);
      this.updateHayParticles(rawDt);
      this.updateEngineSound(speed);
      this.updateBumpSound(rawDt);
      this.updateVignette();
      this.updateFinaleCallback();
      this.updateStars();

      const scrollX = this.cameras.main.scrollX;
      this.skyElementsLayer.tilePositionX = scrollX * SKY_ELEMENTS_FACTOR;
      this.hillsLayer.tilePositionX = scrollX * HILLS_FACTOR;
      this.fieldLayer.tilePositionX = scrollX * FIELD_FACTOR;
      this.foregroundLayer.tilePositionX = scrollX * FOREGROUND_FACTOR;
    }

    /**
     * Freezes the sim for HIT_STOP_MS after an impact, then eases physics/springs back up from
     * SLOWMO_MIN_SCALE to full speed — returns the dt the rest of update() should simulate
     * with. Arcade physics (the ejected bodies) is scaled/paused in lockstep via
     * `physics.world`, so a slow-mo'd flight and the tractor's own suspension stay in sync.
     */
    private updateHitStopAndSlowmo(deltaMs: number, rawDt: number): number {
      if (!this.juiceEnabled) return rawDt;

      if (this.hitStopRemainingMs > 0) {
        this.hitStopRemainingMs -= deltaMs;
        if (this.hitStopRemainingMs <= 0) {
          this.physics.world.resume();
          // Slow-mo's recovery window starts now, once motion actually resumes, so the flight
          // is visibly at SLOWMO_MIN_SCALE right out of the freeze, not partway recovered.
          this.slowmoStartAt = this.realElapsedSec;
        }
        return 0;
      }

      const slowmoElapsed = this.realElapsedSec - this.slowmoStartAt;
      const slowmoT = clamp(slowmoElapsed / SLOWMO_RECOVER_SEC, 0, 1);
      // Recovers fast at first, then eases into full speed — reads as a deliberate "ramp up".
      const scale = slowmoT >= 1 ? 1 : lerp(SLOWMO_MIN_SCALE, 1, easeOutCubic(slowmoT));
      this.physics.world.timeScale = 1 / scale;
      return rawDt * scale;
    }

    /** Composes the finale push-in (slow, holds) with a per-ejection punch-zoom pulse, plus
     * a continuous micro-shake scaled by suspension velocity and a one-shot shake on impact. */
    private updateCameraJuice(trailerX: number) {
      const cam = this.cameras.main;

      if (!this.juiceEnabled) {
        cam.setZoom(CAMERA_ZOOM_BASE);
        cam.setFollowOffset(-this.lookAheadPx, 0);
        return;
      }

      const finaleProximity = clamp(1 - (this.runPlan.finaleX - trailerX) / FINALE_PUSHIN_RANGE, 0, 1);
      const baseZoom = lerp(CAMERA_ZOOM_BASE, CAMERA_ZOOM_FINALE, finaleProximity);

      const punchElapsed = this.realElapsedSec - this.punchZoomStartAt;
      const punchT = clamp(punchElapsed / PUNCH_ZOOM_DURATION, 0, 1);
      const punchEnvelope = punchT < 1 ? Math.sin(Math.PI * punchT) : 0;
      cam.setZoom(baseZoom * (1 + PUNCH_ZOOM_PEAK * punchEnvelope));

      const shakeAmp =
        clamp(Math.abs(this.tractorYSpring.velocity) / MICRO_SHAKE_VELOCITY_REF, 0, 1) * MICRO_SHAKE_MAX_OFFSET;
      const shakeX = (this.effectsRng() - 0.5) * 2 * shakeAmp;
      const shakeY = (this.effectsRng() - 0.5) * 2 * shakeAmp;
      cam.setFollowOffset(-this.lookAheadPx + shakeX, shakeY);
    }

    /** A brief squash-then-spring-back on the tractor+trailer bodies, timed with hump impacts. */
    private updateSquashStretch() {
      if (!this.juiceEnabled) return;
      const t = clamp((this.realElapsedSec - this.squashStartAt) / SQUASH_STRETCH_DURATION, 0, 1);
      const settle = 1 - easeOutBack(t);
      const scaleX = 1 + SQUASH_AMOUNT * 0.6 * settle;
      const scaleY = 1 - SQUASH_AMOUNT * settle;
      this.tractorContainer.setScale(scaleX, scaleY);
      this.trailerContainer.setScale(scaleX, scaleY);
    }

    private updateSpeedLines(speed: number) {
      const g = this.speedLinesGraphics;
      g.clear();
      if (!this.juiceEnabled) return;

      const alpha = clamp((speed - SPEED_LINES_MIN_SPEED) / (SPEED_LINES_MAX_SPEED - SPEED_LINES_MIN_SPEED), 0, 1);
      if (alpha <= 0) return;

      const { width, height } = this.tractorData;
      g.lineStyle(2, this.palette.roadEdge, alpha * 0.55);
      for (let i = 0; i < SPEED_LINES_COUNT; i++) {
        const y = height * (0.08 + (i / SPEED_LINES_COUNT) * 0.5) + Math.sin(this.realElapsedSec * 9 + i) * 6;
        const len = width * (0.12 + this.effectsRng() * 0.1);
        const x = width * (0.02 + ((this.realElapsedSec * 260 + i * 90) % (width * 0.4)) / width);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + len, y);
        g.strokePath();
      }
    }

    /** Continuous dust kicked up from the rear wheel, denser the faster the tractor goes. */
    private updateWheelDust(rawDt: number, speed: number) {
      if (!this.juiceEnabled || speed < WHEEL_DUST_MIN_SPEED) return;
      this.wheelDustTimer += rawDt;
      if (this.wheelDustTimer < WHEEL_DUST_INTERVAL) return;
      this.wheelDustTimer = 0;

      const intensity = clamp(speed / SPEED_LINES_MAX_SPEED, 0.3, 1);
      const count = Math.max(1, Math.round(intensity * 3));
      const wheelWorld = this.localToWorld(this.tractorContainer, this.layout.rearWheelOffset);
      this.wheelDustEmitter.explode(count, wheelWorld.x, wheelWorld.y + this.layout.rearWheelR * 0.6);
    }

    /** Exhaust puffs from the tailpipe — thin while cruising, thick while accelerating. */
    private updateExhaustSmoke(rawDt: number, speed: number) {
      const accel = rawDt > 0 ? (speed - this.prevSpeedForSmoke) / rawDt : 0;
      this.prevSpeedForSmoke = speed;
      if (!this.juiceEnabled) return;

      this.exhaustTimer += rawDt;
      if (this.exhaustTimer < EXHAUST_INTERVAL) return;
      this.exhaustTimer = 0;

      const thickness = clamp(accel / EXHAUST_ACCEL_REF, 0, 1);
      const count = 1 + Math.round(thickness * 2);
      const tip = this.localToWorld(this.tractorContainer, this.layout.exhaustTipOffset);
      this.exhaustEmitter.explode(count, tip.x, tip.y);
    }

    /** Loose hay tossed up from the trailer bed when a bump hits it hard. */
    private updateHayParticles(rawDt: number) {
      if (!this.juiceEnabled) return;
      const bumpiness = Math.abs(this.trailerYSpring.velocity);
      if (bumpiness < HAY_MIN_VELOCITY) return;

      this.hayTimer += rawDt;
      if (this.hayTimer < HAY_INTERVAL) return;
      this.hayTimer = 0;

      const count = 1 + Math.floor(clamp(bumpiness / 300, 0, 1) * 2);
      const localX = (this.effectsRng() - 0.5) * this.layout.trailerW * 0.6;
      const bedWorld = this.localToWorld(this.trailerContainer, { x: localX, y: -this.layout.trailerH * 0.2 });
      this.hayEmitter.explode(count, bedWorld.x, bedWorld.y);
    }

    /** One-shot team-colored confetti burst, right over the winner's seat, at the close call. */
    private triggerFinaleConfetti(winnerRig: PassengerRig) {
      const pos = this.localToWorld(this.trailerContainer, { x: winnerRig.seatX, y: winnerRig.seatY });
      const count = Math.max(10, Math.round(CONFETTI_BASE_COUNT * this.particleBurstScale()));
      this.confettiEmitter.explode(count, pos.x, pos.y - this.personH * 0.6);
    }

    /** Looped engine drone, pitch/volume tracking current speed — starts on the first call,
     * fades and stops via sound.stopEngine() once the ride hands off to the reveal (or on
     * unmount). Guarded on `onFinishCalled` since setEngineIntensity auto-starts the engine on
     * any call — without this, the very next frame after updateFinaleCallback's stopEngine()
     * would immediately restart it at idle (speed is 0 by then, but 0 is still a valid call). */
    private updateEngineSound(speed: number) {
      if (this.onFinishCalled) return;
      const fraction = clamp(speed / SPEED_LINES_MAX_SPEED, 0, 1);
      this.tractorData.sound.setEngineIntensity(fraction);
    }

    /** Regular road bumps, detected off the same suspension-velocity signal the visual
     * micro-shake/hay triggers already use, throttled so a rough stretch doesn't spam. */
    private updateBumpSound(rawDt: number) {
      if (this.onFinishCalled) return;
      this.bumpSoundCooldown = Math.max(0, this.bumpSoundCooldown - rawDt);
      const velocity = Math.abs(this.tractorYSpring.velocity);
      if (velocity <= BUMP_SOUND_VELOCITY_THRESHOLD || this.bumpSoundCooldown > 0) return;

      const intensity =
        clamp((velocity - BUMP_SOUND_VELOCITY_THRESHOLD) / BUMP_SOUND_VELOCITY_REF, 0, 1) * BUMP_SOUND_MAX_INTENSITY;
      this.tractorData.sound.playBump(intensity);
      this.bumpSoundCooldown = BUMP_SOUND_COOLDOWN;
    }

    private roadTopAt(x: number): number {
      return this.baselineY - this.roadProfile.roadHeight(x);
    }

    /** Screen-space tangent angle of the road profile at x, for pitching the chassis. */
    private slopeAngleAt(x: number, maxAngle: number): number {
      const y1 = this.roadTopAt(x - SLOPE_SAMPLE_EPS);
      const y2 = this.roadTopAt(x + SLOPE_SAMPLE_EPS);
      const angle = Math.atan2(y2 - y1, SLOPE_SAMPLE_EPS * 2);
      return clamp(angle, -maxAngle, maxAngle);
    }

    private updateDrawbar() {
      const hitchWorld = this.localToWorld(this.tractorContainer, this.layout.hitchOffset);
      const attachWorld = this.localToWorld(this.trailerContainer, this.layout.frontAttachOffset);

      this.drawbarGraphics.clear();
      this.drawbarGraphics.lineStyle(Math.max(2, this.layout.bodyH * 0.03), this.palette.exhaustMetal, 1);
      this.drawbarGraphics.beginPath();
      this.drawbarGraphics.moveTo(hitchWorld.x, hitchWorld.y);
      this.drawbarGraphics.lineTo(attachWorld.x, attachWorld.y);
      this.drawbarGraphics.strokePath();
    }

    private localToWorld(
      container: Phaser.GameObjects.Container,
      offset: { x: number; y: number }
    ): { x: number; y: number } {
      const rotated = rotateOffset(offset.x, offset.y, container.rotation);
      return { x: container.x + rotated.x, y: container.y + rotated.y };
    }

    /** Walks runPlan.ts's ejection schedule: panics the named target(s), then detaches them
     * right as the trailer reaches their bumpX — in plan order, never touching the winner. */
    private updateEjectionSchedule(trailerX: number, speed: number) {
      const ejections = this.runPlan.ejections;
      if (this.nextEjectionIndex >= ejections.length) return;
      const bumpX = ejections[this.nextEjectionIndex].bumpX;
      const distance = bumpX - trailerX;

      if (distance <= 0) {
        // Trigger every entry sharing this bumpX together (a 'double' ejection).
        while (this.nextEjectionIndex < ejections.length && ejections[this.nextEjectionIndex].bumpX === bumpX) {
          this.triggerEjection(ejections[this.nextEjectionIndex]);
          this.nextEjectionIndex++;
        }
        return;
      }

      const timeToHump = speed > 5 ? distance / speed : Infinity;
      if (timeToHump <= PANIC_LEAD_TIME) {
        for (let i = this.nextEjectionIndex; i < ejections.length && ejections[i].bumpX === bumpX; i++) {
          this.setPanic(ejections[i]);
        }
      }
    }

    private setPanic(ejection: Ejection) {
      const rig = this.passengerByTeamId.get(ejection.teamId);
      if (rig && rig.state === 'seated') {
        rig.state = 'panicking';
        rig.pendingEjection = ejection;
      }
    }

    /** The winner never ejects, but gets the same panic tell near the finale — a close call. */
    private updateCloseCall(trailerX: number, speed: number) {
      if (this.closeCallDone) return;
      const rig = this.passengerByTeamId.get(this.tractorData.targetTeam.id);
      if (!rig) return;

      const distance = this.runPlan.finaleX - trailerX;
      if (distance <= 0) {
        this.closeCallDone = true;
        this.closeCallAt = this.realElapsedSec;
        this.fastForwardActive = false;
        if (rig.state === 'panicking') rig.state = 'seated';
        rig.pendingEjection = undefined;
        this.triggerFinaleConfetti(rig);
        this.tractorData.sound.playFanfare();
        this.tractorData.sound.playConfettiPops();
        return;
      }
      const timeToFinale = speed > 5 ? distance / speed : Infinity;
      if (timeToFinale <= PANIC_LEAD_TIME && rig.state === 'seated') {
        rig.state = 'panicking';
      }
    }

    /** Space/Enter during an active ride — compresses whatever choreography remains into
     * FAST_FORWARD_TARGET_SEC of real time. Fixed once here, not recomputed per frame, so the
     * remaining ride actually arrives at the finale instead of asymptotically approaching it. */
    private activateFastForward() {
      if (this.fastForwardActive || this.closeCallDone) return;
      const remaining = Math.max(0.05, this.runPlan.durationSec - this.rideTime);
      this.fastForwardMultiplier = clamp(remaining / FAST_FORWARD_TARGET_SEC, 1, FAST_FORWARD_MAX_MULTIPLIER);
      this.fastForwardActive = true;
      // Clear/force-resume any hit-stop already in flight — while fast-forwarding, new impacts
      // skip hit-stop/slow-mo entirely (triggerImpactJuice), so a leftover pause here would
      // otherwise freeze physics for the rest of the ride.
      this.hitStopRemainingMs = 0;
      this.physics.world.resume();
      this.physics.world.timeScale = 1;
    }

    /** Holds on the winner's celebration for FINALE_GRACE_SEC of real time after the close
     * call resolves, then hands control back to the app via tractorData.onFinish — exactly
     * once, and always with the same targetTeam the ride was given, never re-derived. */
    private updateFinaleCallback() {
      if (!this.closeCallDone || this.onFinishCalled) return;
      const grace = this.tractorData.reducedMotion ? FINALE_GRACE_SEC_REDUCED : FINALE_GRACE_SEC;
      if (this.realElapsedSec - this.closeCallAt < grace) return;
      this.onFinishCalled = true;
      // Control passes to the app's own reveal overlay here, which can sit on screen for as
      // long as the presenter likes before they dismiss it (this scene stays mounted, just
      // covered) — the engine/wind loops are still-updatable AudioNodes owned by the sound
      // hook, not this scene, so they'd otherwise keep humming under the reveal indefinitely.
      this.tractorData.sound.stopEngine();
      this.tractorData.sound.stopWind();
      this.tractorData.onFinish(this.tractorData.targetTeam);
    }

    /** Screen-edge vignette that fades in once the close call resolves, framing the winner's
     * celebration like a spotlight. A real-time fade (not gated by fast-forward) so it always
     * reads as a deliberate beat rather than a flicker. */
    private updateVignette() {
      if (!this.juiceEnabled || !this.closeCallDone) {
        this.vignetteGraphics.setAlpha(0);
        return;
      }
      const t = clamp((this.realElapsedSec - this.closeCallAt) / VIGNETTE_FADE_IN_SEC, 0, 1);
      this.vignetteGraphics.setAlpha(t * VIGNETTE_MAX_ALPHA);
    }

    private buildVignette() {
      const { width, height } = this.tractorData;
      const edge = Math.max(width, height) * 0.32;
      const black = 0x000000;

      const g = this.add.graphics();
      g.fillGradientStyle(black, black, black, black, 1, 1, 0, 0);
      g.fillRect(0, 0, width, edge);
      g.fillGradientStyle(black, black, black, black, 0, 0, 1, 1);
      g.fillRect(0, height - edge, width, edge);
      g.fillGradientStyle(black, black, black, black, 1, 0, 1, 0);
      g.fillRect(0, 0, edge, height);
      g.fillGradientStyle(black, black, black, black, 0, 1, 0, 1);
      g.fillRect(width - edge, 0, edge, height);

      g.setScrollFactor(0);
      g.setDepth(DEPTH_UI - 1);
      g.setAlpha(0);
      this.vignetteGraphics = g;
    }

    private triggerEjection(ejection: Ejection) {
      const rig = this.passengerByTeamId.get(ejection.teamId);
      if (!rig || rig.state === 'ejected') return;
      rig.state = 'ejected';
      rig.pendingEjection = undefined;

      // Snapshot the world transform before detaching — the seat was a moving, rotating child
      // of the trailer, but once ejected it's a free body living directly in world space.
      const m = rig.container.getWorldTransformMatrix();
      const worldX = m.tx;
      const worldY = m.ty;
      const worldRotation = m.rotation;

      this.trailerContainer.remove(rig.container);
      this.add.existing(rig.container);
      rig.container.setPosition(worldX, worldY);
      rig.container.setRotation(worldRotation);
      rig.container.setDepth(DEPTH_EJECTED);

      this.physics.add.existing(rig.container);
      const body = (rig.container as PhysicsContainer).body;
      const boxW = this.personH * 0.5;
      const boxH = this.personH * 1.05;
      body.setSize(boxW, boxH);
      body.setOffset(-boxW / 2, -boxH);
      body.setAllowGravity(true);

      const heightScale = this.tractorData.height / EJECT_REFERENCE_HEIGHT;
      body.setGravityY(EJECT_GRAVITY * heightScale);

      const motion = STYLE_MOTION[ejection.style];
      const jitter = 0.85 + this.effectsRng() * 0.3;
      body.setVelocity(motion.vx * heightScale * jitter, motion.vy * heightScale * jitter);
      body.setAngularVelocity(motion.angularDeg * jitter);

      this.triggerImpactJuice();
      this.tractorData.sound.playEjectWhoosh();
      this.tractorData.sound.playBump(1);
      const clodCount = Math.max(2, Math.round(CLOD_BASE_COUNT * this.particleBurstScale()));
      this.clodEmitter.explode(clodCount, worldX, this.roadTopAt(worldX));

      const maxBounces = 1 + Math.floor(this.effectsRng() * 2);
      this.ejectedRigs.push({
        rig,
        ejection,
        bounces: 0,
        maxBounces,
        landed: false,
        landedAt: 0,
        starSprites: [],
        trailTimer: 0,
      });

      rig.chipText.setText(`Команда ${rig.team.name} выбыла!`);
      rig.chipBg.clear();
      this.drawChipBackground(rig.chipBg, rig.chipText, teamColorNumber(rig.team.color));

      this.tractorData.onEject?.(rig.team);
    }

    /** Impact beat for a detach: freeze-frame, then a slow-mo recovery, a strong camera shake,
     * a punch-zoom pulse, and a squash on the tractor+trailer — all real-time driven so they
     * play out even while the hit-stop has the sim itself frozen. */
    private triggerImpactJuice() {
      if (!this.juiceEnabled) return;
      this.punchZoomStartAt = this.realElapsedSec;
      this.squashStartAt = this.realElapsedSec;
      this.cameras.main.shake(STRONG_SHAKE_DURATION_MS, STRONG_SHAKE_INTENSITY);
      // Hit-stop/slow-mo would otherwise throttle dt for ~SLOWMO_RECOVER_SEC after every
      // single impact — fine normally, but stacked across a fast-forwarded cluster of
      // ejections it would repeatedly undercut the requested speedup. Skip it during FF; the
      // camera punch/shake/squash above still land, just without the freeze-frame.
      if (this.fastForwardActive) return;
      this.hitStopRemainingMs = HIT_STOP_MS;
      this.physics.world.pause();
      // slowmoStartAt is set when hit-stop ends (updateHitStopAndSlowmo), not here.
    }

    private buildSpeedLines() {
      this.speedLinesGraphics = this.add.graphics();
      this.speedLinesGraphics.setScrollFactor(0);
      this.speedLinesGraphics.setDepth(DEPTH_UI - 1);
    }

    private updateEjectedPassengers(dt: number) {
      // A single shared wind loop covers every currently-flying character — driven by
      // whoever is highest, so overlapping flights (a 'double' ejection) don't stack N
      // independent wind sounds on top of each other.
      let maxHeightFraction = 0;

      for (const e of this.ejectedRigs) {
        if (e.landed) {
          this.updateDazedPose(e);
        } else {
          const container = e.rig.container;
          const body = (container as PhysicsContainer).body;

          if (this.juiceEnabled) {
            e.trailTimer += dt;
            if (e.trailTimer >= FLIGHT_TRAIL_INTERVAL) {
              e.trailTimer = 0;
              this.flightTrailEmitter.explode(1, container.x, container.y - this.personH * 0.4);
            }
          }

          const groundY = this.roadTopAt(container.x);
          const heightFraction = clamp((groundY - container.y) / (this.tractorData.height * 0.45), 0, 1);
          maxHeightFraction = Math.max(maxHeightFraction, heightFraction);

          if (container.y >= groundY && body.velocity.y > 0) {
            container.y = groundY;
            const landDustCount = Math.max(2, Math.round(10 * this.particleBurstScale()));
            this.dustEmitter.explode(landDustCount, container.x, groundY);
            e.bounces++;
            if (e.bounces >= e.maxBounces) {
              body.setVelocity(0, 0);
              body.setAngularVelocity(0);
              body.enable = false;
              container.setRotation((this.effectsRng() - 0.5) * 0.4);
              e.landed = true;
              e.landedAt = this.rideTime;
              this.spawnDazedStars(e);
              this.tractorData.sound.playClunk();
              this.tractorData.sound.playComicHonk();
            } else {
              body.setVelocityY(-body.velocity.y * BOUNCE_DAMPING);
              body.setVelocityX(body.velocity.x * 0.6);
              body.setAngularVelocity(body.angularVelocity * 0.5);
            }
          }
        }

        // The name chip stays upright regardless of how hard the body is tumbling — a
        // "Team X is out!" callout that's spinning with a backflip isn't readable. Applied
        // last so it always reflects this frame's final rotation, including a just-landed snap.
        e.rig.chipContainer.setRotation(-e.rig.container.rotation);
      }

      this.tractorData.sound.setWindIntensity(maxHeightFraction);
    }

    private spawnDazedStars(e: EjectedRig) {
      for (let i = 0; i < 3; i++) {
        const star = this.add.sprite(e.rig.container.x, e.rig.container.y, this.starTextureKey);
        star.setDepth(DEPTH_STAR);
        e.starSprites.push(star);
      }
    }

    private updateDazedPose(e: EjectedRig) {
      const elapsed = this.rideTime - e.landedAt;
      if (elapsed < STAR_DURATION && e.starSprites.length > 0) {
        const cx = e.rig.container.x;
        const cy = e.rig.container.y - this.personH * 1.15;
        const r = this.personH * 0.3;
        e.starSprites.forEach((star, i) => {
          const angle = this.rideTime * STAR_SPIN_SPEED + (i * Math.PI * 2) / e.starSprites.length;
          star.setPosition(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.55);
          star.setRotation(angle * 2);
          star.setAlpha(clamp(1 - elapsed / STAR_DURATION, 0, 1));
        });
      } else if (e.starSprites.length > 0) {
        for (const star of e.starSprites) star.destroy();
        e.starSprites = [];
      }

      // Waves goodbye — cheap ambient motion, no physics involved, so it can run indefinitely.
      const wave = Math.sin(this.rideTime * WAVE_FREQ) * WAVE_AMPLITUDE;
      e.rig.armRight.rotation = WAVE_BASE + wave;
    }

    private updatePassengers(dt: number) {
      const angularVel = this.trailerAngleSpring.velocity;
      const verticalVel = this.trailerYSpring.velocity;

      for (const p of this.passengers) {
        if (p.state === 'ejected') continue;

        if (this.closeCallDone && p.team.id === this.tractorData.targetTeam.id) {
          const bob = Math.sin(this.rideTime * CELEBRATE_BOB_FREQ + p.phase) * this.personH * CELEBRATE_BOB_AMPLITUDE;
          p.container.x = p.seatX;
          p.container.y = p.seatY - this.personH * CELEBRATE_STAND_RAISE + bob;
          p.container.rotation = 0;
          const waveL = CELEBRATE_ARM_UP + Math.sin(this.rideTime * CELEBRATE_WAVE_FREQ + p.phase) * CELEBRATE_WAVE_AMPLITUDE;
          const waveR =
            CELEBRATE_ARM_UP - Math.sin(this.rideTime * CELEBRATE_WAVE_FREQ + p.phase + 0.6) * CELEBRATE_WAVE_AMPLITUDE;
          p.armLeft.rotation = waveL;
          p.armRight.rotation = waveR;
          continue;
        }

        const leanTarget =
          clamp(-angularVel * LEAN_REACTION_TIME, -MAX_LEAN_RAD, MAX_LEAN_RAD) +
          Math.sin(this.rideTime * IDLE_SWAY_FREQ * p.freqJitter + p.phase) * 0.05;
        const bobTarget =
          -verticalVel * BOB_REACTION_TIME +
          Math.sin(this.rideTime * IDLE_SWAY_FREQ * 1.3 * p.freqJitter + p.phase * 1.7) * this.personH * 0.02;
        p.leanSpring.update(leanTarget, dt);
        p.bobSpring.update(bobTarget, dt);

        const panicking = p.state === 'panicking';
        const shakeMult = panicking && p.pendingEjection?.fakeout ? FAKEOUT_SHAKE_MULT : 1;
        const panicShakeX = panicking
          ? Math.sin(this.rideTime * PANIC_SHAKE_FREQ + p.phase * 3) * PANIC_SHAKE_AMPLITUDE * shakeMult
          : 0;

        p.container.x = p.seatX + panicShakeX;
        p.container.y = p.seatY + p.bobSpring.value;
        p.container.rotation = p.leanSpring.value;

        const flailAngle = panicking
          ? Math.sin(this.rideTime * ARM_FLAIL_FREQ * p.freqJitter + p.phase) * ARM_FLAIL_AMPLITUDE
          : Math.sin(this.rideTime * 1.2 * p.freqJitter + p.phase) * ARM_IDLE_AMPLITUDE;
        p.armLeft.rotation = ARM_BASE_LEFT + flailAngle;
        p.armRight.rotation = ARM_BASE_RIGHT - flailAngle;
      }
    }

    private drawSky(width: number, height: number) {
      this.skyGraphics = this.add.graphics();
      this.skyGraphics.setScrollFactor(0);
      this.skyGraphics.setDepth(DEPTH_SKY);
      this.repaintSky(width, height);
    }

    private repaintSky(width: number, height: number) {
      const g = this.skyGraphics;
      g.clear();
      g.fillGradientStyle(this.palette.skyTop, this.palette.skyTop, this.palette.skyBottom, this.palette.skyBottom, 1);
      g.fillRect(0, 0, width, height);
    }

    private buildParallaxLayers(width: number, height: number, seed: number) {
      this.skyElementsKey = buildSkyElementsTexture(this, this.palette, height, seed);
      this.hillsKey = buildHillsTexture(this, this.palette, height, seed);
      this.fieldKey = buildFieldTexture(this, this.palette, height, seed);
      this.foregroundKey = buildForegroundTexture(this, this.palette, height, seed);

      this.skyElementsLayer = this.add
        .tileSprite(width / 2, height / 2, width, height, this.skyElementsKey)
        .setScrollFactor(0)
        .setDepth(DEPTH_SKY_ELEMENTS);

      this.hillsLayer = this.add
        .tileSprite(width / 2, height / 2, width, height, this.hillsKey)
        .setScrollFactor(0)
        .setDepth(DEPTH_HILLS);

      this.fieldLayer = this.add
        .tileSprite(width / 2, height / 2, width, height, this.fieldKey)
        .setScrollFactor(0)
        .setDepth(DEPTH_FIELD);

      this.foregroundLayer = this.add
        .tileSprite(width / 2, height / 2, width, height, this.foregroundKey)
        .setScrollFactor(0)
        .setDepth(DEPTH_FOREGROUND);
    }

    /** Small twinkling stars, dark-theme-only — built/torn down by repaintTheme() as the
     * active theme changes. Reuses effectsTextures.ts's star shape (already palette-tinted). */
    private buildStars(width: number, height: number) {
      for (const s of this.starSprites) s.destroy();
      this.starSprites = [];
      for (const key of this.starTextureKeys) {
        if (this.textures.exists(key)) this.textures.remove(key);
      }
      this.starTextureKeys = [];
      if (!this.isDarkTheme) return;

      const rng = makeRng(this.tractorData.seed + 42);
      for (let i = 0; i < STAR_COUNT; i++) {
        const size = STAR_MIN_SIZE + rng() * (STAR_MAX_SIZE - STAR_MIN_SIZE);
        const key = buildStarTexture(this, this.palette, size);
        this.starTextureKeys.push(key);
        const x = rng() * width;
        const y = rng() * height * 0.6;
        const star = this.add.sprite(x, y, key);
        star.setScrollFactor(0);
        star.setDepth(DEPTH_STARS);
        star.setAlpha(0.4 + rng() * 0.5);
        star.setData('phase', rng() * Math.PI * 2);
        this.starSprites.push(star);
      }
    }

    private updateStars() {
      if (this.starSprites.length === 0) return;
      for (const star of this.starSprites) {
        const phase = star.getData('phase') as number;
        const twinkle = 0.5 + 0.5 * Math.sin(this.realElapsedSec * STAR_TWINKLE_FREQ + phase);
        star.setAlpha(0.35 + twinkle * 0.5);
      }
    }

    /** Headlight beam, dark-theme-only, additively blended so it glows against a night sky —
     * a child of tractorContainer so it rides along with the chassis for free. */
    private buildHeadlight() {
      this.headlightSprite?.destroy();
      this.headlightSprite = undefined;
      if (!this.isDarkTheme) return;

      const L = this.layout;
      const w = L.bodyW * HEADLIGHT_LENGTH_FACTOR;
      const h = L.bodyH * HEADLIGHT_HEIGHT_FACTOR;
      this.headlightKey = this.repaintPaletteTexture(this.headlightKey, () =>
        buildHeadlightConeTexture(this, this.palette, w, h)
      );
      const anchorX = L.bodyOffset.x + L.bodyW * 0.97;
      const anchorY = L.bodyOffset.y + L.bodyH * 0.58;
      const sprite = this.add.sprite(anchorX, anchorY, this.headlightKey).setOrigin(0, 0.5);
      sprite.setBlendMode(PhaserNS.BlendModes.ADD);
      this.tractorContainer.add(sprite);
      this.headlightSprite = sprite;
    }

    /** Removes the old cached texture under `oldKey` (if any) so `rebuild()` — which
     * regenerates under the *same* key via ensureTexture — actually redraws instead of
     * silently returning the stale cached one, then returns that key. */
    private repaintPaletteTexture(oldKey: string, rebuild: () => string): string {
      if (oldKey && this.textures.exists(oldKey)) this.textures.remove(oldKey);
      return rebuild();
    }

    /**
     * Live theme-switch repaint — reassigns `this.palette` from the app's current CSS
     * variables and redraws/rebuilds everything derived from it, without touching the
     * Phaser.Game instance, the ride's own state (rideTime, ejections already scheduled,
     * choreography), or anything team-colored (passenger tints, name chips, confetti tint
     * array all stay exactly as they were — only the *environment's* palette changes).
     */
    private repaintTheme() {
      const { width, height, seed } = this.tractorData;
      const L = this.layout;

      this.palette = readThemePalette();
      this.isDarkTheme = isDarkPalette(this.palette);

      this.repaintSky(width, height);
      this.repaintRoad();

      this.skyElementsKey = this.repaintPaletteTexture(this.skyElementsKey, () =>
        buildSkyElementsTexture(this, this.palette, height, seed)
      );
      this.skyElementsLayer.setTexture(this.skyElementsKey);

      this.hillsKey = this.repaintPaletteTexture(this.hillsKey, () =>
        buildHillsTexture(this, this.palette, height, seed)
      );
      this.hillsLayer.setTexture(this.hillsKey);

      this.fieldKey = this.repaintPaletteTexture(this.fieldKey, () =>
        buildFieldTexture(this, this.palette, height, seed)
      );
      this.fieldLayer.setTexture(this.fieldKey);

      this.foregroundKey = this.repaintPaletteTexture(this.foregroundKey, () =>
        buildForegroundTexture(this, this.palette, height, seed)
      );
      this.foregroundLayer.setTexture(this.foregroundKey);

      this.bodyKey = this.repaintPaletteTexture(this.bodyKey, () =>
        buildTractorBodyTexture(this, this.palette, L.bodyW, L.bodyH, seed)
      );
      this.tractorBodySprite.setTexture(this.bodyKey);

      this.rearWheelKey = this.repaintPaletteTexture(this.rearWheelKey, () =>
        buildWheelTexture(this, this.palette, L.rearWheelR, `tractor-wheel-rear-${seed}`)
      );
      this.rearWheel.setTexture(this.rearWheelKey);

      this.frontWheelKey = this.repaintPaletteTexture(this.frontWheelKey, () =>
        buildWheelTexture(this, this.palette, L.frontWheelR, `tractor-wheel-front-${seed}`)
      );
      this.frontWheel.setTexture(this.frontWheelKey);

      this.trailerWheelKey = this.repaintPaletteTexture(this.trailerWheelKey, () =>
        buildWheelTexture(this, this.palette, L.trailerWheelR, `tractor-wheel-trailer-${seed}`)
      );
      this.trailerWheelA.setTexture(this.trailerWheelKey);
      this.trailerWheelB.setTexture(this.trailerWheelKey);

      const driverW = L.bodyH * 0.42;
      this.driverKey = this.repaintPaletteTexture(this.driverKey, () =>
        buildDriverTexture(this, this.palette, driverW, driverW)
      );
      this.driverSprite.setTexture(this.driverKey);

      this.bedKey = this.repaintPaletteTexture(this.bedKey, () =>
        buildTrailerBedTexture(this, this.palette, L.trailerW, L.trailerH)
      );
      this.trailerBedSprite.setTexture(this.bedKey);

      this.frontWallKey = this.repaintPaletteTexture(this.frontWallKey, () =>
        buildTrailerFrontWallTexture(this, this.palette, L.frontWallW, L.frontWallH)
      );
      this.trailerFrontWallSprite.setTexture(this.frontWallKey);

      // killAll() first on every emitter whose texture is about to be removed: a *live*
      // particle holds its own frame reference independent of the emitter's "texture for new
      // particles" — removing the old texture out from under one still mid-flight crashes the
      // WebGL renderer (Frame.glTexture reads null) on the next draw. Losing a few in-flight
      // dust/smoke puffs to a theme switch is an imperceptible, acceptable trade.
      this.dustEmitter.killAll();
      this.landingDustKey = this.repaintPaletteTexture(this.landingDustKey, () =>
        buildDustTexture(this, this.palette, Math.max(10, this.personH * 0.35))
      );
      this.dustEmitter.setTexture(this.landingDustKey);

      this.exhaustEmitter.killAll();
      this.smokeKey = this.repaintPaletteTexture(this.smokeKey, () =>
        buildSmokeTexture(this, this.palette, height * 0.045)
      );
      this.exhaustEmitter.setTexture(this.smokeKey);

      this.wheelDustEmitter.killAll();
      this.wheelDustKey = this.repaintPaletteTexture(this.wheelDustKey, () =>
        buildDustTexture(this, this.palette, height * 0.025)
      );
      this.wheelDustEmitter.setTexture(this.wheelDustKey);

      this.clodEmitter.killAll();
      this.clodKey = this.repaintPaletteTexture(this.clodKey, () => buildClodTexture(this, this.palette, height * 0.03));
      this.clodEmitter.setTexture(this.clodKey);

      this.flightTrailEmitter.killAll();
      this.flightTrailKey = this.repaintPaletteTexture(this.flightTrailKey, () =>
        buildDustTexture(this, this.palette, height * 0.02)
      );
      this.flightTrailEmitter.setTexture(this.flightTrailKey);

      this.hayEmitter.killAll();
      this.hayKey = this.repaintPaletteTexture(this.hayKey, () =>
        buildHayTexture(this, this.palette, height * 0.045, height * 0.014)
      );
      this.hayEmitter.setTexture(this.hayKey);

      // Dazed-stars texture — spawnDazedStars spawns new sprites from this key on demand, but
      // any *currently alive* dazed-star sprites (regular Sprites, same stale-reference risk
      // as above) need their frame re-bound explicitly too, not just future spawns.
      const dazedStarSize = Math.max(12, this.personH * 0.3);
      this.starTextureKey = this.repaintPaletteTexture(this.starTextureKey, () =>
        buildStarTexture(this, this.palette, dazedStarSize)
      );
      for (const e of this.ejectedRigs) {
        for (const star of e.starSprites) star.setTexture(this.starTextureKey);
      }

      // Confetti and every passenger/name-chip/team-tint visual are intentionally untouched —
      // team colors never change on a theme switch.
      this.buildHeadlight();
      this.buildStars(width, height);
    }

    private buildRoad() {
      this.roadGraphics = this.add.graphics();
      this.roadGraphics.setDepth(DEPTH_ROAD);
      this.repaintRoad();
    }

    private repaintRoad() {
      const g = this.roadGraphics;
      g.clear();
      const { length } = this.roadProfile;
      const step = 12;
      const thickness = 26;
      const samples: number[] = [];
      for (let x = 0; x <= length; x += step) samples.push(x);
      if (samples[samples.length - 1] !== length) samples.push(length);

      const topAt = (x: number) => this.roadTopAt(x);

      // Ground/dirt fill beneath the road, down to the bottom of the world — the "ground line".
      g.fillStyle(this.palette.ground, 1);
      g.beginPath();
      g.moveTo(0, topAt(0));
      for (const x of samples) g.lineTo(x, topAt(x));
      g.lineTo(length, this.baselineY + 400);
      g.lineTo(0, this.baselineY + 400);
      g.closePath();
      g.fillPath();

      // Asphalt ribbon of constant thickness following the terrain.
      g.fillStyle(this.palette.road, 1);
      g.beginPath();
      g.moveTo(0, topAt(0));
      for (const x of samples) g.lineTo(x, topAt(x));
      for (let i = samples.length - 1; i >= 0; i--) g.lineTo(samples[i], topAt(samples[i]) + thickness);
      g.closePath();
      g.fillPath();

      // Curb edge.
      g.lineStyle(3, this.palette.roadEdge, 0.9);
      g.beginPath();
      g.moveTo(0, topAt(0));
      for (const x of samples) g.lineTo(x, topAt(x));
      g.strokePath();

      // Dashed centerline.
      g.lineStyle(3, this.palette.roadLine, 0.75);
      for (let i = 0; i < samples.length - 1; i += 2) {
        const x1 = samples[i];
        const x2 = samples[i + 1];
        g.beginPath();
        g.moveTo(x1, topAt(x1) + thickness / 2);
        g.lineTo(x2, topAt(x2) + thickness / 2);
        g.strokePath();
      }
    }

    private buildVehicle(seed: number) {
      const L = this.layout;

      this.bodyKey = buildTractorBodyTexture(this, this.palette, L.bodyW, L.bodyH, seed);
      this.rearWheelKey = buildWheelTexture(this, this.palette, L.rearWheelR, `tractor-wheel-rear-${seed}`);
      this.frontWheelKey = buildWheelTexture(this, this.palette, L.frontWheelR, `tractor-wheel-front-${seed}`);
      const driverW = L.bodyH * 0.42;
      const driverH = driverW; // built square; the driver texture itself frames the silhouette within it.
      this.driverKey = buildDriverTexture(this, this.palette, driverW, driverH);
      this.bedKey = buildTrailerBedTexture(this, this.palette, L.trailerW, L.trailerH);
      this.frontWallKey = buildTrailerFrontWallTexture(this, this.palette, L.frontWallW, L.frontWallH);
      this.trailerWheelKey = buildWheelTexture(this, this.palette, L.trailerWheelR, `tractor-wheel-trailer-${seed}`);

      this.rearWheel = this.add.sprite(L.rearWheelOffset.x, L.rearWheelOffset.y, this.rearWheelKey);
      this.frontWheel = this.add.sprite(L.frontWheelOffset.x, L.frontWheelOffset.y, this.frontWheelKey);
      this.tractorBodySprite = this.add.sprite(L.bodyOffset.x, L.bodyOffset.y, this.bodyKey).setOrigin(0, 0);
      this.driverSprite = this.add.sprite(L.driverOffset.x, L.driverOffset.y, this.driverKey).setOrigin(0, 0);

      // Render order back-to-front within the assembly: body (with its fender arches) painted
      // first, then both wheels on top so they read as sitting in front of the chassis rather
      // than tucked away behind it.
      this.tractorContainer = this.add.container(0, 0, [
        this.tractorBodySprite,
        this.driverSprite,
        this.rearWheel,
        this.frontWheel,
      ]);
      this.tractorContainer.setDepth(DEPTH_TRACTOR);
      this.buildHeadlight();

      this.trailerBedSprite = this.add.sprite(L.bedOffset.x, L.bedOffset.y, this.bedKey).setOrigin(0, 0);
      this.trailerFrontWallSprite = this.add
        .sprite(L.frontWallOffset.x, L.frontWallOffset.y, this.frontWallKey)
        .setOrigin(0, 0);
      this.trailerWheelA = this.add.sprite(L.trailerWheelOffsetA.x, L.trailerWheelOffsetA.y, this.trailerWheelKey);
      this.trailerWheelB = this.add.sprite(L.trailerWheelOffsetB.x, L.trailerWheelOffsetB.y, this.trailerWheelKey);
      const passengers = this.buildPassengers(seed);
      // `frontWall` is the front board — added last so it renders in front of the bed and
      // every passenger. Wheels sit right after the bed, in front of it, same as the tractor's.
      this.trailerContainer = this.add.container(0, 0, [
        this.trailerBedSprite,
        this.trailerWheelA,
        this.trailerWheelB,
        ...passengers,
        this.trailerFrontWallSprite,
      ]);
      this.trailerContainer.setDepth(DEPTH_TRAILER);

      this.drawbarGraphics = this.add.graphics();
      this.drawbarGraphics.setDepth(DEPTH_DRAWBAR);
    }

    /** Seats every team in the trailer bed and returns their containers in back-to-front paint order. */
    private buildPassengers(seed: number): Phaser.GameObjects.Container[] {
      const L = this.layout;
      const teams = this.tractorData.teams;
      const seatedTeams = shuffleSeatOrder(teams, seed);

      // Geometry (walls, floor) doesn't depend on how many teams there are, so it can be
      // measured before we know the final scale — computeSeatLayout uses it to work out how
      // much shrinking (and whether a second row) is actually needed to avoid overlap.
      const floorTopY = L.bedOffset.y + (1 - TRAILER_FLOOR_FRACTION) * L.trailerH;
      const wallInset = TRAILER_WALL_FRACTION * L.trailerW * 1.4;
      const seatXMin = L.bedOffset.x + wallInset;
      const seatXMax = L.frontWallOffset.x - L.frontWallW * 0.7;
      const rowSpan = seatXMax - seatXMin;

      const naturalPersonH = L.trailerH * 0.6;
      const naturalBodyW = naturalPersonH * 0.42;
      const naturalSeatWidth = naturalBodyW * 1.55;

      this.seatLayout = computeSeatLayout({
        teamCount: teams.length,
        availableWidth: rowSpan,
        seatWidth: naturalSeatWidth,
      });

      const scale = this.seatLayout.scale;
      // this.personH is the *effective* (already-shrunk) height, used everywhere else in the
      // scene (particle sizing, dazed-star placement, confetti height) — but the texture
      // dimensions below must come from the *natural* size instead, since container.setScale
      // (below) applies the shrink a second time. Building the head/body/arm textures from
      // this.personH here was compounding the two, quietly squaring the shrink factor — at a
      // typical 8-team scale of ~0.44 that made passengers render at roughly a fifth of their
      // intended size, just a sliver poking out under their (correctly-sized) name chip.
      this.personH = naturalPersonH * scale;
      const headR = naturalPersonH * 0.19;
      const bodyW = naturalPersonH * 0.42;
      const bodyH = naturalPersonH * 0.5;
      const armW = bodyW * 0.28;
      const armH = bodyH * 0.68;

      const headKey = buildPersonHeadTexture(this, headR * 2);
      const bodyKey = buildPersonBodyTexture(this, bodyW, bodyH);
      const armKey = buildPersonArmTexture(this, armW, armH);

      // Standing on a raised bench, offset up so the back row's heads clear the front row. A
      // standing person's own effective height (feet to head-top) is ~0.88*personH, so 0.8 was
      // just short of full clearance — the back row's feet/lower body ended up masked behind
      // the front row's heads (visually reading as "half of them didn't render").
      const rowYOffset = [0, -this.personH * 1.05];

      const rng = makeRng(seed + 777);
      const sprites: Phaser.GameObjects.Container[] = [];
      let seated = 0;

      // Back row first (row 1) so it paints behind the front row (row 0).
      for (let row = this.seatLayout.rows - 1; row >= 0; row--) {
        const count = this.seatLayout.perRow[row];
        for (let col = 0; col < count; col++) {
          const team = seatedTeams[seated];
          seated++;
          const seatX = count <= 1 ? seatXMin + rowSpan / 2 : seatXMin + (rowSpan * (col + 0.5)) / count;
          const seatY = floorTopY + rowYOffset[row];

          const tint = teamColorNumber(team.color);
          const head = this.add.sprite(0, -bodyH - headR * 0.9, headKey).setTint(tint);
          const body = this.add.sprite(0, 0, bodyKey).setOrigin(0.5, 1).setTint(tint);
          const armLeft = this.add
            .sprite(-bodyW * 0.42, -bodyH * 0.85, armKey)
            .setOrigin(0.5, 0)
            .setTint(tint)
            .setRotation(ARM_BASE_LEFT);
          const armRight = this.add
            .sprite(bodyW * 0.42, -bodyH * 0.85, armKey)
            .setOrigin(0.5, 0)
            .setTint(tint)
            .setRotation(ARM_BASE_RIGHT);
          const { container: chip, text: chipText, bg: chipBg } = this.createNameChip(team, scale);
          chip.setPosition(0, -bodyH - headR * 2.3);

          const container = this.add.container(seatX, seatY, [armLeft, armRight, body, head, chip]);
          container.setScale(scale);
          container.setDepth(row === 0 ? DEPTH_PASSENGER_FRONT_ROW : DEPTH_PASSENGER_BACK_ROW);

          const rig: PassengerRig = {
            team,
            container,
            armLeft,
            armRight,
            chipContainer: chip,
            chipText,
            chipBg,
            seatX,
            seatY,
            leanSpring: new Spring1D(0, PASSENGER_LEAN_STIFFNESS, PASSENGER_LEAN_DAMPING),
            bobSpring: new Spring1D(0, PASSENGER_BOB_STIFFNESS, PASSENGER_BOB_DAMPING),
            phase: rng() * Math.PI * 2,
            freqJitter: 0.8 + rng() * 0.4,
            state: 'seated',
          };
          this.passengers.push(rig);
          this.passengerByTeamId.set(team.id, rig);
          sprites.push(container);
        }
      }

      return sprites;
    }

    private createNameChip(
      team: Team,
      scale: number
    ): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Graphics } {
      const text = this.add
        .text(0, 0, team.name, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: '800',
          color: '#f8fafc',
        })
        .setOrigin(0.5, 0.5);

      const bg = this.add.graphics();
      this.drawChipBackground(bg, text, teamColorNumber(team.color));

      const container = this.add.container(0, 0, [bg, text]);
      // Counteract the passenger container's own scale so the chip text stays legible even
      // when many teams force a smaller seat scale.
      container.setScale(1 / scale);
      return { container, text, bg };
    }

    private drawChipBackground(bg: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text, accent: number) {
      const padX = 8;
      const padY = 4;
      const w = text.width + padX * 2;
      const h = text.height + padY * 2;
      bg.fillStyle(0x0b1220, 0.82);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(1, accent, 0.9);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }

    private buildEjectionEffects() {
      this.landingDustKey = buildDustTexture(this, this.palette, Math.max(10, this.personH * 0.35));
      this.dustEmitter = this.add.particles(0, 0, this.landingDustKey, {
        lifespan: 500,
        speed: { min: 40, max: 140 },
        angle: { min: 200, max: 340 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 0.8, end: 0 },
        gravityY: 200,
        maxParticles: 40,
        emitting: false,
      });
      this.dustEmitter.setDepth(DEPTH_DUST);

      this.starTextureKey = buildStarTexture(this, this.palette, Math.max(12, this.personH * 0.3));
    }

    private particleBurstScale(): number {
      return this.juiceEnabled ? 1 : REDUCED_MOTION_PARTICLE_SCALE;
    }

    private buildParticleEffects() {
      const height = this.tractorData.height;

      this.smokeKey = buildSmokeTexture(this, this.palette, height * 0.045);
      this.exhaustEmitter = this.add.particles(0, 0, this.smokeKey, {
        lifespan: 650,
        speed: { min: 10, max: 35 },
        angle: { min: 250, max: 290 },
        scale: { start: 0.6, end: 1.6 },
        alpha: { start: 0.6, end: 0 },
        gravityY: -30,
        maxParticles: EXHAUST_MAX_PARTICLES,
        emitting: false,
      });
      this.exhaustEmitter.setDepth(DEPTH_SMOKE);

      this.wheelDustKey = buildDustTexture(this, this.palette, height * 0.025);
      this.wheelDustEmitter = this.add.particles(0, 0, this.wheelDustKey, {
        lifespan: 400,
        speed: { min: 20, max: 70 },
        angle: { min: 150, max: 210 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        gravityY: 80,
        maxParticles: WHEEL_DUST_MAX_PARTICLES,
        emitting: false,
      });
      this.wheelDustEmitter.setDepth(DEPTH_DUST);

      this.clodKey = buildClodTexture(this, this.palette, height * 0.03);
      this.clodEmitter = this.add.particles(0, 0, this.clodKey, {
        lifespan: 550,
        speed: { min: 60, max: 220 },
        angle: { min: 200, max: 340 },
        rotate: { min: 0, max: 360 },
        scale: { start: 1, end: 0.6 },
        alpha: { start: 1, end: 0 },
        gravityY: 700,
        maxParticles: CLOD_MAX_PARTICLES,
        emitting: false,
      });
      this.clodEmitter.setDepth(DEPTH_CLOD);

      this.flightTrailKey = buildDustTexture(this, this.palette, height * 0.02);
      this.flightTrailEmitter = this.add.particles(0, 0, this.flightTrailKey, {
        lifespan: 350,
        speed: { min: 5, max: 25 },
        scale: { start: 0.7, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
        gravityY: 0,
        maxParticles: FLIGHT_TRAIL_MAX_PARTICLES,
        emitting: false,
      });
      this.flightTrailEmitter.setDepth(DEPTH_TRAIL);

      this.hayKey = buildHayTexture(this, this.palette, height * 0.045, height * 0.014);
      this.hayEmitter = this.add.particles(0, 0, this.hayKey, {
        lifespan: 700,
        speed: { min: 40, max: 130 },
        angle: { min: 240, max: 300 },
        rotate: { min: 0, max: 360 },
        scale: { start: 1, end: 0.7 },
        alpha: { start: 0.9, end: 0 },
        gravityY: 500,
        maxParticles: HAY_MAX_PARTICLES,
        emitting: false,
      });
      this.hayEmitter.setDepth(DEPTH_HAY);

      const confettiKey = buildConfettiTexture(this, height * 0.018);
      const tints = this.tractorData.teams.map((t) => teamColorNumber(t.color));
      this.confettiEmitter = this.add.particles(0, 0, confettiKey, {
        lifespan: 1500,
        speed: { min: 120, max: 380 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 360 },
        gravityY: 260,
        scale: { start: 1, end: 0.4 },
        alpha: { start: 1, end: 0 },
        tint: tints,
        maxParticles: CONFETTI_MAX_PARTICLES,
        emitting: false,
      });
      this.confettiEmitter.setDepth(DEPTH_CONFETTI);
    }
  };
}
