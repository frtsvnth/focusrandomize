import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { clamp, easeInOutCubic, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

type Phase = 'arrive' | 'scan' | 'lock' | 'abduct' | 'flash' | 'done';

export default function AlienAbductionAdapterV2({
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
    const groundY = height * 0.72;

    const stars = Array.from({ length: 70 }, () => ({
      x: rng() * width,
      y: rng() * groundY,
      r: 0.6 + rng() * 1.6,
      phase: rng() * Math.PI * 2,
    }));

    const positions = teams.map((_, i) => ({
      x: width * (0.1 + ((i + 0.5) / teams.length) * 0.8),
      y: groundY + (rng() - 0.5) * height * 0.06,
    }));
    const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
    const targetPos = positions[targetIdx];

    const scanStops = reducedMotion ? [] : [0.2, 0.8, 0.35, 0.65, 0.5];
    const orbR = Math.min(width / teams.length, height * 0.1) * 0.42;

    let phase: Phase = 'arrive';
    let phaseStart = performance.now();
    let ufoX = width / 2;
    let segFromX = width / 2;
    let beamX = width / 2;
    let beamW = 0;
    let scanIdx = 0;
    let abductProgress = 0;
    let flashAlpha = 0;
    let done = false;
    let rafId = 0;

    function drawScene(now: number, t: number) {
      ctx.clearRect(0, 0, width, height);
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, '#040414');
      sky.addColorStop(1, '#0a1830');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, groundY);
      ctx.fillStyle = '#0f2418';
      ctx.fillRect(0, groundY, width, height - groundY);

      for (const s of stars) {
        const tw = 0.5 + Math.sin(now / 400 + s.phase) * 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.6})`;
        ctx.fill();
      }

      // ufo
      const ufoY = phase === 'arrive' ? height * 0.1 * easeInOutCubic(t) : height * 0.1;
      ctx.save();
      ctx.translate(ufoX, ufoY);
      const bodyW = width * 0.16;
      const bodyH = bodyW * 0.28;
      const bodyGrad = ctx.createLinearGradient(0, -bodyH, 0, bodyH);
      bodyGrad.addColorStop(0, '#cbd5e1');
      bodyGrad.addColorStop(1, '#475569');
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -bodyH * 0.35, bodyW * 0.22, bodyH * 0.9, 0, Math.PI, 0);
      ctx.fillStyle = withAlpha('#22d3ee', 0.35);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const lx = (-0.4 + (i / 5) * 0.8) * bodyW;
        const pulse = 0.5 + Math.sin(now / 150 + i) * 0.5;
        ctx.beginPath();
        ctx.arc(lx, bodyH * 0.25, bodyW * 0.02, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${0.5 + pulse * 0.5})`;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      // beam
      if (beamW > 0.01) {
        const topY = ufoY + bodyH * 0.4;
        ctx.save();
        ctx.globalAlpha = phase === 'abduct' ? 0.55 : 0.3 + Math.sin(now / 200) * 0.06;
        const beamGrad = ctx.createLinearGradient(0, topY, 0, groundY);
        beamGrad.addColorStop(0, withAlpha('#22d3ee', 0.7));
        beamGrad.addColorStop(1, withAlpha('#22d3ee', 0.05));
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(beamX - beamW * 0.15, topY);
        ctx.lineTo(beamX + beamW * 0.15, topY);
        ctx.lineTo(beamX + beamW, groundY);
        ctx.lineTo(beamX - beamW, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // team orbs
      teams.forEach((tm, idx) => {
        const p = positions[idx];
        const isTarget = tm.id === targetTeam.id;
        if (isTarget && (phase === 'flash' || phase === 'done')) return;
        let x = p.x;
        let y = p.y;
        let scale = 1;
        if (isTarget && phase === 'abduct') {
          const topY = ufoY + bodyH * 0.4;
          y = p.y + (topY - p.y) * abductProgress;
          x = p.x + Math.sin(abductProgress * Math.PI * 4) * 10;
          scale = 1 - abductProgress * 0.5;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        const grad = ctx.createRadialGradient(-orbR * 0.3, -orbR * 0.3, orbR * 0.1, 0, 0, orbR);
        grad.addColorStop(0, withAlpha(tm.color, 1));
        grad.addColorStop(1, withAlpha(tm.color, 0.6));
        ctx.beginPath();
        ctx.arc(0, 0, orbR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        if (isTarget && (phase === 'lock' || phase === 'abduct')) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#22d3ee';
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.font = `${orbR * 0.9}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tm.logo || '👤', 0, 0);
        ctx.restore();

        ctx.save();
        ctx.font = `700 ${orbR * 0.38}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(tm.name, x, y + orbR * 1.7 * scale);
        ctx.restore();
      });

      particles.update(1 / 60);
      particles.draw(ctx);

      if (flashAlpha > 0.001) {
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    function frame(now: number) {
      const elapsed = now - phaseStart;

      if (phase === 'arrive') {
        const dur = reducedMotion ? 100 : 700;
        const t = Math.min(1, elapsed / dur);
        if (t >= 1) {
          segFromX = ufoX;
          phase = reducedMotion ? 'lock' : 'scan';
          phaseStart = now;
          beamW = width * 0.09;
        }
        drawScene(now, t);
      } else if (phase === 'scan') {
        const dur = 480;
        const t = Math.min(1, elapsed / dur);
        const targetStopX = width * (scanStops[scanIdx] ?? 0.5);
        ufoX = segFromX + (targetStopX - segFromX) * easeInOutCubic(t);
        beamX = ufoX;
        if (t >= 1) {
          scanIdx++;
          segFromX = targetStopX;
          phaseStart = now;
          sound.playTick(1.1);
          if (scanIdx >= scanStops.length) {
            phase = 'lock';
            phaseStart = now;
          }
        }
        drawScene(now, t);
      } else if (phase === 'lock') {
        const dur = reducedMotion ? 80 : 500;
        const t = Math.min(1, elapsed / dur);
        ufoX = segFromX + (targetPos.x - segFromX) * easeInOutCubic(t);
        beamX = ufoX;
        beamW = width * 0.09 * (1 - t) + width * 0.14 * t;
        if (t >= 1) {
          phase = 'abduct';
          phaseStart = now;
          sound.playWhoosh(1.1);
        }
        drawScene(now, t);
      } else if (phase === 'abduct') {
        const dur = reducedMotion ? 100 : 1200;
        abductProgress = clamp(elapsed / dur, 0, 1);
        if (Math.random() < 0.5) {
          particles.spawnDust(targetPos.x, targetPos.y - abductProgress * 100, withAlpha('#22d3ee', 0.6), (rng() - 0.5) * 2, -1);
        }
        if (abductProgress >= 1) {
          phase = 'flash';
          phaseStart = now;
          flashAlpha = 0.9;
          sound.playFanfare();
          particles.burstConfetti(ufoX, height * 0.1, teams.map((tm2) => tm2.color), reducedMotion ? 20 : 100);
          setShaking(true);
          setTimeout(() => setShaking(false), 250);
        }
        drawScene(now, abductProgress);
      } else if (phase === 'flash') {
        flashAlpha = Math.max(0, flashAlpha - 0.04);
        if (elapsed > 900 && !done) {
          done = true;
          setTimeout(() => onComplete(targetTeam), 10);
        }
        drawScene(now, 1);
      }

      if (!done || particles.count > 0 || flashAlpha > 0.001) {
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
        width: 'min(90vw, 1200px)',
        height: 'min(72vh, 700px)',
        margin: '0 auto',
        borderRadius: 24,
        overflow: 'hidden',
        border: '2px solid #1a1f4a',
        boxShadow: '0 0 50px rgba(34,211,238,0.1)',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
