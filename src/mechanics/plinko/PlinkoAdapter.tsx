import { useEffect, useRef } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

export default function PlinkoAdapter({
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
    const rows = 8;
    const pinRadius = 4;
    const ballRadius = 8;
    const startY = 50;
    const spacingY = (H - 140) / rows;
    const slotHeight = 60;

    const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
    const slots = teams.length;
    const slotWidth = W / slots;

    const pins: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      const y = startY + r * spacingY;
      const stepX = W / (count + 1);
      for (let c = 0; c < count; c++) {
        pins.push({ x: stepX * (c + 1), y });
      }
    }

    const rightsNeeded = Math.round((targetIdx / (slots - 1 || 1)) * rows);
    const rand = mulberry32(seed);
    const path: boolean[] = [];
    let rights = 0;
    for (let r = 0; r < rows; r++) {
      const needMore = rights < rightsNeeded;
      const forced = needMore && r >= rows - (rightsNeeded - rights);
      if (forced) {
        path.push(true);
        rights++;
      } else {
        const v = rand() > 0.5;
        path.push(v);
        rights += v ? 1 : 0;
      }
    }

    const GRAVITY = 220;
    const RESTITUTION = 0.35;
    const FRICTION_AIR = 1.5;

    const ball = {
      x: W / 2 + (rand() - 0.5) * 14,
      y: startY - 20,
      vx: (rand() - 0.5) * 0.8,
      vy: 30,
    };

    let lastTime = performance.now();
    let animId = 0;
    let settled = false;
    let prevRow = -1;

    const drawPins = () => {
      for (const p of pins) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pinRadius * 3);
        g.addColorStop(0, 'rgba(148,163,184,0.25)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pinRadius * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, pinRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
      }
    };

    const drawSlots = () => {
      for (let i = 0; i < slots; i++) {
        const x = i * slotWidth;
        const grad = ctx.createLinearGradient(x, H - slotHeight, x, H);
        grad.addColorStop(0, teams[i].color + '33');
        grad.addColorStop(1, teams[i].color + '11');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, H - slotHeight, slotWidth - 2, slotHeight);
        ctx.strokeStyle = teams[i].color + '44';
        ctx.strokeRect(x + 1, H - slotHeight, slotWidth - 2, slotHeight);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(teams[i].name, x + slotWidth / 2, H - slotHeight / 2 + 4);
      }
    };

    const drawBall = () => {
      const bg = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 24);
      bg.addColorStop(0, 'rgba(255,255,255,0.3)');
      bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 24, 0, Math.PI * 2);
      ctx.fill();

      const bgrad = ctx.createRadialGradient(
        ball.x - 2, ball.y - 2, 0,
        ball.x, ball.y, ballRadius
      );
      bgrad.addColorStop(0, '#ffffff');
      bgrad.addColorStop(0.7, '#e2e8f0');
      bgrad.addColorStop(1, '#94a3b8');
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = bgrad;
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const frame = (time: number) => {
      const dt = Math.min(time - lastTime, 33.33);
      lastTime = time;

      ctx.clearRect(0, 0, W, H);
      drawPins();
      drawSlots();

      if (!settled) {
        const dtSec = dt / 1000;

        ball.vy += GRAVITY * dtSec;
        ball.vx *= Math.max(0, 1 - FRICTION_AIR * dtSec);

        let nextX = ball.x + ball.vx * dtSec;
        let nextY = ball.y + ball.vy * dtSec;

        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const maxStep = Math.max(speed * dtSec, ballRadius * 0.5);
        const subSteps = Math.min(Math.ceil(maxStep / (ballRadius * 0.5)), 10);
        const subDt = dtSec / subSteps;

        for (let s = 0; s < subSteps; s++) {
          if (s > 0) {
            ball.x += ball.vx * subDt;
            ball.y += ball.vy * subDt;
          } else {
            ball.x = nextX;
            ball.y = nextY;
          }

          for (const pin of pins) {
            const dx = ball.x - pin.x;
            const dy = ball.y - pin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = pinRadius + ballRadius;

            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;

              ball.x = pin.x + nx * minDist;
              ball.y = pin.y + ny * minDist;

              const vDotN = ball.vx * nx + ball.vy * ny;
              if (vDotN < 0) {
                ball.vx -= vDotN * nx * (1 + RESTITUTION);
                ball.vy -= vDotN * ny * (1 + RESTITUTION);
                ball.vx += (rand() - 0.5) * 1.2 * speed * 0.08;
                ball.vy += (rand() - 0.5) * 0.5;
              }
            }
          }

          if (ball.x < ballRadius) { ball.x = ballRadius; ball.vx = Math.abs(ball.vx) * 0.3; }
          if (ball.x > W - ballRadius) { ball.x = W - ballRadius; ball.vx = -Math.abs(ball.vx) * 0.3; }
          if (ball.y < ballRadius) { ball.y = ballRadius; ball.vy = Math.abs(ball.vy) * 0.3; }
        }

        if (!reducedMotion) {
          const rowHeight = (H - 140) / rows;
          const currentRow = Math.floor((ball.y - startY) / rowHeight);
          if (currentRow !== prevRow && currentRow >= 0 && currentRow < rows) {
            prevRow = currentRow;
            const dir = path[currentRow] ? 1 : -1;
            ball.vx += dir * 8;
          }
        }

        if (ball.y > H - slotHeight - ballRadius) {
          settled = true;
          const slotIdx = Math.max(0, Math.min(slots - 1, Math.floor(ball.x / slotWidth)));
          ball.x = slotIdx * slotWidth + slotWidth / 2;
          ball.y = H - slotHeight / 2;
          ball.vx = 0;
          ball.vy = 0;
          setTimeout(onComplete, reducedMotion ? 200 : 800);
        }
      }

      drawBall();

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
