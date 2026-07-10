import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';
import { mulberry32 } from '../../utils/seededRandom';

export default function TornadoAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [ejected, setEjected] = useState<Set<string>>(new Set());
  const [winnerRevealed, setWinnerRevealed] = useState(false);
  const rand = useMemo(() => mulberry32(seed), [seed]);

  const particles = useMemo(() => {
    const list: { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[] = [];
    for (let i = 0; i < 40; i++) {
      list.push({
        x: 0, y: 0,
        vx: (rand() - 0.5) * 6,
        vy: (rand() - 0.5) * 6 - 2,
        life: 0.5 + rand() * 1.5,
        color: ['#22d3ee', '#a78bfa', '#fbbf24', '#94a3b8'][Math.floor(rand() * 4)],
        size: 2 + rand() * 4,
      });
    }
    return list;
  }, [rand]);

  const teamOrbs = useMemo(() => {
    return teams.map((t, i) => ({
      id: t.id,
      color: t.color,
      name: t.name,
      angle: (i / teams.length) * Math.PI * 2,
      radius: 70 + (rand() * 50),
      speed: 0.04 + (rand() * 0.03),
      size: 30 + (rand() * 10),
    }));
  }, [teams, rand]);

  const tornadoRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const animRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      setEjected(new Set(teams.filter(t => t.id !== targetTeam.id).map(t => t.id)));
      setWinnerRevealed(true);
      const t = setTimeout(onComplete, 1000);
      return () => clearTimeout(t);
    }

    let rotation = 0;
    let running = true;

    const animate = () => {
      if (!running) return;
      rotation += 6; // faster rotation
      if (tornadoRef.current) {
        tornadoRef.current.style.transform = `rotate(${rotation}deg)`;
      }
      // Animate particles spiraling outward
      if (particlesRef.current) {
        const children = particlesRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const p = particles[i];
          if (!p) continue;
          const el = children[i] as HTMLElement;
          const t = (Date.now() / 1000 + i) % 3;
          const spiralR = 20 + t * 40;
          const spiralA = rotation * 0.05 + i * 0.5;
          el.style.transform = `translate(${Math.cos(spiralA) * spiralR}px, ${Math.sin(spiralA) * spiralR}px)`;
          el.style.opacity = String(Math.max(0, 1 - t / 3));
        }
      }
      frameRef.current++;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    const nonTarget = teams.filter(t => t.id !== targetTeam.id);
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    nonTarget.forEach((t, i) => {
      const timer = setTimeout(() => {
        setEjected(prev => new Set([...prev, t.id]));
      }, 800 + i * 600);
      timeouts.push(timer);
    });

    const winnerTimer = setTimeout(() => {
      setWinnerRevealed(true);
      running = false;
      cancelAnimationFrame(animRef.current);
    }, 800 + nonTarget.length * 600 + 500);
    timeouts.push(winnerTimer);

    const completeTimer = setTimeout(onComplete, 800 + nonTarget.length * 600 + 2500);
    timeouts.push(completeTimer);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      timeouts.forEach(clearTimeout);
    };
  }, [teams, targetTeam, rand, reducedMotion, onComplete]);

  const containerSize = 400;
  const center = containerSize / 2;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
    }}>
      {/* Tornado container */}
      <div style={{
        position: 'relative',
        width: containerSize,
        height: containerSize,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.06), transparent 70%)',
        border: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}>
        {/* Funnel */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, transparent, rgba(34,211,238,0.12), transparent, rgba(167,139,250,0.1), transparent)',
          animation: reducedMotion ? 'none' : 'spin 1.2s linear infinite',
        }} />

        {/* Particles layer */}
        <div
          ref={particlesRef}
          style={{
            position: 'absolute',
            left: center,
            top: center,
            width: 0,
            height: 0,
          }}
        >
          {particles.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                background: p.color,
                opacity: 0.7,
                boxShadow: `0 0 6px ${p.color}`,
              }}
            />
          ))}
        </div>

        {/* Team orbs */}
        <div
          ref={tornadoRef}
          style={{
            position: 'absolute',
            inset: 0,
            transition: 'none',
          }}
        >
          {teamOrbs.map((orb) => {
            const isEjected = ejected.has(orb.id);
            const isWinner = orb.id === targetTeam.id;
            const x = center + Math.cos(orb.angle) * orb.radius;
            const y = center + Math.sin(orb.angle) * orb.radius;

            if (isWinner && winnerRevealed) {
              return (
                <div
                  key={orb.id}
                  style={{
                    position: 'absolute',
                    left: center,
                    top: center,
                    transform: 'translate(-50%, -50%) scale(1.6)',
                    width: orb.size * 1.6,
                    height: orb.size * 1.6,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 30%, ${orb.color}ee, ${orb.color}aa)`,
                    boxShadow: `0 0 30px ${orb.color}aa, 0 0 60px ${orb.color}44`,
                    border: '3px solid #fff',
                    zIndex: 10,
                    transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: orb.size * 0.45,
                  }}
                >
                  {targetTeam.logo || '👑'}
                </div>
              );
            }

            return (
              <div
                key={orb.id}
                style={{
                  position: 'absolute',
                  left: isEjected ? (x > center ? x + 220 : x - 220) : x,
                  top: isEjected ? (y > center ? y + 220 : y - 220) : y,
                  transform: 'translate(-50%, -50%)',
                  opacity: isEjected ? 0 : 1,
                  transition: reducedMotion ? 'none' : 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: isWinner ? 5 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div style={{
                  width: orb.size,
                  height: orb.size,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 30%, ${orb.color}dd, ${orb.color}88)`,
                  boxShadow: `0 2px 8px ${orb.color}44`,
                }} />
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
                  {orb.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Center eye */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent)',
          boxShadow: '0 0 20px rgba(34,211,238,0.3)',
        }} />
      </div>

      {/* Winner text */}
      {winnerRevealed && (
        <div style={{
          textAlign: 'center',
          animation: reducedMotion ? 'none' : 'reveal-in 0.6s ease-out',
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 2 }}>
            В центре вихря
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

      <style>{`
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
