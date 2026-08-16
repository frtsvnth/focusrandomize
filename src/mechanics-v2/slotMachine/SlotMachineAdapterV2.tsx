import { useEffect, useMemo, useRef, useState } from 'react';
import type { Team } from '../../domain/types';
import type { MechanicAdapterV2Props } from '../adapter';
import { ParticleSystem } from '../engine/particles';
import { easeOutBack, makeRng, setupHiDPICanvas, withAlpha } from '../engine/canvasUtils';

const VISIBLE_ROWS = 3;
const REEL_COUNT = 3;

const SYMBOL_SET = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣', '🍀', '🍉', '🍊', '🥝', '🍓', '🍌', '🎲', '🎯', '🃏'];

function assignSymbols(teams: Team[]): Record<string, string> {
  const used = new Set<string>();
  const map: Record<string, string> = {};
  teams.forEach((t) => {
    if (t.logo) {
      map[t.id] = t.logo;
      used.add(t.logo);
    }
  });
  const pool = SYMBOL_SET.filter((s) => !used.has(s));
  let i = 0;
  teams.forEach((t) => {
    if (map[t.id]) return;
    map[t.id] = pool[i % pool.length];
    i++;
  });
  return map;
}

export default function SlotMachineAdapterV2({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shaking, setShaking] = useState(false);
  const [jackpot, setJackpot] = useState(false);

  const symbolMap = useMemo(() => assignSymbols(teams), [teams]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const reelGap = width * 0.018;
    const reelW = (width - reelGap * (REEL_COUNT - 1)) / REEL_COUNT;
    const symbolH = height / VISIBLE_ROWS;

    const rng = makeRng(seed);
    const ctx = setupHiDPICanvas(canvas, width, height);
    const n = teams.length;
    const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
    const particles = new ParticleSystem(rng);

    const baseLoops = reducedMotion ? 1 : 5;
    const reelRowsTotal = [0, 1, 2].map((i) => (baseLoops + i * 2) * n + targetIdx);
    const reelDuration = [0, 1, 2].map((i) => (reducedMotion ? 350 + i * 60 : 2400 + i * 850));

    if (!reducedMotion) sound.playWhoosh(1.1);

    let rafId = 0;
    let startTime: number | null = null;
    const landed = [false, false, false];
    let allLanded = false;

    function drawSymbol(x: number, y: number, team: Team, highlight: boolean) {
      ctx.save();
      ctx.translate(x + reelW / 2, y + symbolH / 2);
      const r = symbolH * 0.36;
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
      grad.addColorStop(0, withAlpha(team.color, 1));
      grad.addColorStop(1, withAlpha(team.color, 0.65));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      if (highlight) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.shadowColor = team.color;
        ctx.shadowBlur = 16;
        ctx.stroke();
      }
      ctx.font = `${r * 1.15}px Inter, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.fillText(symbolMap[team.id] ?? '❓', 0, 0);
      ctx.restore();
    }

    function drawReel(reelIndex: number, scrollRows: number, isFinal: boolean) {
      const x = reelIndex * (reelW + reelGap);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, 0, reelW, height);
      ctx.clip();

      ctx.fillStyle = '#0b1221';
      ctx.fillRect(x, 0, reelW, height);

      const centerRow = Math.round(scrollRows);
      for (let r = centerRow - 3; r <= centerRow + 3; r++) {
        const y = height / 2 + (r - scrollRows) * symbolH - symbolH / 2;
        if (y < -symbolH || y > height) continue;
        const idx = ((r % n) + n) % n;
        const isCenter = isFinal && r === centerRow;
        drawSymbol(x, y, teams[idx], isCenter);
      }

      const shade = ctx.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, 'rgba(0,0,0,0.55)');
      shade.addColorStop(0.28, 'rgba(0,0,0,0)');
      shade.addColorStop(0.72, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = shade;
      ctx.fillRect(x, 0, reelW, height);

      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, 0, reelW, height);
    }

    function frame(now: number) {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < REEL_COUNT; i++) {
        const t = Math.min(1, elapsed / reelDuration[i]);
        const eased = easeOutBack(t);
        const scrollRows = reelRowsTotal[i] * eased;
        drawReel(i, scrollRows, t >= 1);

        if (t >= 1 && !landed[i]) {
          landed[i] = true;
          sound.playClunk(1 + i * 0.09);
          particles.burstSparks(
            i * (reelW + reelGap) + reelW / 2,
            height / 2,
            targetTeam.color,
            reducedMotion ? 0 : 14
          );
          setShaking(true);
          setTimeout(() => setShaking(false), 260);
        }
      }

      // center payline
      ctx.save();
      ctx.strokeStyle = withAlpha('#fbbf24', 0.55);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2 - symbolH / 2);
      ctx.lineTo(width, height / 2 - symbolH / 2);
      ctx.moveTo(0, height / 2 + symbolH / 2);
      ctx.lineTo(width, height / 2 + symbolH / 2);
      ctx.stroke();
      ctx.restore();

      particles.update(1 / 60);
      particles.draw(ctx);

      if (landed.every(Boolean) && !allLanded) {
        allLanded = true;
        setJackpot(true);
        sound.playFanfare();
        particles.burstConfetti(width / 2, -10, teams.map((t) => t.color), reducedMotion ? 20 : 110);
        setShaking(true);
        setTimeout(() => setShaking(false), 420);
        const completeAt = reducedMotion ? 150 : 1000;
        setTimeout(() => onComplete(targetTeam), completeAt);
      }

      if (!allLanded || particles.count > 0) {
        rafId = requestAnimationFrame(frame);
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: '92vw' }}>
      <div
        className={shaking ? 'v2-shake' : undefined}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          width: 'min(80vw, 1100px)',
          padding: 22,
          borderRadius: 26,
          background: 'linear-gradient(180deg, #1e293b, #0b1221)',
          border: `3px solid ${jackpot ? '#fbbf24' : '#334155'}`,
          boxShadow: jackpot
            ? '0 0 60px rgba(251,191,36,0.45), inset 0 0 30px rgba(0,0,0,0.5)'
            : '0 0 40px rgba(34,211,238,0.12), inset 0 0 30px rgba(0,0,0,0.5)',
          transition: 'border-color 0.3s, box-shadow 0.3s',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 2,
            color: jackpot ? '#fbbf24' : 'var(--text-dim)',
            textTransform: 'uppercase',
          }}
        >
          {jackpot ? '🎉 Джекпот!' : 'Кручу барабаны…'}
        </div>
        <div ref={stageRef} style={{ width: '100%', height: 'min(56vh, 700px)' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', borderRadius: 12 }} />
        </div>
      </div>

      {/* Legend: which symbol stands for which team */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          maxWidth: 'min(80vw, 1100px)',
          padding: '10px 16px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center', marginRight: 4 }}>
          Легенда:
        </span>
        {teams.map((t) => (
          <span
            key={t.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: withAlpha(t.color, 0.16),
              border: `1px solid ${withAlpha(t.color, 0.4)}`,
              fontSize: 13,
              color: 'var(--text)',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 16 }}>{symbolMap[t.id]}</span>
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}
