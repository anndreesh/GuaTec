/**
 * Synthesised mission audio. Nothing is downloaded: wind, countdown beeps and
 * ignition are generated with the Web Audio API. The context is created lazily
 * after a user gesture, and every call is guarded so audio can never break the
 * mission (missing API, autoplay blocks, or a closed context are all silent).
 */

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;
let windSource: AudioBufferSourceNode | null = null;
let windGain: GainNode | null = null;
let muted = false;
let masterBus: GainNode | null = null;
let ambienceBus: GainNode | null = null;
let effectsBus: GainNode | null = null;
let machineryBus: GainNode | null = null;
let windLevel = 0.12;
let footstepClock = 0;
let footstepBuffer: AudioBuffer | null = null;

function ensureBuses(ctx: AudioContext): void {
  if (masterBus) return;
  masterBus = ctx.createGain();
  ambienceBus = ctx.createGain();
  effectsBus = ctx.createGain();
  machineryBus = ctx.createGain();
  masterBus.gain.value = muted ? 0 : 0.82;
  ambienceBus.gain.value = 0.72;
  effectsBus.gain.value = 0.8;
  machineryBus.gain.value = 0.88;
  ambienceBus.connect(masterBus);
  effectsBus.connect(masterBus);
  machineryBus.connect(masterBus);
  masterBus.connect(ctx.destination);
}

function ensureContext(): AudioContext | null {
  try {
    if (!context) {
      const Constructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Constructor) return null;
      context = new Constructor();
      ensureBuses(context);
    }
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

export const missionAudio = {
  /** Starts looping, low-passed wind. Call from a user gesture (e.g. the opening button). */
  startWind(level = 0.12): void {
    const ctx = ensureContext();
    if (!ctx || windSource) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, 2);
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      windLevel = Math.max(0, Math.min(0.5, level));
      gain.gain.value = windLevel;
      source.connect(filter).connect(gain).connect(ambienceBus ?? ctx.destination);
      source.start();
      windSource = source;
      windGain = gain;
    } catch {
      windSource = null;
      windGain = null;
    }
  },

  /** Smoothly changes the wind level, e.g. to emphasise the exterior at the observation area. */
  setWindLevel(level: number): void {
    windLevel = Math.max(0, Math.min(0.5, level));
    if (!context || !windGain) return;
    try {
      windGain.gain.setTargetAtTime(windLevel, context.currentTime, 0.6);
    } catch {
      /* audio is optional */
    }
  },

  stopWind(): void {
    try {
      windSource?.stop();
    } catch {
      /* already stopped */
    }
    windSource?.disconnect();
    windGain?.disconnect();
    windSource = null;
    windGain = null;
  },

  /** Short countdown tone; higher pitch for the final seconds. */
  beep(frequency: number): void {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      oscillator.connect(gain).connect(effectsBus ?? ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch {
      /* audio is optional */
    }
  },

  /** Roar of the engine: a noise burst whose filter closes as the vehicle climbs away. */
  ignition(): void {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, 3);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 2.8);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.9);
      source.connect(filter).connect(gain).connect(machineryBus ?? ctx.destination);
      ambienceBus?.gain.setTargetAtTime(0.22, ctx.currentTime, 0.12);
      ambienceBus?.gain.setTargetAtTime(0.72, ctx.currentTime + 2.7, 0.65);
      source.start();
      source.stop(ctx.currentTime + 3);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    } catch {
      /* audio is optional */
    }
  },

  setMuted(value: boolean): void {
    muted = value;
    if (context && masterBus) masterBus.gain.setTargetAtTime(value ? 0 : 0.82, context.currentTime, 0.08);
  },

  isMuted(): boolean { return muted; },

  feedback(type: "input" | "error" | "success"): void {
    this.beep(type === "error" ? 160 : type === "success" ? 880 : 430);
  },

  /** One dry, spatially subtle step on the current field surface. */
  footstep(surface: "earth" | "wood" = "earth", running = false): void {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;
    try {
      footstepBuffer ??= noiseBuffer(ctx, 0.16);
      const source = ctx.createBufferSource();
      source.buffer = footstepBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = surface === "wood" ? 680 : 330;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const level = (surface === "wood" ? 0.09 : 0.12) * (running ? 1.16 : 1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      source.connect(filter).connect(gain).connect(effectsBus ?? ctx.destination);
      source.start(now);
      source.stop(now + 0.16);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    } catch {
      /* audio is optional */
    }
  },

  /** Frame-step cadence is stateful here so callers do not allocate timers. */
  updateFootsteps(walking: boolean, running: boolean, deltaSeconds: number, surface: "earth" | "wood" = "earth"): void {
    if (!walking) { footstepClock = Math.min(footstepClock, 0.12); return; }
    footstepClock -= Math.max(0, Math.min(deltaSeconds, 0.05));
    if (footstepClock > 0) return;
    this.footstep(surface, running);
    footstepClock = running ? 0.31 : 0.43;
  },
};
