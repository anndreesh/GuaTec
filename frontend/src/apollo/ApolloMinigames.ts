import { getLanguage } from '@/core/i18n';
import './apollo-minigames.css';

/**
 * Hands-on checkpoint tasks for Mission 01. Each game is a self-contained DOM/SVG/canvas widget that is
 * mounted inside the screen's modal, reports a win once, and cleans up every timer and listener on dispose.
 * Every visible string is a [es, en, fr] triplet that is re-evaluated on refresh() so the language can
 * change while a game is open.
 */
export type MinigameId = 'wiring' | 'card' | 'dish' | 'sequence' | 'telemetry';

/** Checkpoint id → minigame that completes it. */
export const MINIGAME_BY_CHECKPOINT: Readonly<Record<string, MinigameId>> = {
  wiring: 'wiring', tracking: 'dish', card: 'card', sequence: 'sequence', telemetry: 'telemetry',
};

export interface MinigameHandle { dispose(): void; refresh(): void }
export interface MinigameOptions { onWin(): void; onExit(): void }

type L3 = readonly [string, string, string];
const langIndex = (): 0 | 1 | 2 => ({ es: 0, en: 1, fr: 2 } as const)[getLanguage()];
const T = (value: L3): string => value[langIndex()];

const EXIT: L3 = ['Salir', 'Exit', 'Quitter'];
const SVG_NS = 'http://www.w3.org/2000/svg';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: Element): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  parent?.appendChild(node);
  return node;
}
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.appendChild(node);
  return node;
}
function shuffle<A>(items: A[]): A[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const range = (min: number, max: number) => min + Math.random() * (max - min);

/** Shared chrome: title, help, stage, live status line, exit button, timers and cleanup. */
class Frame {
  readonly root = h('div', 'mg');
  readonly stage = h('div', 'mg-stage');
  private labels: Array<{ node: Element; fn: () => string }> = [];
  private statusEl = h('p', 'mg-status');
  private statusFn: (() => string) | null = null;
  private cleanups: Array<() => void> = [];
  private timers = new Set<number>();
  private won = false;
  disposed = false;

  constructor(host: HTMLElement, title: L3, help: L3, private readonly opts: MinigameOptions) {
    const head = h('div', 'mg-head', this.root);
    this.text(h('h2', '', head), title);
    this.text(h('p', 'mg-help', head), help);
    this.root.append(this.stage);
    const foot = h('div', 'mg-foot', this.root);
    this.statusEl.setAttribute('aria-live', 'polite');
    foot.append(this.statusEl);
    const exit = h('button', 'ap-button mg-exit', foot);
    exit.type = 'button';
    this.text(exit, EXIT);
    exit.addEventListener('click', () => this.opts.onExit());
    host.append(this.root);
  }
  text<E extends Element>(node: E, value: L3 | (() => string)): E {
    const fn = typeof value === 'function' ? value : () => T(value);
    this.labels.push({ node, fn });
    node.textContent = fn();
    return node;
  }
  status(value: L3 | (() => string) | null, kind: '' | 'ok' | 'bad' = ''): void {
    this.statusFn = value === null ? null : typeof value === 'function' ? value : () => T(value);
    this.statusEl.className = `mg-status ${kind}`.trim();
    this.statusEl.textContent = this.statusFn ? this.statusFn() : '';
  }
  refresh(): void {
    for (const label of this.labels) label.node.textContent = label.fn();
    if (this.statusFn) this.statusEl.textContent = this.statusFn();
  }
  own(fn: () => void): void { this.cleanups.push(fn); }
  later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => { this.timers.delete(id); if (!this.disposed) fn(); }, ms);
    this.timers.add(id);
  }
  listen(target: EventTarget, type: string, handler: (event: any) => void): void {
    target.addEventListener(type, handler);
    this.own(() => target.removeEventListener(type, handler));
  }
  /** Reports success exactly once, after a short beat so the confirmation is visible. */
  win(message: L3 | (() => string)): void {
    if (this.won || this.disposed) return;
    this.won = true;
    this.root.classList.add('mg-won');
    this.status(message, 'ok');
    this.later(() => this.opts.onWin(), 1000);
  }
  dispose(): void {
    this.disposed = true;
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.root.remove();
  }
}

/** Converts a pointer event to the SVG's own coordinate system (robust to letterboxing). */
function svgPoint(svg: SVGSVGElement, event: PointerEvent): { x: number; y: number } {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const p = svg.createSVGPoint();
  p.x = event.clientX; p.y = event.clientY;
  const q = p.matrixTransform(matrix.inverse());
  return { x: q.x, y: q.y };
}

// ============================================================================ 1 · WIRING
const WIRES: ReadonlyArray<{ color: string; glyph: string; name: L3 }> = [
  { color: '#ef4444', glyph: '●', name: ['Rojo', 'Red', 'Rouge'] },
  { color: '#3b82f6', glyph: '■', name: ['Azul', 'Blue', 'Bleu'] },
  { color: '#facc15', glyph: '▲', name: ['Amarillo', 'Yellow', 'Jaune'] },
  { color: '#d946ef', glyph: '◆', name: ['Magenta', 'Magenta', 'Magenta'] },
  { color: '#22c55e', glyph: '★', name: ['Verde', 'Green', 'Vert'] },
];
const WIRING_TEXT = {
  title: ['Panel de enlace · conecta los cables', 'Link panel · connect the wires', 'Panneau de liaison · connectez les câbles'] as L3,
  help: ['Arrastra cada cable de la izquierda al borne del mismo color a la derecha. Tres conexiones erróneas provocan un cortocircuito y el panel se reinicia.', 'Drag each wire from the left to the terminal of the same color on the right. Three wrong connections cause a short circuit and the panel resets.', 'Faites glisser chaque câble de gauche vers la borne de même couleur à droite. Trois mauvaises connexions provoquent un court-circuit et le panneau se réinitialise.'] as L3,
  wrong: ['Conexión incorrecta', 'Wrong connection', 'Mauvaise connexion'] as L3,
  short: ['Cortocircuito: panel reiniciado', 'Short circuit: panel reset', 'Court-circuit : panneau réinitialisé'] as L3,
  ok: ['Enlace restablecido', 'Link restored', 'Liaison rétablie'] as L3,
  wires: ['Cables', 'Wires', 'Câbles'] as L3,
  errors: ['Errores', 'Mistakes', 'Erreurs'] as L3,
};

function wiring(f: Frame): void {
  const W = 600, H = 330, N = WIRES.length, LX = 92, RX = W - 92;
  const ys = Array.from({ length: N }, (_, i) => 46 + i * ((H - 92) / (N - 1)));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mg-svg' }, f.stage);
  let left: number[] = [], right: number[] = [], linked: Array<number | null> = [];
  let errors = 0, connected = 0, drag: { k: number; x: number; y: number } | null = null, done = false;
  let message: L3 | null = null;

  const deal = () => {
    left = shuffle(WIRES.map((_, i) => i));
    do { right = shuffle(WIRES.map((_, i) => i)); } while (right.filter((w, k) => w === left[k]).length > 1);
    linked = left.map(() => null);
    connected = 0; errors = 0;
  };
  const report = () => f.status(
    () => (message ? `${T(message)} · ` : '') + `${T(WIRING_TEXT.wires)} ${connected}/${N} · ${T(WIRING_TEXT.errors)} ${errors}/3`,
    message === WIRING_TEXT.wrong || message === WIRING_TEXT.short ? 'bad' : '');
  const path = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    const dx = Math.max(60, Math.abs(x2 - x1) * 0.45);
    const d = `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
    s('path', { d, class: 'mg-wire-shadow' }, svg);
    s('path', { d, class: 'mg-wire', stroke: color }, svg);
    s('path', { d, class: 'mg-wire-shine' }, svg);
  };
  const terminal = (x: number, y: number, wire: number, lit: boolean, ledX: number, textX: number) => {
    const g = s('g', { class: lit ? 'mg-term mg-lit' : 'mg-term' }, svg);
    s('rect', { x, y: y - 14, width: 32, height: 28, rx: 6, fill: WIRES[wire].color }, g);
    s('text', { x: textX, y: y + 1, class: 'mg-glyph' }, g).textContent = WIRES[wire].glyph;
    s('circle', { cx: ledX, cy: y, r: 3.5, class: 'mg-led' }, g);
    s('title', {}, g).textContent = T(WIRES[wire].name);
  };
  const draw = () => {
    svg.replaceChildren();
    s('rect', { x: 2, y: 2, width: W - 4, height: H - 4, rx: 12, class: 'mg-plate' }, svg);
    for (const [bx, by] of [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18]]) s('circle', { cx: bx, cy: by, r: 5, class: 'mg-bolt' }, svg);
    s('rect', { x: 18, y: 28, width: 82, height: H - 56, rx: 9, class: 'mg-housing' }, svg);
    s('rect', { x: W - 100, y: 28, width: 82, height: H - 56, rx: 9, class: 'mg-housing' }, svg);
    linked.forEach((r, k) => { if (r !== null) path(LX, ys[k], RX, ys[r], WIRES[left[k]].color); });
    if (drag) path(LX, ys[drag.k], drag.x, drag.y, WIRES[left[drag.k]].color);
    left.forEach((w, k) => terminal(LX - 32, ys[k], w, linked[k] !== null, LX - 44, LX - 16));
    right.forEach((w, r) => terminal(RX, ys[r], w, linked.includes(r), RX + 44, RX + 16));
  };
  const shake = () => {
    svg.classList.remove('mg-shake'); void svg.getBoundingClientRect(); svg.classList.add('mg-shake');
    f.later(() => svg.classList.remove('mg-shake'), 450);
  };

  f.listen(svg, 'pointerdown', (e: PointerEvent) => {
    if (done) return;
    const p = svgPoint(svg, e);
    const k = ys.findIndex(y => Math.hypot(p.x - (LX - 16), p.y - y) < 28);
    if (k < 0 || linked[k] !== null) return;
    drag = { k, x: p.x, y: p.y };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault(); draw();
  });
  f.listen(svg, 'pointermove', (e: PointerEvent) => {
    if (!drag) return;
    const p = svgPoint(svg, e);
    drag.x = clamp(p.x, 10, W - 10); drag.y = clamp(p.y, 10, H - 10); draw();
  });
  f.listen(svg, 'pointerup', (e: PointerEvent) => {
    if (!drag) return;
    const p = svgPoint(svg, e), d = drag; drag = null;
    const r = ys.findIndex(y => Math.hypot(p.x - (RX + 16), p.y - y) < 28);
    if (r >= 0 && !linked.includes(r)) {
      if (left[d.k] === right[r]) {
        linked[d.k] = r; connected += 1; message = null;
        if (connected === N) { done = true; draw(); f.win(WIRING_TEXT.ok); return; }
      } else {
        errors += 1; message = WIRING_TEXT.wrong; shake();
        if (errors >= 3) {
          message = WIRING_TEXT.short; done = true;
          f.later(() => { deal(); done = false; message = WIRING_TEXT.short; draw(); report(); }, 700);
        }
      }
    }
    draw(); report();
  });
  f.listen(svg, 'pointercancel', () => { drag = null; draw(); });
  deal(); draw(); report();
}

// ============================================================================ 2 · CARD SWIPE
const CARD_TEXT = {
  title: ['Control de acceso · desliza la tarjeta', 'Access control · swipe the card', 'Contrôle d’accès · passez la carte'] as L3,
  help: ['Arrastra la tarjeta por la ranura de izquierda a derecha, en línea recta y a velocidad media: ni demasiado rápido ni demasiado lento. Se necesitan dos lecturas válidas seguidas.', 'Drag the card through the slot from left to right, in a straight line and at a medium speed: not too fast, not too slow. Two valid reads in a row are required.', 'Faites glisser la carte dans la fente de gauche à droite, en ligne droite et à vitesse moyenne : ni trop vite ni trop lentement. Deux lectures valides consécutives sont nécessaires.'] as L3,
  idle: ['Inserta la tarjeta', 'Insert the card', 'Insérez la carte'] as L3,
  fast: ['Demasiado rápido', 'Too fast', 'Trop rapide'] as L3,
  slow: ['Demasiado lento', 'Too slow', 'Trop lent'] as L3,
  bad: ['Lectura incompleta. Mantén la tarjeta dentro de la ranura.', 'Incomplete read. Keep the card inside the slot.', 'Lecture incomplète. Gardez la carte dans la fente.'] as L3,
  one: ['Lectura válida · una más', 'Valid read · one more', 'Lecture valide · encore une'] as L3,
  granted: ['Acceso concedido', 'Access granted', 'Accès accordé'] as L3,
  reads: ['Lecturas válidas', 'Valid reads', 'Lectures valides'] as L3,
  badge: ['TÉCNICO DE APOYO', 'SUPPORT TECHNICIAN', 'TECHNICIEN DE SOUTIEN'] as L3,
  screenIdle: ['LISTO', 'READY', 'PRÊT'] as L3,
  screenOk: ['ACEPTADA', 'ACCEPTED', 'ACCEPTÉE'] as L3,
  screenBad: ['RECHAZADA', 'REJECTED', 'REFUSÉE'] as L3,
};

function card(f: Frame): void {
  const MIN = 0.55, MAX = 1.0, NEED = 2;
  const reader = h('div', 'mg-reader', f.stage);
  const display = h('div', 'mg-display', reader);
  const led = h('span', 'mg-ledlamp', display);
  const screen = h('b', '', display);
  const track = h('div', 'mg-track', reader);
  h('div', 'mg-slot', track);
  const cardEl = h('div', 'mg-card', track);
  h('div', 'mg-card-chip', cardEl);
  h('div', 'mg-card-stripe', cardEl);
  h('b', 'mg-card-brand', cardEl).textContent = 'APOLLO 11';
  f.text(h('small', 'mg-card-badge', cardEl), CARD_TEXT.badge);
  const progress = h('div', 'mg-reads', reader);

  let reads = 0, screenText: L3 = CARD_TEXT.screenIdle;
  let grab = 0, startY = 0, t0: number | null = null, finished = false, active = false, x = 0;
  const geom = () => {
    const tr = track.getBoundingClientRect(), cr = cardEl.getBoundingClientRect();
    return { left: tr.left, maxX: Math.max(1, tr.width - cr.width) };
  };
  const setCard = (px: number, dy: number, animate: boolean) => {
    cardEl.style.transition = animate ? 'transform .28s ease' : 'none';
    cardEl.style.transform = `translate(${px}px, ${dy}px)`;
  };
  const paint = (state: '' | 'ok' | 'bad') => {
    led.className = `mg-ledlamp ${state}`.trim();
    screenText = state === 'ok' ? CARD_TEXT.screenOk : state === 'bad' ? CARD_TEXT.screenBad : CARD_TEXT.screenIdle;
    screen.textContent = T(screenText);
  };
  f.text(progress, () => `${T(CARD_TEXT.reads)}: ${reads}/${NEED}`);
  f.text(screen, () => T(screenText));
  f.status(CARD_TEXT.idle);

  const fail = (message: L3, seconds?: number) => {
    reads = 0; finished = true; paint('bad');
    f.status(() => T(message) + (seconds !== undefined ? ` (${seconds.toFixed(2)} s)` : ''), 'bad');
    progress.textContent = `${T(CARD_TEXT.reads)}: ${reads}/${NEED}`;
  };
  const evaluate = (seconds: number) => {
    finished = true;
    if (seconds < MIN) { fail(CARD_TEXT.fast, seconds); return; }
    if (seconds > MAX) { fail(CARD_TEXT.slow, seconds); return; }
    reads += 1; paint('ok');
    progress.textContent = `${T(CARD_TEXT.reads)}: ${reads}/${NEED}`;
    if (reads >= NEED) f.win(CARD_TEXT.granted);
    else f.status(() => `${T(CARD_TEXT.one)} (${seconds.toFixed(2)} s)`, 'ok');
  };

  f.listen(cardEl, 'pointerdown', (e: PointerEvent) => {
    if (f.disposed || reads >= NEED) return;
    const g = geom();
    active = true; finished = false; t0 = null; startY = e.clientY;
    grab = e.clientX - (g.left + x);
    cardEl.setPointerCapture(e.pointerId);
    paint(''); f.status(CARD_TEXT.idle);
    e.preventDefault();
  });
  f.listen(cardEl, 'pointermove', (e: PointerEvent) => {
    if (!active) return;
    const g = geom();
    x = clamp(e.clientX - g.left - grab, 0, g.maxX);
    const dy = clamp(e.clientY - startY, -70, 70);
    setCard(x, dy, false);
    if (finished) return;
    if (x >= 0.18 * g.maxX && t0 === null) t0 = performance.now();
    if (t0 !== null && Math.abs(dy) > 38) { fail(CARD_TEXT.bad); return; }
    if (t0 !== null && x >= 0.82 * g.maxX) evaluate((performance.now() - t0) / 1000);
  });
  const end = () => {
    if (!active) return;
    active = false;
    if (!finished && t0 !== null) fail(CARD_TEXT.bad);
    x = 0; setCard(0, 0, true);
    if (reads < NEED) f.later(() => { if (reads < NEED && !active) paint(''); }, 700);
  };
  f.listen(cardEl, 'pointerup', end);
  f.listen(cardEl, 'pointercancel', end);
}

// ============================================================================ 3 · ANTENNA ALIGNMENT
const DISH_TEXT = {
  title: ['Seguimiento · alinea la antena', 'Tracking · align the antenna', 'Poursuite · alignez l’antenne'] as L3,
  help: ['Ajusta azimut y elevación hasta captar la señal y mantén el enlace fijo 3 segundos. La fuente se desplaza lentamente: corrige sin pasarte.', 'Adjust azimuth and elevation until you pick up the signal and hold the lock for 3 seconds. The source drifts slowly: correct without overshooting.', 'Réglez l’azimut et l’élévation jusqu’à capter le signal et maintenez le verrouillage 3 secondes. La source dérive lentement : corrigez sans dépasser.'] as L3,
  az: ['Azimut', 'Azimuth', 'Azimut'] as L3,
  el: ['Elevación', 'Elevation', 'Élévation'] as L3,
  signal: ['Señal', 'Signal', 'Signal'] as L3,
  lock: ['Enlace', 'Lock', 'Verrouillage'] as L3,
  searching: ['Buscando señal…', 'Searching for signal…', 'Recherche du signal…'] as L3,
  weak: ['Señal débil · sigue ajustando', 'Weak signal · keep adjusting', 'Signal faible · continuez à ajuster'] as L3,
  locking: ['Enlace estable… mantén la posición', 'Locking… hold position', 'Verrouillage… maintenez la position'] as L3,
  ok: ['Enlace fijado', 'Lock achieved', 'Verrouillage obtenu'] as L3,
};

function dish(f: Frame): void {
  const LOCK_TIME = 3, THRESHOLD = 0.85;
  const grid = h('div', 'mg-dish', f.stage);
  const dials = h('div', 'mg-dials', grid);
  const compass = s('svg', { viewBox: '0 0 240 240', class: 'mg-dial' }, dials);
  s('circle', { cx: 120, cy: 120, r: 108, class: 'mg-ring' }, compass);
  for (let a = 0; a < 360; a += 15) {
    const r1 = a % 90 === 0 ? 92 : 100, rad = a * Math.PI / 180;
    s('line', { x1: 120 + Math.sin(rad) * r1, y1: 120 - Math.cos(rad) * r1, x2: 120 + Math.sin(rad) * 108, y2: 120 - Math.cos(rad) * 108, class: 'mg-tick' }, compass);
  }
  for (const a of [0, 90, 180, 270]) {
    const rad = a * Math.PI / 180;
    s('text', { x: 120 + Math.sin(rad) * 76, y: 120 - Math.cos(rad) * 76 + 4, class: 'mg-dial-label' }, compass).textContent = String(a);
  }
  const arrow = s('g', {}, compass);
  s('path', { d: 'M120 120 L104 34 A92 92 0 0 1 136 34 Z', class: 'mg-beam' }, arrow);
  s('line', { x1: 120, y1: 120, x2: 120, y2: 30, class: 'mg-needle' }, arrow);
  s('circle', { cx: 120, cy: 26, r: 8, class: 'mg-dish-head' }, arrow);
  s('circle', { cx: 120, cy: 120, r: 7, class: 'mg-hub' }, compass);

  const elevation = s('svg', { viewBox: '0 0 240 130', class: 'mg-dial mg-dial-el' }, dials);
  s('path', { d: 'M30 118 A100 100 0 0 1 130 18', class: 'mg-arc' }, elevation);
  for (let a = 0; a <= 90; a += 15) {
    const rad = a * Math.PI / 180;
    s('line', { x1: 30 + Math.cos(rad) * 90, y1: 118 - Math.sin(rad) * 90, x2: 30 + Math.cos(rad) * 100, y2: 118 - Math.sin(rad) * 100, class: 'mg-tick' }, elevation);
  }
  const elNeedle = s('line', { x1: 30, y1: 118, x2: 120, y2: 118, class: 'mg-needle' }, elevation);
  s('circle', { cx: 30, cy: 118, r: 6, class: 'mg-hub' }, elevation);

  const panel = h('div', 'mg-panel', grid);
  const scope = h('canvas', 'mg-scope', panel);
  scope.width = 520; scope.height = 130;
  const sctx = scope.getContext('2d');

  const meter = (label: L3, cls: string) => {
    const row = h('div', 'mg-meter', panel);
    f.text(h('span', '', row), label);
    const fill = h('i', '', h('div', `mg-bar ${cls}`, row));
    const value = h('em', '', row);
    return { fill, value };
  };
  const sig = meter(DISH_TEXT.signal, 'sig');
  const lockMeter = meter(DISH_TEXT.lock, 'lock');

  let az = 0, el = 12;
  const slider = (label: L3, min: number, max: number, step: number, init: number, unit: string, set: (v: number) => void) => {
    const row = h('div', 'mg-slider', panel);
    const head = h('div', 'mg-slider-head', row);
    f.text(h('span', '', head), label);
    const out = h('b', '', head);
    const line = h('div', 'mg-slider-line', row);
    const minus = h('button', 'ap-button mg-step', line); minus.type = 'button'; minus.textContent = '−';
    const input = h('input', '', line); input.type = 'range';
    input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(init);
    const plus = h('button', 'ap-button mg-step', line); plus.type = 'button'; plus.textContent = '+';
    const apply = (v: number) => { const next = clamp(v, min, max); input.value = String(next); set(next); out.textContent = `${next.toFixed(1)}${unit}`; };
    f.listen(input, 'input', () => apply(Number(input.value)));
    f.listen(minus, 'click', () => apply(Number(input.value) - 1));
    f.listen(plus, 'click', () => apply(Number(input.value) + 1));
    apply(init);
  };

  const base = { az: range(40, 320), el: range(28, 68) };
  const startAz = Math.round(((base.az + 180) % 360) * 2) / 2;
  slider(DISH_TEXT.az, 0, 360, 0.5, startAz, '°', v => { az = v; });
  slider(DISH_TEXT.el, 0, 90, 0.5, 12, '°', v => { el = v; });

  let lock = 0, state: 'search' | 'weak' | 'lock' | 'done' = 'search', last = performance.now(), raf = 0;
  f.status(DISH_TEXT.searching);
  const setState = (next: typeof state) => {
    if (next === state) return;
    state = next;
    if (next === 'search') f.status(DISH_TEXT.searching);
    else if (next === 'weak') f.status(DISH_TEXT.weak);
    else if (next === 'lock') f.status(DISH_TEXT.locking);
  };
  const loop = (now: number) => {
    if (f.disposed || state === 'done') return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const t = now / 1000;
    const taz = base.az + 6 * Math.sin(t * 0.5), tel = base.el + 2.5 * Math.cos(t * 0.41);
    const da = ((az - taz + 540) % 360) - 180, de = el - tel;
    const strength = Math.exp(-((da / 16) ** 2 + (de / 8) ** 2));
    if (strength > THRESHOLD) lock = Math.min(LOCK_TIME, lock + dt); else lock = Math.max(0, lock - dt * 1.5);
    arrow.setAttribute('transform', `rotate(${az} 120 120)`);
    const er = el * Math.PI / 180;
    elNeedle.setAttribute('x2', String(30 + Math.cos(er) * 90)); elNeedle.setAttribute('y2', String(118 - Math.sin(er) * 90));
    sig.fill.style.width = `${(strength * 100).toFixed(0)}%`; sig.value.textContent = `${Math.round(strength * 100)}%`;
    lockMeter.fill.style.width = `${(lock / LOCK_TIME * 100).toFixed(0)}%`; lockMeter.value.textContent = `${lock.toFixed(1)} s`;
    if (sctx) {
      sctx.fillStyle = '#06161a'; sctx.fillRect(0, 0, 520, 130);
      sctx.strokeStyle = '#1f3d42'; sctx.lineWidth = 1;
      for (let gx = 0; gx <= 520; gx += 40) { sctx.beginPath(); sctx.moveTo(gx, 0); sctx.lineTo(gx, 130); sctx.stroke(); }
      for (let gy = 0; gy <= 130; gy += 26) { sctx.beginPath(); sctx.moveTo(0, gy); sctx.lineTo(520, gy); sctx.stroke(); }
      sctx.strokeStyle = strength > THRESHOLD ? '#8ee0a6' : strength > 0.4 ? '#f4be67' : '#6fb7c4'; sctx.lineWidth = 2; sctx.beginPath();
      for (let px = 0; px <= 520; px += 2) {
        const noise = (Math.sin(px * 0.9 + t * 13) + Math.sin(px * 0.37 - t * 9) + (Math.random() - 0.5) * 1.6) * 16 * (1 - strength * 0.92);
        const y = 65 + Math.sin(px * 0.06 + t * 6) * 40 * strength + noise;
        if (px === 0) sctx.moveTo(px, y); else sctx.lineTo(px, y);
      }
      sctx.stroke();
    }
    if (lock >= LOCK_TIME) { state = 'done'; f.win(DISH_TEXT.ok); return; }
    setState(lock > 0 ? 'lock' : strength > 0.3 ? 'weak' : 'search');
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  f.own(() => cancelAnimationFrame(raf));
}

// ============================================================================ 4 · SEQUENCE
const PADS: ReadonlyArray<{ color: string; glyph: string; freq: number }> = [
  { color: '#ef4444', glyph: '▲', freq: 262 }, { color: '#3b82f6', glyph: '●', freq: 330 }, { color: '#facc15', glyph: '■', freq: 392 },
  { color: '#22c55e', glyph: '◆', freq: 440 }, { color: '#d946ef', glyph: '★', freq: 523 }, { color: '#fb923c', glyph: '✚', freq: 659 },
];
const SEQ_TEXT = {
  title: ['Verificación de secuencia · repite el patrón', 'Sequence check · repeat the pattern', 'Vérification de séquence · répétez le motif'] as L3,
  help: ['Observa el patrón de luces y repítelo en el mismo orden (también con las teclas 1 a 6). Cada ronda añade un paso. Tres errores reinician la verificación.', 'Watch the light pattern and repeat it in the same order (keys 1 to 6 work too). Each round adds one step. Three mistakes restart the check.', 'Observez le motif lumineux et répétez-le dans le même ordre (les touches 1 à 6 fonctionnent aussi). Chaque manche ajoute une étape. Trois erreurs relancent la vérification.'] as L3,
  watch: ['Observa…', 'Watch…', 'Observez…'] as L3,
  yours: ['Tu turno', 'Your turn', 'À vous'] as L3,
  wrong: ['Error · el patrón se repite', 'Mistake · the pattern repeats', 'Erreur · le motif se répète'] as L3,
  reset: ['Verificación reiniciada con un patrón nuevo', 'Check restarted with a new pattern', 'Vérification relancée avec un nouveau motif'] as L3,
  ok: ['Secuencia verificada', 'Sequence verified', 'Séquence vérifiée'] as L3,
  round: ['Ronda', 'Round', 'Manche'] as L3,
  errors: ['Errores', 'Mistakes', 'Erreurs'] as L3,
};

function sequence(f: Frame): void {
  const ROUNDS = 5, START = 3;
  const info = h('div', 'mg-seq-info', f.stage);
  const roundLabel = h('span', '', info);
  const dots = Array.from({ length: ROUNDS }, () => h('i', 'mg-dot', info));
  const errorLabel = h('span', '', info);
  const grid = h('div', 'mg-pads locked', f.stage);
  const pads = PADS.map((p, i) => {
    const b = h('button', 'mg-pad', grid); b.type = 'button';
    b.style.setProperty('--c', p.color);
    h('span', 'mg-pad-glyph', b).textContent = p.glyph;
    h('small', '', b).textContent = String(i + 1);
    return b;
  });

  let ctx: AudioContext | null = null;
  const tone = (freq: number, ms: number) => {
    try {
      if (!ctx) ctx = new AudioContext();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch { /* audio is optional */ }
  };
  f.own(() => { try { void ctx?.close(); } catch { /* ignore */ } });

  let seq: number[] = [], round = 0, pos = 0, errors = 0, phase: 'show' | 'input' | 'done' = 'show';
  const deal = () => {
    seq = [];
    for (let i = 0; i < START + ROUNDS - 1; i++) {
      let next: number;
      do { next = Math.floor(Math.random() * PADS.length); } while (i > 0 && next === seq[i - 1]);
      seq.push(next);
    }
    round = 0; errors = 0;
  };
  const roundText = () => `${T(SEQ_TEXT.round)} ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`;
  const errorText = () => `${T(SEQ_TEXT.errors)} ${errors}/3`;
  const counters = () => {
    dots.forEach((d, i) => d.classList.toggle('on', i < round));
    roundLabel.textContent = roundText(); errorLabel.textContent = errorText();
  };
  f.text(roundLabel, roundText);
  f.text(errorLabel, errorText);
  const flash = (i: number, ms: number) => {
    pads[i].classList.add('on'); tone(PADS[i].freq, ms);
    f.later(() => pads[i].classList.remove('on'), ms);
  };
  const play = () => {
    phase = 'show'; pos = 0; counters(); f.status(SEQ_TEXT.watch);
    grid.classList.add('locked');
    const length = START + round, gap = Math.max(380, 650 - round * 55), on = gap * 0.6;
    for (let i = 0; i < length; i++) f.later(() => flash(seq[i], on), 500 + i * gap);
    f.later(() => { phase = 'input'; grid.classList.remove('locked'); f.status(SEQ_TEXT.yours); }, 500 + length * gap);
  };
  const press = (i: number) => {
    if (phase !== 'input') return;
    flash(i, 240);
    if (i === seq[pos]) {
      pos += 1;
      if (pos === START + round) {
        round += 1; counters();
        grid.classList.add('locked');
        if (round >= ROUNDS) { phase = 'done'; f.win(SEQ_TEXT.ok); return; }
        phase = 'show'; f.later(play, 900);
      }
      return;
    }
    errors += 1; phase = 'show'; grid.classList.add('locked');
    if (errors >= 3) { deal(); counters(); f.status(SEQ_TEXT.reset, 'bad'); f.later(play, 1500); }
    else { counters(); f.status(SEQ_TEXT.wrong, 'bad'); f.later(play, 1200); }
  };
  pads.forEach((b, i) => f.listen(b, 'click', () => press(i)));
  f.listen(document, 'keydown', (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= PADS.length) { e.preventDefault(); press(n - 1); }
  });
  deal(); counters(); f.status(SEQ_TEXT.watch);
  f.later(play, 700);
}

// ============================================================================ 5 · TELEMETRY
const TLM_TEXT = {
  title: ['Telemetría · estabiliza la señal', 'Telemetry · stabilize the signal', 'Télémétrie · stabilisez le signal'] as L3,
  help: ['Mueve el retículo (ratón, dedo o flechas) para mantenerlo dentro del anillo que sigue la señal. La estabilidad sube dentro del anillo y cae fuera. Llega al 100 %.', 'Move the reticle (mouse, finger or arrow keys) to keep it inside the ring that follows the signal. Stability rises inside the ring and drops outside. Reach 100%.', 'Déplacez le réticule (souris, doigt ou flèches) pour le garder dans l’anneau qui suit le signal. La stabilité monte dans l’anneau et chute à l’extérieur. Atteignez 100 %.'] as L3,
  tracking: ['Siguiendo la señal', 'Tracking the signal', 'Suivi du signal'] as L3,
  lost: ['Señal perdida · vuelve al anillo', 'Signal lost · return to the ring', 'Signal perdu · revenez dans l’anneau'] as L3,
  ok: ['Telemetría estable', 'Telemetry stable', 'Télémétrie stable'] as L3,
  stability: ['Estabilidad', 'Stability', 'Stabilité'] as L3,
};

function telemetry(f: Frame): void {
  const W = 560, H = 320, R = 38;
  const canvas = h('canvas', 'mg-radar', f.stage);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const row = h('div', 'mg-meter mg-meter-wide', f.stage);
  f.text(h('span', '', row), TLM_TEXT.stability);
  const fill = h('i', '', h('div', 'mg-bar stab', row));
  const value = h('em', '', row);

  const ph = [range(0, 6.28), range(0, 6.28), range(0, 6.28), range(0, 6.28)];
  let rx = W / 2, ry = H / 2, meter = 0, last = performance.now(), nextJolt = 3, raf = 0;
  let state: 'track' | 'lost' | 'done' = 'track';
  let jx = 0, jy = 0, jtx = 0, jty = 0, clock = 0;
  const trail: Array<{ x: number; y: number }> = [];
  const held = new Set<string>();
  f.status(TLM_TEXT.tracking);

  const toCanvas = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    rx = clamp((e.clientX - r.left) / r.width * W, 0, W); ry = clamp((e.clientY - r.top) / r.height * H, 0, H);
  };
  f.listen(canvas, 'pointermove', (e: PointerEvent) => toCanvas(e));
  f.listen(canvas, 'pointerdown', (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); toCanvas(e); e.preventDefault(); });
  f.listen(document, 'keydown', (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) { held.add(e.key); e.preventDefault(); } });
  f.listen(document, 'keyup', (e: KeyboardEvent) => { held.delete(e.key); });

  const loop = (now: number) => {
    if (f.disposed || state === 'done') return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
    if (held.has('ArrowLeft')) rx -= 280 * dt;
    if (held.has('ArrowRight')) rx += 280 * dt;
    if (held.has('ArrowUp')) ry -= 280 * dt;
    if (held.has('ArrowDown')) ry += 280 * dt;
    rx = clamp(rx, 0, W); ry = clamp(ry, 0, H);
    nextJolt -= dt;
    if (nextJolt <= 0) { jtx = range(-70, 70); jty = range(-45, 45); nextJolt = range(3, 5.5); }
    const k = Math.min(1, dt * 2.2); jx += (jtx - jx) * k; jy += (jty - jy) * k;
    const bx = clamp(W / 2 + 150 * Math.sin(0.7 * clock + ph[0]) + 70 * Math.sin(1.9 * clock + ph[1]) + jx, 56, W - 56);
    const by = clamp(H / 2 + 80 * Math.sin(0.9 * clock + ph[2]) + 36 * Math.sin(2.3 * clock + ph[3]) + jy, 56, H - 56);
    trail.push({ x: bx, y: by }); if (trail.length > 34) trail.shift();
    const gap = Math.hypot(rx - bx, ry - by), inside = gap <= R;
    meter = clamp(meter + dt * (inside ? 0.2 : -0.3), 0, 1);
    fill.style.width = `${(meter * 100).toFixed(0)}%`; value.textContent = `${Math.round(meter * 100)}%`;
    const next = inside ? 'track' : 'lost';
    if (next !== state) { state = next; f.status(next === 'track' ? TLM_TEXT.tracking : TLM_TEXT.lost, next === 'lost' ? 'bad' : ''); }
    if (ctx) {
      ctx.fillStyle = '#05161a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#17383d'; ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy <= H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      ctx.strokeStyle = '#1f5560';
      for (const rr of [80, 160, 240]) { ctx.beginPath(); ctx.arc(W / 2, H / 2, rr, 0, Math.PI * 2); ctx.stroke(); }
      if (typeof ctx.createConicGradient === 'function') {
        const grad = ctx.createConicGradient(clock * 1.6, W / 2, H / 2);
        grad.addColorStop(0, 'rgba(110,220,170,0.22)'); grad.addColorStop(0.12, 'rgba(110,220,170,0)'); grad.addColorStop(1, 'rgba(110,220,170,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      }
      trail.forEach((p, i) => { ctx.fillStyle = `rgba(244,190,103,${(i / trail.length) * 0.5})`; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + i * 0.05, 0, Math.PI * 2); ctx.fill(); });
      ctx.lineWidth = 3; ctx.strokeStyle = inside ? '#8ee0a6' : '#f4be67';
      ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f4be67'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = inside ? '#d9ffe6' : '#ff9d8f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx - 16, ry); ctx.lineTo(rx - 5, ry); ctx.moveTo(rx + 5, ry); ctx.lineTo(rx + 16, ry);
      ctx.moveTo(rx, ry - 16); ctx.lineTo(rx, ry - 5); ctx.moveTo(rx, ry + 5); ctx.lineTo(rx, ry + 16); ctx.stroke();
      ctx.beginPath(); ctx.arc(rx, ry, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#7fb3ba'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
      ctx.fillText('TLM CH-04', 12, 20); ctx.fillText(`Δ ${gap.toFixed(0).padStart(3, '0')} px`, 12, 36);
    }
    if (meter >= 1) { state = 'done'; f.win(TLM_TEXT.ok); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  f.own(() => cancelAnimationFrame(raf));
}

// ============================================================================ public API
const GAMES: Record<MinigameId, { title: L3; help: L3; run: (frame: Frame) => void }> = {
  wiring: { title: WIRING_TEXT.title, help: WIRING_TEXT.help, run: wiring },
  card: { title: CARD_TEXT.title, help: CARD_TEXT.help, run: card },
  dish: { title: DISH_TEXT.title, help: DISH_TEXT.help, run: dish },
  sequence: { title: SEQ_TEXT.title, help: SEQ_TEXT.help, run: sequence },
  telemetry: { title: TLM_TEXT.title, help: TLM_TEXT.help, run: telemetry },
};

export function mountMinigame(id: MinigameId, host: HTMLElement, options: MinigameOptions): MinigameHandle {
  const game = GAMES[id];
  const frame = new Frame(host, game.title, game.help, options);
  game.run(frame);
  return { dispose: () => frame.dispose(), refresh: () => frame.refresh() };
}
