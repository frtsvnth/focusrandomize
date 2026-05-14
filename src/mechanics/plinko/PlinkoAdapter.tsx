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
    const pinRadius = 3.5;
    const startY = 50;
    const spacingY = (H - 120) / rows;
    const slotHeight = 55;

    const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
    const slots = teams.length;
    const slotWidth = W / slots;

    const rightsNeeded = Math.round((targetIdx / (slots - 1 || 1)) * rows);
    const rand = mulberry32(seed);
    const path: number[] = [];
    let rights = 0;
    for (let r = 0; r < rows; r++) {
      const needMore = rights < rightsNeeded;
      const forced = needMore && r >= rows - (rightsNeeded - rights);
      if (forced) {
        path.push(1);
        rights++;
      } else {
        const v = rand() > 0.5 ? 1 : 0;
        path.push(v);
        rights += v;
      }
    }

    // Animation state: an array of target positions for the ball through time
    // We compute keyframes and smoothly interpolate
    let col = 0;
    const keyframes: { x: number; y: number }[] = [];
    keyframes.push({ x: W / 2, y: startY });
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      const stepX = W / (count + 1);
      const pinY = startY + r * spacingY;
      const pinX = stepX * (col + 1);
      keyframes.push({ x: pinX, y: pinY });
      const dir = path[r] === 1 ? 1 : -1;
      col += dir;
    }
    // Final slot
    const finalX = targetIdx * slotWidth + slotWidth / 2;
    const finalY = H - slotHeight / 2 - 8;
    keyframes.push({ x: finalX, y: H - slotHeight - 10 });
    keyframes.push({ x: finalX, y: finalY });

    const totalDuration = reducedMotion ? 800 : 4000;
    const startTime = performance.now();
    let animId = 0;
    let settled = false;

    const drawPins = () => {
      for (let r = 0; r < rows; r++) {
        const count = r + 3;
        const y = startY + r * spacingY;
        const stepX = W / (count + 1);
        for (let c = 0; c < count; c++) {
          const x = stepX * (c + 1);
          const g = ctx.createRadialGradient(x, y, 0, x, y, pinRadius * 3);
          g.addColorStop(0, 'rgba(148,163,184,0.25)');
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, pinRadius * 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#94a3b8';
          ctx.fill();
        }
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

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const frame = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / totalDuration);
      // Use easing: fast drop then settle
      const eased = 1 - Math.pow(1 - progress, 3);

      ctx.clearRect(0, 0, W, H);
      drawPins();
      drawSlots();

      // Find which segment we're in
      const segCount = keyframes.length - 1;
      const rawIdx = eased * segCount;
      const segIdx = Math.min(Math.floor(rawIdx), segCount - 1);
      const segT = rawIdx - segIdx;
      const k0 = keyframes[segIdx];
      const k1 = keyframes[segIdx + 1];

      const ballX = lerp(k0.x, k1.x, segT);
      const ballY = lerp(k0.y, k1.y, segT);

      // Ball glow
      const bg = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, 24);
      bg.addColorStop(0, 'rgba(255,255,255,0.3)');
      bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(ballX, ballY, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ballX, ballY, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (progress < 1) {
        animId = requestAnimationFrame(frame);
      } else if (!settled) {
        settled = true;
        onComplete();
      }
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
