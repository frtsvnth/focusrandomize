import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';

export default function WheelAdapter({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const sectorAngle = 360 / teams.length;

  const targetRotation = useMemo(() => {
    const idx = teams.findIndex((t) => t.id === targetTeam.id);
    // Center of sector i: i * sectorAngle + sectorAngle / 2 (counter-clockwise from right)
    // We want this sector center to align with the arrow at top (270° = -90° from right)
    // After clockwise rotation by θ: sector at angle α ends up at α - θ
    // Want α - θ = -90°, so θ = α + 90°
    const centerOfTarget = idx * sectorAngle + sectorAngle / 2;
    const base = centerOfTarget + 90;
    const extraSpins = 5 + (seed % 5);
    const jitter = (seed % 100) / 100;
    const jitterDeg = (jitter - 0.5) * (sectorAngle * 0.6);
    return extraSpins * 360 + base + jitterDeg;
  }, [teams, targetTeam, seed, sectorAngle]);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setRotation(targetRotation);
      setSpinning(true);
    }, 100);
    const t2 = setTimeout(() => {
      setSpinning(false);
      onComplete();
    }, reducedMotion ? 500 : 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [targetRotation, reducedMotion, onComplete]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: 'min(55vh, 55vw)',
        height: 'min(55vh, 55vw)',
        margin: '0 auto',
        filter: 'drop-shadow(0 0 40px rgba(34,211,238,0.15))',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '100%',
          height: '100%',
          transform: `rotate(${rotation}deg)`,
          transition: spinning && !reducedMotion ? 'transform 4.2s cubic-bezier(0.15, 0, 0.15, 1)' : 'none',
        }}
      >
        <defs>
          {teams.map((t) => (
            <radialGradient key={t.id} id={`grad-${t.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={t.color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={t.color} stopOpacity={0.45} />
            </radialGradient>
          ))}
        </defs>
        {teams.map((t, i) => {
          const start = (i * sectorAngle * Math.PI) / 180;
          const end = ((i + 1) * sectorAngle * Math.PI) / 180;
          const x1 = 50 + 50 * Math.cos(start);
          const y1 = 50 + 50 * Math.sin(start);
          const x2 = 50 + 50 * Math.cos(end);
          const y2 = 50 + 50 * Math.sin(end);
          const midAngle = (i + 0.5) * sectorAngle;
          const tx = 50 + 30 * Math.cos((midAngle * Math.PI) / 180);
          const ty = 50 + 30 * Math.sin((midAngle * Math.PI) / 180);
          return (
            <g key={t.id}>
              <path
                d={`M50,50 L${x1},${y1} A50,50 0 0,1 ${x2},${y2} Z`}
                fill={`url(#grad-${t.id})`}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="0.5"
              />
              <text
                x={tx}
                y={ty}
                fill="white"
                fontSize="5.5"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
              >
                {t.name}
              </text>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <circle cx="50" cy="50" r="50" fill="none" stroke="rgba(34,211,238,0.2)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="8" fill="#0f172a" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <circle cx="50" cy="50" r="4" fill="var(--accent)" opacity="0.8" />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '-14px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '16px solid transparent',
          borderRight: '16px solid transparent',
          borderTop: '26px solid #fff',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
          zIndex: 2,
        }}
      />
    </div>
  );
}
