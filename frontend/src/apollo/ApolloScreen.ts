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

const SLUG = MISSION_SLUGS.mission1;
const el = <K extends keyof HTMLElementTagNameMap>(tag:K, cls='', text='') => {
  const node=document.createElement(tag); node.className=cls; node.textContent=text; return node;
};
const INTRO = [
  '16 de julio de 1969. Durante años, miles de personas han trabajado para conseguir lo que alguna vez parecía imposible: enviar seres humanos a la Luna.',
  'Hoy, tres astronautas se preparan para abandonar la Tierra a bordo de la nave Apollo 11.',
  'Neil Armstrong, Buzz Aldrin y Michael Collins están a punto de comenzar un viaje que cambiará nuestra historia.',
];
type Quality = 'low'|'medium'|'high';
type Saved = { state:ReturnType<ApolloState['toJSON']>; savedAt:number };
const ICON=(paths:string)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
const PAUSE_ICONS={
  volume:ICON('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  muted:ICON('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  restart:ICON('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
  back:ICON('<path d="M15 5l-7 7 7 7"/><path d="M8 12h12"/>'),
};

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
  private zoom=false;
  private stepDistance=0;
  private audio=new ApolloAudio();
  private dialogue!: ApolloDialogue;
  private saveQueue:Promise<void>=Promise.resolve();
  private saveStatus='';
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
  async mount(container:HTMLElement) {
    this.root=el('div','apollo-screen');
    const loading=el('div','ap-loading','PREPARANDO OPERACIONES · APOLLO 11'); this.root.append(loading); container.append(this.root);
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
      } catch { saved=local?.state; this.saveStatus='Sin conexión · guardado en este dispositivo'; }
    }
    if(this.disposed) return;
    this.state=new ApolloState(saved);
    try {
      this.world=new ApolloWorld(this.root,{onInteract:()=>this.interact(),onMap:()=>{}});
      await this.world.ready;
    } catch (error) {
      loading.textContent='No se pudo iniciar la escena 3D. Comprueba que WebGL está disponible.';
      const back=this.button('Volver a misiones',()=>void this.app.showMissionSelect()); loading.append(back);
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
  private button(text:string, callback:()=>void, cls='ap-button') {
    const b=el('button',cls,text); b.type='button'; b.addEventListener('click',callback); return b;
  }
  private iconButton(icon:string, label:string, callback:()=>void) {
    const b=this.button('',callback,'ap-button ap-icon-button'); b.setAttribute('aria-label',label); b.title=label;
    const i=el('span','ap-icon'); i.setAttribute('aria-hidden','true'); i.innerHTML=icon;
    b.append(i,el('small','',label)); return b;
  }
  private buildHud() {
    const top=el('div','ap-topbar');
    const mark=el('div','ap-mark'); mark.innerHTML='<b>APOLLO <span>11</span></b><small>KENNEDY SPACE CENTER · 16 JUL 1969</small>';
    const actions=el('div','ap-controls');
    actions.append(this.button('Mapa · M',()=>this.openMap()),this.button('Radio · R',()=>this.dialogue.repeat()),this.button('Zoom',()=>{this.zoom=!this.zoom;this.world.setZoom(this.zoom);}),this.button('Pausa',()=>this.openPause()));
    top.append(mark,actions); this.root.append(top);
    this.hud=el('section','ap-objective'); this.hud.setAttribute('aria-label','Objetivo actual'); this.root.append(this.hud);
    this.subtitle=el('div','ap-radio'); this.subtitle.setAttribute('aria-live','polite'); this.root.append(this.subtitle);
    this.prompt=this.button('',()=>this.interact(),'ap-interact'); this.root.append(this.prompt);
    const mapButton=this.button('',()=>this.openMap(),'ap-minimap'); mapButton.setAttribute('aria-label','Abrir mapa de Kennedy');
    this.map=el('canvas'); this.map.width=240; this.map.height=200;
    mapButton.append(this.map,el('span','','LC-39A · MAPA / M')); this.root.append(mapButton);
    const help=el('div','ap-help','WASD / Flechas · Moverse     Shift · Caminar rápido     Arrastrar · Mirar     E · Interactuar'); this.root.append(help);
    this.uiTarget=el('div','ap-waypoint'); this.root.append(this.uiTarget);
    this.renderObjective();
  }
  private showWelcome() {
    const box=this.openModal('APOLLO 11','El comienzo de una nueva era');
    box.append(el('p','','16 de julio de 1969 · Centro Espacial Kennedy, Florida. Eres un técnico ficticio de apoyo a operaciones terrestres. Observa, documenta y comunica: tu trabajo termina en un punto seguro, antes del despegue de las 9:32 a. m. EDT.'));
    box.append(el('p','ap-note','Recreación educativa. Daniel Carter y los diálogos son ficticios. Las rutas se han acortado; no hay interiores accesibles. Los trajes Mercenary son una adaptación artística, no réplicas del A7L.'));
    if(this.state.completed.length) box.append(el('p','ap-resume',`Registro recuperado · ${this.state.completed.length} de 8 checkpoints completados.`));
    const start=this.button(this.state.done?'Ver epílogo':this.state.completed.length?'Continuar misión':'Comenzar operaciones',()=>{
      this.started=true; this.closeModal(); void this.audio.start().catch(()=>this.notify('Audio no disponible; los subtítulos permanecen activos.'));
      if(this.state.done) this.showEnd();
      else if(this.state.completed.length || this.state.checks.length) this.enterCheckpoint();
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
    const cp=this.state.current, box=this.openModal(`CHECKPOINT ${this.state.checkpoint+1} / 8`,cp.title);
    box.append(el('p','',cp.objective));
    if(this.state.checkpoint===0) box.append(el('p','ap-note','WASD o flechas para moverte; arrastra la vista con el ratón. Pulsa M para consultar el mapa. Este registro valida la orientación; no controla el lanzamiento.'));
    for(const action of cp.actions) {
      const complete=this.state.checks.includes(action.id);
      const b=this.button(`${complete?'✓ ':''}${action.label}`,()=>this.performAction(action.id)); b.disabled=complete; box.append(b);
    }
    box.append(this.button('Regresar al recorrido',()=>this.closeModal()));
  }
  private performAction(id:string) {
    if(this.distance()>15 || !this.state.current.actions.some(a=>a.id===id)) return;
    if(id==='map') {this.openMap();return;}
    const questions:Record<string,{title:string;copy:string;options:string[];answer:number}>={
      landmark:{title:'Un vehículo para alcanzar la Luna',copy:'Observa la silueta blanca y negra sobre la plataforma. Mide aproximadamente 110,6 metros. ¿Qué vehículo llevará al Apollo 11?',options:['Saturn V · AS-506','Space Shuttle','Saturn IB'],answer:0},
      tower:{title:'Torre umbilical',copy:'La estructura metálica roja junto al Saturn V proporciona conexiones y acceso. Su brazo de acceso de tripulación se retiró aproximadamente cinco minutos antes del lanzamiento.',options:['Torre de servicio umbilical','Torre de control aéreo','Vehículo de ensamblaje'],answer:0},
      pad:{title:'Complejo de lanzamiento',copy:'El Apollo 11 partió el 16 de julio de 1969 desde el complejo 39 del Centro Espacial Kennedy. Identifica la plataforma.',options:['39B','39A','Plataforma 34'],answer:1},
      vab:{title:'El edificio del horizonte',copy:'Allí se ensambló verticalmente el Saturn V. Solo observamos su exterior; su fachada de 1969 aún no tenía la gran bandera estadounidense añadida en 1976.',options:['Vehicle Assembly Building (VAB)','Centro de Houston','Un hangar de transbordadores'],answer:0},
      log:{title:'Registro de comunicaciones · consulta',copy:'INFORME RECIBIDO\nVehículo: Saturn V AS-506\nMisión: Apollo 11\nPlataforma: LC-39A\nLanzamiento programado: 09:32 EDT · 16 JUL 1969\nTripulación: Armstrong / Collins / Aldrin\n\nRegistro educativo ficticio basado en datos históricos. Confirma el vehículo.',options:['AS-505','AS-506','AS-507'],answer:1},
      report:{title:'Informe de estado recibido',copy:'Comprueba que el destino y la hora coinciden con el registro. Esta tarea simula documentación de apoyo, sin acceso a controles de lanzamiento reales.',options:['LC-39A · 09:32 EDT','LC-39B · 12:00 EDT','Houston · 06:27 EDT'],answer:0},
      identify:{title:'Identificación del vehículo',copy:'La primera etapa S-IC impulsaba el Saturn V al abandonar la plataforma. ¿Cuántos motores F-1 tenía?',options:['Tres','Cuatro','Cinco'],answer:2},
      antenna:{title:'Antenas de apoyo terrestre',copy:'Las antenas permiten transmitir y recibir señales de radio. La antena representada es una simplificación visual; no una réplica de la red MSFN.',options:['Comunicación por radio','Suministro de combustible','Control directo de los motores'],answer:0},
      signal:{title:'Escucha y verifica · señal simulada',copy:'Canal recibido: APOYO TERRESTRE → LC-39A → RECIBIDO\n\nSelecciona el registro que reproduce la secuencia completa. Si omites un elemento, Carter solicitará repetirlo.',options:['LC-39A → APOYO TERRESTRE','APOYO TERRESTRE → LC-39A → RECIBIDO','APOYO TERRESTRE → SIN SEÑAL'],answer:1},
      ready:{title:'Respuesta de la estación',copy:'Daniel Carter: «Registro recibido. Nuestra estación de apoyo está lista. Gracias por comprobar cada mensaje.»\n\nSelecciona la confirmación del registro de apoyo.',options:['Estación de apoyo lista','Autorizar motores por cuenta propia','Cambiar el plan de vuelo'],answer:0},
      camera:{title:'Preparar la cámara de seguimiento',copy:'Alinea la cámara con el Saturn V desde el área autorizada. En este escenario las distancias están comprimidas: el punto representa un observador a 5,6 km de la plataforma. La autorización incluye un traslado hasta ese punto remoto.',options:['Encuadrar la plataforma desde el área segura','Acercarme a la base del Saturn V'],answer:0},
      audio:{title:'Canal de observación',copy:'Recibirás una recreación de comunicaciones con subtítulos. El sonido de los motores llegará con unos 16,3 segundos de retardo, equivalente a 5,6 km a 343 m/s.',options:['Confirmar recepción del canal de apoyo','Transmitir a los astronautas'],answer:0},
      authorize:{title:'Todo preparado',copy:'Carter: «Nuestro trabajo aquí ha terminado. Quiero que recuerdes lo que vas a ver. No todos los días comienza un viaje a otro mundo.»\n\nLa secuencia solo se habilita después de preparar cámara y audio.',options:['Solicitar autorización de observación','Iniciar lanzamiento sin comprobaciones'],answer:0},
    };
    if(id==='authorize' && (!this.state.checks.includes('camera') || !this.state.checks.includes('audio'))) {this.notify('Prepara primero la cámara y confirma el audio.');return;}
    if(id==='report' && !this.state.checks.includes('log')) {this.notify('Consulta primero el registro recibido.');return;}
    if(id==='ready' && (!this.state.checks.includes('antenna') || !this.state.checks.includes('signal'))) {this.notify('Revisa primero la antena y la señal.');return;}
    if(id==='arrive') {this.act(id); if(this.modal) this.showStation(); return;}
    if(id==='technician') {
      const box=this.openModal('CONVERSACIÓN PRESENCIAL · PERSONAJE FICTICIO','Técnico de plataforma');
      box.append(el('p','','«La mayor parte del trabajo ya está hecha. El Saturn V se encuentra preparado en su plataforma. El crawler-transporter lo trasladó aquí semanas antes; hoy ya no está debajo del cohete.»'));
      this.dialogue.say('Técnico de plataforma','La mayor parte del trabajo ya está hecha. El Saturn V se encuentra preparado en su plataforma.',9,'in-person');
      box.append(this.button('Registrar conversación',()=>{this.act(id);if(this.modal)this.showStation();},'ap-button ap-primary')); return;
    }
    const q=questions[id]; if(!q) return;
    const box=this.openModal('CUADERNO DE OPERACIONES · ACTIVIDAD SIMULADA',q.title);
    box.append(el('p','ap-document',q.copy));
    const feedback=el('p','ap-feedback'); feedback.setAttribute('aria-live','polite');
    q.options.forEach((option,i)=>box.append(this.button(option,()=>{
      if(i!==q.answer) {feedback.textContent='Revisa los datos del registro y vuelve a intentarlo. No se ha avanzado el checkpoint.';return;}
      this.act(id); if(this.modal) this.showStation();
    })));
    box.append(feedback,this.button('Volver al registro',()=>this.showStation()));
  }
  private beginMovie(mode:'intro'|'crew'|'launch') {
    if(mode==='crew' && (this.state.checkpoint!==4 || this.distance()>15)) return;
    if(mode==='launch' && (this.state.checkpoint!==6 || this.distance()>15)) return;
    this.closeModal(); this.dialogue.clear(); this.movie=mode; this.movieTime=0; this.world.setSuspended(true);
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
    if(caption.dataset.signature!==signature) {caption.dataset.signature=signature; caption.replaceChildren(el('small','',label),el('h1','',title),el('p','',text));}
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
    this.modal?.remove(); this.previousFocus=document.activeElement as HTMLElement|null;
    const overlay=el('div','ap-modal'); const box=el('section','ap-dialog');
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label',title); box.tabIndex=-1;
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
    this.modal?.remove();this.modal=null;this.paused=false;
    this.world?.setSuspended(!this.started || !!this.movie);this.audio.pause(!this.started);
    if(this.started) this.world?.renderer.domElement.focus({preventScroll:true});
  }
  private openPause() {
    if(!this.world || !this.started || this.modal)return;
    const box=this.openModal('OPERACIONES EN PAUSA','Un momento antes de la historia');
    box.append(this.button('Continuar',()=>this.closeModal(),'ap-button ap-primary'));
    const tools=el('div','ap-pause-tools');
    const mute=this.iconButton(this.audio.muted?PAUSE_ICONS.muted:PAUSE_ICONS.volume,this.audio.muted?'Activar audio':'Silenciar audio',()=>{this.audio.toggle();paintMute();});
    const paintMute=()=>{const label=this.audio.muted?'Activar audio':'Silenciar audio';mute.setAttribute('aria-label',label);mute.title=label;mute.querySelector('.ap-icon')!.innerHTML=this.audio.muted?PAUSE_ICONS.muted:PAUSE_ICONS.volume;mute.querySelector('small')!.textContent=label;};
    tools.append(mute,this.iconButton(PAUSE_ICONS.restart,'Reiniciar misión',()=>this.confirmReset()),this.iconButton(PAUSE_ICONS.back,'Volver a misiones',()=>{void this.save().then(()=>this.app.showMissionSelect());}));
    box.append(tools);
    box.append(this.button('Inspección 3D · modelo Sketchfab',()=>this.openSketchfab()),this.button('Fuentes y créditos',()=>this.openCredits()));
  }
  private confirmReset() {
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
    if(this.state.checkpoint===0)this.act('map');
    const box=this.openModal('MAPA DE OPERACIONES · GEOGRAFÍA COMPRIMIDA','Centro Espacial Kennedy');
    const canvas=el('canvas','ap-large-map');canvas.width=720;canvas.height=540;this.drawMap(canvas);
    box.append(canvas,el('p','ap-note','N ↑ · Verde: completado · Ámbar: destino activo · Rojo: perímetro restringido. Las coordenadas del mapa corresponden al escenario. Las conexiones son una adaptación jugable de las distancias reales.'));
    const cp=this.state.current;box.append(el('p','',`${cp.title} · ${Math.round(this.distance())} m de recorrido simulado`));
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
    c.font=`${Math.max(10,w/40)}px sans-serif`;c.fillStyle='#afc1c2';c.fillText('N ↑',10,20);c.fillText('39A',rx+10,rz+4);
    c.fillStyle='#a7b9b5';c.fillText('↖ VAB · 1 km',8,Math.max(36,h*.18));
    CHECKPOINTS.slice(0,6).forEach((cp,i)=>{const [x,z]=p(cp.target.x,cp.target.z);c.fillStyle=this.state.completed.includes(cp.id)?'#8eba9d':i===this.state.checkpoint?'#f4be67':'#597275';c.beginPath();c.arc(x,z,i===this.state.checkpoint?6:3,0,Math.PI*2);c.fill();if(w>300)c.fillText(`${i+1}. ${cp.title}`,x+10,z+5);});
    const target=this.state.current.target;
    const remote=this.world.player.z>5000;
    const [tx,tz]=p(target.x,remote?355:target.z),[px,pz]=p(this.world.player.x,remote?355:this.world.player.z);
    if(remote){c.fillStyle='#e0c497';c.fillText('OBSERVACIÓN · 5,6 km',10,h-12);}
    c.strokeStyle='#edbd6a';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.moveTo(px,pz);c.lineTo(tx,tz);c.stroke();c.setLineDash([]);
    c.save();c.translate(px,pz);c.rotate(-this.world.yaw);c.fillStyle='#fff1d5';c.beginPath();c.moveTo(0,-7);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fill();c.restore();
  }
  private openSketchfab() {
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
  private async save() {
    if(this.disposed || !this.started)return;
    const snapshot=this.state.toJSON(),savedAt=Date.now();
    try {localStorage.setItem(this.localKey,JSON.stringify({state:snapshot,savedAt}));this.saveStatus='Guardado local · sincronizando…';} catch {this.saveStatus='Almacenamiento local no disponible · sincronizando…';}
    const wire={tick:Math.floor(this.state.elapsed),resources:{fuel:100,pressure:100,stability:100,telemetry:100},resolvedDecisionIds:[],log:[],apollo11:snapshot,apollo11SavedAt:savedAt} as unknown as MissionSaveState;
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
    this.prompt.textContent=near?'E · '+(this.state.checkpoint===4?'Observar a la tripulación':this.state.checkpoint===6?'Presenciar el lanzamiento':'Examinar estación'):`${Math.round(this.distance())} m · ${this.state.current.title}`;
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
    this.audio.dispose();this.world?.dispose();this.modal?.remove();this.root?.remove();
  }
}
