import { el } from "../core/dom";
import { getLanguage } from "../core/i18n";
import { fieldTaskResult, type FieldTaskDraft, type MissionMiniGameResult } from "../state/Mission01FieldTasks";
import "../mission-cinematic.css";

export interface FlightRecordRecoveryCallbacks {
  onValidated(result: MissionMiniGameResult): void;
  onDraft(draft: FieldTaskDraft): void;
  onFeedback?(type: "input" | "error" | "success"): void;
}

const COPY = {
  title: ["REGISTROS RECUPERADOS", "RECOVERED RECORDS", "RELEVÉS RÉCUPÉRÉS"],
  instructions: ["Reconstruye el vuelo. Arrastra las tarjetas o usa las flechas para ordenar sus cuatro marcas de tiempo; después registra la secuencia.", "Reconstruct the flight. Drag the cards or use the arrows to order their four timestamps, then record the sequence.", "Reconstituez le vol. Glissez les fiches ou utilisez les flèches pour classer leurs quatre heures, puis enregistrez la séquence."],
  recorder: ["El registrador comienza a marcar", "The recorder begins marking", "L’enregistreur commence à tracer"],
  liftoff: ["El vehículo abandona la guía", "The vehicle leaves the guide", "Le véhicule quitte le guide"],
  peak: ["La técnica marca la altura máxima", "The technician marks peak altitude", "La technicienne marque l’altitude maximale"],
  distance: ["El equipo registra la distancia", "The crew records the distance", "L’équipe relève la distance"],
  move: ["Mover tarjeta", "Move card", "Déplacer la fiche"],
  up: ["Mover arriba", "Move up", "Monter"],
  down: ["Mover abajo", "Move down", "Descendre"],
  register: ["Registrar secuencia", "Record sequence", "Enregistrer la séquence"],
  hint: ["Empieza por la primera marca del registrador y termina con la distancia observada.", "Begin with the recorder’s first mark and finish with the observed distance.", "Commencez par la première marque de l’enregistreur et terminez par la distance observée."],
  moved: ["Tarjeta recolocada. Comprueba la secuencia antes de registrarla.", "Card moved. Check the sequence before recording it.", "Fiche déplacée. Vérifiez la séquence avant de l’enregistrer."],
  error: ["Hay una marca fuera de orden. Compara las horas y vuelve a registrar; puedes corregir todas las tarjetas.", "A timestamp is out of order. Compare the times and record again; every card can still be corrected.", "Une heure n’est pas dans l’ordre. Comparez les heures et réessayez ; toutes les fiches peuvent encore être corrigées."],
  success: ["Secuencia restaurada. Las cuatro observaciones están listas para el informe.", "Sequence restored. All four observations are ready for the report.", "Séquence rétablie. Les quatre observations sont prêtes pour le rapport."],
  verified: ["REGISTRO VALIDADO", "RECORD VALIDATED", "RELEVÉ VALIDÉ"],
  keyboard: ["En el asa: ↑/↓ mueve la tarjeta; Inicio/Fin la lleva al extremo.", "On the handle: ↑/↓ moves the card; Home/End moves it to either end.", "Sur la poignée : ↑/↓ déplace la fiche ; Début/Fin la place à une extrémité."],
} as const;

function text(key: keyof typeof COPY): string {
  return COPY[key][{ es: 0, en: 1, fr: 2 }[getLanguage()]];
}

const EVENTS = [
  { id: "recorder", time: "06:32:58", copy: "recorder", art: "recorder" },
  { id: "liftoff", time: "06:33:00", copy: "liftoff", art: "liftoff" },
  { id: "peak", time: "06:33:10", copy: "peak", art: "peak" },
  { id: "distance", time: "06:33:18", copy: "distance", art: "distance" },
] as const;
const CORRECT_ORDER = EVENTS.map(event => event.id);

function counter(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(999, Math.floor(value))) : 0;
}

/** Pointer sorting and equivalent keyboard controls share one persisted ordering. */
export function mountFlightRecordRecovery(host: HTMLElement, callbacks: FlightRecordRecoveryCallbacks, draft?: FieldTaskDraft): () => void {
  const abort = new AbortController();
  let disposed = false;
  let validated = false;
  let attempts = counter(draft?.attempts);
  let mistakes = counter(draft?.mistakes);
  const savedOrder = draft?.order;
  let order: string[] = Array.isArray(savedOrder) && savedOrder.length === EVENTS.length &&
    new Set<unknown>(savedOrder).size === EVENTS.length && savedOrder.every(id => typeof id === "string" && CORRECT_ORDER.includes(id as typeof CORRECT_ORDER[number]))
    ? [...savedOrder] as string[] : ["peak", "distance", "liftoff", "recorder"];
  validated = draft?.registered === true && order.every((id, index) => id === CORRECT_ORDER[index]);
  const root = el("section", { className: "flight-recovery", attrs: { "aria-label": text("title") } });
  const heading = el("div", { className: "flight-recovery__heading", children: [
    el("span", { text: "AUBURN · 1926" }), el("strong", { text: text("title") }),
  ] });
  const rows = el("ol", { className: "flight-recovery__timeline" });
  const status = el("p", { className: "flight-recovery__status", text: text("hint"), attrs: { role: "status", "aria-live": "polite" } });
  const register = el("button", { className: "flight-recovery__register", text: text("register"), attrs: { type: "button" } });
  root.append(heading, el("p", { className: "flight-recovery__instructions", text: text("instructions") }), rows,
    el("p", { className: "flight-recovery__keyboard", text: text("keyboard") }), status, register);
  host.append(root);

  const cards = new Map<string, HTMLLIElement>();
  let activePointer: { id: number; cardId: string; startY: number; handle: HTMLButtonElement; moved: boolean } | null = null;

  function saveDraft(): void {
    if (!disposed) callbacks.onDraft({ order: [...order], attempts, mistakes, registered: validated });
  }

  function feedback(kind: "input" | "error" | "success", key: "moved" | "error" | "success"): void {
    status.textContent = text(key);
    status.dataset.state = kind;
    callbacks.onFeedback?.(kind);
  }

  function render(): void {
    const focused = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null;
    order.forEach((id, index) => {
      const card = cards.get(id)!;
      card.querySelector<HTMLElement>(".flight-recovery__position")!.textContent = String(index + 1).padStart(2, "0");
      card.querySelector<HTMLButtonElement>("[data-move=up]")!.disabled = validated || index === 0;
      card.querySelector<HTMLButtonElement>("[data-move=down]")!.disabled = validated || index === order.length - 1;
      card.querySelector<HTMLButtonElement>(".flight-recovery__handle")!.disabled = validated;
      card.classList.remove("is-ambiguous");
      rows.append(card);
    });
    focused?.focus({ preventScroll: true });
  }

  function moveCard(id: string, targetIndex: number): void {
    if (disposed || validated) return;
    const sourceIndex = order.indexOf(id);
    const destination = Math.max(0, Math.min(order.length - 1, targetIndex));
    if (sourceIndex < 0 || sourceIndex === destination) return;
    order.splice(sourceIndex, 1);
    order.splice(destination, 0, id);
    render();
    saveDraft();
    feedback("input", "moved");
  }

  function cancelDrag(): void {
    const previous = activePointer;
    activePointer = null;
    if (!previous) return;
    const card = cards.get(previous.cardId);
    card?.classList.remove("is-dragging");
    card?.style.removeProperty("--drag-y");
    if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
  }

  EVENTS.forEach(event => {
    const card = el("li", { className: "flight-recovery__card mission-record-row", attrs: { "data-record": event.id } });
    const handle = el("button", { className: "flight-recovery__handle", text: "⠿", attrs: {
      type: "button", "aria-label": `${text("move")}: ${text(event.copy)}`,
    } });
    const up = el("button", { className: "flight-recovery__move mission-record-move", text: "↑", attrs: {
      type: "button", "data-move": "up", "aria-label": `${text("up")}: ${text(event.copy)}`,
    } });
    const down = el("button", { className: "flight-recovery__move mission-record-move", text: "↓", attrs: {
      type: "button", "data-move": "down", "aria-label": `${text("down")}: ${text(event.copy)}`,
    } });
    card.append(handle, el("span", { className: "flight-recovery__position", attrs: { "aria-hidden": "true" } }),
      el("span", { className: `flight-recovery__plate flight-recovery__plate--${event.art}`, attrs: { "aria-hidden": "true" } }),
      el("div", { className: "flight-recovery__description", children: [el("strong", { text: event.time }), el("span", { text: text(event.copy) })] }),
      el("div", { className: "flight-recovery__controls", children: [up, down] }));
    cards.set(event.id, card);
    up.addEventListener("click", () => moveCard(event.id, order.indexOf(event.id) - 1), { signal: abort.signal });
    down.addEventListener("click", () => moveCard(event.id, order.indexOf(event.id) + 1), { signal: abort.signal });
    handle.addEventListener("keydown", keyboard => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(keyboard.key)) return;
      keyboard.preventDefault();
      moveCard(event.id, keyboard.key === "Home" ? 0 : keyboard.key === "End" ? order.length - 1 : order.indexOf(event.id) + (keyboard.key === "ArrowUp" ? -1 : 1));
    }, { signal: abort.signal });
    handle.addEventListener("pointerdown", pointer => {
      if (pointer.button !== 0 || disposed || validated) return;
      cancelDrag();
      pointer.preventDefault();
      handle.focus({ preventScroll: true });
      activePointer = { id: pointer.pointerId, cardId: event.id, startY: pointer.clientY, handle, moved: false };
      handle.setPointerCapture(pointer.pointerId);
    }, { signal: abort.signal });
    handle.addEventListener("pointermove", pointer => {
      if (!activePointer || activePointer.id !== pointer.pointerId) return;
      const delta = pointer.clientY - activePointer.startY;
      if (Math.abs(delta) > 5) activePointer.moved = true;
      if (!activePointer.moved) return;
      card.classList.add("is-dragging");
      card.style.setProperty("--drag-y", `${delta}px`);
    }, { signal: abort.signal });
    handle.addEventListener("pointerup", pointer => {
      if (!activePointer || activePointer.id !== pointer.pointerId) return;
      const moved = activePointer.moved;
      cancelDrag();
      if (!moved) return;
      // Geometry remains in DOM order during the drag; choose the nearest resting slot.
      let target = order.indexOf(event.id);
      let distance = Infinity;
      order.forEach((id, index) => {
        const bounds = cards.get(id)!.getBoundingClientRect();
        const candidate = Math.abs(pointer.clientY - (bounds.top + bounds.height / 2));
        if (candidate < distance) { distance = candidate; target = index; }
      });
      moveCard(event.id, target);
    }, { signal: abort.signal });
    handle.addEventListener("pointercancel", cancelDrag, { signal: abort.signal });
    handle.addEventListener("lostpointercapture", cancelDrag, { signal: abort.signal });
  });

  register.addEventListener("click", () => {
    if (disposed || validated) return;
    attempts = Math.min(999, attempts + 1);
    const wrongIndex = order.findIndex((id, index) => id !== CORRECT_ORDER[index]);
    if (wrongIndex >= 0) {
      mistakes = Math.min(999, mistakes + 1);
      saveDraft();
      cards.get(order[wrongIndex])!.classList.add("is-ambiguous");
      feedback("error", "error");
      return;
    }
    cancelDrag();
    validated = true;
    saveDraft();
    root.classList.add("flight-recovery--validated");
    register.disabled = true;
    register.textContent = text("verified");
    render();
    feedback("success", "success");
    callbacks.onValidated(fieldTaskResult("recovery", attempts, mistakes));
  }, { signal: abort.signal });
  window.addEventListener("blur", cancelDrag, { signal: abort.signal });
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelDrag(); }, { signal: abort.signal });
  render();
  if (validated) {
    root.classList.add("flight-recovery--validated");
    register.disabled = true;
    register.textContent = text("verified");
    status.textContent = text("success");
    status.dataset.state = "success";
    callbacks.onValidated(fieldTaskResult("recovery", attempts, mistakes));
  }
  saveDraft();

  return () => {
    if (disposed) return;
    cancelDrag();
    disposed = true;
    abort.abort();
    root.remove();
  };
}
