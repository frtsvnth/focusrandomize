import type * as Phaser from 'phaser';

/**
 * Shared "flat cartoon" texture-drawing helpers: a shadow blob/panel offset down-right (base
 * color darkened ~20%), the base fill, a highlight top-left (lightened), then a dark stroked
 * outline (~2-3% of the shape's size) — the recipe used for every rounded shape across the
 * environment and vehicle textures, and later the team characters.
 */

export function darken(color: number, t: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return (Math.round(r * (1 - t)) << 16) | (Math.round(g * (1 - t)) << 8) | Math.round(b * (1 - t));
}

export function lighten(color: number, t: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return (Math.round(r + (255 - r) * t) << 16) | (Math.round(g + (255 - g) * t) << 8) | Math.round(b + (255 - b) * t);
}

export function drawRoundBlob(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, fill: number) {
  const outline = darken(fill, 0.55);
  const shadow = darken(fill, 0.22);
  const highlight = lighten(fill, 0.4);
  const outlineW = Math.max(1.5, r * 0.05);

  g.fillStyle(shadow, 1);
  g.fillCircle(cx + r * 0.14, cy + r * 0.18, r);
  g.fillStyle(fill, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(highlight, 0.55);
  g.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.4);
  g.lineStyle(outlineW, outline, 1);
  g.strokeCircle(cx, cy, r);
}

/** Same recipe as `drawRoundBlob`, for a rounded rectangular panel (body/cab/board shapes). */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: number
) {
  const outline = darken(fill, 0.55);
  const shadow = darken(fill, 0.22);
  const highlight = lighten(fill, 0.4);
  const outlineW = Math.max(1.5, Math.min(w, h) * 0.05);
  const off = Math.min(w, h) * 0.07;

  g.fillStyle(shadow, 1);
  g.fillRoundedRect(x + off, y + off, w, h, radius);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(highlight, 0.45);
  g.fillRoundedRect(x + w * 0.08, y + h * 0.1, w * 0.42, h * 0.32, radius * 0.6);
  g.lineStyle(outlineW, outline, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
}

// Near-white base / near-black outline so a Phaser `setTint(teamColor)` (a per-pixel
// multiply) turns the base fill into an exact team color while the outline — black times
// anything is still black — stays a crisp dark line regardless of which team it becomes.
const TINT_BASE = 0xffffff;
const TINT_SHADOW = 0xc9c9c9;
const TINT_OUTLINE = 0x14181f;

/** `drawRoundBlob`, but colorless — meant to be recolored per-team via sprite tinting. */
export function drawTintableBlob(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) {
  const outlineW = Math.max(1.5, r * 0.05);
  g.fillStyle(TINT_SHADOW, 1);
  g.fillCircle(cx + r * 0.14, cy + r * 0.18, r);
  g.fillStyle(TINT_BASE, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.4);
  g.lineStyle(outlineW, TINT_OUTLINE, 1);
  g.strokeCircle(cx, cy, r);
}

/** `drawPanel`, but colorless — meant to be recolored per-team via sprite tinting. */
export function drawTintablePanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const outlineW = Math.max(1.5, Math.min(w, h) * 0.05);
  const off = Math.min(w, h) * 0.07;
  g.fillStyle(TINT_SHADOW, 1);
  g.fillRoundedRect(x + off, y + off, w, h, radius);
  g.fillStyle(TINT_BASE, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(0xffffff, 0.4);
  g.fillRoundedRect(x + w * 0.08, y + h * 0.1, w * 0.42, h * 0.32, radius * 0.6);
  g.lineStyle(outlineW, TINT_OUTLINE, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
}

/**
 * A stacked-triangle fir tree — three tapering tiers plus a trunk, each tier a flat-shaded
 * triangle (not the shadow/highlight/outline blob recipe, since a tree silhouette reads better
 * as clean flat shapes). `baseY` is where the trunk meets the ground; the tree extends upward
 * from there. Used to break up otherwise-ambiguous background shapes (hills, foreground) into
 * something immediately recognizable.
 */
export function drawFirTree(
  g: Phaser.GameObjects.Graphics,
  x: number,
  baseY: number,
  size: number,
  foliage: number
) {
  const trunk = darken(foliage, 0.65);
  const outline = darken(foliage, 0.5);

  g.fillStyle(trunk, 1);
  g.fillRect(x - size * 0.06, baseY - size * 0.14, size * 0.12, size * 0.16);

  const tiers = [
    { apex: size * 0.62, base: size * 0.14, halfW: size * 0.32, shade: darken(foliage, 0.12) },
    { apex: size * 0.82, base: size * 0.34, halfW: size * 0.24, shade: foliage },
    { apex: size, base: size * 0.5, halfW: size * 0.15, shade: lighten(foliage, 0.15) },
  ];
  for (const t of tiers) {
    g.fillStyle(t.shade, 1);
    g.beginPath();
    g.moveTo(x, baseY - t.apex);
    g.lineTo(x + t.halfW, baseY - t.base);
    g.lineTo(x - t.halfW, baseY - t.base);
    g.closePath();
    g.fillPath();
  }
  g.lineStyle(Math.max(1, size * 0.02), outline, 0.7);
  g.beginPath();
  g.moveTo(x, baseY - tiers[2].apex);
  g.lineTo(x + tiers[0].halfW, baseY - tiers[0].base);
  g.lineTo(x - tiers[0].halfW, baseY - tiers[0].base);
  g.closePath();
  g.strokePath();
}

export function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void
): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
  return key;
}
