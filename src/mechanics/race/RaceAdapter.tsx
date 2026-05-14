import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

type Phase = 'countdown' | 'racing' | 'winner_pause' | 'finished';

export default function RaceAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const targetId = targetTeam.id;
  const horseRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const positionsRef = useRef<Record<string, number>>({});
  const frameRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);

  const { speeds, stumbleSchedule } = useMemo(() => {
    const rand = mulberry32(seed);
    const speedMap: Record<string, number> = {};
    let maxOther = 0;
    for (const t of teams) {
      const base = 0.04 + rand() * 0.08;
      speedMap[t.id] = base;
      if (t.id !== targetId) maxOther = Math.max(maxOther, base);
    }
    speedMap[targetId] = maxOther + 0.03 + rand() * 0.05;

    const stumbleRand = mulberry32(seed + 777);
    const stumbleMap: Record<string, { start: number; duration: number }[]> = {};
    for (const t of teams) {
      if (t.id === targetId) continue;
      const count = Math.floor(stumbleRand() * 3);
      const events: { start: number; duration: number }[] = [];
      for (let i = 0; i < count; i++) {
        events.push({
          start: 60 + stumbleRand() * 300,
          duration: 30 + stumbleRand() * 50,
        });
      }
      stumbleMap[t.id] = events;
    }

    return { speeds: speedMap, stumbleSchedule: stumbleMap };
  }, [teams, targetId, seed]);

  const horseEmojis = ['🐴', '🐎', '🦄', '🏇', '🐴', '🐎', '🦄', '🏇', '🐴', '🐎'];

  useEffect(() => {
    if (reducedMotion) {
      for (const t of teams) {
        positionsRef.current[t.id] = t.id === targetId ? 90 : 50 + Math.random() * 30;
      }
      const el = laneRefs.current[0]?.parentElement;
      if (el) {
        for (let i = 0; i < teams.length; i++) {
          const horse = horseRefs.current[i];
          if (horse) horse.style.left = `${positionsRef.current[teams[i].id]}%`;
          const trail = trailRefs.current[i];
          if (trail) trail.style.width = `${Math.max(0, positionsRef.current[teams[i].id] - 17)}%`;
        }
      }
      setPhase('winner_pause');
      const to1 = setTimeout(() => {
        setPhase('finished');
        const to2 = setTimeout(onComplete, 600);
        return () => clearTimeout(to2);
      }, 800);
      return () => clearTimeout(to1);
    }

    const state: Record<string, number> = {};
    for (const t of teams) state[t.id] = 3;
    positionsRef.current = state;

    let frame = 0;
    let animId = 0;
    let racingActive = false;

    const updatePositions = () => {
      for (let i = 0; i < teams.length; i++) {
        const t = teams[i];
        const pct = state[t.id];
        const horse = horseRefs.current[i];
        if (horse) {
          horse.style.left = `${pct}%`;
        }
        const trail = trailRefs.current[i];
        if (trail) {
          trail.style.width = `${Math.max(0, pct - 17)}%`;
        }
      }
    };

    const raceStep = () => {
      frame++;
      frameRef.current = frame;
      let winner = false;

      for (const t of teams) {
        if (state[t.id] >= 91) {
          if (t.id === targetId) winner = true;
          continue;
        }

        let speed = speeds[t.id] * (0.8 + Math.random() * 0.4);
        const frame_ = frame;

        if (t.id !== targetId) {
          const stumbles = stumbleSchedule[t.id] || [];
          for (const s of stumbles) {
            if (frame_ >= s.start && frame_ < s.start + s.duration) {
              speed *= 0.2;
              break;
            }
          }
        }

        if (t.id === targetId && state[t.id] > 50) {
          const progress = (state[t.id] - 50) / 40;
          speed *= 1 + progress * 0.8;
        }

        if (frame_ < 30) {
          speed *= frame_ / 30;
        }

        state[t.id] += speed;
        if (state[t.id] >= 91) {
          state[t.id] = 91;
          if (t.id === targetId) winner = true;
        }
      }

      updatePositions();

      if (winner) {
        setPhase('winner_pause');
        setTimeout(() => {
          setPhase('finished');
        }, 2800);
        racingActive = false;
        cancelAnimationFrame(animId);
        return;
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
      if (cd < 0) {
        clearInterval(cdTimer);
        racingActive = true;
        setPhase('racing');
        animId = requestAnimationFrame(raceStep);
      }
    }, 900);

    return () => {
      clearInterval(cdTimer);
      if (racingActive) cancelAnimationFrame(animId);
    };
  }, [teams, targetId, speeds, stumbleSchedule, reducedMotion, onComplete]);

  useEffect(() => {
    if (phase === 'finished') {
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  return (
    <div
      style={{
        position: 'relative',
        width: 'min(94vw, 1100px)',
        margin: '0 auto',
        background: 'linear-gradient(180deg, #3d8b37, #2d5a27, #1a3a16)',
        borderRadius: 24,
        padding: '12px 0',
        border: '4px solid #5a4a32',
        boxShadow: '0 0 40px rgba(34,211,238,0.06), inset 0 0 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(144,238,144,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(144,238,144,0.04) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 48px, rgba(255,255,255,0.03) 48px, rgba(255,255,255,0.03) 50px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        left: 0, right: 0, top: 4, bottom: 4,
        background: 'linear-gradient(90deg, rgba(139,119,80,0.12) 0%, rgba(139,119,80,0.06) 50%, rgba(139,119,80,0.12) 100%)',
        borderRadius: 20,
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        left: '10%',
        top: 0, bottom: 0,
        width: 3,
        background: 'repeating-linear-gradient(0deg, #fff 0px, #fff 6px, transparent 6px, transparent 12px)',
        opacity: 0.3,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      <div style={{
        position: 'absolute',
        right: '6%',
        top: 0, bottom: 0,
        width: 8,
        background: 'repeating-linear-gradient(0deg, #fff 0px, #fff 6px, #111 6px, #111 12px)',
        opacity: 0.6,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {teams.map((t, idx) => {
        const isWinner = phase !== 'countdown' && phase !== 'racing' && t.id === targetId;
        const emoji = t.logo || horseEmojis[idx % horseEmojis.length];

        return (
          <div
            key={t.id}
            ref={(el) => { laneRefs.current[idx] = el; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 48,
              position: 'relative',
              paddingLeft: 10,
              borderBottom: idx < teams.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <span style={{
              width: 28, textAlign: 'center', fontSize: 12, fontWeight: 700,
              color: '#8b9a6b', flexShrink: 0,
            }}>{idx + 1}</span>

            <span style={{
              width: 100, fontSize: 13, fontWeight: 700, color: '#d1d5c7',
              flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}>{t.name}</span>

            <div
              ref={(el) => { horseRefs.current[idx] = el; }}
              style={{
                position: 'absolute',
                left: '3%',
                top: 4,
                fontSize: 34,
                zIndex: 3,
                filter: isWinner ? 'drop-shadow(0 0 14px gold) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
                transition: phase === 'racing' ? 'none' : 'left 0.15s linear',
              }}
              className={phase === 'racing' ? 'horse-racing' : ''}
            >
              <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>
                {emoji}
              </span>
              {t.id === targetId && phase === 'winner_pause' && (
                <span style={{
                  position: 'absolute',
                  left: '50%',
                  top: -18,
                  transform: 'translateX(-50%)',
                  fontSize: 10,
                  color: '#fbbf24',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 8px rgba(251,191,36,0.8)',
                }}>
                  ⚡
                </span>
              )}
            </div>

            <div
              ref={(el) => { trailRefs.current[idx] = el; }}
              style={{
                position: 'absolute',
                left: '148px',
                top: 24,
                width: '0%',
                height: 2,
                background: `linear-gradient(90deg, ${t.color}88, ${t.color}22)`,
                borderRadius: 1,
                opacity: 0.5,
                pointerEvents: 'none',
                transition: phase === 'racing' ? 'none' : 'width 0.15s linear',
              }}
            />
          </div>
        );
      })}

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
            fontSize: countdown > 0 ? 128 : 56,
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

      {phase === 'winner_pause' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
          zIndex: 5,
        }}>
          <div style={{ textAlign: 'center', animation: 'reveal-in 0.6s ease-out' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{
              fontSize: 30, fontWeight: 900, color: targetTeam.color,
              textShadow: `0 0 24px ${targetTeam.color}88`,
            }}>
              {targetTeam.name}
            </div>
            <div style={{ fontSize: 16, color: '#fbbf24', marginTop: 4 }}>
              Победитель!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
