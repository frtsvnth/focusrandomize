import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicAdapterProps } from '../adapter';

export default function SlotMachineAdapter({
  teams,
  targetTeam,
  seed: _seed,
  reducedMotion,
  onComplete,
}: MechanicAdapterProps) {
  const [spinning, setSpinning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => [...teams, ...teams, ...teams], [teams]);
  const itemH = 90;

  const targetIdx = teams.findIndex((t) => t.id === targetTeam.id);
  const baseOffset = teams.length * itemH;
  const finalOffset = baseOffset + targetIdx * itemH - (150 - itemH / 2);
  const startOffset = 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    void el.offsetHeight;
    el.style.transform = `translateY(-${finalOffset}px)`;

    const t = setTimeout(() => {
      setSpinning(false);
      onComplete();
    }, reducedMotion ? 400 : 3600);
    return () => clearTimeout(t);
  }, [finalOffset, reducedMotion, onComplete]);

  return (
    <div
      style={{
        width: 340,
        height: 320,
        margin: '0 auto',
        background: 'linear-gradient(180deg, #1e293b, #0f172a)',
        borderRadius: 20,
        border: '3px solid #334155',
        boxShadow: '0 0 40px rgba(34,211,238,0.12), inset 0 0 20px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top light */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 4,
        background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
        opacity: 0.6,
        zIndex: 3,
      }} />
      {/* Center line marker */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--warning), transparent)',
          transform: 'translateY(-50%)',
          zIndex: 2,
          boxShadow: '0 0 12px var(--warning)',
        }}
      />
      {/* Side gradients for depth */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.4), transparent 15%, transparent 85%, rgba(0,0,0,0.4))', pointerEvents: 'none', zIndex: 2 }} />
      <div
        ref={containerRef}
        style={{
          transform: `translateY(-${startOffset}px)`,
          transition: spinning && !reducedMotion
            ? 'transform 3.4s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
        }}
      >
        {list.map((t, i) => (
          <div
            key={`${t.id}-${i}`}
            style={{
              height: itemH,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 800,
              color: '#fff',
              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: t.color,
                marginRight: 14,
                boxShadow: `0 0 10px ${t.color}88`,
              }}
            />
            {t.name}
          </div>
        ))}
      </div>
    </div>
  );
}
