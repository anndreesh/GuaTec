import { createBackdrop, type Backdrop, type BackdropMode } from "@/babylon/BackdropEngine";
import type { GameplayHandle } from "@/babylon/gameplay/GameplayLayer";
import { AuthStore } from "@/core/AuthStore";
import { loadingFeedback } from "@/core/dom";
import { userApi } from "@/api/userApi";
import { getLanguage, languageName, setLanguage, t, type Language } from "@/core/i18n";
import type { UserDTO } from "@/types";
import type { Screen } from "@/screens/Screen";

const MENU_BACKGROUNDS = [
  "/images/rocket-liftoff.jpeg",
  "/images/launch-pad-sunset.jpeg",
  "/images/magnetosphere.jpeg",
  "/images/earthrise-moon.jpg",
  "/images/astronaut-spacewalk.webp",
  "/images/tomato-seeds-experiment.avif",
  "/images/sls-rocket-pad.jpeg",
  "/images/shuttle-launch.jpeg",
] as const;

/**
 * Root application controller: owns the ambient Babylon(-or-fallback)
 * backdrop, the currently authenticated user, and swaps the active
 * full-screen `Screen` in and out of the `#ui-root` DOM node.
 *
 * Screens are created lazily (dynamic import) to keep the initial bundle
 * small and to avoid any screen depending on another at module load time.
 */
export class GameApp {
  private backdrop: Backdrop | null = null;
  private currentScreen: Screen | null = null;
  private uiRoot: HTMLElement;
  private canvas: HTMLCanvasElement;
  private menuBackdrop: HTMLElement | null;
  private activeView: "splash" | "auth" | "username" | "missions" | "mission1" | "report" = "splash";
  private activeReportSlug: string | null = null;
  private languageMenu: HTMLElement;

  public currentUser: UserDTO | null = null;

  constructor(uiRoot: HTMLElement, canvas: HTMLCanvasElement) {
    this.uiRoot = uiRoot;
    this.canvas = canvas;
    this.menuBackdrop = document.getElementById("menu-backdrop");
    this.languageMenu = this.createLanguageMenu();
    document.getElementById("app")?.append(this.languageMenu);
    this.chooseMenuBackground();
  }

  private createLanguageMenu(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "language-menu";
    const button = document.createElement("button");
    button.className = "language-menu-trigger";
    button.type = "button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    const list = document.createElement("div");
    list.className = "language-menu-list";
    list.setAttribute("role", "listbox");
    const options: Language[] = ["es", "en", "fr"];
    const render = () => {
      button.textContent = getLanguage().toUpperCase();
      list.innerHTML = "";
      options.forEach((language) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = `language-option ${language === getLanguage() ? "language-option--selected" : ""}`;
        option.textContent = `${language.toUpperCase()} — ${languageName(language)}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(language === getLanguage()));
        option.addEventListener("click", () => {
          setLanguage(language);
          render();
          list.classList.remove("language-menu-list--open");
          button.setAttribute("aria-expanded", "false");
          void this.refreshForLanguage();
        });
        list.append(option);
      });
    };
    button.addEventListener("click", () => {
      const open = list.classList.toggle("language-menu-list--open");
      button.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target as Node)) {
        list.classList.remove("language-menu-list--open");
        button.setAttribute("aria-expanded", "false");
      }
    });
    wrapper.append(button, list);
    render();
    return wrapper;
  }

  async start(): Promise<void> {
    this.uiRoot.replaceChildren(loadingFeedback(t("Cargando...")));
    this.backdrop = await createBackdrop(this.canvas);

    const handledOAuthCallback = this.consumeOAuthCallbackIfPresent();

    const token = AuthStore.getToken();
    if (!token) {
      await this.showSplash();
      return;
    }

    try {
      this.currentUser = await userApi.me();
    } catch {
      AuthStore.clearToken();
      await this.showSplash();
      return;
    }

    const pendingOAuthEmail = AuthStore.getPendingOAuthEmail();
    if (pendingOAuthEmail) {
      AuthStore.clearPendingOAuthEmail();
      await this.showAuth();
      return;
    }

    if (handledOAuthCallback || !this.currentUser.hasUsername) {
      if (!this.currentUser.hasUsername) {
        await this.showUsername();
        return;
      }
    }
    await this.showMissionSelect();
  }

  setBackdropMode(mode: BackdropMode): void {
    this.backdrop?.setMode(mode);
    const isMenu = mode !== "mission1-gameplay";
    this.menuBackdrop?.classList.toggle("menu-backdrop--hidden", !isMenu);
    this.canvas.classList.toggle("render-canvas--menu-hidden", isMenu);
  }

  private chooseMenuBackground(): string {
    const previous = sessionStorage.getItem("mm.menuBackground");
    const available = MENU_BACKGROUNDS.filter((path) => path !== previous);
    const selected = available[Math.floor(Math.random() * available.length)] ?? MENU_BACKGROUNDS[0];
    sessionStorage.setItem("mm.menuBackground", selected);
    if (this.menuBackdrop) {
      this.menuBackdrop.style.backgroundImage = `url("${selected}")`;
    }
    return selected;
  }

  /** Detects OAuth redirects from the backend and handles the final username setup step. */
  private consumeOAuthCallbackIfPresent(): boolean {
    const hash = window.location.hash;
    if (!hash.startsWith("#/auth/")) return false;

    const query = hash.split("?")[1] ?? "";
    const params = new URLSearchParams(query);
    const token = params.get("token");
    const email = params.get("email");
    if (token) {
      AuthStore.setToken(token);
    }
    if (email) {
      AuthStore.setPendingOAuthEmail(email);
    }

    if (hash.startsWith("#/auth/complete-oauth")) {
      window.location.hash = "";
      return true;
    }

    if (hash.startsWith("#/auth/callback")) {
      window.location.hash = "";
      return true;
    }

    window.location.hash = "";
    return true;
  }

  private async setScreen(screen: Screen): Promise<void> {
    this.currentScreen?.unmount();
    this.uiRoot.innerHTML = "";
    this.currentScreen = screen;
    await screen.mount(this.uiRoot);
  }

  async showSplash(): Promise<void> {
    this.activeView = "splash";
    this.setBackdropMode("starfield");
    const { SplashScreen } = await import("@/screens/SplashScreen");
    await this.setScreen(new SplashScreen(this));
  }

  async showAuth(): Promise<void> {
    this.activeView = "auth";
    this.setBackdropMode("starfield");
    const { AuthScreen } = await import("@/screens/AuthScreen");
    await this.setScreen(new AuthScreen(this));
  }

  async showUsername(): Promise<void> {
    this.activeView = "username";
    this.setBackdropMode("mars-orbit");
    const { UsernameScreen } = await import("@/screens/UsernameScreen");
    await this.setScreen(new UsernameScreen(this));
  }

  async showMissionSelect(): Promise<void> {
    this.activeView = "missions";
    this.setBackdropMode("mars-orbit");
    const { MissionSelectScreen } = await import("@/screens/MissionSelectScreen");
    await this.setScreen(new MissionSelectScreen(this));
  }

  async showMission1(savedState?: unknown): Promise<void> {
    this.activeView = "mission1";
    this.setBackdropMode("mission1-gameplay");
    const { Mission1Screen } = await import("@/screens/Mission1Screen");
    await this.setScreen(new Mission1Screen(this, savedState));
  }

  /** Interactive handle (WASD player, POI proximity/interact callbacks) for
   * the current playable third-person scene, or `null` when the active
   * backdrop mode isn't a gameplay scene (or Babylon.js is unavailable). */
  getGameplayHandle(): GameplayHandle | null {
    return this.backdrop?.getGameplayHandle() ?? null;
  }

  async showReport(missionSlug: string): Promise<void> {
    this.activeView = "report";
    this.activeReportSlug = missionSlug;
    this.setBackdropMode("mars-orbit");
    const { ReportScreen } = await import("@/screens/ReportScreen");
    await this.setScreen(new ReportScreen(this, missionSlug));
  }

  async refreshCurrentUser(): Promise<void> {
    this.currentUser = await userApi.me();
  }

  logout(): void {
    AuthStore.clearToken();
    this.currentUser = null;
    void this.showSplash();
  }

  private async refreshForLanguage(): Promise<void> {
    switch (this.activeView) {
      case "splash":
        await this.showSplash();
        break;
      case "auth":
        await this.showAuth();
        break;
      case "username":
        await this.showUsername();
        break;
      case "missions":
        await this.showMissionSelect();
        break;
      case "mission1":
        await this.showMission1(this.currentScreen?.languageRefreshState?.());
        break;
      case "report":
        if (this.activeReportSlug) await this.showReport(this.activeReportSlug);
        break;
    }
  }
}
