import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { HideSeekScene } from './HideSeekScene';

/** Fixed square simulation resolution — see the comment on `width`/`height` below. */
const DESIGN_SIZE = 1600;

export default function HideSeekAdapterV2({
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: MechanicAdapterV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HideSeekScene | null>(null);
  const [caption, setCaption] = useState<string | null>(null);

  // Unlike the other V2 mechanics (which size their "design resolution" off the viewport, e.g.
  // TractorAdapterV2's `Math.min(1500, innerWidth*0.92)`), the maze's actual field is a FIXED
  // square — the viewport only changes how large that field is *displayed* (via the CSS below),
  // never what's actually simulated (maze size, character layout, camera math all key off this
  // constant). That keeps a given seed's maze/scatter identical on every screen.
  const width = DESIGN_SIZE;
  const height = DESIGN_SIZE;

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setCaption(null);

    const scene = new HideSeekScene({
      teams,
      targetTeam,
      seed,
      width,
      height,
      sound,
      reducedMotion,
      onCaption: (text) => {
        if (!cancelled) setCaption(text);
      },
      // The scene guarantees this always fires with exactly the targetTeam it was given (the
      // seeker's chase path is scripted straight to that team's scatter cell) — guarded by
      // `cancelled` in case the component unmounts mid-ride (presenter switches mechanics).
      onFinish: (winner) => {
        if (cancelled) return;
        onComplete(winner);
      },
    });
    sceneRef.current = scene;

    scene.mount(containerRef.current).catch((err) => {
      console.error('hideSeek: scene failed to mount', err);
    });

    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <div
      style={{
        position: 'relative',
        // Square, and sized only by the smaller viewport dimension — the field itself never
        // changes shape/content with screen size, only how big it's shown (see `width`/
        // `height` above, which stay fixed regardless of this).
        width: 'min(92vw, 82vh, 1100px)',
        aspectRatio: '1 / 1',
        borderRadius: 24,
        overflow: 'hidden',
        border: '4px solid var(--surface-2)',
        boxShadow: '0 0 50px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.3)',
        background: 'var(--bg)',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {caption && (
        <div
          className="reveal-anim"
          style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            background: 'rgba(11,18,32,0.78)',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: 0.5,
            padding: '10px 28px',
            borderRadius: 14,
            pointerEvents: 'none',
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
