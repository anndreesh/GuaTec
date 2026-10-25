import { el } from "@/core/dom";
import { t } from "@/core/i18n";
import type { GameApp } from "@/core/GameApp";
import type { Screen } from "@/screens/Screen";

export type ErrorScreenKind = "not-found" | "runtime";

/** Calm, recoverable failure state for invalid routes and unexpected boot errors. */
export class ErrorScreen implements Screen {
  constructor(private app: GameApp, private kind: ErrorScreenKind = "not-found") {}

  mount(container: HTMLElement): void {
    const isRuntime = this.kind === "runtime";
    const panel = el("main", { className: "screen error-screen", attrs: { role: "main" } });
    panel.append(
      el("p", { className: "error-screen__code", text: isRuntime ? "ERR / 500" : "ERR / 404" }),
      el("h1", { className: "error-screen__title", text: t(isRuntime ? "La misión encontró una anomalía" : "La coordenada no existe") }),
      el("p", { className: "error-screen__message", text: t(isRuntime ? "El sistema no pudo completar esta maniobra. Vuelve al centro de misión e inténtalo de nuevo." : "Esta ruta quedó fuera del mapa de GuaTec. Regresa al centro de misión para continuar la expedición.") }),
    );
    const back = el("button", { className: "btn btn-primary error-screen__action", text: t("Volver al centro de misión"), attrs: { type: "button" } });
    back.addEventListener("click", () => void this.app.showSplash());
    panel.append(back);
    container.replaceChildren(panel);
  }

  unmount(): void {
    /* The screen owns no external listeners. */
  }
}
