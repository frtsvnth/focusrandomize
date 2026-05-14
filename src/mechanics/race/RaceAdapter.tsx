import { useEffect, useMemo, useState, useRef } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

export default function RaceAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const targetId = targetTeam.id;
  const frameRef = useRef(0);

  const speeds = useMemo(() => {
    const rand = mulberry32(seed);
    const map: Record<string, number> = {};
    let maxOther = 0;
    for (const t of teams) {
      const base = 0.04 + rand() * 0.08;
      map[t.id] = base;
      if (t.id !== targetId) maxOther = Math.max(maxOther, base);
    }
    map[targetId] = maxOther + 0.03 + rand() * 0.05;
    return map;
  }, [teams, targetId, seed]);

  const stumbleSchedule = useMemo(() => {
    const rand = mulberry32(seed + 777);
    const result: Record<string, { start: number; duration: number }[]> = {};
    for (const t of teams) {
      if (t.id === targetId) continue;
      const count = Math.floor(rand() * 3);
      const events: { start: number; duration: number }[] = [];
      for (let i = 0; i < count; i++) {
        events.push({
          start: 100 + rand() * 350,
          duration: 35 + rand() * 45,
        });
      }
      result[t.id] = events;
    }
    return result;
  }, [teams, targetId, seed]);

  const [phase, setPhase] = useState<'countdown' | 'racing' | 'finished'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [positions, setPositions] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const t of teams) init[t.id] = 5;
    return init;
  });

  useEffect(() => {
    if (reducedMotion) {
      const fin: Record<string, number> = {};
      for (const t of teams) fin[t.id] = t.id === targetId ? 90 : 50 + Math.random() * 30;
      setPositions(fin);
      setPhase('finished');
      const to = setTimeout(onComplete, 600);
      return () => clearTimeout(to);
    }

    const state: Record<string, number> = {};
    for (const t of teams) state[t.id] = 5;

    let frame = 0;
    let animId = 0;
    let racingActive = false;

    const raceStep = () => {
      frame++;
      frameRef.current = frame;
      let winner = false;

      for (const t of teams) {
        if (state[t.id] >= 90) continue;
        let speed = speeds[t.id] * (0.8 + Math.random() * 0.4);

        if (t.id !== targetId) {
          const stumbles = stumbleSchedule[t.id] || [];
          for (const s of stumbles) {
            if (frame >= s.start && frame < s.start + s.duration) {
              speed *= 0.25;
              break;
            }
          }
        }

        if (t.id === targetId && state[t.id] > 50) {
          speed *= 1 + ((state[t.id] - 50) / 40) * 0.9;
        }

        state[t.id] += speed;
        if (state[t.id] >= 90) {
          state[t.id] = 90;
          if (t.id === targetId) winner = true;
        }
      }

      setPositions({ ...state });

      if (winner) {
        setPhase('finished');
        setTimeout(onComplete, 1500);
      } else {
        animId = requestAnimationFrame(raceStep);
      }
    };

    let cd = 3;
    setCountdown(3);
    setPhase('countdown');

    const cdTimer = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd <= 0) {
        clearInterval(cdTimer);
        racingActive = true;
        setPhase('racing');
        animId = requestAnimationFrame(raceStep);
      }
    }, 800);

    return () => {
      clearInterval(cdTimer);
      if (racingActive) cancelAnimationFrame(animId);
    };
  }, [teams, targetId, speeds, stumbleSchedule, reducedMotion, onComplete]);

  const horseEmojis = ['🐴', '🐎', '🦄', '🏇', '🐴', '🐎', '🦄', '🏇', '🐴', '🐎'];

  return (
    <div
      ref={null}
      style={{
        position: 'relative',
        width: 'min(90vw, 700px)',
        margin: '0 auto',
        background: 'linear-gradient(180deg, #3d8b37, #2d5a27, #1a3a16)',
        borderRadius: 20,
        padding: '12px 0',
        border: '4px solid #5a4a32',
        boxShadow: '0 0 40px rgba(34,211,238,0.06), inset 0 0 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      {/* Grass texture overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(144,238,144,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(144,238,144,0.04) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      {/* Lane dividers */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 42px, rgba(255,255,255,0.03) 42px, rgba(255,255,255,0.03) 44px)',
        pointerEvents: 'none',
      }} />

      {/* Dirt track surface */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, top: 6, bottom: 6,
        background: 'linear-gradient(90deg, rgba(139,119,80,0.15) 0%, rgba(139,119,80,0.08) 50%, rgba(139,119,80,0.15) 100%)',
        borderRadius: 16,
        pointerEvents: 'none',
      }} />

      {/* Start line */}
      <div style={{
        position: 'absolute',
        left: '18%',
        top: 0, bottom: 0,
        width: 3,
        background: 'repeating-linear-gradient(0deg, #fff 0px, #fff 6px, transparent 6px, transparent 12px)',
        opacity: 0.25,
        pointerEvents: 'none',
      }} />

      {/* Finish line - checkerboard */}
      <div style={{
        position: 'absolute',
        right: 20,
        top: 0, bottom: 0,
        width: 6,
        background: 'repeating-linear-gradient(0deg, #fff 0px, #fff 8px, #111 8px, #111 16px)',
        opacity: 0.55,
        pointerEvents: 'none',
      }} />

      {teams.map((t, idx) => {
        const pct = positions[t.id] || 5;
        const isWinner = phase === 'finished' && t.id === targetId;
        const emoji = t.logo || horseEmojis[idx % horseEmojis.length];
        const isStumbling = !isWinner && phase === 'racing' && t.id !== targetId && (() => {
          const stumbles = stumbleSchedule[t.id] || [];
          for (const s of stumbles) {
            if (frameRef.current >= s.start && frameRef.current < s.start + s.duration) return true;
          }
          return false;
        })();

        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 42,
              position: 'relative',
              paddingLeft: 8,
              borderBottom: idx < teams.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            {/* Lane number */}
            <span style={{
              width: 26, textAlign: 'center', fontSize: 11, fontWeight: 700,
              color: '#8b9a6b', flexShrink: 0,
            }}>{idx + 1}</span>
            {/* Team name */}
            <span style={{
              width: 84, fontSize: 11, fontWeight: 700, color: '#d1d5c7',
              flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}>{t.name}</span>
            {/* Horse + jockey */}
            <div style={{
              position: 'absolute',
              left: `${pct}%`,
              top: idx * 42 + 4,
              transform: `translateX(-50%) ${isStumbling ? 'rotate(-8deg)' : ''}`,
              fontSize: 28,
              transition: reducedMotion ? 'none' : 'left 0.12s linear',
              filter: isWinner ? 'drop-shadow(0 0 12px gold) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
              zIndex: 2,
            }}>
              {emoji}
            </div>
            {/* Color trail */}
            <div style={{
              position: 'absolute',
              left: '118px',
              top: idx * 42 + 4 + 16,
              width: `${Math.max(0, pct - 17)}%`,
              height: 2,
              background: `linear-gradient(90deg, ${t.color}66, ${t.color}11)`,
              borderRadius: 1,
              opacity: 0.4,
              pointerEvents: 'none',
            }} />
          </div>
        );
      })}

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
          zIndex: 10,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            fontSize: countdown > 0 ? 96 : 48,
            fontWeight: 900,
            color: countdown > 0 ? '#fbbf24' : '#22c55e',
            textShadow: countdown > 0
              ? '0 0 40px rgba(251,191,36,0.6), 0 4px 8px rgba(0,0,0,0.5)'
              : '0 0 40px rgba(34,197,94,0.6), 0 4px 8px rgba(0,0,0,0.5)',
            letterSpacing: 4,
            animation: 'countdown-pop 0.3s ease-out',
          }}>
            {countdown > 0 ? countdown : 'СТАРТ!'}
          </div>
        </div>
      )}

      {/* Win overlay */}
      {phase === 'finished' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
          zIndex: 10,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 4 }}>🏆</div>
            <div style={{
              fontSize: 26, fontWeight: 900, color: targetTeam.color,
              textShadow: `0 0 24px ${targetTeam.color}88`,
            }}>
              {targetTeam.name}
            </div>
            <div style={{ fontSize: 14, color: '#fbbf24', marginTop: 4 }}>
              Победитель!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
