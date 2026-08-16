import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { clamp, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

const HORSE_EMOJIS = ['🐴', '🐎', '🦄', '🏇'];

type Phase = 'countdown' | 'racing' | 'finished';

export default function RaceAdapterV2({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [shaking, setShaking] = useState(false);

  const width = Math.min(1600, typeof window !== 'undefined' ? window.innerWidth * 0.94 : 1200);
  const laneH = clamp(
    typeof window !== 'undefined' ? (window.innerHeight * 0.74) / teams.length : 70,
    46,
    130
  );
  const height = teams.length * laneH + 24;

  const speeds = useMemo(() => {
    const rng = makeRng(seed);
    const base = 130; // px/sec baseline
    const map: Record<string, number> = {};
    for (const t of teams) {
      map[t.id] = base * (0.82 + rng() * 0.28);
    }
    map[targetTeam.id] = base * (1.08 + rng() * 0.08);
    return map;
  }, [teams, targetTeam, seed]);

  useEffect(() => {
    if (reducedMotion) {
      const t1 = setTimeout(() => setPhase('finished'), 300);
      const t2 = setTimeout(() => onComplete(targetTeam), 700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    setPhase('countdown');
    setCountdown(3);
    let cd = 3;
    const cdTimer = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd < 0) {
        clearInterval(cdTimer);
        setPhase('racing');
      }
    }, 750);
    return () => clearInterval(cdTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== 'racing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rng = makeRng(seed + 1);
    const ctx = setupHiDPICanvas(canvas, width, height);
    const particles = new ParticleSystem(rng);
    const padX = Math.max(170, width * 0.15);
    const finishMargin = Math.max(40, width * 0.03);
    const trackStart = padX;
    const trackEnd = width - padX - finishMargin;
    const trackLen = trackEnd - trackStart;

    const progress: Record<string, number> = {};
    for (const t of teams) progress[t.id] = 0;

    let rafId = 0;
    let lastTime: number | null = null;
    let winnerDeclared = false;
    let hoofAccum = 0;
    let elapsedRaceTime = 0;

    function drawTrack() {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#3d8b37');
      grad.addColorStop(1, '#1a3a16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i < teams.length; i++) {
        const y = i * laneH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // start gate
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(trackStart, 0);
      ctx.lineTo(trackStart, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // finish line (checkered)
      const fx = trackEnd;
      const checker = 10;
      for (let y = 0; y < height; y += checker) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (Math.floor(y / checker) + c) % 2 === 0 ? '#fff' : '#111';
          ctx.fillRect(fx + c * checker, y, checker, checker);
        }
      }
    }

    function frame(now: number) {
      if (lastTime === null) lastTime = now;
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsedRaceTime += rawDt;

      const maxProgress = Math.max(0, ...Object.values(progress));
      const suspenseDamp = 1 - 0.55 * clamp((maxProgress - 0.8) / 0.2, 0, 1);
      const dt = rawDt * suspenseDamp;

      drawTrack();

      hoofAccum += rawDt;
      if (hoofAccum > 0.16) {
        hoofAccum = 0;
        sound.playHoofbeat(0.9 + maxProgress * 0.4);
      }

      teams.forEach((t, idx) => {
        if (!winnerDeclared) {
          const jitter = 0.75 + rng() * 0.5;
          const rampUp = Math.min(1, elapsedRaceTime / 0.6);
          progress[t.id] = clamp(
            progress[t.id] + (speeds[t.id] * jitter * rampUp * dt) / trackLen,
            0,
            1
          );
        }
        const x = trackStart + progress[t.id] * trackLen;
        const y = idx * laneH + laneH / 2;
        const isTarget = t.id === targetTeam.id;

        if (progress[t.id] > 0.02 && progress[t.id] < 1 && Math.random() < 0.4) {
          particles.spawnDust(x - 14, y + 10, withAlpha('#e8dcc0', 0.5), -1, 0);
        }

        const bob = Math.sin(elapsedRaceTime * 14 + idx) * 2.4 * (progress[t.id] < 1 ? 1 : 0);

        ctx.save();
        ctx.translate(x, y + bob);
        if (isTarget && progress[t.id] >= 1) {
          ctx.shadowColor = t.color;
          ctx.shadowBlur = 20;
        }
        ctx.font = `${laneH * 0.62}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.scale(-1, 1);
        ctx.fillText(t.logo || HORSE_EMOJIS[idx % HORSE_EMOJIS.length], 0, 0);
        ctx.restore();

        // name tag
        ctx.save();
        const nameFontSize = Math.max(15, Math.min(26, laneH * 0.26));
        ctx.font = `800 ${nameFontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = withAlpha('#fff', 0.95);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(t.name, trackStart - 14, idx * laneH + laneH / 2);
        ctx.restore();

        if (progress[t.id] >= 1 && t.id === targetTeam.id && !winnerDeclared) {
          winnerDeclared = true;
          particles.burstConfetti(x, y, teams.map((tm) => tm.color), reducedMotion ? 0 : 100);
          particles.burstSparks(x, y, t.color, 24);
          sound.playFanfare();
          setShaking(true);
          setTimeout(() => setShaking(false), 400);
          setTimeout(() => setPhase('finished'), 900);
        }
      });

      particles.update(rawDt);
      particles.draw(ctx);

      if (!winnerDeclared || particles.count > 0) {
        rafId = requestAnimationFrame(frame);
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'finished') {
      const t = setTimeout(() => onComplete(targetTeam), 900);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete, targetTeam]);

  return (
    <div
      ref={wrapperRef}
      className={shaking ? 'v2-shake' : undefined}
      style={{
        position: 'relative',
        width,
        borderRadius: 24,
        overflow: 'hidden',
        border: '4px solid #5a4a32',
        boxShadow: '0 0 50px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.3)',
      }}
    >
      {phase === 'racing' && (
        <canvas ref={canvasRef} style={{ display: 'block', width, height }} />
      )}
      {phase !== 'racing' && (
        <div style={{ width, height, background: 'linear-gradient(180deg, #3d8b37, #1a3a16)' }} />
      )}

      {phase === 'countdown' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              fontSize: countdown > 0 ? 128 : 56,
              fontWeight: 900,
              color: countdown > 0 ? '#fbbf24' : '#22c55e',
              textShadow:
                countdown > 0
                  ? '0 0 40px rgba(251,191,36,0.6), 0 4px 8px rgba(0,0,0,0.5)'
                  : '0 0 40px rgba(34,197,94,0.6), 0 4px 8px rgba(0,0,0,0.5)',
              letterSpacing: 4,
              animation: 'countdown-pop 0.3s ease-out',
            }}
          >
            {countdown > 0 ? countdown : 'СТАРТ!'}
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="reveal-anim"
            style={{
              textAlign: 'center',
              background: 'rgba(0,0,0,0.6)',
              padding: '28px 44px',
              borderRadius: 20,
              border: '2px solid rgba(255,255,255,0.12)',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 10 }}>🏆</div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: targetTeam.color,
                textShadow: `0 0 24px ${targetTeam.color}88`,
              }}
            >
              {targetTeam.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
