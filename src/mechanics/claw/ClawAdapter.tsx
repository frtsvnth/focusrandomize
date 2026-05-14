import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

export default function ClawAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [phase, setPhase] = useState<'move' | 'drop' | 'grab' | 'lift'>('move');
  const [pos, setPos] = useState({ x: 50, y: 8 });

  const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
  const cols = Math.min(teams.length, 4);
  const rows = Math.ceil(teams.length / cols);

  const targetCol = targetIdx % cols;
  const targetRow = Math.floor(targetIdx / cols);

  const rand = useMemo(() => mulberry32(seed), [seed]);

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
      const left = (targetCol / (cols - 1 || 1)) * 88 + 6;
      const top = (targetRow / (rows - 1 || 1)) * 55 + 22;
      setPos({ x: left, y: top });
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
        const left = (targetCol / (cols - 1 || 1)) * 88 + 6;
        const top = (targetRow / (rows - 1 || 1)) * 55 + 22;
        setPos({ x: left, y: top });
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
  }, [wiggles, targetCol, targetRow, cols, rows, reducedMotion, onComplete]);

  const cellW = 88 / (cols - 1 || 1);
  const cellH = 55 / (rows - 1 || 1);

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
      {/* Grid floor */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        pointerEvents: 'none',
      }} />

      {/* Prizes */}
      {teams.map((t, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const left = c * cellW + 6;
        const top = r * cellH + 22;
        const grabbed = phase === 'grab' && t.id === targetTeam.id;
        return (
          <div
            key={t.id}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
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
              opacity: grabbed ? 0 : 1,
              transition: 'opacity 0.35s',
              border: '2px solid rgba(255,255,255,0.12)',
              textAlign: 'center',
              padding: 4,
              lineHeight: 1.2,
            }}
          >
            {t.logo && <span style={{ fontSize: 20 }}>{t.logo}</span>}
            {t.name}
          </div>
        );
      })}

      {/* Claw mechanism */}
      <div
        style={{
          position: 'absolute',
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: 'translate(-50%, -50%)',
          transition: reducedMotion ? 'none' : 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 10,
        }}
      >
        {/* Cable */}
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 3,
          height: phase === 'lift' || phase === 'grab' ? 120 : 60,
          background: 'linear-gradient(180deg, #64748b, #94a3b8)',
          borderRadius: 2,
        }} />
        {/* Head */}
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
        }}>
          {phase === 'grab' && (
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${targetTeam.color}ee, ${targetTeam.color}77)`,
              boxShadow: `0 0 16px ${targetTeam.color}88`,
            }} />
          )}
        </div>
        {/* Fingers */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: -2 }}>
          {[0, 1, 2].map((fi) => (
            <div
              key={fi}
              style={{
                width: 7,
                height: 26,
                background: 'linear-gradient(180deg, #94a3b8, #64748b)',
                borderRadius: 4,
                transform: phase === 'grab' ? `rotate(${fi === 1 ? 0 : fi === 0 ? -25 : 25}deg)` : 'rotate(0deg)',
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
