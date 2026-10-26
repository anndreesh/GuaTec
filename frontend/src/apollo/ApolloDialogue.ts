import { DIALOGUES, type ApolloState } from './ApolloState';
import { ApolloAudio } from './ApolloAudio';
type Line = { id:string; character:string; text:string; duration:number; channel:string; priority:number };
/** Single queue owns subtitles. Future-checkpoint speech is discarded, never overlapped. */
export class ApolloDialogue {
  private queue: Line[] = [];
  private active: Line | null = null;
  private remaining = 0;
  private checkpoint = -1;
  private last: Line | null = null;
  private replaying = false;
  constructor(private state: ApolloState, private host: HTMLElement, private audio: ApolloAudio) {}
  enter() {
    if (this.checkpoint === this.state.checkpoint) return;
    this.checkpoint = this.state.checkpoint; this.queue = []; this.active = null; this.remaining = 0;
    this.host.replaceChildren();
    for (const d of DIALOGUES) if (d.checkpoint === this.checkpoint && d.trigger === 'enter' && !this.state.dialogues.includes(d.id)) this.queue.push(d);
    this.queue.sort((a,b) => b.priority-a.priority);
  }
  say(character: string, text: string, duration = 9, channel = 'radio') {
    this.queue.push({id:'',character,text,duration,channel,priority:0});
  }
  complete(checkpoint:number) {
    const lines=DIALOGUES.filter(d=>d.checkpoint===checkpoint && d.trigger==='complete' && !this.state.dialogues.includes(d.id));
    this.queue.unshift(...lines);
  }
  repeat() {
    const d = [...DIALOGUES].reverse().find(d => d.checkpoint === this.state.checkpoint && d.trigger === 'enter');
    const line = d ?? this.last;
    if (line && !this.active) { this.queue.unshift(line); this.replaying = true; }
  }
  update(dt: number) {
    if (this.active) {
      this.remaining -= dt;
      if (this.remaining > 0) return;
      if (this.active.id && !this.replaying && !this.state.dialogues.includes(this.active.id)) this.state.dialogues.push(this.active.id);
      this.active = null; this.replaying = false; this.host.classList.remove('ap-radio-visible');
    }
    const line = this.queue.shift(); if (!line) return;
    this.active = this.last = line; this.remaining = line.duration;
    this.host.replaceChildren();
    const name = document.createElement('strong'); name.textContent = `${line.channel === 'radio' ? '◉ RADIO · ' : line.channel === 'narrator' ? 'NARRACIÓN · ' : ''}${line.character}`;
    const text = document.createElement('p'); text.textContent = line.text;
    this.host.append(name,text); this.host.classList.add('ap-radio-visible');
    if (line.channel === 'radio') this.audio.radio();
  }
  clear() { this.queue=[]; this.active=null; this.host.replaceChildren(); this.host.classList.remove('ap-radio-visible'); }
}
