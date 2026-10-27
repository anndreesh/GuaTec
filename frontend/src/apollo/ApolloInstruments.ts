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
    protocol: 'Protocolo', adjustPhase: 'Ajustar', stabilizePhase: 'Estabilizar', capturePhase: 'Capturar', selectPhase: 'Elegir ficha', placePhase: 'Colocar', stampPhase: 'Sellar', tunePhase: 'Sintonizar', transmitPhase: 'Transmitir', ackPhase: 'Acuse', listening: 'ESCUCHANDO',
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
    protocol: 'Protocol', adjustPhase: 'Adjust', stabilizePhase: 'Steady', capturePhase: 'Capture', selectPhase: 'Choose card', placePhase: 'Place', stampPhase: 'Stamp', tunePhase: 'Tune', transmitPhase: 'Transmit', ackPhase: 'Acknowledge', listening: 'LISTENING',
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
    protocol: 'Protocole', adjustPhase: 'Régler', stabilizePhase: 'Stabiliser', capturePhase: 'Capturer', selectPhase: 'Choisir', placePhase: 'Placer', stampPhase: 'Tamponner', tunePhase: 'Accorder', transmitPhase: 'Transmettre', ackPhase: 'Accusé', listening: 'ÉCOUTE',
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
  root.setAttribute('aria-label', copy[kind]); root.lang = options.language;
  const top = node('header', 'ap-inst-header');
  top.append(node('span', 'ap-inst-serial', copy.station), node('span', 'ap-inst-badge', `AP11 / ${kind === 'survey' ? 'OPT-01' : kind === 'records' ? 'DOC-02' : kind === 'signal' ? 'RF-03' : 'CAM-04'}`));
  const protocol = node('div', 'ap-inst-protocol');
  const phases = kind === 'records' ? [copy.selectPhase, copy.placePhase, copy.stampPhase]
    : kind === 'signal' ? [copy.tunePhase, copy.transmitPhase, copy.ackPhase]
    : [copy.adjustPhase, copy.stabilizePhase, copy.capturePhase];
  const phaseList = node('ol', 'ap-inst-protocol-steps'); phaseList.setAttribute('aria-label', copy.protocol);
  const phaseNodes = phases.map(label => { const item = node('li', 'ap-inst-phase'); item.append(node('i'), node('span', '', label)); item.firstElementChild!.setAttribute('aria-hidden', 'true'); phaseList.append(item); return item; });
  const tally = node('span', 'ap-inst-tally');
  protocol.append(node('span', 'ap-inst-protocol-code', copy.protocol), phaseList, tally);
  let shownPhase = -1, shownComplete = false;
  function showPhase(index: number) {
    if (index === shownPhase && completed === shownComplete) return;
    shownPhase = index; shownComplete = completed;
    root.dataset.phase = String(index);
    phaseNodes.forEach((item, i) => {
      item.dataset.state = completed || i < index ? 'done' : i === index ? 'active' : 'pending';
      if (!completed && i === index) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
  }
  function showTally(count: number, total: number, label: string) {
    const value = `${count} / ${total}`;
    if (tally.textContent !== value) { tally.textContent = value; tally.setAttribute('aria-label', `${label}: ${value}`); }
  }
  showPhase(0);
  root.append(top, protocol, node('h2', 'ap-inst-title', copy[kind]), node('p', 'ap-inst-instructions', copy[`${kind}Help`]));
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
    if (disposed || completed) return; completed = true; root.classList.add('ap-inst-complete'); showPhase(2);
    if (kind === 'survey') showTally(draft.captures.length, surveyTargets.length, copy.progress);
    else if (kind === 'signal') showTally(draft.pulses.length, PULSE_PATTERN.length, copy.pattern);
    if (status) { status.textContent = copy.finish; status.classList.add('ap-inst-status-locked'); }
    if (action) action.disabled = true;
    stage.querySelectorAll('.ap-inst-pulse-active, .ap-inst-pulse-demo, .ap-inst-pulse-next').forEach(pulse => pulse.classList.remove('ap-inst-pulse-active', 'ap-inst-pulse-demo', 'ap-inst-pulse-next'));
    stage.querySelectorAll('.ap-inst-radio-actions button').forEach(button => { button.setAttribute('aria-pressed', 'false'); (button as HTMLButtonElement).disabled = true; });
    say(message); persist();
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
    const gauge = node('div', 'ap-inst-lock'); meter = node('i'); gauge.append(meter); gauge.setAttribute('role', 'progressbar'); gauge.setAttribute('aria-label', copy.hold); gauge.setAttribute('aria-valuemin', '0'); gauge.setAttribute('aria-valuemax', '100'); gauge.setAttribute('aria-valuenow', '0'); viewport.append(gauge); stage.append(viewport);
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
      PULSE_PATTERN.forEach((_, index) => { const pulse = node('span', 'ap-inst-pulse', index === 1 ? '━' : '●'); pulse.setAttribute('aria-label', `${index + 1}: ${index === 1 ? copy.long : copy.short}`); pulseRow.append(pulse); });
      stage.append(node('strong', 'ap-inst-pattern-title', copy.pattern), pulseRow, node('p', 'ap-inst-pulse-help', copy.pulseHelp));
      const row = node('div', 'ap-inst-radio-actions'), replay = node('button', 'ap-inst-replay', copy.replay), key = node('button', 'ap-inst-telegraph', copy.key);
      replay.type = key.type = 'button'; row.append(replay, key); stage.append(row);
      listen(replay, 'click', () => { if(pulseStarted!==null || completed)return; pulseDemo = 0; ensureTone(true); });
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
    const select = (id: string) => { selectedCard = id; cards.forEach(b => { b.classList.toggle('ap-inst-card-selected', b.dataset.card === id); b.setAttribute('aria-pressed', String(b.dataset.card === id)); }); say(`${copy.selected}: ${id}`); renderSlots(); };
    function renderSlots() {
      slots.forEach((b, i) => { const name = [copy.vehicle, copy.platform, copy.time][i]; b.replaceChildren(node('small', '', name), node('strong', '', draft.slots[i] ?? copy.empty)); b.classList.toggle('ap-inst-slot-filled', !!draft.slots[i]); b.classList.toggle('ap-inst-slot-active', i === selectedSlot); b.setAttribute('aria-label', `${name}: ${draft.slots[i] ?? copy.empty}`); });
      cards.forEach(b => b.classList.toggle('ap-inst-card-used', draft.slots.includes(b.dataset.card!)));
      const count = draft.slots.filter(Boolean).length;
      showTally(count, RECORDS.length, copy.slots); showPhase(count === RECORDS.length ? 2 : count || selectedCard ? 1 : 0);
      root.classList.remove('ap-inst-mismatch');
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

  // Drawing helpers use instrument-space coordinates only; control mapping stays in drawOptics.
  function drawShape(ctx: CanvasRenderingContext2D, points: number[][], fill: string, stroke?: string) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function drawLine(ctx: CanvasRenderingContext2D, points: number[][], color: string, weight = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = weight; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  function drawTower(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, towerHeight: number, arms = false) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(scale, 1);
    const top = -towerHeight, bay = towerHeight / 8;
    drawShape(ctx, [[-23, 0], [38, 0], [55, 10], [-9, 10]], '#22362f');
    drawShape(ctx, [[18, 0], [30, -8], [30, top - 8], [18, top]], '#543b32', '#a67a59');
    ctx.fillStyle = '#422f29'; ctx.fillRect(-18, top, 36, towerHeight);
    for (let j = 0; j < 8; j++) {
      const y = top + j * bay;
      drawLine(ctx, [[-16, y], [16, y + bay], [-16, y + bay], [16, y]], '#c38d65', 1.8);
      drawLine(ctx, [[18, y], [30, y - 8], [18, y + bay]], '#95664d', 1);
      ctx.fillStyle = '#c9b08a'; ctx.fillRect(-23, y - 2, 46, 3);
      drawLine(ctx, [[-23, y - 7], [-23, y - 2], [23, y - 2], [23, y - 7]], '#b5b39a');
    }
    ctx.fillStyle = '#b97b55'; ctx.fillRect(-19, top, 4, towerHeight); ctx.fillRect(15, top, 4, towerHeight);
    ctx.fillStyle = '#807d64'; ctx.fillRect(-6, top, 9, towerHeight);
    for (let y = top + 5; y < -3; y += 7) ctx.fillRect(-4, y, 5, 2);
    drawLine(ctx, [[-18, top], [-18, top - 15], [17, top - 15], [17, top]], '#d9c69f', 2);
    drawLine(ctx, [[-3, top - 15], [-3, top - 37], [48, top - 28], [-3, top - 28]], '#c3a77b', 2);
    drawLine(ctx, [[48, top - 28], [48, top - 12]], '#aab3a2');
    if (arms) for (const fraction of [.18, .38, .61, .8]) {
      const y = top * fraction;
      drawShape(ctx, [[18, y], [65, y], [65, y + 4], [18, y + 8]], '#a2987a', '#d0c09e');
      drawLine(ctx, [[23, y - 12], [58, y]], '#b58964', 2);
    }
    ctx.fillStyle = '#8d8e77'; ctx.fillRect(-26, -5, 53, 7); ctx.restore();
  }
  function drawPad(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(scale, scale);
    drawShape(ctx, [[-120, 18], [105, 18], [150, 45], [-153, 45]], '#586351', '#8a9578');
    drawShape(ctx, [[-87, -1], [61, -1], [91, 15], [-110, 15]], '#b4b296', '#d3c9a6');
    drawShape(ctx, [[-110, 15], [91, 15], [91, 31], [-110, 31]], '#697766');
    drawShape(ctx, [[61, -1], [91, 15], [91, 31], [61, 15]], '#4c5b50');
    ctx.fillStyle = '#243831'; ctx.fillRect(-17, 17, 35, 16);
    for (const side of [-1, 1]) {
      drawLine(ctx, [[side * 28, 17], [side * 41, 37], [side * 50, 37]], '#bcb99b', 2);
      drawLine(ctx, [[side * 46, 0], [side * 61, 17], [side * 92, 17]], '#e0d1a8', 1.4);
    }
    drawLine(ctx, [[-105, 11], [-105, 3], [-61, 3], [-61, 11]], '#d2c5a2');
    drawLine(ctx, [[63, 8], [104, 8], [104, 27], [127, 27]], '#9cae9a', 3);
    for (let i = 0; i < 7; i++) drawLine(ctx, [[-91 + i * 4, 18 + i * 2], [-72 + i * 4, 18 + i * 2]], '#c0ba99');
    ctx.fillStyle = '#d9ccb0'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('39A', 46, 28); ctx.restore();
  }
  function drawVab(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, buildingHeight: number) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(scale, 1);
    const top = -buildingHeight;
    drawShape(ctx, [[-67, 0], [71, 0], [106, 19], [-40, 19]], '#233d33');
    drawShape(ctx, [[53, top], [82, top - 15], [82, -13], [53, 0]], '#6d827b', '#9cb0a4');
    drawShape(ctx, [[-53, top], [-24, top - 15], [82, top - 15], [53, top]], '#d8dbcb', '#e7e6ce');
    const wall = ctx.createLinearGradient(-53, 0, 53, 0); wall.addColorStop(0, '#afc1b6'); wall.addColorStop(1, '#d6dac9');
    ctx.fillStyle = wall; ctx.fillRect(-53, top, 106, buildingHeight);
    ctx.fillStyle = '#718c80'; ctx.fillRect(-53, top + 33, 106, buildingHeight - 33);
    for (let i = 0; i < 4; i++) {
      const dx = -47 + i * 25;
      ctx.fillStyle = '#becabd'; ctx.fillRect(dx, top + 35, 18, buildingHeight - 35);
      ctx.fillStyle = '#455f55'; ctx.fillRect(dx + 3, top + 43, 12, buildingHeight - 43);
      for (let y = top + 47; y < -5; y += 8) drawLine(ctx, [[dx + 3, y], [dx + 15, y]], '#81978a');
      ctx.fillStyle = '#dce0ce'; ctx.fillRect(dx - 2, top + 32, 2, buildingHeight - 32);
    }
    for (let i = 1; i < 10; i++) drawLine(ctx, [[53 + i * 3, top - i * 1.55], [53 + i * 3, -i * 1.35]], '#899e92');
    ctx.fillStyle = '#536f63'; ctx.fillRect(-53, -4, 106, 4);
    ctx.fillStyle = '#314e45'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('VAB', -43, top + 23);
    // The 1969 facade: US flag stripes and an understated NASA roundel.
    ctx.fillStyle = '#e4e1c8'; ctx.fillRect(12, top + 9, 29, 17);
    ctx.fillStyle = '#a06c58'; for (let i = 0; i < 6; i++) ctx.fillRect(12, top + 9 + i * 3, 29, 1.5);
    ctx.fillStyle = '#37576a'; ctx.fillRect(12, top + 9, 12, 9);
    ctx.beginPath(); ctx.arc(-7, top + 18, 8, 0, Math.PI * 2); ctx.fill();
    drawLine(ctx, [[-14, top + 23], [0, top + 12]], '#c6a083', 1.5);
    ctx.restore();
  }
  function drawOptics(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const target = surveyTargets[Math.min(draft.captures.length, surveyTargets.length-1)];
    const aligned = kind === 'survey' ? surveyAligned(draft.values, surveyIndex()) : trackingAligned(draft.values);
    const ground = height * .71;
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, '#183947'); sky.addColorStop(.7, '#60877f'); sky.addColorStop(1, '#b1baa0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    // Low coastal horizon and receding service roads give the structures a common scale.
    drawShape(ctx, [[0, ground - 9], [115, ground - 14], [228, ground - 8], [359, ground - 13], [510, ground - 7], [694, ground - 12], [width, ground - 7], [width, ground + 6], [0, ground + 6]], '#4d6b59');
    const field = ctx.createLinearGradient(0, ground, 0, height); field.addColorStop(0, '#65775b'); field.addColorStop(1, '#263f32');
    ctx.fillStyle = field; ctx.fillRect(0, ground, width, height - ground);
    drawShape(ctx, [[width * .45, ground], [width * .51, ground], [width * .87, height], [width * .63, height]], '#6b7560');
    drawLine(ctx, [[width * .48, ground + 6], [width * .73, height]], '#a8ad88', 1.5);
    drawLine(ctx, [[0, height * .83], [width, height * .83]], '#7a8767');
    const focus = draft.values[2], targetFocus = kind === 'survey' ? target.focus : 79;
    ctx.save(); ctx.filter = `blur(${Math.abs(focus - targetFocus) / 14}px)`;
    if (kind === 'survey') {
      const zoom = .65 + draft.values[1] / 80;
      const drawAt = (bearing: number) => width / 2 + (bearing - draft.values[0]) * 13 * zoom;
      drawTower(ctx, drawAt(26), ground, zoom, height * .46, true);
      const rx = drawAt(52);
      drawPad(ctx, rx, ground, zoom);
      drawTower(ctx, rx - 60 * zoom, ground, .62 * zoom, height * .54, true);
      drawRocket(ctx, rx, ground, .76 * zoom);
      drawVab(ctx, drawAt(82), ground, zoom, height * .41);
    } else {
      const rx = width / 2 + (61 - draft.values[0]) * 9, ry = height * .8 + (draft.values[1] - 57) * 4;
      drawPad(ctx, rx, ry, 1);
      drawTower(ctx, rx - 61.5, ry, .48, 210, true);
      drawRocket(ctx, rx, ry, .9);
    }
    ctx.restore();
    // Etched optics stay crisp while the scene itself responds to the existing focus value.
    ctx.strokeStyle = aligned ? '#d5edb6' : '#e6cc94'; ctx.lineWidth = 1;
    const cx = width / 2, cy = height / 2;
    ctx.beginPath(); ctx.moveTo(cx - 40, cy); ctx.lineTo(cx - 10, cy); ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 40, cy); ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy - 10); ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 40); ctx.stroke();
    ctx.globalAlpha = .65;
    for (const side of [-1, 1]) for (const vertical of [-1, 1]) drawLine(ctx, [[cx + side * 70, cy + vertical * 63], [cx + side * 70, cy + vertical * 85], [cx + side * 48, cy + vertical * 85]], aligned ? '#d5edb6' : '#e6cc94');
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#102b27dd'; ctx.fillRect(cx - 250, height - 43, 500, 36);
    ctx.fillStyle = '#e4e7cb'; ctx.font = '16px sans-serif';
    ctx.fillText(kind === 'survey' ? `${draft.captures.length} / ${surveyTargets.length} · ${copy[target.id]}` : 'LC-39A · SATURN V', cx - 235, height - 19, 340);
    for (let i = 0; i <= 4; i++) drawLine(ctx, [[cx + 130 + i * 25, height - 16], [cx + 130 + i * 25, height - (i % 2 ? 24 : 30)]], '#c1caa0');
    ctx.restore();
  }
  function drawRocket(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(scale * .84, scale * .84);
    drawShape(ctx, [[-20, 0], [16, 0], [52, 11], [6, 11]], '#24382f');
    // Stage diameters, tapered interstage, escape tower and five engine bells.
    const hull = ctx.createLinearGradient(-13, 0, 13, 0); hull.addColorStop(0, '#a1b4a9'); hull.addColorStop(.34, '#f5f0d9'); hull.addColorStop(.7, '#dfe2cd'); hull.addColorStop(1, '#839c93');
    ctx.fillStyle = hull; ctx.fillRect(-13, -135, 26, 126); ctx.fillRect(-10, -185, 20, 50);
    drawShape(ctx, [[-13, -135], [-10, -150], [10, -150], [13, -135]], '#e2e3cd', '#95aa9e');
    drawShape(ctx, [[-10, -185], [-6, -204], [6, -204], [10, -185]], '#f0ead2', '#b6c4b3');
    drawShape(ctx, [[-6, -204], [0, -220], [6, -204]], '#e7e4cb');
    drawLine(ctx, [[-3, -214], [-3, -235], [3, -235], [3, -214], [-3, -226], [3, -232]], '#d3d5bb', 1.4);
    ctx.fillStyle = '#e3dec3'; ctx.fillRect(-2, -245, 4, 13);
    ctx.fillStyle = '#263c37'; ctx.fillRect(-13, -58, 26, 14); ctx.fillRect(-10, -168, 20, 8);
    for (const dx of [-11, 3]) { ctx.fillRect(dx, -134, 8, 14); ctx.fillRect(dx, -36, 7, 25); }
    ctx.fillRect(-4, -110, 8, 37);
    for (const y of [-140, -120, -65, -41, -10]) drawLine(ctx, [[-13, y], [13, y]], '#7e968b');
    for (const dx of [-9, -5, 5, 9]) drawLine(ctx, [[dx, -43], [dx, -13]], '#95a99a', .7);
    drawShape(ctx, [[-13, -25], [-24, 0], [-13, -5]], '#d6ddc7', '#849c8e');
    drawShape(ctx, [[13, -25], [24, 0], [13, -5]], '#a8baac', '#728b80');
    for (const dx of [-10, 0, 10]) drawShape(ctx, [[dx - 3, -9], [dx + 3, -9], [dx + 5, 0], [dx - 5, 0]], '#263c36', '#8b9b85');
    // Tiny stage markings are painted geometry, so no new untranslated UI text is introduced.
    ctx.fillStyle = '#a66d54'; ctx.fillRect(5, -97, 3, 17); ctx.fillRect(-7, -159, 5, 4);
    ctx.restore();
  }
  function drawSignal(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save(); ctx.fillStyle = '#091e1b'; ctx.fillRect(0, 0, width, height);
    const view = ctx.canvas.getBoundingClientRect();
    const inset = 8 + (view.width > 0 ? Math.max(0, (height - width * view.height / view.width) / 2) : 0);
    ctx.translate(0, inset); ctx.scale(1, Math.max(.1, (height - 2 * inset) / height));
    // Keep labels and measurements inside the portion visible when mobile uses object-fit: cover.
    const left = 150, right = width - 150, plotLeft = left + 8, plotRight = right - 8;
    const frequencyError = draft.values[0] - 67, gainError = draft.values[1] - 73;
    const quality = Math.round(Math.max(0, 100 - Math.abs(frequencyError) * 3 - Math.abs(gainError) * 2));
    const number = new Intl.NumberFormat(options.language, {maximumFractionDigits: 2});
    const signed = (value: number) => `${value > 0 ? '+' : ''}${number.format(value)}`;
    ctx.fillStyle = '#102b25'; ctx.fillRect(left - 12, 11, right - left + 24, 224);
    for (let x = plotLeft; x <= plotRight; x += (plotRight - plotLeft) / 14) drawLine(ctx, [[x, 45], [x, 230]], '#254b3e');
    for (const y of [66, 94, 122, 162, 190, 218]) drawLine(ctx, [[plotLeft, y], [plotRight, y]], '#254b3e');
    for (const y of [94, 190]) drawLine(ctx, [[plotLeft, y], [plotRight, y]], '#5a7d60');
    const drawWave = (color: string, frequency: number, amplitude: number, phase: number, baseline: number, dashed = false) => {
      ctx.strokeStyle = color; ctx.lineWidth = dashed ? 1.8 : 2.5; ctx.setLineDash(dashed ? [5, 5] : []); ctx.beginPath();
      for (let x = 0; x <= plotRight - plotLeft; x += 1) {
        const y = baseline + Math.sin(x / (plotRight - plotLeft) * Math.PI * frequency + phase) * amplitude;
        if (!x) ctx.moveTo(plotLeft, y); else ctx.lineTo(plotLeft + x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    // A static reference and a dashed copy behind the received trace reveal phase/amplitude error.
    const drift = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : frequencyError * .015 * clock;
    drawWave('#a9c7b1', 14, 28, 0, 94);
    drawWave('#6a987e', 14, 28, 0, 190, true);
    drawWave('#f2d18b', 14 + frequencyError * .1, draft.values[1] * 28 / 73, drift, 190);
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#c4dcc6'; ctx.fillText(copy.referenceSignal, left, 34);
    ctx.textAlign = 'right'; ctx.fillText(`${copy.frequency} 67 · ${copy.gain} 73`, right, 34); ctx.textAlign = 'left';
    // The channel label sits in the gap, never on a waveform peak.
    ctx.fillStyle = '#102b25'; ctx.fillRect(left - 1, 124, right - left + 2, 24);
    ctx.fillStyle = '#f2d18b'; ctx.fillText(copy.receivedSignal, left, 146);
    ctx.textAlign = 'right'; ctx.fillText(`Δ ${copy.frequency} ${signed(frequencyError)} · ${copy.gain} ${signed(gainError)}`, right, 146); ctx.textAlign = 'left';
    // Brackets compare actual amplitude with the fixed reference without changing tuning rules.
    for (const [y, amplitude, color] of [[94, 28, '#a9c7b1'], [190, draft.values[1] * 28 / 73, '#f2d18b']] as const) {
      drawLine(ctx, [[right + 4, y - amplitude], [right + 12, y - amplitude], [right + 12, y + amplitude], [right + 4, y + amplitude]], color, 1.5);
    }
    const bottom = height - 18;
    ctx.fillStyle = '#dce7bc'; ctx.font = '18px sans-serif'; ctx.fillText(`${copy.quality}: ${quality}%`, left, bottom);
    ctx.fillStyle = '#284a39'; ctx.fillRect(left, bottom - 43, 200, 8);
    ctx.fillStyle = signalAligned(draft.values) ? '#c6e6a3' : '#d9b77c'; ctx.fillRect(left, bottom - 43, 2 * quality, 8);
    let px = left + 280;
    for (let i = 0; i < PULSE_PATTERN.length; i++) {
      const length = PULSE_PATTERN[i] * 150;
      drawLine(ctx, [[px, bottom - 28], [px, bottom - 51], [px + length, bottom - 51], [px + length, bottom - 28]], '#a9c7b1', 2);
      // Measured holds use the same time scale as the reference, including an in-progress hold.
      const duration = draft.pulses[i] ?? (pulseStarted !== null && i === draft.pulses.length ? (performance.now() - pulseStarted) / 1000 : 0);
      if (duration > 0) {
        ctx.fillStyle = '#f2d18b'; ctx.fillRect(px, bottom - 44, Math.min(duration * 150, length + 18), 9);
      }
      ctx.fillStyle = '#c4dcc6'; ctx.font = '16px sans-serif'; ctx.fillText(`${number.format(PULSE_PATTERN[i])} s`, px, bottom);
      px += length + 28;
    }
    ctx.restore();
  }
  function frame(now: number) {
    if (disposed || completed) return;
    const dt = document.hidden ? 0 : Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now; clock += dt;
    if (kind !== 'records') {
      const aligned = kind === 'survey' ? surveyAligned(draft.values, surveyIndex()) : kind === 'tracking' ? trackingAligned(draft.values) : signalAligned(draft.values);
      const previousLock = locked; lock = advanceInstrumentLock(lock, aligned, dt, requiredLock); locked = lock >= requiredLock;
      if (meter) {
        meter.style.transform = `scaleX(${lock / requiredLock})`;
        const percent = String(Math.round(lock / requiredLock * 100));
        if (meter.parentElement!.getAttribute('aria-valuenow') !== percent) meter.parentElement!.setAttribute('aria-valuenow', percent);
      }
      showPhase(kind === 'signal' ? locked ? 1 : 0 : locked ? 2 : lock > 0 ? 1 : 0);
      if (kind === 'survey') showTally(draft.captures.length, surveyTargets.length, copy.progress);
      if (kind === 'signal') showTally(draft.pulses.length, PULSE_PATTERN.length, copy.pattern);
      status!.textContent = pulseDemo >= 0 ? copy.listening : pulseStarted !== null ? copy.transmitting : locked ? kind === 'signal' ? copy.locked : copy.stable : `${copy.aligning} · ${Math.round(lock / requiredLock * 100)}%`;
      status!.classList.toggle('ap-inst-status-locked', locked);
      targetText!.textContent = kind === 'survey' ? `${copy.target} · ${copy[surveyTargets[Math.min(draft.captures.length, surveyTargets.length-1)].id]}` : kind === 'tracking' ? 'SATURN V · LC-39A' : copy.tune;
      if (action) action.disabled = !locked;
      let demoIndex = -1;
      if (kind === 'signal') {
        const key = stage.querySelector<HTMLButtonElement>('.ap-inst-telegraph')!;
        key.setAttribute('aria-disabled', String(!locked));
        key.setAttribute('aria-pressed', String(pulseStarted !== null));
        const replay = stage.querySelector<HTMLButtonElement>('.ap-inst-replay')!;
        replay.setAttribute('aria-pressed', String(pulseDemo >= 0));
        if (locked && !previousLock) say(copy.readyPulse);
        if (!aligned && draft.pulses.length) { draft.pulses = []; persist(); [...stage.querySelectorAll('.ap-inst-pulse')].forEach(n => n.classList.remove('ap-inst-pulse-done')); }
        if (pulseStarted !== null) {
          if (!aligned || document.hidden) { pulseStarted = null; stopTone(); stage.querySelector('.ap-inst-telegraph')?.classList.remove('ap-inst-key-down'); say(copy.pulseLost, true); }
        }
        if (pulseDemo >= 0) {
          pulseDemo += dt; const t = pulseDemo;
          demoIndex = t < .28 ? 0 : t > .58 && t < 1.4 ? 1 : t > 1.7 && t < 1.98 ? 2 : -1;
          ensureTone(demoIndex >= 0); if (t > 2.1) { pulseDemo = -1; stopTone(); }
        }
      }
      if (kind === 'signal') {
        stage.querySelectorAll<HTMLElement>('.ap-inst-pulse').forEach((pulse, i) => {
          const active = pulseStarted !== null && i === draft.pulses.length;
          pulse.classList.toggle('ap-inst-pulse-active', active);
          pulse.classList.toggle('ap-inst-pulse-next', locked && i === draft.pulses.length);
          pulse.classList.toggle('ap-inst-pulse-demo', i === demoIndex);
          pulse.classList.toggle('ap-inst-pulse-done', i < draft.pulses.length);
          pulse.style.setProperty('--pulse-fill', active ? `${Math.min(100, (now - pulseStarted!) / (PULSE_PATTERN[i] * 1000) * 100)}%` : '0%');
        });
      }
      if (context && canvas) { if (kind === 'signal') drawSignal(context, canvas.width, canvas.height); else drawOptics(context, canvas.width, canvas.height); }
    }
    raf = requestAnimationFrame(frame);
  }
  listen(document, 'visibilitychange', () => { lastFrame = performance.now(); if (document.hidden) { stopTone(); pulseStarted = null; pulseDemo=-1; stage.querySelector('.ap-inst-telegraph')?.classList.remove('ap-inst-key-down'); } });
  if (kind === 'survey') showTally(draft.captures.length, surveyTargets.length, copy.progress);
  if (kind === 'signal') showTally(draft.pulses.length, PULSE_PATTERN.length, copy.pattern);
  persist(); raf = requestAnimationFrame(frame);
  return { dispose, snapshot };
}
