/**
 * Name-chip billboard for a team character — the 3D analog of Tractor's `createNameChip`/
 * `drawChipBackground` (a rounded capsule background + text, in the team's color), but drawn
 * once onto an offscreen 2D canvas and used as a THREE.Sprite: sprites always billboard to
 * face the camera in Three.js, so unlike Tractor's Phaser chip (which counter-scales itself
 * against its parent container), there's no per-frame projection math needed here.
 */
import * as THREE from 'three';

const FONT = '700 30px Inter, system-ui, sans-serif';
const PAD_X = 20;
const CHIP_HEIGHT_PX = 56;
const SUPERSAMPLE = 2;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function makeNameChipSprite(team: { name: string; color: string }): THREE.Sprite {
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = FONT;
  const textWidth = measure.measureText(team.name).width;

  const cw = Math.ceil(textWidth + PAD_X * 2);
  const ch = CHIP_HEIGHT_PX;

  const canvas = document.createElement('canvas');
  canvas.width = cw * SUPERSAMPLE;
  canvas.height = ch * SUPERSAMPLE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);

  const radius = ch / 2;
  ctx.fillStyle = 'rgba(11,18,32,0.85)';
  roundedRect(ctx, 0, 0, cw, ch, radius);
  ctx.fill();
  ctx.strokeStyle = team.color;
  ctx.lineWidth = 2.5;
  roundedRect(ctx, 1.25, 1.25, cw - 2.5, ch - 2.5, radius - 1.25);
  ctx.stroke();

  ctx.font = FONT;
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(team.name, cw / 2, ch / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);

  const worldHeight = 34;
  sprite.scale.set(worldHeight * (cw / ch), worldHeight, 1);
  return sprite;
}
