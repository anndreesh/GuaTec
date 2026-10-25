import { GameApp } from "@/core/GameApp";

let appInstance: GameApp | null = null;

/** Bootstraps the single-page app once the DOM is ready. */
function bootstrap(): void {
  const canvas = document.getElementById("render-canvas") as HTMLCanvasElement | null;
  const uiRoot = document.getElementById("ui-root");
  if (!canvas || !uiRoot) {
    throw new Error("Missing #render-canvas or #ui-root in index.html");
  }

  const app = new GameApp(uiRoot, canvas);
  appInstance = app;
  const validPath = window.location.pathname === "/" || window.location.pathname === "/index.html";
  if (!validPath) {
    void app.showError("not-found");
    return;
  }
  void app.start().catch((error: unknown) => {
    console.error("GuaTec failed to start", error);
    void app.showError("runtime");
  });
}

window.addEventListener("error", (event) => {
  const root = document.getElementById("ui-root");
  if (!root || root.querySelector(".error-screen")) return;
  console.error("GuaTec runtime error", event.error ?? event.message);
  if (appInstance) void appInstance.showError("runtime");
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("GuaTec unhandled rejection", event.reason);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
