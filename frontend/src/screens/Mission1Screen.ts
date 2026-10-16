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
import { MISSION_01_OBJECTIVES } from "@/state/Mission01Objectives";
import { calculateEngineering } from "@/state/Mission01Engineering";
import { resolveFlight } from "@/state/Mission01Launch";
import { MISSION_01_DIALOGUE } from "@/state/Mission01Events";
import type { Screen } from "@/screens/Screen";
import type { MissionSaveState } from "@/types";
import { t } from "@/core/i18n";

const MISSION_SLUG = MISSION_SLUGS.mission1;
const MAP_OBJECTIVE_TARGET: Record<string, string> = {
  lab: "project-area",
  discover: "project-area",
  team: "prototype-area",
  prototype: "prototype-area",
  design: "engine-selection",
  testing: "pressure-test",
  prepare: "launch-window",
  flight: "telemetry-fluctuation",
  analysis: "analysis-area",
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
    this.showToast(t("Restarting mission…"));
    try {
      await progressApi.replay(MISSION_SLUG);
      this.stopTimers();
      await this.app.showMission1();
    } catch (error) {
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
    card.append(header, map, this.mapLocations, details);
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
    const configuredPoints = MISSION_1_POIS.map((poi) => ({
      id: poi.id,
      label: poi.label,
      x: poi.position.x,
      z: poi.position.z,
      navigable: true,
    }));
    const points = [...state.points];
    for (const poi of configuredPoints) {
      if (!points.some((point) => point.id === poi.id)) points.push(poi);
    }
    this.mapState = { ...state, points };
    if (!this.mapPlayer) return;
    if (this.mapGrid && this.mapGrid.querySelectorAll(".mission-map-point").length !== points.length) {
      this.mapGrid.querySelectorAll(".mission-map-point").forEach((point) => point.remove());
      if (this.mapLocations) this.mapLocations.innerHTML = "";
      this.mapLocations?.append(el("h3", { className: "mission-map-locations-title", text: t("ALL LOCATIONS") }));
      for (const [index, point] of points.entries()) {
        const label = t(point.label);
        const number = String(index + 1);
        const marker = el("span", { className: "mission-map-point", text: number, attrs: { title: `${number} · ${label}`, "aria-label": `${number}. ${label}` } });
        marker.dataset.x = String(point.x);
        marker.dataset.z = String(point.z);
        marker.dataset.label = label;
        this.mapGrid.append(marker);
        if (point.navigable === false) {
          this.mapLocations?.append(el("div", { className: "mission-map-location mission-map-location--landmark", text: `${number} · ${label}` }));
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
    const pendingId = MISSION_01_OBJECTIVES.find((entry) => !this.state.objectives.has(entry.id))?.id ?? "complete";
    if (pendingId !== this.renderedMapObjectiveId) this.renderMapObjective();
    else this.updateMapDistance();
  }

  private renderMapObjective(): void {
    const objective = this.mapOverlay?.querySelector(".mission-map-objective");
    if (!objective) return;
    const pending = MISSION_01_OBJECTIVES.find((entry) => !this.state.objectives.has(entry.id));
    this.renderedMapObjectiveId = pending?.id ?? "complete";
    const targetId = pending ? this.mapTargetForObjective(pending.id) : null;
    const target = targetId ? this.mapState?.points.find((point) => point.id === targetId) : null;
    objective.innerHTML = "";
    this.mapDistance = el("p", { className: "mission-map-distance" });
    objective.append(
      el("p", { className: "mission-map-kicker", text: t("CURRENT OBJECTIVE") }),
      el("strong", { className: "mission-map-current", text: t(pending?.label ?? "Mission complete") }),
      el("p", { className: "mission-map-location", text: `${t("LOCATION")}\n${t(target?.label ?? "Project area")}` }),
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
    const targetId = pending ? this.mapTargetForObjective(pending.id) : null;
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

  private mapTargetForObjective(objectiveId: string): string | null {
    if (objectiveId === "team") {
      if (!this.state.crewMembers.has("structural")) return "prototype-area";
      if (!this.state.crewMembers.has("data")) return "instrument-station";
      return "project-area";
    }
    if (objectiveId === "testing" && this.state.testingChecks.size === 3 && this.state.diagnosticChecks.size < 3) {
      return "prototype-area";
    }
    return MAP_OBJECTIVE_TARGET[objectiveId] ?? null;
  }

  private updateInteractionPrompt(poi: NearbyPoi | null): void {
    this.mobileInteractButton?.classList.toggle("mobile-interact-button--hidden", !poi);
    if (this.mobileInteractButton) this.mobileInteractButton.textContent = poi ? `${t("Examinar")} · ${poi.label}` : t("Examinar");
    if (!this.interactionPrompt) return;
    if (!poi) {
      this.interactionPrompt.classList.add("interaction-prompt--hidden");
      return;
    }
    const action = t("E · EXAMINE OUTDOOR STATION");
    this.interactionPrompt.textContent = `${action}: ${poi.label}`;
    this.interactionPrompt.classList.remove("interaction-prompt--hidden");
  }

  /** World interactions advance mission objectives and persist meaningful choices. */
  private handleInteract(poiId: string): void {
    const poi = MISSION_1_POIS.find((p) => p.id === poiId);
    if (!poi) return;

    if (poiId === "project-area") {
      this.state.completeObjective("lab");
      this.state.completeObjective("discover");
      this.state.meetCrewMember("propulsion");
      this.state.collectRecord("The project — outdoor field notebook");
      this.showEngineeringLeadDialogue(() => {
        this.showChoice("PROJECT AREA · FIELD NOTE", `${poi.flavorText}\n\n${MISSION_01_DIALOGUE.director[0]}\n\nThe fictional team is trying to prove controlled liquid-fuel flight, not reach space.`, [
          { label: "Review the project notes", run: () => { this.state.collectRecord("Project brief — field notebook"); this.showToast("FIELD NOTE RECORDED · Inspect the prototype and instruments around the outdoor work area."); } },
          { label: "Talk to the propulsion engineer", run: () => { this.state.addLogEntry("ING. ANDREW WELLS · PROPULSION — We can make it stronger. And heavier."); this.showToast("The engineer points toward the outdoor engineering bench."); } },
        ], false);
      });
      return;
    }
    if (poiId === "prototype-area") {
      if (this.state.testingChecks.size === 3 && !this.state.objectives.has("testing")) {
        this.openTesting(true);
        return;
      }
      const firstInspection = !this.state.objectives.has("prototype");
      this.state.meetCrewMember("structural");
      this.state.completeObjective("prototype");
      if (firstInspection) this.state.collectRecord("Prototype sketch — experimental vehicle");
      this.state.collectRecord("Prototype status — untested");
      this.showChoice("EXPERIMENTAL VEHICLE · STATUS UNTESTED", `${poi.flavorText}\n\nING. ELENA BROOKS · STRUCTURAL ENGINEER: “The frame is small. We will learn more from the readings than from its size.”\n\nThe flight asks whether the propulsion system can lift a vehicle clear of the ground. Design values are fictional game abstractions.`, [
        { label: "Record the prototype inspection", run: () => this.showToast("PROTOTYPE INSPECTED · The structural engineer asks you to meet the data technician before design review.") },
      ], false);
      return;
    }
    if (poiId === "instrument-station") {
      this.state.meetCrewMember("data");
      this.state.collectRecord("Instrument sheet — limited data coverage");
      this.collectSample({ sampleKey: "field-recorder-1926", label: "Outdoor instrument readiness sheet", type: "telemetry", quality: this.state.engineering.instrumentation === "extended" ? 0.86 : 0.62 });
      this.showChoice("MARA REED · DATA TECHNICIAN", `${poi.flavorText}\n\n“The recorder can only preserve what we remember to measure. I'll mark the trace and keep a separate observation sheet.”`, [
        { label: "Add the instrument sheet to the mission log", run: () => this.showToast("DATA COLLECTION · LIMITED · The instrument sheet is in the mission log. The team is ready for its briefing.") },
      ], false);
      return;
    }
    if (poiId === "engine-selection") { this.openEngineering(); return; }
    if (poiId === "pressure-test") { this.openTesting(); return; }
    if (poiId === "launch-window") { this.openLaunchPreparation(); return; }
    if (poiId === "telemetry-fluctuation") {
      if (this.state.engineering.launchDecision === "proceed" && !this.state.objectives.has("flight")) {
        this.state.flightResult = resolveFlight(this.state.engineering, this.state.resources.telemetry);
        this.state.completeObjective("flight");
        this.collectSample({ sampleKey: "flight-observation-1926", label: "Launch day flight observation", type: "flight-record", quality: this.state.resources.telemetry / 100 });
        this.state.addLogEntry("OBSERVATION AREA — The crew is in position. The flight recorder is ready.");
        this.renderObjectives();
        void this.autosave();
        this.runLaunchSequence();
        return;
      }
      this.showToast("FLIGHT OBSERVATION RECORDED · Return to the outdoor analysis table to review the data.");
      return;
    }
    if (poiId === "analysis-area") { this.openAnalysis(); return; }
    this.showToast(poi.flavorText);
  }

  private showChoice(title: string, description: string, options: { label: string; run: () => void }[], countsAsDecision = true): void {
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
        if (countsAsDecision) this.state.decisionsMade += 1;
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

  private showEngineeringLeadDialogue(onContinue: () => void): void {
    const lines = MISSION_01_DIALOGUE.engineeringLead;
    this.state.addLogEntry(`RADIO — ENGINEERING LEAD: ${lines[1]}`);
    this.showChoice(
      lines[0]!,
      lines.slice(1).join("\n\n"),
      [{ label: "Continue · review the outdoor field notes", run: onContinue }],
      false,
    );
  }

  private openEngineering(): void {
    if (!this.state.objectives.has("prototype")) { this.showToast("INSPECT THE PROTOTYPE AT THE OUTDOOR PROJECT AREA FIRST."); return; }
    if (!this.state.objectives.has("team")) { this.showToast("MEET THE STRUCTURAL ENGINEER AND DATA TECHNICIAN BEFORE THE DESIGN REVIEW."); return; }
    const stats = calculateEngineering(this.state.engineering);
    this.showChoice("ENGINEERING · ABSTRACT DESIGN", `Structure: ${this.state.engineering.structure.toUpperCase()} · Instrumentation: ${this.state.engineering.instrumentation.toUpperCase()}\n\nMass ${stats.mass}% · Stability ${stats.stability}% · Data ${stats.data}% · Reliability ${stats.reliability}% · Budget use ${stats.cost}%\n\nThese are game values, not construction instructions. Choose a trade-off; a heavy reinforced structure improves margin but uses more budget.`, [
      { label: "LIGHT structure · lower mass, lower margin", run: () => this.chooseDesign("light") },
      { label: "BALANCED structure · moderate trade-off", run: () => this.chooseDesign("balanced") },
      { label: "REINFORCED structure · more stability, higher mass", run: () => this.chooseDesign("reinforced") },
      { label: "Extended instrumentation · more data, uses budget", run: () => {
        if (this.state.engineering.instrumentation !== "extended") this.state.engineering.budget = Math.max(0, this.state.engineering.budget - 18);
        this.state.setEngineering({ instrumentation: "extended" }); this.state.completeObjective("design");
        this.gameplay?.setDesign(this.state.engineering.structure, "extended");
        this.showToast("INSTRUMENTATION INSTALLED · Data capacity increased; budget margin reduced.");
      } },
    ]);
  }

  private chooseDesign(structure: "light" | "balanced" | "reinforced"): void {
    this.state.setEngineering({ structure });
    this.gameplay?.setDesign(structure, this.state.engineering.instrumentation);
    this.state.engineering.budget = Math.max(0, 80 - calculateEngineering(this.state.engineering).cost);
    this.state.completeObjective("design");
    const line = structure === "light" ? MISSION_01_DIALOGUE.engineerLight : structure === "reinforced" ? MISSION_01_DIALOGUE.engineerHeavy : "The design leaves room for both structure and useful measurements.";
    this.showToast(`DESIGN LOCKED · ${line}`);
  }

  private openTesting(atPrototype = false): void {
    if (!this.state.objectives.has("design")) { this.showToast("CONFIGURE THE VEHICLE AT THE OUTDOOR ENGINEERING BENCH BEFORE TESTING."); return; }
    const metrics = calculateEngineering(this.state.engineering);
    const structural = metrics.stability >= 65 ? "STRUCTURAL TEST · PASS WITH MARGIN" : "STRUCTURAL TEST · LIMITED MARGIN";
    const dataStatus = this.state.engineering.instrumentation === "extended" ? "DATA RECORDING · READY" : "DATA RECORDING · BASIC COVERAGE";
    const tests = [
      { id: "system", label: "Run the system test", note: "SYSTEM TEST — The abstract propulsion indicators stay within the expected range." },
      { id: "instrumentation", label: "Run the instrumentation test", note: "INSTRUMENTATION TEST — The field recorder catches a brief fluctuation." },
      { id: "stability", label: "Run the stability check", note: `${structural} — The prototype remains on its exterior support.` },
    ];
    const missing = tests.filter((test) => !this.state.testingChecks.has(test.id));
    if (missing.length) {
      this.showChoice("TEST AREA · SYSTEM CHECKS", `${dataStatus}\n\nComplete each exterior check before diagnosing the recorder anomaly.\n\n${tests.map((test) => `${this.state.testingChecks.has(test.id) ? "✓" : "□"} ${test.label}`).join("\n")}`, missing.map((test) => ({
        label: test.label,
        run: () => {
          this.state.completeTestCheck(test.id);
          this.state.collectRecord(`Test sheet — ${test.id} check`);
          if (test.id === "instrumentation") {
            this.state.resources.telemetry = Math.min(100, this.state.resources.telemetry + 6);
            this.collectSample({ sampleKey: "instrumentation-check-1926", label: "Instrumentation test recorder trace", type: "telemetry", quality: this.state.engineering.instrumentation === "extended" ? 0.88 : 0.65 });
          }
          this.state.addLogEntry(test.note);
          this.showToast(test.note);
          this.openTesting();
        },
      })), false);
      return;
    }
    if (!atPrototype) {
      this.showToast("THREE TESTS COMPLETE · Walk back to the prototype platform to investigate the recorder anomaly.");
      this.renderMapObjective();
      return;
    }
    const inspections = [
      { id: "balance", label: "Inspect the prototype's balance", note: "FIELD INSPECTION — The crew finds a slight imbalance in the fictional support arrangement." },
      { id: "recorder", label: "Inspect the recorder trace", note: "RECORDER INSPECTION — The trace is real, but the basic setup leaves some uncertainty about its source." },
      { id: "supports", label: "Inspect the exterior supports", note: "SUPPORT INSPECTION — The frame remains secure; the readings do not point to a support failure." },
    ];
    const remainingInspections = inspections.filter((inspection) => !this.state.diagnosticChecks.has(inspection.id));
    if (remainingInspections.length) {
      this.showChoice("TEST ANOMALY · FIELD INVESTIGATION", `The team has completed the system, recorder, and stability checks. Walk around the exterior prototype and inspect the evidence before deciding what to change.\n\n${inspections.map((inspection) => `${this.state.diagnosticChecks.has(inspection.id) ? "✓" : "□"} ${inspection.label}`).join("\n")}`, remainingInspections.map((inspection) => ({
        label: inspection.label,
        run: () => {
          this.state.completeDiagnosticCheck(inspection.id);
          this.state.collectRecord(`Anomaly investigation — ${inspection.id}`);
          this.state.addLogEntry(inspection.note);
          this.showToast(inspection.note);
          this.openTesting(true);
        },
      })), false);
      return;
    }
    this.showChoice("WARNING · UNEXPECTED INSTABILITY", `${structural}\n${dataStatus}\nSYSTEM TEST · COMPLETE\n\nING. JOSE VEGA: “That fluctuation wasn't there before.”\nING. ELENA BROOKS: “We have checked the system, recorder, and frame. The trace still points to a balance issue.”\n\nChoose how the fictional team will respond. Each option affects the experiment record.`, [
      { label: "Correct the balance finding · spend budget to add margin", run: () => { this.state.engineering.budget = Math.max(0, this.state.engineering.budget - 12); this.state.setEngineering({ structure: "reinforced", testResponse: "modify" }); this.gameplay?.setDesign("reinforced", this.state.engineering.instrumentation); this.state.collectRecord("Test sheet — structural margin revised"); this.state.completeObjective("testing"); this.showToast("DIAGNOSIS CONFIRMED · The balance adjustment improved stability; mass increased."); } },
      { label: "Choose another cause · run an extra test", run: () => { this.state.engineering.budget = Math.max(0, this.state.engineering.budget - 5); this.state.advanceTick(); this.state.engineering.testResponse = "retest"; this.state.collectRecord("Test sheet — additional diagnostic test"); this.state.completeObjective("testing"); this.showToast("DIAGNOSTIC ERROR · The extra check cost time and budget. The team recorded the balance finding for later review."); } },
      { label: "Accept the risk · keep current configuration", run: () => { this.state.engineering.testResponse = "accept-risk"; this.state.engineering.riskTolerance = 80; this.state.collectRecord("Test sheet — instability accepted for observation"); this.state.completeObjective("testing"); this.showToast("RISK RECORDED · The team will monitor the instability during flight."); } },
    ]);
  }

  private openLaunchPreparation(): void {
    if (!this.state.objectives.has("testing")) { this.showToast("COMPLETE THE SYSTEMS REVIEW BEFORE PREPARING THE LAUNCH."); return; }
    const weather = this.gameplay?.getWeather() ?? "CLOUDY";
    const checklist = [
      { id: "vehicle", label: "Inspect vehicle", note: "VEHICLE CHECK — The fictional crew records the prototype's status." },
      { id: "instruments", label: "Check instruments", note: "INSTRUMENT CHECK — Mechanical recorder and observation station are ready." },
      { id: "conditions", label: "Review conditions", note: `CONDITIONS CHECK — ${weather} weather; the crew notes the morning launch window.` },
      { id: "observation", label: "Confirm observation area", note: "OBSERVATION CHECK — The team confirms its outdoor viewing positions." },
      { id: "telemetry", label: "Confirm telemetry", note: `TELEMETRY CHECK — ${Math.round(this.state.resources.telemetry)}% data capacity available.` },
    ];
    const missing = checklist.filter((item) => !this.state.launchChecks.has(item.id));
    if (missing.length) {
      this.showChoice("LAUNCH FIELD · CHECKLIST", `WEATHER · ${weather}\nTIME · ${this.state.tick < 20 ? "DAWN" : this.state.tick < 32 ? "MORNING" : "LATE MORNING"}\n\n${checklist.map((item) => `${this.state.launchChecks.has(item.id) ? "✓" : "□"} ${item.label}`).join("\n")}\n\nComplete each exterior check before the launch decision.`, missing.map((item) => ({
        label: `Check · ${item.label}`,
        run: () => {
          this.state.completeLaunchCheck(item.id);
          this.state.collectRecord(`Launch checklist — ${item.label.toLowerCase()}`);
          this.state.addLogEntry(item.note);
          this.openLaunchPreparation();
        },
      })), false);
      return;
    }
    this.showChoice("LAUNCH FIELD · FINAL REVIEW", `${checklist.map((item) => `✓ ${item.label}`).join("\n")}\n\nWEATHER · ${weather}\nTIME · ${this.state.tick < 20 ? "DAWN" : this.state.tick < 32 ? "MORNING" : "LATE MORNING"}\n\nMARA REED · DATA TECHNICIAN: “Recorder ready.”\nING. TOMÁS ELDRICH · DIRECTOR: “Are we ready?”\n\nThe historic flight took place March 16, 1926, in Auburn, Massachusetts. Your character and team are fictional.`, [
      { label: "Proceed · walk to the observation area", run: () => { this.state.engineering.launchDecision = "proceed"; this.state.collectRecord("Launch checklist — conditions and instruments confirmed"); this.state.completeObjective("prepare"); this.state.addLogEntry("LAUNCH DECISION — Proceed. The team takes its positions at the observation area."); this.renderObjectives(); void this.autosave(); this.showToast("PROCEEDING · Walk to the observation area to begin the countdown."); } },
      { label: "Delay · recheck instruments and accept the cost", run: () => { this.state.engineering.launchDecision = "delay"; this.state.engineering.budget = Math.max(0, this.state.engineering.budget - 8); this.state.resources.telemetry = Math.min(100, this.state.resources.telemetry + 12); this.state.collectRecord("Launch checklist — delay and recalibration noted"); this.state.completeObjective("prepare"); this.state.completeObjective("flight"); this.state.flightResult = "delayed"; this.state.addLogEntry("LAUNCH DECISION — Delay. Additional instrument review completed; today's attempt is recorded as delayed."); this.showToast("LAUNCH DELAYED · Additional data recovered. Return to the outdoor analysis table to review it."); } },
    ]);
  }

  private openAnalysis(): void {
    if (!this.state.objectives.has("flight")) { this.showToast("THE FLIGHT RECORD WILL BE AVAILABLE AFTER THE LAUNCH DECISION."); return; }
    const result = this.state.flightResult ?? resolveFlight(this.state.engineering, this.state.resources.telemetry);
    const evidence = ["Propulsion data", "Structural data", "Flight record"];
    const missingEvidence = evidence.filter((topic) => !this.state.analyzed.has(topic));
    this.showChoice("FLIGHT ANALYSIS", `FLIGHT RESULT · ${result.toUpperCase()}\n\n${MISSION_01_DIALOGUE.historicalNote}\n\nThe historical figures are reference context; the simulated outcome is fictional. Review the evidence sets to complete the analysis.`, [
      ...missingEvidence.map((topic) => ({ label: `${topic === "Flight record" ? "Recover and review" : "Analyze"} · ${topic.toLowerCase()}`, run: () => {
        this.state.analyzeData(topic);
        if (topic === "Flight record") this.state.collectRecord("Launch day — flight observation");
        this.showToast(`EVIDENCE REVIEWED · ${topic.toUpperCase()}`);
      } })),
      { label: "Conclude mission · save report", run: () => {
        const required = ["lab", "discover", "team", "prototype", "design", "testing", "prepare", "flight"] as const;
        const missing = required.filter((id) => !this.state.objectives.has(id));
        if (missing.length || evidence.some((topic) => !this.state.analyzed.has(topic))) { this.showToast(`MISSION INCOMPLETE · ${missing.length ? `${missing.length} objective(s)` : "Review all three evidence sets"} still need attention.`); this.openAnalysis(); return; }
        this.state.analyzeData("Flight report"); this.state.completeObjective("analysis"); this.renderObjectives(); this.runMissionEnding();
      } },
    ], false);
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
    const status = el("p", { className: "modal-description mission-launch-status", text: t("The team is clear of the stand. The recorder is running. Press 1 for cinematic, 2 for observation, or 3 for telemetry view.") });
    const readings = el("div", { className: "mission-launch-readings" });
    card.append(heading, countdown, status, readings);
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
        if (remaining <= 3) status.textContent = t("The small crew watches the stand and the mechanical recorder.");
        return;
      }
      if (this.launchTimer) window.clearInterval(this.launchTimer);
      this.launchTimer = undefined;
      countdown.textContent = t("IGNITION");
      countdown.classList.add("mission-launch-ignition");
      this.modalRoot?.classList.add("mission-launch-overlay--cinematic");
      status.textContent = t("The vehicle leaves the frame. Record the flight, then review the result.");
      this.gameplay?.playLaunch();
      const startedAt = performance.now();
      this.flightTimer = window.setInterval(() => {
        const seconds = Math.min(14, (performance.now() - startedAt) / 1000);
        // These are cinematic telemetry values: continue climbing throughout
        // the longer ascent instead of showing the previous rise-and-fall arc.
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
        if (seconds >= 14) {
          if (this.flightTimer) window.clearInterval(this.flightTimer);
          this.flightTimer = undefined;
          this.modalRoot?.classList.add("modal-overlay--hidden");
          this.modalRoot?.classList.remove("mission-launch-overlay--cinematic");
          this.paused = false;
          this.togglePanel(true);
          this.state.addLogEntry(`FLIGHT OBSERVATION — ${this.state.flightResult ?? "recorded"}. The vehicle continued climbing throughout the observation window; displayed altitude and velocity are abstract game values. Historical reference: 41 ft / 12.5 m and 184 ft / 56 m.`);
          this.renderLog();
          this.renderFlightMetrics();
          this.showToast("The crew is quiet for a moment. ‘It flew.’ Walk to the outdoor analysis table to review the record.");
          void this.autosave();
        }
      }, 200);
    }, 1000);
  }

  private runMissionEnding(): void {
    if (!this.modalRoot) return;
    this.paused = true;
    this.gameplay?.playMissionEndingShot();
    this.modalRoot.classList.add("mission-ending-overlay--cinematic");
    this.modalRoot.classList.remove("modal-overlay--hidden");
    this.modalRoot.innerHTML = "";
    const card = el("div", { className: "modal-card mission-ending-card" });
    const result = this.state.flightResult ?? "incomplete-data";
    const delayed = result === "delayed";
    const title = delayed
      ? "TODAY'S FLIGHT WAS DELAYED. THE WORK CONTINUES."
      : result === "stable-flight"
        ? "THE FLIGHT WAS SMALL. THE POSSIBILITY WAS NOT."
        : result === "incomplete-data"
          ? "THE RECORD IS INCOMPLETE. THE QUESTION REMAINS."
          : result === "underperformance"
            ? "THE FLIGHT FELL SHORT. THE EVIDENCE REMAINS."
            : "THE FLIGHT DEVIATED. THE EVIDENCE REMAINS.";
    const engineerLine = delayed
      ? "We have a clearer record. We still need a flight."
      : "We still have work to do.";
    card.append(
      el("p", { className: "mission-launch-kicker", text: t("FIELD NOTES · AUBURN, 1926") }),
      el("h2", { className: "mission-ending-title", text: t(title) }),
      el("p", { className: "mission-ending-dialogue", text: `${t("ING. ELENA BROOKS · STRUCTURAL ENGINEER")}\n“${t(engineerLine)}”` }),
      el("p", { className: "mission-ending-dialogue", text: `${t("ING. TOMÁS ELDRICH · PROJECT DIRECTOR")}\n“${t("Of course. That's how this begins.") }”` }),
      el("p", { className: "mission-ending-caption", text: t("The 1926 historical flight was brief. This fictional team's choices and simulated result belong to the game.") }),
    );
    const finish = el("button", { className: "btn btn-primary btn-large", text: t("FINISH MISSION 01"), attrs: { type: "button" } });
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
      el("p", {
        className: "modal-description",
        text: t("A small experimental team is preparing a liquid-fuel rocket. Your work begins before the launch: explore the field, learn what the team knows, and help turn an uncertain experiment into evidence."),
      }),
      prompt,
    );
    const start = el("button", { className: "btn btn-primary btn-large", text: t("ENTER THE FIELD"), attrs: { type: "button" } });
    start.classList.add("mission-opening-start", "mission-opening-start--hidden");
    start.addEventListener("click", () => {
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
    for (const objective of MISSION_01_OBJECTIVES) {
      const done = this.state.objectives.has(objective.id);
      list.append(el("li", { className: done ? "mission-objective--done" : "", text: `${done ? "✓" : "□"} ${t(objective.label)}` }));
    }
    this.objectivePanel.append(list, el("p", { className: "phase-description", text: `${t("Checkpoint")}: ${t(this.state.checkpoint)} · ${t("Historical records")}: ${this.state.records.size}` }));
    this.renderMapObjective();
    this.renderPhase();
    this.gameplay?.setMissionProgress(this.state.progressPercent() / 100);
  }

  private async autosave(): Promise<void> {
    if (this.ended) return;
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
    window.removeEventListener("keydown", this.onPanelToggleKey);
    window.removeEventListener("keydown", this.onMapKey);
    this.restorePanelButton = null;
    this.missionPanel = null;
    this.flightMetrics = null;
    this.mobileInteractButton = null;
  }
}
