import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { ScreenShake, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export default function DiceRollAdapterV2({
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

  const size = 'min(50vh, 50vw, 480px)';

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const rng = makeRng(seed);
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const ctx = setupHiDPICanvas(canvas, width, height);
    const groundY = height * 0.78;
    const cx = width / 2;
    const dieSize = Math.min(width, height) * 0.34;
    const particles = new ParticleSystem(rng);
    const shake = new ScreenShake();

    const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
    const winnerFace = (targetIdx % 6) + 1;

    const bounces = reducedMotion
      ? [{ amp: 10, dur: 150 }]
      : [
          { amp: height * 0.42, dur: 620 },
          { amp: height * 0.17, dur: 380 },
          { amp: height * 0.07, dur: 250 },
          { amp: height * 0.02, dur: 160 },
        ];
    const totalBounces = bounces.length;

    let rafId = 0;
    let startTime: number | null = null;
    let currentBounce = 0;
    let bounceStart = 0;
    let landed = false;
    let flipTimer = 0;
    let flipFace = 1 + Math.floor(rng() * 6);
    let settled = false;

    function drawDie(x: number, y: number, squashX: number, squashY: number, face: number, glow: boolean) {
      const idx = (face - 1) % teams.length;
      const team = teams[idx];
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(squashX, squashY);

      const r = dieSize * 0.22;
      const half = dieSize / 2;
      ctx.beginPath();
      ctx.moveTo(-half + r, -half);
      ctx.arcTo(half, -half, half, half, r);
      ctx.arcTo(half, half, -half, half, r);
      ctx.arcTo(-half, half, -half, -half, r);
      ctx.arcTo(-half, -half, half, -half, r);
      ctx.closePath();

      const grad = ctx.createLinearGradient(-half, -half, half, half);
      grad.addColorStop(0, withAlpha(team.color, 1));
      grad.addColorStop(1, withAlpha(team.color, 0.68));
      ctx.fillStyle = grad;
      if (glow) {
        ctx.shadowColor = team.color;
        ctx.shadowBlur = 50;
      }
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // gloss highlight
      const glossGrad = ctx.createLinearGradient(-half, -half, -half * 0.2, -half * 0.2);
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glossGrad;
      ctx.fill();

      // pips
      const pipR = dieSize * 0.05;
      const pipOffset = dieSize * 0.24;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [px, py] of PIP_LAYOUTS[face]) {
        ctx.beginPath();
        ctx.arc(px * pipOffset, py * pipOffset - dieSize * 0.02, pipR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // label below
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${dieSize * 0.11}px Inter, system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6;
      const label = team.name.length > 14 ? team.name.slice(0, 13) + '…' : team.name;
      ctx.fillText((team.logo ? team.logo + ' ' : '') + label, x, y + half * squashY + dieSize * 0.14);
      ctx.restore();
    }

    function frame(now: number) {
      if (startTime === null) startTime = now;
      const dt = Math.min(0.05, 1 / 60);
      shake.update(dt);

      ctx.clearRect(0, 0, width, height);

      // ground shadow
      const bounce = bounces[Math.min(currentBounce, totalBounces - 1)];
      const bt = Math.min(1, (now - bounceStart) / bounce.dur);
      const arc = Math.sin(bt * Math.PI);
      const h = bounce.amp * arc;
      const shadowScale = 1 - (h / (bounces[0].amp || 1)) * 0.6;

      ctx.save();
      ctx.translate(shake.offset(10).x, shake.offset(10).y);

      ctx.beginPath();
      ctx.ellipse(cx, groundY, dieSize * 0.42 * shadowScale, dieSize * 0.12 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.filter = 'blur(4px)';
      ctx.fill();
      ctx.filter = 'none';

      const y = groundY - dieSize * 0.35 - h;
      const impactT = bt > 0.92 ? (bt - 0.92) / 0.08 : bt < 0.08 ? 1 - bt / 0.08 : 0;
      const squashX = 1 + impactT * 0.22;
      const squashY = 1 - impactT * 0.28;

      // face flipping during tumble
      flipTimer += dt;
      const tumbling = currentBounce === 0 && !reducedMotion;
      const displayFace = tumbling ? flipFace : winnerFace;
      if (tumbling && flipTimer > 0.07) {
        flipTimer = 0;
        flipFace = 1 + Math.floor(rng() * 6);
        sound.playTick(0.7 + rng() * 0.4);
      }

      drawDie(cx, y, squashX, squashY, displayFace, settled);

      particles.update(dt);
      particles.draw(ctx);
      ctx.restore();

      if (bt >= 1) {
        if (!landed) {
          landed = true;
          const pitch = 1.3 - currentBounce * 0.15;
          sound.playClunk(pitch);
          particles.spawnDust(cx - dieSize * 0.2, groundY, 'rgba(200,200,200,0.5)', -1, -0.3);
          particles.spawnDust(cx + dieSize * 0.2, groundY, 'rgba(200,200,200,0.5)', 1, -0.3);
          shake.addTrauma(0.25 + (totalBounces - currentBounce) * 0.05);
          setShaking(true);
          setTimeout(() => setShaking(false), 200);
        }
        if (currentBounce < totalBounces - 1) {
          currentBounce++;
          bounceStart = now;
          landed = false;
        } else if (!settled) {
          settled = true;
          sound.playFanfare();
          particles.burstConfetti(cx, y, teams.map((t) => t.color), reducedMotion ? 20 : 90);
          shake.addTrauma(0.3);
          const completeAt = reducedMotion ? 150 : 950;
          setTimeout(() => onComplete(targetTeam), completeAt);
        }
      }

      if (!settled || particles.count > 0) {
        rafId = requestAnimationFrame(frame);
      }
    }

    bounceStart = performance.now();
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
        width: size,
        height: size,
        margin: '0 auto',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
