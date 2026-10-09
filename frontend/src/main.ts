import { GameApp } from "@/core/GameApp";

/** Bootstraps the single-page app once the DOM is ready. */
function bootstrap(): void {
  const canvas = document.getElementById("render-canvas") as HTMLCanvasElement | null;
  const uiRoot = document.getElementById("ui-root");
  if (!canvas || !uiRoot) {
    throw new Error("Missing #render-canvas or #ui-root in index.html");
  }

  const app = new GameApp(uiRoot, canvas);
  void app.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
