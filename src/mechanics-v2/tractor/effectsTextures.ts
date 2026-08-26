import type * as Phaser from 'phaser';
import type { ScenePalette } from './palette';
import { darken, lighten, ensureTexture } from './shading';

/** Procedural particle textures — plain circles/squares via Graphics -> generateTexture,
 * colored from the active theme palette, then reused across many emitters. */

export function buildDustTexture(scene: Phaser.Scene, palette: ScenePalette, radius: number): string {
  return ensureTexture(scene, `tractor-dust-${Math.round(radius)}`, radius * 2, radius * 2, (g) => {
    g.fillStyle(palette.ground, 0.55);
    g.fillCircle(radius, radius, radius);
    g.fillStyle(lighten(palette.ground, 0.3), 0.7);
    g.fillCircle(radius, radius, radius * 0.6);
  });
}

export function buildStarTexture(scene: Phaser.Scene, palette: ScenePalette, size: number): string {
  return ensureTexture(scene, `tractor-star-${Math.round(size)}`, size, size, (g) => {
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.46;
    const innerR = outerR * 0.45;
    const outline = darken(palette.sun, 0.5);

    g.fillStyle(palette.sun, 1);
    g.lineStyle(Math.max(1, size * 0.08), outline, 1);
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / 5;
      const ox = cx + Math.cos(outerAngle) * outerR;
      const oy = cy + Math.sin(outerAngle) * outerR;
      const ix = cx + Math.cos(innerAngle) * innerR;
      const iy = cy + Math.sin(innerAngle) * innerR;
      if (i === 0) g.moveTo(ox, oy);
      else g.lineTo(ox, oy);
      g.lineTo(ix, iy);
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
  });
}

/** Soft gray puff for engine exhaust — lighter and more diffuse than the ground-colored dust. */
export function buildSmokeTexture(scene: Phaser.Scene, palette: ScenePalette, radius: number): string {
  return ensureTexture(scene, `tractor-smoke-${Math.round(radius)}`, radius * 2, radius * 2, (g) => {
    const smoke = lighten(palette.exhaustMetal, 0.35);
    g.fillStyle(smoke, 0.5);
    g.fillCircle(radius, radius, radius);
    g.fillStyle(lighten(smoke, 0.3), 0.6);
    g.fillCircle(radius, radius, radius * 0.55);
  });
}

/** A small chunky dirt clod, kicked up when a mega-hump hits hard. */
export function buildClodTexture(scene: Phaser.Scene, palette: ScenePalette, size: number): string {
  return ensureTexture(scene, `tractor-clod-${Math.round(size)}`, size, size, (g) => {
    g.fillStyle(darken(palette.ground, 0.15), 1);
    g.fillRoundedRect(0, 0, size, size, size * 0.25);
    g.fillStyle(palette.ground, 1);
    g.fillRoundedRect(size * 0.12, size * 0.12, size * 0.6, size * 0.6, size * 0.2);
  });
}

/** A wisp of straw, for the hay bouncing loose in the trailer bed. */
export function buildHayTexture(scene: Phaser.Scene, palette: ScenePalette, w: number, h: number): string {
  return ensureTexture(scene, `tractor-hay-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    g.fillStyle(lighten(palette.sun, 0.15), 1);
    g.fillRoundedRect(0, 0, w, h, h * 0.4);
  });
}

/** Plain white square — tinted per-particle via the emitter's own `tint` color array. */
export function buildConfettiTexture(scene: Phaser.Scene, size: number): string {
  return ensureTexture(scene, `tractor-confetti-${Math.round(size)}`, size, size, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, size, size);
  });
}
