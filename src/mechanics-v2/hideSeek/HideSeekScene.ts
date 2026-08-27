/**
 * Orchestrates one hide-and-seek "ride": builds the Three.js maze scene from a
 * `buildHideSeekPlan` script and steps through it on its own rAF loop, exactly the way
 * TractorScene steps through `buildRunPlan`'s timeline — except Three.js (unlike Phaser)
 * owns no render loop of its own, so this class runs and cancels its own `requestAnimationFrame`.
 */
import * as THREE from 'three';
import type { Team } from '../../domain/types';
import type { SoundV2Api } from '../adapter';
import { computeMazeSize } from './logic/mazeSize';
import { generateMaze, type Grid } from './logic/maze';
import { buildHideSeekPlan, type HideSeekPlan, type ChaseStep } from './logic/choreography';
import { buildMazeGroup, cellToWorld, mazeWorldBounds } from './sceneBuild/mazeGeometry';
import {
  createRenderer,
  createIsoCamera,
  placeIsoCamera,
  applyFrustum,
  lerpFrustum,
  fitFrustumToPoints,
  lerpToward,
  type Frustum,
} from './sceneBuild/cameraRig';
import { disposeObject3D } from './sceneBuild/dispose';
import { updateCharacterAnim, type CharacterRig, type AnimState } from './people/character';
import { loadCharacterAssets, makeGlbTeamCharacter, makeGlbSeekerCharacter, TEAM_MODEL_FILES } from './people/glbCharacters';

export interface HideSeekInitData {
  teams: Team[];
  targetTeam: Team;
  seed: number;
  width: number;
  height: number;
  sound: SoundV2Api;
  reducedMotion: boolean;
  onCaption: (text: string | null) => void;
  onFinish: (winner: Team) => void;
}

const ENTRANCE: [number, number] = [0, 0];
const OUTWARD_LEN = Math.hypot(1, 1);
const OUTWARD = { x: 1 / OUTWARD_LEN, z: 1 / OUTWARD_LEN };

const TEAM_JITTER_RADIUS = 65;
const SEEKER_OFFSET = 60;
const APPROACH_ZOOM_FRACTION = 0.5;
const PULLBACK_DURATION_FRACTION = 0.3;
const CHASE_RADIUS = 345; // ~15% wider than the original 300 — less zoom, more maze visible
const FANFARE_DELAY_SEC = 0.2;
const FOUND_PULSE_DURATION = 0.3;
const FAKEOUT_WOBBLE_RAD = 0.35;

interface Keyframe {
  cell: [number, number];
  arriveSec: number;
}

function interpolatePath(keyframes: Keyframe[], t: number): { x: number; z: number; facing: number; moving: boolean } {
  const first = cellToWorld(keyframes[0].cell[0], keyframes[0].cell[1]);
  if (t <= keyframes[0].arriveSec) return { x: first.x, z: first.z, facing: 0, moving: false };

  const lastArrive = keyframes[keyframes.length - 1].arriveSec;
  for (let i = 1; i < keyframes.length; i++) {
    const cur = keyframes[i];
    if (t <= cur.arriveSec || i === keyframes.length - 1) {
      const prev = keyframes[i - 1];
      const segDur = Math.max(1e-6, cur.arriveSec - prev.arriveSec);
      const segT = Math.min(1, Math.max(0, (t - prev.arriveSec) / segDur));
      const pPrev = cellToWorld(prev.cell[0], prev.cell[1]);
      const pCur = cellToWorld(cur.cell[0], cur.cell[1]);
      const x = pPrev.x + (pCur.x - pPrev.x) * segT;
      const z = pPrev.z + (pCur.z - pPrev.z) * segT;
      const facing = pCur.x === pPrev.x && pCur.z === pPrev.z ? 0 : Math.atan2(pCur.x - pPrev.x, pCur.z - pPrev.z);
      return { x, z, facing, moving: t < lastArrive };
    }
  }
  return { x: first.x, z: first.z, facing: 0, moving: false };
}

/** True if `t` just crossed one of the keyframes' arrival times since `prev` — used to fire a
 *  footstep sound exactly once per cell arrival, regardless of frame rate. */
function crossedAKeyframe(keyframes: Keyframe[], prev: number, t: number): boolean {
  for (let i = 1; i < keyframes.length; i++) {
    if (prev < keyframes[i].arriveSec && t >= keyframes[i].arriveSec) return true;
  }
  return false;
}

function buildLights(): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xffffff, 0x33303a, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(300, 700, 200);
  group.add(key);
  const fill = new THREE.DirectionalLight(0xfff2dd, 0.7);
  fill.position.set(-400, 300, -300);
  group.add(fill);
  return group;
}

export class HideSeekScene {
  private init: HideSeekInitData;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = createIsoCamera();
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private elapsed = 0;
  private finished = false;
  private destroyed = false;
  private fanfareAt: number | null = null;

  private plan!: HideSeekPlan;
  private teamRigs = new Map<string, CharacterRig>();
  private teamKeyframes = new Map<string, Keyframe[]>();
  private teamJitter = new Map<string, { x: number; z: number }>();
  private teamAnim = new Map<string, AnimState>();
  private seekerRig!: CharacterRig;
  private seekerAnim: AnimState = { phase: 0, amount: 0 };
  private stagingCenter = { x: 0, z: 0 };
  private seekerRestPos = { x: 0, z: 0 };
  private entranceWorld = { x: 0, z: 0 };
  private targetChipBaseScale: THREE.Vector2 | null = null;

  private wideFrustum!: Frustum;
  private wideTarget = new THREE.Vector3();
  private tightFrustum!: Frustum;
  private tightTarget = new THREE.Vector3();
  private mazeWideFrustum!: Frustum;
  private mazeWideTarget = new THREE.Vector3();
  private chaseFrustum!: Frustum;
  private followTarget = new THREE.Vector3();
  private cameraFollowPos = new THREE.Vector3();
  private cameraScratch = new THREE.Vector3();

  private lastTensionBucket = -1;

  constructor(init: HideSeekInitData) {
    this.init = init;
  }

  async mount(container: HTMLElement): Promise<void> {
    const { teams, targetTeam, seed, width, height, reducedMotion } = this.init;

    // The GLB models are cached at module scope after the first load, so a replayed mechanic
    // resolves this near-instantly. A model that fails to load just falls back to the
    // procedural rig for that team/seeker (see people/glbCharacters.ts) — never blocks the ride.
    const cache = await loadCharacterAssets();
    if (this.destroyed) return;

    this.renderer = createRenderer(width, height);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.scene.add(buildLights());

    const mazeSize = computeMazeSize({ teamCount: teams.length, designWidth: width, designHeight: height, reducedMotion });
    const grid = generateMaze(mazeSize.width, mazeSize.height, seed);
    buildMazeGroup(this.scene, grid);

    this.plan = buildHideSeekPlan({
      teamIds: teams.map((t) => t.id),
      targetTeamId: targetTeam.id,
      grid,
      entrance: ENTRANCE,
      seed,
      reducedMotion,
    });

    this.entranceWorld = cellToWorld(ENTRANCE[0], ENTRANCE[1]);
    this.stagingCenter = { x: this.entranceWorld.x + OUTWARD.x * 90, z: this.entranceWorld.z + OUTWARD.z * 90 };
    this.seekerRestPos = {
      x: this.stagingCenter.x + OUTWARD.x * SEEKER_OFFSET,
      z: this.stagingCenter.z + OUTWARD.z * SEEKER_OFFSET,
    };

    // Team characters: jittered around the entrance so a whole roster doesn't fully overlap —
    // deterministic (index-based, not seeded RNG) since it's purely cosmetic layout, not part
    // of the scripted plan. Each team gets one of the 7 non-seeker Kenney models, cycling by
    // index — the 8th model is reserved exclusively for the seeker (see glbCharacters.ts).
    const jitterScale = Math.max(1, Math.sqrt(teams.length / 6));
    teams.forEach((team, i) => {
      const angle = (i / Math.max(1, teams.length)) * Math.PI * 2 + Math.PI / 6;
      const radius = TEAM_JITTER_RADIUS * jitterScale * (0.7 + 0.5 * ((i % 3) / 2));
      this.teamJitter.set(team.id, { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });

      const modelFile = TEAM_MODEL_FILES[i % TEAM_MODEL_FILES.length];
      const rig = makeGlbTeamCharacter(cache, team, modelFile);
      this.scene.add(rig.root);
      this.teamRigs.set(team.id, rig);
      this.teamAnim.set(team.id, { phase: (i * 0.7) % (Math.PI * 2), amount: 0 });

      const scatterPlan = this.plan.scatter.find((s) => s.teamId === team.id)!;
      this.teamKeyframes.set(team.id, [{ cell: ENTRANCE, arriveSec: scatterPlan.departSec }, ...scatterPlan.steps]);
    });

    this.seekerRig = makeGlbSeekerCharacter(cache);
    this.scene.add(this.seekerRig.root);
    this.followTarget.set(this.seekerRestPos.x, 0, this.seekerRestPos.z);

    this.setupCameraFraming(width, height, grid, teams.length);
    placeIsoCamera(this.camera, this.wideTarget);
    applyFrustum(this.camera, this.wideFrustum);

    this.lastFrameMs = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private setupCameraFraming(width: number, height: number, grid: Grid, teamCount: number): void {
    const aspect = width / Math.max(1, height);
    const bounds = mazeWorldBounds(grid);
    const mazeCenter = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
    const mazeCorners = [
      { x: bounds.minX, z: bounds.minZ },
      { x: bounds.maxX, z: bounds.minZ },
      { x: bounds.minX, z: bounds.maxZ },
      { x: bounds.maxX, z: bounds.maxZ },
    ];

    this.mazeWideTarget.set(mazeCenter.x, 0, mazeCenter.z);
    this.mazeWideFrustum = fitFrustumToPoints(mazeCorners, mazeCenter, aspect, 60);

    // Matches the jitter spread in mount() (TEAM_JITTER_RADIUS * sqrt(teamCount/6) * up to
    // 1.2), plus headroom for the widest name chip, so the tight intro framing never clips a
    // roster larger than the 6-team baseline it was tuned against.
    const stagingHalfWidth = 140 * Math.max(1, Math.sqrt(teamCount / 6));
    const stagingPoints = [
      { x: this.stagingCenter.x - stagingHalfWidth, z: this.stagingCenter.z },
      { x: this.stagingCenter.x + stagingHalfWidth, z: this.stagingCenter.z },
      { x: this.seekerRestPos.x, z: this.seekerRestPos.z },
      { x: this.entranceWorld.x, z: this.entranceWorld.z },
    ];
    this.tightTarget.set(this.stagingCenter.x, 0, this.stagingCenter.z);
    this.tightFrustum = fitFrustumToPoints(stagingPoints, this.stagingCenter, aspect, 50);

    const wideCorners = [...mazeCorners, ...stagingPoints];
    const wideCenterX = (Math.min(...wideCorners.map((p) => p.x)) + Math.max(...wideCorners.map((p) => p.x))) / 2;
    const wideCenterZ = (Math.min(...wideCorners.map((p) => p.z)) + Math.max(...wideCorners.map((p) => p.z))) / 2;
    this.wideTarget.set(wideCenterX, 0, wideCenterZ);
    this.wideFrustum = fitFrustumToPoints(wideCorners, { x: wideCenterX, z: wideCenterZ }, aspect, 40);

    this.chaseFrustum = fitFrustumToPoints(
      [
        { x: CHASE_RADIUS, z: CHASE_RADIUS },
        { x: -CHASE_RADIUS, z: CHASE_RADIUS },
        { x: CHASE_RADIUS, z: -CHASE_RADIUS },
        { x: -CHASE_RADIUS, z: -CHASE_RADIUS },
      ],
      { x: 0, z: 0 },
      aspect,
      0
    );
  }

  private tick = (nowMs: number): void => {
    const dt = Math.min(0.1, Math.max(0, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;
    this.update(dt);
    if (this.renderer) this.renderer.render(this.scene, this.camera);
    if (!this.finished) this.rafId = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    const prev = this.elapsed;
    this.elapsed += dt;
    const t = this.elapsed;
    const pt = this.plan.phaseTimes;
    const { sound, onCaption } = this.init;

    if (prev < pt.introBeatEnd && t >= pt.introBeatEnd) {
      sound.playWhoosh(pt.introZoomEnd - pt.introBeatEnd);
    }
    if (prev < pt.scatterEnd && t >= pt.scatterEnd) {
      onCaption('Стас идет искать');
    }
    if (prev < pt.approachEnd && t >= pt.approachEnd) {
      onCaption(null);
      this.cameraFollowPos.copy(this.followTarget);
    }
    if (prev < pt.chaseEnd && t >= pt.chaseEnd) {
      sound.stopChaseTension();
      onCaption('Нашёл!');
      sound.playClunk();
      this.fanfareAt = t + FANFARE_DELAY_SEC;
      const chip = this.teamRigs.get(this.plan.targetTeamId)?.chip;
      if (chip) this.targetChipBaseScale = new THREE.Vector2(chip.scale.x, chip.scale.y);
    }
    if (this.fanfareAt !== null && t >= this.fanfareAt) {
      sound.playFanfare();
      this.fanfareAt = null;
    }

    this.updateTeams(prev, t, dt);
    this.updateSeeker(prev, t, dt);
    this.updateCamera(t, dt);

    if (prev < pt.revealEnd && t >= pt.revealEnd) {
      this.finish();
    }
  }

  private updateTeams(prev: number, t: number, dt: number): void {
    const revealStart = this.plan.phaseTimes.chaseEnd;
    for (const [teamId, rig] of this.teamRigs) {
      const keyframes = this.teamKeyframes.get(teamId)!;
      const jitter = this.teamJitter.get(teamId)!;
      const pos = interpolatePath(keyframes, t);
      rig.root.position.set(pos.x + jitter.x, 0, pos.z + jitter.z);
      if (t > keyframes[0].arriveSec) rig.root.rotation.y = pos.facing;
      updateCharacterAnim(rig, pos.moving, dt, this.teamAnim.get(teamId)!);
      if (crossedAKeyframe(keyframes, prev, t)) this.init.sound.playFootstep(1.15);
    }

    const targetChip = this.teamRigs.get(this.plan.targetTeamId)?.chip;
    if (targetChip && this.targetChipBaseScale && t >= revealStart) {
      const pulse = Math.max(0, 1 - (t - revealStart) / FOUND_PULSE_DURATION);
      const factor = 1 + 0.25 * pulse;
      targetChip.scale.set(this.targetChipBaseScale.x * factor, this.targetChipBaseScale.y * factor, 1);
    }
  }

  private updateSeeker(prev: number, t: number, dt: number): void {
    const pt = this.plan.phaseTimes;
    let x: number;
    let z: number;
    let facing = this.seekerRig.root.rotation.y;
    let moving: boolean;

    if (t <= pt.scatterEnd) {
      x = this.seekerRestPos.x;
      z = this.seekerRestPos.z;
      moving = false;
    } else if (t <= pt.approachEnd) {
      const segT = Math.min(1, (t - pt.scatterEnd) / Math.max(1e-6, pt.approachEnd - pt.scatterEnd));
      x = this.seekerRestPos.x + (this.entranceWorld.x - this.seekerRestPos.x) * segT;
      z = this.seekerRestPos.z + (this.entranceWorld.z - this.seekerRestPos.z) * segT;
      facing = Math.atan2(this.entranceWorld.x - this.seekerRestPos.x, this.entranceWorld.z - this.seekerRestPos.z);
      moving = true;
      if (prev < pt.approachEnd && t >= pt.approachEnd) this.init.sound.playFootstep(0.85);
    } else {
      const chaseKeyframes: Keyframe[] = this.plan.chasePath.map((s: ChaseStep) => ({ cell: s.cell, arriveSec: s.arriveSec }));
      const pos = interpolatePath(chaseKeyframes, t);
      x = pos.x;
      z = pos.z;
      facing = pos.facing;
      moving = pos.moving;
      if (crossedAKeyframe(chaseKeyframes, prev, t)) this.init.sound.playFootstep(0.85);

      // The target team's own rendered position is nudged off the bare cell center by a
      // jitter offset (see updateTeams/mount) — without this, the seeker would walk to the
      // cell's geometric center and visibly slide past the actual figure instead of stopping
      // right at it. Blend that same offset in only across the final approach segment, growing
      // 0→1 as the seeker arrives, so the two positions coincide exactly at chaseEnd — the
      // "found" moment becomes a real collision instead of a timed coincidence.
      const n = chaseKeyframes.length;
      if (n >= 2) {
        const finalPrev = chaseKeyframes[n - 2];
        const finalCur = chaseKeyframes[n - 1];
        const finalSegT =
          t <= finalPrev.arriveSec
            ? 0
            : Math.min(1, (t - finalPrev.arriveSec) / Math.max(1e-6, finalCur.arriveSec - finalPrev.arriveSec));
        if (finalSegT > 0) {
          const targetJitter = this.teamJitter.get(this.plan.targetTeamId) ?? { x: 0, z: 0 };
          x += targetJitter.x * finalSegT;
          z += targetJitter.z * finalSegT;
        }
      }

      // Cosmetic "looking around" wobble during a fakeout-flagged segment — purely a rotation
      // overlay, never changes the actual path/timing (the chase always ends at targetTeamId).
      const seg = this.currentChaseSegment(t);
      if (seg?.fakeoutPause) facing += Math.sin(t * 9) * FAKEOUT_WOBBLE_RAD;
    }

    this.seekerRig.root.position.set(x, 0, z);
    this.seekerRig.root.rotation.y = facing;
    this.followTarget.set(x, 0, z);
    updateCharacterAnim(this.seekerRig, moving, dt, this.seekerAnim);
  }

  private currentChaseSegment(t: number): ChaseStep | undefined {
    const path = this.plan.chasePath;
    for (let i = 0; i < path.length - 1; i++) {
      if (t >= path[i].arriveSec && t <= path[i + 1].arriveSec) return path[i];
    }
    return undefined;
  }

  private updateCamera(t: number, dt: number): void {
    const pt = this.plan.phaseTimes;
    const pullbackDur = Math.max(0.15, (pt.scatterEnd - pt.holdEnd) * PULLBACK_DURATION_FRACTION);
    const approachZoomStart = pt.approachEnd - Math.max(0.3, (pt.approachEnd - pt.scatterEnd) * APPROACH_ZOOM_FRACTION);

    let target: THREE.Vector3;
    let frustum: Frustum;

    if (t < pt.introBeatEnd) {
      target = this.wideTarget;
      frustum = this.wideFrustum;
    } else if (t < pt.introZoomEnd) {
      const s = (t - pt.introBeatEnd) / Math.max(1e-6, pt.introZoomEnd - pt.introBeatEnd);
      target = this.cameraScratch.copy(this.wideTarget).lerp(this.tightTarget, s);
      frustum = lerpFrustum(this.wideFrustum, this.tightFrustum, s);
    } else if (t < pt.holdEnd) {
      target = this.tightTarget;
      frustum = this.tightFrustum;
    } else if (t < pt.holdEnd + pullbackDur) {
      const s = (t - pt.holdEnd) / pullbackDur;
      target = this.cameraScratch.copy(this.tightTarget).lerp(this.mazeWideTarget, s);
      frustum = lerpFrustum(this.tightFrustum, this.mazeWideFrustum, s);
    } else if (t < approachZoomStart) {
      target = this.mazeWideTarget;
      frustum = this.mazeWideFrustum;
    } else if (t < pt.approachEnd) {
      const s = (t - approachZoomStart) / Math.max(1e-6, pt.approachEnd - approachZoomStart);
      target = this.cameraScratch.copy(this.mazeWideTarget).lerp(this.followTarget, s);
      frustum = lerpFrustum(this.mazeWideFrustum, this.chaseFrustum, s);
    } else {
      lerpToward(this.cameraFollowPos, this.followTarget, dt);
      target = this.cameraFollowPos;
      frustum = this.chaseFrustum;
      this.setChaseTensionByProgress(this.chaseProgress(t));
    }

    placeIsoCamera(this.camera, target);
    applyFrustum(this.camera, frustum);
  }

  private chaseProgress(t: number): number {
    const pt = this.plan.phaseTimes;
    if (t <= pt.approachEnd) return 0;
    if (t >= pt.chaseEnd) return 1;
    return (t - pt.approachEnd) / Math.max(1e-6, pt.chaseEnd - pt.approachEnd);
  }

  private setChaseTensionByProgress(progress: number): void {
    const bucket = Math.round(progress * 40);
    if (bucket === this.lastTensionBucket) return;
    this.lastTensionBucket = bucket;
    this.init.sound.setChaseTension(progress);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.init.sound.stopChaseTension();
    this.init.onFinish(this.init.targetTeam);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.init.sound.stopChaseTension();
    disposeObject3D(this.scene);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
  }
}
