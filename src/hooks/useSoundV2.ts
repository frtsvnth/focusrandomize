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
  const masterBusRef = useRef<DynamicsCompressorNode | null>(null);
  const engineRef = useRef<{ osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; lfo: OscillatorNode } | null>(
    null
  );
  const windRef = useRef<{ src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null>(null);

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

  /**
   * Shared limiter bus for the tractor mechanic's overlapping continuous/one-shot sounds
   * (engine drone + wind + bumps + ejections can all stack up at once). A high-threshold
   * compressor is transparent for a single sound but caps the summed peak so simultaneous
   * layers can't clip — existing one-shot methods below are untouched and still go straight
   * to ctx.destination, since they were never observed to stack badly enough to need it.
   */
  const getMasterBus = (ctx: AudioContext) => {
    if (!masterBusRef.current) {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      compressor.connect(ctx.destination);
      masterBusRef.current = compressor;
    }
    return masterBusRef.current;
  };

  // A plain ref (not state.settings.soundEnabled read directly) so `enabled()` stays correct
  // even from a closure captured once and reused long after — e.g. TractorAdapterV2 builds
  // its Phaser initData inside an effect keyed only on `reducedMotion`, so the `sound` object
  // (and every method on it) is whatever this hook returned at ride-mount time; without a
  // live-mirroring ref, toggling mute mid-ride would silently do nothing for that ride.
  const soundEnabledRef = useRef(state.settings.soundEnabled);
  soundEnabledRef.current = state.settings.soundEnabled;
  const enabled = () => soundEnabledRef.current;

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

  // --- Tractor mechanic: engine/wind/bump sounds below --------------------------------
  // These need live-updatable, start/stop-able nodes (unlike the fire-and-forget one-shots
  // above), so they keep their own node refs and are driven every frame by the scene.

  const ENGINE_MIN_HZ = 40;
  const ENGINE_MAX_HZ = 80;
  const ENGINE_MIN_GAIN = 0.018;
  const ENGINE_MAX_GAIN = 0.065;

  const stopEngine = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    engine.gain.gain.cancelScheduledValues(t);
    engine.gain.gain.setValueAtTime(engine.gain.gain.value, t);
    engine.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    engine.osc.stop(t + 0.35);
    engine.lfo.stop(t + 0.35);
    engineRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** t01 = current speed as a 0..1 fraction of the mechanic's own reference top speed. */
  const setEngineIntensity = useCallback(
    (t01: number) => {
      if (!enabled()) {
        stopEngine();
        return;
      }
      const ctx = ensureCtx();
      const now = ctx.currentTime;
      const clamped = Math.min(1, Math.max(0, t01));

      if (!engineRef.current) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(ENGINE_MIN_HZ, now);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 220;
        filter.Q.value = 0.5;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(ENGINE_MIN_GAIN, now + 0.4);
        // Light amplitude modulation ("putter") — an LFO feeding straight into the gain's
        // own AudioParam, which sums onto its scheduled value rather than replacing it.
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 8.5;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = ENGINE_MAX_GAIN * 0.12;
        lfo.connect(lfoDepth).connect(gain.gain);
        lfo.start(now);
        const bus = getMasterBus(ctx);
        osc.connect(filter).connect(gain).connect(bus);
        osc.start(now);
        engineRef.current = { osc, filter, gain, lfo };
      }

      const engine = engineRef.current;
      const freq = ENGINE_MIN_HZ + (ENGINE_MAX_HZ - ENGINE_MIN_HZ) * clamped;
      const targetGain = ENGINE_MIN_GAIN + (ENGINE_MAX_GAIN - ENGINE_MIN_GAIN) * clamped;
      engine.osc.frequency.linearRampToValueAtTime(freq, now + 0.12);
      engine.filter.frequency.linearRampToValueAtTime(180 + clamped * 260, now + 0.12);
      engine.gain.gain.linearRampToValueAtTime(targetGain, now + 0.15);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  const stopWind = useCallback(() => {
    const wind = windRef.current;
    if (!wind) return;
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    wind.gain.gain.cancelScheduledValues(t);
    wind.gain.gain.setValueAtTime(wind.gain.gain.value, t);
    wind.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    wind.src.stop(t + 0.3);
    windRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** t01 = how high the flying character currently is (0 = ground, 1 = flight apex). */
  const setWindIntensity = useCallback(
    (t01: number) => {
      if (!enabled()) {
        stopWind();
        return;
      }
      const ctx = ensureCtx();
      const now = ctx.currentTime;
      const clamped = Math.min(1, Math.max(0, t01));

      if (clamped <= 0.001) {
        if (windRef.current) stopWind();
        return;
      }

      if (!windRef.current) {
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 700;
        filter.Q.value = 0.6;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        const bus = getMasterBus(ctx);
        src.connect(filter).connect(gain).connect(bus);
        src.start(now);
        windRef.current = { src, filter, gain };
      }

      const wind = windRef.current;
      wind.gain.gain.linearRampToValueAtTime(0.1 * clamped, now + 0.08);
      wind.filter.frequency.linearRampToValueAtTime(600 + clamped * 900, now + 0.08);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  /** intensity 0..1: 0 = a small background bump, 1 = a big mega-hump impact. */
  const playBump = useCallback(
    (intensity = 0.4) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const bus = getMasterBus(ctx);
      const clamped = Math.min(1, Math.max(0, intensity));

      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500 - clamped * 200;
      const ngain = ctx.createGain();
      const peakN = 0.07 + clamped * 0.13;
      ngain.gain.setValueAtTime(peakN, t);
      ngain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1 + clamped * 0.05);
      src.connect(filter).connect(ngain).connect(bus);
      src.start(t);
      src.stop(t + 0.2);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const startHz = 150 - clamped * 30;
      const endHz = Math.max(20, 50 - clamped * 15);
      osc.frequency.setValueAtTime(startHz, t);
      osc.frequency.exponentialRampToValueAtTime(endHz, t + 0.16);
      const ogain = ctx.createGain();
      const peakO = 0.09 + clamped * 0.17;
      ogain.gain.setValueAtTime(peakO, t);
      ogain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(ogain).connect(bus);
      osc.start(t);
      osc.stop(t + 0.22);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  /** Slide-whistle sweep for the moment a character detaches from the trailer. */
  const playEjectWhoosh = useCallback(() => {
    if (!enabled()) return;
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    const bus = getMasterBus(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.32);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.13, t + 0.05);
    gain.gain.setValueAtTime(0.13, t + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + 0.38);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.soundEnabled]);

  /** Two-tone clown-horn honk for a landed, dazed passenger. */
  const playComicHonk = useCallback(() => {
    if (!enabled()) return;
    const ctx = ensureCtx();
    const t = ctx.currentTime;
    const bus = getMasterBus(ctx);
    const notes = [340, 260];
    notes.forEach((f, i) => {
      const st = t + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, st);
      gain.gain.exponentialRampToValueAtTime(0.08, st + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.09);
      osc.connect(gain).connect(bus);
      osc.start(st);
      osc.stop(st + 0.1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.soundEnabled]);

  /** Scattered little "pop" crackles, layered under the finale fanfare for the confetti burst. */
  const playConfettiPops = useCallback(
    (count = 10) => {
      if (!enabled()) return;
      const ctx = ensureCtx();
      const t = ctx.currentTime;
      const bus = getMasterBus(ctx);
      for (let i = 0; i < count; i++) {
        const st = t + Math.random() * 0.9;
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800 + Math.random() * 1400;
        filter.Q.value = 3;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, st);
        gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.03);
        src.connect(filter).connect(gain).connect(bus);
        src.start(st);
        src.stop(st + 0.04);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings.soundEnabled]
  );

  return {
    playTick,
    playWhoosh,
    playClunk,
    playHoofbeat,
    playDrumroll,
    playFanfare,
    playCrowdCheer,
    playClick,
    setEngineIntensity,
    stopEngine,
    setWindIntensity,
    stopWind,
    playBump,
    playEjectWhoosh,
    playComicHonk,
    playConfettiPops,
  };
}
