import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import type { MechanicAdapterV2Props } from '../adapter';
import ToyRaceScene, { type ToyRaceInitData } from './ToyRaceScene';

type Phase = 'countdown' | 'racing' | 'finished';

export default function ToyRaceAdapterV2({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);

  const width = Math.min(1700, typeof window !== 'undefined' ? window.innerWidth * 0.96 : 1200);
  const height = Math.min(
    880,
    Math.max(460, typeof window !== 'undefined' ? window.innerHeight * 0.7 : 620)
  );

  useEffect(() => {
    if (reducedMotion) {
      const t1 = setTimeout(() => setPhase('finished'), 300);
      const t2 = setTimeout(() => onComplete(targetTeam), 700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    setPhase('countdown');
    setCountdown(3);
    let cd = 3;
    const cdTimer = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd < 0) {
        clearInterval(cdTimer);
        setPhase('racing');
      }
    }, 750);
    return () => clearInterval(cdTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== 'racing' || !containerRef.current) return;

    const initData: ToyRaceInitData = {
      teams,
      targetTeam,
      seed,
      width,
      height,
      sound,
      onFinish: () => setPhase('finished'),
    };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width,
      height,
      transparent: true,
      scene: ToyRaceScene,
      fps: { target: 60 },
    });
    game.scene.start('ToyRace', initData);
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'finished') {
      const t = setTimeout(() => onComplete(targetTeam), 900);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete, targetTeam]);

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 24,
        overflow: 'hidden',
        border: '4px solid #234a2b',
        boxShadow: '0 0 50px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.3)',
        background: 'linear-gradient(180deg, #2f6b3a, #1c4526)',
      }}
    >
      {phase === 'racing' && <div ref={containerRef} style={{ width, height }} />}

      {phase === 'countdown' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              fontSize: countdown > 0 ? 128 : 56,
              fontWeight: 900,
              color: countdown > 0 ? '#fbbf24' : '#22c55e',
              textShadow:
                countdown > 0
                  ? '0 0 40px rgba(251,191,36,0.6), 0 4px 8px rgba(0,0,0,0.5)'
                  : '0 0 40px rgba(34,197,94,0.6), 0 4px 8px rgba(0,0,0,0.5)',
              letterSpacing: 4,
              animation: 'countdown-pop 0.3s ease-out',
            }}
          >
            {countdown > 0 ? countdown : 'СТАРТ!'}
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="reveal-anim"
            style={{
              textAlign: 'center',
              background: 'rgba(0,0,0,0.6)',
              padding: '28px 44px',
              borderRadius: 20,
              border: '2px solid rgba(255,255,255,0.12)',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 10 }}>🏆</div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: targetTeam.color,
                textShadow: `0 0 24px ${targetTeam.color}88`,
              }}
            >
              {targetTeam.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
