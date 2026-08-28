import { useEffect, useRef, useState } from 'react';
import type { MechanicAdapterV2Props } from '../adapter';
import { HideSeekScene, type HideSeekCaption } from './HideSeekScene';

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
  const [caption, setCaption] = useState<HideSeekCaption>(null);

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
      onCaption: (next) => {
        if (!cancelled) setCaption(next);
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
        // Width picks the tightest of "92% of viewport width", "the width that would make the
        // height hit ~62% of viewport height at this exact aspect ratio", and the 1500px cap —
        // then `aspectRatio` derives height from that, so the box is never independently
        // stretched (the old `width: min(1500px,92vw); height: clamp(420px,62vh,760px)` sized
        // each axis from a *different* viewport dimension, so its actual on-screen ratio only
        // matched the fixed 1500x820 render resolution by coincidence — everything, badges
        // included, ended up visibly stretched horizontally whenever it didn't).
        width: 'min(92vw, calc(62vh * 1500 / 820), 1500px)',
        aspectRatio: `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}`,
        borderRadius: 24,
        overflow: 'hidden',
        border: '4px solid var(--surface-2)',
        boxShadow: '0 0 50px rgba(0,0,0,0.35), inset 0 0 40px rgba(0,0,0,0.3)',
        background: 'var(--bg)',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {caption?.variant === 'title' && (
        <div
          className="reveal-anim"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6%',
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, transparent 68%)',
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              fontSize: 'clamp(26px, 5.5vw, 68px)',
              lineHeight: 1.15,
              textAlign: 'center',
              color: '#e2231a',
              textShadow:
                '0 0 14px rgba(226,35,26,0.95), 0 0 36px rgba(226,35,26,0.65), 0 0 72px rgba(226,35,26,0.4), 0 4px 18px rgba(0,0,0,0.85)',
            }}
          >
            {caption.text}
          </div>
        </div>
      )}

      {caption?.variant === 'found' && (
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
          {caption.text}
        </div>
      )}
    </div>
  );
}
