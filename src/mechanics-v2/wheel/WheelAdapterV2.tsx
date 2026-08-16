import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { easeOutQuint, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

export default function WheelAdapterV2({
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
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const rng = makeRng(seed);
    const size = wrapper.clientWidth;
    const ctx = setupHiDPICanvas(canvas, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - size * 0.045;

    const sectorAngle = 360 / teams.length;
    const idx = teams.findIndex((t) => t.id === targetTeam.id);
    const centerOfTarget = idx * sectorAngle + sectorAngle / 2;
    const base = 270 - centerOfTarget;
    const extraSpins = 6 + (seed % 4);
    const jitter = ((seed % 97) / 97 - 0.5) * (sectorAngle * 0.55);
    const targetRotationDeg = extraSpins * 360 + base + jitter;

    const duration = reducedMotion ? 550 : 5200 + (seed % 700);
    const particles = new ParticleSystem(rng);
    const colors = teams.map((t) => t.color);

    let rafId = 0;
    let startTime: number | null = null;
    let lastTickSector = -1;
    let landed = false;
    let lastFrameTime = 0;

    const wobbleStart = 0.86;

    function rotationAt(t: number) {
      const eased = easeOutQuint(t);
      let deg = targetRotationDeg * eased;
      if (t > wobbleStart) {
        const local = (t - wobbleStart) / (1 - wobbleStart);
        const decay = 1 - local;
        const wobble = Math.sin(local * Math.PI * 3.4) * decay * decay * 6.5;
        deg += wobble;
      }
      return deg;
    }

    function drawWheel(rotationDeg: number, hubGlow: number) {
      ctx.clearRect(0, 0, size, size);

      // outer metallic rim
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.08);
      rimGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
      rimGrad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
      rimGrad.addColorStop(0.7, 'rgba(0,0,0,0.35)');
      rimGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
      ctx.fillStyle = rimGrad;
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rotationDeg * Math.PI) / 180);

      for (let i = 0; i < teams.length; i++) {
        const t = teams[i];
        const start = (i * sectorAngle * Math.PI) / 180;
        const end = ((i + 1) * sectorAngle * Math.PI) / 180;
        const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
        grad.addColorStop(0, withAlpha(t.color, 0.98));
        grad.addColorStop(0.75, withAlpha(t.color, 0.85));
        grad.addColorStop(1, withAlpha(t.color, 0.55));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = Math.max(1, size * 0.003);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();

        // label — always kept upright and readable, based on its actual screen-space
        // angle (sector angle + the wheel's current spin), not just its position in the sector list
        const mid = start + (end - start) / 2;
        const screenAngle = mid + (rotationDeg * Math.PI) / 180;
        const normalizedScreenAngle = (((screenAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        const flip = normalizedScreenAngle > Math.PI / 2 && normalizedScreenAngle < (3 * Math.PI) / 2;
        ctx.save();
        ctx.rotate(mid);
        if (flip) ctx.rotate(Math.PI);
        ctx.textAlign = flip ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${Math.max(11, size * 0.032)}px Inter, system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 6;
        const label = t.name.length > 16 ? t.name.slice(0, 15) + '…' : t.name;
        ctx.fillText(label, flip ? -radius * 0.9 : radius * 0.9, 0);
        ctx.restore();
      }

      // inner rings
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, size * 0.004);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.stroke();

      ctx.restore();

      // hub
      const hubR = radius * 0.14;
      const hubGrad = ctx.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.3, hubR * 0.1, cx, cy, hubR);
      hubGrad.addColorStop(0, '#ffffff');
      hubGrad.addColorStop(0.35, '#cbd5e1');
      hubGrad.addColorStop(1, '#0f172a');
      ctx.beginPath();
      ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
      ctx.fillStyle = hubGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();

      if (hubGlow > 0) {
        ctx.save();
        ctx.globalAlpha = hubGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, hubR * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(targetTeam.color, 0.6);
        ctx.filter = 'blur(6px)';
        ctx.fill();
        ctx.restore();
      }

      particles.draw(ctx);
    }

    function frame(now: number) {
      if (startTime === null) startTime = now;
      const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
      lastFrameTime = now;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const rotationDeg = rotationAt(t);

      // ticking sound as pointer crosses sector boundaries
      const normalized = ((-rotationDeg % 360) + 360) % 360;
      const currentSector = Math.floor(((normalized + sectorAngle / 2) % 360) / sectorAngle);
      if (currentSector !== lastTickSector && t < 0.97) {
        lastTickSector = currentSector;
        const speedFactor = Math.max(0.3, 1 - t);
        sound.playTick(0.85 + speedFactor * 0.6);
      }

      particles.update(dt);
      const hubGlow = t >= 1 ? 1 : 0;
      drawWheel(rotationDeg, hubGlow * 0.7);

      if (t >= 1) {
        if (!landed) {
          landed = true;
          particles.burstConfetti(cx, size * 0.06, colors, reducedMotion ? 20 : 100);
          particles.burstSparks(cx, cy, targetTeam.color, reducedMotion ? 0 : 30);
          sound.playFanfare();
          setShaking(true);
          setFlash(1);
          setTimeout(() => setShaking(false), 420);
          const completeAt = reducedMotion ? 120 : 900;
          setTimeout(() => onComplete(targetTeam), completeAt);
        }
        if (particles.count > 0) {
          rafId = requestAnimationFrame(frame);
        }
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flash <= 0) return;
    const id = setTimeout(() => setFlash(0), 260);
    return () => clearTimeout(id);
  }, [flash]);

  return (
    <div
      ref={wrapperRef}
      className={shaking ? 'v2-shake' : undefined}
      style={{
        position: 'relative',
        width: 'min(84vh, 84vw)',
        height: 'min(84vh, 84vw)',
        margin: '0 auto',
        filter: `drop-shadow(0 0 50px ${withAlpha(targetTeam.color, 0.25)})`,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          top: '-4%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '18px solid transparent',
          borderRight: '18px solid transparent',
          borderTop: '30px solid #fff',
          filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.65))',
          zIndex: 2,
        }}
      />
      {flash > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: '-30%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha(targetTeam.color, 0.55)} 0%, transparent 70%)`,
            pointerEvents: 'none',
            opacity: flash,
            transition: 'opacity 0.26s ease-out',
          }}
        />
      )}
    </div>
  );
}
