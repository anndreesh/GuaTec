import { SURVEY_TARGETS, RECORDS, PULSE_PATTERN, restoreInstrumentDraft, clampInstrument, surveyAligned, trackingAligned, signalAligned, advanceInstrumentLock, recordsCorrect, pulseCorrect, pulseSequenceCorrect, type InstrumentKind, type InstrumentLanguage, type InstrumentDraft } from './ApolloInstrumentRules';
import './ApolloInstruments.css';
export type { InstrumentKind, InstrumentLanguage, InstrumentDraft } from './ApolloInstrumentRules';
export interface InstrumentOptions {
  language: InstrumentLanguage;
  variant?: 'orientation' | 'full';
  muted?: boolean;
  onComplete: () => void;
  onCancel: () => void;
  draft?: unknown;
  onDraft?: (draft: InstrumentDraft) => void;
}
export interface InstrumentHandle { dispose: () => void; snapshot: () => InstrumentDraft }
type Copy = typeof COPY.es;
const COPY = {
  es: {
    station: 'OPERACIONES DE APOYO · 1969', simulation: 'Instrumento educativo simulado · no opera sistemas de lanzamiento',
    survey: 'Reconocimiento óptico', records: 'Mesa de documentación', signal: 'Enlace de radio terrestre', tracking: 'Cámara de seguimiento',
    surveyHelp: 'Localiza cada estructura. Ajusta rumbo, aumento y enfoque hasta obtener una imagen estable; después acciona el obturador.',
    recordsHelp: 'Arrastra las tres fichas a su casilla del registro. También puedes seleccionar una ficha, cambiar de casilla con las flechas y colocarla con Enter.',
    signalHelp: 'Sintoniza frecuencia y ganancia para estabilizar la señal. Después reproduce el patrón corto · largo · corto manteniendo presionado el manipulador.',
    trackingHelp: 'Centra el Saturn V y enfoca la imagen. Mantén el encuadre estable durante dos segundos antes de exponer la placa de seguimiento.',
    back: 'Guardar borrador y volver', azimuth: 'Rumbo', zoom: 'Aumento', focus: 'Enfoque', pan: 'Giro horizontal', tilt: 'Elevación', frequency: 'Frecuencia', gain: 'Ganancia',
    bearing: 'Referencia de rumbo', magnification: 'Aumento de referencia', focusReference: 'Plano de enfoque', target: 'OBJETIVO',
    tower: 'Torre umbilical', pad: 'Plataforma 39A', vab: 'Vehicle Assembly Building',
    aligning: 'AJUSTANDO', stable: 'IMAGEN ESTABLE', locked: 'SEÑAL FIJADA', hold: 'Mantén el ajuste', capture: 'Accionar obturador', recorded: 'Observación registrada',
    notReady: 'La imagen aún no es estable. Ajusta los controles antes de capturar.', progress: 'Registro de campo',
    controls: 'Flechas: rumbo / enfoque · + / −: aumento · Espacio: obturador', trackingControls: 'Flechas: giro / elevación · + / −: enfoque · Espacio: exposición',
    vehicle: 'Vehículo', platform: 'Plataforma', time: 'Hora de lanzamiento', register: 'REGISTRO RECIBIDO · APOLLO 11',
    recordReference: 'Carter solicita el registro de Saturn V AS-506, LC-39A, 16 JUL 1969 a las 09:32 EDT. Ordena las fichas sin omitir ningún dato.',
    cards: 'FICHAS RECIBIDAS', slots: 'CAMPOS DEL INFORME', empty: 'Coloca una ficha', selected: 'Ficha seleccionada', assigned: 'Ficha colocada', remove: 'Retirar ficha', validate: 'Sellar registro',
    incomplete: 'Quedan casillas vacías. Cada dato debe tener una ficha.', mismatch: 'Los datos no coinciden con la referencia. Revisa las fichas y vuelve a sellar.', valid: 'Registro cotejado y sellado', keyboardRecords: 'Tab: seleccionar · ← / →: casilla · Enter: colocar · Supr: retirar',
    tune: 'SINTONIZAR ENLACE', referenceSignal: 'REFERENCIA', receivedSignal: 'RECIBIDA', replay: 'Escuchar patrón', key: 'Mantener para transmitir', short: 'CORTO', long: 'LARGO',
    pattern: 'PATRÓN · CORTO / LARGO / CORTO', pulseHelp: 'Corto ≈ 0,3 s · largo ≈ 0,8 s. Usa Espacio o mantén presionado el manipulador.',
    pulseWrong: 'Duración fuera del patrón. Escucha la referencia y empieza de nuevo.', pulseLost: 'Se perdió la sintonía. Vuelve a fijar la señal.', transmitting: 'TRANSMITIENDO', received: 'Acuse recibido · enlace listo', readyPulse: 'Enlace estable. Reproduce los tres pulsos.',
    expose: 'Exponer placa', trackingReady: 'Seguimiento preparado · placa expuesta', interrupted: 'Ajuste interrumpido', quality: 'Calidad de señal', finish: 'REGISTRO VALIDADO',
  },
  en: {
    station: 'GROUND SUPPORT · 1969', simulation: 'Simulated educational instrument · does not operate launch systems',
    survey: 'Optical survey', records: 'Documentation desk', signal: 'Ground radio link', tracking: 'Tracking camera',
    surveyHelp: 'Locate each structure. Adjust bearing, magnification and focus until the image is steady, then release the shutter.',
    recordsHelp: 'Drag the three cards into the report fields. You can also select a card, choose a field with the arrow keys and place it with Enter.',
    signalHelp: 'Tune frequency and gain to stabilize the signal. Then reproduce short · long · short by holding the telegraph key.',
    trackingHelp: 'Center Saturn V and focus the image. Hold a steady frame for two seconds before exposing the tracking plate.',
    back: 'Save draft and return', azimuth: 'Bearing', zoom: 'Magnification', focus: 'Focus', pan: 'Horizontal pan', tilt: 'Elevation', frequency: 'Frequency', gain: 'Gain',
    bearing: 'Bearing reference', magnification: 'Magnification reference', focusReference: 'Focus plane', target: 'TARGET',
    tower: 'Umbilical tower', pad: 'Launch Pad 39A', vab: 'Vehicle Assembly Building',
    aligning: 'ADJUSTING', stable: 'IMAGE STEADY', locked: 'SIGNAL LOCKED', hold: 'Hold the setting', capture: 'Release shutter', recorded: 'Observation recorded',
    notReady: 'The image is not steady yet. Adjust the controls before capturing.', progress: 'Field record',
    controls: 'Arrows: bearing / focus · + / −: magnification · Space: shutter', trackingControls: 'Arrows: pan / elevation · + / −: focus · Space: exposure',
    vehicle: 'Vehicle', platform: 'Launch pad', time: 'Launch time', register: 'RECEIVED REPORT · APOLLO 11',
    recordReference: 'Carter requests the record for Saturn V AS-506, LC-39A, 16 JUL 1969 at 09:32 EDT. Match every card to its field.',
    cards: 'RECEIVED CARDS', slots: 'REPORT FIELDS', empty: 'Place a card', selected: 'Card selected', assigned: 'Card placed', remove: 'Remove card', validate: 'Stamp report',
    incomplete: 'Some fields are empty. Every datum needs a card.', mismatch: 'The data do not match the reference. Review the cards and stamp again.', valid: 'Report checked and stamped', keyboardRecords: 'Tab: select · ← / →: field · Enter: place · Delete: remove',
    tune: 'TUNE LINK', referenceSignal: 'REFERENCE', receivedSignal: 'RECEIVED', replay: 'Listen to pattern', key: 'Hold to transmit', short: 'SHORT', long: 'LONG',
    pattern: 'PATTERN · SHORT / LONG / SHORT', pulseHelp: 'Short ≈ 0.3 s · long ≈ 0.8 s. Use Space or hold the telegraph key.',
    pulseWrong: 'Pulse duration does not match. Listen to the reference and start again.', pulseLost: 'Tuning was lost. Lock the signal again.', transmitting: 'TRANSMITTING', received: 'Acknowledgment received · link ready', readyPulse: 'Link stable. Reproduce the three pulses.',
    expose: 'Expose plate', trackingReady: 'Tracking ready · plate exposed', interrupted: 'Setting interrupted', quality: 'Signal quality', finish: 'RECORD VALIDATED',
  },
  fr: {
    station: 'SOUTIEN AU SOL · 1969', simulation: 'Instrument pédagogique simulé · ne commande aucun système de lancement',
    survey: 'Reconnaissance optique', records: 'Table de documentation', signal: 'Liaison radio terrestre', tracking: 'Caméra de poursuite',
    surveyHelp: 'Repérez chaque structure. Réglez le cap, le grossissement et la mise au point jusqu’à stabiliser l’image, puis déclenchez.',
    recordsHelp: 'Glissez les trois fiches dans les champs du rapport. Vous pouvez aussi sélectionner une fiche, choisir un champ avec les flèches et la placer avec Entrée.',
    signalHelp: 'Réglez fréquence et gain pour stabiliser le signal. Reproduisez ensuite court · long · court en maintenant le manipulateur.',
    trackingHelp: 'Centrez Saturn V et réglez la netteté. Maintenez le cadrage stable deux secondes avant d’exposer la plaque de suivi.',
    back: 'Enregistrer et revenir', azimuth: 'Cap', zoom: 'Grossissement', focus: 'Netteté', pan: 'Rotation horizontale', tilt: 'Élévation', frequency: 'Fréquence', gain: 'Gain',
    bearing: 'Cap de référence', magnification: 'Grossissement de référence', focusReference: 'Plan de netteté', target: 'CIBLE',
    tower: 'Tour ombilicale', pad: 'Pas de tir 39A', vab: 'Vehicle Assembly Building',
    aligning: 'RÉGLAGE', stable: 'IMAGE STABLE', locked: 'SIGNAL VERROUILLÉ', hold: 'Maintenez le réglage', capture: 'Déclencher', recorded: 'Observation enregistrée',
    notReady: 'L’image n’est pas encore stable. Réglez les commandes avant la capture.', progress: 'Relevé de terrain',
    controls: 'Flèches : cap / netteté · + / − : grossissement · Espace : obturateur', trackingControls: 'Flèches : rotation / élévation · + / − : netteté · Espace : exposition',
    vehicle: 'Véhicule', platform: 'Pas de tir', time: 'Heure de lancement', register: 'RAPPORT REÇU · APOLLO 11',
    recordReference: 'Carter demande le registre de Saturn V AS-506, LC-39A, le 16 JUL 1969 à 09:32 EDT. Associez chaque fiche à son champ.',
    cards: 'FICHES REÇUES', slots: 'CHAMPS DU RAPPORT', empty: 'Placer une fiche', selected: 'Fiche sélectionnée', assigned: 'Fiche placée', remove: 'Retirer la fiche', validate: 'Tamponner le rapport',
    incomplete: 'Des champs sont vides. Chaque donnée nécessite une fiche.', mismatch: 'Les données ne correspondent pas. Vérifiez les fiches puis tamponnez à nouveau.', valid: 'Rapport vérifié et tamponné', keyboardRecords: 'Tab : sélectionner · ← / → : champ · Entrée : placer · Suppr : retirer',
    tune: 'RÉGLER LA LIAISON', referenceSignal: 'RÉFÉRENCE', receivedSignal: 'REÇU', replay: 'Écouter le motif', key: 'Maintenir pour transmettre', short: 'COURT', long: 'LONG',
    pattern: 'MOTIF · COURT / LONG / COURT', pulseHelp: 'Court ≈ 0,3 s · long ≈ 0,8 s. Utilisez Espace ou maintenez le manipulateur.',
    pulseWrong: 'La durée ne correspond pas. Écoutez le motif et recommencez.', pulseLost: 'Accord perdu. Verrouillez à nouveau le signal.', transmitting: 'TRANSMISSION', received: 'Accusé reçu · liaison prête', readyPulse: 'Liaison stable. Reproduisez les trois impulsions.',
    expose: 'Exposer la plaque', trackingReady: 'Suivi prêt · plaque exposée', interrupted: 'Réglage interrompu', quality: 'Qualité du signal', finish: 'RELEVÉ VALIDÉ',
  },
} as const;

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const result = document.createElement(tag); result.className = cls; result.textContent = text; return result;
};

/** A self-contained instrument owns its animation, handlers and draft. Dispose before replacing host. */
export function mountInstrument(host: HTMLElement, kind: InstrumentKind, options: InstrumentOptions): InstrumentHandle {
  const copy: Record<keyof Copy, string> = COPY[options.language] ?? COPY.es;
  const surveyTargets = options.variant === 'orientation' ? [SURVEY_TARGETS[1]] : [...SURVEY_TARGETS];
  let draft = restoreInstrumentDraft(kind, options.draft), disposed = false, completed = false, raf = 0;
  let clock = 0, lastFrame = performance.now(), lock = 0, locked = false, pulseStarted: number | null = null;
  let selectedCard = '', selectedSlot = 0, lastDraft = '';
  let pulseDemo = -1, audio: AudioContext | null = null, tone: OscillatorNode | null = null, gain: GainNode | null = null;
  if (options.variant === 'orientation') draft.captures=[];
  const surveyIndex=()=>SURVEY_TARGETS.findIndex(t=>t.id===surveyTargets[Math.min(draft.captures.length,surveyTargets.length-1)].id);
  const cleanups: Array<() => void> = [];
  const sliders: HTMLInputElement[] = [], outputs: HTMLOutputElement[] = [];
  const root = node('section', `ap-instrument ap-instrument-${kind}`); root.tabIndex = 0;
  root.setAttribute('aria-label', copy[kind]);
  const top = node('header', 'ap-inst-header');
  top.append(node('span', 'ap-inst-serial', copy.station), node('span', 'ap-inst-badge', `AP11 / ${kind === 'survey' ? 'OPT-01' : kind === 'records' ? 'DOC-02' : kind === 'signal' ? 'RF-03' : 'CAM-04'}`));
  root.append(top, node('h2', 'ap-inst-title', copy[kind]), node('p', 'ap-inst-instructions', copy[`${kind}Help`]));
  const stage = node('div', 'ap-inst-stage'); root.append(stage);
  const feedback = node('p', 'ap-inst-feedback'); feedback.setAttribute('aria-live', 'polite'); root.append(feedback);
  const footer = node('footer', 'ap-inst-footer');
  const back = node('button', 'ap-inst-back', copy.back); back.type = 'button';
  footer.append(node('small', '', copy.simulation), back); root.append(footer); host.append(root);
  const listen = (target: EventTarget, name: string, handler: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions) => { target.addEventListener(name, handler, opts); cleanups.push(() => target.removeEventListener(name, handler, opts)); };
  const snapshot = () => JSON.parse(JSON.stringify(draft)) as InstrumentDraft;
  const persist = () => { const data = JSON.stringify(draft); if (data !== lastDraft && !disposed) { lastDraft = data; options.onDraft?.(snapshot()); } };
  const say = (text: string, error = false) => { feedback.textContent = text; feedback.classList.toggle('ap-inst-error', error); };
  function stopTone() { try { tone?.stop(); } catch {} tone = null; gain = null; }
  function dispose() {
    if (disposed) return; persist(); disposed = true; cancelAnimationFrame(raf); cleanups.forEach(fn => fn()); stopTone();
    if (audio && audio.state !== 'closed') void audio.close().catch(() => {}); audio = null; root.remove();
  }
  function finish(message: string) {
    if (disposed || completed) return; completed = true; root.classList.add('ap-inst-complete'); say(message); persist();
    options.onComplete();
  }
  listen(back, 'click', () => { if (disposed || completed) return; persist(); dispose(); options.onCancel(); });
  function setValue(index: number, value: number) {
    draft.values[index] = clampInstrument(value); if (sliders[index]) sliders[index].value = String(draft.values[index]);
    if (outputs[index]) outputs[index].value = String(Math.round(draft.values[index])); persist();
  }
  function slider(label: string, index: number) {
    const wrap = node('label', 'ap-inst-control'), name = node('span', 'ap-inst-control-name', label), input = node('input');
    input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1'; input.value = String(draft.values[index]); input.setAttribute('aria-label', label);
    const output = node('output', '', String(draft.values[index]));
    wrap.append(name, input, output); sliders[index] = input; outputs[index] = output;
    listen(input, 'input', () => setValue(index, Number(input.value))); return wrap;
  }
  function ensureTone(on: boolean) {
    if (!on || options.muted) { stopTone(); return; }
    try {
      audio ??= new AudioContext(); if (audio.state === 'suspended') void audio.resume().catch(() => {});
      if (!tone) { tone = audio.createOscillator(); tone.type = 'sine'; tone.frequency.value = 680; gain = audio.createGain(); gain.gain.value = .045; tone.connect(gain).connect(audio.destination); tone.start(); }
    } catch { /* Safari may have audio disabled; waveform/pulse feedback remains complete. */ }
  }

  let canvas: HTMLCanvasElement | null = null, context: CanvasRenderingContext2D | null = null;
  let action: HTMLButtonElement | null = null, status: HTMLElement | null = null, meter: HTMLElement | null = null, targetText: HTMLElement | null = null;
  const requiredLock = kind === 'survey' ? .8 : kind === 'tracking' ? 2 : 1.5;
  if (kind !== 'records') {
    const viewport = node('div', 'ap-inst-viewport');
    canvas = node('canvas'); canvas.width = 900; canvas.height = kind === 'signal' ? 310 : 370; canvas.setAttribute('aria-label', copy[kind]);
    context = canvas.getContext('2d'); viewport.append(canvas);
    const corners = node('div', 'ap-inst-glass'); viewport.append(corners);
    status = node('span', 'ap-inst-status', copy.aligning); viewport.append(status);
    targetText = node('span', 'ap-inst-target'); viewport.append(targetText);
    const gauge = node('div', 'ap-inst-lock'); meter = node('i'); gauge.append(meter); viewport.append(gauge); stage.append(viewport);
    const panel = node('div', 'ap-inst-panel');
    if (kind === 'survey') panel.append(slider(copy.azimuth, 0), slider(copy.zoom, 1), slider(copy.focus, 2));
    if (kind === 'tracking') panel.append(slider(copy.pan, 0), slider(copy.tilt, 1), slider(copy.focus, 2));
    if (kind === 'signal') panel.append(slider(copy.frequency, 0), slider(copy.gain, 1));
    stage.append(panel);
    const reference = node('div', 'ap-inst-reference');
    const referenceLabel = node('b'), referenceValues = node('span'); reference.append(referenceLabel, referenceValues); stage.append(reference);
    if (kind === 'survey') {
      referenceLabel.textContent = copy.progress;
      const updateReference = () => { const t = surveyTargets[Math.min(draft.captures.length, surveyTargets.length-1)]; referenceValues.textContent = `${copy[t.id]} · ${copy.bearing} ${t.azimuth} · ${copy.magnification} ${t.zoom} · ${copy.focusReference} ${t.focus}`; };
      updateReference();
      action = node('button', 'ap-inst-action', copy.capture); action.type = 'button'; stage.append(action, node('small', 'ap-inst-keyhint', copy.controls));
      function captureSurvey() {
        if (disposed || completed) return;
        if (lock < requiredLock || !surveyAligned(draft.values, surveyIndex())) { say(copy.notReady, true); return; }
        const target = surveyTargets[draft.captures.length]; draft.captures.push(target.id); persist(); lock = 0;
        if (draft.captures.length === surveyTargets.length) { finish(copy.finish); return; }
        say(`${copy.recorded} · ${copy[target.id]}`); updateReference();
      }
      listen(action, 'click', captureSurvey);
      listen(root, 'keydown', (e: Event) => { const key = e as KeyboardEvent; if ((key.target as HTMLElement)?.matches('input,button')) return; if (key.code === 'Space' && !key.repeat) { key.preventDefault(); captureSurvey(); } });
    } else if (kind === 'tracking') {
      referenceLabel.textContent = copy.target; referenceValues.textContent = `SATURN V · ${copy.pan} 61 · ${copy.tilt} 57 · ${copy.focus} 79`;
      action = node('button', 'ap-inst-action', copy.expose); action.type = 'button'; stage.append(action, node('small', 'ap-inst-keyhint', copy.trackingControls));
      const capture = () => { if (disposed || completed) return; if (lock >= requiredLock && trackingAligned(draft.values)) finish(copy.trackingReady); else say(copy.notReady, true); };
      listen(action, 'click', capture);
      listen(root, 'keydown', (e: Event) => { const key = e as KeyboardEvent; if ((key.target as HTMLElement)?.matches('input,button')) return; if (key.code === 'Space' && !key.repeat) { key.preventDefault(); capture(); } });
    } else {
      referenceLabel.textContent = copy.tune; referenceValues.textContent = `${copy.frequency} 67 · ${copy.gain} 73`;
      const pulseRow = node('div', 'ap-inst-pulses');
      PULSE_PATTERN.forEach((_, index) => pulseRow.append(node('span', 'ap-inst-pulse', index === 1 ? '━' : '●')));
      stage.append(node('strong', 'ap-inst-pattern-title', copy.pattern), pulseRow, node('p', 'ap-inst-pulse-help', copy.pulseHelp));
      const row = node('div', 'ap-inst-radio-actions'), replay = node('button', 'ap-inst-replay', copy.replay), key = node('button', 'ap-inst-telegraph', copy.key);
      replay.type = key.type = 'button'; row.append(replay, key); stage.append(row);
      listen(replay, 'click', () => { if(pulseStarted!==null)return; pulseDemo = 0; ensureTone(true); });
      const beginPulse = () => {
        if (disposed || completed || pulseStarted !== null) return;
        if (!locked || !signalAligned(draft.values)) { say(copy.pulseLost, true); return; }
        pulseDemo=-1;pulseStarted=performance.now();key.classList.add('ap-inst-key-down');ensureTone(true);say(copy.transmitting);
      };
      const endPulse = () => {
        if (pulseStarted === null) return;
        // Human input uses wall time. Capped animation deltas at 8 fps used to turn
        // a correct 0.8-second hold into an invalid short pulse.
        const duration=(performance.now()-pulseStarted)/1000;pulseStarted=null;stopTone();key.classList.remove('ap-inst-key-down');
        if(document.hidden||!locked||!signalAligned(draft.values)){draft.pulses=[];persist();say(copy.pulseLost,true);return;}
        if (!pulseCorrect(duration, draft.pulses.length)) { draft.pulses = []; say(copy.pulseWrong, true); }
        else { draft.pulses.push(duration); say(draft.pulses.length < 3 ? copy.readyPulse : copy.received); }
        [...pulseRow.children].forEach((n, i) => n.classList.toggle('ap-inst-pulse-done', i < draft.pulses.length)); persist();
        if (pulseSequenceCorrect(draft.pulses) && locked && signalAligned(draft.values)) finish(copy.received);
      };
      listen(key, 'pointerdown', (e: Event) => { const event = e as PointerEvent; event.preventDefault(); key.setPointerCapture(event.pointerId); beginPulse(); });
      listen(key, 'pointerup', endPulse); listen(key, 'pointercancel', () => { pulseStarted = null; stopTone(); key.classList.remove('ap-inst-key-down'); });
      listen(key,'lostpointercapture',()=>{pulseStarted=null;stopTone();key.classList.remove('ap-inst-key-down');});
      listen(root, 'keydown', (e: Event) => { const event = e as KeyboardEvent; if (event.code !== 'Space' || (event.target as HTMLElement)?.matches('input') || ((event.target as HTMLElement)?.tagName === 'BUTTON' && event.target !== key)) return; event.preventDefault(); if (!event.repeat) beginPulse(); });
      listen(root, 'keyup', (e: Event) => { if ((e as KeyboardEvent).code === 'Space') { (e as KeyboardEvent).preventDefault(); endPulse(); } });
      listen(window, 'blur', () => { pulseStarted = null; pulseDemo=-1; stopTone(); key.classList.remove('ap-inst-key-down'); });
    }
    listen(root, 'keydown', (e: Event) => {
      if (kind === 'signal') return;
      const event = e as KeyboardEvent; if ((event.target as HTMLElement)?.matches('input,button')) return;
      const changes: Record<string, [number, number]> = { ArrowLeft: [0, -1], a: [0, -1], ArrowRight: [0, 1], d: [0, 1], ArrowUp: [kind === 'survey' ? 2 : 1, 1], w: [kind === 'survey' ? 2 : 1, 1], ArrowDown: [kind === 'survey' ? 2 : 1, -1], s: [kind === 'survey' ? 2 : 1, -1], '+': [kind === 'survey' ? 1 : 2, 1], '=': [kind === 'survey' ? 1 : 2, 1], '-': [kind === 'survey' ? 1 : 2, -1] };
      const change = changes[event.key]; if (change) { event.preventDefault(); setValue(change[0], draft.values[change[0]] + change[1]); }
    });
  } else {
    const received = node('div', 'ap-inst-paper'); received.append(node('small', '', copy.register), node('p', '', copy.recordReference)); stage.append(received);
    const desk = node('div', 'ap-inst-desk'), cardTray = node('div', 'ap-inst-card-tray'), slotTray = node('div', 'ap-inst-slot-tray');
    cardTray.append(node('h3', '', copy.cards)); slotTray.append(node('h3', '', copy.slots)); desk.append(cardTray, slotTray); stage.append(desk);
    const cards: HTMLButtonElement[] = [], slots: HTMLButtonElement[] = [];
    const select = (id: string) => { selectedCard = id; cards.forEach(b => { b.classList.toggle('ap-inst-card-selected', b.dataset.card === id); b.setAttribute('aria-pressed', String(b.dataset.card === id)); }); say(`${copy.selected}: ${id}`); };
    function renderSlots() {
      slots.forEach((b, i) => { const name = [copy.vehicle, copy.platform, copy.time][i]; b.replaceChildren(node('small', '', name), node('strong', '', draft.slots[i] ?? copy.empty)); b.classList.toggle('ap-inst-slot-filled', !!draft.slots[i]); b.classList.toggle('ap-inst-slot-active', i === selectedSlot); b.setAttribute('aria-label', `${name}: ${draft.slots[i] ?? copy.empty}`); });
      cards.forEach(b => b.classList.toggle('ap-inst-card-used', draft.slots.includes(b.dataset.card!)));
    }
    function assign(index: number, id: string) {
      if (disposed || completed || !(RECORDS as readonly string[]).includes(id)) return;
      draft.slots = draft.slots.map(value => value === id ? null : value); draft.slots[index] = id; selectedSlot = index; selectedCard = ''; renderSlots(); cards.forEach(b => { b.classList.remove('ap-inst-card-selected'); b.setAttribute('aria-pressed','false'); }); persist(); say(copy.assigned);
    }
    // Fixed non-reference order avoids a layout that hands the answer to the player.
    [RECORDS[2], RECORDS[0], RECORDS[1]].forEach(id => {
      const b = node('button', 'ap-inst-record-card', id); b.type = 'button'; b.draggable = true; b.dataset.card = id; b.setAttribute('aria-pressed', 'false'); cards.push(b); cardTray.append(b);
      listen(b, 'click', () => select(id));
      listen(b, 'dragstart', (e: Event) => { (e as DragEvent).dataTransfer?.setData('text/plain', id); select(id); });
      listen(b, 'keydown', (e: Event) => { const event = e as KeyboardEvent; if (event.key === 'Enter') { event.preventDefault(); if (selectedCard === id) assign(selectedSlot, id); else select(id); } });
      // Native HTML drag remains available on desktop; pointer drop supports touch/Safari.
      listen(b, 'pointerdown', (e: Event) => { const event = e as PointerEvent; if (event.pointerType === 'mouse') return; select(id); b.setPointerCapture(event.pointerId); });
      listen(b, 'pointerup', (e: Event) => { const event = e as PointerEvent; if (event.pointerType === 'mouse') return; const drop = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]'); if (drop && root.contains(drop)) assign(Number(drop.dataset.slot), id); });
    });
    for (let i = 0; i < 3; i++) {
      const b = node('button', 'ap-inst-record-slot'); b.type = 'button'; b.dataset.slot = String(i); slots.push(b); slotTray.append(b);
      listen(b,'focus',()=>{selectedSlot=i;slots.forEach((slot,index)=>slot.classList.toggle('ap-inst-slot-active',index===i));});
      listen(b, 'click', () => { selectedSlot = i; if (selectedCard) assign(i, selectedCard); else { renderSlots(); b.focus(); } });
      listen(b, 'dragover', (e: Event) => { e.preventDefault(); b.classList.add('ap-inst-drop'); });
      listen(b, 'dragleave', () => b.classList.remove('ap-inst-drop'));
      listen(b, 'drop', (e: Event) => { e.preventDefault(); b.classList.remove('ap-inst-drop'); assign(i, (e as DragEvent).dataTransfer?.getData('text/plain') ?? selectedCard); });
      listen(b, 'keydown', (e: Event) => { const event = e as KeyboardEvent; if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); draft.slots[i] = null; persist(); renderSlots(); say(copy.remove); } });
    }
    listen(root, 'keydown', (e: Event) => {
      const event = e as KeyboardEvent;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); selectedSlot = (selectedSlot + (event.key === 'ArrowRight' ? 1 : 2)) % 3; renderSlots(); slots[selectedSlot].focus(); }
      const focusedSlot=(event.target as HTMLElement)?.dataset.slot;
      if(event.key==='Enter'&&selectedCard&&focusedSlot!==undefined){event.preventDefault();assign(Number(focusedSlot),selectedCard);}
    });
    renderSlots();
    action = node('button', 'ap-inst-action ap-inst-stamp', copy.validate); action.type = 'button'; stage.append(action, node('small', 'ap-inst-keyhint', copy.keyboardRecords));
    listen(action, 'click', () => { if (!draft.slots.every(Boolean)) say(copy.incomplete, true); else if (!recordsCorrect(draft.slots)) { root.classList.add('ap-inst-mismatch'); say(copy.mismatch, true); } else finish(copy.valid); });
  }

  function drawOptics(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const target = surveyTargets[Math.min(draft.captures.length, surveyTargets.length-1)];
    const aligned = kind === 'survey' ? surveyAligned(draft.values, surveyIndex()) : trackingAligned(draft.values);
    const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, '#173847'); sky.addColorStop(1, '#7b9a8d'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#344f43'; ctx.fillRect(0, height * .71, width, height * .29);
    ctx.strokeStyle = '#b5ba8b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, height * .75); ctx.lineTo(width, height * .75); ctx.stroke();
    const focus = kind === 'survey' ? draft.values[2] : draft.values[2], targetFocus = kind === 'survey' ? target.focus : 79;
    ctx.save(); ctx.filter = `blur(${Math.abs(focus - targetFocus) / 14}px)`;
    if (kind === 'survey') {
      const zoom = .65 + draft.values[1] / 80;
      const drawAt = (bearing: number) => width / 2 + (bearing - draft.values[0]) * 13 * zoom;
      // Original silhouettes identify the red umbilical lattice, Saturn V and the VAB.
      const tx = drawAt(26); ctx.fillStyle = '#7d4e3d'; ctx.fillRect(tx - 18 * zoom, height * .25, 36 * zoom, height * .46);
      ctx.strokeStyle = '#c4a876'; ctx.lineWidth = 2;
      for (let j = 0; j < 6; j++) { const y = height * .25 + j * height * .075; ctx.beginPath(); ctx.moveTo(tx - 17 * zoom, y); ctx.lineTo(tx + 17 * zoom, y + height * .075); ctx.moveTo(tx + 17 * zoom, y); ctx.lineTo(tx - 17 * zoom, y + height * .075); ctx.stroke(); }
      const rx = drawAt(52); drawRocket(ctx, rx, height * .71, .76 * zoom);
      const vx = drawAt(82); ctx.fillStyle = '#a8b8af'; ctx.fillRect(vx - 53 * zoom, height * .3, 106 * zoom, height * .41); ctx.fillStyle = '#758e86';
      for (let i = 0; i < 5; i++) ctx.fillRect(vx - 45 * zoom + i * 20 * zoom, height * .36, 13 * zoom, height * .35);
    } else {
      const rx = width / 2 + (61 - draft.values[0]) * 9, ry = height * .8 + (draft.values[1] - 57) * 4;
      drawRocket(ctx, rx, ry, .9); ctx.fillStyle = '#92735b'; ctx.fillRect(rx - 70, ry - 210, 17, 210);
      ctx.strokeStyle = '#c1ac87'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(rx - 70, ry - i * 30); ctx.lineTo(rx - 53, ry - (i + 1) * 30); ctx.stroke(); }
    }
    ctx.restore();
    ctx.strokeStyle = aligned ? '#c6e6a3' : '#d8c492'; ctx.lineWidth = 1;
    const cx = width / 2, cy = height / 2;
    ctx.beginPath(); ctx.moveTo(cx - 40, cy); ctx.lineTo(cx - 10, cy); ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 40, cy); ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy - 10); ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 40); ctx.stroke();
    ctx.strokeRect(cx - 70, cy - 85, 140, 170);
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 40, height - 30); ctx.lineTo(cx + i * 40, height - (i % 2 ? 36 : 42)); ctx.stroke(); }
    ctx.fillStyle = '#d8e4c5'; ctx.font = '14px sans-serif'; ctx.fillText(kind === 'survey' ? `${draft.captures.length} / ${surveyTargets.length}` : 'LC-39A · SATURN V', 24, height - 20);
  }
  function drawRocket(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(scale, scale); ctx.fillStyle = '#e6e6cb'; ctx.fillRect(-13, -185, 26, 185); ctx.beginPath(); ctx.moveTo(-13, -185); ctx.lineTo(0, -220); ctx.lineTo(13, -185); ctx.fill();
    ctx.fillStyle = '#253c38'; ctx.fillRect(-13, -58, 26, 17); ctx.fillRect(-13, -135, 26, 14); ctx.fillRect(-5, -111, 10, 42); ctx.fillStyle = '#b8c7ae'; ctx.fillRect(-2, -245, 4, 32); ctx.fillStyle = '#e7e7cd'; ctx.beginPath(); ctx.moveTo(-13, -25); ctx.lineTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(13, -25); ctx.fill(); ctx.restore();
  }
  function drawSignal(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = '#071e1a'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#275443'; ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const draw = (color: string, frequency: number, amplitude: number, offset: number, y: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x < width; x += 2) { const val = y + Math.sin(x / width * Math.PI * frequency + offset) * amplitude; if (!x) ctx.moveTo(x, val); else ctx.lineTo(x, val); } ctx.stroke();
    };
    draw('#799b76', 14, 36, 0, height * .4);
    const drift = (draft.values[0] - 67) * .015 * clock;
    draw('#e1e8a2', 14 + (draft.values[0] - 67) * .1, draft.values[1] * 36 / 73, drift, height * .4);
    ctx.fillStyle = '#acd4b2'; ctx.font = '13px sans-serif'; ctx.fillText(`${copy.referenceSignal} / ${copy.receivedSignal}`, 20, 25);
    ctx.fillText(`${copy.quality}: ${Math.round(Math.max(0, 100 - Math.abs(draft.values[0] - 67) * 3 - Math.abs(draft.values[1] - 73) * 2))}%`, 20, height - 18);
    ctx.strokeStyle = '#d8d596'; ctx.lineWidth = 3; ctx.beginPath();
    let px = 450; for (let i = 0; i < 3; i++) { const length = PULSE_PATTERN[i] * 90; ctx.moveTo(px, height - 42); ctx.lineTo(px, height - 66); ctx.lineTo(px + length, height - 66); ctx.lineTo(px + length, height - 42); px += length + 30; } ctx.stroke();
  }
  function frame(now: number) {
    if (disposed || completed) return;
    const dt = document.hidden ? 0 : Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now; clock += dt;
    if (kind !== 'records') {
      const aligned = kind === 'survey' ? surveyAligned(draft.values, surveyIndex()) : kind === 'tracking' ? trackingAligned(draft.values) : signalAligned(draft.values);
      const previousLock = locked; lock = advanceInstrumentLock(lock, aligned, dt, requiredLock); locked = lock >= requiredLock;
      if (meter) meter.style.transform = `scaleX(${lock / requiredLock})`;
      status!.textContent = locked ? kind === 'signal' ? copy.locked : copy.stable : `${copy.aligning} · ${Math.round(lock / requiredLock * 100)}%`;
      status!.classList.toggle('ap-inst-status-locked', locked);
      targetText!.textContent = kind === 'survey' ? `${copy.target} · ${copy[surveyTargets[Math.min(draft.captures.length, surveyTargets.length-1)].id]}` : kind === 'tracking' ? 'SATURN V · LC-39A' : copy.tune;
      if (action) action.disabled = !locked;
      if (kind === 'signal') {
        if (locked && !previousLock) say(copy.readyPulse);
        if (!aligned && draft.pulses.length) { draft.pulses = []; persist(); [...stage.querySelectorAll('.ap-inst-pulse')].forEach(n => n.classList.remove('ap-inst-pulse-done')); }
        if (pulseStarted !== null) {
          if (!aligned || document.hidden) { pulseStarted = null; stopTone(); stage.querySelector('.ap-inst-telegraph')?.classList.remove('ap-inst-key-down'); say(copy.pulseLost, true); }
        }
        if (pulseDemo >= 0) {
          pulseDemo += dt; const t = pulseDemo;
          const demoOn = t < .28 || (t > .58 && t < 1.4) || (t > 1.7 && t < 1.98);
          ensureTone(demoOn); if (t > 2.1) { pulseDemo = -1; stopTone(); }
        }
      }
      if (context && canvas) { if (kind === 'signal') drawSignal(context, canvas.width, canvas.height); else drawOptics(context, canvas.width, canvas.height); }
    }
    raf = requestAnimationFrame(frame);
  }
  listen(document, 'visibilitychange', () => { lastFrame = performance.now(); if (document.hidden) { stopTone(); pulseStarted = null; pulseDemo=-1; stage.querySelector('.ap-inst-telegraph')?.classList.remove('ap-inst-key-down'); } });
  persist(); raf = requestAnimationFrame(frame);
  return { dispose, snapshot };
}
