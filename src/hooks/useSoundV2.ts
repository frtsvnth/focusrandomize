import { useCallback, useRef } from 'react';
import { useAppState } from '../state/store';

/**
 * Richer procedural sound engine for the V2 show, built purely on WebAudio
 * oscillators/noise (no audio assets) so it stays a static, GitHub-Pages-friendly bundle.
 */
export function useSoundV2() {
  const { state } = useAppState();
  const ctxRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const getNoiseBuffer = (ctx: AudioContext) => {
    if (!noiseBufferRef.current) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noiseBufferRef.current = buffer;
    }
    return noiseBufferRef.current;
  };

  const enabled = () => state.settings.soundEnabled;

  const playTick = useCallback(
    (pitch = 1) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100 * pitch, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  const playWhoosh = useCallback(
    (duration = 0.5) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.exponentialRampToValueAtTime(2400, t + duration * 0.6);
      filter.frequency.exponentialRampToValueAtTime(200, t + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t);
      src.stop(t + duration + 0.05);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  const playClunk = useCallback(
    (pitch = 1) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(60 * pitch, t + 0.12);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);

      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      const ngain = ctx.createGain();
      ngain.gain.setValueAtTime(0.12, t);
      ngain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      src.connect(filter).connect(ngain).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  const playHoofbeat = useCallback(
    (pitch = 1) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350 * pitch;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  const playDrumroll = useCallback(
    (duration = 1.2) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const steps = Math.floor(duration / 0.06);
      for (let i = 0; i < steps; i++) {
        const st = t + i * 0.06;
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 250;
        const gain = ctx.createGain();
        const vol = 0.05 + (i / steps) * 0.1;
        gain.gain.setValueAtTime(vol, st);
        gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.05);
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(st);
        src.stop(st + 0.06);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  const playFanfare = useCallback(() => {
    if (!enabled()) return;
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    const chords = [
      [523.25, 659.25, 783.99],
      [587.33, 739.99, 880.0],
      [659.25, 830.61, 987.77],
      [783.99, 987.77, 1174.66],
    ];
    chords.forEach((chord, i) => {
      const st = t + i * 0.14;
      chord.forEach((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 3200;
        gain.gain.setValueAtTime(0.0001, st);
        gain.gain.exponentialRampToValueAtTime(0.055, st + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
        osc.connect(filter).connect(gain).connect(ctx.destination);
        osc.start(st);
        osc.stop(st + 0.55);
      });
    });
    // sparkle tail
    for (let i = 0; i < 10; i++) {
      const st = t + 0.5 + i * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1400 + Math.random() * 900;
      gain.gain.setValueAtTime(0.0001, st);
      gain.gain.exponentialRampToValueAtTime(0.04, st + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.16);
    }
  }, [state.settings.soundEnabled]);

  const playCrowdCheer = useCallback(
    (duration = 1.4) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.linearRampToValueAtTime(1400, t + duration * 0.4);
      filter.frequency.linearRampToValueAtTime(500, t + duration);
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + duration * 0.2);
      gain.gain.setValueAtTime(0.14, t + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t);
      src.stop(t + duration + 0.05);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  const playClick = useCallback(() => {
    if (!enabled()) return;
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(760, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.soundEnabled]);

  return {
    playTick,
    playWhoosh,
    playClunk,
    playHoofbeat,
    playDrumroll,
    playFanfare,
    playCrowdCheer,
    playClick,
  };
}
