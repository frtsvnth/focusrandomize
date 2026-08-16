import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { easeOutCubic, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

type Phase = 'rising' | 'arriving' | 'opening' | 'reveal';

export default function ElevatorAdapterV2({
  teams: _teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  void _teams;
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

    const targetFloor = 12 + Math.floor(rng() * 38);
    const riseDur = reducedMotion ? 200 : 2600;

    let phase: Phase = 'rising';
    let phaseStart = performance.now();
    let doorOpen = 0;
    let currentFloor = 1;
    let lastDing = 0;
    let scrollY = 0;
    let done = false;
    let rafId = 0;

    function drawShaft(now: number, elapsedRise: number) {
      ctx.clearRect(0, 0, width, height);
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#040611');
      bg.addColorStop(1, '#0a1020');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const t = Math.min(1, elapsedRise / riseDur);
      const speed = phase === 'rising' ? Math.sin(t * Math.PI) : 0;
      scrollY += speed * 46;

      // scrolling floor lines (motion blur streaks going down = feels like ascending)
      ctx.save();
      ctx.strokeStyle = withAlpha('#334155', 0.5);
      ctx.lineWidth = 2;
      const spacing = 64;
      const offset = scrollY % spacing;
      for (let y = -spacing; y < height + spacing; y += spacing) {
        const yy = y + offset;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(width, yy);
        ctx.stroke();
      }
      // side rails with motion streak
      ctx.strokeStyle = withAlpha('#22d3ee', 0.15 + speed * 0.25);
      ctx.lineWidth = 3;
      [width * 0.12, width * 0.88].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });
      ctx.restore();

      currentFloor = 1 + Math.floor(easeOutCubic(t) * (targetFloor - 1));
      if (phase === 'rising' && speed > 0.05 && now - lastDing > 90) {
        lastDing = now;
        sound.playTick(0.7 + Math.min(1, t) * 0.7);
      }

      // digital floor counter
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.min(width, height) * 0.16}px "Courier New", monospace`;
      ctx.fillStyle = withAlpha('#22d3ee', 0.9);
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = phase === 'rising' ? 24 : 10;
      const floorLabel = phase === 'rising' || phase === 'arriving' ? `${currentFloor}` : `${targetFloor}`;
      ctx.fillText(floorLabel, width / 2, height * 0.24);
      ctx.shadowBlur = 0;
      ctx.font = `700 ${Math.min(width, height) * 0.03}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = withAlpha('#94a3b8', 0.8);
      ctx.fillText('ЭТАЖ', width / 2, height * 0.24 + Math.min(width, height) * 0.06);
      ctx.restore();

      // elevator doors
      const doorTop = height * 0.42;
      const doorH = height * 0.5;
      const doorW = width * 0.62;
      const doorX = width / 2 - doorW / 2;

      // door frame glow
      ctx.save();
      ctx.strokeStyle = withAlpha('#1e293b', 1);
      ctx.lineWidth = 10;
      ctx.strokeRect(doorX - 6, doorTop - 6, doorW + 12, doorH + 12);

      // interior light spilling as doors open
      if (doorOpen > 0.02) {
        const glow = ctx.createRadialGradient(
          width / 2, doorTop + doorH / 2, 10,
          width / 2, doorTop + doorH / 2, doorW * 0.8
        );
        glow.addColorStop(0, withAlpha(targetTeam.color, 0.5 * doorOpen));
        glow.addColorStop(1, withAlpha(targetTeam.color, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(doorX - 40, doorTop - 40, doorW + 80, doorH + 80);
      }

      ctx.beginPath();
      ctx.rect(doorX, doorTop, doorW, doorH);
      ctx.clip();

      // interior
      ctx.fillStyle = '#050810';
      ctx.fillRect(doorX, doorTop, doorW, doorH);
      if (doorOpen > 0.15) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (doorOpen - 0.15) / 0.5);
        ctx.font = `${doorH * 0.32}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(targetTeam.logo || '🙋', width / 2, doorTop + doorH * 0.4);
        ctx.font = `900 ${doorH * 0.13}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = targetTeam.color;
        ctx.shadowColor = targetTeam.color;
        ctx.shadowBlur = 20;
        const label = targetTeam.name.length > 16 ? targetTeam.name.slice(0, 15) + '…' : targetTeam.name;
        ctx.fillText(label, width / 2, doorTop + doorH * 0.72);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // door panels
      const panelW = doorW / 2 * (1 - doorOpen);
      const doorGrad = ctx.createLinearGradient(doorX, 0, doorX + doorW / 2, 0);
      doorGrad.addColorStop(0, '#1e293b');
      doorGrad.addColorStop(1, '#334155');
      ctx.fillStyle = doorGrad;
      ctx.fillRect(doorX, doorTop, panelW, doorH);
      ctx.fillRect(doorX + doorW - panelW, doorTop, panelW, doorH);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(doorX, doorTop, panelW, doorH);
      ctx.strokeRect(doorX + doorW - panelW, doorTop, panelW, doorH);

      ctx.restore();

      particles.update(1 / 60);
      particles.draw(ctx);
    }

    function frame(now: number) {
      const elapsed = now - phaseStart;

      if (phase === 'rising') {
        if (elapsed >= riseDur) {
          phase = 'arriving';
          phaseStart = now;
          sound.playTick(1.6);
          sound.playTick(1.2);
        }
      } else if (phase === 'arriving') {
        if (elapsed >= (reducedMotion ? 50 : 350)) {
          phase = 'opening';
          phaseStart = now;
          sound.playWhoosh(0.7);
        }
      } else if (phase === 'opening') {
        const openDur = reducedMotion ? 100 : 900;
        doorOpen = Math.min(1, elapsed / openDur);
        if (doorOpen >= 1) {
          phase = 'reveal';
          phaseStart = now;
          sound.playFanfare();
          particles.burstConfetti(width / 2, height * 0.55, [targetTeam.color, '#fff'], reducedMotion ? 20 : 90);
          setShaking(true);
          setTimeout(() => setShaking(false), 250);
        }
      } else if (phase === 'reveal' && !done) {
        if (elapsed >= (reducedMotion ? 150 : 1400)) {
          done = true;
          setTimeout(() => onComplete(targetTeam), 10);
        }
      }

      drawShaft(now, phase === 'rising' ? elapsed : riseDur);

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
        width: 'min(70vw, 800px)',
        height: 'min(80vh, 820px)',
        margin: '0 auto',
        borderRadius: 24,
        overflow: 'hidden',
        border: '2px solid #1e293b',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.1)',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
