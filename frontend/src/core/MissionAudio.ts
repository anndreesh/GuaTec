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

function ensureContext(): AudioContext | null {
  try {
    if (!context) {
      const Constructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Constructor) return null;
      context = new Constructor();
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
      gain.gain.value = level;
      source.connect(filter).connect(gain).connect(ctx.destination);
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
    if (!context || !windGain) return;
    try {
      windGain.gain.setTargetAtTime(level, context.currentTime, 0.6);
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
    windSource = null;
    windGain = null;
  },

  /** Short countdown tone; higher pitch for the final seconds. */
  beep(frequency: number): void {
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
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch {
      /* audio is optional */
    }
  },

  /** Roar of the engine: a noise burst whose filter closes as the vehicle climbs away. */
  ignition(): void {
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
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      source.stop(ctx.currentTime + 3);
    } catch {
      /* audio is optional */
    }
  },
};
