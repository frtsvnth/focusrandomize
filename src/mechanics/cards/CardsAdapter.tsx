import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { shuffleWithSeed } from '../../utils/seededRandom';

const CARD_RATIO = 123 / 85;

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

  const cardW = useMemo(() => {
    const base = Math.min(window.innerWidth * 0.1, 100);
    return Math.max(70, base);
  }, []);

  const cardH = cardW * CARD_RATIO;

  const rx = useMemo(() => {
    const base = Math.min(200, Math.max(90, outerN * 30));
    return Math.min(base, window.innerWidth * 0.25);
  }, [outerN]);

  const ry = useMemo(() => {
    const base = Math.min(100, Math.max(50, outerN * 15));
    return Math.min(base, rx * 0.5);
  }, [outerN, rx]);

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

  const deckX = -(rx + cardW / 2 + 50);

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

  const isDealt = (index: number) =>
    phase !== 'dealing' || (dealProgress >= 0 && index <= dealProgress);

  const isWinnerCard = (id: string) => winnerMoment && id === targetTeam.id;

  const containerH = ry * 2 + cardH + 100;

  const calcFontSize = (name: string) => {
    const maxChars = Math.floor(cardW / 7);
    if (name.length <= maxChars) return Math.min(14, cardW * 0.16);
    const scale = Math.min(1, maxChars / name.length);
    return Math.max(9, Math.min(13, cardW * 0.16 * scale));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: 1200,
        padding: '8px 0',
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
            width: cardW,
            height: cardH,
            zIndex: 10,
          }}
        >
          {[3, 2, 1, 0].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: cardW,
                height: cardH,
                top: i * 1,
                left: i * 1,
                transform: `rotate(${(i - 1.5) * 1.2}deg)`,
                borderRadius: 10,
                background: 'linear-gradient(145deg, #1a1f3a, #0d1025)',
                border: '2px solid rgba(255,255,255,0.07)',
                boxShadow: `1px 1px ${4 - i * 0.5}px rgba(0,0,0,0.4)`,
                overflow: 'hidden',
                zIndex: i,
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
                  backgroundSize: '14px 14px',
                  backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
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
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: cardW * 0.38,
                  height: cardW * 0.38,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.06)',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.04), transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cardW * 0.2,
                  color: 'rgba(255,255,255,0.15)',
                }}
              >
                ♠
              </div>
            </div>
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
          : `translate(${deckX - pos.x}px, ${-pos.y}px)`;

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
              width: cardW,
              height: cardH,
              transformOrigin: 'center center',
              transformStyle: 'preserve-3d',
              transform: revealed
                ? 'rotateY(180deg)'
                : translateOff,
              transition: phase === 'dealing' || (!revealed && phase === 'revealing')
                ? dealTransition
                : revealTransition,
              borderRadius: 10,
              marginLeft: -(cardW / 2),
              marginTop: -(cardH / 2),
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
                  backgroundSize: '14px 14px',
                  backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
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
                  width: cardW * 0.38,
                  height: cardW * 0.38,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${team.color}22, transparent)`,
                  border: '1.5px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cardW * 0.2,
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
                padding: '10%',
                gap: cardW * 0.06,
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
              }}
            >
              {team.logo && (
                <div style={{ fontSize: cardW * 0.33, lineHeight: 1, flexShrink: 0 }}>
                  {team.logo}
                </div>
              )}
              <div
                style={{
                  fontSize: calcFontSize(team.name),
                  fontWeight: 800,
                  color: '#fff',
                  textAlign: 'center',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {team.name}
              </div>
              {isWinner && (
                <div
                  style={{
                    fontSize: cardW * 0.12,
                    color: '#fbbf24',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    textShadow: '0 0 6px rgba(251,191,36,0.6)',
                    animation: 'reveal-in 0.4s ease-out',
                    whiteSpace: 'nowrap',
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
