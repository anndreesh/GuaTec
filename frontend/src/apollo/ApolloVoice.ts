import { apolloLanguage, apolloText } from './ApolloLocale';

const preference = 'guatec.apollo11.voice';
const languageTags = { es: 'es-ES', en: 'en-US', fr: 'fr-FR' } as const;

/** Native browser synthesis, explicitly identified as synthetic rather than archival audio.
 * One instance owns its utterance. Tokens prevent cancelled Safari callbacks from ending
 * a replacement line, and every pending callback/timer is released on navigation. */
export class ApolloVoice {
  enabled = true;
  available = false;
  isSpeaking = false;
  private engine: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private token = 0;
  private paused = false;
  private disposed = false;
  private volume = .82;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastError = false;
  private watchdogRemaining = 0;
  private watchdogStarted = 0;
  private watchdog: (()=>void) | null = null;
  private readonly onVoices = () => { this.voices = this.engine?.getVoices() ?? []; };

  constructor() {
    try { this.enabled = localStorage.getItem(preference) !== 'off'; } catch {}
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    this.engine = window.speechSynthesis;
    this.available = true;
    this.onVoices();
    this.engine.addEventListener?.('voiceschanged', this.onVoices);
  }

  speak(text: string, character = 'Narrador'): void {
    this.stop();
    if (this.disposed || !this.enabled || !this.engine || !text.trim()) return;
    const language = apolloLanguage();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageTags[language];
    const matching = this.voices.filter(voice => voice.lang.toLowerCase().startsWith(language));
    // Prefer already installed voices. Different installed voices distinguish narrator
    // and Carter when the device supplies them; no new voice or paid service is required.
    const local = matching.filter(voice => voice.localService);
    const choices = local.length ? local : matching;
    const narrator = /narrad|narrat/i.test(character);
    const chosen = choices[narrator ? 0 : Math.min(1, choices.length - 1)];
    if (chosen) utterance.voice = chosen;
    utterance.rate = narrator ? .96 : 1.01;
    utterance.pitch = narrator ? .92 : 1;
    utterance.volume = this.volume;
    const token = ++this.token;
    this.utterance = utterance;
    this.isSpeaking = true;
    this.lastError = false;
    const finish = () => {
      if (token !== this.token || this.disposed) return;
      this.isSpeaking = false; this.utterance = null;
      clearTimeout(this.timer); this.timer = undefined; this.watchdog = null;
    };
    utterance.onend = finish;
    utterance.onerror = event => {
      if (token !== this.token || this.disposed) return;
      this.lastError = event.error !== 'canceled' && event.error !== 'interrupted';
      finish();
    };
    // WebKit can omit an end event after a tab interruption. Never block subtitles.
    this.watchdogRemaining=Math.max(12000,text.length*140);
    this.watchdog=()=>{if(token===this.token){this.engine?.cancel();finish();}};
    if(!this.paused)this.armWatchdog();
    try {
      if(!this.paused && this.engine.paused)this.engine.resume();
      this.engine.speak(utterance);
      if (this.paused) this.engine.pause();
    } catch { this.lastError = true; finish(); }
  }

  pause(value: boolean): void {
    this.paused = value;
    if (!this.engine || this.disposed) return;
    if(value && this.timer){clearTimeout(this.timer);this.timer=undefined;this.watchdogRemaining=Math.max(1,this.watchdogRemaining-(Date.now()-this.watchdogStarted));}
    else if(!value && this.watchdog && !this.timer)this.armWatchdog();
    try { if (value) this.engine.pause(); else this.engine.resume(); } catch {}
  }
  private armWatchdog() {
    if(!this.watchdog)return;this.watchdogStarted=Date.now();this.timer=setTimeout(this.watchdog,this.watchdogRemaining);
  }
  stop(): void {
    this.token++;
    clearTimeout(this.timer); this.timer = undefined; this.watchdog = null;
    if (this.utterance) { this.utterance.onend = null; this.utterance.onerror = null; }
    this.utterance = null; this.isSpeaking = false;
    try { this.engine?.cancel(); } catch {}
  }
  setEnabled(value: boolean): void {
    this.enabled = value;
    try { localStorage.setItem(preference, value ? 'on' : 'off'); } catch {}
    if (!value) this.stop();
  }
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.utterance) this.utterance.volume = this.volume;
  }
  status(): string {
    if (!this.available) return apolloText('Voz no disponible · subtítulos activos');
    if (!this.enabled) return apolloText('Voz desactivada · subtítulos activos');
    if (this.lastError) return apolloText('Voz no disponible · subtítulos activos');
    return apolloText('Voz sintética del navegador');
  }
  dispose(): void {
    this.stop(); this.disposed = true;
    this.engine?.removeEventListener?.('voiceschanged', this.onVoices);
    this.engine = null; this.voices = [];
  }
}
