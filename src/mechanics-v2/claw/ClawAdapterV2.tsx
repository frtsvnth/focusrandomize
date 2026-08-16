import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { easeInOutCubic, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

type Phase = 'move' | 'drop' | 'grab' | 'lift';

export default function ClawAdapterV2({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const rng = makeRng(seed);
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const ctx = setupHiDPICanvas(canvas, width, height);
    const particles = new ParticleSystem(rng);
    const orbR = Math.min(width, height) * 0.075;

    function overlap(x1: number, y1: number, x2: number, y2: number) {
      return Math.hypot(x1 - x2, y1 - y2) < orbR * 2 + 6;
    }

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < teams.length; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const x = width * (0.1 + rng() * 0.8);
        const y = height * (0.32 + rng() * 0.55);
        if (positions.every((p) => !overlap(x, y, p.x, p.y))) {
          positions.push({ x, y });
          placed = true;
          break;
        }
      }
      if (!placed) positions.push({ x: width * (0.1 + rng() * 0.8), y: height * (0.32 + rng() * 0.55) });
    }

    const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
    const targetPos = positions[targetIdx];

    const waypoints: { x: number; y: number }[] = [];
    if (!reducedMotion) {
      for (let i = 0; i < 4; i++) {
        waypoints.push({ x: width * (0.1 + rng() * 0.8), y: height * (0.08 + rng() * 0.15) });
      }
    }
    waypoints.push({ x: targetPos.x, y: height * 0.1 });

    let claw = { x: width / 2, y: height * 0.1, swing: 0 };
    let phase: Phase = 'move';
    let wpIndex = 0;
    let segStart = performance.now();
    const segDur = reducedMotion ? 100 : 520;
    let fingerAngle = 0;

    let rafId = 0;
    let done = false;

    function drawScene() {
      ctx.clearRect(0, 0, width, height);

      // cabinet bg
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#0a101e');
      bg.addColorStop(1, '#050810');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 34) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 34) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // rail at top
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, width, height * 0.05);

      // team orbs
      teams.forEach((t, idx) => {
        const p = positions[idx];
        const isTarget = t.id === targetTeam.id;
        const hidden = isTarget && (phase === 'grab' || phase === 'lift');
        if (hidden) return;
        ctx.save();
        ctx.translate(p.x, p.y);
        const grad = ctx.createRadialGradient(-orbR * 0.3, -orbR * 0.3, orbR * 0.1, 0, 0, orbR);
        grad.addColorStop(0, withAlpha(t.color, 0.98));
        grad.addColorStop(1, withAlpha(t.color, 0.55));
        ctx.beginPath();
        ctx.arc(0, 0, orbR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${orbR * 0.32}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        const label = t.name.length > 10 ? t.name.slice(0, 9) + '…' : t.name;
        ctx.fillText(label, 0, orbR * 0.15);
        if (t.logo) ctx.fillText(t.logo, 0, -orbR * 0.35);
        ctx.restore();
      });

      // cable + claw
      const swingOffset = Math.sin(claw.swing) * 8 * (phase === 'move' ? 1 : 0.3);
      const clawX = claw.x + swingOffset;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(claw.x, 0);
      ctx.lineTo(clawX, claw.y);
      ctx.stroke();

      ctx.save();
      ctx.translate(clawX, claw.y);
      ctx.rotate(swingOffset * 0.01);

      if (phase === 'grab' || phase === 'lift') {
        ctx.save();
        ctx.translate(0, 6);
        const grad = ctx.createRadialGradient(-orbR * 0.3, -orbR * 0.3, orbR * 0.1, 0, 0, orbR * 0.94);
        grad.addColorStop(0, withAlpha(targetTeam.color, 1));
        grad.addColorStop(1, withAlpha(targetTeam.color, 0.6));
        ctx.beginPath();
        ctx.arc(0, 0, orbR * 0.94, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${orbR * 0.3}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = targetTeam.name.length > 10 ? targetTeam.name.slice(0, 9) + '…' : targetTeam.name;
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }

      // claw head
      const headR = orbR * 0.95;
      ctx.beginPath();
      ctx.arc(0, 0, headR, 0, Math.PI * 2);
      const headGrad = ctx.createRadialGradient(-headR * 0.3, -headR * 0.3, headR * 0.1, 0, 0, headR);
      headGrad.addColorStop(0, '#f1f5f9');
      headGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = headGrad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      const gripping = phase === 'grab' || phase === 'lift';
      const finger = gripping ? 1 : fingerAngle;
      [-1, 0, 1].forEach((dir) => {
        const baseAngle = dir === 0 ? 0 : dir * 0.55;
        const angle = baseAngle + (dir !== 0 ? -dir * finger * 0.75 : 0);
        ctx.save();
        ctx.rotate(angle);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = Math.max(6, orbR * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, headR * 0.55);
        ctx.lineTo(0, headR * 0.55 + orbR * 0.85);
        ctx.stroke();
        ctx.restore();
      });

      ctx.restore();

      particles.update(1 / 60);
      particles.draw(ctx);
    }

    function frame(now: number) {
      const elapsed = now - segStart;
      const t = Math.min(1, elapsed / segDur);
      claw.swing = now / 140;

      if (phase === 'move') {
        const target = waypoints[wpIndex];
        const from = wpIndex === 0 ? { x: width / 2, y: height * 0.1 } : waypoints[wpIndex - 1];
        const eased = easeInOutCubic(t);
        claw.x = from.x + (target.x - from.x) * eased;
        claw.y = from.y;
        if (t >= 1) {
          wpIndex++;
          segStart = now;
          if (wpIndex >= waypoints.length) {
            phase = 'drop';
            segStart = now;
          } else {
            sound.playWhoosh(0.3);
          }
        }
      } else if (phase === 'drop') {
        const dropDur = reducedMotion ? 100 : 600;
        const dt2 = Math.min(1, elapsed / dropDur);
        claw.y = height * 0.1 + (targetPos.y - height * 0.1) * easeInOutCubic(dt2);
        if (dt2 >= 1) {
          phase = 'grab';
          segStart = now;
          sound.playClunk(1.4);
          particles.burstSparks(claw.x, claw.y, targetTeam.color, reducedMotion ? 0 : 16);
          setShaking(true);
          setTimeout(() => setShaking(false), 200);
        }
      } else if (phase === 'grab') {
        fingerAngle = Math.min(1, elapsed / (reducedMotion ? 80 : 400));
        if (elapsed >= (reducedMotion ? 80 : 500)) {
          phase = 'lift';
          segStart = now;
        }
      } else if (phase === 'lift') {
        const liftDur = reducedMotion ? 100 : 700;
        const dt3 = Math.min(1, elapsed / liftDur);
        claw.y = targetPos.y + (height * 0.1 - targetPos.y) * easeInOutCubic(dt3);
        if (dt3 >= 1 && !done) {
          done = true;
          sound.playFanfare();
          particles.burstConfetti(claw.x, claw.y, teams.map((tm) => tm.color), reducedMotion ? 20 : 90);
          const completeAt = reducedMotion ? 120 : 900;
          setTimeout(() => onComplete(targetTeam), completeAt);
        }
      }

      drawScene();

      if (!done || particles.count > 0) {
        rafId = requestAnimationFrame(frame);
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={shaking ? 'v2-shake' : undefined}
      style={{
        position: 'relative',
        width: 'min(90vw, 1100px)',
        height: 'min(74vh, 720px)',
        margin: '0 auto',
        borderRadius: 24,
        overflow: 'hidden',
        border: '2px solid #1e293b',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px rgba(34,211,238,0.1)',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
