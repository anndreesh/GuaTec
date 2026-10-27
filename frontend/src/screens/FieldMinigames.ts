import { el } from "../core/dom";
import { fieldTaskResult, type FieldTaskDraft, type MissionMiniGameResult } from "../state/Mission01FieldTasks";
import { fieldTaskLabel, fieldText as t } from "./FieldTaskCopy";
import "../field-minigames.css";

export type FieldMinigameKind = "assembly" | "mass" | "calibration" | "signal";
export const FIELD_ASSEMBLY_ROTATIONS = [0, 90, 0, 180] as const;
export const FIELD_CALIBRATION_TARGETS = [32, 58, 76] as const;
export const FIELD_SIGNAL_PATH = [0, 1, 3, 5] as const;
export const FIELD_MASS_WEIGHTS = [1, 2, 3, 4] as const;
export const FIELD_MASS_ARMS = [-2, -1, 1, 2] as const;

export interface FieldMinigameCallbacks {
  onValidated(result: MissionMiniGameResult): void;
  onDraft(draft: FieldTaskDraft): void;
  onFeedback?(type: "input" | "error" | "success"): void;
  /** Progress in 0..1, optional current dial value in 0..1. */
  onProgress?(progress: number, value?: number): void;
}

function numberList(value: unknown, count: number, fallback: number): number[] {
  return Array.from({ length: count }, (_, i) => Array.isArray(value) && Number.isFinite(value[i]) ? Number(value[i]) : fallback);
}
function bounded(value: unknown, fallback = 0, max = 100): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
}

/** A station owns its result; this control owns only a serializable, cancellable draft. */
export function mountFieldTask(kind: FieldMinigameKind, host: HTMLElement, callbacks: FieldMinigameCallbacks, draft: FieldTaskDraft = {}): () => void {
  const abort = new AbortController();
  const state: FieldTaskDraft = { ...draft, attempts: Math.max(1, bounded(draft.attempts, 1, 10000)), mistakes: bounded(draft.mistakes, 0, 10000) };
  let disposed = false;
  let validated = false;
  let cancelGesture = () => {};
  const root = el("section", { className: `field-task field-task--${kind}`, attrs: { "aria-label": fieldTaskLabel(kind), "data-field-task": kind } });
  const lamp = el("span", { className: "field-task__lamp", text: t("common.working") });
  const header = el("div", { className: "field-task__header", children: [el("strong", { text: fieldTaskLabel(kind) }), lamp] });
  const protocol = el("div", { className: "field-task__protocol", children: [
    el("span", { className: "field-task__protocol-code", text: `FICHA / ${kind.toUpperCase()}` }),
    el("span", { className: "field-task__protocol-steps", text: "OBSERVAR  ·  OPERAR  ·  REGISTRAR" }),
  ] });
  const board = el("div", { className: "field-task__board" });
  const progress = el("progress", { className: "field-task__progress", attrs: { max: "1", value: "0", "aria-label": t("common.progress") } });
  const status = el("p", { className: "field-task__status", attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
  root.append(header, protocol, el("p", { className: "field-task__instructions", text: t(`${kind}.instructions`) }), board, progress, status, el("small", { className: "field-task__note", text: t("common.abstract") }));
  host.append(root);

  function listen<E extends Event>(node: EventTarget, eventName: string, listener: (event: E) => void) {
    node.addEventListener(eventName, listener as EventListener, { signal: abort.signal });
  }
  function save() {
    if (disposed) return;
    const copy: FieldTaskDraft = {};
    for (const [key, value] of Object.entries(state)) copy[key] = Array.isArray(value) ? [...value] as number[] | string[] : value;
    callbacks.onDraft(copy);
  }
  function feedback(key: string, type: "input" | "error" | "success" = "input") {
    if (disposed || validated) return;
    status.textContent = t(key); status.dataset.state = type;
    callbacks.onFeedback?.(type);
  }
  function error(key: string) {
    state.attempts = Number(state.attempts) + 1; state.mistakes = Number(state.mistakes) + 1;
    save(); feedback(key, "error");
  }
  function reportProgress(value: number, current?: number) {
    progress.value = Math.max(0, Math.min(1, value));
    callbacks.onProgress?.(progress.value, current);
  }
  function complete() {
    if (validated || disposed) return;
    feedback("common.success", "success");
    validated = true; state.validated = true; save(); reportProgress(1);
    root.classList.add("is-validated"); lamp.textContent = t("common.ready");
    for (const control of root.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) control.disabled = true;
    callbacks.onValidated(fieldTaskResult(kind, Number(state.attempts), Number(state.mistakes)));
  }
  function button(text: string, onClick: () => void, className = ""): HTMLButtonElement {
    const node = el("button", { className: `field-task__button ${className}`, text, attrs: { type: "button" } });
    listen(node, "click", () => { if (!disposed && !validated) onClick(); });
    return node;
  }
  function drag(node: HTMLButtonElement, select: () => void, acceptDrop: (target: HTMLElement) => void) {
    let pointer: number | null = null;
    let originX = 0, originY = 0, moved = false, suppressClick = false;
    const cancel = () => {
      if (pointer !== null && node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
      pointer = null; node.style.transform = ""; node.classList.remove("is-dragging");
    };
    const previousCancel = cancelGesture;
    cancelGesture = () => { previousCancel(); cancel(); };
    listen<PointerEvent>(node, "pointerdown", event => {
      if (node.disabled || event.button !== 0 || pointer !== null) return;
      pointer = event.pointerId; originX = event.clientX; originY = event.clientY; moved = false;
      node.focus(); node.setPointerCapture(pointer); select();
    });
    listen<PointerEvent>(node, "pointermove", event => {
      if (pointer !== event.pointerId) return;
      const x = event.clientX - originX, y = event.clientY - originY;
      if (Math.hypot(x, y) > 5) moved = true;
      if (moved) { node.style.transform = `${node.classList.contains("field-task__signal-node") ? "translate(-50%, -50%) " : ""}translate(${x}px, ${y}px)`; node.classList.add("is-dragging"); }
    });
    listen<PointerEvent>(node, "pointerup", event => {
      if (pointer !== event.pointerId) return;
      const didMove = moved; suppressClick = didMove;
      // Hit-test below the dragged part, then restore it before moving state.
      node.style.pointerEvents = "none";
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-field-drop]");
      node.style.pointerEvents = "";
      cancel();
      if (didMove && target && root.contains(target)) acceptDrop(target);
    });
    listen(node, "pointercancel", cancel); listen(node, "lostpointercapture", cancel);
    // A native click follows pointerup. Prevent it from reselecting the piece after a drop.
    node.addEventListener("click", event => {
      if (suppressClick && event.detail !== 0) { suppressClick = false; event.stopImmediatePropagation(); }
    }, { capture: true, signal: abort.signal });
  }
  listen(window, "blur", () => cancelGesture());
  listen(document, "visibilitychange", () => { if (document.hidden) cancelGesture(); });

  if (kind === "assembly") {
    const names = ["assembly.support", "assembly.plate", "assembly.ring", "assembly.marker"];
    const symbols = ["⌜", "▱", "○", "↳"];
    const placements = numberList(state.placements, 4, -1).map((value, index) => value === index ? index : -1);
    const rotations = numberList(state.rotations, 4, 0).map(value => ((Math.round(value / 90) * 90) % 360 + 360) % 360);
    placements.forEach((_value, i) => { if (rotations[i] !== FIELD_ASSEMBLY_ROTATIONS[i]) placements[i] = -1; });
    let selected = typeof state.selected === "number" && state.selected >= 0 && state.selected < 4 ? state.selected : -1;
    state.placements = placements; state.rotations = rotations;
    const tray = el("div", { className: "field-task__parts", attrs: { "aria-label": t("assembly.parts") } });
    const drawing = el("div", { className: "field-task__assembly", attrs: { "aria-label": t("assembly.sockets") } });
    const sourceButtons: HTMLButtonElement[] = [], sockets: HTMLButtonElement[] = [];
    const rotate = button(t("assembly.rotate"), () => {
      if (selected < 0 || placements[selected] === selected) { feedback("assembly.select"); return; }
      rotations[selected] = (rotations[selected] + 90) % 360; update(); save();
    }, "field-task__rotate");
    function select(index: number) { selected = index; state.selected = selected; update(); save(); }
    function fit(index: number) {
      if (selected < 0) { feedback("assembly.select"); return; }
      if (selected !== index) { error("assembly.wrongPart"); return; }
      if (rotations[selected] !== FIELD_ASSEMBLY_ROTATIONS[index]) { error("assembly.wrongRotation"); return; }
      placements[index] = selected; selected = -1; state.selected = -1;
      update(); save(); feedback("assembly.fitted", "success");
      if (placements.every((value, i) => value === i)) complete();
    }
    function update() {
      sourceButtons.forEach((source, i) => {
        source.disabled = placements[i] === i;
        source.classList.toggle("is-selected", selected === i);
        source.classList.toggle("is-fitted", placements[i] === i);
        source.setAttribute("aria-pressed", String(selected === i));
        source.querySelector<HTMLElement>(".field-task__piece-symbol")!.style.transform = `rotate(${rotations[i]}deg)`;
        source.querySelector<HTMLElement>(".field-task__angle")!.textContent = `${rotations[i]}°`;
      });
      sockets.forEach((socket, i) => { socket.classList.toggle("is-fitted", placements[i] === i); socket.disabled = placements[i] === i; });
      rotate.disabled = selected < 0;
      reportProgress(placements.filter((value, i) => value === i).length / 4);
    }
    names.forEach((key, i) => {
      const source = button("", () => select(i), "field-task__part");
      source.dataset.part = String(i); source.setAttribute("aria-label", `${t(key)} ${i + 1}`);
      source.append(el("span", { className: `field-task__piece-symbol field-task__piece-symbol--${i}`, text: symbols[i], attrs: { "aria-hidden": "true" } }), el("span", { text: t(key) }), el("small", { className: "field-task__angle" }));
      drag(source, () => select(i), target => fit(Number(target.dataset.fieldDrop)));
      sourceButtons.push(source); tray.append(source);
      const socket = button("", () => fit(i), "field-task__socket");
      socket.dataset.fieldDrop = String(i); socket.dataset.socket = String(i);
      socket.setAttribute("aria-label", `${t("assembly.socket")} ${t(key)} · ${FIELD_ASSEMBLY_ROTATIONS[i]}°`);
      const silhouette = el("span", { className: `field-task__piece-symbol field-task__piece-symbol--${i}`, text: symbols[i], attrs: { "aria-hidden": "true" } });
      silhouette.style.transform = `rotate(${FIELD_ASSEMBLY_ROTATIONS[i]}deg)`;
      socket.append(silhouette, el("small", { text: `${i + 1} · ${FIELD_ASSEMBLY_ROTATIONS[i]}°` }));
      sockets.push(socket); drawing.append(socket);
    });
    board.append(drawing, tray, rotate); update(); feedback("assembly.select");
    if (placements.every((value, i) => value === i)) complete();
  }

  if (kind === "mass") {
    const usedSlots = new Set<number>();
    const positions = numberList(state.positions, 4, -1).map(value => {
      if (!Number.isInteger(value) || value < 0 || value > 3 || usedSlots.has(value)) return -1;
      usedSlots.add(value); return value;
    });
    state.positions = positions;
    let selected = typeof state.selected === "number" && state.selected >= 0 && state.selected < 4 ? state.selected : -1;
    const load = el("output", { className: "field-task__load", attrs: { "aria-label": t("mass.load") } });
    const difference = el("output", { className: "field-task__difference", attrs: { "aria-label": t("mass.torque") } });
    const beam = el("div", { className: "field-task__beam", attrs: { "aria-hidden": "true" } });
    const needle = el("span", { className: "field-task__balance-needle" });
    const scale = el("div", { className: "field-task__scale", children: [beam, el("div", { className: "field-task__balance-dial", children: [needle] })] });
    const supports = el("div", { className: "field-task__supports" });
    const tray = el("div", { className: "field-task__weights" });
    const sources: HTMLButtonElement[] = [], targets: HTMLButtonElement[] = [];
    function totals() {
      return positions.reduce((sum, position, i) => ({ load: sum.load + (position < 0 ? 0 : FIELD_MASS_WEIGHTS[i]), torque: sum.torque + (position < 0 ? 0 : FIELD_MASS_WEIGHTS[i] * FIELD_MASS_ARMS[position]), count: sum.count + Number(position >= 0) }), { load: 0, torque: 0, count: 0 });
    }
    function select(index: number) { selected = index; state.selected = index; update(); save(); }
    function place(slot: number) {
      if (selected < 0) { feedback("mass.select"); return; }
      positions.forEach((value, i) => { if (value === slot && slot >= 0) positions[i] = -1; });
      positions[selected] = slot; selected = -1; state.selected = -1;
      update(); save(); feedback("mass.moved");
    }
    function update() {
      const readings = totals();
      load.value = `${readings.load} / 8`; difference.value = `${readings.torque > 0 ? "+" : ""}${readings.torque}`;
      beam.style.transform = `rotate(${Math.max(-13, Math.min(13, readings.torque * 2))}deg)`;
      needle.style.transform = `rotate(${Math.max(-65, Math.min(65, readings.torque * 8))}deg)`;
      scale.classList.toggle("is-balanced", readings.count >= 3 && readings.load <= 8 && readings.torque === 0);
      sources.forEach((source, i) => { source.classList.toggle("is-selected", selected === i); source.classList.toggle("is-loaded", positions[i] >= 0); source.setAttribute("aria-pressed", String(selected === i)); });
      targets.forEach((target, i) => { const occupant = positions.indexOf(i); target.textContent = occupant < 0 ? `${FIELD_MASS_ARMS[i]} · ○` : `${FIELD_MASS_ARMS[i]} · ${FIELD_MASS_WEIGHTS[occupant]}`; target.classList.toggle("is-loaded", occupant >= 0); });
      reportProgress(Math.min(.9, readings.count / 4), (readings.torque + 12) / 24);
    }
    for (let i = 0; i < 4; i++) {
      const target = button(`${FIELD_MASS_ARMS[i]} · ○`, () => place(i), "field-task__support");
      target.dataset.fieldDrop = String(i); target.dataset.arm = String(i); target.setAttribute("aria-label", `${t("mass.support")} ${FIELD_MASS_ARMS[i]}`);
      targets.push(target); supports.append(target);
      const source = button(`${t("mass.block")} ${i + 1} · ${FIELD_MASS_WEIGHTS[i]}`, () => select(i), "field-task__weight");
      source.dataset.weight = String(i);
      drag(source, () => select(i), target => place(Number(target.dataset.fieldDrop)));
      sources.push(source); tray.append(source);
    }
    const returnToTray = button(t("mass.tray"), () => place(-1), "field-task__return"); returnToTray.dataset.fieldDrop = "-1";
    const measure = button(t("mass.measure"), () => {
      const readings = totals();
      if (readings.count < 3) error("mass.tooFew");
      else if (readings.load > 8) error("mass.tooHeavy");
      else if (readings.torque !== 0) error("mass.unbalanced");
      else complete();
    }, "field-task__record");
    board.append(scale, supports, el("div", { className: "field-task__readings", children: [el("span", { children: [t("mass.load"), load] }), el("span", { children: [t("mass.torque"), difference] })] }), tray, returnToTray, measure);
    update(); feedback("mass.select");
    if (state.validated === true && totals().count >= 3 && totals().load <= 8 && totals().torque === 0) complete();
  }

  if (kind === "calibration") {
    const values = numberList(state.values, 3, 12).map(value => bounded(value, 12));
    const recorded = numberList(state.recorded, 3, 0).map((value, i) => value === 1 && Math.abs(values[i] - FIELD_CALIBRATION_TARGETS[i]) <= 4 ? 1 : 0);
    state.values = values; state.recorded = recorded;
    const dials = el("div", { className: "field-task__dials" });
    for (let i = 0; i < 3; i++) {
      const face = el("div", { className: "field-task__dial-face", attrs: { "aria-hidden": "true" } });
      const needle = el("span", { className: "field-task__dial-needle" });
      const reference = el("span", { className: "field-task__dial-reference" }); reference.style.transform = `rotate(${FIELD_CALIBRATION_TARGETS[i] * 2.4 - 120}deg)`;
      face.append(reference, needle);
      const value = el("output", { className: "field-task__dial-value" });
      const input = el("input", { className: "field-task__dial-input", attrs: { type: "range", min: "0", max: "100", step: "1", value: String(values[i]), "aria-label": `${t("calibration.dial")} ${i + 1}`, "data-dial": String(i) } });
      const decrease = button("−", () => adjust(values[i] - 1), "field-task__dial-step"); decrease.setAttribute("aria-label", `${t("calibration.decrease")} ${i + 1}`);
      const increase = button("+", () => adjust(values[i] + 1), "field-task__dial-step"); increase.setAttribute("aria-label", `${t("calibration.increase")} ${i + 1}`);
      const record = button(t(recorded[i] ? "calibration.recorded" : "calibration.record"), () => {
        if (Math.abs(values[i] - FIELD_CALIBRATION_TARGETS[i]) > 4) { error("calibration.noisy"); return; }
        recorded[i] = 1; update(); save(); feedback("calibration.accepted", "success");
        if (recorded.every(Boolean)) complete();
      }, "field-task__record"); record.dataset.recordDial = String(i);
      function update() {
        input.value = String(values[i]); value.value = String(values[i]); needle.style.transform = `rotate(${values[i] * 2.4 - 120}deg)`;
        input.disabled = decrease.disabled = increase.disabled = record.disabled = recorded[i] === 1;
        record.textContent = t(recorded[i] ? "calibration.recorded" : "calibration.record");
        face.classList.toggle("is-recorded", recorded[i] === 1); face.classList.toggle("is-aligned", Math.abs(values[i] - FIELD_CALIBRATION_TARGETS[i]) <= 4);
        reportProgress(recorded.filter(Boolean).length / 3, values[i] / 100);
      }
      function adjust(next: number) { if (recorded[i] || validated) return; values[i] = bounded(next); update(); save(); }
      listen(input, "input", () => adjust(Number(input.value)));
      let pointer: number | null = null;
      function turn(event: PointerEvent) {
        const rect = face.getBoundingClientRect(), x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
        const degrees = Math.atan2(x, -y) * 180 / Math.PI;
        adjust((Math.max(-120, Math.min(120, degrees)) + 120) / 2.4);
      }
      listen<PointerEvent>(face, "pointerdown", event => { if (recorded[i] || validated || event.button !== 0) return; pointer = event.pointerId; face.setPointerCapture(pointer); turn(event); });
      listen<PointerEvent>(face, "pointermove", event => { if (pointer === event.pointerId) turn(event); });
      const stop = () => { if (pointer !== null && face.hasPointerCapture(pointer)) face.releasePointerCapture(pointer); pointer = null; };
      listen(face, "pointerup", stop); listen(face, "pointercancel", stop); listen(face, "lostpointercapture", stop);
      const previousCancel = cancelGesture; cancelGesture = () => { previousCancel(); stop(); };
      const dial = el("div", { className: "field-task__instrument", children: [el("strong", { text: `${t("calibration.dial")} ${i + 1}` }), face, el("small", { text: `${t("calibration.reference")} ${FIELD_CALIBRATION_TARGETS[i]} ± 4` }), el("div", { className: "field-task__dial-controls", children: [decrease, value, increase] }), input, record] });
      dials.append(dial); update();
    }
    board.append(dials); feedback("calibration.adjust");
    if (recorded.every(Boolean)) complete();
  }

  if (kind === "signal") {
    const savedPath = numberList(state.path, Array.isArray(state.path) ? state.path.length : 0, -1);
    const path = savedPath.length && savedPath.length <= 4 && savedPath.every((value, i) => value === FIELD_SIGNAL_PATH[i]) ? savedPath : [0];
    state.path = path;
    const positions = [[7, 50], [35, 20], [35, 80], [65, 20], [65, 80], [93, 50]];
    const diagram = el("div", { className: "field-task__signal-diagram" });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
    svg.classList.add("field-task__signal-wires");
    for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]]) {
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", String(positions[a][0])); line.setAttribute("y1", String(positions[a][1])); line.setAttribute("x2", String(positions[b][0])); line.setAttribute("y2", String(positions[b][1])); svg.append(line);
    }
    const wire = document.createElementNS(svg.namespaceURI, "polyline"); wire.classList.add("is-connected"); svg.append(wire); diagram.append(svg);
    const nodes: HTMLButtonElement[] = [];
    function update() {
      nodes.forEach((node, index) => { node.classList.toggle("is-connected", path.includes(index)); node.classList.toggle("is-current", path[path.length - 1] === index); node.setAttribute("aria-pressed", String(path.includes(index))); });
      wire.setAttribute("points", path.map(index => positions[index].join(",")).join(" "));
      reportProgress((path.length - 1) / 3);
    }
    function connect(index: number) {
      if (index === 0) { path.splice(0, path.length, 0); update(); save(); feedback("signal.start"); return; }
      if (index === path[path.length - 1]) return;
      if (index !== FIELD_SIGNAL_PATH[path.length]) { path.splice(0, path.length, 0); update(); error("signal.wrong"); return; }
      path.push(index); update(); save(); feedback("signal.linked", "success");
      if (path.length === FIELD_SIGNAL_PATH.length) complete();
    }
    for (let i = 0; i < positions.length; i++) {
      const clean = i === 1 || i === 3;
      const title = i === 0 ? t("signal.source") : i === 5 ? t("signal.receiver") : ["", "I", "II", "III", "IV"][i];
      const node = button("", () => connect(i), "field-task__signal-node");
      node.dataset.fieldDrop = String(i); node.dataset.signalNode = String(i);
      node.style.left = `${positions[i][0]}%`; node.style.top = `${positions[i][1]}%`;
      node.setAttribute("aria-label", `${title}${i > 0 && i < 5 ? ` · ${t(clean ? "signal.clean" : "signal.noisy")}` : ""}`);
      node.append(el("strong", { text: title }));
      if (i > 0 && i < 5) node.append(el("span", { className: `field-task__node-trace${clean ? "" : " is-noisy"}`, attrs: { "aria-hidden": "true" } }));
      drag(node, () => { if (i === 0) connect(0); }, target => {
        if (i !== path[path.length - 1]) { error("signal.wrong"); return; }
        connect(Number(target.dataset.fieldDrop));
      });
      nodes.push(node); diagram.append(node);
    }
    board.append(diagram, el("div", { className: "field-task__trace-legend", children: [el("span", { text: `━ · ${t("signal.clean")}` }), el("span", { text: `⌁ · ${t("signal.noisy")}` })] }));
    update(); feedback("signal.start");
    if (path.length === FIELD_SIGNAL_PATH.length) complete();
  }

  return () => {
    if (disposed) return;
    save(); disposed = true; cancelGesture(); abort.abort(); root.remove();
  };
}
