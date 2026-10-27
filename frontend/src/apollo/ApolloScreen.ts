import type { Screen } from '@/screens/Screen';
import type { GameApp } from '@/core/GameApp';
import type { MissionSaveState } from '@/types';
import { progressApi } from '@/api/progressApi';
import { MISSION_SLUGS } from '@/config/gameConfig';
import { ApolloState, CHECKPOINTS } from './ApolloState';
import { ApolloWorld } from './ApolloWorld';
import { ApolloAudio } from './ApolloAudio';
import { ApolloDialogue } from './ApolloDialogue';
import './apollo.css';
import './apollo-start-error.css';
import { apolloText, apolloLanguage } from './ApolloLocale';
import { ApolloVoice } from './ApolloVoice';
import { setLanguage } from '@/core/i18n';
import { mountInstrument, type InstrumentHandle, type InstrumentKind } from './ApolloInstruments';
import { FIELD_INSTRUMENTS, fieldDraftKey, restoreFieldDrafts, type FieldDrafts } from './ApolloFieldProgress';

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
type Saved = { state:ReturnType<ApolloState['toJSON']>; savedAt:number; drafts?:FieldDrafts };
type Resume = ReturnType<ApolloState['toJSON']> & {fieldDrafts?:unknown;resumeInstrument?:boolean};

type SceneStartFailure = {
  kind: 'webgl' | 'scene';
  title: string;
  message: string;
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

  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return {
    kind: 'scene',
    title: 'La misión no pudo preparar el escenario',
    message: `WebGL está disponible, pero la escena encontró un problema al cargar sus recursos${detail}. Tu progreso no se ha perdido.`,
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
  private modalKind: 'welcome'|'pause'|'map'|'end'|'credits'|'sketchfab'|'reset'|'station'|null = null;
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
  private zoom=false;
  private stepDistance=0;
  private audio=new ApolloAudio();
  private voice=new ApolloVoice();
  private instrument:InstrumentHandle|null=null;
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
  private readonly onKey=(event:KeyboardEvent) => {
    if(event.key==='Escape') {event.preventDefault();if(this.modal && this.started)this.closeModal();else if(this.started && !this.movie)this.openPause();return;}
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
    return {...this.state.toJSON(),fieldDrafts:this.fieldDrafts,resumeInstrument:!!this.instrument};
  }
  async mount(container:HTMLElement) {
    document.body.classList.add('apollo-active');
    this.root=el('div','apollo-screen');
    const loading=el('div','ap-loading','PREPARANDO OPERACIONES · APOLLO 11'); this.root.append(loading); container.append(this.root);
    let saved:unknown=this.initialState;
    let drafts:unknown=(this.initialState as Resume|undefined)?.fieldDrafts;
    this.resumeInstrument=!!(this.initialState as Resume|undefined)?.resumeInstrument;
    let local:Saved|undefined;
    try { local=JSON.parse(localStorage.getItem(this.localKey) ?? 'null') ?? undefined; } catch {}
    if (!saved) {
      try {
        const remote=await progressApi.get(SLUG);
        const envelope=remote.state as unknown as {apollo11?:unknown;apollo11SavedAt?:number;apollo11Drafts?:unknown};
        const remoteState=envelope.apollo11;
        const cloudTime=envelope.apollo11SavedAt ?? (Date.parse((remote.updatedAt ?? '').replace(/(?<!Z)$/, 'Z')) || 0);
        const valid=(value:unknown)=>{if(!value || typeof value!=='object')return false;const original=value as ReturnType<ApolloState['toJSON']>,restored=new ApolloState(value).toJSON();return original.version===restored.version && original.checkpoint===restored.checkpoint && original.elapsed===restored.elapsed && original.done===restored.done && ['completed','checks','dialogues'].every(k=>JSON.stringify(original[k as 'checks'])===JSON.stringify(restored[k as 'checks']));};
        const localValid=local && valid(local.state);
        const remoteValid=valid(remoteState);
        const preferLocal=localValid && (!remoteValid || local!.savedAt>cloudTime);
        saved=preferLocal ? local!.state : remoteValid?remoteState:undefined;
        drafts=preferLocal?local?.drafts:envelope.apollo11Drafts;
      } catch { saved=local?.state; drafts=local?.drafts; this.saveStatus='Sin conexión · guardado en este dispositivo'; }
    }
    if(this.disposed) return;
    this.state=new ApolloState(saved);
    this.fieldDrafts=restoreFieldDrafts(drafts,this.state.checkpoint);
    try {
      this.world=new ApolloWorld(this.root,{onInteract:()=>this.interact(),onMap:()=>{}});
      await this.world.ready;
    } catch (error) {
      const failure=sceneStartFailure(error);
      console.error('[ApolloScreen] mission 01 scene start failed', { kind: failure.kind, error });
      loading.classList.add('ap-loading--error');
      loading.replaceChildren();
      const panel=document.createElement('div'); panel.className='ap-start-error';
      panel.setAttribute('role','alert');
      panel.append(el('span','ap-kicker',failure.kind==='webgl'?'DIAGNÓSTICO DE GRÁFICOS':'DIAGNÓSTICO DE MISIÓN'),el('h1','',failure.title),el('p','',failure.message));
      const steps=el('ul','ap-start-error-steps');
      failure.steps.forEach(step=>steps.append(el('li','',step)));
      panel.append(steps);
      const actions=el('div','ap-start-error-actions');
      actions.append(
        this.button('Reintentar misión',()=>void this.app.showMission1(this.initialState),'ap-button ap-primary'),
        this.button('Volver a misiones',()=>void this.app.showMissionSelect()),
      );
      panel.append(actions);
      loading.append(panel);
      return;
    }
    if (this.disposed) { this.world.dispose(); return; }
    this.world.renderer.domElement.tabIndex=0;
    this.world.setQuality(this.quality);
    // A resume starts at the last validated checkpoint, never inside a restricted area.
    const destination=this.state.current.target; this.world.player.set(destination.x,0,destination.z+9);
    this.root.classList.add('ap-ready'); loading.remove(); this.buildHud();
    this.dialogue=new ApolloDialogue(this.state,this.subtitle,this.audio,this.voice);
    document.addEventListener('keydown',this.onKey); document.addEventListener('visibilitychange',this.onVisibility);
    window.addEventListener('resize',this.onResize); window.addEventListener('pagehide',this.onPageHide);
    this.world.setSuspended(true);
    this.lastTime=performance.now(); this.raf=requestAnimationFrame(this.frame);
    this.showWelcome();
  }
  private button(text:string, callback:()=>void, cls='ap-button') {
    const b=el('button',cls,text); b.type='button'; b.addEventListener('click',callback); return b;
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
    if(this.state.completed.length) box.append(el('p','ap-resume',`Registro recuperado · ${this.state.completed.length} de 8 checkpoints completados.`));
    const start=this.button(this.state.done?'Ver epílogo':this.state.completed.length?'Continuar misión':'Comenzar operaciones',()=>{
      this.started=true; this.closeModal(); void this.audio.start().catch(()=>this.notify('Audio no disponible; los subtítulos permanecen activos.'));
      if(this.state.done) this.showEnd();
      else if(this.state.completed.length || this.state.checks.length) {this.enterCheckpoint();if(this.resumeInstrument){this.resumeInstrument=false;this.openFieldInstrument();}}
      else this.beginMovie('intro');
    },'ap-button ap-primary'); box.append(start);
    box.append(this.button('Inspeccionar Saturn V · Sketchfab',()=>this.openSketchfab()));
    box.append(this.button('Volver al selector',()=>void this.app.showMissionSelect()));
  }
  private renderObjective() {
    if(!this.hud) return;
    const cp=this.state.current; this.hud.replaceChildren();
    this.hud.append(el('small','','MISIÓN 01 — APOLLO 11'),el('span','ap-progress',`${String(this.state.completed.length).padStart(2,'0')} / 08`),el('h2','',cp.title),el('p','',cp.objective));
    const checklist=el('div','ap-checklist');
    for(const action of cp.actions) checklist.append(el('span',this.state.checks.includes(action.id)?'ap-checked':'',`${this.state.checks.includes(action.id)?'✓':'·'} ${action.label}`));
    this.hud.append(checklist,el('small','ap-save',this.saveStatus || 'Guardado automático al completar cada etapa'));
    this.world?.setTarget(this.state.done?null:cp.target);
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
    if(!this.state.act(id)) return false;
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
    if(!this.started || this.paused || this.modal || this.movie || this.state.done) return;
    if(this.distance()>15) {this.notify('Sigue el marcador hasta la estación autorizada.');return;}
    const index=this.state.checkpoint;
    if(index===4) {this.beginMovie('crew');return;}
    if(index===6) {this.beginMovie('launch');return;}
    if(index===7) {this.showEnd();return;}
    this.showStation();
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
        try { await progressApi.complete(SLUG,{ticksSurvived:Math.floor(this.state.elapsed),decisionsMade:19,samplesCollected:0,finalResources:{fuel:100,pressure:100,stability:100,telemetry:100},outcome:'success',summary:'Apollo 11: ocho checkpoints de apoyo terrestre completados; traslado y lanzamiento observados desde el área segura.'}); } catch { this.notify('Misión guardada localmente; la sincronización del informe queda pendiente.'); }
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
    box.focus(); return box;
  }
  private closeModal() {
    this.disposeInstrument();
    this.modal?.remove();this.modal=null;this.modalKind=null;this.paused=false;this.voice.pause(false);
    this.world?.setSuspended(!this.started || !!this.movie);this.audio.pause(!this.started);
    if(this.started) this.world?.renderer.domElement.focus({preventScroll:true});
  }
  private openPause() {
    if(!this.world || !this.started || this.modal)return;
    this.modalKind='pause';
    const box=this.openModal('OPERACIONES EN PAUSA','Un momento antes de la historia');
    const grid=el('div','ap-pause-grid');
    const mute=this.pauseControl(this.audio.muted?'🔇':'🔊',this.audio.muted?'Activar audio':'Silenciar audio',()=>{this.audio.toggle();this.voice.setVolume(this.audio.muted?0:.82);this.openPause();});
    const restart=this.pauseControl('↻','Reiniciar misión',()=>this.confirmReset());
    const missions=this.pauseControl('⌂','Volver a misiones',()=>{void this.save().then(()=>this.app.showMissionSelect());});
    const language=this.pauseControl('文','Idioma',()=>this.togglePauseLanguage(language));
    grid.append(mute,restart,missions,language); box.append(grid);
    const mapCanvas=el('canvas','ap-pause-map'); mapCanvas.width=720; mapCanvas.height=300; this.drawMap(mapCanvas); box.append(el('h2','ap-pause-map-title','Mapa de operaciones'),mapCanvas);
  }
  private pauseControl(icon:string,label:string,callback:()=>void):HTMLElement { const b=this.button('',callback,'ap-pause-control'); b.append(el('span','ap-pause-icon',icon),el('strong','',label)); return b; }
  private togglePauseLanguage(host:HTMLElement) {
    const existing=this.modal?.querySelector('.ap-language-options');
    if(existing){existing.remove();return;}
    const options=el('div','ap-language-options');
    (['es','en','fr'] as const).forEach(language=>{const button=this.button(language.toUpperCase(),()=>setLanguage(language),'ap-language-option');button.setAttribute('aria-pressed',String(apolloLanguage()===language));options.append(button);});
    host.append(options);
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
    c.font=`${Math.max(10,w/40)}px sans-serif`;c.fillStyle='#afc1c2';c.fillText(apolloText('N ↑'),10,20);c.fillText('39A',rx+10,rz+4);
    c.fillStyle='#a7b9b5';c.fillText(apolloText('↖ VAB · 1 km'),8,Math.max(36,h*.18));
    CHECKPOINTS.slice(0,6).forEach((cp,i)=>{const [x,z]=p(cp.target.x,cp.target.z);c.fillStyle=this.state.completed.includes(cp.id)?'#8eba9d':i===this.state.checkpoint?'#f4be67':'#597275';c.beginPath();c.arc(x,z,i===this.state.checkpoint?6:3,0,Math.PI*2);c.fill();if(w>300)c.fillText(`${i+1}. ${apolloText(cp.title)}`,x+10,z+5);});
    const target=this.state.current.target;
    const remote=this.world.player.z>5000;
    const [tx,tz]=p(target.x,remote?355:target.z),[px,pz]=p(this.world.player.x,remote?355:this.world.player.z);
    if(remote){c.fillStyle='#e0c497';c.fillText(apolloText('OBSERVACIÓN · 5,6 km'),10,h-12);}
    c.strokeStyle='#edbd6a';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.moveTo(px,pz);c.lineTo(tx,tz);c.stroke();c.setLineDash([]);
    c.save();c.translate(px,pz);c.rotate(-this.world.yaw);c.fillStyle='#fff1d5';c.beginPath();c.moveTo(0,-7);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fill();c.restore();
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
    this.world.refreshLanguage();
    this.dialogue?.refreshLanguage();
    if (this.movie) { this.renderMovie(); return; }
    this.renderObjective(); this.updateNavigation();
    const kind=this.modalKind;
    if (!kind) return;
    this.captureInstrumentDraft();
    if (this.instrument) { this.disposeInstrument(); this.modal?.remove(); this.modal=null; this.modalKind=null; this.openFieldInstrument(); return; }
    this.modal?.remove(); this.modal=null; this.modalKind=null;
    if (kind==='welcome') this.showWelcome();
    else if (kind==='pause') this.openPause();
    else if (kind==='map') this.openMap();
    else if (kind==='end') this.showEnd();
    else if (kind==='credits') this.openCredits();
    else if (kind==='sketchfab') this.openSketchfab();
    else if (kind==='reset') this.confirmReset();
  }
  private async save() {
    if(this.disposed || !this.started)return;
    this.captureInstrumentDraft();
    const snapshot=this.state.toJSON(),savedAt=Date.now();
    const drafts=JSON.parse(JSON.stringify(this.fieldDrafts)) as FieldDrafts;
    try {localStorage.setItem(this.localKey,JSON.stringify({state:snapshot,savedAt,drafts}));this.saveStatus='Guardado local · sincronizando…';} catch {this.saveStatus='Almacenamiento local no disponible · sincronizando…';}
    const wire={tick:Math.floor(this.state.elapsed),resources:{fuel:100,pressure:100,stability:100,telemetry:100},resolvedDecisionIds:[],log:[],apollo11:snapshot,apollo11SavedAt:savedAt,apollo11Drafts:drafts} as unknown as MissionSaveState;
    this.saveQueue=this.saveQueue.catch(()=>{}).then(async()=>{
      try {await progressApi.autosave(SLUG,wire,snapshot.completed.length/8*100);this.saveStatus='Registro guardado y sincronizado';}
      catch {this.saveStatus='Guardado local · sin conexión al servidor';}
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
    const near=this.distance()<=15;
    this.prompt.hidden=!this.started || this.paused || !!this.movie || this.state.done;
    this.prompt.textContent=near?'E · '+(this.state.checkpoint===4?'Observar a la tripulación':this.state.checkpoint===6?'Presenciar el lanzamiento':'Examinar estación'):`${Math.round(this.distance())} m · ${this.state.current.title}`;
    this.prompt.textContent=apolloText(this.prompt.textContent);
    this.prompt.disabled=!near;
    if(this.uiTarget) {this.uiTarget.hidden=!!this.movie || this.paused;this.uiTarget.textContent=`◇ ${Math.round(this.distance())} m`;}
  }
  diagnostics() {
    const times=this.frameTimes,average=times.reduce((a,b)=>a+b,0)/Math.max(1,times.length);
    return {...this.world.diagnostics(),checkpoint:this.state.checkpoint,checks:this.state.checks,completed:this.state.completed,movie:this.movie,movieTime:this.movieTime,quality:this.quality,frameMs:average,fps:average?1000/average:0,samples:times.length};
  }
  unmount() {
    document.body.classList.remove('apollo-active');
    document.body.classList.remove('apollo-cinematic');
    this.disposeInstrument();this.voice.dispose();clearTimeout(this.draftTimer);
    this.disposed=true;cancelAnimationFrame(this.raf);clearTimeout(this.flashTimer);
    document.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onVisibility);
    window.removeEventListener('resize',this.onResize);window.removeEventListener('pagehide',this.onPageHide);
    this.audio.dispose();this.world?.dispose();this.modal?.remove();this.root?.remove();
  }
}
