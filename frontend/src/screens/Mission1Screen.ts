import { inventoryApi } from "@/api/inventoryApi";
import { progressApi } from "@/api/progressApi";
import { samplesApi } from "@/api/samplesApi";
import { statisticsApi } from "@/api/statisticsApi";
import {
  AUTOSAVE_INTERVAL_MS,
  MISSION_1_PHASES,
  MISSION_1_POIS,
  MISSION_1_TIMELINE_EVENTS,
  MISSION_SLUGS,
  RESOURCE_DEFINITIONS,
  type DecisionEvent,
} from "@/config/gameConfig";
import { el } from "@/core/dom";
import type { GameApp } from "@/core/GameApp";
import type { GameplayHandle, GameplayMapState, NearbyPoi } from "@/babylon/gameplay/GameplayLayer";
import { Mission1State } from "@/state/Mission1State";
import { MAP_OBJECTIVE_TARGET, MISSION_01_OBJECTIVES, mapTargetForObjective, type MissionObjectiveId } from "@/state/Mission01Objectives";
import { DESIGN_BUDGET, calculateEngineering, type EngineeringProfile } from "@/state/Mission01Engineering";
import { LAUNCH_DELAY_BUDGET_COST, flightPeakAltitude, flightResultLabel, resolveFlight } from "@/state/Mission01Launch";
import { MISSION_01_DIAGNOSTIC_CAUSES, MISSION_01_DIALOGUE } from "@/state/Mission01Events";
import type { Screen } from "@/screens/Screen";
import type { MissionSaveState } from "@/types";
import { t } from "@/core/i18n";
import { missionAudio } from "@/core/MissionAudio";

const MISSION_SLUG = MISSION_SLUGS.mission1;
const CHECKLIST_LABELS: Record<string, string> = {
  "inspect-vehicle": "Inspect vehicle",
  "check-instruments": "Check instruments",
  "review-conditions": "Review conditions",
  "confirm-observation": "Confirm observation area",
  "confirm-telemetry": "Confirm telemetry",
};

/** The playable Mission 1 loop: a third-person Earth test-range scene
 * (WASD movement, sprint, jump + follow camera) layered under resource bars, a
 * narrative phase stepper, decision modals, autosave, and hand-off to the
 * report screen at the end. */
export class Mission1Screen implements Screen {
  private state = new Mission1State();
  private tickTimer: number | undefined;
  private autosaveTimer: number | undefined;
  private toastTimer: number | undefined;
  private launchTimer: number | undefined;
  private flightTimer: number | undefined;
  private paused = false;
  private ended = false;
  private restarting = false;
  private readonly pendingAutosaves = new Set<Promise<void>>();

  private resourceBars = new Map<string, HTMLElement>();
  private logPanel: HTMLElement | null = null;
  private modalRoot: HTMLElement | null = null;
  private phasePanel: HTMLElement | null = null;
  private phaseStepper: HTMLElement | null = null;
  private objectivePanel: HTMLElement | null = null;
  private interactionPrompt: HTMLElement | null = null;
  private mobileInteractButton: HTMLButtonElement | null = null;
  private toast: HTMLElement | null = null;
  private gameplay: GameplayHandle | null = null;
  private flightMetrics: HTMLElement | null = null;
  private missionPanel: HTMLElement | null = null;
  private restorePanelButton: HTMLButtonElement | null = null;
  private mapOverlay: HTMLElement | null = null;
  private mapGrid: HTMLElement | null = null;
  private mapLocations: HTMLElement | null = null;
  private mapPlayer: HTMLElement | null = null;
  private mapRoute: HTMLElement | null = null;
  private mapDistance: HTMLElement | null = null;
  private mapState: GameplayMapState | null = null;
  private routeVisible = false;
  private renderedMapObjectiveId = "";
  private mapSignature = "";
  private lastRadioAt = 0;
  private launchDayAnnounced = false;
  private readonly onMapKey = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() === "m" && !this.isTypingTarget(event.target)) this.toggleMap();
  };
  private readonly onPanelToggleKey = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() === "h" && !this.isTypingTarget(event.target)) {
      this.togglePanel();
    }
  };

  constructor(private app: GameApp, private initialState?: unknown) {}

  languageRefreshState(): unknown {
    return this.state?.toSaveState();
  }

  async mount(container: HTMLElement): Promise<void> {
    let savedState: MissionSaveState | undefined = this.initialState as MissionSaveState | undefined;
    if (!savedState) {
      try {
        const progress = await progressApi.get(MISSION_SLUG);
        if (progress.state && "tick" in progress.state) {
          savedState = progress.state as MissionSaveState;
        }
      } catch {
        // No saved progress yet; start fresh.
      }
    }
    this.state = new Mission1State(savedState);

    const panel = el("div", { className: "screen mission1-screen" });
    const phasePanel = el("div", { className: "phase-panel", attrs: { id: "phase-panel" } });
    const phaseStepper = el("div", { className: "phase-stepper", attrs: { id: "phase-stepper" } });
    const resourcesPanel = el("div", { className: "resources-panel", attrs: { id: "resources-panel" } });
    const logPanel = el("div", { className: "log-panel", attrs: { id: "log-panel" } });
    this.objectivePanel = el("section", { className: "mission-objectives" });
    const tickLabel = el("div", { className: "tick-label", attrs: { id: "tick-label" } });
    const backButton = el("button", { className: "btn btn-ghost", text: t("← Misiones"), attrs: { type: "button" } });
    const minimizeButton = el("button", {
      className: "btn btn-ghost mission-panel-toggle",
      text: t("− Minimizar"),
      attrs: { type: "button", "aria-label": t("Minimizar panel de misión") },
    });
    const restartButton = el("button", {
      className: "btn btn-ghost mission-panel-restart",
      text: t("↻ Restart mission"),
      attrs: { type: "button", "aria-label": t("Restart mission") },
    });
    restartButton.addEventListener("click", () => this.confirmRestartMission());

    panel.append(
      el("div", { className: "mission1-header" }),
      tickLabel,
      phaseStepper,
      phasePanel,
      this.objectivePanel,
      resourcesPanel,
      logPanel,
    );
    panel.querySelector(".mission1-header")!.append(
      el("h2", { className: "screen-title", text: t("Misión 1: The Beginning") }),
      minimizeButton,
      restartButton,
      backButton,
    );

    backButton.addEventListener("click", () => this.stopTimers());
    backButton.addEventListener("click", () => void this.app.showMissionSelect());

    for (const def of RESOURCE_DEFINITIONS) {
      const bar = el("div", { className: "resource-row" });
      const label = el("span", { className: "resource-label", text: t(def.label) });
      const track = el("div", { className: "resource-track" });
      const fill = el("div", { className: "resource-fill" });
      track.append(fill);
      const value = el("span", { className: "resource-value" });
      bar.append(label, track, value);
      resourcesPanel.append(bar);
      this.resourceBars.set(def.key, fill);
      (bar as HTMLElement & { valueLabel?: HTMLElement }).valueLabel = value;
    }

    this.logPanel = logPanel;
    this.missionPanel = panel;
    this.phasePanel = phasePanel;
    this.phaseStepper = phaseStepper;
    container.append(panel);
    minimizeButton.addEventListener("click", () => this.togglePanel());
    this.restorePanelButton = el("button", {
      className: "btn btn-primary mission-panel-restore mission-panel-restore--hidden",
      text: t("☰ Abrir panel"),
      attrs: { type: "button", "aria-label": t("Abrir panel de misión") },
    });
    this.restorePanelButton.addEventListener("click", () => this.togglePanel(false));
    container.append(this.restorePanelButton);
    window.addEventListener("keydown", this.onPanelToggleKey);

    this.modalRoot = el("div", { className: "modal-overlay modal-overlay--hidden" });
    container.append(this.modalRoot);

    // Floating HUD elements that sit over the 3D scene rather than inside
    // the scrollable narrative card.
    this.interactionPrompt = el("div", { className: "interaction-prompt interaction-prompt--hidden" });
    container.append(this.interactionPrompt);

    this.toast = el("div", { className: "gameplay-toast gameplay-toast--hidden" });
    container.append(this.toast);

    this.flightMetrics = el("aside", { className: "flight-metrics", attrs: { "aria-label": t("Instrumentos de vuelo") } });
    container.append(this.flightMetrics);
    this.createMissionMap(container);
    this.createMobileControls(container);
    window.addEventListener("keydown", this.onMapKey);

    this.renderResources();
    this.renderLog();
    this.renderPhase();
    this.renderObjectives();
    this.renderFlightMetrics();
    this.updateTickLabel(tickLabel);
    this.wireGameplayLayer(!savedState);

    if (!savedState) {
      this.showOpeningSequence(container);
    }

    this.checkPendingDecisionOrResume();
    // Story progress is driven by objectives and interactions, never by elapsed time.
    this.tickTimer = undefined;
    this.autosaveTimer = window.setInterval(() => void this.autosave(), AUTOSAVE_INTERVAL_MS);
  }

  private confirmRestartMission(): void {
    this.showChoice("RESTART MISSION?", "This resets Mission 01 progress and its report. The campaign unlock for Mission 02 stays available.", [
      { label: "Restart from the beginning", run: () => { void this.restartMission(); } },
    ]);
  }

  private async restartMission(): Promise<void> {
    this.restarting = true;
    this.stopTimers();
    this.showToast(t("Restarting mission…"));
    try {
      // Drain writes that started before the restart so an old snapshot cannot
      // race the API reset and restore the progress we are clearing.
      await Promise.allSettled([...this.pendingAutosaves]);
      await progressApi.replay(MISSION_SLUG);
      await this.app.showMission1();
    } catch (error) {
      this.restarting = false;
      this.autosaveTimer = window.setInterval(() => void this.autosave(), AUTOSAVE_INTERVAL_MS);
      console.error("[Mission1Screen] mission restart failed", error);
      this.showToast(t("Could not restart the mission. Check the connection and try again."));
    }
  }

  /** Connects the third-person scene's proximity/interact callbacks to the HUD. */
  private wireGameplayLayer(resetWorld: boolean): void {
    this.gameplay = this.app.getGameplayHandle();
    if (!this.gameplay) return; // Babylon unavailable (CSS fallback backdrop): HUD-only mode.

    this.gameplay.onNearestPoiChange((poi) => this.updateInteractionPrompt(poi));
    this.gameplay.onMapStateChange((state) => this.updateMissionMap(state));
    this.gameplay.onInteract((poiId) => this.handleInteract(poiId));
    if (resetWorld) this.gameplay.reset();
    this.gameplay.setDesign(this.state.engineering.structure, this.state.engineering.instrumentation);
    this.gameplay.setMissionProgress(this.state.progressPercent() / 100);
  }

  private createMobileControls(container: HTMLElement): void {
    const controls = el("div", { className: "mobile-game-controls", attrs: { "aria-label": t("Controles táctiles") } });
    const stick = el("div", { className: "mobile-stick", attrs: { role: "group", "aria-label": t("Joystick de movimiento") } });
    const knob = el("span", { className: "mobile-stick-knob" });
    stick.append(el("span", { className: "mobile-stick-hint", text: "▲" }), knob);
    const actions = el("div", { className: "mobile-action-buttons" });
    const jump = el("button", { className: "btn mobile-action-button", text: t("Saltar"), attrs: { type: "button" } });
    const sprint = el("button", { className: "btn mobile-action-button", text: t("Correr"), attrs: { type: "button" } });
    const interact = el("button", { className: "btn mobile-action-button mobile-interact-button mobile-interact-button--hidden", text: t("Examinar"), attrs: { type: "button" } });
    this.mobileInteractButton = interact;
    jump.addEventListener("click", () => this.gameplay?.jump());
    interact.addEventListener("click", () => this.gameplay?.interact());
    const releaseSprint = () => {
      this.gameplay?.setTouchSprint(false);
      sprint.classList.remove("mobile-action-button--active");
    };
    sprint.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      sprint.setPointerCapture(event.pointerId);
      this.gameplay?.setTouchSprint(true);
      sprint.classList.add("mobile-action-button--active");
    });
    sprint.addEventListener("pointerup", releaseSprint);
    sprint.addEventListener("pointercancel", releaseSprint);
    sprint.addEventListener("lostpointercapture", releaseSprint);
    actions.append(interact, jump, sprint);
    controls.append(stick, actions);
    container.append(controls);

    const moveStick = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      const radius = rect.width * 0.36;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const scale = distance > radius ? radius / distance : 1;
      const x = (dx * scale) / radius;
      const y = (-dy * scale) / radius;
      knob.style.transform = `translate(${x * radius}px, ${-y * radius}px)`;
      this.gameplay?.setTouchMovement(x, y);
    };
    const releaseStick = (event: PointerEvent) => {
      if (stick.hasPointerCapture(event.pointerId)) stick.releasePointerCapture(event.pointerId);
      knob.style.transform = "translate(0, 0)";
      this.gameplay?.setTouchMovement(0, 0);
    };
    stick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      stick.setPointerCapture(event.pointerId);
      moveStick(event);
    });
    stick.addEventListener("pointermove", (event) => {
      if (stick.hasPointerCapture(event.pointerId)) moveStick(event);
    });
    stick.addEventListener("pointerup", releaseStick);
    stick.addEventListener("pointercancel", releaseStick);
  }

  private createMissionMap(container: HTMLElement): void {
    const button = el("button", {
      className: "btn btn-ghost mission-map-button",
      text: t("M Mapa"),
      attrs: { type: "button", "aria-label": t("Abrir mapa de misión") },
    });
    button.addEventListener("click", () => this.toggleMap());
    container.append(button);

    this.mapOverlay = el("div", { className: "mission-map-overlay mission-map-overlay--hidden" });
    const card = el("section", { className: "mission-map-card", attrs: { role: "dialog", "aria-label": t("Mapa de misión") } });
    const header = el("header", { className: "mission-map-header" });
    header.append(el("h2", { className: "modal-title", text: t("MISSION MAP") }));
    const close = el("button", { className: "btn btn-ghost", text: t("Cerrar"), attrs: { type: "button" } });
    close.addEventListener("click", () => this.toggleMap(false));
    header.append(close);
    const map = el("div", { className: "mission-map-grid" });
    this.mapGrid = map;
    this.mapPlayer = el("span", { className: "mission-map-player", text: "▲" });
    this.mapRoute = el("span", { className: "mission-map-route mission-map-route--hidden" });
    map.append(this.mapRoute, this.mapPlayer, el("span", { className: "mission-map-caption", text: t("NORTH ↑ · PROJECT YARD · LAUNCH FIELD") }));
    this.mapLocations = el("nav", { className: "mission-map-locations", attrs: { "aria-label": t("ALL LOCATIONS") } });
    const details = el("aside", { className: "mission-map-objective" });
    const legend = el("div", { className: "mission-map-legend", attrs: { "aria-label": t("MAP LEGEND") } });
    legend.append(
      el("h3", { className: "mission-map-locations-title", text: t("MAP LEGEND") }),
      el("p", { text: `▲ ${t("You · facing direction")}` }),
      el("p", { text: `1–9 ${t("Locations (numbered)")}` }),
      el("p", { text: `┄ ${t("Route to the current objective (SHOW ROUTE)")}` }),
      el("p", { text: `◌ ${t("Unexplored area · not visited yet")}` }),
    );
    card.append(header, map, this.mapLocations, legend, details);
    this.mapOverlay.append(card);
    container.append(this.mapOverlay);
  }

  private toggleMap(force?: boolean): void {
    if (!this.mapOverlay) return;
    const open = force ?? this.mapOverlay.classList.contains("mission-map-overlay--hidden");
    this.mapOverlay.classList.toggle("mission-map-overlay--hidden", !open);
    if (open) this.renderMapObjective();
  }

  private updateMissionMap(state: GameplayMapState): void {
    this.mapState = state;
    if (!this.mapPlayer) return;
    const signature = state.points.map((point) => `${point.id}:${point.discovered === false ? 0 : 1}`).join("|");
    if (this.mapGrid && signature !== this.mapSignature) {
      this.mapSignature = signature;
      this.mapGrid.querySelectorAll(".mission-map-point").forEach((point) => point.remove());
      if (this.mapLocations) this.mapLocations.innerHTML = "";
      this.mapLocations?.append(el("h3", { className: "mission-map-locations-title", text: t("ALL LOCATIONS") }));
      for (const [index, point] of state.points.entries()) {
        const discovered = point.discovered !== false;
        const label = discovered ? t(point.label) : t("Unexplored area");
        const number = String(index + 1);
        const marker = el("span", {
          className: discovered ? "mission-map-point" : "mission-map-point mission-map-point--unexplored",
          text: number,
          attrs: { title: `${number} · ${label}`, "aria-label": `${number}. ${label}` },
        });
        marker.dataset.x = String(point.x);
        marker.dataset.z = String(point.z);
        marker.dataset.label = label;
        this.mapGrid.append(marker);
        if (point.navigable === false) {
          this.mapLocations?.append(el("div", { className: "mission-map-location mission-map-location--landmark", text: `${number} · ${t(point.label)}` }));
        } else if (!discovered) {
          this.mapLocations?.append(el("div", { className: "mission-map-location mission-map-location--unexplored", text: `${number} · ${t("Unexplored area")}` }));
        } else {
          const locationButton = el("button", { className: "mission-map-location", text: `${number} · ${label}`, attrs: { type: "button" } });
          locationButton.addEventListener("click", () => {
            this.gameplay?.navigateTo(point.id);
            this.toggleMap(false);
            this.showToast(`${t("FOLLOWING ROUTE")} · ${label}`);
          });
          this.mapLocations?.append(locationButton);
        }
      }
    }
    this.mapGrid?.querySelectorAll<HTMLElement>(".mission-map-point").forEach((marker) => {
      const x = Number(marker.dataset.x);
      const z = Number(marker.dataset.z);
      marker.style.left = `${Math.max(2, Math.min(98, ((x + 34) / 68) * 100))}%`;
      marker.style.top = `${Math.max(2, Math.min(98, ((34 - z) / 68) * 100))}%`;
    });
    const left = ((state.player.x + 34) / 68) * 100;
    const top = ((34 - state.player.z) / 68) * 100;
    this.mapPlayer.style.left = `${Math.max(2, Math.min(98, left))}%`;
    this.mapPlayer.style.top = `${Math.max(2, Math.min(98, top))}%`;
    this.mapPlayer.style.transform = `translate(-50%, -50%) rotate(${state.player.direction}rad)`;
    this.maybeRadioHint(state);
    const pendingId = MISSION_01_OBJECTIVES.find((entry) => !this.state.objectives.has(entry.id))?.id ?? "complete";
    if (pendingId !== this.renderedMapObjectiveId) this.renderMapObjective();
    else this.updateMapDistance();
  }

  private renderMapObjective(): void {
    const objective = this.mapOverlay?.querySelector(".mission-map-objective");
    if (!objective) return;
    const pending = MISSION_01_OBJECTIVES.find((entry) => !this.state.objectives.has(entry.id));
    this.renderedMapObjectiveId = pending?.id ?? "complete";
    const targetId = pending ? mapTargetForObjective(pending.id, this.state.unmetNpc()) : null;
    const target = targetId ? this.mapState?.points.find((point) => point.id === targetId) : null;
    objective.innerHTML = "";
    this.mapDistance = el("p", { className: "mission-map-distance" });
    objective.append(
      el("p", { className: "mission-map-kicker", text: t("CURRENT OBJECTIVE") }),
      el("strong", { className: "mission-map-current", text: t(pending?.label ?? "Mission complete") }),
      el("p", { className: "mission-map-location", text: `${t("LOCATION")}\n${t(pending?.location ?? target?.label ?? "Project area")}` }),
      this.mapDistance,
    );
    const routeButton = el("button", { className: "btn btn-secondary mission-map-route-button", text: t(this.routeVisible ? "HIDE ROUTE" : "SHOW ROUTE"), attrs: { type: "button" } });
    routeButton.addEventListener("click", () => {
      this.routeVisible = !this.routeVisible;
      this.mapRoute?.classList.toggle("mission-map-route--hidden", !this.routeVisible || !target || !this.mapState);
      routeButton.textContent = t(this.routeVisible ? "HIDE ROUTE" : "SHOW ROUTE");
    });
    objective.append(routeButton);
    if (targetId) {
      const walkButton = el("button", { className: "btn btn-primary mission-map-route-button", text: t("WALK TO LOCATION"), attrs: { type: "button" } });
      walkButton.addEventListener("click", () => {
        this.gameplay?.navigateTo(targetId);
        this.toggleMap(false);
        this.showToast(`FOLLOWING ROUTE · ${target?.label ?? "Outdoor station"}`);
      });
      objective.append(walkButton);
    }
    this.updateMapDistance();
    this.mapRoute?.classList.toggle("mission-map-route--hidden", !this.routeVisible || !target || !this.mapState);
  }

  private updateMapDistance(): void {
    const pending = MISSION_01_OBJECTIVES.find((entry) => !this.state.objectives.has(entry.id));
    const targetId = pending ? mapTargetForObjective(pending.id, this.state.unmetNpc()) : null;
    const target = targetId ? this.mapState?.points.find((point) => point.id === targetId) : null;
    const distance = target && this.mapState
      ? Math.round(Math.hypot(target.x - this.mapState.player.x, target.z - this.mapState.player.z))
      : null;
    if (this.mapDistance) this.mapDistance.textContent = `${t("DISTANCE")}\n${distance === null ? "—" : `${distance} m`}`;
    this.mapRoute?.classList.toggle("mission-map-route--hidden", !this.routeVisible || !target || !this.mapState);
    if (target && this.mapState && this.mapRoute) {
      const startX = ((this.mapState.player.x + 34) / 68) * 100;
      const startY = ((34 - this.mapState.player.z) / 68) * 100;
      const endX = ((target.x + 34) / 68) * 100;
      const endY = ((34 - target.z) / 68) * 100;
      const dx = endX - startX;
      const dy = endY - startY;
      this.mapRoute.style.left = `${startX}%`;
      this.mapRoute.style.top = `${startY}%`;
      this.mapRoute.style.width = `${Math.hypot(dx, dy)}%`;
      this.mapRoute.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
  }

  private updateInteractionPrompt(poi: NearbyPoi | null): void {
    this.mobileInteractButton?.classList.toggle("mobile-interact-button--hidden", !poi);
    const poiLabel = poi ? t(poi.label) : "";
    if (this.mobileInteractButton) this.mobileInteractButton.textContent = poi ? `${t("Examinar")} · ${poiLabel}` : t("Examinar");
    if (!this.interactionPrompt) return;
    if (!poi) {
      this.interactionPrompt.classList.add("interaction-prompt--hidden");
      return;
    }
    const action = t(poi.prompt ?? "E · EXAMINE OUTDOOR STATION");
    this.interactionPrompt.textContent = `${action}: ${poiLabel}`;
    this.interactionPrompt.classList.remove("interaction-prompt--hidden");
  }

  private maybeRadioHint(state: GameplayMapState): void {
    const now = performance.now();
    if (now - this.lastRadioAt < 28000) return;
    this.lastRadioAt = now;

    const pending = MISSION_01_OBJECTIVES.find((entry) => !this.state.objectives.has(entry.id));
    if (!pending) return;

    let speaker = "DIRECTOR";
    let text = "";
    if (pending.id === "lab" || pending.id === "discover") {
      speaker = "ING. TOMÁS ELDRICH · DIRECTOR";
      text = "Head to the outdoor work area. Today we see if our machine can leave the ground.";
    } else if (pending.id === "meet-team") {
      const unmet = this.state.unmetNpc();
      if (unmet === "meet-propulsion") {
        speaker = "ANDREW WELLS · PROPULSION";
        text = "Over here by the fuel bench. We need to check these pressure lines.";
      } else if (unmet === "meet-structural") {
        speaker = "ELENA BROOKS · STRUCTURAL";
        text = "I'm inspecting the frame brackets by the prototype.";
      } else {
        speaker = "MARA REED · DATA";
        text = "Checking the mechanical recording drum. Come over when you can.";
      }
    } else if (pending.id === "prototype") {
      speaker = "ELENA BROOKS · STRUCTURAL";
      text = "Take a close look at the combustion chamber and propellant lines on the stand.";
    } else if (pending.id === "design") {
      speaker = "ING. TOMÁS ELDRICH · DIRECTOR";
      text = "Configure the vehicle specifications at the open experimental bench.";
    } else if (pending.id === "testing") {
      speaker = "ANDREW WELLS · PROPULSION";
      text = "Head over to the test area. Let's run the system and pressure checks.";
    } else if (pending.id === "diagnose") {
      speaker = "ELENA BROOKS · STRUCTURAL";
      text = "That oscillation isn't right. Return to the vehicle and inspect the possible causes.";
    } else if (pending.id === "prepare") {
      speaker = "ING. TOMÁS ELDRICH · DIRECTOR";
      text = "Bring the crew to the launch field. We must run through the final checklist.";
    } else if (pending.id === "observation") {
      speaker = "MARA REED · DATA";
      text = "Pad cleared! Head into the observation area behind the safety barricades.";
    } else if (pending.id === "flight") {
      speaker = "ING. TOMÁS ELDRICH · DIRECTOR";
      text = "Everyone in position. Stand by for the countdown.";
    } else if (pending.id === "analysis") {
      speaker = "ING. TOMÁS ELDRICH · DIRECTOR";
      text = "Collect the recorded traces and meet us at the outdoor analysis station.";
    }

    if (text) {
      this.state.addLogEntry(`RADIO — ${speaker}: “${text}”`);
      this.renderLog();
      this.showToast(`[RADIO — ${speaker}] ${text}`);
    }
  }

  /** World interactions advance mission objectives and persist meaningful choices. */
  private handleInteract(poiId: string): void {
    const poi = MISSION_1_POIS.find((p) => p.id === poiId);
    if (!poi) return;

    // Story locations stay explorable, but their mission actions only unlock
    // after the required checkpoint has been completed.
    const requiredObjectives: Partial<Record<string, MissionObjectiveId>> = {
      "director-greeting": "lab",
      "meet-propulsion": "discover",
      "meet-structural": "discover",
      "meet-data": "discover",
      "inspect-prototype": "meet-team",
      "engine-selection": "prototype",
      "pressure-test": "design",
      "launch-window": "diagnose",
      "telemetry-fluctuation": "prepare",
      "analysis-station": "flight",
    };
    const requiredId = requiredObjectives[poiId];
    const required = requiredId ? MISSION_01_OBJECTIVES.find((objective) => objective.id === requiredId) : null;
    if (required && !this.state.objectives.has(required.id)) {
      this.showToast(`CHECKPOINT LOCKED · Complete first: ${t(required.label)}.`);
      return;
    }

    // 1. Field equipment shelter:
    if (poiId === "storage-exterior") {
      this.showToast(t("FIELD EQUIPMENT SHELTER · The crate stays under the open canopy; all mission work happens at outdoor stations."));
      return;
    }

    // 2. Project Director:
    if (poiId === "director-greeting") {
      this.state.completeObjective("discover");
      this.state.collectRecord("Director's experiment briefing");
      this.renderObjectives();
      this.showChoice(
        "PROJECT DIRECTOR · ING. TOMÁS ELDRICH",
        `“You're here. Good. Today is an important day.\n\nToday we're going to attempt something people have doubted for years. We are going to see whether our machine can actually fly.\n\nNot because we're going somewhere, or trying to reach space. We're trying to prove one thing: that liquid-fuel propulsion can leave the ground. Welcome to the project.”`,
        [
          {
            label: "“Understood. Where do we begin?”",
            run: () => {
              this.state.addLogEntry("DIRECTOR — Meet the engineering team around the outdoor stations.");
              // The engineering lead's radio briefing was defined but never shown; it plays here.
              this.showEngineeringLeadDialogue(() => {
                this.showToast(t("OBJECTIVE UPDATED · Meet the team across the project area."));
              });
            },
          },
          {
            label: "“Tell me about the vehicle on the stand.”",
            run: () => {
              this.state.addLogEntry("DIRECTOR — It's a small experimental motor with liquid oxygen and gasoline.");
              this.showToast(t("DIRECTOR: Review the notes on the project desk and inspect the frame."));
            },
          },
        ]
      );
      return;
    }

    // 3. Meet Team Members:
    if (poiId === "meet-propulsion") {
      this.state.meetNpc("meet-propulsion");
      if (this.state.teamMet()) this.state.completeObjective("meet-team");
      this.renderObjectives();
      this.showChoice(
        "PROPULSION ENGINEER · ANDREW WELLS",
        `“Check the readings again. We're burning gasoline with liquid oxygen. If the feed system holds steady, the thrust chamber gives a steady push. Every change makes the vehicle stronger, lighter, or riskier. We have to decide where the risk goes.”`,
        [
          {
            label: "“Noted. What are our safety margins?”",
            run: () => {
              this.state.addLogEntry("ANDREW WELLS — Margins are tight. We check every line and gauge before any pressurized test.");
              this.showToast(t("Propulsion notes recorded. Inspect the prototype and meet the team."));
            },
          },
        ]
      );
      return;
    }

    if (poiId === "meet-structural") {
      this.state.meetNpc("meet-structural");
      if (this.state.teamMet()) this.state.completeObjective("meet-team");
      this.renderObjectives();
      this.showChoice(
        "STRUCTURAL ENGINEER · ELENA BROOKS",
        `“The frame is lightweight steel tubing with brass brackets. We're placing the motor up top to pull the propellant tanks for stability. If we add too much reinforcement, mass climbs quickly. We need the right balance between structural integrity and weight.”`,
        [
          {
            label: "“I'll examine the structural brackets on the prototype.”",
            run: () => {
              this.state.addLogEntry("ELENA BROOKS — Look at the pipe clamps and thrust ring on the stand.");
              this.showToast(t("Structural notes recorded. Inspect the vehicle on the stand."));
            },
          },
        ]
      );
      return;
    }

    if (poiId === "meet-data") {
      this.state.meetNpc("meet-data");
      if (this.state.teamMet()) this.state.completeObjective("meet-team");
      this.renderObjectives();
      this.showChoice(
        "DATA TECHNICIAN · MARA REED",
        `“Our instruments are simple: a smoked drum recorder, mechanical pressure gauges, and visual transit sights. If the flight lasts even ten seconds, we'll capture valuable evidence. Without data, an experiment is just a spectacle.”`,
        [
          {
            label: "“We'll make sure the instruments are calibrated.”",
            run: () => {
              this.state.addLogEntry("MARA REED — The observation table will record the launch trace.");
              this.showToast(t("Data instrumentation verified."));
            },
          },
        ]
      );
      return;
    }

    // 4. Prototype inspection / Diagnosis:
    if (poiId === "inspect-prototype") {
      if (this.state.objectives.has("testing") && !this.state.objectives.has("diagnose")) {
        this.openDiagnosticTask();
        return;
      }

      if (!this.state.objectives.has("meet-team")) {
        this.showToast(t("MEET THE ENGINEERING TEAM BEFORE INSPECTING THE PROTOTYPE."));
        return;
      }

      this.state.completeObjective("prototype");
      this.state.collectRecord("Prototype inspection sketch");
      this.renderObjectives();
      this.showChoice(
        "EXPERIMENTAL VEHICLE · DETAILED INSPECTION",
        `STATUS: UNTESTED PROTOTYPE\n\n• Upper motor with ceramic-lined chamber\n• Twin propellant feed tubes (gasoline & liquid oxygen)\n• Lower tank assembly with pressure bladder\n• 4.4-meter launch frame with guide cables\n\n“The historical 1926 vehicle was a radical departure from gunpowder rockets: pure liquid propellant feeding into a combustion chamber.”`,
        [
          {
            label: "Log prototype observation",
            run: () => {
              this.showToast(t("Prototype inspected. Next: configure vehicle at the engineering bench."));
            },
          },
        ]
      );
      return;
    }

    // 5. Historical Documents & Field Notes:
    if (poiId === "record-notes") {
      this.state.collectRecord("Auburn Field Notes — March 1926");
      this.renderObjectives();
      this.showToast(t("DOCUMENT COLLECTED: Auburn Field Notes added to Mission Log."));
      return;
    }
    if (poiId === "record-sketch") {
      this.state.collectRecord("Vehicle Design Charcoal Sketch");
      this.renderObjectives();
      this.showToast(t("DOCUMENT COLLECTED: Prototype Sketch added to Mission Log."));
      return;
    }
    if (poiId === "record-photo") {
      this.state.collectRecord("Field Stand Photograph — 1926");
      this.renderObjectives();
      this.showToast(t("DOCUMENT COLLECTED: Historical Photo added to Mission Log."));
      return;
    }
    if (poiId === "record-log") {
      this.state.collectRecord("Smoked Drum Instrument Log");
      this.renderObjectives();
      this.showToast(t("DOCUMENT COLLECTED: Instrument Log added to Mission Log."));
      return;
    }
    if (poiId === "inspect-instruments") {
      this.state.collectRecord("Telemetry and Recording Instruments");
      this.renderObjectives();
      this.showChoice(
        "INSTRUMENTATION TABLE",
        `Mechanical drum recorder with soot-coated paper and brass stylus. Gauges for nitrogen feed pressure and combustion chamber back-pressure.\n\nCapacity: ~20 seconds of continuous trace. Data quality depends on structural vibration.`,
        [{ label: "Calibrate stylus and return", run: () => {} }]
      );
      return;
    }

    // 6. Project area:
    if (poiId === "project-area") {
      this.state.completeObjective("lab");
      this.state.collectRecord("The project — outdoor field notebook");
      this.renderObjectives();
      this.showChoice(
        "PROJECT AREA · OUTDOOR FIELD DESK",
        `${poi.flavorText}\n\nThe field notes point you to the project director for the briefing.`,
        [{ label: "Continue to the project director", run: () => this.showToast(t("NEXT CHECKPOINT · Speak with the project director.")) }],
      );
      return;
    }

    // 7. Engineering Workbench:
    if (poiId === "engine-selection") {
      this.openEngineering();
      return;
    }

    // 8. Test Area:
    if (poiId === "pressure-test") {
      this.openTesting();
      return;
    }

    // 9. Launch Field & Checklist:
    if (poiId === "launch-window") {
      this.openLaunchPreparation();
      return;
    }

    // 10. Observation Area:
    if (poiId === "telemetry-fluctuation") {
      this.openObservationArea();
      return;
    }

    // 11. Analysis Station:
    if (poiId === "analysis-station") {
      this.openAnalysis();
      return;
    }

    this.showToast(poi.flavorText);
  }

  private openDiagnosticTask(): void {
    const expected = this.state.expectedDiagnosis();
    this.showTaskModal(
      "PROTOTYPE INSPECTION · TRACE THE OSCILLATION",
      "Scan all four readouts, compare their clues, then identify the subsystem that matches the test trace.",
      (setReady) => this.buildDiagnosisTask(setReady, expected),
      () => {
        this.state.diagnosis = expected;
        this.state.inspectedCauses.add(expected);
        this.state.completeObjective("diagnose");
        this.renderObjectives();
        this.showToast(t("DIAGNOSIS CONFIRMED · Stability restored. Proceed to Launch Field."));
      },
      "Confirmar diagnóstico",
      { label: "Accept the unresolved risk and proceed", run: () => this.acceptDiagnosticRisk() },
    );
  }

  private buildDiagnosisTask(
    setReady: (ready: boolean, message: string) => void,
    expected: string,
  ): HTMLElement {
    const panel = el("div", { className: "mission-task-console mission-diagnosis-task" });
    const clues: { id: string; title: string; cause: string; evidence: string }[] = [
      {
        id: "mass",
        title: "MASS BALANCE",
        cause: "Mass distribution",
        evidence: expected === "Mass distribution"
          ? "The upper assembly dips as the feed line pulses; the counterweight lags behind."
          : "The upper assembly and counterweight stay level through each pressure pulse.",
      },
      {
        id: "recorder",
        title: "RECORDER LINE",
        cause: "Instrumentation",
        evidence: expected === "Instrumentation"
          ? "The stylus skips at the same instant the vibration appears; the pressure needle stays steady."
          : "The drum keeps time through the pressure swing; its stylus does not skip.",
      },
      {
        id: "frame",
        title: "FRAME BRACKETS",
        cause: "Structural balance",
        evidence: expected === "Structural balance"
          ? "The right upper bracket flexes on every oscillation while the left stays rigid."
          : "Both upper brackets remain aligned when the guide cables take the load.",
      },
      {
        id: "valve",
        title: "VALVE TIMING",
        cause: "System configuration",
        evidence: expected === "System configuration"
          ? "The pressure pulse arrives before the valve indicator returns to its mark."
          : "The valve indicator returns to its mark before the next pressure pulse.",
      },
    ];
    const inspected = new Set<string>();
    let selectedCause = "";
    const evidenceGrid = el("div", { className: "mission-evidence-grid" });
    const causeOptions = el("div", { className: "mission-diagnosis-options" });
    const count = el("p", { className: "mission-diagnosis-count" });
    const verify = el("button", {
      className: "btn btn-secondary mission-diagnosis-verify",
      text: t("Verificar hipótesis"),
      attrs: { type: "button", disabled: "" },
    });
    const update = (): void => {
      count.textContent = `${inspected.size}/4 ${t("lecturas inspeccionadas")}`;
      verify.disabled = inspected.size !== clues.length || !selectedCause;
    };

    for (const clue of clues) {
      const clueCard = el("article", { className: "mission-evidence-card" });
      const button = el("button", {
        className: "mission-evidence-chip",
        attrs: { type: "button", "aria-expanded": "false" },
      });
      const clueReadout = el("p", {
        className: "mission-evidence-readout",
        attrs: { role: "status", "aria-live": "polite" },
      });
      button.append(
        el("span", { className: "mission-evidence-lamp", text: "○", attrs: { "aria-hidden": "true" } }),
        el("span", { text: t(clue.title) }),
      );
      button.addEventListener("click", () => {
        inspected.add(clue.id);
        button.classList.add("mission-evidence-chip--scanned");
        button.setAttribute("aria-expanded", "true");
        button.querySelector(".mission-evidence-lamp")!.textContent = "●";
        clueReadout.textContent = t(clue.evidence);
        update();
        setReady(false, inspected.size === clues.length
          ? "Elige la causa que explica todas las señales y verifica la hipótesis."
          : "Lee las cuatro estaciones antes de cerrar el diagnóstico.");
      });
      clueCard.append(button, clueReadout);
      evidenceGrid.append(clueCard);
    }

    for (const cause of MISSION_01_DIAGNOSTIC_CAUSES) {
      const button = el("button", {
        className: "mission-diagnosis-choice",
        text: t(cause),
        attrs: { type: "button", "aria-pressed": "false" },
      });
      button.addEventListener("click", () => {
        selectedCause = cause;
        causeOptions.querySelectorAll(".mission-diagnosis-choice").forEach((node) => {
          node.classList.remove("mission-diagnosis-choice--selected");
          node.setAttribute("aria-pressed", "false");
        });
        button.classList.add("mission-diagnosis-choice--selected");
        button.setAttribute("aria-pressed", "true");
        update();
        setReady(false, inspected.size === clues.length
          ? "Confirma que la hipótesis coincide con las cuatro lecturas."
          : "Primero inspecciona las cuatro estaciones.");
      });
      causeOptions.append(button);
    }

    verify.addEventListener("click", () => {
      if (verify.disabled) return;
      setReady(selectedCause === expected, selectedCause === expected
        ? "Las cuatro lecturas confirman la causa. El equipo puede corregir el sistema."
        : "La hipótesis no explica la traza. Revisa los indicios y prueba otra causa.");
    });
    panel.append(
      el("div", { className: "mission-task-section-heading", text: t("1 · ESCANEA LAS LECTURAS") }),
      evidenceGrid,
      count,
      el("div", { className: "mission-task-section-heading", text: t("2 · ELIGE LA CAUSA") }),
      causeOptions,
      verify,
    );
    return panel;
  }

  private acceptDiagnosticRisk(): void {
    this.state.riskAccepted = true;
    this.state.engineering.testResponse = "accept-risk";
    this.state.completeObjective("diagnose");
    this.renderObjectives();
    this.showChoice(
      "RISK ACCEPTED · EXPERIMENTAL RESULT MAY VARY",
      "The crew records the unresolved oscillation and agrees to proceed. The stability margin is reduced; any deviation or data loss will appear in the flight report.",
      [{ label: "Proceed to the launch field", run: () => this.showToast(t("Risk recorded. Complete the launch checklist at the Launch Field.")) }],
    );
  }

  private showChoice(title: string, description: string, options: { label: string; run: () => void }[]): void {
    if (!this.modalRoot) return;
    this.paused = true;
    this.modalRoot.classList.remove("modal-overlay--hidden");
    this.modalRoot.innerHTML = "";
    const card = el("div", { className: "modal-card" });
    card.append(el("h3", { className: "modal-title", text: t(title) }), el("p", { className: "modal-description", text: t(description) }));
    const wrap = el("div", { className: "modal-options" });
    for (const option of options) {
      const button = el("button", { className: "btn btn-secondary", text: t(option.label), attrs: { type: "button" } });
      button.addEventListener("click", () => {
        this.modalRoot?.classList.add("modal-overlay--hidden");
        this.paused = false;
        this.state.decisionsMade += 1;
        option.run();
        this.renderResources(); this.renderLog(); this.renderFlightMetrics(); this.renderObjectives();
        void this.autosave();
      });
      wrap.append(button);
    }

    const close = el("button", { className: "btn btn-ghost", text: t("Close"), attrs: { type: "button" } });
    close.addEventListener("click", () => { this.modalRoot?.classList.add("modal-overlay--hidden"); this.paused = false; });
    wrap.append(close); card.append(wrap); this.modalRoot.append(card);
  }

  /** A compact, retryable task panel used by the field tests and launch prep. */
  private showTaskModal(
    title: string,
    description: string,
    buildTask: (setReady: (ready: boolean, message: string) => void) => HTMLElement,
    onComplete: () => void,
    confirmLabel: string,
    secondaryAction?: { label: string; run: () => void },
  ): void {
    if (!this.modalRoot) return;
    this.paused = true;
    this.modalRoot.classList.remove("modal-overlay--hidden");
    this.modalRoot.innerHTML = "";
    const card = el("div", { className: "modal-card mission-task-card" });
    const status = el("p", { className: "mission-task-status", attrs: { role: "status", "aria-live": "polite" } });
    const complete = el("button", { className: "btn btn-primary", text: t(confirmLabel), attrs: { type: "button", disabled: "" } });
    const controls = el("div", { className: "mission-task-actions" });
    const setReady = (ready: boolean, message: string): void => {
      complete.disabled = !ready;
      status.textContent = t(message);
      status.classList.toggle("mission-task-status--ready", ready);
    };
    complete.addEventListener("click", () => {
      if (complete.disabled) return;
      this.modalRoot?.classList.add("modal-overlay--hidden");
      this.paused = false;
      this.state.decisionsMade += 1;
      onComplete();
      this.renderResources(); this.renderLog(); this.renderFlightMetrics(); this.renderObjectives();
      void this.autosave();
    });
    controls.append(complete);
    if (secondaryAction) {
      const secondary = el("button", { className: "btn btn-secondary", text: t(secondaryAction.label), attrs: { type: "button" } });
      secondary.addEventListener("click", () => {
        this.modalRoot?.classList.add("modal-overlay--hidden");
        this.paused = false;
        secondaryAction.run();
        this.renderResources(); this.renderLog(); this.renderFlightMetrics(); this.renderObjectives();
        void this.autosave();
      });
      controls.append(secondary);
    }
    const close = el("button", { className: "btn btn-ghost", text: t("Cerrar tarea"), attrs: { type: "button" } });
    close.addEventListener("click", () => {
      this.modalRoot?.classList.add("modal-overlay--hidden");
      this.paused = false;
    });
    controls.append(close);
    card.append(
      el("p", { className: "mission-task-kicker", text: t("TAREA DE CAMPO · CONSOLA ANALÓGICA") }),
      el("h3", { className: "modal-title", text: t(title) }),
      el("p", { className: "modal-description", text: t(description) }),
      buildTask(setReady),
      status,
      controls,
    );
    this.modalRoot.append(card);
    setReady(false, "Sigue la indicación. Puedes volver a intentarlo sin penalización.");
  }

  private buildPressureCalibrationTask(setReady: (ready: boolean, message: string) => void): HTMLElement {
    const panel = el("div", { className: "mission-task-console mission-gauge-task" });
    const value = el("output", { className: "mission-gauge-value", text: "30" });
    const track = el("div", { className: "mission-gauge-track", attrs: { "aria-hidden": "true" } });
    const target = el("span", { className: "mission-gauge-target" });
    const needle = el("span", { className: "mission-gauge-needle" });
    track.append(target, needle);
    const range = el("input", {
      className: "mission-gauge-slider",
      attrs: { type: "range", min: "0", max: "100", value: "30", "aria-label": t("Lectura del manómetro") },
    });
    const read = el("button", { className: "btn btn-secondary mission-task-readout", text: t("Leer manómetro"), attrs: { type: "button" } });
    const update = (): void => {
      const reading = Number(range.value);
      value.textContent = String(reading);
      needle.style.left = reading + "%";
      setReady(false, "Coloca la aguja en la banda verde y registra la lectura.");
    };
    range.addEventListener("input", update);
    read.addEventListener("click", () => {
      const reading = Number(range.value);
      if (reading >= 62 && reading <= 74) {
        setReady(true, "Lectura estable registrada. El manómetro quedó dentro de la banda.");
      } else {
        setReady(false, "La aguja sigue fuera de la banda verde. Ajusta y prueba otra vez.");
      }
    });
    panel.append(
      el("div", { className: "mission-gauge-readout", children: [el("span", { text: t("PRESIÓN SIMULADA") }), value, el("span", { text: "%" })] }),
      track,
      range,
      read,
      el("p", { className: "mission-task-hint", text: t("Objetivo: deja la aguja entre 62 y 74.") }),
    );
    return panel;
  }

  private buildSignalRoutingTask(setReady: (ready: boolean, message: string) => void): HTMLElement {
    const pairs = [
      { source: "Alimentación", target: "Presión" },
      { source: "Registrador", target: "Marcas de tiempo" },
      { source: "Estructura", target: "Vibración" },
    ];
    const targets = ["Vibración", "Presión", "Marcas de tiempo"];
    const panel = el("div", { className: "mission-task-console mission-wire-task" });
    const progress = el("p", { className: "mission-wire-progress", text: "0/3" });
    const columns = el("div", { className: "mission-wire-columns" });
    const sourceColumn = el("div", { className: "mission-wire-column" });
    const targetColumn = el("div", { className: "mission-wire-column" });
    const matched = new Set<string>();
    let selected: string | null = null;
    const sourceButtons = new Map<string, HTMLButtonElement>();
    const updateProgress = (message: string): void => {
      progress.textContent = matched.size + "/3";
      setReady(matched.size === pairs.length, message);
    };
    const chooseTarget = (target: string, button: HTMLButtonElement): void => {
      if (!selected) {
        updateProgress("Primero elige una fuente de señal.");
        return;
      }
      const pair = pairs.find((item) => item.source === selected);
      if (pair?.target === target) {
        matched.add(selected);
        button.disabled = true;
        sourceButtons.get(selected)?.setAttribute("disabled", "");
        sourceButtons.get(selected)?.classList.add("mission-wire-port--matched");
        button.classList.add("mission-wire-port--matched");
        selected = null;
        updateProgress(matched.size === pairs.length ? "Las tres señales llegan al instrumento correcto." : "Conexión correcta. Busca la siguiente pareja.");
      } else {
        selected = null;
        sourceButtons.forEach((sourceButton) => {
          sourceButton.classList.remove("mission-wire-port--selected");
          sourceButton.setAttribute("aria-pressed", "false");
        });
        updateProgress("Esa conexión no coincide. Intenta con otro puerto.");
      }
    };
    for (const pair of pairs) {
      const button = el("button", { className: "mission-wire-port", text: pair.source, attrs: { type: "button", "aria-pressed": "false" } });
      button.addEventListener("click", () => {
        if (matched.has(pair.source)) return;
        selected = pair.source;
        sourceButtons.forEach((sourceButton) => {
          sourceButton.classList.remove("mission-wire-port--selected");
          sourceButton.setAttribute("aria-pressed", "false");
        });
        button.classList.add("mission-wire-port--selected");
        button.setAttribute("aria-pressed", "true");
        updateProgress("Ahora selecciona el registro que corresponde a esta fuente.");
      });
      sourceButtons.set(pair.source, button);
      sourceColumn.append(button);
    }
    for (const target of targets) {
      const button = el("button", { className: "mission-wire-port", text: target, attrs: { type: "button" } });
      button.addEventListener("click", () => chooseTarget(target, button));
      targetColumn.append(button);
    }
    columns.append(sourceColumn, targetColumn);
    panel.append(
      el("div", { className: "mission-wire-headings", children: [el("span", { text: t("FUENTES") }), el("span", { text: t("REGISTROS") })] }),
      columns,
      progress,
    );
    updateProgress("Empareja cada fuente con su registro.");
    return panel;
  }

  private buildVibrationTask(
    setReady: (ready: boolean, message: string) => void,
    correctTrace: "noise" | "steady" = "noise",
  ): HTMLElement {
    const panel = el("div", { className: "mission-task-console mission-wave-task" });
    const traces = [
      { id: "steady", label: "TRAZA A", path: "M8 40 C22 34 30 46 44 40 S66 34 80 40 S102 46 116 40 S138 34 152 40 S174 46 188 40" },
      { id: "noise", label: "TRAZA B", path: "M8 42 L18 40 L27 44 L36 34 L46 45 L55 37 L64 43 L73 25 L82 48 L92 38 L101 44 L110 29 L120 50 L130 34 L140 43 L150 22 L160 49 L170 36 L180 45 L188 39" },
      { id: "drift", label: "TRAZA C", path: "M8 45 C30 42 34 39 50 38 S75 36 91 34 S116 31 132 29 S164 26 188 23" },
    ];
    const choices = el("div", { className: "mission-wave-choices" });
    for (const trace of traces) {
      const button = el("button", {
        className: "mission-wave-choice",
        attrs: { type: "button", "aria-label": t("Seleccionar") + " " + trace.label },
      });
      const chart = el("span", { className: "mission-wave-chart" });
      chart.innerHTML = '<svg viewBox="0 0 196 64" aria-hidden="true"><path class="mission-wave-grid" d="M0 16H196M0 32H196M0 48H196M49 0V64M98 0V64M147 0V64"/><path class="mission-wave-line" d="' + trace.path + '"/></svg>';
      button.append(el("strong", { text: trace.label }), chart);
      button.addEventListener("click", () => {
        choices.querySelectorAll(".mission-wave-choice").forEach((node) => node.classList.remove("mission-wave-choice--selected"));
        button.classList.add("mission-wave-choice--selected");
        if (trace.id === correctTrace) {
          setReady(true, correctTrace === "noise"
            ? "La traza irregular coincide con la vibración detectada."
            : "La traza regular confirma que el bastidor se mantuvo estable.");
        } else {
          setReady(false, correctTrace === "noise"
            ? "Esa señal no muestra la anomalía. Revisa otra traza."
            : "Esa curva no confirma la rigidez del bastidor. Revisa otra traza.");
        }
      });
      choices.append(button);
    }
    panel.append(choices, el("p", {
      className: "mission-task-hint",
      text: t(correctTrace === "noise"
        ? "Marca la traza que se aparta del patrón regular."
        : "Selecciona la traza regular que confirma la estabilidad."),
    }));
    return panel;
  }

  private buildFlightRecordTask(setReady: (ready: boolean, message: string) => void): HTMLElement {
    const panel = el("div", { className: "mission-task-console mission-record-task" });
    const correctOrder = ["liftoff", "peak", "recovery"];
    const events = [
      { id: "liftoff", time: "06:33:00", label: "El vehículo abandona la guía" },
      { id: "peak", time: "06:33:10", label: "Mara marca el punto más alto" },
      { id: "recovery", time: "06:33:18", label: "El equipo fija la distancia recorrida" },
    ];
    const order = ["peak", "recovery", "liftoff"];
    const rows = el("div", { className: "mission-record-rows" });
    const render = (): void => {
      rows.innerHTML = "";
      order.forEach((id, index) => {
        const event = events.find((entry) => entry.id === id)!;
        const row = el("div", { className: "mission-record-row" });
        const indexLabel = el("span", { className: "mission-record-index", text: String(index + 1).padStart(2, "0") });
        const description = el("div", { className: "mission-record-description" });
        description.append(el("strong", { text: event.time }), el("span", { text: t(event.label) }));
        const controls = el("div", { className: "mission-record-controls" });
        const up = el("button", {
          className: "mission-record-move",
          text: "↑",
          attrs: { type: "button", "aria-label": t("Mover arriba") },
        });
        const down = el("button", {
          className: "mission-record-move",
          text: "↓",
          attrs: { type: "button", "aria-label": t("Mover abajo") },
        });
        up.disabled = index === 0;
        down.disabled = index === order.length - 1;
        up.addEventListener("click", () => {
          if (index === 0) return;
          [order[index - 1], order[index]] = [order[index]!, order[index - 1]!];
          render();
        });
        down.addEventListener("click", () => {
          if (index >= order.length - 1) return;
          [order[index], order[index + 1]] = [order[index + 1]!, order[index]!];
          render();
        });
        controls.append(up, down);
        row.append(indexLabel, description, controls);
        rows.append(row);
      });
      const isOrdered = order.every((id, index) => id === correctOrder[index]);
      setReady(isOrdered, isOrdered
        ? "Secuencia restaurada. Las tres marcas temporales coinciden con el registro del equipo."
        : "Ordena la salida, la marca de altura y la observación de distancia.");
    };
    panel.append(
      el("div", { className: "mission-record-reel", children: [
        el("span", { className: "mission-record-reel-light" }),
        el("strong", { text: t("TAMBOR DE PAPEL AHUMADO") }),
        el("span", { className: "mission-record-reel-light" }),
      ] }),
      rows,
      el("p", { className: "mission-task-hint", text: t("Ordena las tres observaciones para reconstruir el tramo de vuelo.") }),
    );
    render();
    return panel;
  }

  private showEngineeringLeadDialogue(onContinue: () => void): void {
    const lines = MISSION_01_DIALOGUE.engineeringLead;
    this.state.addLogEntry(`RADIO — ENGINEERING LEAD: ${lines[1]}`);
    this.showChoice(
      lines[0]!,
      lines.slice(1).join("\n\n"),
      [{ label: "Continue · review the outdoor field notes", run: onContinue }],
    );
  }

  private openEngineering(): void {
    if (!this.state.objectives.has("prototype")) { this.showToast("INSPECT THE PROTOTYPE AT THE OUTDOOR PROJECT AREA FIRST."); return; }
    if (this.state.objectives.has("testing")) { this.showToast(t("ENGINEERING LOCKED · The design is frozen after testing begins.")); return; }

    let draft: EngineeringProfile = { ...this.state.engineering };
    this.showTaskModal(
      "BANCO DE INGENIERÍA · CONFIGURA EL PROTOTIPO",
      "Elige estructura, instrumentación y prioridad. Revisa el coste y calibra el giroscopio antes de sellar el diseño.",
      (setReady) => this.buildEngineeringTask(setReady, (next) => { draft = next; }),
      () => {
        this.state.setEngineering(draft);
        draft.budget = Math.max(0, DESIGN_BUDGET - calculateEngineering(draft).cost);
        this.gameplay?.setDesign(draft.structure, draft.instrumentation);
        this.state.completeObjective("design");
        this.renderObjectives();
        const line = draft.structure === "light"
          ? MISSION_01_DIALOGUE.engineerLight
          : draft.structure === "reinforced"
            ? MISSION_01_DIALOGUE.engineerHeavy
            : MISSION_01_DIALOGUE.engineerBalanced;
        this.showToast(`${t("DESIGN LOCKED")} · ${t(line)}`);
      },
      "Sellar configuración",
    );
  }

  private buildEngineeringTask(
    setReady: (ready: boolean, message: string) => void,
    onChange: (profile: EngineeringProfile) => void,
  ): HTMLElement {
    const panel = el("div", { className: "mission-task-console mission-engineering-task" });
    let draft: EngineeringProfile = { ...this.state.engineering };
    let calibrated = false;
    const groups: { key: "structure" | "instrumentation" | "priority"; title: string; options: { value: string; label: string; detail: string }[] }[] = [
      { key: "structure", title: "ESTRUCTURA", options: [
        { value: "light", label: "Ligera", detail: "Menos masa · margen reducido" },
        { value: "balanced", label: "Equilibrada", detail: "Compromiso medio" },
        { value: "reinforced", label: "Reforzada", detail: "Más estabilidad · más coste" },
      ] },
      { key: "instrumentation", title: "INSTRUMENTACIÓN", options: [
        { value: "basic", label: "Básica", detail: "Registro limitado" },
        { value: "balanced", label: "Balanceada", detail: "Lecturas ampliadas" },
        { value: "advanced", label: "Avanzada", detail: "Más datos · mayor coste" },
      ] },
      { key: "priority", title: "PRIORIDAD DEL EQUIPO", options: [
        { value: "cost", label: "Coste", detail: "Conservar presupuesto" },
        { value: "stability", label: "Estabilidad", detail: "Proteger la estructura" },
        { value: "data", label: "Datos", detail: "Recuperar más lecturas" },
      ] },
    ];
    const groupsRoot = el("div", { className: "mission-design-groups" });
    const values = new Map<string, HTMLElement>();
    const budgetValue = el("strong", { className: "mission-design-budget-value" });
    const budgetFill = el("span", { className: "mission-design-budget-fill" });
    const balance = el("input", {
      className: "mission-gauge-slider mission-design-balance-slider",
      attrs: { type: "range", min: "0", max: "100", value: "38", "aria-label": t("Ajuste de equilibrio del giroscopio") },
    });
    const balanceValue = el("output", { className: "mission-gauge-value", text: balance.value });
    const balanceNeedle = el("span", { className: "mission-gauge-needle" });
    const balanceTrack = el("div", { className: "mission-gauge-track mission-design-balance-track", attrs: { "aria-hidden": "true" } });
    balanceTrack.append(el("span", { className: "mission-gauge-target" }), balanceNeedle);
    const calibrate = el("button", { className: "btn btn-secondary mission-task-readout", text: t("Probar equilibrio"), attrs: { type: "button" } });

    const render = (): void => {
      const metrics = calculateEngineering(draft);
      draft.budget = Math.max(0, DESIGN_BUDGET - metrics.cost);
      for (const [key, value] of Object.entries({
        mass: `${metrics.mass}%`, stability: `${metrics.stability}%`, data: `${metrics.data}%`, reliability: `${metrics.reliability}%`,
      })) values.get(key)!.textContent = value;
      budgetValue.textContent = `${metrics.cost} / ${DESIGN_BUDGET}`;
      budgetFill.style.width = `${Math.min(100, metrics.cost / DESIGN_BUDGET * 100)}%`;
      groupsRoot.querySelectorAll<HTMLButtonElement>(".mission-design-choice").forEach((button) => {
        const group = button.dataset.group as "structure" | "instrumentation" | "priority";
        const selectedValue = draft[group];
        const isSelected = button.dataset.value === selectedValue;
        button.classList.toggle("mission-design-choice--selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      });
      balanceValue.textContent = balance.value;
      balanceNeedle.style.left = `${balance.value}%`;
      onChange({ ...draft });
    };

    for (const group of groups) {
      const section = el("section", { className: "mission-design-group" });
      section.append(el("h4", { className: "mission-task-section-heading", text: t(group.title) }));
      const choices = el("div", { className: "mission-design-choices" });
      for (const option of group.options) {
        const button = el("button", {
          className: "mission-design-choice",
          attrs: { type: "button", "aria-pressed": "false" },
        });
        button.dataset.group = group.key;
        button.dataset.value = option.value;
        button.append(el("strong", { text: t(option.label) }), el("span", { text: t(option.detail) }));
        button.addEventListener("click", () => {
          if (group.key === "structure") draft.structure = option.value as EngineeringProfile["structure"];
          if (group.key === "instrumentation") draft.instrumentation = option.value as EngineeringProfile["instrumentation"];
          if (group.key === "priority") draft.priority = option.value as EngineeringProfile["priority"];
          calibrated = false;
          render();
          setReady(false, "La configuración cambió. Vuelve a calibrar el giroscopio para sellarla.");
        });
        choices.append(button);
      }
      section.append(choices);
      groupsRoot.append(section);
    }

    const readouts = el("div", { className: "mission-design-readouts" });
    for (const [key, label] of [["mass", "MASA"], ["stability", "ESTABILIDAD"], ["data", "DATOS"], ["reliability", "FIABILIDAD"]]) {
      const item = el("div", { className: "mission-design-readout" });
      item.append(el("span", { text: t(label) }));
      const value = el("strong", { text: "—" });
      values.set(key, value);
      item.append(value);
      readouts.append(item);
    }
    const budget = el("div", { className: "mission-design-budget" });
    budget.append(
      el("div", { className: "mission-design-budget-heading", children: [el("span", { text: t("PRESUPUESTO DE CAMPO") }), budgetValue] }),
      el("div", { className: "mission-design-budget-track", children: [budgetFill] }),
    );
    const balanceReadout = el("div", { className: "mission-gauge-readout", children: [
      el("span", { text: t("EQUILIBRIO DEL GIROSCOPIO") }), balanceValue, el("span", { text: "%" }),
    ] });
    calibrate.addEventListener("click", () => {
      const reading = Number(balance.value);
      calibrated = reading >= 62 && reading <= 74;
      setReady(calibrated, calibrated
        ? "Giroscopio centrado. Las lecturas de masa, estabilidad y datos quedan dentro del presupuesto."
        : "La marca debe quedar en la banda verde, entre 62 y 74.");
    });
    balance.addEventListener("input", () => {
      calibrated = false;
      balanceValue.textContent = balance.value;
      balanceNeedle.style.left = `${balance.value}%`;
      setReady(false, "Alinea la marca con la banda verde y prueba el equilibrio.");
    });
    panel.append(
      groupsRoot,
      readouts,
      budget,
      el("div", { className: "mission-task-section-heading", text: t("CALIBRACIÓN FINAL") }),
      balanceReadout,
      balanceTrack,
      balance,
      calibrate,
      el("p", { className: "mission-task-hint", text: t("Ajusta el giroscopio hasta dejar la marca entre 62 y 74.") }),
    );
    render();
    return panel;
  }

  private openTesting(): void {
    if (!this.state.objectives.has("design")) {
      this.showToast("CONFIGURE THE VEHICLE AT THE OUTDOOR ENGINEERING BENCH BEFORE TESTING.");
      return;
    }
    const metrics = calculateEngineering(this.state.engineering);
    const systemDone = this.state.testsRun.has("system");
    const instDone = this.state.testsRun.has("instrumentation");
    const stabDone = this.state.testsRun.has("stability");

    if (this.state.testsComplete()) {
      if (!this.state.objectives.has("diagnose")) {
        this.showToast(t("Tests complete. Inspect the prototype to resolve the detected anomaly."));
        return;
      }
      this.showToast(t("All systems tested and anomaly diagnosed. Proceed to the Launch Field."));
      return;
    }

    const testSummary = [
      t("Banco de pruebas exterior y barreras de protección."),
      `${t("Estabilidad")}: ${metrics.stability}% · ${t("Masa")}: ${metrics.mass}% · ${t("Datos")}: ${metrics.data}%`,
      "",
      t("Completa tres tareas cortas de consola. Puedes repetirlas sin penalización."),
    ].join("\n");
    this.showChoice(
      "TEST AREA · SYSTEMS REVIEW",
      testSummary,
      [
        {
          label: `${systemDone ? "✓" : "1."} ${t("Calibrar el manómetro")}`,
          run: () => this.runPressureTest(),
        },
        {
          label: `${instDone ? "✓" : "2."} ${t("Conectar las señales")}`,
          run: () => this.runInstrumentationTest(),
        },
        {
          label: `${stabDone ? "✓" : "3."} ${t("Encontrar la traza irregular")}`,
          run: () => this.runStabilityTest(),
        },
      ]
    );
  }

  private runPressureTest(): void {
    if (this.state.testsRun.has("system")) { this.showToast(t("PRUEBA DE PRESIÓN COMPLETADA · Lectura estable.")); return; }
    this.showTaskModal(
      "PRUEBA DE PRESIÓN · CALIBRACIÓN",
      "Ajusta la aguja del panel simulado hasta la banda verde y registra la lectura.",
      (setReady) => this.buildPressureCalibrationTask(setReady),
      () => {
        this.state.runTest("system");
        this.state.addLogEntry("TEST AREA — The simulated pressure trace held steady.");
        this.showToast(t("PRUEBA DE PRESIÓN COMPLETADA · Lectura estable."));
        this.checkTestProgress();
        if (!this.state.testsComplete()) this.openTesting();
      },
      "Guardar lectura",
    );
  }

  private runInstrumentationTest(): void {
    if (this.state.testsRun.has("instrumentation")) { this.showToast(t("CANALES CONECTADOS · El registrador recibe las señales.")); return; }
    this.showTaskModal(
      "PRUEBA DE INSTRUMENTACIÓN · CONECTA LOS REGISTROS",
      "Une cada fuente de señal con el instrumento que la registra. Si no coincide, prueba otro puerto.",
      (setReady) => this.buildSignalRoutingTask(setReady),
      () => {
        this.state.runTest("instrumentation");
        this.state.addLogEntry("TEST AREA — The recorder, pressure, and vibration channels were matched.");
        this.showToast(t("CANALES CONECTADOS · El registrador recibe las señales."));
        this.checkTestProgress();
        if (!this.state.testsComplete()) this.openTesting();
      },
      "Guardar conexiones",
    );
  }

  private runStabilityTest(): void {
    if (this.state.testsRun.has("stability")) { this.showToast(t("TRAZA MARCADA · El equipo revisará el origen de la vibración.")); return; }
    this.showTaskModal(
      "PRUEBA ESTRUCTURAL · DETECTA LA TRAZA",
      "Compara las tres señales y marca la que se aparta del patrón regular observado por el equipo.",
      (setReady) => this.buildVibrationTask(setReady),
      () => {
        this.state.runTest("stability");
        this.state.addLogEntry("TEST AREA — An irregular vibration trace was marked for inspection.");
        this.showToast(t("TRAZA MARCADA · El equipo revisará el origen de la vibración."));
        this.checkTestProgress();
        if (!this.state.testsComplete()) this.openTesting();
      },
      "Registrar traza",
    );
  }

  private checkTestProgress(): void {
    if (this.state.testsComplete()) {
      this.state.completeObjective("testing");
      this.renderObjectives();
      this.showChoice(
        "ADVERTENCIA · INESTABILIDAD INESPERADA DETECTADA",
        `ING. ANDREW WELLS: “Eso no estaba ahí antes.”\nING. ELENA BROOKS: “Entonces algo cambió durante el ciclo de presurización.”\nING. TOMÁS ELDRICH: “Encuéntralo.”\n\nUna oscilación mecánica apareció en el registrador de traza. Inspecciona el prototipo de cerca para diagnosticar la causa.`,
        [
          {
            label: "Inspect prototype to find the cause",
            run: () => {
              this.showToast(t("ANOMALY RECORDED · Return to the prototype to diagnose the issue."));
            },
          },
        ]
      );
    }
  }

  private openLaunchPreparation(): void {
    if (!this.state.objectives.has("diagnose")) {
      this.showToast(t("DIAGNOSE AND RESOLVE THE TEST ANOMALY BEFORE PREPARING LAUNCH."));
      return;
    }
    if (!this.launchDayAnnounced) {
      // Narrative transition to launch day (MISSION_01_DESIGN_SPEC, phase F.1).
      this.launchDayAnnounced = true;
      this.showChoice(
        "MARCH 16, 1926 — LAUNCH DAY",
        "The morning light is flat and pale over the Auburn field. The vehicle stands on the launch frame, and the team is waiting for your call.",
        [{ label: "Begin launch preparation", run: () => this.openLaunchPreparation() }],
      );
      return;
    }
    const weather = this.gameplay?.getWeather() ?? "CLOUDY";
    const cl = this.state.checklist;

    const checklistItems = [
      { id: "inspect-vehicle", label: "Inspeccionar el vehículo" },
      { id: "check-instruments", label: "Revisar los instrumentos de observación" },
      { id: "review-conditions", label: "Revisar las condiciones meteorológicas" },
      { id: "confirm-observation", label: "Confirmar la zona de observación" },
      { id: "confirm-telemetry", label: "Confirmar el registrador de telemetría" },
    ];
    const selected = new Set(cl);
    this.showTaskModal(
      "CAMPO DE LANZAMIENTO · LISTA PREVIA",
      `Auburn, Massachusetts · 16 de marzo de 1926.\nMarca cada control para despejar la plataforma.`,
      (setReady) => {
        const panel = el("div", { className: "mission-task-console mission-checklist-task" });
        const count = el("p", { className: "mission-checklist-count" });
        const rows = el("div", { className: "mission-checklist-rows" });
        const refresh = (): void => {
          count.textContent = selected.size + "/" + checklistItems.length + " " + t("controles confirmados");
          setReady(selected.size === checklistItems.length, selected.size === checklistItems.length
            ? "Lista completa. El equipo está listo para continuar."
            : "Marca los cinco controles para despejar la plataforma.");
        };
        for (const item of checklistItems) {
          const button = el("button", {
            className: "mission-checklist-row" + (selected.has(item.id) ? " mission-checklist-row--checked" : ""),
            attrs: { type: "button", "aria-pressed": String(selected.has(item.id)) },
          });
          const mark = el("span", { className: "mission-checklist-mark", text: selected.has(item.id) ? "✓" : "□" });
          button.append(mark, el("span", { text: t(item.label) + (item.id === "review-conditions" ? " · " + t(weather) : "") }));
          button.addEventListener("click", () => {
            if (selected.has(item.id)) selected.delete(item.id);
            else selected.add(item.id);
            const checked = selected.has(item.id);
            button.classList.toggle("mission-checklist-row--checked", checked);
            button.setAttribute("aria-pressed", String(checked));
            mark.textContent = checked ? "✓" : "□";
            refresh();
          });
          rows.append(button);
        }
        panel.append(rows, count);
        refresh();
        return panel;
      },
      () => {
        for (const item of checklistItems) this.state.markChecklist(item.id);
        this.state.engineering.launchDecision = "proceed";
        this.state.completeObjective("prepare");
        this.state.flightResult = resolveFlight(this.state.engineering, this.state.resources.telemetry);
        this.gameplay?.setPeakAltitude(flightPeakAltitude(this.state.flightResult));
        this.renderObjectives();
        this.showChoice(
          "PRE-LAUNCH BRIEFING",
          t(`MARA REED: “Recording ready.”\nANDREW WELLS: “Feed system pressurized and ready.”\nING. TOMÁS ELDRICH: “All right. Let's see what happens. Clear the pad and take positions in the Observation Area.”`),
          [{ label: t("Head to the Observation Area"), run: () => this.showToast(t("PAD CLEARED · Walk to the Observation Area to begin launch.")) }],
        );
      },
      "Confirmar lista y seguir",
      {
        label: "Aplazar y volver a revisar",
        run: () => {
          this.state.engineering.launchDecision = "delay";
          this.state.flightResult = null;
          this.state.checklist.clear();
          this.state.engineering.budget = Math.max(0, this.state.engineering.budget - LAUNCH_DELAY_BUDGET_COST);
          this.state.advanceTick();
          this.state.addLogEntry(`[T${this.state.tick}] Launch delayed: budget −${LAUNCH_DELAY_BUDGET_COST}, one time step lost.`);
          this.showToast(t("LAUNCH DELAYED · The flight has not started. Recheck the launch conditions before proceeding."));
          this.openLaunchPreparation();
        },
      },
    );
  }

  private openObservationArea(): void {
    // Phase G: the exterior ambience is emphasised at the observation area.
    missionAudio.setWindLevel(0.2);
    if (!this.state.objectives.has("prepare")) {
      this.showToast(t("COMPLETE THE LAUNCH CHECKLIST AT THE LAUNCH FIELD FIRST."));
      return;
    }
    if (this.state.objectives.has("flight")) {
      this.showToast(t("Flight attempt already completed. Head to the Analysis Station."));
      return;
    }

    this.state.completeObjective("observation");
    this.renderObjectives();
    this.showChoice(
      "OBSERVATION AREA · TAKE POSITION",
      t(`The crew is safely stationed behind the observation barricade, 50 meters from the launch frame. Mara Reed has the drum recorder running. Andrew Wells and Elena Brooks are tracking the ascent path.\n\nDIRECTOR: “Ready on your mark.”`),
      [
        {
          label: t("START LAUNCH COUNTDOWN (T-10)"),
          run: () => {
            this.runLaunchSequence();
          },
        },
      ]
    );
  }

  private openAnalysis(): void {
    if (!this.state.objectives.has("flight")) {
      this.showToast(t("THE FLIGHT RECORD WILL BE AVAILABLE AFTER THE LAUNCH ATTEMPT."));
      return;
    }
    const result = this.state.flightResult ?? resolveFlight(this.state.engineering, this.state.resources.telemetry);
    const label = flightResultLabel(result);
    const analysisTopics = ["Propulsion & Pressure Data", "Structural & Frame Data", "Smoked Drum Flight Record"];
    const analysisCompleteCount = analysisTopics.filter((topic) => this.state.analyzed.has(topic)).length;
    this.showChoice(
      "OUTDOOR ANALYSIS STATION · FLIGHT RECORD",
      `FLIGHT OUTCOME: ${label}\n\n${t(MISSION_01_DIALOGUE.historicalNote)}\n\n${t("Review the flight telemetry traces and system performance:")}`,
      [
        {
          label: `${this.state.analyzed.has(analysisTopics[0]!) ? "✓" : "01"} · ${t("Analyze Propulsion & Chamber Pressure")}`,
          run: () => this.runAnalysisTask(analysisTopics[0]!),
        },
        {
          label: `${this.state.analyzed.has(analysisTopics[1]!) ? "✓" : "02"} · ${t("Analyze Structural Rigidity & Frame Deflection")}`,
          run: () => this.runAnalysisTask(analysisTopics[1]!),
        },
        {
          label: `${this.state.analyzed.has(analysisTopics[2]!) ? "✓" : "03"} · ${t("Recover Smoked Drum Flight Record")}`,
          run: () => this.runAnalysisTask(analysisTopics[2]!),
        },
        {
          label: `${t("COMPILE FINAL REPORT")} · ${analysisCompleteCount}/3 ${t("records reviewed")}`,
          run: () => {
            if (!this.state.completeObjective("analysis")) {
              this.showToast(t("Review the propulsion trace, structural trace, and smoked drum record before compiling the report."));
              this.openAnalysis();
              return;
            }
            this.renderObjectives();
            void this.autosave();
            this.runMissionEnding();
          },
        },
      ]
    );
  }

  private runAnalysisTask(topic: string): void {
    if (this.state.analyzed.has(topic)) {
      this.showToast(t("Este registro ya fue revisado. Puedes continuar con otro canal."));
      this.openAnalysis();
      return;
    }
    const task = topic === "Propulsion & Pressure Data"
      ? {
        title: "LECTURA DE PROPULSIÓN · CALIBRA EL PICO",
        description: "Ajusta el manómetro hasta que el pulso coincida con la banda marcada en el registro.",
        build: (setReady: (ready: boolean, message: string) => void) => this.buildPressureCalibrationTask(setReady),
        confirm: "Archivar curva de presión",
      }
      : topic === "Structural & Frame Data"
        ? {
          title: "LECTURA ESTRUCTURAL · COMPARA LAS TRAZAS",
          description: "Busca la única curva regular que confirma que el bastidor se mantuvo dentro de tolerancia durante el vuelo.",
          build: (setReady: (ready: boolean, message: string) => void) => this.buildVibrationTask(setReady, "steady"),
          confirm: "Archivar lectura estructural",
        }
        : {
          title: "REGISTRO DE VUELO · RECONSTRUYE EL TAMBOR",
          description: "Las marcas del papel quedaron fuera de orden. Restáuralas para confirmar cuándo salió el vehículo, dónde llegó y qué distancia observó el equipo.",
          build: (setReady: (ready: boolean, message: string) => void) => this.buildFlightRecordTask(setReady),
          confirm: "Archivar registro histórico",
        };
    this.showTaskModal(
      task.title,
      task.description,
      task.build,
      () => {
        this.state.analyzeData(topic);
        if (topic === "Smoked Drum Flight Record") this.state.collectRecord("1926 Smoked Paper Flight Trace");
        this.showToast(topic === "Smoked Drum Flight Record"
          ? t("Historical record recovered and archived in mission log.")
          : t("LECTURA ANALIZADA · La traza queda archivada en el registro de misión."));
        this.openAnalysis();
      },
      task.confirm,
    );
  }

  private runLaunchSequence(): void {
    if (!this.modalRoot) return;
    this.paused = true;
    this.togglePanel(false);
    this.restorePanelButton?.classList.add("mission-panel-restore--hidden");
    this.modalRoot.classList.remove("modal-overlay--hidden");
    this.modalRoot.classList.remove("mission-launch-overlay--cinematic");
    this.modalRoot.innerHTML = "";
    const card = el("div", { className: "modal-card mission-launch-card" });
    const heading = el("p", { className: "mission-launch-kicker", text: t("OBSERVATION AREA · RECORDING") });
    const countdown = el("h2", { className: "mission-launch-countdown", text: "T-10" });
    const status = el("p", { className: "modal-description mission-launch-status", text: t("The team is clear of the stand. The recorder is running. Use buttons or keys 1/2/3 to switch camera view.") });

    const cameraRow = el("div", { className: "mission-launch-camera-row" });
    const btnCine = el("button", { className: "btn btn-secondary", text: "1 · CINEMATIC", attrs: { type: "button" } });
    btnCine.addEventListener("click", () => this.gameplay?.setCameraMode("cinematic"));
    const btnObs = el("button", { className: "btn btn-secondary", text: "2 · OBSERVATION", attrs: { type: "button" } });
    btnObs.addEventListener("click", () => this.gameplay?.setCameraMode("observation"));
    const btnTelem = el("button", { className: "btn btn-secondary", text: "3 · TELEMETRY", attrs: { type: "button" } });
    btnTelem.addEventListener("click", () => this.gameplay?.setCameraMode("telemetry"));
    cameraRow.append(btnCine, btnObs, btnTelem);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") this.gameplay?.setCameraMode("cinematic");
      if (e.key === "2") this.gameplay?.setCameraMode("observation");
      if (e.key === "3") this.gameplay?.setCameraMode("telemetry");
    };
    window.addEventListener("keydown", onKey);

    const readings = el("div", { className: "mission-launch-readings" });
    card.append(heading, countdown, status, cameraRow, readings);
    this.modalRoot.append(card);
    let remaining = 10;
    const updateReadings = (altitude: number, velocity: number, signal: number) => {
      readings.innerHTML = "";
      for (const [label, value] of [["ALTITUDE", `${altitude} m`], ["VELOCITY", `${velocity} m/s`], ["STABILITY", `${calculateEngineering(this.state.engineering).stability}%`], ["SIGNAL", `${signal}%`], ["DATA", `${this.state.resources.telemetry}%`]]) {
        const item = el("div", { className: "mission-launch-reading" });
        item.append(el("span", { text: t(label) }), el("strong", { text: value }));
        readings.append(item);
      }
    };
    updateReadings(0, 0, this.state.resources.telemetry);
    this.launchTimer = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        countdown.textContent = `T-${remaining}`;
        missionAudio.beep(remaining <= 3 ? 1100 : 880);
        if (remaining <= 3) status.textContent = t("The small crew watches the stand and the mechanical recorder.");
        return;
      }
      if (this.launchTimer) window.clearInterval(this.launchTimer);
      this.launchTimer = undefined;
      countdown.textContent = t("IGNITION");
      countdown.classList.add("mission-launch-ignition");
      this.modalRoot?.classList.add("mission-launch-overlay--cinematic");
      status.textContent = t("The vehicle leaves the frame. Record the flight, then review the result.");
      missionAudio.ignition();
      missionAudio.setWindLevel(0.25);
      this.gameplay?.playLaunch();
      const startedAt = performance.now();
      this.flightTimer = window.setInterval(() => {
        const seconds = Math.min(18, (performance.now() - startedAt) / 1000);
        const poweredAscentTime = Math.min(seconds, 3.5);
        const continuingAscentTime = Math.max(0, seconds - 3.5);
        const altitude = Math.round(
          0.55 * poweredAscentTime ** 2 +
          3.85 * continuingAscentTime +
          0.045 * continuingAscentTime ** 2,
        );
        const velocity = Math.round(seconds <= 3.5
          ? 1.1 * poweredAscentTime
          : 3.85 + 0.09 * continuingAscentTime);
        const signal = Math.max(24, Math.round(this.state.resources.telemetry - Math.max(0, seconds - 2) * 5));
        updateReadings(altitude, velocity, signal);
        if (seconds >= 18) {
          window.removeEventListener("keydown", onKey);
          if (this.flightTimer) window.clearInterval(this.flightTimer);
          this.flightTimer = undefined;
          this.modalRoot?.classList.add("modal-overlay--hidden");
          this.modalRoot?.classList.remove("mission-launch-overlay--cinematic");
          this.paused = false;
          this.togglePanel(true);
          this.state.completeObjective("flight");
          this.state.addLogEntry(`FLIGHT OBSERVATION — ${this.state.flightResult ?? "recorded"}. The vehicle continued climbing throughout the observation window; displayed altitude and velocity are abstract game values. Historical reference: 41 ft / 12.5 m and 184 ft / 56 m.`);
          this.renderLog();
          this.renderFlightMetrics();
          this.renderObjectives();
          this.showToast(t("The crew is quiet for a moment. ‘It flew.’ Head to the outdoor analysis station."));
          void this.autosave();
        }
      }, 200);
    }, 1000);
  }

  private runMissionEnding(): void {
    if (!this.modalRoot) return;
    this.paused = true;
    this.modalRoot.classList.remove("modal-overlay--hidden");
    this.modalRoot.innerHTML = "";
    const card = el("div", { className: "modal-card mission-ending-card" });
    const result = this.state.flightResult ?? "incomplete-data";
    const engineerLine = result === "delayed"
      ? "We have a clearer record. We still need a flight."
      : "We still have work to do.";
    card.append(
      el("p", { className: "mission-launch-kicker", text: t("FIELD NOTES · AUBURN, 1926") }),
      el("h2", { className: "mission-ending-title", text: t("THE FLIGHT WAS SMALL. THE POSSIBILITY WAS NOT.") }),
      el("p", { className: "mission-ending-dialogue", text: `${t("ING. ELENA BROOKS · STRUCTURAL ENGINEER")}\n“${t(engineerLine)}”` }),
      el("p", { className: "mission-ending-dialogue", text: `${t("ING. TOMÁS ELDRICH · PROJECT DIRECTOR")}\n“${t("Of course. That's how this begins.") }”` }),
      el("p", { className: "mission-ending-caption", text: t("The 1926 historical flight was brief (41 ft high, 184 ft distance). It demonstrated that liquid-fuel propulsion could produce flight. Mission 02 unlocked.") }),
    );
    const finish = el("button", { className: "btn btn-primary btn-large", text: t("MISSION 01 COMPLETE"), attrs: { type: "button" } });
    finish.addEventListener("click", () => {
      this.modalRoot?.classList.add("modal-overlay--hidden");
      this.paused = false;
      this.endMission("success");
    });
    card.append(finish);
    this.modalRoot.append(card);
  }

  private collectSample(sample: { sampleKey: string; label: string; type: string; quality: number }): void {
    if (this.state.samplesCollected.some((collected) => collected.sampleKey === sample.sampleKey)) return;
    this.state.samplesCollected.push(sample);
    void samplesApi.collect({ missionSlug: MISSION_SLUG, ...sample });
    this.state.addLogEntry(`RECORD COLLECTED — ${sample.label}`);
    this.renderLog();
  }

  private showToast(text: string): void {
    if (!this.toast) return;
    this.toast.textContent = t(text);
    this.toast.classList.remove("gameplay-toast--hidden");
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast?.classList.add("gameplay-toast--hidden");
    }, 4200);
  }

  private showTutorialOverlay(container: HTMLElement): void {
    const overlay = el("div", { className: "modal-overlay" });
    const card = el("div", { className: "modal-card tutorial-card" });
    card.append(
      el("h3", { className: "modal-title", text: t("Auburn, Massachusetts — 16 de marzo de 1926") }),
      el("p", { className: "modal-description", text: t("Eres un ingeniero ficticio en una prueba inspirada en el primer vuelo histórico de un cohete de combustible líquido. Explora el campo, inspecciona el equipo y toma decisiones de ingeniería.") }),
    );
    const list = el("ul", { className: "tutorial-controls-list" });
    list.append(
      el("li", { className: "tutorial-control-desktop", text: t("W A S D — Mover al ingeniero") }),
      el("li", { className: "tutorial-control-desktop", text: t("Shift izquierdo — Correr") }),
      el("li", { className: "tutorial-control-desktop", text: t("Barra espaciadora — Saltar (gravedad terrestre)") }),
      el("li", { className: "tutorial-control-desktop", text: t("Arrastra el mouse — Orbitar la cámara") }),
      el("li", { className: "tutorial-control-desktop", text: t("E — Examinar instrumentos, planos y plataforma") }),
      el("li", { className: "tutorial-control-desktop", text: t("H — Minimizar o restaurar el panel de misión") }),
      el("li", { className: "tutorial-control-mobile", text: t("Joystick — Desplazarte por el campo") }),
      el("li", { className: "tutorial-control-mobile", text: t("Correr / Saltar — Botones de acción") }),
      el("li", { className: "tutorial-control-mobile", text: t("Acércate a una estación y pulsa Examinar") }),
      el("li", { className: "tutorial-control-mobile", text: t("Arrastra la escena para girar la cámara; abre el mapa para encontrar objetivos") }),
    );
    card.append(list);
    const dismiss = el("button", { className: "btn btn-primary btn-large", text: t("Comenzar"), attrs: { type: "button" } });
    dismiss.addEventListener("click", () => overlay.remove());
    card.append(dismiss);
    overlay.append(card);
    container.append(overlay);
  }

  private showOpeningSequence(container: HTMLElement): void {
    const overlay = el("div", { className: "modal-overlay mission-opening-overlay" });
    const card = el("div", { className: "modal-card tutorial-card mission-opening-card" });
    const prompt = el("p", { className: "mission-opening-prompt mission-opening-prompt--hidden", text: t("El campo espera.") });
    card.append(
      el("p", { className: "splash-badge", text: t("AUBURN, MASSACHUSETTS") }),
      el("p", { className: "mission-opening-date", text: t("MARCH 1926") }),
      el("h3", { className: "modal-title", text: t("THE BEGINNING") }),
      el("p", { className: "mission-opening-subtitle", text: t("One small launch can change everything") }),
      el("p", {
        className: "modal-description",
        text: t("A small experimental team is preparing a liquid-fuel rocket. Your work begins before the launch: explore the field, learn what the team knows, and help turn an uncertain experiment into evidence."),
      }),
      prompt,
    );
    const start = el("button", { className: "btn btn-primary btn-large", text: t("ENTER THE FIELD"), attrs: { type: "button" } });
    start.classList.add("mission-opening-start", "mission-opening-start--hidden");
    start.addEventListener("click", () => {
      missionAudio.startWind();
      overlay.remove();
      this.showTutorialOverlay(container);
    });
    card.append(start);
    overlay.append(card);
    container.append(overlay);
    window.setTimeout(() => {
      prompt.classList.remove("mission-opening-prompt--hidden");
      start.classList.remove("mission-opening-start--hidden");
    }, 2400);
  }

  private onTick(tickLabel: HTMLElement): void {
    if (this.paused || this.ended || this.state.tick >= 40) return;

    this.state.advanceTick();
    this.recordTimelineEvent();
    this.renderResources();
    this.renderLog();
    this.renderPhase();
    this.renderFlightMetrics();
    this.updateTickLabel(tickLabel);

    if (this.state.isFailed()) this.showToast("SYSTEM MARGIN LOW · The team records the issue. Continue to diagnose it; the mission is not reset.");

    const decision = this.state.pendingDecision();
    if (decision) {
      this.showDecisionModal(decision);
      return;
    }

    if (this.state.isComplete()) this.showToast("DAY'S END · Return to the observation area to review the flight and conclude the mission.");
  }

  private checkPendingDecisionOrResume(): void {
    const decision = this.state.pendingDecision();
    if (decision) this.showDecisionModal(decision);
  }

  private recordTimelineEvent(): void {
    const event = MISSION_1_TIMELINE_EVENTS.find((entry) => entry.atTick === this.state.tick);
    if (event) this.state.addLogEntry(event.text);
  }

  private showDecisionModal(event: DecisionEvent): void {
    if (!this.modalRoot) return;
    this.paused = true;
    this.modalRoot.classList.remove("modal-overlay--hidden");
    this.modalRoot.innerHTML = "";

    const card = el("div", { className: "modal-card" });
    card.append(
      el("h3", { className: "modal-title", text: t(event.title) }),
      el("p", { className: "modal-description", text: t(event.description) }),
    );
    const optionsWrap = el("div", { className: "modal-options" });
    for (const option of event.options) {
      const btn = el("button", { className: "btn btn-secondary", text: t(option.label), attrs: { type: "button" } });
      btn.addEventListener("click", () => this.resolveDecision(event, option.id));
      optionsWrap.append(btn);
    }
    card.append(optionsWrap);
    this.modalRoot.append(card);
  }

  private resolveDecision(event: DecisionEvent, optionId: string): void {
    this.state.applyDecision(event, optionId);
    this.modalRoot?.classList.add("modal-overlay--hidden");
    this.paused = false;
    this.renderResources();
    this.renderLog();
    this.renderFlightMetrics();

    void statisticsApi.record({
      missionSlug: MISSION_SLUG,
      metricKey: "decisions_made",
      metricLabel: "Decisiones tomadas",
      value: 1,
    });

    const option = event.options.find((o) => o.id === optionId);
    if (option?.grantsSample) {
      void samplesApi.collect({
        missionSlug: MISSION_SLUG,
        sampleKey: option.grantsSample.sampleKey,
        label: option.grantsSample.label,
        type: option.grantsSample.type,
        quality: option.grantsSample.quality,
      });
    }

    if (this.state.isFailed()) this.showToast("SYSTEM MARGIN LOW · The team records the issue. Continue with the available review.");
  }

  private renderResources(): void {
    for (const def of RESOURCE_DEFINITIONS) {
      const fill = this.resourceBars.get(def.key);
      if (!fill) continue;
      const value = this.state.resources[def.key];
      const percent = (value / def.max) * 100;
      fill.style.width = `${percent}%`;
      fill.classList.toggle("resource-fill--critical", percent <= def.criticalThreshold);
      const row = fill.closest(".resource-row") as (HTMLElement & { valueLabel?: HTMLElement }) | null;
      if (row?.valueLabel) row.valueLabel.textContent = `${Math.round(value)} ${def.unit}`;
    }
  }

  private renderLog(): void {
    if (!this.logPanel) return;
    this.logPanel.innerHTML = "";
    for (const line of this.state.log.slice(-6)) {
      this.logPanel.append(el("p", { className: "log-line", text: t(line) }));
    }
  }

  /** Keeps launch-facing metrics visible without altering the shared report contract. */
  private renderFlightMetrics(): void {
    if (!this.flightMetrics) return;
    const phase = this.state.currentPhase();
    const flightStarted = this.state.engineering.launchDecision === "proceed" && this.state.objectives.has("flight");
    const altitude = flightStarted
      ? Math.round(Math.min(15, (this.state.resources.stability * this.state.resources.telemetry) / 550) * 10) / 10
      : 0;
    const velocity = flightStarted
      ? Math.max(0, Math.round((this.state.resources.fuel + this.state.resources.pressure) * 0.16))
      : 0;
    this.flightMetrics.innerHTML = "";
    this.flightMetrics.append(
      el("p", { className: "flight-metrics-kicker", text: t(flightStarted ? "SECUENCIA DE VUELO" : "CONSOLA DE PRUEBAS") }),
      el("p", { className: "flight-metrics-phase", text: t(phase.title) }),
      this.metricRow(t("Masa estimada"), "48 kg"),
      this.metricRow(t("Empuje previsto"), `${Math.round(this.state.resources.pressure * 0.9)} N`),
      this.metricRow(t("Altitud estimada"), `${altitude} m`),
      this.metricRow(t("Velocidad"), `${velocity} m/s`),
      this.metricRow(t("Señal"), `${Math.round(this.state.resources.telemetry)}%`),
      el("p", {
        className: "flight-metrics-note",
        text: t(flightStarted ? "Simulated readings for this fictional run. Historical reference flight: about 12.5 m high and 56 m away." : "Datos calculados a partir de la configuración y las pruebas actuales."),
      }),
    );
  }

  private metricRow(label: string, value: string): HTMLElement {
    const row = el("div", { className: "flight-metric-row" });
    row.append(el("span", { text: label }), el("strong", { text: value }));
    return row;
  }

  /** Renders the narrative phase stepper + current phase objective/description. */
  private renderPhase(): void {
    const phase = this.state.currentPhase();
    const phaseIndex = this.state.currentPhaseIndex();

    if (this.phasePanel) {
      this.phasePanel.innerHTML = "";
      this.phasePanel.append(
        el("h3", { className: "phase-title", text: t(phase.title) }),
        el("p", { className: "phase-objective", text: `🎯 ${t(phase.objective)}` }),
        el("p", { className: "phase-description", text: t(phase.description) }),
      );
    }

    if (this.phaseStepper) {
      this.phaseStepper.innerHTML = "";
      MISSION_1_PHASES.forEach((p, index) => {
        const pill = el("span", { className: "phase-pill", text: String(index + 1), attrs: { title: t(p.title) } });
        if (index < phaseIndex) pill.classList.add("phase-pill--done");
        else if (index === phaseIndex) pill.classList.add("phase-pill--current");
        this.phaseStepper!.append(pill);
      });
    }
  }

  private updateTickLabel(tickLabel: HTMLElement): void {
    tickLabel.textContent = `${t("NARRATIVE PROGRESS")} — ${Math.round(this.state.progressPercent())}%`;
  }

  private renderObjectives(): void {
    const tickLabel = this.missionPanel?.querySelector<HTMLElement>(".tick-label");
    if (tickLabel) this.updateTickLabel(tickLabel);
    if (!this.objectivePanel) return;
    this.objectivePanel.innerHTML = "";
    this.objectivePanel.append(el("h3", { className: "phase-title", text: t("MISSION OBJECTIVES") }));
    const list = el("ul", { className: "mission-objective-list" });
    const activeId = MISSION_01_OBJECTIVES.find((entry) => !this.state.objectives.has(entry.id))?.id;
    for (const objective of MISSION_01_OBJECTIVES) {
      const done = this.state.objectives.has(objective.id);
      const active = objective.id === activeId;
      const className = done ? "mission-objective--done" : active ? "mission-objective--current" : "mission-objective--locked";
      const marker = done ? "✓" : active ? "▶" : "🔒";
      list.append(el("li", { className, text: `${marker} ${t(objective.label)}` }));
    }
    this.objectivePanel.append(list, el("p", { className: "phase-description", text: `${t("Checkpoint")}: ${t(this.state.checkpoint)} · ${t("Historical records")}: ${this.state.records.size}` }));
    this.renderMapObjective();
    this.renderPhase();
    this.gameplay?.setMissionProgress(this.state.progressPercent() / 100);
  }

  private autosave(): Promise<void> {
    if (this.ended || this.restarting) return Promise.resolve();
    const pending = this.persistCurrentState();
    this.pendingAutosaves.add(pending);
    void pending.then(
      () => this.pendingAutosaves.delete(pending),
      () => this.pendingAutosaves.delete(pending),
    );
    return pending;
  }

  private async persistCurrentState(): Promise<void> {
    if (this.ended || this.restarting) return;
    try {
      await progressApi.autosave(MISSION_SLUG, this.state.toSaveState(), this.state.persistenceProgressPercent());
      await inventoryApi.sync(
        RESOURCE_DEFINITIONS.map((def) => ({
          itemKey: def.key,
          label: def.label,
          quantity: this.state.resources[def.key],
          unit: def.unit,
          updatedAt: null,
        })),
      );
    } catch (err) {
      console.warn("[Mission1Screen] autosave failed", err);
    }
  }

  private endMission(_reason: "success" | "failure"): void {
    if (this.ended) return;
    this.ended = true;
    this.stopTimers();

    const report = this.state.buildReport();
    void (async () => {
      try {
        await progressApi.complete(MISSION_SLUG, report);
        await statisticsApi.record({
          missionSlug: MISSION_SLUG,
          metricKey: "samples_collected",
          metricLabel: "Muestras recolectadas",
          value: report.samplesCollected,
        });
      } catch (err) {
        console.warn("[Mission1Screen] failed to persist mission completion", err);
      } finally {
        await this.app.showReport(MISSION_SLUG);
      }
    })();
  }

  private stopTimers(): void {
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    if (this.autosaveTimer) window.clearInterval(this.autosaveTimer);
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    if (this.launchTimer) window.clearInterval(this.launchTimer);
    if (this.flightTimer) window.clearInterval(this.flightTimer);
  }

  private togglePanel(forceOpen?: boolean): void {
    if (!this.missionPanel || !this.restorePanelButton) return;
    const shouldMinimize = forceOpen === undefined
      ? !this.missionPanel.classList.contains("mission1-screen--minimized")
      : !forceOpen;
    this.missionPanel.classList.toggle("mission1-screen--minimized", shouldMinimize);
    this.restorePanelButton.classList.toggle("mission-panel-restore--hidden", !shouldMinimize);
    const toggle = this.missionPanel.querySelector(".mission-panel-toggle");
    if (toggle instanceof HTMLButtonElement) {
      toggle.textContent = shouldMinimize ? t("+ Restaurar") : t("− Minimizar");
      toggle.setAttribute(
        "aria-label",
        shouldMinimize ? "Restaurar panel de misión" : "Minimizar panel de misión",
      );
    }
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLElement && target.isContentEditable);
  }

  unmount(): void {
    this.stopTimers();
    missionAudio.stopWind();
    window.removeEventListener("keydown", this.onPanelToggleKey);
    window.removeEventListener("keydown", this.onMapKey);
    this.restorePanelButton = null;
    this.missionPanel = null;
    this.flightMetrics = null;
    this.mobileInteractButton = null;
  }
}
