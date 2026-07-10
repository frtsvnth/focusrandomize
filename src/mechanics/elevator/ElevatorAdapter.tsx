import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';

type Phase = 'arriving' | 'opening' | 'reveal' | 'done';

export default function ElevatorAdapter({
  teams: _teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [phase, setPhase] = useState<Phase>('arriving');
  const [floor, setFloor] = useState(1);
  const [doorOpen, setDoorOpen] = useState(0);

  const floors = useMemo(() => {
    const rng = seed % 1000;
    const startFloor = 1;
    const targetFloor = 3 + (rng % 8);
    const sequence: number[] = [];
    for (let i = startFloor; i <= targetFloor; i++) sequence.push(i);
    return { sequence, targetFloor };
  }, [seed]);

  useEffect(() => {
    if (reducedMotion) {
      setPhase('reveal');
      setDoorOpen(1);
      setFloor(floors.targetFloor);
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }

    setPhase('arriving');
    setDoorOpen(0);
    setFloor(1);

    const floorDelays = floors.sequence.map((f, i) =>
      setTimeout(() => setFloor(f), 300 + i * 350)
    );

    const openTimer = setTimeout(() => {
      setPhase('opening');
      let progress = 0;
      const openInterval = setInterval(() => {
        progress += 0.06;
        setDoorOpen(Math.min(1, progress));
        if (progress >= 1) {
          clearInterval(openInterval);
          setPhase('reveal');
        }
      }, 30);
    }, 300 + floors.sequence.length * 350 + 400);

    const doneTimer = setTimeout(() => {
      setPhase('done');
      const completeTimer = setTimeout(onComplete, 1400);
      return () => clearTimeout(completeTimer);
    }, 300 + floors.sequence.length * 350 + 400 + 2000);

    return () => {
      floorDelays.forEach(clearTimeout);
      clearTimeout(openTimer);
      clearTimeout(doneTimer);
    };
  }, [reducedMotion, onComplete, floors]);

  const lightColor = targetTeam.color;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: '20px 0',
      }}
    >
      {/* Floor indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(0,0,0,0.4)',
          padding: '14px 28px',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Этаж
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: phase === 'arriving' ? 'var(--accent)' : lightColor,
            textShadow: `0 0 20px ${phase === 'arriving' ? 'var(--accent)' : lightColor}66`,
            transition: 'color 0.2s',
            minWidth: 60,
            textAlign: 'center',
          }}
        >
          {floor}
        </div>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: phase === 'arriving' ? 'var(--accent)' : lightColor,
            boxShadow: `0 0 10px ${phase === 'arriving' ? 'var(--accent)' : lightColor}`,
            animation: phase === 'arriving' ? 'pulse-glow 0.5s ease-in-out infinite' : 'none',
          }}
        />
      </div>

      {/* Elevator shaft */}
      <div
        style={{
          position: 'relative',
          width: 340,
          height: 400,
          background: 'linear-gradient(180deg, #0a0f1e, #060912)',
          borderRadius: 12,
          border: '2px solid #1e293b',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Shaft lines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(0deg, transparent 49%, rgba(255,255,255,0.02) 49%, rgba(255,255,255,0.02) 51%, transparent 51%)',
          backgroundSize: '100% 40px',
          pointerEvents: 'none',
        }} />

        {/* Elevator car */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: 16,
            bottom: 16,
            background: 'linear-gradient(180deg, #1e293b, #0f172a)',
            borderRadius: 8,
            border: '2px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Top light */}
          <div style={{
            height: 4,
            background: phase === 'reveal' || phase === 'done'
              ? `linear-gradient(90deg, transparent, ${lightColor}, transparent)`
              : 'linear-gradient(90deg, transparent, var(--text-dim), transparent)',
            opacity: 0.6,
            transition: 'all 0.5s',
          }} />

          {/* Doors container */}
          <div style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            overflow: 'hidden',
          }}>
            {/* Left door */}
            <div style={{
              width: `${50 + doorOpen * 45}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1a2535, #2a3a4d)',
              borderRight: '1px solid #334155',
              transition: reducedMotion ? 'none' : 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              zIndex: 2,
            }}>
              <div style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: 40,
                background: '#475569',
                borderRadius: 2,
              }} />
            </div>

            {/* Right door */}
            <div style={{
              width: `${50 + doorOpen * 45}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #2a3a4d, #1a2535)',
              borderLeft: '1px solid #334155',
              transition: reducedMotion ? 'none' : 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              zIndex: 2,
            }}>
              <div style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: 40,
                background: '#475569',
                borderRadius: 2,
              }} />
            </div>

            {/* Interior / Reveal with team name */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: 'radial-gradient(circle at 50% 30%, rgba(0,0,0,0.85), #0a0f1e)',
              zIndex: 1,
              opacity: doorOpen > 0.3 ? 1 : 0,
              transition: 'opacity 0.4s',
            }}>
              {doorOpen > 0.3 && (
                <>
                  <div style={{
                    fontSize: 52,
                    filter: `drop-shadow(0 0 20px ${lightColor}88)`,
                    animation: reducedMotion ? 'none' : 'reveal-in 0.5s ease-out',
                  }}>
                    {targetTeam.logo || '🏢'}
                  </div>
                  <div style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: lightColor,
                    textShadow: `0 0 20px ${lightColor}66`,
                    animation: reducedMotion ? 'none' : 'reveal-in 0.5s ease-out 0.1s both',
                    textAlign: 'center',
                    padding: '0 12px',
                  }}>
                    {targetTeam.name}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    animation: reducedMotion ? 'none' : 'reveal-in 0.5s ease-out 0.2s both',
                  }}>
                    Следующая команда
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Floor indicator inside */}
          <div style={{
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid #334155',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ЭТАЖ</div>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              color: phase === 'arriving' ? 'var(--accent)' : lightColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {floor}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
