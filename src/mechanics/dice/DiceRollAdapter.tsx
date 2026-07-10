import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';

export default function DiceRollAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [phase, setPhase] = useState<'toss' | 'fall' | 'bounce' | 'settle'>('toss');
  const containerRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<HTMLDivElement>(null);

  const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);

  // Map target to a face 1-6
  const winnerFace = (targetIdx % 6) + 1;

  const targetRotation = useMemo(() => {
    // Pre-determined rotation that lands winnerFace on top
    const faceRotations: Record<number, { x: number; y: number }> = {
      1: { x: 0, y: 0 },
      2: { x: 0, y: 180 },
      3: { x: 0, y: -90 },
      4: { x: 0, y: 90 },
      5: { x: -90, y: 0 },
      6: { x: 90, y: 0 },
    };
    const base = faceRotations[winnerFace];
    // Add full spins for visual effect
    return {
      x: base.x + 720 + (seed % 360),
      y: base.y + 720 + (seed % 360),
    };
  }, [winnerFace, seed]);

  const faceSize = 90;

  useEffect(() => {
    if (reducedMotion) {
      setPhase('settle');
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }

    setPhase('toss');
    const t1 = setTimeout(() => setPhase('fall'), 100);
    const t2 = setTimeout(() => setPhase('bounce'), 900);
    const t3 = setTimeout(() => setPhase('settle'), 1400);
    const t4 = setTimeout(onComplete, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [reducedMotion, onComplete]);

  const getFaceContent = (face: number) => {
    const idx = (face - 1) % teams.length;
    const team = teams[idx];
    if (!team) return { name: '', color: '#64748b', logo: '' };
    return { name: team.name, color: team.color, logo: team.logo || '' };
  };

  const transforms: Record<number, string> = {
    1: `translateZ(${faceSize / 2}px)`,
    2: `rotateY(180deg) translateZ(${faceSize / 2}px)`,
    3: `rotateY(90deg) translateZ(${faceSize / 2}px)`,
    4: `rotateY(-90deg) translateZ(${faceSize / 2}px)`,
    5: `rotateX(90deg) translateZ(${faceSize / 2}px)`,
    6: `rotateX(-90deg) translateZ(${faceSize / 2}px)`,
  };

  const diceStyle: React.CSSProperties = {
    width: faceSize,
    height: faceSize,
    position: 'relative',
    transformStyle: 'preserve-3d',
    transform:
      phase === 'toss'
        ? `translateY(-200px) rotateX(${targetRotation.x}deg) rotateY(${targetRotation.y}deg)`
        : phase === 'fall'
        ? `translateY(0px) rotateX(${targetRotation.x}deg) rotateY(${targetRotation.y}deg)`
        : phase === 'bounce'
        ? `translateY(-30px) rotateX(${targetRotation.x}deg) rotateY(${targetRotation.y}deg)`
        : `translateY(0px) rotateX(${targetRotation.x}deg) rotateY(${targetRotation.y}deg)`,
    transition: reducedMotion
      ? 'none'
      : phase === 'fall'
      ? 'transform 0.8s cubic-bezier(0.55, 0.06, 0.75, 0.6)'
      : phase === 'bounce'
      ? 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : phase === 'settle'
      ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'none',
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        perspective: 900,
        height: 320,
      }}
    >
      {/* Floor */}
      <div style={{
        position: 'relative',
        width: 260,
        height: 260,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Shadow */}
        <div style={{
          position: 'absolute',
          bottom: 60,
          width: phase === 'toss' ? 30 : phase === 'fall' ? 100 : phase === 'bounce' ? 80 : 90,
          height: phase === 'toss' ? 10 : phase === 'fall' ? 20 : phase === 'bounce' ? 15 : 18,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent)',
          borderRadius: '50%',
          transition: reducedMotion ? 'none' : 'all 0.3s',
        }} />

        {/* Dice */}
        <div ref={diceRef} style={diceStyle}>
          {[1, 2, 3, 4, 5, 6].map((face) => {
            const content = getFaceContent(face);
            const isWinnerFace = face === winnerFace;

            return (
              <div
                key={face}
                style={{
                  position: 'absolute',
                  width: faceSize,
                  height: faceSize,
                  background: isWinnerFace
                    ? `linear-gradient(135deg, ${content.color}dd, ${content.color}99)`
                    : 'linear-gradient(135deg, #1e293b, #0f172a)',
                  border: `2px solid ${isWinnerFace ? '#fff' : '#334155'}`,
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transform: transforms[face],
                  backfaceVisibility: 'hidden',
                  boxShadow: isWinnerFace ? `0 0 20px ${content.color}66` : 'none',
                }}
              >
                {content.logo && (
                  <span style={{ fontSize: 20 }}>{content.logo}</span>
                )}
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  textAlign: 'center',
                  maxWidth: '85%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}>
                  {content.name}
                </span>
                {/* Dots for dice feel */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 3,
                  marginTop: 2,
                }}>
                  {Array.from({ length: face }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: isWinnerFace ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Result */}
      {phase === 'settle' && (
        <div style={{
          textAlign: 'center',
          animation: reducedMotion ? 'none' : 'reveal-in 0.6s ease-out',
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2 }}>
            Выпало
          </div>
          <div style={{
            fontSize: 28,
            fontWeight: 900,
            color: targetTeam.color,
            textShadow: `0 0 20px ${targetTeam.color}66`,
          }}>
            {targetTeam.logo && <span style={{ marginRight: 8 }}>{targetTeam.logo}</span>}
            {targetTeam.name}
          </div>
        </div>
      )}
    </div>
  );
}
