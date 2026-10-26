/** Original synthesized ambience and score. No archival recording or licensed music. */
export class ApolloAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private roar: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  muted = false;
  async start() {
    if (this.ctx) { await this.ctx.resume(); return; }
    const c = this.ctx = new AudioContext();
    this.master = c.createGain(); this.master.gain.value = .38; this.master.connect(c.destination);
    const buffer = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const data = buffer.getChannelData(0); let low = 0;
    for (let i = 0; i < data.length; i++) { low = (low + (Math.random() * 2 - 1) * .02) / 1.02; data[i] = low * 3; }
    const noise = c.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 550;
    this.ambience = c.createGain(); this.ambience.gain.value = .25;
    noise.connect(filter).connect(this.ambience).connect(this.master); noise.start(); this.sources.push(noise);
    // Quiet original harmonic bed, deliberately sparse under radio dialogue.
    [130.81, 196, 261.63].forEach((frequency, i) => {
      const oscillator = c.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      const gain = c.createGain(); gain.gain.value = .012 / (i + 1);
      oscillator.connect(gain).connect(this.master!); oscillator.start(); this.sources.push(oscillator);
    });
    const engine = c.createBufferSource(); engine.buffer = buffer; engine.loop = true;
    const bass = c.createBiquadFilter(); bass.type = 'lowpass'; bass.frequency.value = 180;
    this.roar = c.createGain(); this.roar.gain.value = 0;
    engine.connect(bass).connect(this.roar).connect(this.master); engine.start(); this.sources.push(engine);
    await c.resume();
  }
  launch(elapsed: number, distance: number) {
    if (!this.ctx || !this.roar) return;
    // At observation distance, pressure arrives after distance / speed of sound.
    const soundTime = elapsed - 1 - distance / 343;
    this.roar.gain.setTargetAtTime(soundTime < 0 ? 0 : Math.min(.95, soundTime / 9), this.ctx.currentTime, .12);
  }
  step() {
    if(!this.ctx || !this.master)return;
    const c=this.ctx,tone=c.createOscillator(),gain=c.createGain();
    tone.type='triangle';tone.frequency.setValueAtTime(110,c.currentTime);
    tone.frequency.exponentialRampToValueAtTime(40,c.currentTime+.1);
    gain.gain.setValueAtTime(.035,c.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.12);
    tone.connect(gain).connect(this.master);tone.start();tone.stop(c.currentTime+.13);
  }
  stopLaunch() { if(this.ctx && this.roar)this.roar.gain.setTargetAtTime(0,this.ctx.currentTime,.2); }
  radio() {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, tone = c.createOscillator(), gain = c.createGain();
    tone.frequency.value = 920; gain.gain.setValueAtTime(.025, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .13);
    tone.connect(gain).connect(this.master); tone.start(); tone.stop(c.currentTime + .14);
  }
  toggle() { this.muted = !this.muted; if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : .38, this.ctx.currentTime, .08); }
  pause(paused: boolean) { if (!this.ctx) return; if (paused) void this.ctx.suspend(); else void this.ctx.resume(); }
  dispose() { this.sources.forEach(s => { try { s.stop(); } catch {} }); this.sources = []; void this.ctx?.close(); this.ctx = null; }
}
