import type { ApolloBonusCheckpoint } from './ApolloState';
import { apolloText } from './ApolloLocale';
import { getLanguage } from '@/core/language';
import { FUSE_RATINGS, FUSE_SOCKETS, TELEMETRY_REFERENCE, CABLE_CHANNELS, CABLE_TARGET_ORDER, FLIGHT_CARDS, slotsCorrect, moveIntoSlot, readingsAligned, weatherAligned, advanceScan, restoreStandDraft, type StandDraft } from './ApolloStandRules';
import './ApolloStands.css';
import {mountCredentialImprinter} from './ApolloCredentialImprinter';
import {STAND_HANDOFFS} from './ApolloStandHandoffs';

export interface BonusMissionHandle { dispose(): void; snapshot(): StandDraft }
interface BonusMissionOptions { onComplete(): void; onCancel(): void; onFeedback?: (kind: 'success' | 'error') => void; draft?: unknown; onDraft?: (draft:StandDraft)=>void }
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const element = document.createElement(tag); element.className = cls; element.textContent = apolloText(text); return element;
};
const descriptions: Record<ApolloBonusCheckpoint['kind'], { code: string; title: string; verb: string; note: string }> = {
  sequence: { code: 'PWR / 01', title: 'Distribución eléctrica', verb: 'Encaja cada fusible y eleva la palanca para energizar el banco.', note: 'El amperaje del fusible debe coincidir con la placa del alojamiento.' },
  'flight-plan': { code: 'OPS / 02', title: 'Mesa de secuencias', verb: 'Ordena los documentos en la línea de tiempo.', note: 'Preparación → tripulación a bordo → encendido → despegue.' },
  telemetry: { code: 'DATA / 03', title: 'Consola de telemetría', verb: 'Ajusta los tres sintonizadores hasta superponer las señales.', note: 'La traza punteada es la referencia; la traza continua es tu lectura.' },
  cables: { code: 'LINK / 04', title: 'Panel de conexiones', verb: 'Lleva cada cable al terminal con la misma letra.', note: 'Las letras identifican los canales además del color.' },
  'crew-manifest': { code: 'CREW / 05', title: 'Registro de tripulación', verb: 'Imprime las tres credenciales pasando el rodillo sobre cada ficha.', note: 'Impresor de práctica: las credenciales y el registro son una adaptación educativa.' },
  weather: { code: 'WX / 06', title: 'Parte de observación', verb: 'Alinea la veleta y ajusta la placa de nubosidad.', note: 'Referencia del ejercicio: rumbo 225° y placa al 35 %. No son mediciones históricas.' },
  beacons: { code: 'SAFE / 07', title: 'Barrido del perímetro', verb: 'Mueve el visor sobre cada baliza y mantén el encuadre.', note: 'Inspecciona B1, B2 y B3. También puedes mover el visor con las flechas.' },
};

// Phase copy is presentation-only; completion still uses the stand rules below.
const PHASE_COPY = {
  es: { label: 'Protocolo', sequence: ['Encajar', 'Comprobar', 'Energizar'], 'flight-plan': ['Ordenar', 'Revisar', 'Sellar'], telemetry: ['Sintonizar', 'Superponer', 'Fijar'], cables: ['Conectar', 'Comprobar', 'Registrar'], 'crew-manifest': ['Elegir', 'Imprimir', 'Registrar'], weather: ['Orientar', 'Comparar', 'Sellar'], beacons: ['Apuntar', 'Mantener', 'Registrar'] },
  en: { label: 'Protocol', sequence: ['Fit', 'Check', 'Power'], 'flight-plan': ['Order', 'Review', 'Stamp'], telemetry: ['Tune', 'Match', 'Lock'], cables: ['Connect', 'Check', 'Record'], 'crew-manifest': ['Choose', 'Print', 'Record'], weather: ['Point', 'Compare', 'Stamp'], beacons: ['Aim', 'Hold', 'Record'] },
  fr: { label: 'Protocole', sequence: ['Insérer', 'Vérifier', 'Alimenter'], 'flight-plan': ['Ordonner', 'Vérifier', 'Tamponner'], telemetry: ['Régler', 'Superposer', 'Verrouiller'], cables: ['Brancher', 'Vérifier', 'Consigner'], 'crew-manifest': ['Choisir', 'Imprimer', 'Consigner'], weather: ['Orienter', 'Comparer', 'Tamponner'], beacons: ['Viser', 'Maintenir', 'Consigner'] },
} as const;

export function mountBonusMission(host: HTMLElement, bonus: ApolloBonusCheckpoint, options: BonusMissionOptions): BonusMissionHandle {
  const abort = new AbortController(), timers = new Set<number>(), frames = new Set<number>();
  let disposed = false, complete = false;
  const draft=restoreStandDraft(bonus.kind,options.draft);
  let snapshot:()=>StandDraft=()=>({version:1,kind:bonus.kind});
  const draftChanged=()=>{if(!complete&&!disposed)options.onDraft?.(snapshot());};
  const listen = <E extends Event>(target: EventTarget, event: string, callback: (event: E) => void) => target.addEventListener(event, callback as EventListener, { signal: abort.signal });
  const later = (callback: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); if (!disposed) callback(); }, ms); timers.add(id); };
  const animate = (callback: (dt: number, time: number) => void) => {
    let previous = performance.now();
    const frame = (now: number) => { if (disposed) return; frames.clear(); callback(Math.min(.05, Math.max(0, (now - previous) / 1000)), now / 1000); previous = now; frames.add(requestAnimationFrame(frame)); };
    frames.add(requestAnimationFrame(frame));
  };
  const spec = descriptions[bonus.kind], stage = node('section', 'ap-stand ap-stand--' + bonus.kind), rail = node('aside', 'ap-stand-brief');
  host.classList.add('ap-stand-dialog'); host.parentElement?.classList.add('ap-stand-overlay');
  rail.append(node('span', 'ap-stand-code', spec.code), node('h2', '', spec.title), node('p', '', spec.verb), node('small', 'ap-stand-note', spec.note));
  const purpose=STAND_HANDOFFS[bonus.id];
  if(purpose){const context=node('details','ap-stand-purpose');context.append(node('summary','','Vínculo con la misión'),node('p','',purpose.purpose));rail.append(context);}
  const progress = node('div', 'ap-stand-progress'); progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', apolloText('Verificación del stand')); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
  const progressBar = node('span'); progress.append(progressBar);
  const counter = node('output', 'ap-stand-counter', 'EN ESPERA');
  rail.append(progress, counter, node('small', 'ap-stand-footnote', 'OPERACIONES DE APOYO · RECREACIÓN EDUCATIVA'));
  const workspace = node('div', 'ap-stand-workspace'), plate = node('header', 'ap-stand-plate');
  plate.append(node('span', '', 'APOLLO 11'), node('span', '', 'AS-506 / LC-39A'), node('span', 'ap-stand-led', '● EN SERVICIO')); workspace.append(plate);
  const phaseCopy = PHASE_COPY[getLanguage()], phases = node('ol', 'ap-stand-phases');
  phases.setAttribute('aria-label', phaseCopy.label);
  const phaseNodes = phaseCopy[bonus.kind].map(label => { const item = document.createElement('li'); item.className = 'ap-stand-phase'; const light = node('i'); light.setAttribute('aria-hidden', 'true'); const text = document.createElement('span'); text.textContent = label; item.append(light, text); phases.append(item); return item; });
  workspace.append(phases);
  let shownPhase = -1, shownComplete = false;
  const setPhase = (index: number) => {
    if (index === shownPhase && complete === shownComplete) return;
    shownPhase = index; shownComplete = complete; stage.dataset.phase = String(index);
    phaseNodes.forEach((item, i) => {
      item.dataset.state = complete || i < index ? 'done' : i === index ? 'active' : 'pending';
      if (!complete && i === index) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
  };
  setPhase(0);
  const feedback = node('p', 'ap-stand-feedback', 'Manipula las piezas para comenzar.'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  const footer = node('footer', 'ap-stand-footer'), back = node('button', 'ap-button', 'Volver al recorrido'); back.type = 'button'; listen(back, 'click', options.onCancel);
  footer.append(back, feedback); stage.append(rail, workspace, footer); host.append(stage);
  const update = (value: number, text: string) => { progressBar.style.width = Math.round(value * 100) + '%'; progress.setAttribute('aria-valuenow', String(Math.round(value * 100))); counter.textContent = apolloText(text); };
  const fail = (message: string) => {
    if (complete || disposed) return;
    feedback.textContent = apolloText(message); stage.dataset.feedback = 'error'; options.onFeedback?.('error'); later(() => { if (!complete) delete stage.dataset.feedback; }, 450);
  };
  const finish = (message: string) => {
    if (complete || disposed) return;
    complete = true; setPhase(2); stage.dataset.feedback = 'complete'; update(1, '✓ REGISTRO VALIDADO'); feedback.textContent = apolloText(message); options.onFeedback?.('success');
    workspace.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach(control => control.disabled = true);
    later(options.onComplete, 900);
  };
  const action = (label: string, callback: () => void) => { const b = node('button', 'ap-stand-action', label); b.type = 'button'; listen(b, 'click', callback); workspace.append(b); return b; };

  // Stable DOM and delegated listeners support pointer capture, touch and keyboard.
  const placement = (items: readonly string[], labels: readonly string[], cls: string, onChange: (slots: (number | null)[]) => void) => {
    const board = node('div', 'ap-placement ' + cls), tray = node('div', 'ap-placement-tray'), sockets = node('div', 'ap-placement-slots');
    const hint = node('small', 'ap-stand-input-hint', 'Arrastra una pieza o selecciónala y pulsa su destino. Tab y Enter también funcionan.');
    let slots: (number | null)[] = draft.slots ? [...draft.slots] : labels.map(() => null), selected: number | null = null;
    snapshot=()=>({version:1,kind:bonus.kind,slots:[...slots]});
    let drag: { item: number; id: number; x: number; y: number; moved: boolean } | null = null, ghost: HTMLElement | null = null, suppressClick = false;
    const chips = items.map((label, index) => {
      const chip = node('button', 'ap-placement-piece'); chip.type = 'button'; chip.dataset.item = String(index);
      chip.append(node('span', 'ap-piece-index', String(index + 1).padStart(2, '0')));
      if(cls==='ap-fuse-board'){const fuse=node('span','ap-fuse-body');fuse.setAttribute('aria-hidden','true');chip.append(fuse);}
      chip.append(node('strong','',label));chip.setAttribute('aria-label',apolloText(label));
      chip.style.setProperty('--channel-color', ['#d07d56', '#77a7b8', '#d4b65b', '#9c9ac3'][index % 4]!); tray.append(chip); return chip;
    });
    const destinations = labels.map((label, index) => {
      const slot = node('button', 'ap-placement-slot'); slot.type = 'button'; slot.dataset.slot = String(index); slot.setAttribute('aria-label', apolloText(label));
      slot.append(node('small', '', label), node('strong', '', '—')); sockets.append(slot); return slot;
    });
    const render = () => {
      chips.forEach((chip, i) => { chip.dataset.placed = String(slots.includes(i)); chip.setAttribute('aria-pressed', String(selected === i)); });
      destinations.forEach((slot, i) => { const value = slots[i]; slot.dataset.filled = String(value !== null); slot.querySelector('strong')!.textContent = value === null ? '—' : apolloText(items[value!]!); });
      setPhase(slots.every(value => value !== null) ? 1 : 0);
      onChange([...slots]); board.dispatchEvent(new Event('placementchange'));draftChanged();
    };
    const place = (item: number, slot: number) => { if (complete) return; slots = moveIntoSlot(slots, item, slot); selected = null; render(); feedback.textContent = apolloText('Pieza colocada · puedes cambiarla antes de verificar.'); };
    listen<MouseEvent>(board, 'click', event => {
      if (suppressClick) { suppressClick = false; return; }
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-item], [data-slot]'); if (!target || complete) return;
      if (target.dataset.item !== undefined) { selected = Number(target.dataset.item); render(); destinations[0]?.focus({ preventScroll: true }); }
      else if (selected !== null) place(selected, Number(target.dataset.slot));
      else { selected = slots[Number(target.dataset.slot)] ?? null; render(); }
    });
    listen<KeyboardEvent>(board, 'keydown', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]'); if (!target) return;
      const i = Number(target.dataset.slot);
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) { event.preventDefault(); destinations[(i + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? labels.length - 1 : 1)) % labels.length]?.focus(); }
      if (['Delete', 'Backspace'].includes(event.key) && !complete) { event.preventDefault(); slots[i] = null; render(); }
    });
    const cleanupDrag = () => { ghost?.remove(); ghost = null; chips.forEach(chip => chip.classList.remove('ap-piece-dragging')); destinations.forEach(slot => slot.classList.remove('ap-slot-over')); drag = null; };
    listen<PointerEvent>(board, 'pointerdown', event => {
      const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-item]'); if (!chip || complete || event.button !== 0) return;
      drag = { item: Number(chip.dataset.item), id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }; chip.setPointerCapture(event.pointerId);
    });
    listen<PointerEvent>(board, 'pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      drag.moved = true;
      if (!ghost) { ghost = chips[drag.item]!.cloneNode(true) as HTMLElement; ghost.className = 'ap-placement-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.removeAttribute('data-item'); stage.append(ghost); chips[drag.item]!.classList.add('ap-piece-dragging'); }
      ghost.style.left = event.clientX + 'px'; ghost.style.top = event.clientY + 'px';
      const drop = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
      destinations.forEach(slot => slot.classList.toggle('ap-slot-over', slot === drop));
    });
    listen<PointerEvent>(board, 'pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved) { suppressClick = true; later(() => { suppressClick = false; }, 80); const drop = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]'); if (drop && board.contains(drop)) place(drag.item, Number(drop.dataset.slot)); }
      cleanupDrag();
    });
    listen(board, 'pointercancel', cleanupDrag); listen(board, 'lostpointercapture', cleanupDrag);
    board.append(tray, sockets); workspace.append(board, hint); render();
    return { board, get: () => [...slots] };
  };

  if (bonus.kind === 'sequence') {
    let fitted = false;
    placement(FUSE_RATINGS.map(rating => rating + ' A'), FUSE_SOCKETS.map(rating => rating + ' A / PORTAFUSIBLE'), 'ap-fuse-board', slots => {
      fitted = slotsCorrect(slots.map(i => i === null ? null : FUSE_RATINGS[i]!), FUSE_SOCKETS); if (fitted) setPhase(2); update(slots.filter(i => i !== null).length / 5, slots.filter(i => i !== null).length + ' / 4 FUSIBLES');
    });
    const leverBox = node('label', 'ap-breaker'), lever = node('input'); lever.type = 'range'; lever.min = '0'; lever.max = '100'; lever.value = '0'; lever.setAttribute('aria-label', apolloText('Palanca de alimentación'));
    listen(lever, 'input', () => { if (Number(lever.value) < 95) return; if (!fitted) { lever.value = '0'; fail('Circuito abierto · revisa el amperaje de cada fusible.'); } else finish('Alimentación estable · banco de apoyo energizado.'); });
    leverBox.append(node('span', '', 'INTERRUPTOR GENERAL / 0 → 1'), lever, node('span', 'ap-breaker-state', 'OFF / ON')); workspace.append(leverBox);
  }

  if (bonus.kind === 'flight-plan') {
    const items=[FLIGHT_CARDS[2].title,FLIGHT_CARDS[0].title,FLIGHT_CARDS[3].title,FLIGHT_CARDS[1].title];
    const labels=['01 / PREPARACIÓN','02 / EMBARQUE','03 / MOTORES','04 / SALIDA'];
    const deck=placement(items,labels,'ap-timeline-board',slots=>{update(slots.filter(v=>v!==null).length/4*.85,slots.filter(v=>v!==null).length+' / 4 DOCUMENTOS');if(slotsCorrect(slots,[1,3,0,2]))setPhase(2);});
    action('Sellar plan de vuelo',()=>slotsCorrect(deck.get(),[1,3,0,2])?finish('Cronología validada · registro archivado.'):fail('Hay documentos pendientes o fuera de lugar. Revisa las placas de destino.'));
  }

  if(bonus.kind==='crew-manifest'){
    const imprinter=mountCredentialImprinter(workspace,{draft,signal:abort.signal,onDraft:()=>draftChanged(),onRead:count=>{
      update(count/3,count+' / 3 CREDENCIALES'); setPhase(count === 3 ? 2 : count ? 1 : 0);
      if(count)feedback.textContent=apolloText('Credencial impresa · función registrada en el manifiesto.');
    },onReject:fail,onComplete:()=>finish('Tripulación identificada · manifiesto cotejado.')});
    snapshot=imprinter.snapshot;
  }

  if (bonus.kind === 'cables') {
    const deck = placement(CABLE_CHANNELS.map((channel, i) => channel + ' / CANAL ' + (i + 1)), CABLE_TARGET_ORDER.map(channel => 'BORNE ' + channel), 'ap-patch-board', slots => {update(slots.filter(v => v !== null).length / 4 * .85, slots.filter(v => v !== null).length + ' / 4 CONECTORES');if(slotsCorrect(slots.map(i => i === null ? null : CABLE_CHANNELS[i]!), CABLE_TARGET_ORDER))setPhase(2);});
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('ap-patch-wires'); svg.setAttribute('viewBox', '0 0 1000 400'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true'); deck.board.prepend(svg);
    const draw = () => {
      svg.replaceChildren();
      deck.get().forEach((source, slot) => { if (source === null) return; const y1 = 50 + source * 100, y2 = 50 + slot * 100; const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M 240 ' + y1 + ' C 480 ' + y1 + ',520 ' + y2 + ',760 ' + y2); path.setAttribute('stroke', ['#df8f60', '#85bed0', '#e2c375', '#aaa7dc'][source]!); svg.append(path); });
    };
    listen(deck.board, 'placementchange', draw);draw();
    action('Probar continuidad', () => slotsCorrect(deck.get().map(i => i === null ? null : CABLE_CHANNELS[i]!), CABLE_TARGET_ORDER) ? finish('Cuatro circuitos cerrados · continuidad confirmada.') : fail('Continuidad interrumpida · conecta cada letra con su borne.'));
  }

  if (bonus.kind === 'telemetry') {
    const panel = node('div', 'ap-signal-panel'), canvas = node('canvas', 'ap-signal-scope'); canvas.width = 800; canvas.height = 240;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', apolloText('Comparación de señal recibida y señal de referencia'));
    const controls = node('div', 'ap-dial-bank'), values = draft.controls ? [...draft.controls] : [24, 42, 82];
    snapshot=()=>({version:1,kind:bonus.kind,controls:[...values]});
    TELEMETRY_REFERENCE.forEach((reference, index) => {
      const dial = node('label', 'ap-tuner'), face = node('div', 'ap-tuner-face'), needle = node('span'), input = node('input'), out = node('output');
      face.append(needle); input.type = 'range'; input.min = '0'; input.max = '100'; input.value = String(values[index]); input.setAttribute('aria-label', apolloText(['S-IVB', 'Enlace', 'Plataforma'][index]!));
      const render = () => { values[index] = Number(input.value); face.style.setProperty('--dial-angle', (-130 + values[index]! * 2.6) + 'deg'); out.textContent = input.value + ' / REF ' + reference; dial.dataset.aligned = String(Math.abs(values[index]! - reference) <= 3); setPhase(readingsAligned(values) ? 2 : values.some((v, i) => Math.abs(v - TELEMETRY_REFERENCE[i]!) <= 3) ? 1 : 0); update(values.filter((v, i) => Math.abs(v - TELEMETRY_REFERENCE[i]!) <= 3).length / 3 * .9, 'AJUSTE DE SEÑAL');draftChanged(); };
      listen(input, 'input', render); dial.append(node('strong', '', ['S-IVB', 'Enlace', 'Plataforma'][index]), face, out, input); controls.append(dial); render();
      let turn: { pointer: number; y: number; value: number } | null = null;
      listen<PointerEvent>(face,'pointerdown',event=>{if(complete||event.button!==0)return;turn={pointer:event.pointerId,y:event.clientY,value:Number(input.value)};face.setPointerCapture(event.pointerId);input.focus({preventScroll:true});});
      listen<PointerEvent>(face,'pointermove',event=>{if(!turn||turn.pointer!==event.pointerId)return;input.value=String(Math.round(Math.max(0,Math.min(100,turn.value+(turn.y-event.clientY)*.65))));render();});
      listen(face,'pointerup',()=>{turn=null;});listen(face,'pointercancel',()=>{turn=null;});listen(face,'lostpointercapture',()=>{turn=null;});
    });
    panel.append(canvas, controls); workspace.append(panel);
    animate((_dt, time) => {
      const c = canvas.getContext('2d')!; c.fillStyle = '#0c201d'; c.fillRect(0, 0, 800, 240); c.strokeStyle = '#28463b'; c.lineWidth = 1;
      for (let x = 0; x < 800; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 240); c.stroke(); }
      for (let y = 0; y < 240; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(800, y); c.stroke(); }
      for (let channel = 0; channel < 3; channel++) for (const reference of [true, false]) {
        c.strokeStyle = reference ? '#b5c5a0' : ['#efbd6a', '#8bc7bb', '#b8a7dd'][channel]!; c.setLineDash(reference ? [3, 6] : []); c.lineWidth = reference ? 1 : 2; c.beginPath();
        for (let x = 0; x < 800; x += 3) { const offset = reference ? 0 : (values[channel]! - TELEMETRY_REFERENCE[channel]!) * .45; const y = 42 + channel * 78 + Math.sin(x * .032 + time * 1.3) * 14 + offset; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      } c.setLineDash([]);
    });
    action('Fijar enlace', () => readingsAligned(values) ? finish('Las tres trazas coinciden · telemetría registrada.') : fail('Una traza sigue desplazada. Ajusta los tres sintonizadores.'));
  }

  if (bonus.kind === 'weather') {
    const panel = node('div', 'ap-weather-panel'), compass = node('div', 'ap-wind-rose'), needle = node('span', 'ap-wind-needle');
    compass.setAttribute('aria-hidden', 'true'); compass.append(node('span', 'ap-wind-north', 'N'), node('span', 'ap-wind-reference', '225° / SO'), needle);
    const controls = node('div', 'ap-weather-controls'); let heading = draft.controls?.[0] ?? 65, cloud = draft.controls?.[1] ?? 75;
    snapshot=()=>({version:1,kind:bonus.kind,controls:[heading,cloud]});
    const addControl = (label: string, max: number, initial: number, callback: (v: number) => void) => {
      const row = node('label', 'ap-weather-control'), input = node('input'), output = node('output'); input.type = 'range'; input.min = '0'; input.max = String(max); input.value = String(initial); input.setAttribute('aria-label', apolloText(label));
      const render = () => { output.textContent = input.value + (max === 359 ? '°' : ' %'); callback(Number(input.value)); setPhase(weatherAligned(heading, cloud) ? 2 : heading !== (draft.controls?.[0] ?? 65) || cloud !== (draft.controls?.[1] ?? 75) ? 1 : 0); update(weatherAligned(heading, cloud) ? .9 : .25, weatherAligned(heading, cloud) ? 'PARTE PREPARADO' : 'COMPARANDO REFERENCIA');draftChanged(); };
      listen(input, 'input', render); row.append(node('span', '', label), input, output); controls.append(row); render();return input;
    };
    const headingControl=addControl('Rumbo de veleta', 359, heading, v => { heading = v; needle.style.transform = 'rotate(' + v + 'deg)'; });
    let steering: number | null = null;
    const steer=(event:PointerEvent)=>{const r=compass.getBoundingClientRect();headingControl.value=String(Math.round((Math.atan2(event.clientX-r.left-r.width/2,-(event.clientY-r.top-r.height/2))*180/Math.PI+360)%360));headingControl.dispatchEvent(new Event('input'));};
    listen<PointerEvent>(compass,'pointerdown',event=>{if(complete||event.button!==0)return;steering=event.pointerId;compass.setPointerCapture(event.pointerId);headingControl.focus({preventScroll:true});steer(event);});
    listen<PointerEvent>(compass,'pointermove',event=>{if(event.pointerId===steering)steer(event);});
    listen(compass,'pointerup',()=>{steering=null;});listen(compass,'pointercancel',()=>{steering=null;});listen(compass,'lostpointercapture',()=>{steering=null;});
    const shutter = node('div', 'ap-cloud-plate'); shutter.append(node('span', '', 'PLACA DE NUBOSIDAD / REF 35 %')); controls.append(shutter);
    addControl('Obturador de nubosidad', 100, cloud, v => { cloud = v; shutter.style.setProperty('--cloud-cover', v + '%'); });
    panel.append(compass, controls); workspace.append(panel);
    action('Sellar parte de observación', () => weatherAligned(heading, cloud) ? finish('Referencias cotejadas · parte meteorológico archivado.') : fail('La veleta o la placa no coincide con la referencia del ejercicio.'));
  }

  if (bonus.kind === 'beacons') {
    const view = node('div', 'ap-perimeter'), canvas = node('canvas'); canvas.width = 800; canvas.height = 400; canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application'); canvas.setAttribute('aria-label', apolloText('Visor de perímetro. Mueve con el puntero o las flechas. Mantén el visor en cada baliza.'));
    const points = [{ x: .22, y: .3 }, { x: .73, y: .65 }, { x: .48, y: .24 }], recorded = draft.scanned ? [...draft.scanned] : [false, false, false], lock = [0, 0, 0], keys = new Set<string>();
    snapshot=()=>({version:1,kind:bonus.kind,scanned:[...recorded]});
    update(recorded.filter(Boolean).length/3,recorded.filter(Boolean).length+' / 3 BALIZAS REGISTRADAS');
    let aim = { x: .5, y: .7 };
    let active=true;
    const suspendScan=()=>{active=false;keys.clear();lock.fill(0);if(!complete)setPhase(0);};
    listen(window,'blur',suspendScan);listen(window,'focus',()=>{active=!document.hidden;});
    listen(document,'visibilitychange',()=>{if(document.hidden)suspendScan();else active=true;});
    const pointer = (event: PointerEvent) => { const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return; aim = { x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)) }; };
    listen<PointerEvent>(canvas, 'pointerdown', e => { canvas.focus(); canvas.setPointerCapture(e.pointerId); pointer(e); }); listen<PointerEvent>(canvas, 'pointermove', pointer);
    listen<KeyboardEvent>(canvas, 'keydown', e => { if (e.key.startsWith('Arrow')) { e.preventDefault(); keys.add(e.key); } }); listen<KeyboardEvent>(canvas, 'keyup', e => keys.delete(e.key)); listen(canvas, 'blur', () => keys.clear());
    view.append(canvas); workspace.append(view);
    animate((dt, time) => {
      if (complete || !active) return;
      aim.x = Math.max(0, Math.min(1, aim.x + (Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))) * dt * .35)); aim.y = Math.max(0, Math.min(1, aim.y + (Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'))) * dt * .6));
      const c = canvas.getContext('2d')!; c.fillStyle = '#122a28'; c.fillRect(0, 0, 800, 400); c.strokeStyle = '#2c4940'; c.lineWidth = 1;
      for (let x = 0; x < 800; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 400); c.stroke(); } for (let y = 0; y < 400; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(800, y); c.stroke(); }
      c.strokeStyle = '#8d815b'; c.setLineDash([8, 7]); c.strokeRect(85, 48, 620, 295); c.setLineDash([]);
      let scanPhase = 0;
      points.forEach((point, i) => {
        const aligned = Math.hypot((aim.x - point.x) * 2, aim.y - point.y) < .09;
        lock[i] = recorded[i] ? 1 : advanceScan(lock[i]!, dt, aligned);
        if (!recorded[i] && lock[i]! >= 1) { recorded[i] = true; options.onFeedback?.('success'); update(recorded.filter(Boolean).length / 3, recorded.filter(Boolean).length + ' / 3 BALIZAS REGISTRADAS');draftChanged(); }
        if (aligned) scanPhase = recorded[i] ? 2 : lock[i]! > 0 ? 1 : 0;
        const x = point.x * 800, y = point.y * 400; c.fillStyle = recorded[i] ? '#9bd4a8' : '#e4b76c'; c.beginPath(); c.arc(x, y, 7 + Math.sin(time * 2) * 1, 0, Math.PI * 2); c.fill();
        c.lineWidth = 3; c.strokeStyle = recorded[i] ? '#9bd4a8' : '#e4b76c'; c.beginPath(); c.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + lock[i]! * Math.PI * 2); c.stroke(); c.font = 'bold 15px monospace'; c.fillText((recorded[i] ? '✓ ' : '') + 'B' + (i + 1), x + 26, y + 5);
      });
      setPhase(scanPhase);
      const x = aim.x * 800, y = aim.y * 400; c.strokeStyle = '#e1dfbf'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 35, 0, Math.PI * 2); c.moveTo(x - 48, y); c.lineTo(x + 48, y); c.moveTo(x, y - 48); c.lineTo(x, y + 48); c.stroke();
      if (recorded.every(Boolean)) finish('Perímetro inspeccionado · traslado a observación autorizado.');
    });
  }

  workspace.querySelector<HTMLElement>('button, input, canvas[tabindex]')?.focus({ preventScroll: true });
  return { snapshot, dispose() { if (disposed) return; disposed = true; abort.abort(); timers.forEach(clearTimeout); frames.forEach(cancelAnimationFrame); stage.remove(); host.classList.remove('ap-stand-dialog'); } };
}
