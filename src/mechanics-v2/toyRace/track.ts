import * as Phaser from 'phaser';
import { makeRng } from '../engine/canvasUtils';

/**
 * The race lives on a flat 2D "world" plane (plain top-down coordinates) — movement,
 * randomness and lane offsets are all computed here with ordinary 2D math. Isometric
 * projection is purely a rendering concern, applied on top via `isoProject`.
 *
 * The track is a closed loop (start and finish are the same point) so it reads as a real
 * circuit rather than a one-way lane, generated as a radially-perturbed ellipse — long,
 * rounded, with a few turns, and guaranteed not to self-intersect (radius stays positive
 * for every angle).
 */
function generateLoopPoints(): Array<[number, number]> {
  const segments = 18;
  const rx = 8.8;
  const ry = 5.3;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const wobble = 1 + 0.24 * Math.sin(3 * theta + 0.5) + 0.1 * Math.sin(5 * theta - 1.1);
    points.push([rx * wobble * Math.cos(theta), ry * wobble * Math.sin(theta)]);
  }
  return points;
}

export const TRACK_WORLD_POINTS: Array<[number, number]> = generateLoopPoints();

export const TRACK_HALF_WIDTH = 1.7;

export function buildTrackPath(): Phaser.Curves.Path {
  const points = TRACK_WORLD_POINTS.map(([x, y]) => new Phaser.Math.Vector2(x, y));
  const path = new Phaser.Curves.Path();
  path.add(new Phaser.Curves.Spline(points));
  return path;
}

const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = Math.sin(Math.PI / 6);

/** Classic 2:1 dimetric ("isometric") ground-plane projection. */
export function isoProject(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * ISO_COS, y: (x + y) * ISO_SIN };
}

export function normalAt(path: Phaser.Curves.Path, t: number): Phaser.Math.Vector2 {
  const tangent = path.getTangent(t);
  return new Phaser.Math.Vector2(-tangent.y, tangent.x).normalize();
}

/** Depth key so sprites nearer the camera (higher world x+y) draw on top — standard iso sort. */
export function isoDepth(x: number, y: number): number {
  return x + y;
}

export interface Decoration {
  x: number;
  y: number;
  kind: 'tree' | 'tree-pine' | 'item-cone';
  scale: number;
}

const DECOR_SEED = 918273;

/** Stable (not per-race) scenery scattered just outside the track edge. */
export function buildDecorations(path: Phaser.Curves.Path): Decoration[] {
  const rng = makeRng(DECOR_SEED);
  const decorations: Decoration[] = [];
  const count = 50;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    // Keep the area right at the start/finish gate clear.
    if (Math.min(t, 1 - t) < 0.02) continue;
    const side = i % 2 === 0 ? 1 : -1;
    const gap = 0.5 + rng() * 1.1;
    const p = path.getPoint(t);
    const n = normalAt(path, t);
    const wx = p.x + n.x * (TRACK_HALF_WIDTH + gap) * side;
    const wy = p.y + n.y * (TRACK_HALF_WIDTH + gap) * side;
    const roll = rng();
    const kind: Decoration['kind'] = roll < 0.16 ? 'item-cone' : roll < 0.56 ? 'tree' : 'tree-pine';
    decorations.push({ x: wx, y: wy, kind, scale: 0.8 + rng() * 0.55 });
  }
  return decorations;
}

export interface Projection {
  toScreen: (worldX: number, worldY: number) => { x: number; y: number };
  scale: number;
}

/**
 * Fits the projected track (including its width and any extra world points, e.g.
 * decorations) into the given canvas box, centered with padding, and returns a
 * world->screen transform.
 */
export function fitProjection(
  path: Phaser.Curves.Path,
  canvasWidth: number,
  canvasHeight: number,
  extraWorldPoints: Array<{ x: number; y: number }> = [],
  paddingRatio = 0.1
): Projection {
  const samples = 90;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const include = (wx: number, wy: number) => {
    const s = isoProject(wx, wy);
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
  };

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = path.getPoint(t);
    const n = normalAt(path, t);
    include(p.x + n.x * TRACK_HALF_WIDTH, p.y + n.y * TRACK_HALF_WIDTH);
    include(p.x - n.x * TRACK_HALF_WIDTH, p.y - n.y * TRACK_HALF_WIDTH);
  }
  for (const pt of extraWorldPoints) include(pt.x, pt.y);

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const availW = canvasWidth * (1 - paddingRatio * 2);
  const availH = canvasHeight * (1 - paddingRatio * 2);
  const scale = Math.min(availW / contentW, availH / contentH);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const originX = canvasWidth / 2 - centerX * scale;
  const originY = canvasHeight / 2 - centerY * scale;

  return {
    scale,
    toScreen: (worldX: number, worldY: number) => {
      const s = isoProject(worldX, worldY);
      return { x: originX + s.x * scale, y: originY + s.y * scale };
    },
  };
}
