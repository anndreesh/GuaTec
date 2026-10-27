import {apolloText} from './ApolloLocale';
import {CREW_CARDS,restoreStandDraft,validateImprintStroke,type StandDraft} from './ApolloStandRules';

interface ImprinterOptions{
  draft?:unknown;
  signal:AbortSignal;
  onDraft(draft:StandDraft):void;
  onRead(count:number):void;
  onReject(message:string):void;
  onComplete():void;
}
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{
  const element=document.createElement(tag);element.className=cls;element.textContent=apolloText(text);return element;
};

/** One physical stroke per credential, with pointer capture and an equivalent Space hold.
 * Only completed impressions persist; timers and partial strokes cannot award progress. */
export function mountCredentialImprinter(host:HTMLElement,options:ImprinterOptions):{snapshot():StandDraft}{
  const draft=restoreStandDraft('crew-manifest',options.draft),recorded=draft.scanned?[...draft.scanned]:[false,false,false];
  let selected=Math.max(0,recorded.findIndex(value=>!value)),disposed=false,complete=false,raf=0,progress=0;
  let stroke:{pointer:number|null;started:number;startX:number;travel:number;span:number}|null=null;
  const root=node('section','ap-crew-imprinter'),deck=node('div','ap-credential-deck');
  const housing=node('div','ap-imprinter-housing'),track=node('div','ap-imprinter-track');
  housing.append(node('span','ap-imprinter-name','IMPRESOR MECÁNICO / REGISTRO DE APOYO'));
  const paper=node('article','ap-credential-paper'),initials=node('strong','ap-credential-initials'),name=node('strong','ap-credential-name'),role=node('span','ap-credential-role');
  paper.append(node('small','','APOLLO 11 · AS-506'),initials,name,role);
  const ink=node('div','ap-imprint-ink');ink.setAttribute('aria-hidden','true');
  const roller=node('button','ap-imprinter-roller','→');roller.type='button';roller.setAttribute('aria-label',apolloText('Deslizar rodillo sobre la credencial'));
  track.append(paper,ink,roller);housing.append(track,node('small','ap-imprinter-hint','Arrastra el rodillo de izquierda a derecha con un movimiento continuo. O mantén Espacio un segundo y suelta.'));
  const buttons=CREW_CARDS.map((card,i)=>{
    const button=node('button','ap-credential-choice');button.type='button';button.dataset.credential=String(i);
    button.append(node('strong','',card.initials),node('span','',card.name),node('small','',card.role));
    button.addEventListener('click',()=>{if(stroke||complete||recorded[i])return;selected=i;paint();roller.focus({preventScroll:true});},{signal:options.signal});deck.append(button);return button;
  });
  root.append(deck,housing);host.append(root);
  const snapshot=():StandDraft=>({version:1,kind:'crew-manifest',scanned:[...recorded]});
  function paint(){
    const card=CREW_CARDS[selected]!;initials.textContent=card.initials;name.textContent=card.name;role.textContent=apolloText(card.role);
    buttons.forEach((button,i)=>{button.disabled=recorded[i]||complete;button.setAttribute('aria-pressed',String(i===selected));button.dataset.recorded=String(recorded[i]);});
    roller.disabled=complete;roller.style.setProperty('--imprint-travel',`${progress*Math.max(0,track.clientWidth-98)}px`);ink.style.width=`${progress*100}%`;
  }
  function release(){
    const pointer=stroke?.pointer;stroke=null;cancelAnimationFrame(raf);raf=0;
    if(pointer!==undefined&&pointer!==null&&roller.hasPointerCapture(pointer))roller.releasePointerCapture(pointer);
  }
  function cancel(report=false){if(!stroke)return;release();progress=0;paint();if(report)options.onReject('Impresión interrumpida · vuelve al inicio del carril.');}
  function begin(pointer:number|null,startX=0){
    if(disposed||complete||stroke)return;
    progress=0;stroke={pointer,started:performance.now(),startX,travel:0,span:Math.max(1,track.clientWidth-98)};paint();
    if(pointer!==null)roller.setPointerCapture(pointer);
  }
  function finish(){
    if(!stroke||disposed||complete)return;
    const seconds=(performance.now()-stroke.started)/1000,travel=stroke.pointer===null?Math.min(1,seconds/.9):stroke.travel;
    release();const result=validateImprintStroke(travel,seconds);progress=0;
    if(result!=='accepted'){
      paint();options.onReject(result==='fast'?'Rodillo demasiado rápido · desliza con calma.':result==='slow'?'Rodillo demasiado lento · mantén un movimiento continuo.':'Recorrido incompleto · lleva el rodillo hasta el otro extremo.');return;
    }
    recorded[selected]=true;const count=recorded.filter(Boolean).length;
    options.onDraft(snapshot());options.onRead(count);
    complete=recorded.every(Boolean);if(!complete)selected=recorded.findIndex(value=>!value);
    paint();if(complete)options.onComplete();
  }
  const listen=<E extends Event>(event:string,handler:(event:E)=>void)=>roller.addEventListener(event,handler as EventListener,{signal:options.signal});
  listen<PointerEvent>('pointerdown',event=>{if(event.button!==0||!event.isPrimary)return;roller.focus({preventScroll:true});begin(event.pointerId,event.clientX);});
  listen<PointerEvent>('pointermove',event=>{if(!stroke||stroke.pointer!==event.pointerId)return;progress=stroke.travel=Math.max(0,Math.min(1,(event.clientX-stroke.startX)/stroke.span));paint();});
  listen<PointerEvent>('pointerup',event=>{if(stroke?.pointer===event.pointerId)finish();});
  listen('pointercancel',()=>cancel(true));listen('lostpointercapture',()=>cancel(true));listen('blur',()=>cancel());
  listen<KeyboardEvent>('keydown',event=>{
    if(event.code!=='Space')return;event.preventDefault();if(event.repeat||stroke||complete)return;begin(null);
    const frame=()=>{if(disposed||stroke?.pointer!==null)return;progress=Math.min(1,(performance.now()-stroke.started)/900);paint();raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);
  });
  listen<KeyboardEvent>('keyup',event=>{if(event.code==='Space'){event.preventDefault();if(stroke?.pointer===null)finish();}});
  window.addEventListener('blur',()=>cancel(),{signal:options.signal});
  window.addEventListener('resize',()=>cancel(),{signal:options.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},{signal:options.signal});
  options.signal.addEventListener('abort',()=>{disposed=true;release();root.remove();},{once:true});
  paint();options.onRead(recorded.filter(Boolean).length);
  return{snapshot};
}
