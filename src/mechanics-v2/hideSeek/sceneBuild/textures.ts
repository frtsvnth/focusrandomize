/**
 * Procedural brick/stone canvas texture — ported from the isometric-maze prototype's
 * scene.js `makeStoneTexture`. No external image files: every mechanic in this project
 * stays a static, GitHub-Pages-friendly bundle, and this keeps the maze consistent with
 * that (same principle as Tractor's Phaser.Graphics-drawn passenger/vehicle textures).
 */
import * as THREE from 'three';

export function makeStoneTexture(base = '#71717a', dark = '#4b4b52'): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  const bh = 12;
  for (let row = 0; row < size / bh + 1; row++) {
    const y = row * bh;
    const offset = row % 2 === 0 ? 0 : 16;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    for (let x = -16; x < size + 16; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset, y + bh);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, y, 1, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}
