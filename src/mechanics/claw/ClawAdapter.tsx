import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

const DIAM = 80;
const CW = 660;
const CH = 440;

function overlap(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = (x1 / 100) * CW - (x2 / 100) * CW;
  const dy = (y1 / 100) * CH - (y2 / 100) * CH;
  return Math.hypot(dx, dy) < DIAM + 4;
}

export default function ClawAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [phase, setPhase] = useState<'move' | 'drop' | 'grab' | 'lift'>('move');
  const [pos, setPos] = useState({ x: 50, y: 8 });

  const rand = useMemo(() => mulberry32(seed), [seed]);

  const teamPositions = useMemo(() => {
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < teams.length; i++) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const x = 8 + rand() * 84;
        const y = 20 + rand() * 60;
        const ok = positions.every((p) => !overlap(x, y, p.x, p.y));
        if (ok) {
          positions.push({ x, y });
          break;
        }
        if (attempt === 99) {
          positions.push({ x, y });
        }
      }
    }
    return positions;
  }, [rand, teams.length]);

  const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
  const targetPos = teamPositions[targetIdx];

  const wiggles = useMemo(() => {
    const arr: { x: number; y: number; t: number }[] = [];
    for (let i = 0; i < 5; i++) {
      arr.push({
        x: 8 + rand() * 84,
        y: 8 + rand() * 50,
        t: 350 + rand() * 450,
      });
    }
    return arr;
  }, [rand]);

  useEffect(() => {
    if (reducedMotion) {
      setPos({ x: targetPos.x, y: targetPos.y });
      setPhase('grab');
      const to = setTimeout(onComplete, 500);
      return () => clearTimeout(to);
    }

    let i = 0;
    setPhase('move');

    const run = () => {
      if (i < wiggles.length) {
        setPos({ x: wiggles[i].x, y: wiggles[i].y });
        i++;
        setTimeout(run, wiggles[i - 1].t);
      } else {
        setPos({ x: targetPos.x, y: targetPos.y });
        setTimeout(() => {
          setPhase('drop');
          setTimeout(() => {
            setPhase('grab');
            setTimeout(() => {
              setPhase('lift');
              setPos((p) => ({ ...p, y: 8 }));
              setTimeout(onComplete, 900);
            }, 500);
          }, 700);
        }, 700);
      }
    };

    const start = setTimeout(run, 200);
    return () => clearTimeout(start);
  }, [wiggles, targetPos, reducedMotion, onComplete]);

  const cableHeight = Math.max(0, pos.y * 4.4 - 27);

  const transition = reducedMotion
    ? 'none'
    : 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div
      style={{
        position: 'relative',
        width: 'min(85vw, 660px)',
        height: 440,
        margin: '0 auto',
        background: 'linear-gradient(180deg, #0a101e, #060a14)',
        borderRadius: 22,
        border: '2px solid #1e293b',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5), 0 0 30px rgba(34,211,238,0.08)',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        pointerEvents: 'none',
      }} />

      {teams.map((t, idx) => {
        const { x, y } = teamPositions[idx];
        const hidden = t.id === targetTeam.id && (phase === 'grab' || phase === 'lift');
        return (
          <div
            key={t.id}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${t.color}dd, ${t.color}55)`,
              boxShadow: `0 6px 20px ${t.color}44, inset 0 -6px 12px rgba(0,0,0,0.35)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              opacity: hidden ? 0 : 1,
              transition: hidden ? 'none' : 'opacity 0.35s',
              border: '2px solid rgba(255,255,255,0.12)',
              textAlign: 'center',
              padding: 4,
              lineHeight: 1.2,
              zIndex: hidden ? 0 : 2,
            }}
          >
            {t.logo && <span style={{ fontSize: 20 }}>{t.logo}</span>}
            {t.name}
          </div>
        );
      })}

      <div style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: 0,
        width: 3,
        height: `${cableHeight}px`,
        background: 'linear-gradient(180deg, #64748b, #94a3b8)',
        transform: 'translateX(-50%)',
        borderRadius: 2,
        zIndex: 5,
        transition: reducedMotion
          ? 'none'
          : 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1), left 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />

      <div
        style={{
          position: 'absolute',
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: 'translate(-50%, -50%)',
          transition,
          zIndex: 10,
        }}
      >
        {(phase === 'grab' || phase === 'lift') && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${targetTeam.color}dd, ${targetTeam.color}55)`,
              boxShadow: `0 6px 20px ${targetTeam.color}44, inset 0 -6px 12px rgba(0,0,0,0.35)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#fff',
              fontWeight: 800,
              fontSize: 12,
              border: '2px solid rgba(255,255,255,0.12)',
              textAlign: 'center',
              padding: 4,
              lineHeight: 1.2,
              zIndex: -1,
            }}
          >
            {targetTeam.logo && <span style={{ fontSize: 18 }}>{targetTeam.logo}</span>}
            {targetTeam.name}
          </div>
        )}
        <div style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #e2e8f0, #94a3b8)',
          border: '3px solid #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: -2 }}>
          {[0, 1, 2].map((fi) => (
            <div
              key={fi}
              style={{
                width: 7,
                height: 26,
                background: 'linear-gradient(180deg, #94a3b8, #64748b)',
                borderRadius: 4,
                transform: phase === 'grab' || phase === 'lift'
                  ? `rotate(${fi === 1 ? 0 : fi === 0 ? -25 : 25}deg)`
                  : 'rotate(0deg)',
                transition: 'transform 0.4s',
                transformOrigin: 'top center',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
