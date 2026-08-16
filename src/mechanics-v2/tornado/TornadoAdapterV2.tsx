import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { ScreenShake, easeOutBack, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

interface Debris {
  angle: number;
  radius: number;
  height: number;
  speed: number;
  size: number;
  color: string;
}

type OrbState = 'orbit' | 'sucking' | 'ejected' | 'launching' | 'gone';

export default function TornadoAdapterV2({
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
    const shake = new ScreenShake();
    const cx = width / 2;
    const cy = height * 0.52;
    const funnelTopY = height * 0.06;
    const funnelBaseY = height * 0.92;

    const debris: Debris[] = Array.from({ length: 60 }, () => ({
      angle: rng() * Math.PI * 2,
      radius: 10 + rng() * (width * 0.28),
      height: rng(),
      speed: 2.5 + rng() * 3,
      size: 1.5 + rng() * 3,
      color: ['#94a3b8', '#cbd5e1', '#64748b'][Math.floor(rng() * 3)],
    }));

    const orbs = teams.map((t, i) => ({
      team: t,
      angle: (i / teams.length) * Math.PI * 2,
      radius: width * 0.32 + (rng() - 0.5) * width * 0.05,
      speed: 0.35 + rng() * 0.15,
      state: 'orbit' as OrbState,
      progress: 0,
      ejectAngle: 0,
    }));

    const nonTargetOrder = orbs.filter((o) => o.team.id !== targetTeam.id);
    const targetOrb = orbs.find((o) => o.team.id === targetTeam.id)!;

    let elapsed = 0;
    let ejectIdx = 0;
    let nextEjectAt = reducedMotion ? 50 : 900;
    let launching = false;
    let launchStart = 0;
    let lastWind = -10;
    let done = false;
    let rafId = 0;
    let lastTime: number | null = null;

    function funnelRadiusAt(hNorm: number) {
      // wider at top, narrow at bottom (classic funnel), hNorm 0=top 1=base
      return width * 0.02 + Math.pow(hNorm, 1.4) * width * 0.22;
    }

    function drawFunnel(now: number) {
      const rot = now / 90;
      for (let layer = 0; layer < 26; layer++) {
        const hNorm = layer / 25;
        const y = funnelTopY + hNorm * (funnelBaseY - funnelTopY);
        const r = funnelRadiusAt(hNorm);
        const wobble = Math.sin(rot * 0.3 + layer * 0.7) * r * 0.08;
        ctx.save();
        ctx.translate(cx + wobble, y);
        ctx.scale(1, 0.32);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, withAlpha('#3a3f55', 0.05 + hNorm * 0.1));
        grad.addColorStop(1, withAlpha('#3a3f55', 0));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r, rot * 0.02 + layer, rot * 0.02 + layer + Math.PI * 1.4);
        ctx.strokeStyle = withAlpha('#94a3b8', 0.12 + hNorm * 0.1);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    function frame(now: number) {
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
      lastTime = now;
      elapsed += dt * 1000;
      shake.update(dt);

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      const off = shake.offset(8);
      ctx.translate(off.x, off.y);

      const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, width * 0.6);
      bg.addColorStop(0, '#0d1424');
      bg.addColorStop(1, '#050810');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      drawFunnel(now);

      // debris swirl
      for (const d of debris) {
        d.angle += d.speed * dt * (0.4 + (1 - d.height) * 1.6);
        d.height -= dt * 0.12;
        if (d.height < 0) {
          d.height = 1;
          d.radius = 10 + rng() * (width * 0.28);
        }
        const y = funnelTopY + d.height * (funnelBaseY - funnelTopY);
        const r = funnelRadiusAt(d.height) + d.radius * 0.15;
        const x = cx + Math.cos(d.angle) * r;
        const yy = y + Math.sin(d.angle) * r * 0.32;
        ctx.beginPath();
        ctx.arc(x, yy, d.size, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(d.color, 0.5);
        ctx.fill();
      }

      // orbiting team orbs
      const orbR = Math.min(width, height) * 0.045;
      for (const o of orbs) {
        if (o.state === 'gone') continue;
        o.angle += o.speed * dt;

        let x = cx + Math.cos(o.angle) * o.radius;
        let y = cy + Math.sin(o.angle) * o.radius * 0.4;
        let scale = 1;
        let alpha = 1;

        if (o.state === 'sucking') {
          o.progress = Math.min(1, o.progress + dt * (reducedMotion ? 6 : 1.6));
          const r2 = o.radius * (1 - o.progress);
          x = cx + Math.cos(o.angle) * r2;
          y = cy + Math.sin(o.angle) * r2 * 0.4;
          scale = 1 - o.progress * 0.8;
          if (o.progress >= 1) {
            o.state = 'ejected';
            o.progress = 0;
            particles.burstSparks(cx, cy, o.team.color, reducedMotion ? 0 : 20);
            sound.playWhoosh(0.35);
            shake.addTrauma(0.3);
            setShaking(true);
            setTimeout(() => setShaking(false), 200);
          }
        } else if (o.state === 'ejected') {
          o.progress = Math.min(1, o.progress + dt * 2.2);
          const dist = o.progress * width * 0.9;
          x = cx + Math.cos(o.ejectAngle) * dist;
          y = cy + Math.sin(o.ejectAngle) * dist * 0.5;
          alpha = 1 - o.progress;
          if (o.progress >= 1) o.state = 'gone';
        } else if (o.state === 'launching') {
          o.progress = Math.min(1, o.progress + dt * (reducedMotion ? 5 : 0.85));
          const eased = easeOutBack(o.progress);
          const finalY = height * 0.17;
          x = cx;
          y = cy - eased * (cy - finalY);
          scale = 1 + eased * 1.5;
          if (o.progress >= 1 && !done) {
            done = true;
            sound.playFanfare();
            particles.burstConfetti(cx, finalY, teams.map((t) => t.color), reducedMotion ? 20 : 110);
            shake.addTrauma(0.4);
            setTimeout(() => onComplete(targetTeam), reducedMotion ? 100 : 900);
          }
        }

        if (alpha <= 0.01) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        const grad = ctx.createRadialGradient(-orbR * 0.3, -orbR * 0.3, orbR * 0.1, 0, 0, orbR);
        grad.addColorStop(0, withAlpha(o.team.color, 1));
        grad.addColorStop(1, withAlpha(o.team.color, 0.6));
        ctx.beginPath();
        ctx.arc(0, 0, orbR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        if (o.team.id === targetTeam.id) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fbbf24';
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.font = `700 ${orbR * 0.42}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 3;
        const label = o.team.name.length > 10 ? o.team.name.slice(0, 9) + '…' : o.team.name;
        ctx.fillText(label, 0, orbR * 1.5);
        if (o.team.logo) ctx.fillText(o.team.logo, 0, 0);
        ctx.restore();
      }

      particles.update(dt);
      particles.draw(ctx);
      ctx.restore();

      if (now - lastWind > 1500) {
        lastWind = now;
        if (!reducedMotion) sound.playWhoosh(1.3);
      }

      // schedule ejections
      if (!launching && ejectIdx < nonTargetOrder.length && elapsed >= nextEjectAt) {
        const o = nonTargetOrder[ejectIdx];
        o.state = 'sucking';
        o.progress = 0;
        o.ejectAngle = rng() * Math.PI * 2;
        ejectIdx++;
        nextEjectAt = elapsed + (reducedMotion ? 40 : 550 + rng() * 250);
        if (ejectIdx >= nonTargetOrder.length) {
          launching = true;
          launchStart = elapsed + (reducedMotion ? 60 : 700);
        }
      }
      if (launching && targetOrb.state === 'orbit' && elapsed >= launchStart) {
        targetOrb.state = 'launching';
        targetOrb.progress = 0;
      }

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
        width: 'min(80vw, 900px)',
        height: 'min(84vh, 850px)',
        margin: '0 auto',
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
