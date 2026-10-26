import { DIALOGUES, type ApolloState } from './ApolloState';
import { ApolloAudio } from './ApolloAudio';
import { ApolloVoice } from './ApolloVoice';
import { apolloText } from './ApolloLocale';

type Line = { id:string; character:string; text:string; duration:number; channel:string; priority:number; replay?:boolean };

/** A single queue owns both subtitles and speech. Never schedule future-stage dialogue. */
export class ApolloDialogue {
  private queue: Line[] = [];
  private active: Line | null = null;
  private remaining = 0;
  private checkpoint = -1;
  private last: Line | null = null;
  constructor(private state: ApolloState, private host: HTMLElement, private audio: ApolloAudio, private voice?: ApolloVoice) {}

  enter() {
    if(this.checkpoint===this.state.checkpoint)return;
    this.checkpoint=this.state.checkpoint;
    this.clear();
    for(const line of DIALOGUES)if(line.checkpoint===this.checkpoint && line.trigger==='enter' && !this.state.dialogues.includes(line.id))this.queue.push(line);
    this.queue.sort((a,b)=>b.priority-a.priority);
  }
  say(character:string,text:string,duration=9,channel='radio') {
    this.queue.push({id:'',character,text,duration,channel,priority:0});
  }
  complete(checkpoint:number) {
    if(checkpoint>this.state.checkpoint)return;
    const lines=DIALOGUES.filter(line=>line.checkpoint===checkpoint && line.trigger==='complete' && !this.state.dialogues.includes(line.id) && !this.queue.some(queued=>queued.id===line.id));
    this.queue.unshift(...lines);
  }
  repeat() {
    // A radio repeat during speech restarts the current instruction immediately.
    if(this.active){this.remaining=this.active.duration;this.voice?.speak(apolloText(this.active.text),this.active.character);return;}
    const line=[...DIALOGUES].reverse().find(entry=>entry.checkpoint===this.state.checkpoint && entry.trigger==='enter') ?? this.last;
    if(line)this.queue.unshift({...line,replay:true});
  }
  update(dt:number) {
    if(this.active) {
      this.remaining-=dt;
      // Native onend timing varies across WebKit voices. Keep captions up while a
      // voice is speaking, but retain a bounded subtitle fallback if an event fails.
      if(this.remaining>0 || this.voice?.isSpeaking && this.remaining>-45)return;
      if(this.active.id && !this.active.replay && !this.state.dialogues.includes(this.active.id))this.state.dialogues.push(this.active.id);
      this.active=null;this.host.classList.remove('ap-radio-visible');
    }
    const line=this.queue.shift();if(!line)return;
    this.active=this.last=line;this.remaining=line.duration;
    this.render(line);
    if(line.channel==='radio')this.audio.radio();
    this.voice?.speak(apolloText(line.text),line.character);
  }
  private render(line:Line) {
    this.host.replaceChildren();this.host.dataset.channel=line.channel;
    const avatar=document.createElement('div');avatar.className='ap-radio-avatar';avatar.setAttribute('aria-hidden','true');
    avatar.textContent=/narrad|narrat/i.test(line.character)?'◐':/técnico|technic/i.test(line.character)?'TC':'DC';
    const content=document.createElement('div');content.className='ap-radio-content';
    const header=document.createElement('div');header.className='ap-radio-header';
    const name=document.createElement('strong');name.textContent=apolloText(line.character);
    const channel=document.createElement('small');channel.className='ap-radio-channel';channel.textContent=apolloText(line.channel==='radio'?'RADIO':line.channel==='narrator'?'NARRACIÓN':'PRESENCIAL');
    const signal=document.createElement('span');signal.className='ap-radio-signal';signal.setAttribute('aria-hidden','true');
    for(let i=0;i<5;i++)signal.append(document.createElement('span'));
    header.append(name,channel,signal);
    const text=document.createElement('p');text.textContent=apolloText(line.text);
    content.append(header,text);this.host.append(avatar,content);this.host.classList.add('ap-radio-visible');
  }
  clear() {
    this.queue=[];this.active=null;this.remaining=0;this.voice?.stop();
    this.host.replaceChildren();this.host.classList.remove('ap-radio-visible');
  }
}
