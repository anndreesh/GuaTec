import { el } from "@/core/dom";
import type { GameApp } from "@/core/GameApp";
import type { Screen } from "@/screens/Screen";
import { t } from "@/core/i18n";
import { apolloText } from "@/apollo/ApolloLocale";

/** First screen shown: title card + "Comenzar" entry point into auth flow. */
export class SplashScreen implements Screen {
  constructor(private app: GameApp) {}

  mount(container: HTMLElement): void {
    const panel = el("div", { className: "screen splash-screen" });

    panel.append(
      el("div", { className: "splash-badge", text: "NASA SPACE CHALLENGE 2026" }),
      el("h1", { className: "splash-title", text: "GuaTec: NASA Space 2026" }),
      el("p", {
        className: "splash-subtitle",
        text: apolloText("Explora la historia espacial: observa, experimenta y vive el lanzamiento del Apollo 11."),
      }),
      el("button", {
        className: "btn btn-primary btn-large",
        text: t("Comenzar"),
        attrs: { type: "button" },
      }),
    );

    const startButton = panel.querySelector("button")!;
    startButton.addEventListener("click", () => {
      void this.app.showAuth();
    });

    container.append(panel);
  }

  unmount(): void {
    /* nothing to clean up: no timers/listeners outlive the DOM node */
  }
}
