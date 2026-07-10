import { useEffect, useMemo, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';

type Phase = 'arrive' | 'scan' | 'lock' | 'abduct' | 'done';

export default function AlienAbductionAdapter({
  teams,
  targetTeam,
  seed: _seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [phase, setPhase] = useState<Phase>('arrive');
  const [ufoX, setUfoX] = useState(50);
  const [beamOn, setBeamOn] = useState(false);
  const [beamTargetX, setBeamTargetX] = useState(50);
  const [abductProgress, setAbductProgress] = useState(0);
  const [cowVisible, setCowVisible] = useState(true);

  const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);

  const teamPositions = useMemo(() => {
    const count = teams.length;
    return teams.map((t, i) => ({
      id: t.id,
      x: 10 + ((i + 0.5) / count) * 80,
      color: t.color,
      name: t.name,
      logo: t.logo || '',
    }));
  }, [teams]);

  const targetPos = teamPositions[targetIdx];

  useEffect(() => {
    if (reducedMotion) {
      setPhase('done');
      setUfoX(targetPos.x);
      setBeamOn(true);
      setBeamTargetX(targetPos.x);
      setAbductProgress(1);
      setCowVisible(false);
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }

    setPhase('arrive');
    setUfoX(50);
    setBeamOn(false);
    setAbductProgress(0);
    setCowVisible(true);

    // UFO arrives from top
    const t1 = setTimeout(() => {
      setPhase('scan');
      setBeamOn(true);
    }, 600);

    // Scan back and forth
    const t2 = setTimeout(() => setBeamTargetX(20), 900);
    const t3 = setTimeout(() => setBeamTargetX(80), 1400);
    const t4 = setTimeout(() => setBeamTargetX(35), 1900);
    const t5 = setTimeout(() => setBeamTargetX(65), 2400);

    // Lock on target
    const t6 = setTimeout(() => {
      setPhase('lock');
      setBeamTargetX(targetPos.x);
      setUfoX(targetPos.x);
    }, 3000);

    // Abduct
    const t7 = setTimeout(() => {
      setPhase('abduct');
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.025;
        setAbductProgress(Math.min(1, progress));
        if (progress >= 0.7) setCowVisible(false);
        if (progress >= 1) {
          clearInterval(interval);
          setPhase('done');
        }
      }, 30);
    }, 3600);

    const t8 = setTimeout(onComplete, 6000);

    return () => {
      [t1, t2, t3, t4, t5, t6, t7, t8].forEach(clearTimeout);
    };
  }, [reducedMotion, onComplete, targetPos]);

  const fieldW = Math.min(560, window.innerWidth * 0.75);
  const fieldH = 340;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    }}>
      {/* Sky/Field */}
      <div style={{
        position: 'relative',
        width: fieldW,
        height: fieldH,
        background: 'linear-gradient(180deg, #0a0e27 0%, #0f1a3a 60%, #1a3a2a 60%, #143320 100%)',
        borderRadius: 16,
        border: '2px solid #1a1f4a',
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(34,211,238,0.06)',
      }}>
        {/* Stars */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(1.5px 1.5px at 15% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 45% 15%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 75% 25%, #fff, transparent), radial-gradient(1.5px 1.5px at 85% 10%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 25% 35%, #fff, transparent)',
          pointerEvents: 'none',
        }} />

        {/* Ground line */}
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          top: '60%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.3), transparent)',
        }} />

        {/* Grass dots */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${8 + i * 8}%`,
            top: `${62 + (i % 3) * 3}%`,
            width: 2,
            height: 4,
            background: 'rgba(34,197,94,0.3)',
            borderRadius: 1,
          }} />
        ))}

        {/* UFO */}
        <div style={{
          position: 'absolute',
          left: `${ufoX}%`,
          top: '8%',
          transform: 'translateX(-50%)',
          transition: reducedMotion ? 'none' : phase === 'lock' ? 'left 0.6s ease-out' : 'left 0.3s ease-out',
          zIndex: 20,
        }}>
          {/* UFO body */}
          <div style={{
            width: 80,
            height: 24,
            borderRadius: '50%',
            background: 'linear-gradient(180deg, #94a3b8, #475569)',
            boxShadow: '0 4px 20px rgba(148,163,184,0.4)',
            position: 'relative',
          }}>
            {/* Dome */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: -14,
              transform: 'translateX(-50%)',
              width: 30,
              height: 18,
              borderRadius: '50% 50% 0 0',
              background: 'linear-gradient(180deg, rgba(34,211,238,0.4), rgba(34,211,238,0.1))',
              border: '1px solid rgba(34,211,238,0.3)',
            }} />
            {/* Lights */}
            {[0, 1, 2, 3, 4].map((li) => (
              <div key={li} style={{
                position: 'absolute',
                left: `${10 + li * 18}%`,
                top: '50%',
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#22d3ee',
                boxShadow: '0 0 6px #22d3ee',
                animation: `pulse-glow ${0.6 + li * 0.15}s ease-in-out infinite alternate`,
              }} />
            ))}
          </div>

          {/* Beam */}
          {beamOn && (
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              transform: `translateX(-50%)`,
              width: phase === 'abduct' ? 50 : 30,
              height: phase === 'abduct' ? 170 : 150,
              background: `linear-gradient(180deg, rgba(34,211,238,0.25), rgba(34,211,238,0.05))`,
              clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)',
              transition: reducedMotion ? 'none' : 'all 0.5s',
              opacity: phase === 'done' ? 0 : 1,
              animation: reducedMotion ? 'none' : 'pulse-glow 0.8s ease-in-out infinite alternate',
            }} />
          )}
        </div>

        {/* Teams on ground */}
        {teamPositions.map((tp) => {
          const isTarget = tp.id === targetTeam.id;
          const isAbducting = isTarget && phase === 'abduct';

          return (
            <div
              key={tp.id}
              style={{
                position: 'absolute',
                left: `${tp.x}%`,
                top: isAbducting ? `${65 - abductProgress * 45}%` : '68%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                transition: reducedMotion ? 'none' : isAbducting ? 'top 0.05s linear' : 'none',
                opacity: isTarget && !cowVisible ? 0 : 1,
                zIndex: isTarget ? 10 : 1,
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, ${tp.color}dd, ${tp.color}88)`,
                boxShadow: `0 2px 10px ${tp.color}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                border: isTarget && phase === 'lock' ? '2px solid #22d3ee' : 'none',
              }}>
                {tp.logo || '👤'}
              </div>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#e2e8f0',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                background: 'rgba(0,0,0,0.5)',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                {tp.name}
              </div>
            </div>
          );
        })}

        {/* Scanning beam movement indicator */}
        {phase === 'scan' && (
          <div style={{
            position: 'absolute',
            left: `${beamTargetX}%`,
            top: '20%',
            transform: 'translateX(-50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#22d3ee',
            boxShadow: '0 0 10px #22d3ee',
            transition: reducedMotion ? 'none' : 'left 0.5s ease-in-out',
            opacity: 0.6,
          }} />
        )}
      </div>

      {/* Result */}
      {phase === 'done' && (
        <div style={{
          textAlign: 'center',
          animation: reducedMotion ? 'none' : 'reveal-in 0.6s ease-out',
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2 }}>
            Похищена
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
