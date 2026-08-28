import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { HideSeekScene } from './HideSeekScene';

/** Fixed landscape simulation resolution — see the comment on `width`/`height` below. */
const DESIGN_WIDTH = 1500;
const DESIGN_HEIGHT = 820;

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
  // TractorAdapterV2's `Math.min(1500, innerWidth*0.92)`), the maze's actual field is FIXED —
  // the viewport only changes how large that field is *displayed* (via the CSS below), never
  // what's actually simulated (maze size, character layout, camera math all key off this
  // constant). That keeps a given seed's maze/scatter identical on every screen.
  const width = DESIGN_WIDTH;
  const height = DESIGN_HEIGHT;

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
        // Landscape, same footprint as TractorAdapterV2 — uses the screen's own width rather
        // than being boxed into a square capped by viewport height. Purely a display size; the
        // simulated field itself stays fixed (see `width`/`height` above).
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
