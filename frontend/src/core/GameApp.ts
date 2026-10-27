import { type Backdrop, type BackdropMode } from "@/babylon/BackdropEngine";
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
  "/images/jeremy-thomas-E0AHdsENmDg-unsplash.jpg",
  "/images/jorge-gardner-tCtnz_NkYG4-unsplash.jpg",
  "/images/josh-methven-qz6IXJ7dIDM-unsplash.jpg",
  "/images/nasa-7Cz6bWjdlDs-unsplash.jpg",
  "/images/nasa-GkpYlUpUOIY-unsplash.jpg",
  "/images/nasa-JZz2UYtHo1s-unsplash.jpg",
  "/images/nasa-Q1p7bh3SHj8-unsplash.jpg",
  "/images/nasa-dCgbRAQmTQA-unsplash.jpg",
  "/images/nasa-yZygONrUBe8-unsplash.jpg",
  "/images/sheeyam-bJgiy4lBFgU-unsplash.jpg",
  "/images/shot-by-cerqueira-0o_GEzyargo-unsplash.jpg",
  "/images/spacex--p-KCm6xB9I-unsplash.jpg",
  "/images/spacex-tKs_2sBoqAg-unsplash.jpg",
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
  private uiGamepadIndex: number | null = null;
  private previousUiGamepadButtons: boolean[] = [];
  private lastUiDirection: string | null = null;
  private uiGamepadRaf = 0;

  public currentUser: UserDTO | null = null;

  constructor(uiRoot: HTMLElement, canvas: HTMLCanvasElement) {
    this.uiRoot = uiRoot;
    this.canvas = canvas;
    this.menuBackdrop = document.getElementById("menu-backdrop");
    this.languageMenu = this.createLanguageMenu();
    document.getElementById("app")?.append(this.languageMenu);
    window.addEventListener("languagechange", () => void this.refreshForLanguage());
    this.chooseMenuBackground();
    this.uiGamepadRaf = requestAnimationFrame(this.pollUiGamepad);
  }

  private readonly pollUiGamepad = () => {
    if (this.activeView === "mission1" || !navigator.getGamepads) {
      this.previousUiGamepadButtons = [];
      this.lastUiDirection = null;
    } else {
      const pads = navigator.getGamepads();
      let pad = this.uiGamepadIndex === null ? null : pads[this.uiGamepadIndex];
      if (!pad?.connected) {
        pad = Array.from(pads).find(candidate => candidate?.connected) ?? null;
        this.uiGamepadIndex = pad?.index ?? null;
        this.previousUiGamepadButtons = [];
        this.lastUiDirection = null;
      }
      if (pad) {
        const pressed = (index: number) => !!pad!.buttons[index]?.pressed;
        const justPressed = (index: number) => pressed(index) && !this.previousUiGamepadButtons[index];
        const axis = (index: number) => { const value = pad!.axes[index] ?? 0; return Math.abs(value) > .55 ? value : 0; };
        const direction = pressed(12) || axis(1) < 0 ? "up" : pressed(13) || axis(1) > 0 ? "down" : pressed(14) || axis(0) < 0 ? "left" : pressed(15) || axis(0) > 0 ? "right" : null;
        if (direction && direction !== this.lastUiDirection) this.moveUiFocus(direction);
        this.lastUiDirection = direction;
        if (justPressed(0)) (document.activeElement as HTMLElement | null)?.click();
        this.previousUiGamepadButtons = pad.buttons.map(button => button.pressed);
      }
    }
    this.uiGamepadRaf = requestAnimationFrame(this.pollUiGamepad);
  };

  private moveUiFocus(direction: "up" | "down" | "left" | "right") {
    const controls = [...this.uiRoot.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,input:not(:disabled),[tabindex="0"]')].filter(node => !!node.getClientRects().length);
    if (!controls.length) return;
    const current = document.activeElement as HTMLElement | null;
    const from = current && controls.includes(current) ? current : controls[0]!;
    if (current !== from) { from.focus(); return; }
    const rect = from.getBoundingClientRect(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const candidates = controls.filter(node => node !== from).map(node => { const next = node.getBoundingClientRect(); return { node, x: next.left + next.width / 2 - cx, y: next.top + next.height / 2 - cy }; }).filter(candidate => direction === "left" ? candidate.x < 0 : direction === "right" ? candidate.x > 0 : direction === "up" ? candidate.y < 0 : candidate.y > 0);
    candidates.sort((a, b) => { const primary = direction === "left" || direction === "right" ? "x" : "y"; const secondary = primary === "x" ? "y" : "x"; return Math.abs(a[primary]) + Math.abs(a[secondary]) * .45 - (Math.abs(b[primary]) + Math.abs(b[secondary]) * .45); });
    candidates[0]?.node.focus();
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
    let previous:string|null=null;
    try{previous=sessionStorage.getItem("mm.menuBackground");}catch{/* Background rotation is optional. */}
    const available = MENU_BACKGROUNDS.filter((path) => path !== previous);
    const selected = available[Math.floor(Math.random() * available.length)] ?? MENU_BACKGROUNDS[0];
    try{sessionStorage.setItem("mm.menuBackground", selected);}catch{/* Use this background for the current page. */}
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
    const { ApolloScreen } = await import("@/apollo/ApolloScreen");
    await this.setScreen(new ApolloScreen(this, savedState));
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

  async showError(kind: "not-found" | "runtime" = "not-found"): Promise<void> {
    this.activeView = "splash";
    this.setBackdropMode("starfield");
    const { ErrorScreen } = await import("@/screens/ErrorScreen");
    await this.setScreen(new ErrorScreen(this, kind));
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
    // Apollo 11 owns a live Three.js world. Refresh its DOM and localized
    // textures in place so changing language never tears down gameplay.
    if (this.activeView === "mission1" && this.currentScreen?.refreshLanguage) {
      await this.currentScreen.refreshLanguage();
      return;
    }
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
