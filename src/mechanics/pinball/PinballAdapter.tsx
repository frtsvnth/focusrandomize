import { useEffect, useRef } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

interface Vec2 { x: number; y: number }
interface Bumper { x: number; y: number; r: number; glow: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number }
interface TrailPoint { x: number; y: number; life: number }

export default function PinballAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const slots = teams.length;
    const slotW = W / slots;
    const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
    const rand = mulberry32(seed);

    const GRAVITY = 280;
    const FRICTION = 0.35;
    const WALL_REST = 0.35;
    const BUMPER_REST = 0.55;
    const BUMPER_BOOST = 1.12;
    const MAX_SPEED = 650;
    const BALL_R = 7;

    const FLIP_LEN = 55;
    const FLIP_THICK = 10;
    const FLIP_REST = Math.PI / 5.5;
    const FLIP_ACTIVE = -Math.PI / 5;
    const FLIP_SPEED = 5.5;
    const pivotL: Vec2 = { x: W * 0.22, y: H - 32 };
    const pivotR: Vec2 = { x: W * 0.78, y: H - 32 };

    const LAUNCHER_X = W - 42;
    const LAUNCHER_W = 32;

    const ball: Vec2 & { vx: number; vy: number } = { x: LAUNCHER_X + LAUNCHER_W / 2, y: H - 42, vx: 0, vy: 0 };

    const bumpers: Bumper[] = [
      { x: W * 0.5, y: H * 0.20, r: 24, glow: 0 },
      { x: W * 0.3, y: H * 0.33, r: 20, glow: 0 },
      { x: W * 0.7, y: H * 0.33, r: 20, glow: 0 },
      { x: W * 0.18, y: H * 0.52, r: 18, glow: 0 },
      { x: W * 0.82, y: H * 0.52, r: 18, glow: 0 },
      { x: W * 0.5, y: H * 0.58, r: 22, glow: 0 },
      { x: W * 0.35, y: H * 0.45, r: 16, glow: 0 },
      { x: W * 0.65, y: H * 0.45, r: 16, glow: 0 },
    ];

    const flippers = { left: { angle: FLIP_REST, active: false }, right: { angle: FLIP_REST, active: false } };
    const particles: Particle[] = [];
    const trail: TrailPoint[] = [];

    let lastTime = performance.now();
    let animId = 0;
    let settled = false;
    let launchTimer = 0;
    let state: 'ready' | 'launching' | 'playing' | 'settled' = 'ready';
    let lastBumperHit = 0;
    let bumperHitCount = 0;

    const toTargetX = targetIdx * slotW + slotW / 2;

    const spawnParticles = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const s = 15 + rand() * 50;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + rand() * 0.4, maxLife: 0.3 + rand() * 0.4, color, r: 1.5 + rand() * 2.5 });
      }
    };

    const flipEnd = (p: Vec2, a: number): Vec2 => ({
      x: p.x + Math.cos(a) * FLIP_LEN,
      y: p.y - Math.sin(a) * FLIP_LEN,
    });

    const collideFlipper = (pivot: Vec2, angle: number) => {
      const e = flipEnd(pivot, angle);
      const dx = e.x - pivot.x;
      const dy = e.y - pivot.y;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((ball.x - pivot.x) * dx + (ball.y - pivot.y) * dy) / len2));
      const cx = pivot.x + t * dx;
      const cy = pivot.y + t * dy;
      const ddx = ball.x - cx;
      const ddy = ball.y - cy;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < BALL_R + FLIP_THICK / 2 + 1) {
        const nx = -dy / Math.sqrt(len2);
        const ny = dx / Math.sqrt(len2);
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          ball.x = cx + nx * (BALL_R + FLIP_THICK / 2 + 1);
          ball.y = cy + ny * (BALL_R + FLIP_THICK / 2 + 1);
          const boost = (angle < FLIP_REST - 0.1) ? 1.7 : 1.0;
          ball.vx -= vn * nx * boost * 1.8;
          ball.vy -= vn * ny * boost * 1.8;
          if (boost > 1) ball.vy -= 55;
          spawnParticles(ball.x, ball.y, '#fbbf24', 4);
        }
      }
    };

    const nudgeTarget = () => {
      if (ball.y < 100 && ball.vy < 0) {
        ball.vx += (toTargetX - ball.x) * 0.05;
        ball.vx *= 0.96;
      }
    };

    const checkDrain = () => ball.y > H + 20;

    const checkSlot = (): boolean => {
      if (ball.y < 52 && ball.vy < 0) {
        const slotIdx = Math.floor(ball.x / slotW);
        if (slotIdx === targetIdx) return true;
        ball.vy = Math.abs(ball.vy) * 0.6;
        ball.vx += (rand() - 0.5) * 40;
      }
      return false;
    };

    const drawTable = () => {
      const tg = ctx.createLinearGradient(0, 0, 0, H);
      tg.addColorStop(0, '#0c1425');
      tg.addColorStop(0.5, '#111827');
      tg.addColorStop(1, '#0c1425');
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, W, H);

      // Side rails
      ctx.strokeStyle = '#2a3a4f';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(9, 60); ctx.lineTo(9, H - 42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(LAUNCHER_X - 6, 60); ctx.lineTo(LAUNCHER_X - 6, H - 42); ctx.stroke();

      // Top arc
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(9, 55);
      ctx.quadraticCurveTo(9, 9, 50, 9);
      ctx.lineTo(W - 50, 9);
      ctx.quadraticCurveTo(W - 9, 9, W - 9, 55);
      ctx.stroke();

      // Bottom funnels
      ctx.strokeStyle = '#2d3a4a';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(9, H - 110); ctx.lineTo(pivotL.x - 12, H - 32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(LAUNCHER_X - 6, H - 110); ctx.lineTo(pivotR.x + 12, H - 32); ctx.stroke();

      // Slots
      for (let i = 0; i < slots; i++) {
        const x = i * slotW;
        const sg = ctx.createLinearGradient(x, 0, x, 52);
        sg.addColorStop(0, teams[i].color + '55');
        sg.addColorStop(1, teams[i].color + '11');
        ctx.fillStyle = sg;
        ctx.fillRect(x + 3, 3, slotW - 6, 49);
        ctx.strokeStyle = teams[i].color + '44';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 3, 3, slotW - 6, 49);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(teams[i].name, x + slotW / 2, 32);
      }

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(targetIdx * slotW + 3, 3, slotW - 6, 49);
      ctx.setLineDash([]);

      // Launcher
      const lg = ctx.createLinearGradient(LAUNCHER_X, 0, LAUNCHER_X + LAUNCHER_W, 0);
      lg.addColorStop(0, '#1e293b'); lg.addColorStop(1, '#0f172a');
      ctx.fillStyle = lg;
      ctx.fillRect(LAUNCHER_X, H * 0.3, LAUNCHER_W, H - H * 0.3);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(LAUNCHER_X, H * 0.3, LAUNCHER_W, H - H * 0.3);
    };

    const drawBumpers = (dt: number) => {
      for (const b of bumpers) {
        b.glow = Math.max(0, b.glow - dt * 3);
        const gr = b.r * (2.5 + b.glow * 1.5);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, gr);
        g.addColorStop(0, `rgba(167,139,250,${0.3 + b.glow * 0.3})`);
        g.addColorStop(0.5, `rgba(167,139,250,${0.1 + b.glow * 0.1})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, gr, 0, Math.PI * 2); ctx.fill();

        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#4c1d95'; ctx.fill();
        ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2; ctx.stroke();

        const ig = ctx.createRadialGradient(b.x - b.r * 0.2, b.y - b.r * 0.2, 0, b.x, b.y, b.r);
        ig.addColorStop(0, 'rgba(255,255,255,0.25)'); ig.addColorStop(1, 'transparent');
        ctx.fillStyle = ig;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      }
    };

    const drawFlippers = () => {
      for (const side of ['left', 'right'] as const) {
        const pivot = side === 'left' ? pivotL : pivotR;
        const ang = flippers[side].angle;
        const e = flipEnd(pivot, ang);

        ctx.save();
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = flippers[side].active ? 14 : 5;

        ctx.lineWidth = FLIP_THICK;
        ctx.strokeStyle = flippers[side].active ? '#f59e0b' : '#475569';
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(e.x, e.y); ctx.stroke();

        ctx.restore();
        ctx.beginPath(); ctx.arc(pivot.x, pivot.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b'; ctx.fill();
      }
    };

    const drawParticles = (dt: number) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const a = Math.round((p.life / p.maxLife) * 255).toString(16).padStart(2, '0');
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fillStyle = p.color + a; ctx.fill();
      }
    };

    const drawBall = (dt: number) => {
      for (let i = trail.length - 1; i >= 0; i--) {
        const t = trail[i];
        t.life -= dt * 2;
        if (t.life <= 0) { trail.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * 0.5 * t.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${t.life * 0.2})`; ctx.fill();
      }

      const bg = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 30);
      bg.addColorStop(0, 'rgba(34,211,238,0.3)'); bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, 30, 0, Math.PI * 2); ctx.fill();

      const bsg = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, BALL_R);
      bsg.addColorStop(0, '#ffffff'); bsg.addColorStop(0.5, '#e2e8f0'); bsg.addColorStop(1, '#94a3b8');
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = bsg; ctx.fill();
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.stroke();
    };

    const frame = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      ctx.clearRect(0, 0, W, H);
      drawTable();
      drawBumpers(dt);
      drawFlippers();

      if (!settled) {
        if (state === 'ready') {
          launchTimer += dt;
          ball.x = LAUNCHER_X + LAUNCHER_W / 2;
          ball.y = H - 42;
          if (launchTimer > 0.2) state = 'launching';
        }

        if (state === 'launching') {
          ball.vy = -(350 + launchTimer * 200);
          ball.vx = (rand() - 0.5) * 15;
          state = 'playing';
          spawnParticles(ball.x, ball.y + 10, '#22d3ee', 8);
        }

        if (state === 'playing') {
          const nl = ball.x < W * 0.35 && ball.y > H * 0.65 && ball.vy > 0;
          const nr = ball.x > W * 0.65 && ball.y > H * 0.65 && ball.vy > 0;
          const nc = ball.y > H * 0.72 && ball.vy > 0;
          flippers.left.active = nl || (nc && ball.x < W * 0.5);
          flippers.right.active = nr || (nc && ball.x >= W * 0.5);

          const la = flippers.left.active ? FLIP_ACTIVE : FLIP_REST;
          const ra = flippers.right.active ? FLIP_ACTIVE : FLIP_REST;
          const spd = FLIP_SPEED * dt;
          flippers.left.angle += Math.sign(la - flippers.left.angle) * Math.min(spd, Math.abs(la - flippers.left.angle));
          flippers.right.angle += Math.sign(ra - flippers.right.angle) * Math.min(spd, Math.abs(ra - flippers.right.angle));

          ball.vy += GRAVITY * dt;
          ball.vx *= Math.max(0, 1 - FRICTION * dt);
          const sp = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
          if (sp > MAX_SPEED) { ball.vx *= MAX_SPEED / sp; ball.vy *= MAX_SPEED / sp; }

          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          if (ball.x < BALL_R + 9) { ball.x = BALL_R + 9; ball.vx = Math.abs(ball.vx) * WALL_REST; }
          if (ball.x > LAUNCHER_X - BALL_R - 6) { ball.x = LAUNCHER_X - BALL_R - 6; ball.vx = -Math.abs(ball.vx) * WALL_REST; }
          if (ball.y < BALL_R + 7) { ball.y = BALL_R + 7; ball.vy = Math.abs(ball.vy) * WALL_REST; }

          for (const b of bumpers) {
            const dx = ball.x - b.x;
            const dy = ball.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minD = b.r + BALL_R;
            if (dist < minD && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;
              ball.x = b.x + nx * minD;
              ball.y = b.y + ny * minD;
              const vn = ball.vx * nx + ball.vy * ny;
              if (vn < 0) {
                ball.vx -= vn * nx * (1 + BUMPER_REST);
                ball.vy -= vn * ny * (1 + BUMPER_REST);
                ball.vx *= BUMPER_BOOST;
                ball.vy *= BUMPER_BOOST;
                ball.vx += (rand() - 0.5) * 25;
                b.glow = 1;
                spawnParticles(b.x, b.y, '#c4b5fd', 6);
                const now = performance.now();
                if (now - lastBumperHit < 200) {
                  bumperHitCount++;
                  if (bumperHitCount > 5) { ball.vy -= 40; ball.vx += (rand() - 0.5) * 80; bumperHitCount = 0; }
                } else { bumperHitCount = 0; }
                lastBumperHit = now;
              }
            }
          }

          collideFlipper(pivotL, flippers.left.angle);
          collideFlipper(pivotR, flippers.right.angle);

          const guideL = { x1: 9, y1: H - 110, x2: pivotL.x - 12, y2: H - 32 };
          const guideR = { x1: LAUNCHER_X - 6, y1: H - 110, x2: pivotR.x + 12, y2: H - 32 };
          for (const g of [guideL, guideR]) {
            const gx = g.x2 - g.x1;
            const gy = g.y2 - g.y1;
            const gl2 = gx * gx + gy * gy;
            const t = Math.max(0, Math.min(1, ((ball.x - g.x1) * gx + (ball.y - g.y1) * gy) / gl2));
            const cx = g.x1 + t * gx;
            const cy = g.y1 + t * gy;
            const dd = Math.sqrt((ball.x - cx) ** 2 + (ball.y - cy) ** 2);
            if (dd < BALL_R + 3) {
              const nx = -gy / Math.sqrt(gl2);
              const ny = gx / Math.sqrt(gl2);
              const side = ((ball.x - g.x1) * ny - (ball.y - g.y1) * nx > 0) ? 1 : -1;
              ball.x = cx + nx * (BALL_R + 3) * side;
              ball.y = cy + ny * (BALL_R + 3) * side;
              const vn = ball.vx * nx + ball.vy * ny;
              if (vn * side < 0) { ball.vx -= vn * nx * 2 * WALL_REST; ball.vy -= vn * ny * 2 * WALL_REST; }
            }
          }

          nudgeTarget();

          if (trail.length < 15 && (trail.length === 0 || Math.hypot(ball.x - trail[trail.length - 1].x, ball.y - trail[trail.length - 1].y) > 5)) {
            trail.push({ x: ball.x, y: ball.y, life: 1 });
          }

          if (checkSlot()) {
            settled = true;
            ball.vx = 0; ball.vy = 0;
            ball.x = toTargetX; ball.y = 28;
            setTimeout(onComplete, reducedMotion ? 200 : 800);
          }

          if (checkDrain()) {
            ball.x = LAUNCHER_X + LAUNCHER_W / 2;
            ball.y = H - 42; ball.vx = 0; ball.vy = 0;
            state = 'ready'; launchTimer = 0; trail.length = 0;
          }
        }
      }

      drawParticles(dt);
      drawBall(dt);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [teams, targetTeam, seed, reducedMotion, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={520}
      style={{ width: '100%', maxWidth: 640, height: 'auto', display: 'block', margin: '0 auto', borderRadius: 16 }}
    />
  );
}
