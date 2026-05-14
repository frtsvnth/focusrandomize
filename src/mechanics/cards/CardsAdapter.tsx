import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { shuffleWithSeed } from '../../utils/seededRandom';

const CARD_W = 85;
const CARD_H = 123;
type Phase = 'dealing' | 'revealing' | 'winner';

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

  const N = revealOrder.length;
  const outerN = N - 1;

  const rx = useMemo(() => Math.min(200, Math.max(90, outerN * 30)), [outerN]);
  const ry = useMemo(() => Math.min(100, Math.max(50, outerN * 15)), [outerN]);

  const positions = useMemo(() => {
    const result: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < outerN; i++) {
      const angle = Math.PI - (i * 2 * Math.PI) / (outerN || 1);
      result.push({
        x: rx * Math.cos(angle),
        y: -ry * Math.sin(angle),
      });
    }
    result.push({ x: 0, y: 0 });
    return result;
  }, [outerN, rx, ry]);

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealing' : 'dealing');
  const [dealProgress, setDealProgress] = useState(-1);
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  const [winnerMoment, setWinnerMoment] = useState(false);

  const deckX = -(rx + CARD_W / 2 + 60);

  useEffect(() => {
    if (phase !== 'dealing') return;
    let stopped = false;
    const stagger = 200;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < N; i++) {
      const t = setTimeout(() => {
        if (stopped) return;
        setDealProgress(i);
      }, i * stagger);
      timeouts.push(t);
    }

    const transitionTimer = setTimeout(() => {
      if (stopped) return;
      setPhase('revealing');
    }, (N - 1) * stagger + 500);
    timeouts.push(transitionTimer);

    return () => {
      stopped = true;
      timeouts.forEach(clearTimeout);
    };
  }, [phase, N]);

  useEffect(() => {
    if (phase !== 'revealing') return;
    let stopped = false;
    const stagger = reducedMotion ? 30 : 200;
    const delay = reducedMotion ? 30 : 200;
    const flipDuration = reducedMotion ? 0 : 600;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    revealOrder.forEach((id, i) => {
      const t = setTimeout(() => {
        if (stopped) return;
        setRevealedSet((prev) => new Set([...prev, id]));
      }, i * stagger + delay);
      timeouts.push(t);
    });

    const lastFlipStart = (N - 1) * stagger + delay;
    const winnerDelay = lastFlipStart + flipDuration + (reducedMotion ? 100 : 800);

    const winnerTimer = setTimeout(() => {
      if (stopped) return;
      setPhase('winner');
      setWinnerMoment(true);
    }, winnerDelay);
    timeouts.push(winnerTimer);

    return () => {
      stopped = true;
      timeouts.forEach(clearTimeout);
    };
  }, [phase, revealOrder, reducedMotion, N]);

  useEffect(() => {
    if (phase !== 'winner') return;
    const t = setTimeout(() => {
      onComplete();
    }, reducedMotion ? 100 : 1500);
    return () => clearTimeout(t);
  }, [phase, reducedMotion, onComplete]);

  const isDealt = (index: number) => phase !== 'dealing' || index <= dealProgress;

  const isWinnerCard = (id: string) => winnerMoment && id === targetTeam.id;

  const containerH = ry * 2 + CARD_H + 100;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: 1200,
        padding: '10px 0',
        position: 'relative',
        width: '100%',
        height: Math.max(320, containerH),
        overflow: 'visible',
      }}
    >
      {phase === 'dealing' && (
        <div
          style={{
            position: 'absolute',
            left: `calc(50% + ${deckX}px)`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: CARD_W + 8,
            height: CARD_H + 8,
            zIndex: 10,
          }}
        >
          {[3, 2, 1, 0].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: CARD_W - 4,
                height: CARD_H - 4,
                top: i * 2 + 4,
                left: i * 1.5 + 4,
                transform: `rotate(${(i - 1.5) * 1.5}deg)`,
                borderRadius: 10,
                background: i === 0
                  ? 'linear-gradient(145deg, #1a1f3a, #0d1025)'
                  : 'linear-gradient(145deg, #141932, #0a0d1e)',
                border: '2px solid rgba(255,255,255,0.07)',
                boxShadow: `2px 2px ${6 - i}px rgba(0,0,0,0.4)`,
                zIndex: i,
              }}
            />
          ))}
        </div>
      )}

      {positions.map((pos, idx) => {
        const id = revealOrder[idx];
        const team = teams.find((t) => t.id === id)!;
        const dealt = isDealt(idx);
        const revealed = revealedSet.has(id);
        const isWinner = isWinnerCard(id);
        const isCenter = idx === N - 1;

        const translateOff = dealt
          ? 'translate(0, 0)'
          : `translate(${deckX + CARD_W / 2 + 8 - pos.x}px, ${-pos.y}px)`;

        const dealTransition = phase === 'dealing'
          ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
          : 'transform 0.3s ease-out';

        const revealTransition = revealed
          ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          : reducedMotion
          ? 'none'
          : 'transform 0.15s ease-in';

        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: `calc(50% + ${pos.x}px)`,
              top: `calc(50% + ${pos.y}px)`,
              width: CARD_W,
              height: CARD_H,
              transformOrigin: 'center center',
              transformStyle: 'preserve-3d',
              transform: revealed
                ? 'rotateY(180deg)'
                : translateOff,
              transition: phase === 'dealing' || (!revealed && phase === 'revealing')
                ? dealTransition
                : revealTransition,
              borderRadius: 10,
              marginLeft: -(CARD_W / 2),
              marginTop: -(CARD_H / 2),
              zIndex: isCenter ? 20
                : phase === 'dealing'
                ? (dealt ? 3 : -1)
                : (revealed ? (isWinner ? 5 : 2) : 1),
              boxShadow: isWinner
                ? `0 0 24px ${team.color}aa, 0 0 48px ${team.color}44, 0 6px 18px rgba(0,0,0,0.5)`
                : revealed
                ? `0 0 10px ${team.color}33, 0 4px 12px rgba(0,0,0,0.35)`
                : '0 3px 8px rgba(0,0,0,0.4)',
            }}
          >
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
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${team.color}22, transparent)`,
                  border: '1.5px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: 'rgba(255,255,255,0.2)',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                ♠
              </div>
            </div>
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
                padding: 12,
                gap: 8,
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
              }}
            >
              {team.logo && (
                <div style={{ fontSize: 28, lineHeight: 1 }}>{team.logo}</div>
              )}
              <div
                style={{
                  fontSize: 13,
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
                    fontSize: 10,
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

      {winnerMoment && (
        <div
          style={{
            marginTop: ry > 60 ? 120 : 135,
            textAlign: 'center',
            animation: 'reveal-in 0.5s ease-out',
            zIndex: 30,
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
