import { el } from "../core/dom";
import { taskText as t } from "./EngineeringTaskCopy";
import { CIRCUIT_DESTINATIONS, LAUNCH_RELAYS, circuitMatches, signalStrength, isSignalAligned, isPropulsionBalanced, relayMatches, type EngineeringTaskKind } from "../state/Mission01Tasks";
import "../engineering-minigames.css";
export type { EngineeringTaskKind } from "../state/Mission01Tasks";

export interface EngineeringTaskCallbacks {
  onValidated(): void;
  onFeedback?(type: "input" | "error" | "success"): void;
  /** Fictional dial positions, both in 0..100; strength in percent. */
  onSignal?(orientation: number, frequency: number, strength: number): void;
  onProgress?(kind: EngineeringTaskKind, progress: number, value?: number): void;
}

/** The parent owns mission progression, modal close and checkpoint persistence. */
export function mountEngineeringTask(kind: EngineeringTaskKind, host: HTMLElement, callbacks: EngineeringTaskCallbacks): () => void {
  const abort = new AbortController();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;
  let validated = false;
  const root = el("section", { className: `engineering-task engineering-task--${kind}`, attrs: { "aria-label": t("Banco de ingeniería experimental") } });
  const header = el("div", { className: "engineering-task__header", children: [el("span", { text: "AUBURN · 1926" }), el("span", { className: "engineering-task__lamp", text: t("ENSAYO") })] });
  const protocol = el("div", { className: "engineering-task__protocol", children: [
    el("span", { className: "engineering-task__protocol-code", text: `${t("PROTOCOLO")} / ${["circuits","antenna","propulsion","diagnosis","launch"].indexOf(kind)+1}` }),
    el("span", { className: "engineering-task__protocol-steps", text: t("PREPARAR  ·  AJUSTAR  ·  VALIDAR") }),
  ] });
  const instructions = el("p", { className: "engineering-task__instructions" });
  const board = el("div", { className: "engineering-task__board" });
  const status = el("p", { className: "engineering-task__status", attrs: { role: "status", "aria-live": "polite" } });
  const progress = el("progress", { className: "engineering-task__progress", attrs: { max: "100", value: "0", "aria-label": t("Progreso del ensayo") } });
  root.append(header, protocol, instructions, board, progress, status, el("small", { className: "engineering-task__note", text: t("Lecturas y controles ficticios para esta simulación educativa.") }));
  host.append(root);

  function listen<E extends Event>(node: EventTarget, type: string, listener: (event: E) => void) {
    node.addEventListener(type, listener as EventListener, { signal: abort.signal });
  }
  function later(fn: () => void, ms: number) {
    const timer = setTimeout(() => { timers.delete(timer); if (!disposed) fn(); }, ms);
    timers.add(timer);
    return timer;
  }
  function feedback(message: string, type: "input" | "error" | "success" = "input") {
    if (disposed || validated) return;
    status.textContent = t(message);
    status.dataset.state = type;
    callbacks.onFeedback?.(type);
  }
  function complete() {
    if (disposed || validated) return;
    feedback("Ensayo validado. Registro listo para el equipo.", "success");
    validated = true;
    progress.value = 100;
    callbacks.onProgress?.(kind, 100);
    root.classList.add("engineering-task--validated");
    header.lastElementChild!.textContent = t("VALIDADO");
    for (const input of root.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")) input.disabled = true;
    callbacks.onValidated();
  }
  function button(label: string, onClick: () => void, className = ""): HTMLButtonElement {
    const node = el("button", { className: `engineering-task__button ${className}`, text: t(label), attrs: { type: "button" } });
    listen(node, "click", onClick);
    return node;
  }
  function slider(label: string, initial: number, onInput: (value: number) => void, target?: [number, number]) {
    const input = el("input", { attrs: { type: "range", min: "0", max: "100", step: "1", value: String(initial), "aria-label": t(label) } });
    const output = el("output", { text: String(initial) });
    const scale = el("div", { className: "engineering-task__slider-track" });
    if (target) {
      const band = el("span", { className: "engineering-task__target" });
      band.style.left = `${target[0]}%`; band.style.width = `${target[1] - target[0]}%`; scale.append(band);
    }
    scale.append(input);
    const node = el("label", { className: "engineering-task__slider", children: [el("span", { children: [t(label), output] }), scale] });
    listen(input, "input", () => { output.value = input.value; onInput(Number(input.value)); });
    return { node, input, output };
  }

  if (kind === "circuits") {
    instructions.textContent = t("Une cada señal con su terminal gemelo. Arrastra un cable o selecciona origen y destino con clic, Tab y Enter.");
    const names = ["I · A", "II · B", "III · C", "IV · D"];
    const connected = new Set<number>();
    let selected: number | null = null;
    let dragging = false;
    const sourceColumn = el("div", { className: "engineering-task__terminals" });
    const destColumn = el("div", { className: "engineering-task__terminals" });
    const diagram = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    diagram.classList.add("engineering-task__wires");
    diagram.setAttribute("viewBox", "0 0 300 240"); diagram.setAttribute("preserveAspectRatio", "none"); diagram.setAttribute("aria-hidden", "true");
    const paths = Array.from({ length: 4 }, () => { const path = document.createElementNS(diagram.namespaceURI, "path") as SVGPathElement; diagram.append(path); return path; });
    const livePath = document.createElementNS(diagram.namespaceURI, "path") as SVGPathElement;
    livePath.classList.add("engineering-task__live-wire"); diagram.append(livePath);
    const sourceButtons: HTMLButtonElement[] = [];
    const targetButtons: HTMLButtonElement[] = [];
    const labelForDestination = (destination: number) => names[CIRCUIT_DESTINATIONS.indexOf(destination as 0 | 1 | 2 | 3)];
    function select(source: number) {
      if (connected.has(source) || validated) return;
      selected = source;
      sourceButtons.forEach((node, i) => { node.classList.toggle("is-selected", i === source); node.setAttribute("aria-pressed", String(i === source)); });
      feedback("Señal seleccionada. Busca el mismo código en los terminales de salida.");
    }
    function connect(destination: number) {
      if (selected === null || validated) return;
      const source = selected;
      if (!circuitMatches(source, destination)) {
        feedback("Continuidad incorrecta. Comprueba los códigos; puedes volver a intentarlo.", "error");
        targetButtons[destination].classList.add("is-error");
        later(() => targetButtons[destination].classList.remove("is-error"), 500);
        return;
      }
      connected.add(source);
      paths[source].setAttribute("d", `M 0 ${30 + source * 60} C 135 ${30 + source * 60}, 165 ${30 + destination * 60}, 300 ${30 + destination * 60}`);
      paths[source].style.setProperty("--wire-color", ["#e0b568", "#91b9b3", "#da9a8a", "#c5bfdc"][source]);
      sourceButtons[source].classList.add("is-connected"); sourceButtons[source].disabled = true;
      targetButtons[destination].classList.add("is-connected"); targetButtons[destination].disabled = true;
      selected = null; dragging = false; livePath.setAttribute("d", "");
      progress.value = connected.size * 25;
      callbacks.onProgress?.(kind, progress.value);
      feedback("Continuidad confirmada. Conecta la siguiente señal.", "success");
      if (connected.size === 4) complete();
    }
    for (let i = 0; i < 4; i++) {
      const source = button(names[i], () => select(i), "engineering-task__terminal");
      source.setAttribute("aria-label", `${t("Origen")} ${names[i]}`); source.setAttribute("aria-pressed", "false");
      listen<PointerEvent>(source, "pointerdown", event => {
        if (source.disabled || event.button !== 0) return;
        select(i); dragging = true; source.setPointerCapture(event.pointerId);
      });
      listen<PointerEvent>(source, "pointermove", event => {
        if (!dragging || selected !== i) return;
        const rect = diagram.getBoundingClientRect();
        const x = Math.max(0, Math.min(300, (event.clientX - rect.left) / rect.width * 300));
        const y = Math.max(0, Math.min(240, (event.clientY - rect.top) / rect.height * 240));
        livePath.setAttribute("d", `M 0 ${30 + i * 60} C 120 ${30 + i * 60}, ${x - 70} ${y}, ${x} ${y}`);
      });
      listen<PointerEvent>(source, "pointerup", event => {
        if (!dragging) return;
        dragging = false; livePath.setAttribute("d", "");
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("[data-terminal]");
        if (target && root.contains(target)) connect(Number(target.dataset.terminal));
      });
      listen(source, "pointercancel", () => { dragging = false; livePath.setAttribute("d", ""); });
      const dest = button(labelForDestination(i), () => connect(i), "engineering-task__terminal");
      dest.dataset.terminal = String(i); dest.setAttribute("aria-label", `${t("Destino")} ${labelForDestination(i)}`);
      sourceButtons.push(source); targetButtons.push(dest); sourceColumn.append(source); destColumn.append(dest);
    }
    board.classList.add("engineering-task__circuit-board"); board.append(sourceColumn, diagram, destColumn);
    feedback("Sin continuidad: 0 de 4 circuitos conectados.");
  }

  if (kind === "antenna") {
    instructions.textContent = t("Ajusta el captador de la estación de campo. Centra la orientación en 42 y la sintonía en 64; confirma cuando la señal sea estable.");
    let orientation = 12, frequency = 20;
    const signal = el("div", { className: "engineering-task__signal", attrs: { "aria-hidden": "true" } });
    const needle = el("span", { className: "engineering-task__needle" });
    const dial = el("div", { className: "engineering-task__dial", children: [needle, el("span", { text: "N" }), el("span", { text: "S" })] });
    const strength = el("output", { className: "engineering-task__reading", text: "0%" });
    const lock = button("Fijar señal", () => {
      if (isSignalAligned(orientation, frequency)) complete();
      else feedback("Señal dispersa. Ajusta ambos mandos hasta entrar en la banda central.", "error");
    });
    const update = () => {
      const value = signalStrength(orientation, frequency);
      needle.style.transform = `rotate(${orientation * 3.6}deg)`;
      signal.style.setProperty("--signal", String(Math.max(.06, value / 100)));
      strength.value = `${value}%`;
      progress.value = value;
      const aligned = isSignalAligned(orientation, frequency);
      root.classList.toggle("is-aligned", aligned);
      status.textContent = t(aligned ? "Señal centrada. Fija la posición para registrar el enlace." : "Busca la señal: aproxima ambos mandos a los valores de referencia.");
      status.dataset.state = aligned ? "success" : "input";
      callbacks.onSignal?.(orientation, frequency, value);
      callbacks.onProgress?.(kind, progress.value, orientation);
    };
    const bearing = slider("Orientación del captador", orientation, value => { orientation = value; update(); }, [38, 46]);
    const tuning = slider("Sintonía del registrador", frequency, value => { frequency = value; update(); }, [60, 68]);
    const readout = el("div", { className: "engineering-task__signal-readout", children: [dial, el("div", { children: [signal, strength, el("small", { text: t("INTENSIDAD DE ENLACE") })] })] });
    board.append(readout, bearing.node, tuning.node, lock); update();
  }

  if (kind === "propulsion") {
    instructions.textContent = t("Ensayo abstracto de respuesta del prototipo. Acopla el simulador, lleva los dos indicadores a la banda marcada y registra la respuesta.");
    let armed = false, pressure = 20, temperature = 75;
    const flow = el("div", { className: "engineering-task__flow", attrs: { "aria-hidden": "true" }, children: [el("span", { text: "○" }), el("span", { text: "→" }), el("span", { text: "◉" }), el("span", { text: "→" }), el("span", { text: "▥" })] });
    const arm = button("1 · Acoplar simulador", () => {
      armed = !armed; arm.setAttribute("aria-pressed", String(armed));
      arm.textContent = t(armed ? "1 · Simulador acoplado" : "1 · Acoplar simulador");
      root.classList.toggle("is-armed", armed);
      pressureControl.input.disabled = !armed; tempControl.input.disabled = !armed;
      progress.value = armed ? 25 : 0;
      callbacks.onProgress?.(kind, progress.value, pressure);
      feedback(armed ? "Circuito de ensayo cerrado. Equilibra los indicadores." : "Simulador desacoplado.");
    });
    arm.setAttribute("aria-pressed", "false");
    const update = () => {
      if (!armed) return;
      const balanced = isPropulsionBalanced(pressure, temperature);
      progress.value = balanced ? 80 : 25;
      callbacks.onProgress?.(kind, progress.value, pressure);
      flow.classList.toggle("is-balanced", balanced);
      status.textContent = t(balanced ? "Respuesta estable. Registra el ensayo." : "Ajusta presión a 56–64 y respuesta térmica a 36–44 unidades ficticias.");
      status.dataset.state = balanced ? "success" : "input";
    };
    const pressureControl = slider("Presión simulada", pressure, value => { pressure = value; update(); }, [56, 64]);
    const tempControl = slider("Respuesta térmica simulada", temperature, value => { temperature = value; update(); }, [36, 44]);
    pressureControl.input.disabled = true; tempControl.input.disabled = true;
    const record = button("3 · Registrar respuesta", () => {
      if (!armed) feedback("Primero acopla el simulador.", "error");
      else if (!isPropulsionBalanced(pressure, temperature)) feedback("Respuesta fuera de banda. Corrige los indicadores y repite la lectura.", "error");
      else complete();
    });
    board.append(flow, arm, el("p", { className: "engineering-task__step", text: t("2 · Equilibrar respuesta") }), pressureControl.node, tempControl.node, record);
    feedback("Simulador aislado. Acóplalo para iniciar el ensayo.");
  }

  if (kind === "diagnosis") {
    instructions.textContent = t("Explora los tres módulos del registrador. Localiza la traza irregular, aísla ese módulo y desliza su recambio hasta el contacto.");
    const modules = ["A · Entrada", "B · Registro", "C · Salida"];
    const scanned = new Set<number>();
    let selected: number | null = null, isolated = false;
    const moduleRack = el("div", { className: "engineering-task__modules" });
    const trace = el("div", { className: "engineering-task__trace", attrs: { "aria-hidden": "true" } });
    const reading = el("p", { className: "engineering-task__diagnosis-reading", text: t("Selecciona un módulo para medir su traza.") });
    const isolate = button("Aislar módulo seleccionado", () => {
      if (selected === null) { feedback("Selecciona un módulo del diagrama.", "error"); return; }
      if (scanned.size < 3) { feedback("Compara los tres módulos antes de aislar la avería.", "error"); return; }
      if (selected !== 1) { feedback("Este módulo tiene una traza regular. Busca los pulsos interrumpidos.", "error"); return; }
      isolated = true; isolate.disabled = true;
      moduleButtons[1].classList.add("is-isolated"); replacement.input.disabled = false;
      progress.value = 75;
      callbacks.onProgress?.(kind, progress.value);
      feedback("Módulo de registro aislado. Inserta el recambio deslizando hasta 100.");
    });
    const replacement = slider("Inserción del recambio", 0, value => {
      if (isolated && value === 100) { trace.classList.remove("is-faulty"); moduleButtons[1].classList.add("is-connected"); reading.textContent = t("Traza continua · módulo restaurado"); complete(); }
    });
    replacement.input.disabled = true;
    const moduleButtons = modules.map((label, index) => {
      const node = button(label, () => {
        if (isolated) return;
        selected = index; scanned.add(index);
        moduleButtons.forEach((entry, i) => { entry.classList.toggle("is-selected", i === index); entry.setAttribute("aria-pressed", String(i === index)); });
        node.classList.add("is-scanned"); trace.classList.toggle("is-faulty", index === 1);
        reading.textContent = t(index === 1 ? "Registro B: pulsos interrumpidos · dispersión 82/100" : "Traza continua · dispersión 08/100");
        progress.value = scanned.size / 3 * 50;
        callbacks.onProgress?.(kind, progress.value, index);
        feedback("Lectura registrada. Compara las trazas antes de aislar un módulo.");
      }, "engineering-task__module");
      node.setAttribute("aria-pressed", "false"); moduleRack.append(node); return node;
    });
    board.append(moduleRack, trace, reading, isolate, replacement.node);
    feedback("0 de 3 módulos examinados.");
  }

  if (kind === "launch") {
    instructions.textContent = t("Verificación narrativa del registrador. Reproduce los relés en el orden indicado. Después mantén el sello de autorización para entregar el registro al director.");
    let step = 0;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    const sequence = el("div", { className: "engineering-task__sequence", attrs: { "aria-label": t("Orden de verificación: B, D, A, C") } });
    const chips = LAUNCH_RELAYS.map((relay, index) => {
      const node = el("span", { text: String.fromCharCode(65 + relay), className: index === 0 ? "is-current" : "" }); sequence.append(node); return node;
    });
    const relays = el("div", { className: "engineering-task__relays" });
    const seal = button("Mantener para sellar · 1,2 s", () => {} , "engineering-task__seal");
    seal.disabled = true;
    for (let i = 0; i < 4; i++) {
      const relay = button(`${String.fromCharCode(65 + i)} · ${t(["Registro", "Observación", "Equipo", "Diario"][i])}`, () => {
        if (step === 4) return;
        if (!relayMatches(step, i)) {
          step = 0; chips.forEach((node, index) => { node.classList.remove("is-connected"); node.classList.toggle("is-current", index === 0); });
          progress.value = 0;
          callbacks.onProgress?.(kind, 0);
          feedback("Orden interrumpido. El registro se reinició; sigue B → D → A → C.", "error"); return;
        }
        chips[step].classList.remove("is-current"); chips[step].classList.add("is-connected");
        step++; chips[step]?.classList.add("is-current"); progress.value = step * 20;
        callbacks.onProgress?.(kind, progress.value);
        if (step === 4) { seal.disabled = false; feedback("Relés verificados. Mantén el sello con el mouse, Enter o espacio.", "success"); }
        else feedback("Relé confirmado. Continúa con el siguiente de la secuencia.", "success");
      }); relays.append(relay);
    }
    function cancelHold() {
      if (holdTimer !== null) { clearTimeout(holdTimer); timers.delete(holdTimer); holdTimer = null; }
      seal.classList.remove("is-holding");
      if (!validated && step === 4) progress.value = 80;
    }
    function startHold() {
      if (step !== 4 || validated || holdTimer !== null || disposed) return;
      seal.classList.add("is-holding");
      feedback("Sellando el registro… mantén el control.");
      holdTimer = later(() => { holdTimer = null; complete(); }, 1200);
    }
    listen<PointerEvent>(seal, "pointerdown", event => { if (event.button === 0) { seal.setPointerCapture(event.pointerId); startHold(); } });
    listen(seal, "pointerup", cancelHold); listen(seal, "pointercancel", cancelHold); listen(seal, "lostpointercapture", cancelHold); listen(seal, "blur", cancelHold);
    listen<KeyboardEvent>(seal, "keydown", event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); startHold(); } });
    listen<KeyboardEvent>(seal, "keyup", event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); cancelHold(); } });
    listen(window, "blur", cancelHold); listen(document, "visibilitychange", () => { if (document.hidden) cancelHold(); });
    board.append(sequence, relays, seal);
    feedback("Verifica los relés siguiendo B → D → A → C. Una entrada incorrecta reinicia la secuencia.");
  }

  return () => { if (disposed) return; disposed = true; abort.abort(); for (const timer of timers) clearTimeout(timer); timers.clear(); root.remove(); };
}
