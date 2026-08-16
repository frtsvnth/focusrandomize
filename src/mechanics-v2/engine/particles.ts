import { hexToRgb } from './canvasUtils';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  vrot: number;
  shape: 'rect' | 'circle' | 'spark' | 'star';
  gravity: number;
  drag: number;
}

/** Lightweight canvas particle system for confetti, sparks and ambient dust. Reused across all v2 mechanics. */
export class ParticleSystem {
  private particles: Particle[] = [];
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  get count() {
    return this.particles.length;
  }

  clear() {
    this.particles = [];
  }

  burstConfetti(x: number, y: number, colors: string[], count = 90) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const speed = 3.5 + this.rng() * 9;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 0,
        maxLife: 1.6 + this.rng() * 1.2,
        size: 5 + this.rng() * 7,
        color: colors[Math.floor(this.rng() * colors.length)],
        rotation: this.rng() * Math.PI * 2,
        vrot: (this.rng() - 0.5) * 14,
        shape: this.rng() > 0.5 ? 'rect' : 'circle',
        gravity: 14 + this.rng() * 6,
        drag: 0.985,
      });
    }
  }

  burstSparks(x: number, y: number, color: string, count = 26) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const speed = 2 + this.rng() * 7;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.35 + this.rng() * 0.4,
        size: 1.5 + this.rng() * 2.5,
        color,
        rotation: 0,
        vrot: 0,
        shape: 'spark',
        gravity: 2,
        drag: 0.94,
      });
    }
  }

  burstStars(x: number, y: number, colors: string[], count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const speed = 1.5 + this.rng() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: 1 + this.rng() * 0.8,
        size: 6 + this.rng() * 6,
        color: colors[Math.floor(this.rng() * colors.length)],
        rotation: this.rng() * Math.PI * 2,
        vrot: (this.rng() - 0.5) * 6,
        shape: 'star',
        gravity: 6,
        drag: 0.98,
      });
    }
  }

  spawnDust(x: number, y: number, color: string, dirX: number, dirY: number) {
    this.particles.push({
      x,
      y,
      vx: dirX * (0.5 + this.rng() * 1.5) - 1,
      vy: dirY * (0.5 + this.rng() * 1.5) - this.rng() * 0.6,
      life: 0,
      maxLife: 0.5 + this.rng() * 0.4,
      size: 3 + this.rng() * 5,
      color,
      rotation: 0,
      vrot: 0,
      shape: 'circle',
      gravity: -1,
      drag: 0.96,
    });
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity * dt;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vrot * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.shape === 'rect') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 'spark') {
        const [r, g, b] = hexToRgb(p.color);
        ctx.fillStyle = `rgba(${r},${g},${b},1)`;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        drawStar(ctx, p.size / 2, p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    const ox = Math.cos(outerAngle) * r;
    const oy = Math.sin(outerAngle) * r;
    const ix = Math.cos(innerAngle) * (r * 0.45);
    const iy = Math.sin(innerAngle) * (r * 0.45);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
}
