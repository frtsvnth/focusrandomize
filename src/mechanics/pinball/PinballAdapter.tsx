import { useEffect, useRef } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

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

    // Ball launches from bottom-left launcher
    const ball = { x: 40, y: H - 100, vx: 8, vy: -10 };
    const gravity = reducedMotion ? 0 : 0.12;

    // Bumpers
    const bumpers = [
      { x: W * 0.35, y: H * 0.3, r: 22 },
      { x: W * 0.65, y: H * 0.3, r: 22 },
      { x: W * 0.5, y: H * 0.5, r: 26 },
      { x: W * 0.2, y: H * 0.65, r: 18 },
      { x: W * 0.8, y: H * 0.65, r: 18 },
      { x: W * 0.5, y: H * 0.75, r: 20 },
    ];

    // Flippers (visual only — they just nudge)
    const flipperLeft = { x: W * 0.15, y: H - 40, w: 50, h: 10 };
    const flipperRight = { x: W * 0.85 - 50, y: H - 40, w: 50, h: 10 };

    let t0 = performance.now();
    let animId = 0;
    let settled = false;

    const drawTable = () => {
      // Table background
      const tableGrad = ctx.createLinearGradient(0, 0, 0, H);
      tableGrad.addColorStop(0, '#0b1220');
      tableGrad.addColorStop(0.7, '#111827');
      tableGrad.addColorStop(1, '#0b1220');
      ctx.fillStyle = tableGrad;
      ctx.fillRect(0, 0, W, H);

      // Slots at top
      for (let i = 0; i < slots; i++) {
        const x = i * slotW;
        const grad = ctx.createLinearGradient(x, 0, x, 50);
        grad.addColorStop(0, teams[i].color + '44');
        grad.addColorStop(1, teams[i].color + '11');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, 0, slotW - 4, 50);
        ctx.strokeStyle = teams[i].color + '33';
        ctx.strokeRect(x + 2, 0, slotW - 4, 50);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(teams[i].name, x + slotW / 2, 30);
      }

      // Bumpers
      for (const b of bumpers) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.5);
        g.addColorStop(0, 'rgba(167,139,250,0.3)');
        g.addColorStop(0.5, 'rgba(167,139,250,0.1)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#5b21b6';
        ctx.fill();
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Flippers
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      // Left flipper
      ctx.beginPath();
      ctx.moveTo(flipperLeft.x, flipperLeft.y);
      ctx.lineTo(flipperLeft.x + flipperLeft.w, flipperLeft.y - 15);
      ctx.lineTo(flipperLeft.x + flipperLeft.w, flipperLeft.y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right flipper
      ctx.beginPath();
      ctx.moveTo(flipperRight.x, flipperRight.y - 15);
      ctx.lineTo(flipperRight.x + flipperRight.w, flipperRight.y);
      ctx.lineTo(flipperRight.x + flipperRight.w, flipperRight.y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Launcher area
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(0, H - 80);
      ctx.lineTo(60, H - 80);
      ctx.lineTo(60, H);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, H - 80, 60, 80);
    };

    const frame = (time: number) => {
      const dt = reducedMotion ? 32 : 16;
      if (time - t0 < dt) {
        animId = requestAnimationFrame(frame);
        return;
      }
      t0 = time;
      drawTable();

      if (!settled) {
        ball.vy += gravity;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Walls
        if (ball.x < 12) { ball.x = 12; ball.vx *= -0.85; }
        if (ball.x > W - 12) { ball.x = W - 12; ball.vx *= -0.85; }
        if (ball.y < 12) { ball.y = 12; ball.vy *= -0.85; }

        // Bumpers
        for (const b of bumpers) {
          const dx = ball.x - b.x;
          const dy = ball.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < b.r + 10) {
            const nx = dx / dist;
            const ny = dy / dist;
            ball.vx = nx * 5 + (rand() - 0.5) * 2;
            ball.vy = ny * 5 + (rand() - 0.5) * 2;
            ball.x = b.x + nx * (b.r + 11);
            ball.y = b.y + ny * (b.r + 11);
          }
        }

        // Flipper nudge when ball is near bottom
        if (ball.y > H * 0.82 && ball.vy > 0) {
          if (ball.x < W * 0.4) {
            ball.vx += 1.5;
            ball.vy = -Math.abs(ball.vy) * 1.2;
          } else if (ball.x > W * 0.6) {
            ball.vx -= 1.5;
            ball.vy = -Math.abs(ball.vy) * 1.2;
          }
        }

        // Nudge toward target slot when near top
        if (ball.y < 120 && ball.vy < 0) {
          const targetX = targetIdx * slotW + slotW / 2;
          ball.vx += (targetX - ball.x) * 0.01;
          ball.vx *= 0.97;
        }

        // Drain: if ball falls off bottom
        if (ball.y > H) {
          // Respawn with another launch
          ball.x = 40;
          ball.y = H - 100;
          ball.vx = 5 + rand() * 4;
          ball.vy = -(8 + rand() * 6);
        }

        // Catch in slot
        if (ball.y < 50 && ball.vy < 0) {
          const slotIdx = Math.floor(ball.x / slotW);
          if (slotIdx === targetIdx) {
            settled = true;
            ball.vx = 0;
            ball.vy = 0;
            ball.x = targetIdx * slotW + slotW / 2;
            ball.y = 30;
            setTimeout(onComplete, reducedMotion ? 200 : 1000);
          } else {
            // Bounce out of wrong slot
            ball.vy = Math.abs(ball.vy) * 0.7;
            ball.vx += (rand() - 0.5) * 3;
          }
        }
      }

      // Ball glow
      const bg = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 24);
      bg.addColorStop(0, 'rgba(34,211,238,0.35)');
      bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (!settled) animId = requestAnimationFrame(frame);
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
