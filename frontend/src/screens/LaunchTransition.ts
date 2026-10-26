import { el } from "../core/dom";
import { getLanguage } from "../core/i18n";
import "../mission-cinematic.css";

export type LaunchCinematicPhase =
  | "idle"
  | "vehicle-out-of-frame"
  | "fade-to-black"
  | "black-hold"
  | "fade-to-result"
  | "complete";

export interface LaunchTransitionOptions {
  onComplete(): void;
  /** Persist the recorded flight before handing control back to the mission. */
  onSave(): Promise<void> | void;
  reducedMotion?: boolean;
}

export interface LaunchTransitionController {
  readonly phase: LaunchCinematicPhase;
  start(): void;
  dispose(): void;
}

const COPY = {
  heading: ["OBSERVACIÓN DEL VUELO", "FLIGHT OBSERVATION", "OBSERVATION DU VOL"],
  recording: ["Registrando la última pasada de telemetría…", "Recording the final telemetry pass…", "Enregistrement du dernier passage de télémétrie…"],
  saving: ["Guardando el registro de vuelo…", "Saving the flight record…", "Sauvegarde du relevé de vol…"],
  skip: ["Continuar al resultado", "Continue to the result", "Continuer vers le résultat"],
  error: ["No se pudo guardar el vuelo. Reintenta para conservar el registro antes de continuar.", "The flight could not be saved. Retry to preserve the record before continuing.", "Le vol n’a pas pu être sauvegardé. Réessayez pour conserver le relevé avant de continuer."],
  retry: ["Reintentar guardado", "Retry saving", "Réessayer la sauvegarde"],
} as const;

function text(key: keyof typeof COPY): string {
  return COPY[key][{ es: 0, en: 1, fr: 2 }[getLanguage()]];
}

/** One DOM overlay over the existing scene, driven by elapsed time rather than frames. */
export function mountLaunchTransition(host: HTMLElement, options: LaunchTransitionOptions): LaunchTransitionController {
  const abort = new AbortController();
  const reduced = options.reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durations = reduced
    ? { empty: 60, fadeIn: 120, hold: 500, fadeOut: 120 }
    : { empty: 400, fadeIn: 700, hold: 1000, fadeOut: 500 };
  const root = el("div", {
    className: "mission-cinematic-transition",
    attrs: { "aria-hidden": "true", "data-phase": "idle" },
  });
  root.hidden = true;
  root.style.setProperty("--cinematic-fade-in", `${durations.fadeIn}ms`);
  root.style.setProperty("--cinematic-fade-out", `${durations.fadeOut}ms`);
  const heading = el("h2", { className: "mission-cinematic-transition__heading", text: text("heading") });
  const message = el("p", { className: "mission-cinematic-transition__message", text: text("recording"), attrs: { role: "status", "aria-live": "polite" } });
  const skip = el("button", { className: "mission-cinematic-transition__button", text: text("skip"), attrs: { type: "button" } });
  const retry = el("button", { className: "mission-cinematic-transition__button", text: text("retry"), attrs: { type: "button" } });
  skip.hidden = true;
  retry.hidden = true;
  const content = el("div", { className: "mission-cinematic-transition__content", children: [
    el("span", { className: "mission-cinematic-transition__rule", attrs: { "aria-hidden": "true" } }), heading, message,
  ] });
  root.append(content, skip, retry);
  host.append(root);

  let phase: LaunchCinematicPhase = "idle";
  let disposed = false;
  let startedAt = 0;
  let fadeOutAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let savePending = false;
  let saveFailed = false;
  let completed = false;
  let previousFocus: HTMLElement | null = null;

  function setPhase(next: LaunchCinematicPhase): void {
    const previousPhase = phase;
    phase = next;
    root.dataset.phase = next;
    skip.hidden = !(next === "fade-to-black" || next === "black-hold") || savePending || saveFailed;
    if (next === "fade-to-black" && previousPhase !== next && !skip.hidden) skip.focus({ preventScroll: true });
  }

  function schedule(ms: number): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(update, Math.max(0, ms));
  }

  function complete(): void {
    if (disposed || completed) return;
    completed = true;
    setPhase("complete");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    abort.abort();
    options.onComplete();
  }

  async function saveAndExit(): Promise<void> {
    if (disposed || completed || savePending || phase === "fade-to-result") return;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    savePending = true;
    saveFailed = false;
    retry.hidden = true;
    root.classList.remove("mission-cinematic-transition--error");
    setPhase("black-hold");
    message.textContent = text("saving");
    root.setAttribute("aria-busy", "true");
    try {
      await options.onSave();
    } catch {
      if (disposed) return;
      savePending = false;
      saveFailed = true;
      root.removeAttribute("aria-busy");
      root.classList.add("mission-cinematic-transition--error");
      message.textContent = text("error");
      retry.hidden = false;
      retry.focus({ preventScroll: true });
      return;
    }
    if (disposed) return;
    savePending = false;
    root.removeAttribute("aria-busy");
    fadeOutAt = performance.now();
    setPhase("fade-to-result");
    schedule(durations.fadeOut);
  }

  function update(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (disposed || completed || phase === "idle" || savePending || saveFailed) return;
    const now = performance.now();
    if (phase === "fade-to-result") {
      const remaining = durations.fadeOut - (now - fadeOutAt);
      if (remaining <= 0) complete();
      else schedule(remaining);
      return;
    }
    const elapsed = now - startedAt;
    if (elapsed < durations.empty) {
      setPhase("vehicle-out-of-frame");
      schedule(durations.empty - elapsed);
    } else if (elapsed < durations.empty + durations.fadeIn) {
      setPhase("fade-to-black");
      schedule(durations.empty + durations.fadeIn - elapsed);
    } else if (elapsed < durations.empty + durations.fadeIn + durations.hold) {
      setPhase("black-hold");
      schedule(durations.empty + durations.fadeIn + durations.hold - elapsed);
    } else {
      void saveAndExit();
    }
  }

  skip.addEventListener("click", () => void saveAndExit(), { signal: abort.signal });
  retry.addEventListener("click", () => void saveAndExit(), { signal: abort.signal });
  root.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    event.stopPropagation();
    const control = !retry.hidden ? retry : !skip.hidden ? skip : null;
    control?.focus({ preventScroll: true });
  }, { signal: abort.signal });
  // Background tabs throttle timers. Reconcile against the original deadline on return.
  document.addEventListener("visibilitychange", update, { signal: abort.signal });
  window.addEventListener("pageshow", update, { signal: abort.signal });

  return {
    get phase() { return phase; },
    start() {
      if (disposed || phase !== "idle") return;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      startedAt = performance.now();
      setPhase("vehicle-out-of-frame");
      update();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      abort.abort();
      if (root.contains(document.activeElement) && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      root.remove();
    },
  };
}
