/**
 * Character rigs — two kinds, sharing one `CharacterRig` shape so HideSeekScene can drive
 * either uniformly. The primary path (./glbCharacters.ts) loads Kenney "Mini Characters" GLB
 * models with their own Idle/Walk clips via THREE.AnimationMixer, matching the isometric-maze
 * prototype's `loadCharacter`. This module holds the FALLBACK used when a GLB fails to load
 * (offline, blocked request, corrupt file): the prototype's own asset-free
 * `makePlaceholderCharacter` idea, ported and extended with hand-animated swinging arm/leg
 * pivots (`applyWalkPose`) so it still reads as "walking" without an imported skeleton. Team
 * identity comes from `team.color` tinting the fallback body and from the shared name chip
 * (./badgeChip.ts) — the GLB path also uses the chip, since its models aren't tintable.
 */
import * as THREE from 'three';
import { makeNameChipSprite } from './badgeChip';

export interface CharacterRig {
  root: THREE.Group;
  chip?: THREE.Sprite;

  // Procedural fallback only.
  bodyPivot?: THREE.Group;
  bodyMaterial?: THREE.MeshLambertMaterial;
  legL?: THREE.Group;
  legR?: THREE.Group;
  armL?: THREE.Group;
  armR?: THREE.Group;

  // GLB path only.
  mixer?: THREE.AnimationMixer;
  idleAction?: THREE.AnimationAction | null;
  walkAction?: THREE.AnimationAction | null;
  currentAction?: THREE.AnimationAction | null;
}

export interface AnimState {
  phase: number;
  amount: number;
}

const LEG_SWING_AMPLITUDE = 0.6;
const ARM_SWING_AMPLITUDE = 0.5;
const BOB_AMPLITUDE = 4;
const WALK_PHASE_SPEED = 9;
const WALK_EASE_RATE = 8;
const ACTION_CROSSFADE_SEC = 0.15;

function makeLimb(radius: number, length: number, material: THREE.Material, anchor: { x: number; y: number }): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(anchor.x, anchor.y, 0);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 6), material);
  mesh.position.y = -(length / 2 + radius);
  pivot.add(mesh);
  return pivot;
}

function buildRig(bodyMaterial: THREE.MeshLambertMaterial, bodyRadius: number, bodyLength: number, headRadius: number): {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  headTopY: number;
} {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const bodyCenterY = bodyRadius + bodyLength / 2;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(bodyRadius, bodyLength, 4, 8), bodyMaterial);
  body.position.y = bodyCenterY;
  bodyPivot.add(body);

  const headY = bodyCenterY + bodyLength / 2 + bodyRadius + headRadius * 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 16, 12), bodyMaterial);
  head.position.y = headY;
  bodyPivot.add(head);

  const shoulderY = bodyCenterY + bodyLength / 2 - 4;
  const hipY = bodyCenterY - bodyLength / 2;
  const armRadius = bodyRadius * 0.32;
  const armLength = bodyLength * 0.72;
  const legRadius = bodyRadius * 0.38;
  const legLength = Math.max(1, hipY - legRadius);

  const armL = makeLimb(armRadius, armLength, bodyMaterial, { x: -(bodyRadius + armRadius * 0.5), y: shoulderY });
  const armR = makeLimb(armRadius, armLength, bodyMaterial, { x: bodyRadius + armRadius * 0.5, y: shoulderY });
  const legL = makeLimb(legRadius, legLength, bodyMaterial, { x: -bodyRadius * 0.45, y: hipY });
  const legR = makeLimb(legRadius, legLength, bodyMaterial, { x: bodyRadius * 0.45, y: hipY });
  bodyPivot.add(armL, armR, legL, legR);

  return { root, bodyPivot, legL, legR, armL, armR, headTopY: headY + headRadius };
}

export function makeTeamCharacter(team: { name: string; color: string }): CharacterRig {
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(team.color) });
  const { root, bodyPivot, legL, legR, armL, armR, headTopY } = buildRig(bodyMaterial, 18, 34, 15);

  const chip = makeNameChipSprite(team);
  chip.position.set(0, headTopY + 22, 0);
  root.add(chip);

  return { root, bodyPivot, bodyMaterial, legL, legR, armL, armR, chip };
}

const SEEKER_BODY_COLOR = 0x15151a;
const SEEKER_HAT_COLOR = 0x7f1d1d;

export function makeSeekerCharacter(): CharacterRig {
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: SEEKER_BODY_COLOR });
  const { root, bodyPivot, legL, legR, armL, armR, headTopY } = buildRig(bodyMaterial, 19, 38, 16);

  const hatMaterial = new THREE.MeshLambertMaterial({ color: SEEKER_HAT_COLOR });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 3, 20), hatMaterial);
  brim.position.y = headTopY - 6;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 16, 16), hatMaterial);
  crown.position.y = headTopY + 4;
  bodyPivot.add(brim, crown);

  return { root, bodyPivot, bodyMaterial, legL, legR, armL, armR };
}

function applyWalkPose(rig: CharacterRig, phase: number, amount: number): void {
  if (!rig.bodyPivot || !rig.legL || !rig.legR || !rig.armL || !rig.armR) return;
  const swing = Math.sin(phase) * amount;
  rig.legL.rotation.x = swing * LEG_SWING_AMPLITUDE;
  rig.legR.rotation.x = -swing * LEG_SWING_AMPLITUDE;
  rig.armR.rotation.x = swing * ARM_SWING_AMPLITUDE;
  rig.armL.rotation.x = -swing * ARM_SWING_AMPLITUDE;
  rig.bodyPivot.position.y = Math.abs(Math.sin(phase)) * BOB_AMPLITUDE * amount;
}

/** Single per-frame animation entry point for both rig kinds: crossfades the GLB's Idle/Walk
 *  clips when `rig.mixer` is present, otherwise drives the hand-animated fallback pose. */
export function updateCharacterAnim(rig: CharacterRig, moving: boolean, dt: number, state: AnimState): void {
  if (rig.mixer) {
    const target = moving ? rig.walkAction : rig.idleAction;
    if (target && rig.currentAction !== target) {
      rig.currentAction?.fadeOut(ACTION_CROSSFADE_SEC);
      target.reset().fadeIn(ACTION_CROSSFADE_SEC).play();
      rig.currentAction = target;
    }
    rig.mixer.update(dt);
    return;
  }

  state.amount += ((moving ? 1 : 0) - state.amount) * Math.min(1, WALK_EASE_RATE * dt);
  if (moving) state.phase += WALK_PHASE_SPEED * dt;
  applyWalkPose(rig, state.phase, state.amount);
}
