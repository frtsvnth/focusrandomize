/**
 * Isometric orthographic camera rig — ported from the isometric-maze prototype's scene.js
 * (createCamera/setIsoOrientation) and main.js (updateCamera's exponential lerp-follow,
 * fitCameraToMaze/applyZoom's frustum math), reworked into pure helpers so HideSeekScene can
 * drive the camera by a scripted timeline instead of live keyboard/mouse input.
 *
 * The prototype's `fitCameraToMaze` iteratively re-scaled an *already-set* frustum by
 * re-projecting world corners through the current camera matrices. Since this camera's
 * orientation is fixed (elevation never changes, only its target/position translate), the
 * required half-width/half-height for a given target and set of world points can instead be
 * computed directly and non-iteratively via the camera's constant right/up basis vectors —
 * see `computeIsoBasis`. That makes fitting a pure function of (points, target, aspect),
 * which is what lets the intro zoom (§ HideSeekScene) tween cleanly between two frustums.
 */
import * as THREE from 'three';

export const ISO_ELEVATION = Math.atan(1 / Math.sqrt(2)); // ~35.264°
export const ISO_DIST = 2000;
export const CAMERA_LERP = 5.0;

/** Fixed world-space direction from a target to the camera (elevation baked in, azimuth 0). */
const ISO_DIR = new THREE.Vector3(-Math.cos(ISO_ELEVATION), Math.sin(ISO_ELEVATION), 0);

/** The camera's constant right/up basis vectors — independent of target/position because the
 *  orientation (lookAt direction + up hint) never changes, only where the whole rig sits. */
function computeIsoBasis(): { right: THREE.Vector3; up: THREE.Vector3 } {
  const zAxis = ISO_DIR.clone().normalize(); // eye - target, target is the origin here
  const upHint = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(upHint, zAxis).normalize();
  const up = new THREE.Vector3().crossVectors(zAxis, right).normalize();
  return { right, up };
}

const ISO_BASIS = computeIsoBasis();

export function createRenderer(width: number, height: number): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

export function createIsoCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  camera.up.set(0, 1, 0);
  return camera;
}

/** Positions the camera at ISO_DIST from `target`, looking at it, without touching its
 *  frustum (left/right/top/bottom) — call `applyFrustum` separately for that. */
export function placeIsoCamera(camera: THREE.OrthographicCamera, target: THREE.Vector3): void {
  const position = target.clone().addScaledVector(ISO_DIR, ISO_DIST);
  camera.position.copy(position);
  camera.lookAt(target);
}

export interface Frustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function applyFrustum(camera: THREE.OrthographicCamera, f: Frustum): void {
  camera.left = f.left;
  camera.right = f.right;
  camera.top = f.top;
  camera.bottom = f.bottom;
  camera.updateProjectionMatrix();
}

export function lerpFrustum(a: Frustum, b: Frustum, t: number): Frustum {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return { left: lerp(a.left, b.left), right: lerp(a.right, b.right), top: lerp(a.top, b.top), bottom: lerp(a.bottom, b.bottom) };
}

/** Half-width/half-height (around `target`) needed to fit every world-space (x,z) point,
 *  padded and fitted to the canvas aspect ratio ("contain" fit — never crops). */
export function fitFrustumToPoints(
  points: Array<{ x: number; z: number }>,
  target: { x: number; z: number },
  aspect: number,
  paddingWorld = 0
): Frustum {
  let halfW = 0;
  let halfH = 0;
  const p = new THREE.Vector3();
  for (const pt of points) {
    p.set(pt.x - target.x, 0, pt.z - target.z);
    halfW = Math.max(halfW, Math.abs(p.dot(ISO_BASIS.right)));
    halfH = Math.max(halfH, Math.abs(p.dot(ISO_BASIS.up)));
  }
  halfW += paddingWorld;
  halfH += paddingWorld;

  // Contain-fit into the canvas aspect ratio.
  if (halfW / Math.max(halfH, 1e-6) < aspect) {
    halfW = halfH * aspect;
  } else {
    halfH = halfW / Math.max(aspect, 1e-6);
  }

  return { left: -halfW, right: halfW, top: halfH, bottom: -halfH };
}

/** Exponential lerp-follow (matches the prototype's `updateCamera`'s `1-exp(-LERP*dt)` step). */
export function lerpToward(current: THREE.Vector3, target: THREE.Vector3, dt: number, lerpSpeed = CAMERA_LERP): THREE.Vector3 {
  const k = 1 - Math.exp(-lerpSpeed * dt);
  current.lerp(target, k);
  return current;
}
