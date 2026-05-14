import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { shuffleWithSeed } from '../../utils/seededRandom';

interface CardPos {
  teamId: string;
  row: number;
  col: number;
  rowSize: number;
}

function buildPyramid(n: number): number[] {
  let rows = 1;
  while ((rows * (rows + 1)) / 2 < n) rows++;
  const pyramid: number[] = [];
  for (let r = rows; r >= 1; r--) pyramid.push(r);
  let total = pyramid.reduce((a, b) => a + b, 0);
  let i = pyramid.length - 1;
  while (total > n && i >= 0) {
    if (pyramid[i] > 1) {
      pyramid[i]--;
      total--;
    } else {
      i--;
    }
  }
  return pyramid.filter((r) => r > 0);
}

const CARD_W = 90;
const CARD_H = 130;
const ROW_GAP = 16;

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

  const pyramid = useMemo(() => buildPyramid(revealOrder.length), [revealOrder]);

  const positions = useMemo(() => {
    const result: CardPos[] = [];
    let idx = 0;
    for (let r = pyramid.length - 1; r >= 0; r--) {
      const rowSize = pyramid[r];
      for (let c = 0; c < rowSize; c++) {
        result.push({ teamId: revealOrder[idx], row: r, col: c, rowSize });
        idx++;
      }
    }
    return result;
  }, [pyramid, revealOrder]);

  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  const [winnerRevealed, setWinnerRevealed] = useState(false);

  useEffect(() => {
    let stopped = false;
    const delay = reducedMotion ? 60 : 350;
    const stagger = reducedMotion ? 30 : 220;

    (positions).forEach((pos, i) => {
      setTimeout(() => {
        if (stopped) return;
        setRevealedSet((prev) => new Set([...prev, pos.teamId]));
        if (pos.teamId === targetTeam.id) {
          setWinnerRevealed(true);
          setTimeout(() => {
            if (!stopped) onComplete();
          }, reducedMotion ? 200 : 1000);
        }
      }, i * stagger + delay);
    });

    return () => { stopped = true; };
  }, [positions, targetTeam, reducedMotion, onComplete]);

  const maxRowSize = Math.max(...pyramid, 0);
  const cardW = Math.min(CARD_W, Math.max(60, (600 - (maxRowSize - 1) * 8) / maxRowSize));
  const cardH = cardW * (CARD_H / CARD_W);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ROW_GAP,
        perspective: 1400,
        padding: '10px 0',
      }}
    >
      {pyramid.map((rowSize, rowIdx) => {
        const rowPositions = positions.filter((p) => p.row === rowIdx);
        const offset = ((maxRowSize - rowSize) * (cardW + 8)) / 2;

        return (
          <div
            key={rowIdx}
            style={{
              display: 'flex',
              gap: 8,
              paddingLeft: offset,
              paddingRight: offset,
            }}
          >
            {rowPositions.map((pos) => {
              const team = teams.find((t) => t.id === pos.teamId)!;
              const revealed = revealedSet.has(pos.teamId);
              const isTarget = pos.teamId === targetTeam.id;
              const isWinnerMoment = isTarget && winnerRevealed;

              return (
                <div
                  key={pos.teamId}
                  style={{
                    width: cardW,
                    height: cardH,
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transform: revealed
                      ? 'rotateY(180deg)'
                      : 'rotateY(0deg)',
                    transition: reducedMotion
                      ? 'none'
                      : 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    borderRadius: 12,
                    flexShrink: 0,
                    boxShadow: isWinnerMoment
                      ? `0 0 30px ${team.color}aa, 0 0 60px ${team.color}44, 0 8px 24px rgba(0,0,0,0.5)`
                      : revealed
                      ? `0 0 16px ${team.color}44, 0 6px 16px rgba(0,0,0,0.35)`
                      : '0 4px 12px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* Card Back */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backfaceVisibility: 'hidden',
                      borderRadius: 12,
                      background: `linear-gradient(145deg, #1a1f3a, #0d1025)`,
                      border: '2px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Diamond pattern overlay */}
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
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                      }}
                    />
                    {/* Inner border */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 5,
                        borderRadius: 8,
                        border: '1.5px solid rgba(255,255,255,0.06)',
                      }}
                    />
                    {/* Center emblem */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${team.color}33, transparent)`,
                        border: '2px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        color: 'rgba(255,255,255,0.25)',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      ♠
                    </div>
                  </div>

                  {/* Card Front */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      borderRadius: 12,
                      background: `linear-gradient(145deg, ${team.color}ee, ${team.color}88)`,
                      border: `2px solid ${team.color}aa`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 12,
                      gap: 8,
                      boxShadow: `inset 0 0 30px rgba(0,0,0,0.2)`,
                    }}
                  >
                    {team.logo && (
                      <div style={{ fontSize: 32, lineHeight: 1 }}>
                        {team.logo}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: '#fff',
                        textAlign: 'center',
                        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {team.name}
                    </div>
                    {isWinnerMoment && (
                      <div
                        style={{
                          fontSize: 10,
                          color: '#fbbf24',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          textShadow: '0 0 8px rgba(251,191,36,0.6)',
                          animation: reducedMotion ? 'none' : 'reveal-in 0.4s ease-out',
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
        );
      })}

      {/* Winner overlay */}
      {winnerRevealed && (
        <div
          style={{
            marginTop: 12,
            textAlign: 'center',
            animation: reducedMotion ? 'none' : 'reveal-in 0.5s ease-out',
          }}
        >
          <div
            style={{
              fontSize: 16,
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
              fontSize: 28,
              fontWeight: 900,
              color: targetTeam.color,
              textShadow: `0 0 20px ${targetTeam.color}66`,
              marginTop: 4,
            }}
          >
            {targetTeam.logo && <span style={{ marginRight: 8 }}>{targetTeam.logo}</span>}
            {targetTeam.name}
          </div>
        </div>
      )}
    </div>
  );
}
