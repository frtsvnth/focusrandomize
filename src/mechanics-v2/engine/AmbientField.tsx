import { useEffect, useRef } from 'react';
import { makeRng, setupHiDPICanvas } from './canvasUtils';

interface Orb {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: 'accent' | 'purple' | 'pink';
  phase: number;
}

/** Slow drifting bokeh field behind the V2 stage. Reads theme colors from CSS variables so it adapts to every theme automatically. */
export default function AmbientField({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rng = makeRng(42);
    let width = window.innerWidth;
    let height = window.innerHeight;
    let ctx = setupHiDPICanvas(canvas, width, height);

    const styles = getComputedStyle(document.documentElement);
    const colors = {
      accent: styles.getPropertyValue('--accent').trim() || '#22d3ee',
      purple: styles.getPropertyValue('--purple').trim() || '#a78bfa',
      pink: styles.getPropertyValue('--pink').trim() || '#f472b6',
    };

    const orbs: Orb[] = Array.from({ length: 16 }, () => ({
      x: rng() * width,
      y: rng() * height,
      r: 60 + rng() * 160,
      vx: (rng() - 0.5) * 8,
      vy: (rng() - 0.5) * 8,
      hue: (['accent', 'purple', 'pink'] as const)[Math.floor(rng() * 3)],
      phase: rng() * Math.PI * 2,
    }));

    let rafId = 0;
    let last = 0;
    let t = 0;

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      ctx = setupHiDPICanvas(canvas!, width, height);
    }
    window.addEventListener('resize', onResize);

    function frame(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      t += dt;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (const o of orbs) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.x < -o.r) o.x = width + o.r;
        if (o.x > width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = height + o.r;
        if (o.y > height + o.r) o.y = -o.r;
        const pulse = 0.55 + Math.sin(t * 0.5 + o.phase) * 0.15;
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grad.addColorStop(0, hexToRgba(colors[o.hue], 0.14 * pulse));
        grad.addColorStop(1, hexToRgba(colors[o.hue], 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (!reducedMotion) rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full || '22d3ee', 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
