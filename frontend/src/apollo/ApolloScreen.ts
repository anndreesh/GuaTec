import type { Screen } from '@/screens/Screen';
import type { GameApp } from '@/core/GameApp';
import type { MissionSaveState } from '@/types';
import { progressApi } from '@/api/progressApi';
import { MISSION_SLUGS } from '@/config/gameConfig';
import { ApolloState, CHECKPOINTS } from './ApolloState';
import { ApolloWorld } from './ApolloWorld';
import { ApolloAudio } from './ApolloAudio';
import { ApolloDialogue } from './ApolloDialogue';
import { COUNTDOWN, INTRO_LINES, QUESTIONS, actionText, characterText, checkpointDone, checkpointKicker, checkpointText, distanceTravelled, lt, resumeText, txt, ui, type Txt, type UiKey } from './ApolloCopy';
import './apollo.css';

const SLUG = MISSION_SLUGS.mission1;

/**
 * Live text bindings: every user-visible string is registered with a function that is re-evaluated
 * when the language changes, so the HUD, open dialogs, toasts and captions update in place
 * (no remount, no loading screen, no 3D scene rebuild).
 */
type Binding = { node: Node; apply: () => void };
const bindings = new Set<Binding>();
const bind = (node: Node, apply: () => void) => { apply(); bindings.add({ node, apply }); };
const applyBindings = () => {
  for (const binding of [...bindings]) {
    if (!binding.node.isConnected) { bindings.delete(binding); continue; }
    binding.apply();
  }
};
const bindAttr = (node: Element, name: string, value: Txt) => {
  if (typeof value === 'function') bind(node, () => node.setAttribute(name, value())); else node.setAttribute(name, value);
};
const el = <K extends keyof HTMLElementTagNameMap>(tag:K, cls='', text:Txt='') => {
  const node=document.createElement(tag); node.className=cls;
  if (typeof text === 'function') bind(node, () => { node.textContent = text(); }); else node.textContent=text;
  return node;
};
type Quality = 'low'|'medium'|'high';
const ICON=(paths:string)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
const PAUSE_ICONS={
  volume:ICON('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  muted:ICON('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  restart:ICON('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
  back:ICON('<path d="M15 5l-7 7 7 7"/><path d="M8 12h12"/>'),
};
type Saved = { state:ReturnType<ApolloState['toJSON']>; savedAt:number };

/** Apollo 11 screen plugs into the existing router, identity and Flask progress API. */
export class ApolloScreen implements Screen {
  state = new ApolloState();
  world!: ApolloWorld;
  private root!: HTMLElement;
  private hud!: HTMLElement;
  private subtitle!: HTMLElement;
  private prompt!: HTMLButtonElement;
  private map!: HTMLCanvasElement;
  private modal: HTMLElement | null = null;
  private movie: 'intro'|'crew'|'launch'|null = null;
  private movieTime=0;
  private movieOverlay: HTMLElement | null=null;
  private paused=false;
  private started=false;
  private disposed=false;
  private raf=0;
  private lastTime=0;
  private mapTime=0;
  private syncTime=0;
  private hudTime=0;
  private activeIndex=-1;
  private quality:Quality='high';
  private languageMenu:HTMLElement|null=null;
  private languageParent:HTMLElement|null=null;
  private zoom=false;
  private stepDistance=0;
  private audio=new ApolloAudio();
  private dialogue!: ApolloDialogue;
  private saveQueue:Promise<void>=Promise.resolve();
  private saveKey:UiKey|''='';
  private loadingKey:UiKey='loading';
  private flashTimer:number|undefined;
  private localKey:string;
  private previousFocus:HTMLElement|null=null;
  private frameTimes:number[]=[];
  private uiTarget:HTMLElement|null=null;
  private readonly onKey=(event:KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.repeat) return;
    const key=event.key.toLowerCase();
    if (key==='escape') { event.preventDefault(); if(this.modal && this.started) this.closeModal(); else if(this.started && !this.movie) this.openPause(); }
    if (key==='r' && !this.modal && !this.movie) this.dialogue.repeat();
    if (key==='m') {event.preventDefault(); this.openMap();}
  };
  private readonly onVisibility=() => { if(document.hidden && this.started && !this.modal) this.openPause(); };
  private readonly onResize=() => this.world?.resize();
  private readonly onPageHide=() => { if(this.started) void this.save(); };

  constructor(private app:GameApp, private initialState?:unknown) {
    this.localKey=`guatec.apollo11.${app.currentUser?.id ?? 'guest'}`;
  }
  languageRefreshState() { return this.state.toJSON(); }
  /** Re-renders every visible string in the active language without rebuilding the scene. */
  refreshLanguage() {
    if(this.disposed) return;
    applyBindings();
    this.renderObjective(); this.updateNavigation();
    this.dialogue?.refreshLanguage();
    if(this.map) this.drawMap(this.map);
    this.root.querySelectorAll<HTMLCanvasElement>('canvas.ap-large-map').forEach(canvas=>this.drawMap(canvas));
    if(this.movie) this.paintCaption(true);
    this.world?.refreshLanguage();
  }
  async mount(container:HTMLElement) {
    this.root=el('div','apollo-screen');
    const loading=el('div','ap-loading',()=>ui(this.loadingKey)); this.root.append(loading); container.append(this.root);
    let saved:unknown=this.initialState;
    let local:Saved|undefined;
    try { local=JSON.parse(localStorage.getItem(this.localKey) ?? 'null') ?? undefined; } catch {}
    if (!saved) {
      try {
        const remote=await progressApi.get(SLUG);
        const envelope=remote.state as unknown as {apollo11?:unknown;apollo11SavedAt?:number};
        const remoteState=envelope.apollo11;
        const cloudTime=envelope.apollo11SavedAt ?? (Date.parse((remote.updatedAt ?? '').replace(/(?<!Z)$/, 'Z')) || 0);
        const valid=(value:unknown)=>{if(!value || typeof value!=='object')return false;const original=value as ReturnType<ApolloState['toJSON']>,restored=new ApolloState(value).toJSON();return original.version===restored.version && original.checkpoint===restored.checkpoint && original.elapsed===restored.elapsed && original.done===restored.done && ['completed','checks','dialogues'].every(k=>JSON.stringify(original[k as 'checks'])===JSON.stringify(restored[k as 'checks']));};
        const localValid=local && valid(local.state);
        const remoteValid=valid(remoteState);
        saved=localValid && (!remoteValid || local!.savedAt>cloudTime) ? local!.state : remoteValid?remoteState:undefined;
      } catch { saved=local?.state; this.saveKey='offlineDevice'; }
    }
    if(this.disposed) return;
    this.state=new ApolloState(saved);
    try {
      this.world=new ApolloWorld(this.root,{onInteract:()=>this.interact(),onMap:()=>{}});
      await this.world.ready;
    } catch (error) {
      this.loadingKey='webglError'; applyBindings();
      const back=this.button(()=>ui('backToMissions'),()=>void this.app.showMissionSelect()); loading.append(back);
      return;
    }
    if (this.disposed) { this.world.dispose(); return; }
    this.world.renderer.domElement.tabIndex=0;
    this.world.setQuality(this.quality);
    // A resume starts at the last validated checkpoint, never inside a restricted area.
    const destination=this.state.current.target; this.world.player.set(destination.x,0,destination.z+9);
    this.root.classList.add('ap-ready'); loading.remove(); this.buildHud();
    this.dialogue=new ApolloDialogue(this.state,this.subtitle,this.audio);
    document.addEventListener('keydown',this.onKey); document.addEventListener('visibilitychange',this.onVisibility);
    window.addEventListener('resize',this.onResize); window.addEventListener('pagehide',this.onPageHide);
    this.world.setSuspended(true);
    this.lastTime=performance.now(); this.raf=requestAnimationFrame(this.frame);
    this.showWelcome();
  }
  private button(text:Txt, callback:()=>void, cls='ap-button') {
    const b=el('button',cls,text); b.type='button'; b.addEventListener('click',callback); return b;
  }
  private iconButton(icon:Txt, label:Txt, callback:()=>void) {
    const b=this.button('',callback,'ap-button ap-icon-button');
    bindAttr(b,'aria-label',label); bindAttr(b,'title',label);
    const i=el('span','ap-icon'); i.setAttribute('aria-hidden','true'); bind(i,()=>{i.innerHTML=txt(icon);});
    b.append(i,el('small','',label)); return b;
  }
  private buildHud() {
    const top=el('div','ap-topbar');
    const mark=el('div','ap-mark'); mark.innerHTML='<b>APOLLO <span>11</span></b>'; mark.append(el('small','',()=>ui('markSubtitle')));
    top.append(mark); this.root.append(top);
    this.hud=el('section','ap-objective'); bindAttr(this.hud,'aria-label',()=>ui('objectiveAria')); this.root.append(this.hud);
    this.subtitle=el('div','ap-radio'); this.subtitle.setAttribute('aria-live','polite'); this.root.append(this.subtitle);
    this.prompt=this.button('',()=>this.interact(),'ap-interact'); this.root.append(this.prompt);
    const mapButton=this.button('',()=>this.openMap(),'ap-minimap'); bindAttr(mapButton,'aria-label',()=>ui('miniMapAria'));
    this.map=el('canvas'); this.map.width=240; this.map.height=200;
    mapButton.append(this.map,el('span','',()=>ui('miniMapLabel'))); this.root.append(mapButton);
    this.uiTarget=el('div','ap-waypoint'); this.root.append(this.uiTarget);
    this.renderObjective();
  }
  private showWelcome() {
    const box=this.openModal('APOLLO 11',()=>ui('welcomeTitle'));
    box.append(el('p','',()=>ui('welcomeBody')));
    box.append(el('p','ap-note',()=>ui('welcomeNote')));
    if(this.state.completed.length) box.append(el('p','ap-resume',()=>resumeText(this.state.completed.length)));
    const start=this.button(()=>this.state.done?ui('viewEpilogue'):this.state.completed.length?ui('continueMission'):ui('beginOps'),()=>{
      this.started=true; this.root.classList.add('ap-playing'); this.closeModal(); void this.audio.start().catch(()=>this.notify(()=>ui('audioUnavailable')));
      if(this.state.done) this.showEnd();
      else if(this.state.completed.length || this.state.checks.length) this.enterCheckpoint();
      else this.beginMovie('intro');
    },'ap-button ap-primary'); box.append(start);
    box.append(this.button(()=>ui('inspectSketchfab'),()=>this.openSketchfab()));
    box.append(this.button(()=>ui('backToSelector'),()=>void this.app.showMissionSelect()));
  }
  private saveText() { return this.saveKey ? ui(this.saveKey) : ui('saveDefault'); }
  private renderObjective() {
    if(!this.hud) return;
    const cp=this.state.current, copy=checkpointText(cp.id); this.hud.replaceChildren();
    this.hud.append(el('small','',ui('objectiveSmall')),el('span','ap-progress',`${String(this.state.completed.length).padStart(2,'0')} / 08`),el('h2','',copy.title),el('p','',copy.objective));
    const checklist=el('div','ap-checklist');
    for(const action of cp.actions) checklist.append(el('span',this.state.checks.includes(action.id)?'ap-checked':'',`${this.state.checks.includes(action.id)?'✓':'·'} ${actionText(action.id).label}`));
    this.hud.append(checklist,el('small','ap-save',this.saveText()));
    this.world?.setTarget(this.state.done?null:cp.target);
  }
  private enterCheckpoint() {
    this.activeIndex=this.state.checkpoint; this.dialogue.enter(); this.renderObjective();
    if(this.state.checkpoint===7 && !this.state.done) {
      this.showEnd();
    }
  }
  private act(id:string) {
    const before=this.state.checkpoint;
    if(!this.state.act(id)) return false;
    void this.save(); this.renderObjective();
    if(before===5 && this.state.checkpoint===6) {
      this.world.player.set(0,0,5600);
      this.notify(()=>ui('transferDone'));
    }
    if(before!==this.state.checkpoint) {
      this.closeModal(); this.notify(()=>checkpointDone(before+1)); this.enterCheckpoint(); this.dialogue.complete(before);
    }
    return true;
  }
  private distance() { const t=this.state.current.target,p=this.world.player; return Math.hypot(p.x-t.x,p.z-t.z); }
  private interact() {
    if(!this.started || this.paused || this.modal || this.movie || this.state.done) return;
    if(this.distance()>15) {this.notify(()=>ui('followMarker'));return;}
    const index=this.state.checkpoint;
    if(index===4) {this.beginMovie('crew');return;}
    if(index===6) {this.beginMovie('launch');return;}
    if(index===7) {this.showEnd();return;}
    this.showStation();
  }
  private showStation() {
    const cp=this.state.current, box=this.openModal(()=>checkpointKicker(this.state.checkpoint+1),()=>checkpointText(cp.id).title);
    box.append(el('p','',()=>checkpointText(cp.id).objective));
    if(this.state.checkpoint===0) box.append(el('p','ap-note',()=>ui('orientNote')));
    for(const action of cp.actions) {
      const complete=this.state.checks.includes(action.id);
      const b=this.button(()=>`${complete?'✓ ':''}${actionText(action.id).label}`,()=>this.performAction(action.id)); b.disabled=complete; box.append(b);
    }
    box.append(this.button(()=>ui('backToTour'),()=>this.closeModal()));
  }
  private performAction(id:string) {
    if(this.distance()>15 || !this.state.current.actions.some(a=>a.id===id)) return;
    if(id==='map') {this.openMap();return;}
    if(id==='authorize' && (!this.state.checks.includes('camera') || !this.state.checks.includes('audio'))) {this.notify(()=>ui('needCameraAudio'));return;}
    if(id==='report' && !this.state.checks.includes('log')) {this.notify(()=>ui('needLog'));return;}
    if(id==='ready' && (!this.state.checks.includes('antenna') || !this.state.checks.includes('signal'))) {this.notify(()=>ui('needAntennaSignal'));return;}
    if(id==='arrive') {this.act(id); if(this.modal) this.showStation(); return;}
    if(id==='technician') {
      const box=this.openModal(()=>ui('techKicker'),()=>ui('techTitle'));
      box.append(el('p','',()=>ui('techBody')));
      this.dialogue.say(()=>characterText('Técnico de plataforma'),()=>ui('techSubtitle'),9,'in-person');
      box.append(this.button(()=>ui('logConversation'),()=>{this.act(id);if(this.modal)this.showStation();},'ap-button ap-primary')); return;
    }
    const q=QUESTIONS[id]; if(!q) return;
    const box=this.openModal(()=>ui('notebookKicker'),()=>lt(q.title));
    box.append(el('p','ap-document',()=>lt(q.copy)));
    let wrong=false;
    const feedback=el('p','ap-feedback',()=>wrong?ui('wrongAnswer'):''); feedback.setAttribute('aria-live','polite');
    q.options.forEach((option,i)=>box.append(this.button(()=>lt(option),()=>{
      if(i!==q.answer) {wrong=true;applyBindings();return;}
      this.act(id); if(this.modal) this.showStation();
    })));
    box.append(feedback,this.button(()=>ui('backToLog'),()=>this.showStation()));
  }
  private beginMovie(mode:'intro'|'crew'|'launch') {
    if(mode==='crew' && (this.state.checkpoint!==4 || this.distance()>15)) return;
    if(mode==='launch' && (this.state.checkpoint!==6 || this.distance()>15)) return;
    this.closeModal(); this.dialogue.clear(); this.movie=mode; this.movieTime=0; this.world.setSuspended(true);
    this.movieOverlay=el('div','ap-cinema'); this.root.append(this.movieOverlay); this.root.classList.add('ap-in-cinema'); document.body.classList.add('apollo-cinematic');
    if(mode==='intro') this.movieOverlay.append(this.button(()=>ui('skipIntro'),()=>this.finishMovie(),'ap-skip'));
    this.renderMovie();
  }
  /** Caption copy for the running cinematic in the active language. */
  private movieCopy(mode:'intro'|'crew'|'launch',time:number) {
    let title='',label='',text='';
    if(mode==='intro') {
      if(time<4) {label=ui('introPlace');title=ui('introDate');text=ui('introCenter');}
      else if(time<30) {label=ui('narrationLabel');text=lt(INTRO_LINES[Math.min(2,Math.floor((time-4)/8.7))]);}
      else {label=ui('missionLabel');title='APOLLO 11';text=ui('newEra');}
    } else if(mode==='crew') {
      label=time<24?ui('crewLabel1'):ui('crewLabel2');
      title=time<24?ui('crewTitle1'):ui('crewTitle2');
      text=time<24?ui('crewText1'):ui('crewText2');
    } else {
      label=ui('launchLabel');
      title=time<10?`T − ${String(Math.ceil(10-time)).padStart(2,'0')}`:time<16?ui('liftoff'):ui('climbing');
      text=time<5?ui('launchText1'):time<10?lt(COUNTDOWN[Math.min(4,Math.floor(time-5))]):time<19?ui('launchConfirmed'):ui('launchFinal');
    }
    return {label,title,text};
  }
  private paintCaption(force=false) {
    if(!this.movie || !this.movieOverlay) return;
    const {label,title,text}=this.movieCopy(this.movie,this.movieTime);
    let caption=this.movieOverlay.querySelector<HTMLElement>('.ap-cinema-caption');
    if(!caption) {caption=el('div','ap-cinema-caption'); this.movieOverlay.append(caption);}
    const signature=`${label}|${title}|${text}`;
    if(force || caption.dataset.signature!==signature) {caption.dataset.signature=signature; caption.replaceChildren(el('small','',label),el('h1','',title),el('p','',text));}
  }
  private renderMovie() {
    if(!this.movie || !this.movieOverlay) return;
    const time=this.movieTime, mode=this.movie;
    this.world.setCinematic(mode,time);
    this.movieOverlay.classList.toggle('ap-black',mode==='intro' && time<4 || mode==='crew' && time>=24);
    if(mode==='launch') this.audio.launch(time,5600);
    this.paintCaption();
    if(time>=(mode==='intro'?36:mode==='crew'?28:60)) this.finishMovie();
  }
  private finishMovie() {
    const mode=this.movie; if(!mode)return;
    this.movie=null; this.movieOverlay?.remove(); this.movieOverlay=null;
    this.root.classList.remove('ap-in-cinema'); document.body.classList.remove('apollo-cinematic'); this.world.setCinematic(null,0); this.world.setSuspended(this.paused);
    if(mode==='launch') this.audio.stopLaunch();
    if(mode==='intro') {for(const id of ['intro-history','intro-crew']) if(!this.state.dialogues.includes(id))this.state.dialogues.push(id);}
    if(mode==='crew') this.act('crew-film');
    else if(mode==='launch') this.act('launch-film');
    else this.enterCheckpoint();
  }
  private showEnd() {
    const box=this.openModal(()=>this.state.done?ui('endKickerDone'):ui('endKickerEpilogue'),()=>ui('endTitle'));
    box.append(el('p','',()=>ui('endBody')));
    box.append(el('p','ap-resume',()=>ui('nextChapter')));
    box.append(this.button(()=>this.state.done?ui('backSelector'):ui('completeReturn'),()=>{
      box.querySelectorAll('button').forEach(b=>b.disabled=true);
      if(!this.state.done)this.act('finish');
      void this.save().then(async()=>{
        // The summary is a stable Spanish key; the report screen translates it with t().
        try { await progressApi.complete(SLUG,{ticksSurvived:Math.floor(this.state.elapsed),decisionsMade:19,samplesCollected:0,finalResources:{fuel:100,pressure:100,stability:100,telemetry:100},outcome:'success',summary:'Apollo 11: ocho checkpoints de apoyo terrestre completados; traslado y lanzamiento observados desde el área segura.'}); } catch { this.notify(()=>ui('reportQueued')); }
        return this.app.showMissionSelect();
      });
    },'ap-button ap-primary'));
    box.append(this.button(()=>ui('sourcesBtn'),()=>this.openCredits()));
  }
  private restoreLanguageMenu() {
    if(this.languageMenu && this.languageParent) this.languageParent.append(this.languageMenu);
    this.languageMenu=null; this.languageParent=null;
  }
  private openModal(kicker:Txt,title:Txt) {
    this.restoreLanguageMenu(); this.modal?.remove(); this.previousFocus=document.activeElement as HTMLElement|null;
    const overlay=el('div','ap-modal'); const box=el('section','ap-dialog');
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); bindAttr(box,'aria-label',title); box.tabIndex=-1;
    box.append(el('small','ap-kicker',kicker),el('h1','',title)); overlay.append(box); this.root.append(overlay); this.modal=overlay;
    this.paused=true; this.world?.setSuspended(true); this.audio.pause(true);
    overlay.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const controls=[...box.querySelectorAll<HTMLElement>('button:not(:disabled), a, select')];
      if(!controls.length)return; const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey && (document.activeElement===first || document.activeElement===box)) {e.preventDefault();last.focus();}
      else if(!e.shiftKey && (document.activeElement===last || document.activeElement===box)) {e.preventDefault();first.focus();}
    });
    box.focus(); return box;
  }
  private closeModal() {
    this.restoreLanguageMenu(); this.modal?.remove();this.modal=null;this.paused=false;
    this.world?.setSuspended(!this.started || !!this.movie);this.audio.pause(!this.started);
    if(this.started) this.world?.renderer.domElement.focus({preventScroll:true});
  }
  private openPause() {
    if(!this.world || !this.started || this.modal)return;
    const box=this.openModal(()=>ui('pauseKicker'),()=>ui('pauseTitle'));
    const tools=el('div','ap-pause-tools');
    tools.append(
      this.iconButton(()=>this.audio.muted?PAUSE_ICONS.muted:PAUSE_ICONS.volume,()=>this.audio.muted?ui('audioOn'):ui('audioMute'),()=>{this.audio.toggle();applyBindings();}),
      this.iconButton(PAUSE_ICONS.restart,()=>ui('restartMission'),()=>this.confirmReset()),
      this.iconButton(PAUSE_ICONS.back,()=>ui('backToMissions'),()=>{void this.save().then(()=>this.app.showMissionSelect());}));
    const languageMenu=document.querySelector<HTMLElement>('.language-menu');
    if(languageMenu){this.languageMenu=languageMenu;this.languageParent=languageMenu.parentElement;const languageSlot=el('div','ap-pause-language');languageSlot.append(languageMenu);tools.append(languageSlot);}
    box.append(tools);
    const mapBox=el('div','ap-pause-map'); const mapCanvas=el('canvas','ap-large-map'); mapCanvas.width=720; mapCanvas.height=540; this.drawMap(mapCanvas);
    mapBox.append(el('small','ap-kicker',()=>ui('pauseMapKicker')),mapCanvas); box.append(mapBox);
  }
  private confirmReset() {
    const box=this.openModal(()=>ui('resetKicker'),()=>ui('resetTitle'));
    box.append(el('p','',()=>ui('resetBody')));
    box.append(this.button(()=>ui('resetBtn'),()=>void (async()=>{
      await this.saveQueue;
      try {await progressApi.replay(SLUG);} catch {this.notify(()=>ui('resetFail'));return;}
      try {localStorage.removeItem(this.localKey);}catch{}
      this.started=false; await this.app.showMission1(new ApolloState().toJSON());
    })(),'ap-button ap-primary'),this.button(()=>ui('cancel'),()=>{this.closeModal();this.openPause();}));
  }
  private openMap() {
    if(!this.started || this.movie || !this.world)return;
    if(this.state.checkpoint===0)this.act('map');
    const box=this.openModal(()=>ui('mapKicker'),()=>ui('mapTitle'));
    const canvas=el('canvas','ap-large-map');canvas.width=720;canvas.height=540;this.drawMap(canvas);
    box.append(canvas,el('p','ap-note',()=>ui('mapNote')));
    const cp=this.state.current;box.append(el('p','',()=>distanceTravelled(checkpointText(cp.id).title,Math.round(this.distance()))));
    box.append(this.button(()=>ui('backToOps'),()=>this.closeModal(),'ap-button ap-primary'));
  }
  private drawMap(canvas:HTMLCanvasElement) {
    const c=canvas.getContext('2d');if(!c)return;
    const w=canvas.width,h=canvas.height, sx=w/400,sz=h/470;
    const p=(x:number,z:number)=>[(x+200)*sx,(z+40)*sz] as const;
    c.fillStyle='#101e23';c.fillRect(0,0,w,h);
    c.strokeStyle='#25373a';c.lineWidth=1;
    for(let x=0;x<w;x+=w/10){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
    for(let y=0;y<h;y+=h/10){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    c.fillStyle='#173847';c.fillRect(w*.88,0,w*.12,h);
    c.strokeStyle='#6b7773';c.lineWidth=Math.max(3,w*.018);c.beginPath();
    // Same asphalt segments and building footprints as ApolloWorld.buildGround().
    const road=(x1:number,z1:number,x2:number,z2:number)=>{const [a,b]=p(x1,z1),[d,e]=p(x2,z2);c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();};
    road(0,-40,0,430);c.lineWidth=Math.max(2,w*.012);
    road(-90,145,90,145);road(-82.5,250,82.5,250);road(-90,210,10,210);road(-65,365,65,365);
    c.fillStyle='#667978';
    for(const [x,z,bw,bd] of [[-125,200,26,21],[116,250,22,17],[-118,338,28,19],[120,130,24,17]]){const [a,b]=p(x-bw/2,z-bd/2);c.fillRect(a,b,bw*sx,bd*sz);}
    const [rx,rz]=p(0,0);c.fillStyle='#b55c4a30';c.beginPath();c.ellipse(rx,rz,90*sx,90*sz,0,0,Math.PI*2);c.fill();c.strokeStyle='#c37463';c.lineWidth=1;c.stroke();
    c.font=`${Math.max(10,w/40)}px sans-serif`;c.fillStyle='#afc1c2';c.fillText('N ↑',10,20);c.fillText('39A',rx+10,rz+4);
    c.fillStyle='#a7b9b5';c.fillText('↖ VAB · 1 km',8,Math.max(36,h*.18));
    CHECKPOINTS.slice(0,6).forEach((cp,i)=>{const [x,z]=p(cp.target.x,cp.target.z);c.fillStyle=this.state.completed.includes(cp.id)?'#8eba9d':i===this.state.checkpoint?'#f4be67':'#597275';c.beginPath();c.arc(x,z,i===this.state.checkpoint?6:3,0,Math.PI*2);c.fill();if(w>300)c.fillText(`${i+1}. ${checkpointText(cp.id).title}`,x+10,z+5);});
    const target=this.state.current.target;
    const remote=this.world.player.z>5000;
    const [tx,tz]=p(target.x,remote?355:target.z),[px,pz]=p(this.world.player.x,remote?355:this.world.player.z);
    if(remote){c.fillStyle='#e0c497';c.fillText(ui('mapObservation'),10,h-12);}
    c.strokeStyle='#edbd6a';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.moveTo(px,pz);c.lineTo(tx,tz);c.stroke();c.setLineDash([]);
    c.save();c.translate(px,pz);c.rotate(-this.world.yaw);c.fillStyle='#fff1d5';c.beginPath();c.moveTo(0,-7);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fill();c.restore();
  }
  private openSketchfab() {
    const box=this.openModal(()=>ui('skKicker'),()=>ui('skTitle'));
    box.append(el('p','',()=>ui('skBody')));
    const frame=el('iframe','ap-sketchfab');bindAttr(frame,'title',()=>ui('skFrameTitle'));
    frame.src='https://sketchfab.com/models/6d25ada102844d81b0b9b4149f720531/embed?autostart=1&preload=1&ui_infos=1&api_version=1&api_id=apollo11';
    frame.allow='autoplay; fullscreen; xr-spatial-tracking';frame.allowFullscreen=true;box.append(frame);
    // Official Viewer API is deliberately confined to the embedded educational viewer.
    const script=el('script');script.src='https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
    script.onload=()=>{
      const Client=(window as unknown as {Sketchfab?:new(f:HTMLIFrameElement)=>{init:(id:string,options:object)=>void}}).Sketchfab;
      if(Client && frame.isConnected) new Client(frame).init('6d25ada102844d81b0b9b4149f720531',{autostart:1,success:(api:{start:()=>void})=>api.start(),error:()=>this.notify(()=>ui('skError'))});
    };
    script.onerror=()=>this.notify(()=>ui('skUnavailable'));box.append(script);
    const a=el('a','ap-link',()=>ui('skLink'));a.href='https://sketchfab.com/3d-models/lego-animated-saturn-v-apollo-11-rocket-launch-6d25ada102844d81b0b9b4149f720531';a.target='_blank';a.rel='noopener noreferrer';box.append(a);
    box.append(this.button(()=>ui('back'),()=>{this.closeModal();if(!this.started)this.showWelcome();}));
  }
  private openCredits() {
    const box=this.openModal(()=>ui('crKicker'),()=>ui('crTitle'));
    box.append(el('p','',()=>ui('crBody')));
    const links:[Txt,string][]=[[()=>ui('crLinkNasa'),'https://www.nasa.gov/mission/apollo-11/'],[()=>ui('crLinkLaunch'),'https://www.nasa.gov/history/50-years-ago-apollo-11-off-to-the-moon/'],['Mercenary Astronaut · Peter_D · CC BY 4.0','https://sketchfab.com/3d-models/mercenary-astronaut-7fd399d488ae4576a0fc62715892956c'],[()=>ui('crLinkLicense'),'https://creativecommons.org/licenses/by/4.0/']];
    for(const [label,url]of links){const a=el('a','ap-link',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}
    box.append(el('p','ap-note',()=>ui('crNote')));
    box.append(this.button(()=>ui('back'),()=>{this.closeModal();if(this.state.checkpoint===7)this.showEnd();else if(!this.started)this.showWelcome();}));
  }
  private notify(text:Txt) {
    this.root.querySelector('.ap-toast')?.remove();const n=el('div','ap-toast',typeof text==='function'?text:txt(text));n.setAttribute('role','status');this.root.append(n);
    clearTimeout(this.flashTimer);this.flashTimer=window.setTimeout(()=>n.remove(),4800);
  }
  private async save() {
    if(this.disposed || !this.started)return;
    const snapshot=this.state.toJSON(),savedAt=Date.now();
    try {localStorage.setItem(this.localKey,JSON.stringify({state:snapshot,savedAt}));this.saveKey='saveLocalSync';} catch {this.saveKey='saveNoLocalSync';}
    const wire={tick:Math.floor(this.state.elapsed),resources:{fuel:100,pressure:100,stability:100,telemetry:100},resolvedDecisionIds:[],log:[],apollo11:snapshot,apollo11SavedAt:savedAt} as unknown as MissionSaveState;
    this.saveQueue=this.saveQueue.catch(()=>{}).then(async()=>{
      try {await progressApi.autosave(SLUG,wire,snapshot.completed.length/8*100);this.saveKey='saveSynced';}
      catch {this.saveKey='saveLocalOffline';}
      if(!this.disposed)this.renderObjective();
    });
    return this.saveQueue;
  }
  private readonly frame=(now:number) => {
    if(this.disposed)return;
    const raw=Math.max(0,(now-this.lastTime)/1000),dt=Math.min(.1,raw);this.lastTime=now;
    const beforeX=this.world.player.x,beforeZ=this.world.player.z;
    this.world.update(this.paused ? 0 : dt);
    if(this.started && !this.paused && !this.movie) {
      this.stepDistance+=Math.hypot(this.world.player.x-beforeX,this.world.player.z-beforeZ);
      if(this.stepDistance>1.5){this.stepDistance=0;this.audio.step();}
    }
    if(!this.paused) {
      if(this.started) {
        this.state.elapsed+=dt;
        if(this.movie){this.movieTime+=dt;this.renderMovie();}
        else {if(this.activeIndex!==this.state.checkpoint)this.enterCheckpoint();this.dialogue.update(dt);}
      }
      if(raw>0 && this.started){this.frameTimes.push(raw*1000);if(this.frameTimes.length>300)this.frameTimes.shift();}
    }
    this.mapTime+=dt;this.hudTime+=dt;this.syncTime+=dt;
    if(this.mapTime>.2){this.mapTime=0;this.drawMap(this.map);}
    if(this.hudTime>.15){this.hudTime=0;this.updateNavigation();}
    if(this.syncTime>25){this.syncTime=0;if(this.started)void this.save();}
    this.raf=requestAnimationFrame(this.frame);
  };
  private updateNavigation() {
    if(!this.prompt)return;
    const near=this.distance()<=15;
    this.prompt.hidden=!this.started || this.paused || !!this.movie || this.state.done;
    this.prompt.textContent=near?(this.state.checkpoint===4?ui('promptCrew'):this.state.checkpoint===6?ui('promptLaunch'):ui('promptExamine')):`${Math.round(this.distance())} m · ${checkpointText(this.state.current.id).title}`;
    this.prompt.disabled=!near;
    if(this.uiTarget) {this.uiTarget.hidden=!!this.movie || this.paused;this.uiTarget.textContent=`◇ ${Math.round(this.distance())} m`;}
  }
  diagnostics() {
    const times=this.frameTimes,average=times.reduce((a,b)=>a+b,0)/Math.max(1,times.length);
    return {...this.world.diagnostics(),checkpoint:this.state.checkpoint,checks:this.state.checks,completed:this.state.completed,movie:this.movie,movieTime:this.movieTime,quality:this.quality,frameMs:average,fps:average?1000/average:0,samples:times.length};
  }
  unmount() {
    document.body.classList.remove('apollo-cinematic');
    this.disposed=true;cancelAnimationFrame(this.raf);clearTimeout(this.flashTimer);
    document.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onVisibility);
    window.removeEventListener('resize',this.onResize);window.removeEventListener('pagehide',this.onPageHide);
    this.audio.dispose();this.world?.dispose();this.restoreLanguageMenu();this.modal?.remove();this.root?.remove();bindings.clear();
  }
}
