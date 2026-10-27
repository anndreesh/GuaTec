import type { Screen } from '@/screens/Screen';
import type { GameApp } from '@/core/GameApp';
import type { MissionSaveState } from '@/types';
import { progressApi } from '@/api/progressApi';
import { MISSION_SLUGS } from '@/config/gameConfig';
import { ApolloState, BONUS_CHECKPOINTS, CHECKPOINTS } from './ApolloState';
import { ApolloWorld } from './ApolloWorld';
import { ApolloAudio } from './ApolloAudio';
import { ApolloDialogue } from './ApolloDialogue';
import './apollo.css';
import './ApolloPause.css';
import './apollo-start-error.css';
import { apolloText, apolloLanguage } from './ApolloLocale';
import { ApolloVoice } from './ApolloVoice';
import { setLanguage } from '@/core/i18n';
import { mountInstrument, type InstrumentHandle, type InstrumentKind } from './ApolloInstruments';
import { FIELD_INSTRUMENTS, fieldDraftKey, restoreFieldDrafts, type FieldDrafts } from './ApolloFieldProgress';
import { mountBonusMission, type BonusMissionHandle } from './ApolloBonusMissions';
import { restoreStandDraft, type StandDraft } from './ApolloStandRules';
import {SITE_BUILDINGS,SITE_ROADS,SITE_WALKWAYS,SITE_ZONES,zoneBounds} from './ApolloSiteLayout';
import {STAND_HANDOFFS} from './ApolloStandHandoffs';

const SLUG = MISSION_SLUGS.mission1;
const el = <K extends keyof HTMLElementTagNameMap>(tag:K, cls='', text='') => {
  const node=document.createElement(tag); node.className=cls; node.textContent=apolloText(text); return node;
};
const INTRO = [
  '16 de julio de 1969. Durante años, miles de personas han trabajado para conseguir lo que alguna vez parecía imposible: enviar seres humanos a la Luna.',
  'Hoy, tres astronautas se preparan para abandonar la Tierra a bordo de la nave Apollo 11.',
  'Neil Armstrong, Buzz Aldrin y Michael Collins están a punto de comenzar un viaje que cambiará nuestra historia.',
];
type Quality = 'low'|'medium'|'high';
type Saved = { state:ReturnType<ApolloState['toJSON']>; savedAt:number; drafts?:FieldDrafts; standDrafts?:Record<string,StandDraft> };
type Resume = ReturnType<ApolloState['toJSON']> & {fieldDrafts?:unknown;standDrafts?:unknown;resumeInstrument?:boolean};

type SceneStartFailure = {
  kind: 'webgl' | 'scene';
  title: string;
  message: string;
  detail?: string;
  steps: string[];
};

function sceneStartFailure(error: unknown): SceneStartFailure {
  const probe = document.createElement('canvas');
  let webgl2: WebGLRenderingContext | null = null;
  try {
    webgl2 = probe.getContext('webgl2', { antialias: false, powerPreference: 'low-power' });
  } catch {
    webgl2 = null;
  }

  if (!webgl2) {
    return {
      kind: 'webgl',
      title: 'No se pudo activar el modo 3D',
      message: 'Este navegador no pudo activar WebGL 2, que es necesario para mostrar la Misión 01. Tu progreso no se ha perdido.',
      steps: [
        'Activa la aceleración gráfica en la configuración del navegador.',
        'Prueba la misión en una versión actualizada de Chrome, Edge o Safari.',
        'Cierra otras pestañas o aplicaciones que estén usando gráficos 3D y vuelve a intentarlo.',
      ],
    };
  }

  return {
    kind: 'scene',
    title: 'La misión no pudo preparar el escenario',
    message: 'WebGL está disponible, pero la escena encontró un problema al cargar sus recursos. Tu progreso no se ha perdido.',
    detail: error instanceof Error ? error.message : undefined,
    steps: [
      'Vuelve a intentarlo para reconstruir el escenario.',
      'Si vuelve a ocurrir, actualiza el navegador y comprueba tu conexión.',
      'Puedes regresar al selector sin afectar tu avance guardado.',
    ],
  };
}

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
  private modalKind: 'welcome'|'pause'|'map'|'end'|'credits'|'sketchfab'|'reset'|'station'|'bonus'|null = null;
  private movie: 'intro'|'crew'|'launch'|null = null;
  private movieTime=0;
  private movieOverlay: HTMLElement | null=null;
  private paused=false;
  private started=false;
  private disposed=false;
  private startFailure:SceneStartFailure|null=null;
  private raf=0;
  private lastTime=0;
  private mapTime=0;
  private syncTime=0;
  private hudTime=0;
  private objectivesExpanded=window.innerWidth>640;
  private activeIndex=-1;
  private quality:Quality='high';
  private zoom=false;
  private stepDistance=0;
  private audio=new ApolloAudio();
  private voice=new ApolloVoice();
  private instrument:InstrumentHandle|null=null;
  private bonusMission:BonusMissionHandle|null=null;
  private bonusKey='';
  private standDrafts:Record<string,StandDraft>={};
  private instrumentKey='';
  private fieldDrafts:FieldDrafts={};
  private draftTimer:number|undefined;
  private movieVoiceKey='';
  private resumeInstrument=false;
  private dialogue!: ApolloDialogue;
  private saveQueue:Promise<void>=Promise.resolve();
  private saveStatus='';
  private flashTimer:number|undefined;
  private localKey:string;
  private previousFocus:HTMLElement|null=null;
  private frameTimes:number[]=[];
  private uiTarget:HTMLElement|null=null;
  private mobileControls:HTMLElement|null=null;
  private mobileInteract:HTMLButtonElement|null=null;
  private uiGamepadIndex:number|null=null;
  private previousUiGamepadButtons:boolean[]=[];
  private lastUiDirection:string|null=null;
  private ignoreUiGamepadUntil=0;
  private readonly onKey=(event:KeyboardEvent) => {
    if(event.key==='Escape'&&this.modal?.querySelector('.ap-language-options')){
      event.preventDefault();const host=this.modal.querySelector<HTMLElement>('.ap-language-host');
      if(host){this.togglePauseLanguage(host);host.querySelector('button')?.focus();}return;
    }
    if(event.key==='Escape') {event.preventDefault();if(this.modal && this.started)this.closeModal();else if(this.started && !this.movie)this.openPause();return;}
    if(this.modal)return;
    if(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.repeat)return;
    const key=event.key.toLowerCase();
    if(this.instrument)return;
    if(key==='r' && !this.modal && !this.movie)this.dialogue.repeat();
    if(key==='m'){event.preventDefault();this.openMap();}
  };
  private readonly onVisibility=() => { if(document.hidden && this.started && !this.modal) this.openPause(); };
  private readonly onResize=() => this.world?.resize();
  private readonly onPageHide=() => { if(this.started) void this.save(); };

  constructor(private app:GameApp, private initialState?:unknown) {
    this.localKey=`guatec.apollo11.${app.currentUser?.id ?? 'guest'}`;
  }
  languageRefreshState() {
    this.captureInstrumentDraft();
    return {...this.state.toJSON(),fieldDrafts:this.fieldDrafts,standDrafts:this.standDrafts,resumeInstrument:!!this.instrument};
  }
  async mount(container:HTMLElement) {
    document.body.classList.add('apollo-active');
    this.root=el('div','apollo-screen');
    const loading=el('div','ap-loading','PREPARANDO OPERACIONES · APOLLO 11'); this.root.append(loading); container.append(this.root);
    let saved:unknown=this.initialState;
    let drafts:unknown=(this.initialState as Resume|undefined)?.fieldDrafts;
    let standDrafts:unknown=(this.initialState as Resume|undefined)?.standDrafts;
    this.resumeInstrument=!!(this.initialState as Resume|undefined)?.resumeInstrument;
    let local:Saved|undefined;
    try { local=JSON.parse(localStorage.getItem(this.localKey) ?? 'null') ?? undefined; } catch {}
    if (!saved) {
      try {
        const remote=await progressApi.get(SLUG);
        const envelope=remote.state as unknown as {apollo11?:unknown;apollo11SavedAt?:number;apollo11Drafts?:unknown;apollo11StandDrafts?:unknown};
        const remoteState=envelope.apollo11;
        const cloudTime=envelope.apollo11SavedAt ?? (Date.parse((remote.updatedAt ?? '').replace(/(?<!Z)$/, 'Z')) || 0);
        const valid=(value:unknown)=>{if(!value || typeof value!=='object')return false;const original=value as ReturnType<ApolloState['toJSON']>,restored=new ApolloState(value).toJSON();return original.version===restored.version && original.checkpoint===restored.checkpoint && original.elapsed===restored.elapsed && original.done===restored.done && ['completed','checks','dialogues'].every(k=>JSON.stringify(original[k as 'checks'])===JSON.stringify(restored[k as 'checks'])) && JSON.stringify(original.bonusCompleted ?? [])===JSON.stringify(restored.bonusCompleted);};
        const localValid=local && valid(local.state);
        const remoteValid=valid(remoteState);
        const preferLocal=localValid && (!remoteValid || local!.savedAt>cloudTime);
        saved=preferLocal ? local!.state : remoteValid?remoteState:undefined;
        drafts=preferLocal?local?.drafts:envelope.apollo11Drafts;
        standDrafts=preferLocal?local?.standDrafts:envelope.apollo11StandDrafts;
      } catch { saved=local?.state; drafts=local?.drafts;standDrafts=local?.standDrafts; this.saveStatus=local?.state?'Sin conexión · guardado en este dispositivo':'Sin conexión · no hay registro guardado disponible'; }
    }
    if(this.disposed) return;
    this.state=new ApolloState(saved);
    this.fieldDrafts=restoreFieldDrafts(drafts,this.state.checkpoint);
    if(standDrafts&&typeof standDrafts==='object'&&!Array.isArray(standDrafts))for(const bonus of BONUS_CHECKPOINTS){
      const savedDraft=(standDrafts as Record<string,unknown>)[bonus.id];
      if(savedDraft&&!this.state.bonusCompleted.includes(bonus.id))this.standDrafts[bonus.id]=restoreStandDraft(bonus.kind,savedDraft);
    }
    const sceneLanguage=apolloLanguage();
    try {
      this.world=new ApolloWorld(this.root,{onInteract:()=>this.interact(),onMap:()=>this.openMap(),onPause:()=>this.openPause()});
      await this.world.ready;
    } catch (error) {
      const failure=sceneStartFailure(error);
      console.error('[ApolloScreen] mission 01 scene start failed', { kind: failure.kind, error });
      this.startFailure=failure;
      this.renderStartFailure(loading,failure);
      return;
    }
    if (this.disposed) { this.world.dispose(); return; }
    if(sceneLanguage!==apolloLanguage())this.world.refreshLanguage();
    this.world.renderer.domElement.tabIndex=0;
    this.world.setQuality(this.quality);
    // A resume starts at the last validated checkpoint, never inside a restricted area.
    const destination=this.state.current.target; this.world.player.set(destination.x,0,destination.z+9);
    this.root.classList.add('ap-ready'); loading.remove(); this.buildHud(); this.buildMobileControls();
    this.dialogue=new ApolloDialogue(this.state,this.subtitle,this.audio,this.voice);
    document.addEventListener('keydown',this.onKey); document.addEventListener('visibilitychange',this.onVisibility);
    window.addEventListener('resize',this.onResize); window.addEventListener('pagehide',this.onPageHide);
    this.world.setSuspended(true);
    this.lastTime=performance.now(); this.raf=requestAnimationFrame(this.frame);
    this.showWelcome();
  }
  private renderStartFailure(loading:HTMLElement,failure:SceneStartFailure) {
    loading.classList.add('ap-loading--error');loading.replaceChildren();
    const panel=el('div','ap-start-error');panel.setAttribute('role','alert');
    panel.append(el('span','ap-kicker',failure.kind==='webgl'?'DIAGNÓSTICO DE GRÁFICOS':'DIAGNÓSTICO DE MISIÓN'),el('h1','',failure.title),el('p','',failure.message));
    const steps=el('ul','ap-start-error-steps');failure.steps.forEach(step=>steps.append(el('li','',step)));panel.append(steps);
    if(failure.detail){const details=el('details','ap-start-error-detail');details.append(el('summary','','Detalles técnicos'),el('pre','',failure.detail));panel.append(details);}
    const actions=el('div','ap-start-error-actions');actions.append(this.button('Reintentar misión',()=>void this.app.showMission1(this.initialState),'ap-button ap-primary'),this.button('Volver a misiones',()=>void this.app.showMissionSelect()));
    panel.append(actions);loading.append(panel);
  }
  private button(text:string, callback:()=>void, cls='ap-button') {
    const b=el('button',cls,text); b.type='button'; b.addEventListener('click',callback); return b;
  }
  private buildMobileControls() {
    const controls=el('div','ap-mobile-controls');
    const stick=el('div','ap-mobile-stick');
    const knob=el('span','ap-mobile-stick-knob');
    stick.append(el('span','ap-mobile-stick-hint','▲'),knob);
    const actions=el('div','ap-mobile-actions');
    const pause=this.button('Ⅱ',()=>this.openPause(),'ap-mobile-action ap-mobile-action--pause');
    pause.setAttribute('aria-label',apolloText('Pausar misión'));
    const interact=this.button('Examinar',()=>this.interact(),'ap-mobile-action ap-mobile-action--interact');
    this.mobileInteract=interact; interact.hidden=true;
    const jump=this.button('Saltar',()=>this.world.jump(),'ap-mobile-action');
    const sprint=this.button('Correr',()=>undefined,'ap-mobile-action');
    sprint.setAttribute('aria-pressed','false');
    const releaseSprint=()=>{this.world.setTouchSprint(false);sprint.classList.remove('is-active');sprint.setAttribute('aria-pressed','false');};
    sprint.addEventListener('pointerdown',event=>{event.preventDefault();sprint.setPointerCapture(event.pointerId);this.world.setTouchSprint(true);sprint.classList.add('is-active');sprint.setAttribute('aria-pressed','true');});
    sprint.addEventListener('pointerup',releaseSprint); sprint.addEventListener('pointercancel',releaseSprint); sprint.addEventListener('lostpointercapture',releaseSprint);
    actions.append(pause,interact,jump,sprint); controls.append(stick,actions); this.root.append(controls); this.mobileControls=controls;
    const moveStick=(event:PointerEvent)=>{
      const rect=stick.getBoundingClientRect(),radius=rect.width*.36;
      const dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),distance=Math.hypot(dx,dy),scale=distance>radius?radius/distance:1;
      const x=dx*scale/radius,y=-dy*scale/radius; knob.style.transform=`translate(${x*radius}px,${-y*radius}px)`; this.world.setTouchMovement(x,y);
    };
    const releaseStick=(event:PointerEvent)=>{if(stick.hasPointerCapture(event.pointerId))stick.releasePointerCapture(event.pointerId);knob.style.transform='translate(0,0)';this.world.setTouchMovement(0,0);};
    stick.addEventListener('pointerdown',event=>{event.preventDefault();stick.setPointerCapture(event.pointerId);moveStick(event);});
    stick.addEventListener('pointermove',event=>{if(stick.hasPointerCapture(event.pointerId))moveStick(event);});
    stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);stick.addEventListener('lostpointercapture',releaseStick);
  }
  private pollUiGamepad(now:number) {
    if (!navigator.getGamepads || (!this.modal && !this.movie) || now<this.ignoreUiGamepadUntil) return;
    const pads=navigator.getGamepads(); let pad=this.uiGamepadIndex===null?null:pads[this.uiGamepadIndex];
    if(!pad?.connected){pad=Array.from(pads).find(candidate=>candidate?.connected)??null;this.uiGamepadIndex=pad?.index??null;this.previousUiGamepadButtons=[];this.lastUiDirection=null;}
    if(!pad)return;
    const pressed=(index:number)=>!!pad!.buttons[index]?.pressed;
    const justPressed=(index:number)=>pressed(index)&&!this.previousUiGamepadButtons[index];
    const axis=(index:number)=>{const value=pad!.axes[index]??0;return Math.abs(value)>.55?value:0;};
    const direction=pressed(12)||axis(1)<0?'up':pressed(13)||axis(1)>0?'down':pressed(14)||axis(0)<0?'left':pressed(15)||axis(0)>0?'right':null;
    if(this.modal && direction&&direction!==this.lastUiDirection)this.moveUiFocus(direction);
    this.lastUiDirection=direction;
    if(justPressed(0)) {
      if(this.movie) this.movieOverlay?.querySelector<HTMLButtonElement>('.ap-skip')?.click();
      else if(this.modal) (document.activeElement as HTMLElement|null)?.click();
    }
    if(justPressed(1)&&this.started&&this.modal&&this.modalKind!=='welcome')this.closeModal();
    if(justPressed(9)&&this.started){if(this.modalKind==='pause')this.closeModal();else if(!this.modal)this.openPause();}
    this.previousUiGamepadButtons=pad.buttons.map(button=>button.pressed);
  }
  private moveUiFocus(direction:'up'|'down'|'left'|'right') {
    if(!this.modal)return;
    const controls=[...this.modal.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,input:not(:disabled),[tabindex="0"]')].filter(node=>!!node.getClientRects().length);
    if(!controls.length)return;
    const current=document.activeElement as HTMLElement|null,from=current&&controls.includes(current)?current:controls[0]!;
    if(current!==from){from.focus();return;}
    const rect=from.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    const candidates=controls.filter(node=>node!==from).map(node=>{const r=node.getBoundingClientRect(),x=r.left+r.width/2-cx,y=r.top+r.height/2-cy;return {node,x,y};}).filter(candidate=>direction==='left'?candidate.x<0:direction==='right'?candidate.x>0:direction==='up'?candidate.y<0:candidate.y>0);
    candidates.sort((a,b)=>{const primary=direction==='left'||direction==='right'?'x':'y';const secondary=primary==='x'?'y':'x';return Math.abs(a[primary])+Math.abs(a[secondary])*.45-(Math.abs(b[primary])+Math.abs(b[secondary])*.45);});
    candidates[0]?.node.focus();
  }
  private buildHud() {
    const top=el('div','ap-topbar');
    const mark=el('div','ap-mark'); mark.innerHTML='<b>APOLLO <span>11</span></b><small>KENNEDY SPACE CENTER · 16 JUL 1969</small>';
    top.append(mark); this.root.append(top);
    this.hud=el('section','ap-objective'); this.hud.setAttribute('aria-label',apolloText('Objetivo actual')); this.root.append(this.hud);
    this.subtitle=el('div','ap-radio'); this.subtitle.setAttribute('aria-live','polite'); this.root.append(this.subtitle);
    this.prompt=this.button('',()=>this.interact(),'ap-interact'); this.root.append(this.prompt);
    const mapButton=this.button('',()=>this.openMap(),'ap-minimap'); mapButton.setAttribute('aria-label',apolloText('Abrir mapa de Kennedy'));
    this.map=el('canvas'); this.map.width=240; this.map.height=200;
    mapButton.append(this.map,el('span','','LC-39A · MAPA / M')); this.root.append(mapButton);
    this.uiTarget=el('div','ap-waypoint'); this.root.append(this.uiTarget);
    this.renderObjective();
  }
  private showWelcome() {
    this.modalKind='welcome';
    const box=this.openModal('APOLLO 11','El comienzo de una nueva era');
    box.append(el('p','','16 de julio de 1969 · Centro Espacial Kennedy, Florida. Eres un técnico ficticio de apoyo a operaciones terrestres. Observa, documenta y comunica: tu trabajo termina en un punto seguro, antes del despegue de las 9:32 a. m. EDT.'));
    box.append(el('p','ap-note','Recreación educativa. Daniel Carter y los diálogos son ficticios. Las rutas se han acortado; no hay interiores accesibles. Los trajes Mercenary son una adaptación artística, no réplicas del A7L.'));
    if(this.state.completed.length || this.state.bonusCompleted.length) box.append(el('p','ap-resume',`Registro recuperado · ${this.state.completed.length + this.state.bonusCompleted.length} de 15 operaciones de historia.`));
    const start=this.button(this.state.done?'Ver epílogo':this.state.completed.length||this.state.bonusCompleted.length||this.state.checks.length?'Continuar misión':'Comenzar operaciones',()=>{
      this.started=true; this.closeModal(); void this.audio.start().catch(()=>this.notify('Audio no disponible; los subtítulos permanecen activos.'));
      if(this.state.done) this.showEnd();
      else if(this.state.completed.length || this.state.checks.length || this.state.bonusCompleted.length) {this.enterCheckpoint();if(this.resumeInstrument){this.resumeInstrument=false;this.openFieldInstrument();}}
      else this.beginMovie('intro');
    },'ap-button ap-primary'); box.append(start);
    box.append(this.button('Inspeccionar Saturn V · Sketchfab',()=>this.openSketchfab()));
    box.append(this.button('Volver al selector',()=>void this.app.showMissionSelect()));
  }
  private renderObjective() {
    if(!this.hud) return;
    const cp=this.state.current; this.hud.replaceChildren();
    this.hud.append(el('small','','MISIÓN 01 — APOLLO 11'),el('span','ap-progress',`${String(this.state.completed.length + this.state.bonusCompleted.length).padStart(2,'0')} / 15`));
    const details=el('details','ap-objective-details');details.open=this.objectivesExpanded;
    const summary=el('summary');summary.append(el('h2','',cp.title));details.append(summary,el('p','',cp.objective));
    details.addEventListener('toggle',()=>{this.objectivesExpanded=details.open;});
    const checklist=el('div','ap-checklist');
    for(const action of cp.actions) checklist.append(el('span',this.state.checks.includes(action.id)?'ap-checked':'',`${this.state.checks.includes(action.id)?'✓':'·'} ${action.label}`));
    const blocked=cp.actions.find(action=>!this.state.checks.includes(action.id)&&action.requiresBonus?.some(id=>!this.state.bonusCompleted.includes(id)));
    const missing=BONUS_CHECKPOINTS.filter(bonus=>blocked?.requiresBonus?.includes(bonus.id)&&!this.state.bonusCompleted.includes(bonus.id));
    if(missing?.length) details.append(el('small','ap-bonus-gate',`REQUERIDO PARA AVANZAR · ${(this.state.requiredStand ?? missing[0]).title}`));
    const bonusStatus=el('small','ap-bonus-status',`STANDS OBLIGATORIOS · ${this.state.bonusCompleted.length} / ${BONUS_CHECKPOINTS.length} COMPLETADOS`);
    const nextBonus=this.state.requiredStand;
    const nextStand=nextBonus ? el('small','ap-bonus-next',`SIGUIENTE STAND · ${nextBonus.title}`) : null;
    details.append(checklist,bonusStatus,el('small','ap-save',this.saveStatus || 'Guardado automático al completar cada etapa'));
    this.hud.append(details,...(nextStand?[nextStand]:[]));
    this.world?.setTarget(this.state.done?null:(this.state.requiredStand?.target ?? cp.target));
    this.world?.setBonusStatus(this.state.bonusCompleted, this.state.requiredStand?.id);
    this.world?.setStationStatus(this.state.completed,cp.id);
    const mapButton=this.root.querySelector<HTMLElement>('.ap-minimap');
    mapButton?.setAttribute('aria-label',apolloText('Abrir mapa de Kennedy'));
    const mapLabel=mapButton?.querySelector('span'); if(mapLabel)mapLabel.textContent=apolloText('LC-39A · MAPA / M');
  }
  private enterCheckpoint() {
    this.activeIndex=this.state.checkpoint; this.dialogue.enter(); this.renderObjective();
    if(this.state.checkpoint===7 && !this.state.done) {
      this.showEnd();
    }
  }
  private act(id:string) {
    const before=this.state.checkpoint;
    if(!this.state.act(id)) {
      const action=this.state.current.actions.find(entry=>entry.id===id);
      const missing=BONUS_CHECKPOINTS.filter(bonus=>action?.requiresBonus?.includes(bonus.id)&&!this.state.bonusCompleted.includes(bonus.id));
      if(missing?.length) this.notify(`OPERACIÓN REQUERIDA · ${missing.map(bonus=>bonus.title).join(' · ')}`);
      return false;
    }
    void this.save(); this.renderObjective();
    if(before===5 && this.state.checkpoint===6) {
      this.world.player.set(0,0,5600);
      this.notify('Traslado completado · área de observación a 5,6 km de LC-39A');
    }
    if(before!==this.state.checkpoint) {
      this.fieldDrafts={};
      this.closeModal(); this.notify(`CHECKPOINT ${before+1} COMPLETADO`); this.enterCheckpoint(); this.dialogue.complete(before);
    }
    return true;
  }
  private distance() { const t=this.state.current.target,p=this.world.player; return Math.hypot(p.x-t.x,p.z-t.z); }
  private interact() {
    if(!this.started || this.paused || this.modal || this.movie) return;
    const bonus=this.world.nearbyBonus();
    if(bonus && !this.state.bonusCompleted.includes(bonus.id)) { this.openBonusMission(bonus.id); return; }
    if(this.state.done) return;
    if(this.distance()>15) {this.notify('Sigue el marcador hasta la estación autorizada.');return;}
    const index=this.state.checkpoint;
    if(index===4) {
      if(this.state.requiredStand) { this.notify(`OPERACIÓN REQUERIDA · ${this.state.requiredStand.title}`); return; }
      this.beginMovie('crew');return;
    }
    if(index===6) {this.beginMovie('launch');return;}
    if(index===7) {this.showEnd();return;}
    this.showStation();
  }
  private openBonusMission(id:string) {
    const bonus=BONUS_CHECKPOINTS.find(entry=>entry.id===id);
    if(!bonus || this.state.bonusCompleted.includes(id) || Math.hypot(this.world.player.x-bonus.target.x,this.world.player.z-bonus.target.z)>11) return;
    const missing=BONUS_CHECKPOINTS.filter(entry=>bonus.requires?.includes(entry.id)&&!this.state.bonusCompleted.includes(entry.id));
    if(missing?.length) { this.notify(`STAND BLOQUEADO · COMPLETA ${missing[0]!.title}`); return; }
    if(!this.state.canStartBonus(id)) { this.notify('Continúa el recorrido histórico antes de abrir este stand.'); return; }
    this.modalKind='bonus';
    const box=this.openModal('STAND OBLIGATORIO · OPERACIÓN DE APOYO',bonus.title);
    this.audio.pause(true,true);
    this.world.setStandFocus(bonus.target);
    this.bonusKey=id;
    this.bonusMission=mountBonusMission(box,bonus,{draft:this.standDrafts[id],onDraft:draft=>{
      this.standDrafts[id]=draft;clearTimeout(this.draftTimer);this.draftTimer=window.setTimeout(()=>void this.save(),450);
    },onFeedback:kind=>this.audio.bonusFeedback(kind),onComplete:()=>{
      this.bonusMission?.dispose(); this.bonusMission=null;
      this.bonusKey='';delete this.standDrafts[id];
      if(this.state.completeBonus(id)) {
        void this.save();this.renderObjective();this.closeModal();this.notify(`STAND COMPLETADO · ${bonus.title}`);
        const handoff=STAND_HANDOFFS[id];if(handoff)this.dialogue.say('Daniel Carter',handoff.reply,9);
      }
    },onCancel:()=>this.closeModal()});
  }
  private showStation() {
    if(this.state.checkpoint===0 && !this.state.checks.includes('arrive')) {
      if(this.act('arrive') && this.state.checkpoint!==0)return;
    }
    const cp=this.state.current,kind=FIELD_INSTRUMENTS[this.state.checkpoint];
    if(!kind)return;
    // Field tasks open directly at the object: no trivia or confirmation checklist.
    if(this.state.checkpoint!==0 || !this.state.checks.includes('landmark')) {this.openFieldInstrument();return;}
    const box=this.openModal('Instrumentos de campo',cp.title);
    box.append(el('p','',cp.objective),this.button('Consultar el mapa',()=>this.openMap(),'ap-button ap-primary'),this.button('Regresar al recorrido',()=>this.closeModal()));
  }
  private captureInstrumentDraft() {
    if(this.bonusMission&&this.bonusKey)this.standDrafts[this.bonusKey]=this.bonusMission.snapshot();
    if(this.instrument && this.instrumentKey)this.fieldDrafts[this.instrumentKey]=this.instrument.snapshot();
  }
  private disposeInstrument() {
    this.captureInstrumentDraft();
    this.instrument?.dispose();this.instrument=null;this.instrumentKey='';
    this.world?.setInspectionTarget(null);
  }
  private openFieldInstrument() {
    const checkpoint=this.state.checkpoint,kind=FIELD_INSTRUMENTS[checkpoint];
    if(!kind || this.distance()>15 || this.state.done)return;
    if(checkpoint!==0 && this.state.requiredStand) {this.notify(`OPERACIÓN REQUERIDA · ${this.state.requiredStand.title}`);return;}
    const key=fieldDraftKey(checkpoint,kind);
    const box=this.openModal('Instrumentos de campo',this.state.current.title);
    box.classList.add('ap-instrument-dialog');this.modal?.classList.add('ap-instrument-overlay');
    const stage=el('div','ap-instrument-stage');box.append(stage);
    this.instrumentKey=key;
    this.world.setInspectionTarget(kind==='survey'?'rocket':null);
    this.instrument=mountInstrument(stage,kind,{
      language:apolloLanguage(),muted:this.audio.muted,variant:checkpoint===0?'orientation':'full',draft:this.fieldDrafts[key],
      onDraft:draft=>{
        if(this.disposed || this.state.checkpoint!==checkpoint)return;
        this.fieldDrafts[key]=draft;
        clearTimeout(this.draftTimer);this.draftTimer=window.setTimeout(()=>void this.save(),450);
      },
      onCancel:()=>{this.closeModal();void this.save();},
      onComplete:()=>{
        if(this.disposed || this.state.checkpoint!==checkpoint || this.distance()>15)return;
        this.disposeInstrument();delete this.fieldDrafts[key];this.closeModal();
        const actions=checkpoint===0?['landmark']:this.state.current.actions.map(a=>a.id);
        for(const action of actions)this.act(action);
        this.audio.radio();this.notify('Operación validada');
        if(checkpoint===0 && this.state.checkpoint===0)this.showStation();
      },
    });
    this.voice.stop();
  }
  private beginMovie(mode:'intro'|'crew'|'launch') {
    if(mode==='crew' && (this.state.checkpoint!==4 || this.distance()>15)) return;
    if(mode==='launch' && (this.state.checkpoint!==6 || this.distance()>15)) return;
    this.closeModal(); this.dialogue.clear();this.voice.stop();this.movieVoiceKey=''; this.movie=mode; this.movieTime=0; this.world.setSuspended(true);
    this.movieOverlay=el('div','ap-cinema'); this.root.append(this.movieOverlay); this.root.classList.add('ap-in-cinema'); document.body.classList.add('apollo-cinematic');
    if(mode==='intro') this.movieOverlay.append(this.button('Omitir introducción',()=>this.finishMovie(),'ap-skip'));
    this.renderMovie();
  }
  private renderMovie() {
    if(!this.movie || !this.movieOverlay) return;
    const time=this.movieTime, mode=this.movie;
    this.world.setCinematic(mode,time);
    this.movieOverlay.classList.toggle('ap-black',mode==='intro' && time<4 || mode==='crew' && time>=24);
    let title='',label='',text='';
    if(mode==='intro') {
      if(time<4) {label='FLORIDA, ESTADOS UNIDOS';title='16 DE JULIO DE 1969';text='CENTRO ESPACIAL KENNEDY';}
      else if(time<30) {label='NARRACIÓN ORIGINAL';text=INTRO[Math.min(2,Math.floor((time-4)/8.7))];}
      else {label='MISIÓN 01';title='APOLLO 11';text='EL COMIENZO DE UNA NUEVA ERA';}
    } else if(mode==='crew') {
      label=time<24?'RECREACIÓN HISTÓRICA RETROSPECTIVA · 06:27 EDT':'TRANSICIÓN TEMPORAL · 09:30 EDT';
      title=time<24?'EL CAMINO HACIA APOLLO 11':'TRIPULACIÓN A BORDO';
      text=time<24?'Daniel Carter (ficticio): «Ahí van. Armstrong, Collins y Aldrin. Después de tantos años de preparación, todo se reduce a este momento.»':'El traslado y el embarque han concluido. Regresamos a los preparativos finales de observación.';
    } else {
      label='16 JUL 1969 · 09:32 EDT · LC-39A';
      title=time<10?`T − ${String(Math.ceil(10-time)).padStart(2,'0')}`:time<16?'DESPEGUE':'APOLLO 11 · EN ASCENSO';
      text=time<5?'Daniel Carter (ficticio): «Atención, estamos entrando en los últimos segundos. Toda la atención está puesta sobre el Saturn V.»':time<10?['Cinco…','Cuatro…','Tres…','Dos…','Uno…'][Math.min(4,Math.floor(time-5))]:time<19?'Daniel Carter (ficticio): «¡Despegue confirmado!»':'Daniel Carter (ficticio): «Ahí está. Apollo 11 se dirige hacia el espacio.»';
      this.audio.launch(time,5600);
    }
    let caption=this.movieOverlay.querySelector<HTMLElement>('.ap-cinema-caption');
    if(!caption) {caption=el('div','ap-cinema-caption'); this.movieOverlay.append(caption);}
    const signature=`${label}|${title}|${text}`;
    if(caption.dataset.signature!==signature) {
      caption.dataset.signature=signature;caption.replaceChildren(el('small','',label),el('h1','',title),el('p','',text));
      const voiceKey=`${mode}:${text}`;
      if(this.movieVoiceKey!==voiceKey){this.movieVoiceKey=voiceKey;this.voice.speak(apolloText(text),mode==='intro'?'Narrador':'Daniel Carter');}
    }
    if(time>=(mode==='intro'?36:mode==='crew'?28:60)) this.finishMovie();
  }
  private finishMovie() {
    const mode=this.movie; if(!mode)return;
    this.voice.stop();
    this.movie=null; this.movieOverlay?.remove(); this.movieOverlay=null;
    this.root.classList.remove('ap-in-cinema'); document.body.classList.remove('apollo-cinematic'); this.world.setCinematic(null,0); this.world.setSuspended(this.paused);
    if(mode==='launch') this.audio.stopLaunch();
    if(mode==='intro') {for(const id of ['intro-history','intro-crew']) if(!this.state.dialogues.includes(id))this.state.dialogues.push(id);}
    if(mode==='crew') this.act('crew-film');
    else if(mode==='launch') this.act('launch-film');
    else this.enterCheckpoint();
  }
  private showEnd() {
    this.modalKind='end';
    const box=this.openModal(this.state.done?'MISIÓN 01 COMPLETADA':'EPÍLOGO · 16 DE JULIO DE 1969','Apollo 11 dejó la Tierra');
    box.append(el('p','','Cuatro días después, el 20 de julio, Neil Armstrong y Buzz Aldrin alunizaron en el Eagle. Michael Collins permaneció en órbita lunar a bordo del Columbia. Esos acontecimientos pertenecen al próximo capítulo.'));
    box.append(el('p','ap-resume','PRÓXIMO CAPÍTULO: EL VIAJE HACIA LA LUNA'));
    box.append(this.button(this.state.done?'Regresar al selector':'Completar misión y regresar',()=>{
      box.querySelectorAll('button').forEach(b=>b.disabled=true);
      if(!this.state.done)this.act('finish');
      void this.save().then(async()=>{
        try { await progressApi.complete(SLUG,{ticksSurvived:Math.floor(this.state.elapsed),decisionsMade:26,samplesCollected:0,finalResources:{fuel:100,pressure:100,stability:100,telemetry:100},outcome:'success',summary:'Apollo 11: quince operaciones de apoyo terrestre completadas; traslado y lanzamiento observados desde el área segura.'}); } catch { this.notify('Misión guardada localmente; la sincronización del informe queda pendiente.'); }
        return this.app.showMissionSelect();
      });
    },'ap-button ap-primary'));
    box.append(this.button('Fuentes históricas y créditos',()=>this.openCredits()));
  }
  private openModal(kicker:string,title:string) {
    this.disposeInstrument();this.voice.pause(true);
    this.modal?.remove(); this.previousFocus=document.activeElement as HTMLElement|null;
    const overlay=el('div','ap-modal'); const box=el('section','ap-dialog');
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label',apolloText(title)); box.tabIndex=-1;
    box.append(el('small','ap-kicker',kicker),el('h1','',title)); overlay.append(box); this.root.append(overlay); this.modal=overlay;
    this.paused=true; this.world?.setSuspended(true); this.audio.pause(true);
    overlay.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const controls=[...box.querySelectorAll<HTMLElement>('button:not(:disabled), a, select, input:not(:disabled), [tabindex="0"]')];
      if(!controls.length)return; const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey && (document.activeElement===first || document.activeElement===box)) {e.preventDefault();last.focus();}
      else if(!e.shiftKey && (document.activeElement===last || document.activeElement===box)) {e.preventDefault();first.focus();}
    });
    this.root.classList.add('ap-modal-open'); this.ignoreUiGamepadUntil=performance.now()+260;
    box.focus(); queueMicrotask(()=>{if(this.modal!==overlay)return;const first=box.querySelector<HTMLElement>('button:not(:disabled),a[href],select,input:not(:disabled),[tabindex="0"]');(first??box).focus();}); return box;
  }
  private closeModal() {
    this.disposeInstrument();
    const closingStand=!!this.bonusMission;
    this.bonusMission?.dispose(); this.bonusMission=null;this.bonusKey='';
    this.modal?.remove();this.modal=null;this.modalKind=null;this.paused=false;this.root.classList.remove('ap-modal-open');this.ignoreUiGamepadUntil=performance.now()+180;this.voice.pause(false);
    this.world?.setStandFocus(null);
    this.world?.setSuspended(!this.started || !!this.movie);this.audio.pause(!this.started);
    if(this.started) this.world?.renderer.domElement.focus({preventScroll:true});
    if(closingStand&&this.started)void this.save();
  }
  private openPause() {
    if(!this.world || !this.started || this.modal)return;
    this.modalKind='pause';
    const box=this.openModal('OPERACIONES EN PAUSA','Un momento antes de la historia');
    this.root.querySelector<HTMLElement>('.ap-modal')?.classList.add('ap-pause-overlay');
    box.classList.add('ap-pause-dialog');
    box.append(el('div','ap-pause-status','MISSION CONTROL · APOLLO 11 · KENNEDY SPACE CENTER'),el('p','ap-pause-intro','La misión está detenida. Revisa el estado operativo y retoma el recorrido cuando estés listo.'));
    const grid=el('div','ap-pause-grid');
    const resume=this.pauseControl('▶','Continuar operaciones',()=>this.closeModal()); resume.classList.add('ap-pause-control--primary');
    const mute=this.pauseControl(this.audio.muted?'◌':'♪',this.audio.muted?'Activar audio':'Silenciar audio',()=>{
      this.audio.toggle();this.voice.setVolume(this.audio.muted?0:.82);
      mute.replaceChildren(el('span','ap-pause-icon',this.audio.muted?'◌':'♪'),el('strong','',this.audio.muted?'Activar audio':'Silenciar audio'));
      mute.setAttribute('aria-pressed',String(this.audio.muted));
    });
    mute.setAttribute('aria-pressed',String(this.audio.muted));
    const restart=this.pauseControl('↻','Reiniciar misión',()=>this.confirmReset());
    const missions=this.pauseControl('⌂','Volver a misiones',()=>{void this.save().then(()=>this.app.showMissionSelect());});
    const languageHost=el('div','ap-language-host');
    const language=this.pauseControl('文','Idioma',()=>this.togglePauseLanguage(languageHost));
    language.setAttribute('aria-expanded','false');language.setAttribute('aria-controls','ap-pause-language-options');languageHost.append(language);
    grid.append(resume,mute,restart,missions,languageHost); box.append(grid);
    const mapCanvas=el('canvas','ap-pause-map'); mapCanvas.width=1100; mapCanvas.height=460; this.drawMap(mapCanvas); box.append(el('h2','ap-pause-map-title','Mapa de operaciones'),mapCanvas);
  }
  private pauseControl(icon:string,label:string,callback:()=>void):HTMLElement { const b=this.button('',callback,'ap-pause-control'); b.append(el('span','ap-pause-icon',icon),el('strong','',label)); return b; }
  private togglePauseLanguage(host:HTMLElement) {
    const trigger=host.querySelector('button'),existing=host.querySelector('.ap-language-options');
    if(existing){existing.remove();trigger?.setAttribute('aria-expanded','false');return;}
    trigger?.setAttribute('aria-expanded','true');
    const options=el('div','ap-language-options');
    options.id='ap-pause-language-options';options.setAttribute('role','group');options.setAttribute('aria-label',apolloText('Idioma'));
    (['es','en','fr'] as const).forEach(language=>{const button=this.button(language.toUpperCase(),()=>setLanguage(language),'ap-language-option');button.setAttribute('aria-pressed',String(apolloLanguage()===language));options.append(button);});
    host.append(options);
    options.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }
  private confirmReset() {
    this.modalKind='reset';
    const box=this.openModal('REINICIAR MISIÓN 01','Volver al comienzo');
    box.append(el('p','','Se reiniciarán únicamente los checkpoints y diálogos de Apollo 11. El progreso de otras misiones se conserva.'));
    box.append(this.button('Reiniciar Apollo 11',()=>void (async()=>{
      await this.saveQueue;
      try {await progressApi.replay(SLUG);} catch {this.notify('No se pudo reiniciar en el servidor. Comprueba la conexión.');return;}
      try {localStorage.removeItem(this.localKey);}catch{}
      this.started=false; await this.app.showMission1(new ApolloState().toJSON());
    })(),'ap-button ap-primary'),this.button('Cancelar',()=>{this.closeModal();this.openPause();}));
  }
  private openMap() {
    if(!this.started || this.movie || !this.world)return;
    if(this.instrument){this.notify('Cierra el instrumento para abrir el mapa.');return;}
    if(this.state.checkpoint===0)this.act('map');
    this.modalKind='map'; const box=this.openModal('MAPA DE OPERACIONES · GEOGRAFÍA COMPRIMIDA','Centro Espacial Kennedy');
    const canvas=el('canvas','ap-large-map');canvas.width=720;canvas.height=540;this.drawMap(canvas);
    box.append(canvas,el('p','ap-note','N ↑ · Verde: completado · Ámbar: destino activo · Rojo: perímetro restringido. Las coordenadas del mapa corresponden al escenario. Las conexiones son una adaptación jugable de las distancias reales.'));
    const cp=this.state.current;box.append(el('p','',`${apolloText(cp.title)} · ${Math.round(this.distance())} ${apolloText('m de recorrido simulado')}`));
    box.append(this.button('Volver a operaciones',()=>this.closeModal(),'ap-button ap-primary'));
  }
  private drawMap(canvas:HTMLCanvasElement) {
    const c=canvas.getContext('2d');if(!c)return;
    const w=canvas.width,h=canvas.height, sx=w/400,sz=h/470;
    const p=(x:number,z:number)=>[(x+200)*sx,(z+40)*sz] as const;
    c.fillStyle='#10262d';c.fillRect(0,0,w,h);
    c.strokeStyle='#34535a';c.lineWidth=1;
    for(let x=0;x<w;x+=w/10){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
    for(let y=0;y<h;y+=h/10){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    c.strokeStyle='#08171d';c.lineCap='square';c.lineWidth=Math.max(11,w*.028);
    // Same soil, service roads and building footprints as ApolloWorld.buildGround().
    const road=(x1:number,z1:number,x2:number,z2:number)=>{const [a,b]=p(x1,z1),[d,e]=p(x2,z2);c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();c.strokeStyle='#c7b779';c.lineWidth=Math.max(6,w*.014);c.stroke();c.strokeStyle='#08171d';c.lineWidth=Math.max(11,w*.028);};
    for(const segment of SITE_ROADS)road(segment.from.x,segment.from.z,segment.to.x,segment.to.z);
    c.fillStyle='#37534b';
    for(const zone of SITE_ZONES){const area=zoneBounds(zone.members),[x,z]=p(area.x-area.width/2,area.z-area.depth/2);c.fillRect(x,z,area.width*sx,area.depth*sz);}
    c.strokeStyle='#7d9482';c.lineWidth=Math.max(1,w*.003);c.lineCap='round';
    for(const points of SITE_WALKWAYS){c.beginPath();points.forEach((point,i)=>{const[x,z]=p(point.x,point.z);if(i)c.lineTo(x,z);else c.moveTo(x,z)});c.stroke();}
    c.fillStyle='#28474b';c.strokeStyle='#78a39a';c.lineWidth=2;
    for(const {x,z,width:bw,depth:bd} of SITE_BUILDINGS){const [a,b]=p(x-bw/2,z-bd/2);c.fillRect(a,b,bw*sx,bd*sz);c.strokeRect(a,b,bw*sx,bd*sz);}
    const [rx,rz]=p(0,0);c.fillStyle='#9b4f4b33';c.beginPath();c.ellipse(rx,rz,90*sx,90*sz,0,0,Math.PI*2);c.fill();c.strokeStyle='#d47c6e';c.setLineDash([7,5]);c.lineWidth=2;c.stroke();c.setLineDash([]);
    c.font=`600 ${Math.max(10,w/40)}px sans-serif`;c.fillStyle='#f0e7c9';c.fillText(apolloText('N ↑'),12,24);c.fillText(apolloText('39A · RESTRINGIDO'),rx+12,rz+5);
    c.fillStyle='#b8d1c6';c.fillText(apolloText('↖ VAB · 1 km'),12,Math.max(42,h*.18));
    c.font=`600 ${Math.max(10,w/52)}px sans-serif`;
    CHECKPOINTS.slice(0,6).forEach((cp,i)=>{const [x,z]=p(cp.target.x,cp.target.z);const completed=this.state.completed.includes(cp.id),active=!this.state.requiredStand && i===this.state.checkpoint;c.fillStyle=completed?'#76d49b':active?'#ffd166':'#86a8ae';c.strokeStyle='#07151b';c.lineWidth=3;c.beginPath();c.arc(x,z,active?8:5,0,Math.PI*2);c.fill();c.stroke();if(active){c.strokeStyle='#ffd166';c.lineWidth=2;c.beginPath();c.arc(x,z,13,0,Math.PI*2);c.stroke();}if(w>300){c.fillStyle=completed?'#a9e7be':active?'#ffe29a':'#d5e4df';c.fillText(`C${i+1}`,x+13,z+5);}});
    BONUS_CHECKPOINTS.forEach((bonus,index)=>{const [x,z]=p(bonus.target.x,bonus.target.z);const completed=this.state.bonusCompleted.includes(bonus.id),active=this.state.requiredStand?.id===bonus.id;c.fillStyle=completed?'#76d49b':'#e99a61';c.strokeStyle='#07151b';c.lineWidth=3;c.beginPath();c.rect(x-6,z-6,12,12);c.fill();c.stroke();if(active){c.strokeStyle='#ffd166';c.lineWidth=2;c.strokeRect(x-10,z-10,20,20);}if(w>300){c.fillStyle=completed?'#a9e7be':'#ffc09a';c.fillText(`S${index+1}`,x+11,z+4);}});
    const target=this.state.requiredStand?.target ?? this.state.current.target;
    const remote=this.world.player.z>5000;
    const transfer=CHECKPOINTS[5].target;
    const [tx,tz]=p(remote?transfer.x:target.x,remote?transfer.z:target.z),[px,pz]=p(remote?transfer.x:this.world.player.x,remote?transfer.z:this.world.player.z);
    c.strokeStyle='#ffd166';c.lineWidth=3;c.setLineDash([8,6]);c.beginPath();c.moveTo(px,pz);c.lineTo(tx,tz);c.stroke();c.setLineDash([]);
    c.save();c.translate(px,pz);c.rotate(-this.world.yaw);c.fillStyle='#07151b';c.beginPath();c.moveTo(0,-11);c.lineTo(8,8);c.lineTo(0,4);c.lineTo(-8,8);c.closePath();c.fill();c.fillStyle='#ffffff';c.beginPath();c.moveTo(0,-8);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fill();c.restore();
    if(w>300){const legendY=h-16;c.font='600 11px sans-serif';c.fillStyle='#d5e4df';c.fillText('● HISTORIA',w-330,legendY);c.fillStyle='#ffc09a';c.fillText('■ SUBMISIÓN',w-230,legendY);c.fillStyle='#ffffff';c.fillText('◆ TÚ',w-112,legendY);}
  }
  private openSketchfab() {
    this.modalKind='sketchfab';
    const box=this.openModal('VISOR OFICIAL EXTERNO · NO INTEGRADO EN EL ESCENARIO','Saturn V de HUuser2024');
    box.append(el('p','','LEGO Animated Saturn V Apollo 11 Rocket launch · 1 animación · 10.291.703 caras. Licencia Standard, sin descarga autorizada disponible. El lanzamiento del escenario utiliza una recreación original independiente.'));
    const frame=el('iframe','ap-sketchfab');frame.title='Visor oficial Sketchfab del Saturn V de HUuser2024';
    frame.src='https://sketchfab.com/models/6d25ada102844d81b0b9b4149f720531/embed?autostart=1&preload=1&ui_infos=1&api_version=1&api_id=apollo11';
    frame.allow='autoplay; fullscreen; xr-spatial-tracking';frame.allowFullscreen=true;box.append(frame);
    // Official Viewer API is deliberately confined to the embedded educational viewer.
    const script=el('script');script.src='https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
    script.onload=()=>{
      const Client=(window as unknown as {Sketchfab?:new(f:HTMLIFrameElement)=>{init:(id:string,options:object)=>void}}).Sketchfab;
      if(Client && frame.isConnected) new Client(frame).init('6d25ada102844d81b0b9b4149f720531',{autostart:1,success:(api:{start:()=>void})=>api.start(),error:()=>this.notify('El visor requiere conexión con Sketchfab. Puedes continuar la misión sin él.')});
    };
    script.onerror=()=>this.notify('Sketchfab no está disponible. El escenario jugable funciona de forma independiente.');box.append(script);
    const a=el('a','ap-link','Abrir ficha y condiciones del autor');a.href='https://sketchfab.com/3d-models/lego-animated-saturn-v-apollo-11-rocket-launch-6d25ada102844d81b0b9b4149f720531';a.target='_blank';a.rel='noopener noreferrer';box.append(a);
    box.append(this.button('Volver',()=>{this.closeModal();if(!this.started)this.showWelcome();}));
  }
  private openCredits() {
    this.modalKind='credits';
    const box=this.openModal('FUENTES, LICENCIAS Y ADAPTACIONES','Una recreación de un día real');
    box.append(el('p','','Hechos documentados: Apollo 11, Saturn V AS-506, lanzamiento desde 39A el 16 de julio de 1969 a las 09:32 EDT. Traslado de la tripulación a las 06:27 EDT. Epílogo lunar del 20 de julio.'));
    const links=[['NASA · Apollo 11','https://www.nasa.gov/mission/apollo-11/'],['NASA · El día del lanzamiento','https://www.nasa.gov/history/50-years-ago-apollo-11-off-to-the-moon/'],['Mercenary Astronaut · Peter_D · CC BY 4.0','https://sketchfab.com/3d-models/mercenary-astronaut-7fd399d488ae4576a0fc62715892956c'],['Licencia CC BY 4.0','https://creativecommons.org/licenses/by/4.0/']];
    for(const [label,url]of links){const a=el('a','ap-link',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}
    box.append(el('p','ap-note','Mercenary Astronaut fue optimizado y escalado por este proyecto. Tres copias representan a Armstrong, Collins y Aldrin, sin atribuirles diálogos. No son retratos ni reproducciones de sus trajes. Saturn V, edificios, vehículos, música y efectos son originales del proyecto. Carter, las tareas y sus registros son ficticios. El terreno y los recorridos están comprimidos. La película muestra el traslado en retrospectiva; la pantalla negra omite el embarque, sin acceso a interiores.'));
    box.append(this.button('Volver',()=>{this.closeModal();if(this.state.checkpoint===7)this.showEnd();else if(!this.started)this.showWelcome();}));
  }
  private notify(text:string) {
    this.root.querySelector('.ap-toast')?.remove();const n=el('div','ap-toast',text);n.setAttribute('role','status');this.root.append(n);
    clearTimeout(this.flashTimer);this.flashTimer=window.setTimeout(()=>n.remove(),4800);
  }
  refreshLanguage(): void {
    if(this.startFailure){const loading=this.root.querySelector<HTMLElement>('.ap-loading');if(loading)this.renderStartFailure(loading,this.startFailure);return;}
    if(!this.root.classList.contains('ap-ready')){const loading=this.root.querySelector('.ap-loading');if(loading)loading.textContent=apolloText('PREPARANDO OPERACIONES · APOLLO 11');return;}
    this.world.refreshLanguage();
    this.dialogue?.refreshLanguage();
    if (this.movie) {
      const caption=this.movieOverlay?.querySelector<HTMLElement>('.ap-cinema-caption');if(caption)caption.dataset.signature='';
      const skip=this.movieOverlay?.querySelector<HTMLElement>('.ap-skip');if(skip)skip.textContent=apolloText('Omitir introducción');
      this.movieVoiceKey='';this.renderMovie();return;
    }
    this.renderObjective(); this.updateNavigation();
    const kind=this.modalKind;
    const bonusId=this.bonusKey;
    if (!kind) return;
    this.captureInstrumentDraft();
    this.bonusMission?.dispose(); this.bonusMission=null;
    if (this.instrument) { this.disposeInstrument(); this.modal?.remove(); this.modal=null; this.modalKind=null; this.openFieldInstrument(); return; }
    this.modal?.remove(); this.modal=null; this.modalKind=null;
    if (kind==='welcome') this.showWelcome();
    else if (kind==='pause') this.openPause();
    else if (kind==='map') this.openMap();
    else if (kind==='end') this.showEnd();
    else if (kind==='credits') this.openCredits();
    else if (kind==='sketchfab') this.openSketchfab();
    else if (kind==='reset') this.confirmReset();
    else if (kind==='bonus') this.openBonusMission(bonusId);
  }
  private async save() {
    if(this.disposed || !this.started)return;
    this.captureInstrumentDraft();
    const snapshot=this.state.toJSON(),savedAt=Date.now();
    const drafts=JSON.parse(JSON.stringify(this.fieldDrafts)) as FieldDrafts;
    const standDrafts=JSON.parse(JSON.stringify(this.standDrafts)) as Record<string,StandDraft>;
    let savedLocally=false;
    try {localStorage.setItem(this.localKey,JSON.stringify({state:snapshot,savedAt,drafts,standDrafts}));savedLocally=true;this.saveStatus='Guardado local · sincronizando…';} catch {this.saveStatus='Almacenamiento local no disponible · sincronizando…';}
    const wire={tick:Math.floor(this.state.elapsed),resources:{fuel:100,pressure:100,stability:100,telemetry:100},resolvedDecisionIds:[],log:[],apollo11:snapshot,apollo11SavedAt:savedAt,apollo11Drafts:drafts,apollo11StandDrafts:standDrafts} as unknown as MissionSaveState;
    this.saveQueue=this.saveQueue.catch(()=>{}).then(async()=>{
      try {await progressApi.autosave(SLUG,wire,snapshot.done?100:(snapshot.completed.length+snapshot.bonusCompleted.length)/15*100);this.saveStatus='Registro guardado y sincronizado';}
      catch {this.saveStatus=savedLocally?'Guardado local · sin conexión al servidor':'No se pudo guardar · conserva esta sesión e intenta de nuevo';}
      if(!this.disposed)this.renderObjective();
    });
    return this.saveQueue;
  }
  private readonly frame=(now:number) => {
    if(this.disposed)return;
    const raw=Math.max(0,(now-this.lastTime)/1000),dt=Math.min(.1,raw);this.lastTime=now;
    const beforeX=this.world.player.x,beforeZ=this.world.player.z;
    this.pollUiGamepad(now);
    this.world.update(this.paused ? 0 : dt);
    if(this.started && !this.paused && !this.movie) {
      this.stepDistance+=Math.hypot(this.world.player.x-beforeX,this.world.player.z-beforeZ);
      if(this.stepDistance>1.5){this.stepDistance=0;this.audio.step();}
    }
    if(!this.paused) {
      if(this.started) {
        this.state.elapsed+=dt;
        if(this.movie){
          let next=this.movieTime+dt;
          if(this.movie==='intro' && this.voice.isSpeaking){
            const boundary=[4,12.7,21.4,30,36].find(t=>t>this.movieTime);
            if(boundary && next>=boundary)next=boundary-.01;
          }
          this.movieTime=next;this.renderMovie();
        }
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
    const bonus=this.world.nearbyBonus();
    const bonusNear=!!bonus && !this.state.bonusCompleted.includes(bonus.id);
    const near=this.distance()<=15;
    const destination=this.state.requiredStand ?? this.state.current;
    const remaining=Math.hypot(this.world.player.x-destination.target.x,this.world.player.z-destination.target.z);
    this.prompt.hidden=!this.started || this.paused || !!this.movie || (this.state.done && !bonusNear);
    this.prompt.textContent=bonusNear?'E · '+(this.state.canStartBonus(bonus!.id)?bonus!.title:'Stand pendiente de autorización'):near?'E · '+(this.state.checkpoint===4?'Observar a la tripulación':this.state.checkpoint===6?'Presenciar el lanzamiento':'Examinar estación'):`${Math.round(remaining)} m · ${destination.title}`;
    this.prompt.textContent=apolloText(this.prompt.textContent);
    this.prompt.disabled=!(near || bonusNear);
    if(this.mobileInteract){this.mobileInteract.hidden=!(this.started && !this.paused && !this.movie && (near || bonusNear));this.mobileInteract.textContent=apolloText(bonusNear?'Abrir stand':'Examinar');}
    if(this.uiTarget) {
      this.uiTarget.hidden=!!this.movie || this.paused;
      const projected=this.world.projectDestination(destination.target),width=this.root.clientWidth,height=this.root.clientHeight;
      const x=projected.behind?width*.5:Math.max(55,Math.min(width-55,(projected.x*.5+.5)*width));
      const y=projected.behind?height-245:Math.max(72,Math.min(height-245,(-projected.y*.5+.5)*height));
      this.uiTarget.style.left=`${x}px`;this.uiTarget.style.top=`${y}px`;
      this.uiTarget.textContent=`${projected.behind?'↶':'◇'} ${Math.round(remaining)} m`;
    }
  }
  diagnostics() {
    const times=this.frameTimes,average=times.reduce((a,b)=>a+b,0)/Math.max(1,times.length);
    return {...this.world.diagnostics(),checkpoint:this.state.checkpoint,checks:this.state.checks,completed:this.state.completed,movie:this.movie,movieTime:this.movieTime,quality:this.quality,frameMs:average,fps:average?1000/average:0,samples:times.length};
  }
  unmount() {
    document.body.classList.remove('apollo-active');
    document.body.classList.remove('apollo-cinematic');
    this.disposeInstrument();this.bonusMission?.dispose();this.bonusMission=null;this.voice.dispose();clearTimeout(this.draftTimer);
    this.disposed=true;cancelAnimationFrame(this.raf);clearTimeout(this.flashTimer);
    document.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onVisibility);
    window.removeEventListener('resize',this.onResize);window.removeEventListener('pagehide',this.onPageHide);
    this.audio.dispose();this.world?.dispose();this.modal?.remove();this.root?.remove();
  }
}
