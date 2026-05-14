import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { shuffleWithSeed } from '../../utils/seededRandom';

export default function CardsAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const order = useMemo(() => shuffleWithSeed(teams.map((t) => t.id), seed), [teams, seed]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    const targetId = targetTeam.id;
    let idx = 0;
    const interval = setInterval(() => {
      const id = order[idx];
      if (!id) {
        clearInterval(interval);
        return;
      }
      setHighlighted(id);
      setTimeout(() => {
        setRevealed((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        if (id === targetId) {
          clearInterval(interval);
          setTimeout(onComplete, 800);
        }
      }, reducedMotion ? 100 : 420);
      idx++;
    }, reducedMotion ? 160 : 600);

    return () => clearInterval(interval);
  }, [order, targetTeam, reducedMotion, onComplete]);

  const cols = Math.min(teams.length, 4);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 20,
        maxWidth: 720,
        margin: '0 auto',
        perspective: 1200,
        padding: '0 12px',
      }}
    >
      {order.map((id) => {
        const team = teams.find((t) => t.id === id)!;
        const isRevealed = revealed.has(id);
        const isHL = highlighted === id;
        return (
          <div
            key={id}
            style={{
              aspectRatio: '3/4.5',
              position: 'relative',
              transformStyle: 'preserve-3d',
              transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: reducedMotion ? 'none' : 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isHL
                ? `0 0 35px ${team.color}99, 0 12px 32px rgba(0,0,0,0.5)`
                : '0 6px 18px rgba(0,0,0,0.35)',
              borderRadius: 18,
              cursor: 'default',
            }}
          >
            {/* Front */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                borderRadius: 18,
                border: '2px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)',
                gap: 12,
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26,
                boxShadow: '0 0 20px rgba(34,211,238,0.35)',
              }}>?</div>
              <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>Карта</div>
            </div>
            {/* Back */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: `linear-gradient(145deg, ${team.color}ee, ${team.color}77)`,
                borderRadius: 18,
                border: '3px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: 16,
                boxShadow: `0 0 40px ${team.color}55`,
                gap: 10,
              }}
            >
              <div style={{ fontSize: 40 }}>{team.logo || '🏆'}</div>
              <div style={{
                fontSize: 16, fontWeight: 800, color: '#fff',
                textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                lineHeight: 1.3,
              }}>
                {team.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
