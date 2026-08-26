import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { MechanicAdapterV2Props } from '../adapter';
import type { Team } from '../../domain/types';
import { TeamBadge } from '../../components/shared/TeamBadge';
import { useAppState } from '../../state/store';
import { createTractorScene, type TractorInitData } from './TractorScene';

export default function TractorAdapterV2({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [ejectedTeams, setEjectedTeams] = useState<Team[]>([]);
  const { state } = useAppState();
  const theme = state.settings.theme;

  // Phaser's own "design resolution" — fixed for the life of one ride (all of the scene's
  // texture/layout math is sized from it at create() time). Resize/rotation is handled by
  // Phaser's Scale.FIT mode instead of rebuilding this: the wrapper below uses the exact same
  // formula as *responsive CSS* (min()/clamp()), so the browser resizes the parent element and
  // FIT + autoCenter rescale the canvas to match, without touching this number.
  const width = Math.min(1500, typeof window !== 'undefined' ? window.innerWidth * 0.92 : 1100);
  const height = Math.min(
    760,
    Math.max(420, typeof window !== 'undefined' ? window.innerHeight * 0.62 : 560)
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setEjectedTeams([]);

    (async () => {
      const Phaser = await import('phaser');
      if (cancelled || !containerRef.current) return;

      const initData: TractorInitData = {
        teams,
        targetTeam,
        seed,
        width,
        height,
        sound,
        // The scene guarantees this always fires with exactly the targetTeam it was given
        // (buildRunPlan never ejects the winner) — the ride is pure theater around an
        // already-decided pick, so onComplete here is never anything else. Guarded by
        // `cancelled` too: if the component unmounts mid-ride (e.g. the presenter switches
        // mechanics), the game is destroyed and its update loop stops, but this callback
        // reference could in principle still be invoked from in-flight scene code during the
        // same tick destroy() runs on — the flag makes that a guaranteed no-op.
        onFinish: (winner) => {
          if (cancelled) return;
          onComplete(winner);
        },
        onEject: (team) => {
          if (cancelled) return;
          setEjectedTeams((prev) => [...prev, team]);
        },
        // Accessibility mode: the scene plays a real, shortened ride with camera shake/
        // slow-mo/hit-stop and ambient particles all disabled (see TractorScene's
        // `juiceEnabled` gating), rather than skipping straight to the reveal — a presenter
        // with reducedMotion on still sees who's up, just without the flourishes.
        reducedMotion,
      };

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width,
        height,
        transparent: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: 'arcade',
          arcade: { debug: false },
        },
        // All sound goes through the shared useSoundV2 hook's own AudioContext — Phaser's
        // built-in sound manager is never touched, but by default it still opens its own
        // AudioContext per Game instance. Since every ride creates a fresh Phaser.Game, that
        // leaked one real (if short-lived) AudioContext per ride; disabling it here is free.
        audio: { noAudio: true },
        scene: createTractorScene(Phaser),
      });
      game.scene.start('Tractor', initData);
      gameRef.current = game;
    })();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // Space/Enter fast-forwards the active ride (the scene compresses whatever's left into a
  // few seconds); PresenterModeV2's own global Space/Enter handler already no-ops while a
  // ride is `animating`, so no stopPropagation/coordination is needed here — once the ride
  // actually finishes (onFinish → onComplete → animating=false), this listener's emit becomes
  // a harmless no-op in the scene, and the SAME keypress's bubble to the global handler is
  // what performs the app's standard "dismiss reveal" behavior.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      gameRef.current?.events.emit('tractor-fast-forward');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A theme switch mid-ride repaints the live scene in place — no Game re-creation. Skips the
  // very first run (that's just the initial theme the ride already built itself with).
  const isFirstThemeRender = useRef(true);
  useEffect(() => {
    if (isFirstThemeRender.current) {
      isFirstThemeRender.current = false;
      return;
    }
    gameRef.current?.events.emit('tractor-theme-change');
  }, [theme]);

  const remainingCount = teams.length - ejectedTeams.length;

  return (
    <div
      style={{
        position: 'relative',
        width: 'min(1500px, 92vw)',
        height: 'clamp(420px, 62vh, 760px)',
        borderRadius: 24,
        overflow: 'hidden',
        border: '4px solid var(--surface-2)',
        boxShadow: '0 0 50px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.3)',
        background: 'var(--bg)',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 2,
          background: 'rgba(11,18,32,0.72)',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
          fontSize: 15,
          padding: '6px 12px',
          borderRadius: 10,
          pointerEvents: 'none',
        }}
      >
        В кузове: {remainingCount}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 2,
          background: 'rgba(11,18,32,0.6)',
          color: 'var(--text-dim)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 1,
          padding: '6px 10px',
          borderRadius: 10,
          pointerEvents: 'none',
        }}
      >
        ⏩ Пробел — ускорить
      </div>

      {ejectedTeams.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 2,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {ejectedTeams.map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              className="reveal-anim"
              style={{
                background: 'rgba(11,18,32,0.72)',
                border: `1px solid ${t.color}55`,
                borderRadius: 10,
                padding: '5px 10px',
                fontSize: 12,
              }}
            >
              <TeamBadge team={t} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
