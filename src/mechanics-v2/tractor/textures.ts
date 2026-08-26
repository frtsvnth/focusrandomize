import type * as Phaser from 'phaser';
import type { ScenePalette } from './palette';
import { makeRng } from '../engine/canvasUtils';
import { darken, lighten, drawRoundBlob, drawFirTree, ensureTexture } from './shading';

/**
 * Procedural environment textures (Graphics -> generateTexture, no PNG assets). Built from
 * the runtime Phaser namespace passed in by the scene, never a static Phaser import — see
 * TractorScene.ts for why. Every texture is a seamlessly-tiling band: the same width so a
 * TileSprite can scroll it at its own parallax speed. Shading recipe lives in shading.ts,
 * shared with vehicleTextures.ts.
 */

export const TILE_WIDTH = 900;

export function buildSkyElementsTexture(
  scene: Phaser.Scene,
  palette: ScenePalette,
  height: number,
  seed: number
): string {
  return ensureTexture(scene, `tractor-sky-${seed}-${Math.round(height)}`, TILE_WIDTH, height, (g) => {
    const rng = makeRng(seed);
    // Sun: soft layered glow rings (cheap radial-glow fake) + a flat-cartoon disc.
    const sunX = TILE_WIDTH * 0.24;
    const sunY = height * 0.32;
    const sunR = height * 0.14;
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(palette.sun, 0.05 * i);
      g.fillCircle(sunX, sunY, sunR * (1 + i * 0.35));
    }
    drawRoundBlob(g, sunX, sunY, sunR, palette.sun);

    // A couple of puffy clouds, each a small cluster of blobs, kept clear of tile edges.
    const cloudSpots = [
      { x: TILE_WIDTH * 0.58, y: height * 0.22, r: height * 0.07 },
      { x: TILE_WIDTH * 0.83, y: height * 0.4, r: height * 0.055 },
    ];
    for (const spot of cloudSpots) {
      const puffs = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < puffs; i++) {
        const angle = (i / puffs) * Math.PI - Math.PI / 2;
        const dx = Math.cos(angle) * spot.r * 0.9;
        const dy = Math.sin(angle) * spot.r * 0.4;
        drawRoundBlob(g, spot.x + dx, spot.y + dy, spot.r * (0.65 + rng() * 0.35), palette.cloud);
      }
      drawRoundBlob(g, spot.x, spot.y, spot.r, palette.cloud);
    }
  });
}

export function buildHillsTexture(scene: Phaser.Scene, palette: ScenePalette, height: number, seed: number): string {
  return ensureTexture(scene, `tractor-hills-${seed}-${Math.round(height)}`, TILE_WIDTH, height, (g) => {
    const rng = makeRng(seed + 1);
    const horizonY = height * 0.55;
    const outline = darken(palette.hills, 0.5);

    // Base band so every tile edge lines up flush (flat baseline = trivially seamless).
    g.fillStyle(palette.hillsShadow, 1);
    g.fillRect(0, horizonY, TILE_WIDTH, height - horizonY);

    // A couple of rounded ridges, kept away from the left/right seam.
    const bumps = [
      { x: TILE_WIDTH * 0.28, w: TILE_WIDTH * (0.38 + rng() * 0.08), h: height * (0.14 + rng() * 0.04) },
      { x: TILE_WIDTH * 0.68, w: TILE_WIDTH * (0.32 + rng() * 0.08), h: height * (0.09 + rng() * 0.04) },
    ];
    for (const b of bumps) {
      g.fillStyle(darken(palette.hills, 0.18), 1);
      g.fillEllipse(b.x + b.w * 0.08, horizonY + b.h * 0.1, b.w, b.h * 2);
      g.fillStyle(palette.hills, 1);
      g.fillEllipse(b.x, horizonY, b.w, b.h * 2);
      g.fillStyle(lighten(palette.hills, 0.3), 0.5);
      g.fillEllipse(b.x - b.w * 0.22, horizonY - b.h * 0.35, b.w * 0.5, b.h * 0.9);
      g.lineStyle(Math.max(2, height * 0.006), outline, 1);
      g.strokeEllipse(b.x, horizonY, b.w, b.h * 2);

      // A little treeline along the ridge — without it the bare ellipse reads as an
      // ambiguous blob rather than a hill (this is exactly what it was doing before).
      const treeColor = darken(palette.hills, 0.35);
      const treeCount = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < treeCount; i++) {
        const dxFrac = (rng() - 0.5) * 0.7;
        const dx = dxFrac * b.w * 0.5;
        const ridgeY = horizonY - b.h * Math.sqrt(Math.max(0, 1 - (dx / (b.w * 0.5)) ** 2));
        const treeSize = height * (0.08 + rng() * 0.045);
        drawFirTree(g, b.x + dx, ridgeY + treeSize * 0.14, treeSize, treeColor);
      }
    }
  });
}

export function buildFieldTexture(scene: Phaser.Scene, palette: ScenePalette, height: number, seed: number): string {
  return ensureTexture(scene, `tractor-field-${seed}-${Math.round(height)}`, TILE_WIDTH, height, (g) => {
    const rng = makeRng(seed + 2);
    const horizonY = height * 0.68;
    g.fillStyle(palette.field, 1);
    g.fillRect(0, horizonY, TILE_WIDTH, height - horizonY);
    g.lineStyle(Math.max(2, height * 0.01), darken(palette.field, 0.3), 0.7);
    g.beginPath();
    g.moveTo(0, horizonY);
    g.lineTo(TILE_WIDTH, horizonY);
    g.strokePath();

    // Mowing-line streaks: full-width horizontal bands tile perfectly regardless of x offset.
    const lines = 5;
    for (let i = 0; i < lines; i++) {
      const y = horizonY + (height - horizonY) * (0.15 + (i / lines) * 0.8) + (rng() - 0.5) * 6;
      g.fillStyle(i % 2 === 0 ? lighten(palette.field, 0.12) : palette.fieldShadow, 0.35);
      g.fillRect(0, y, TILE_WIDTH, Math.max(2, height * 0.012));
    }
  });
}

export function buildForegroundTexture(
  scene: Phaser.Scene,
  palette: ScenePalette,
  height: number,
  seed: number
): string {
  return ensureTexture(scene, `tractor-fg-${seed}-${Math.round(height)}`, TILE_WIDTH, height, (g) => {
    const rng = makeRng(seed + 3);
    const horizonY = height * 0.86;
    g.fillStyle(palette.foregroundGrass, 1);
    g.fillRect(0, horizonY, TILE_WIDTH, height - horizonY);

    // Grass tufts, clear of both edges.
    const tuftXs = [TILE_WIDTH * 0.12, TILE_WIDTH * 0.28, TILE_WIDTH * 0.72, TILE_WIDTH * 0.88];
    for (const tx of tuftXs) {
      const blades = 3;
      for (let i = 0; i < blades; i++) {
        const r = height * (0.045 + rng() * 0.02);
        drawRoundBlob(g, tx + (i - 1) * r * 0.8, horizonY - r * 0.3, r, palette.foregroundGrass);
      }
    }

    // A couple of bigger bush clumps — a tighter cluster of larger blobs than the grass
    // tufts, so the foreground doesn't read as flat grass alone.
    const bushColor = darken(palette.foregroundGrass, 0.15);
    const bushXs = [TILE_WIDTH * 0.2, TILE_WIDTH * 0.8];
    for (const bx of bushXs) {
      const r = height * (0.08 + rng() * 0.02);
      drawRoundBlob(g, bx, horizonY - r * 0.5, r, bushColor);
      drawRoundBlob(g, bx - r * 0.75, horizonY - r * 0.25, r * 0.72, bushColor);
      drawRoundBlob(g, bx + r * 0.75, horizonY - r * 0.25, r * 0.72, bushColor);
    }
  });
}
