import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { shuffleWithSeed } from '../../utils/seededRandom';

const CARD_W = 80;
const CARD_H = 116;
const MAX_PER_ROW = 8;

export default function CardsAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const order = useMemo(
    () => shuffleWithSeed(teams.map((t) => t.id), seed),
    [teams, seed]
  );

  const revealOrder = useMemo(() => {
    const withoutTarget = order.filter((id) => id !== targetTeam.id);
    return [...withoutTarget, targetTeam.id];
  }, [order, targetTeam]);

  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  const [winnerMoment, setWinnerMoment] = useState(false);

  useEffect(() => {
    let stopped = false;
    const stagger = reducedMotion ? 30 : 200;
    const delay = reducedMotion ? 60 : 300;
    const flipDuration = reducedMotion ? 0 : 600;

    revealOrder.forEach((id, i) => {
      setTimeout(() => {
        if (stopped) return;
        setRevealedSet((prev) => new Set([...prev, id]));
      }, i * stagger + delay);
    });

    const lastCardFlipStart = (revealOrder.length - 1) * stagger + delay;
    const winnerDelay = lastCardFlipStart + flipDuration + (reducedMotion ? 100 : 800);

    const winnerTimer = setTimeout(() => {
      if (stopped) return;
      setWinnerMoment(true);
      setTimeout(() => {
        if (!stopped) onComplete();
      }, reducedMotion ? 100 : 1500);
    }, winnerDelay);

    return () => { stopped = true; clearTimeout(winnerTimer); };
  }, [revealOrder, reducedMotion, onComplete]);

  const rows: string[][] = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < revealOrder.length; i += MAX_PER_ROW) {
      result.push(revealOrder.slice(i, i + MAX_PER_ROW));
    }
    return result;
  }, [revealOrder]);

  const colsInFirstRow = rows[0]?.length ?? 1;
  const cardW = Math.min(CARD_W, Math.max(56, (600 - (colsInFirstRow - 1) * 8) / colsInFirstRow));
  const cardH = cardW * (CARD_H / CARD_W);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        perspective: 1200,
        padding: '4px 0',
      }}
    >
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{ display: 'flex', gap: 8, justifyContent: 'center' }}
        >
          {row.map((id) => {
            const team = teams.find((t) => t.id === id)!;
            const revealed = revealedSet.has(id);
            const isWinner = winnerMoment && id === targetTeam.id;

            return (
              <div
                key={id}
                style={{
                  width: cardW,
                  height: cardH,
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: reducedMotion
                    ? 'none'
                    : 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  borderRadius: 10,
                  flexShrink: 0,
                  boxShadow: isWinner
                    ? `0 0 24px ${team.color}aa, 0 0 48px ${team.color}44, 0 6px 18px rgba(0,0,0,0.5)`
                    : revealed
                    ? `0 0 10px ${team.color}33, 0 4px 12px rgba(0,0,0,0.35)`
                    : '0 3px 8px rgba(0,0,0,0.4)',
                }}
              >
                {/* Back */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    borderRadius: 10,
                    background: 'linear-gradient(145deg, #1a1f3a, #0d1025)',
                    border: '2px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `
                        linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%),
                        linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%),
                        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%)
                      `,
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 4,
                      borderRadius: 7,
                      border: '1.5px solid rgba(255,255,255,0.06)',
                    }}
                  />
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${team.color}22, transparent)`,
                      border: '1.5px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      color: 'rgba(255,255,255,0.2)',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    ♠
                  </div>
                </div>
                {/* Front */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    borderRadius: 10,
                    background: `linear-gradient(145deg, ${team.color}ee, ${team.color}88)`,
                    border: `2px solid ${team.color}aa`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                    gap: 6,
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
                  }}
                >
                  {team.logo && (
                    <div style={{ fontSize: 26, lineHeight: 1 }}>{team.logo}</div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#fff',
                      textAlign: 'center',
                      textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                      lineHeight: 1.2,
                      wordBreak: 'break-word',
                    }}
                  >
                    {team.name}
                  </div>
                  {isWinner && (
                    <div
                      style={{
                        fontSize: 9,
                        color: '#fbbf24',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        textShadow: '0 0 6px rgba(251,191,36,0.6)',
                        animation: 'reveal-in 0.4s ease-out',
                      }}
                    >
                      Победитель!
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {winnerMoment && (
        <div
          style={{
            marginTop: 8,
            textAlign: 'center',
            animation: 'reveal-in 0.5s ease-out',
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: '#94a3b8',
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Победитель
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: targetTeam.color,
              textShadow: `0 0 16px ${targetTeam.color}66`,
              marginTop: 2,
            }}
          >
            {targetTeam.logo && <span style={{ marginRight: 6 }}>{targetTeam.logo}</span>}
            {targetTeam.name}
          </div>
        </div>
      )}
    </div>
  );
}
