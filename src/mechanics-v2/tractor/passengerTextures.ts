import type * as Phaser from 'phaser';
import { drawTintableBlob, drawTintablePanel, ensureTexture } from './shading';

/**
 * Procedural passenger parts — one shared, colorless texture per part (not per-team, not
 * per-seed): each passenger sprite is recolored at runtime via `setTint(teamColor)`. Head,
 * body and arm are separate sprites so the arms can flail independently of the torso.
 */

export function buildPersonHeadTexture(scene: Phaser.Scene, size: number): string {
  return ensureTexture(scene, `person-head-${Math.round(size)}`, size, size, (g) => {
    drawTintableBlob(g, size / 2, size / 2, size * 0.46);
  });
}

export function buildPersonBodyTexture(scene: Phaser.Scene, w: number, h: number): string {
  return ensureTexture(scene, `person-body-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    drawTintablePanel(g, 0, 0, w, h, w * 0.32);
  });
}

export function buildPersonArmTexture(scene: Phaser.Scene, w: number, h: number): string {
  return ensureTexture(scene, `person-arm-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    drawTintablePanel(g, 0, 0, w, h, w * 0.45);
  });
}
