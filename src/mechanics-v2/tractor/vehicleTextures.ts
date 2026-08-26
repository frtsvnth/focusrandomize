import type * as Phaser from 'phaser';
import type { ScenePalette } from './palette';
import { darken, lighten, drawRoundBlob, drawPanel, ensureTexture } from './shading';

/**
 * Procedural tractor + trailer textures (Graphics -> generateTexture, no PNG assets).
 * Local convention: +x within every texture is "forward" (direction of travel), matching
 * world space, so the right edge of a texture is its front. Sizes are passed in by the
 * scene, which owns all placement/kinematics math — these functions only draw.
 */

export function buildTractorBodyTexture(
  scene: Phaser.Scene,
  palette: ScenePalette,
  w: number,
  h: number,
  seed: number
): string {
  return ensureTexture(scene, `tractor-body-${seed}-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    // Fender arch over where the (separately-sprited) rear wheel sits.
    drawPanelShape(g, () => {
      g.fillEllipse(0.24 * w, 0.76 * h, 0.34 * w, 0.38 * h);
    }, palette.vehicleTrim);

    // Rear chassis block.
    drawPanel(g, 0.06 * w, 0.34 * h, 0.54 * w, 0.44 * h, 0.1 * h, palette.vehicleBody);

    // Hood: a simple shadow + fill + outline wedge tapering down toward the front.
    const hoodShadow = darken(palette.vehicleBody, 0.22);
    const hoodOutline = darken(palette.vehicleBody, 0.55);
    const hoodPts = [
      { x: 0.52 * w, y: 0.4 * h },
      { x: 0.94 * w, y: 0.56 * h },
      { x: 0.94 * w, y: 0.78 * h },
      { x: 0.52 * w, y: 0.78 * h },
    ];
    g.fillStyle(hoodShadow, 1);
    g.beginPath();
    hoodPts.forEach((p, i) => (i === 0 ? g.moveTo(p.x + w * 0.03, p.y + h * 0.04) : g.lineTo(p.x + w * 0.03, p.y + h * 0.04)));
    g.closePath();
    g.fillPath();
    g.fillStyle(palette.vehicleBody, 1);
    g.beginPath();
    hoodPts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.closePath();
    g.fillPath();
    g.lineStyle(Math.max(1.5, h * 0.025), hoodOutline, 1);
    g.beginPath();
    hoodPts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.closePath();
    g.strokePath();

    // Open-top tractor (no enclosed cab/windshield) — a driver sprite drawn on top of an
    // enclosed cab used to visually read as "floating outside the tractor" since nothing ever
    // framed them from in front. A simple open platform with a seat back reads correctly at
    // any driver position instead — placed clear above both the chassis block (which starts
    // at 0.34h) and the rear wheel sprite that renders in front of this texture (its top edge
    // lands around 0.4h too), so neither one covers the seat.
    const seatOutline = darken(palette.vehicleTrim, 0.5);
    drawPanel(g, 0.15 * w, 0.05 * h, 0.17 * w, 0.28 * h, 0.05 * h, palette.vehicleTrim);
    g.fillStyle(darken(palette.exhaustMetal, 0.1), 1);
    g.fillRoundedRect(0.34 * w, 0.08 * h, 0.045 * w, 0.24 * h, w * 0.02);
    g.lineStyle(Math.max(1, w * 0.006), seatOutline, 1);
    g.strokeRoundedRect(0.34 * w, 0.08 * h, 0.045 * w, 0.24 * h, w * 0.02);
    drawRoundBlob(g, 0.37 * w, 0.07 * h, 0.045 * w, palette.exhaustMetal);

    // Exhaust pipe, mounted at the hood/cab junction — flush with the texture's top edge.
    const exOutline = darken(palette.exhaustMetal, 0.5);
    const exCapR = h * 0.035;
    g.fillStyle(darken(palette.exhaustMetal, 0.22), 1);
    g.fillRoundedRect(0.465 * w + w * 0.012, h * 0.012, 0.035 * w, 0.32 * h, w * 0.017);
    g.fillStyle(palette.exhaustMetal, 1);
    g.fillRoundedRect(0.465 * w, 0, 0.035 * w, 0.32 * h, w * 0.017);
    g.lineStyle(Math.max(1, w * 0.006), exOutline, 1);
    g.strokeRoundedRect(0.465 * w, 0, 0.035 * w, 0.32 * h, w * 0.017);
    drawRoundBlob(g, 0.4825 * w, exCapR, exCapR, darken(palette.exhaustMetal, 0.35));

    function drawPanelShape(gg: Phaser.GameObjects.Graphics, fillShape: () => void, fill: number) {
      const shadow = darken(fill, 0.22);
      const outline = darken(fill, 0.55);
      gg.save();
      gg.translateCanvas(w * 0.05, h * 0.06);
      gg.fillStyle(shadow, 1);
      fillShape();
      gg.restore();
      gg.fillStyle(fill, 1);
      fillShape();
      gg.lineStyle(Math.max(1.5, h * 0.02), outline, 1);
      gg.strokeEllipse(0.24 * w, 0.76 * h, 0.34 * w, 0.38 * h);
    }
  });
}

export function buildWheelTexture(scene: Phaser.Scene, palette: ScenePalette, radius: number, key: string): string {
  return ensureTexture(scene, key, radius * 2, radius * 2, (g) => {
    const r = radius;
    drawRoundBlob(g, r, r, r * 0.92, palette.tireRubber);

    const spokeCount = 5;
    const spokeColor = darken(palette.tireRubber, 0.35);
    g.lineStyle(Math.max(1.5, r * 0.09), spokeColor, 0.85);
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2;
      g.beginPath();
      g.moveTo(r, r);
      g.lineTo(r + Math.cos(angle) * r * 0.72, r + Math.sin(angle) * r * 0.72);
      g.strokePath();
    }
    // One brighter marker spoke so rotation reads clearly frame to frame.
    g.lineStyle(Math.max(1.5, r * 0.1), palette.vehicleTrim, 1);
    g.beginPath();
    g.moveTo(r, r);
    g.lineTo(r + r * 0.72, r);
    g.strokePath();

    drawRoundBlob(g, r, r, r * 0.3, palette.wheelHub);
  });
}

export function buildDriverTexture(scene: Phaser.Scene, palette: ScenePalette, w: number, h: number): string {
  return ensureTexture(scene, `tractor-driver-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    drawPanel(g, w * 0.22, h * 0.38, w * 0.56, h * 0.6, w * 0.16, palette.driverSilhouette);
    drawRoundBlob(g, w * 0.5, h * 0.24, w * 0.22, palette.driverSilhouette);
  });
}

/** Floor slab height as a fraction of the bed texture height — shared with the scene, which
 * needs to know where the floor's top edge is to seat passengers on it. */
export const TRAILER_FLOOR_FRACTION = 0.42;
/** Back-wall width as a fraction of the bed texture width — shared with the scene for seating. */
export const TRAILER_WALL_FRACTION = 0.1;

export function buildTrailerBedTexture(scene: Phaser.Scene, palette: ScenePalette, w: number, h: number): string {
  return ensureTexture(scene, `trailer-bed-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    // A chunky floor slab (not a thin line) so the cart still reads as a solid box when tilted.
    const floorH = h * TRAILER_FLOOR_FRACTION;
    const floorY = h - floorH;
    drawPanel(g, 0, floorY, w, floorH, floorH * 0.22, palette.trailerBed);

    const wallW = w * TRAILER_WALL_FRACTION;
    drawPanel(g, 0, h * 0.2, wallW, h - h * 0.2, wallW * 0.3, palette.trailerBed);

    g.lineStyle(Math.max(1.5, h * 0.012), darken(palette.trailerBed, 0.45), 0.8);
    g.beginPath();
    g.moveTo(wallW, floorY);
    g.lineTo(w, floorY);
    g.strokePath();
  });
}

export function buildTrailerFrontWallTexture(scene: Phaser.Scene, palette: ScenePalette, w: number, h: number): string {
  return ensureTexture(scene, `trailer-front-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    drawPanel(g, 0, 0, w, h, w * 0.22, palette.trailerFrontWall);
    // A couple of horizontal plank lines so the panel reads as a wooden gate/board rather
    // than a plain colored slab.
    const plankColor = darken(palette.trailerFrontWall, 0.35);
    g.lineStyle(Math.max(1, h * 0.02), plankColor, 0.55);
    for (const t of [0.35, 0.65]) {
      g.beginPath();
      g.moveTo(w * 0.12, h * t);
      g.lineTo(w * 0.88, h * t);
      g.strokePath();
    }
  });
}

/**
 * Headlight beam — a wide triangular cone, bright where it meets the lamp (left edge) fading
 * to nothing at its far edge (right), meant to be drawn with `setBlendMode(Phaser.BlendModes.
 * ADD)` so it glows against a dark sky rather than sitting on top of it as a flat shape. One of
 * only two places in the whole mechanic allowed a real gradient (the other is the sky itself) —
 * everything else uses the flat shadow/highlight/outline recipe above.
 */
export function buildHeadlightConeTexture(scene: Phaser.Scene, palette: ScenePalette, w: number, h: number): string {
  return ensureTexture(scene, `tractor-headlight-${Math.round(w)}x${Math.round(h)}`, w, h, (g) => {
    const beam = lighten(palette.vehicleTrim, 0.6);
    g.fillGradientStyle(beam, beam, beam, beam, 0.85, 0, 0.85, 0);
    g.beginPath();
    g.moveTo(0, h * 0.5);
    g.lineTo(w, 0);
    g.lineTo(w, h);
    g.closePath();
    g.fillPath();
  });
}
