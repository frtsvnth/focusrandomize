import { useCallback, useRef } from 'react';
import { useAppState } from '../state/store';

export function useSound() {
  const { state } = useAppState();
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  const playTone = useCallback(
    (freq: number, duration: number, type: OscillatorType = 'sine') => {
      if (!state.settings.soundEnabled) return;
      const ctx = ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [state.settings.soundEnabled]
  );

  const playClick = useCallback(() => {
    playTone(800, 0.08, 'square');
  }, [playTone]);

  const playWin = useCallback(() => {
    if (!state.settings.soundEnabled) return;
    const ctx = ensureCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  }, [state.settings.soundEnabled]);

  return { playClick, playWin };
}
