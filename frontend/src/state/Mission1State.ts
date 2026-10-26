import {
  MISSION_1_DECISIONS,
  MISSION_1_PHASES,
  MISSION_1_TOTAL_TICKS,
  RESOURCE_DEFINITIONS,
  type DecisionEvent,
  type MissionPhase,
  type ResourceKey,
} from "@/config/gameConfig";
import type { MissionReport, MissionSaveState } from "@/types";
import {
  DEFAULT_ENGINEERING,
  calculateEngineering,
  type EngineeringProfile,
  type InstrumentationChoice,
  type ProjectPriority,
} from "@/state/Mission01Engineering";
import type { MissionObjectiveId } from "@/state/Mission01Objectives";
import { MISSION_01_OBJECTIVES } from "@/state/Mission01Objectives";
import { resolveFlight, type FlightResult } from "@/state/Mission01Launch";
import { MISSION_01_STAGES } from "@/state/Mission01Events";
import { FIELD_TASK_IDS, fieldTaskResult, isFieldTaskId, restoreFieldDraft, type FieldTaskId, type FieldTaskDraft, type MissionMiniGameResult } from "./Mission01FieldTasks";

export type MissionEngineeringTask = "propulsion" | "circuits" | "antenna" | "diagnosis" | "launch";
export type MissionWorldWeather = "CLEAR" | "CLOUDY" | "LIGHT MIST" | "WINDY";
const TEST_ORDER = ["system", "instrumentation", "communications", "stability"] as const;

/**
 * Pure gameplay state/logic for Mission 1, kept independent from the DOM so
 * it can be unit-tested and so `Mission1Screen` only has to deal with
 * rendering + wiring timers.
 */
export class Mission1State {
  tick = 0;
  resources: Record<ResourceKey, number>;
  resolvedDecisionIds = new Set<string>();
  log: string[] = [];
  samplesCollected: { sampleKey: string; label: string; type: string; quality: number }[] = [];
  decisionsMade = 0;
  objectives = new Set<MissionObjectiveId>();
  records = new Set<string>();
  analyzed = new Set<string>();
  engineering: EngineeringProfile = { ...DEFAULT_ENGINEERING };
  checkpoint = "Arrival";
  flightResult: FlightResult | null = null;
  metNpcs = new Set<string>();
  testsRun = new Set<string>();
  checklist = new Set<string>();
  inspectedCauses = new Set<string>();
  diagnosis: string | null = null;
  riskAccepted = false;
  extraTestRequired = false;
  engineeringTasks = new Set<MissionEngineeringTask>();
  fieldResults = new Map<FieldTaskId, MissionMiniGameResult>();
  fieldDrafts: Partial<Record<FieldTaskId, FieldTaskDraft>> = {};
  routeChecks = new Set<string>();
  worldWeather: MissionWorldWeather | null = null;

  constructor(saved?: MissionSaveState) {
    this.resources = Object.fromEntries(
      RESOURCE_DEFINITIONS.map((def) => [def.key, def.initial]),
    ) as Record<ResourceKey, number>;

    if (saved && Number.isFinite(saved.tick)) {
      this.tick = clamp(Math.floor(saved.tick), 0, MISSION_1_TOTAL_TICKS);
      for (const definition of RESOURCE_DEFINITIONS) {
        const value = saved.resources?.[definition.key];
        if (Number.isFinite(value)) this.resources[definition.key] = clamp(value, 0, definition.max);
      }
      this.resolvedDecisionIds = new Set(saved.resolvedDecisionIds ?? []);
      this.log = saved.log ?? [];
      this.decisionsMade = saved.decisionsMade ?? this.resolvedDecisionIds.size;
      this.samplesCollected = saved.samplesCollected ?? [];
      const extra = saved.mission01;
      if (extra) {
        this.records = new Set(Array.isArray(extra.records) ? extra.records : []);
        this.analyzed = new Set(Array.isArray(extra.analyzed) ? extra.analyzed : []);
        this.engineering = restoreEngineering(extra.engineering);
        this.flightResult = extra.flightResult;
        this.metNpcs = new Set(stringArray(extra.metNpcs));
        this.testsRun = new Set(stringArray(extra.testsRun));
        this.checklist = new Set(stringArray(extra.checklist));
        this.inspectedCauses = new Set(stringArray(extra.inspectedCauses));
        this.diagnosis = extra.diagnosis ?? null;
        this.riskAccepted = extra.riskAccepted ?? false;
        this.engineeringTasks = new Set(stringArray(extra.engineeringTasks).filter((id): id is MissionEngineeringTask =>
          ["propulsion", "circuits", "antenna", "diagnosis", "launch"].includes(id)));
        // Preserve earned checkpoints from the older three-test mission. New or
        // unfinished test sessions must solve the additional communications task.
        if (!extra.taskVersion) {
          if (this.testsRun.has("system")) this.engineeringTasks.add("propulsion");
          if (this.testsRun.has("instrumentation")) this.engineeringTasks.add("circuits");
          if ((Array.isArray(extra.objectives) ? extra.objectives : []).includes("testing")) {
            this.testsRun.add("communications");
            this.engineeringTasks.add("antenna");
          }
          if ((Array.isArray(extra.objectives) ? extra.objectives : []).includes("diagnose")) this.engineeringTasks.add("diagnosis");
          if ((Array.isArray(extra.objectives) ? extra.objectives : []).includes("prepare")) this.engineeringTasks.add("launch");
        }
        this.objectives = this.validateSavedObjectives(Array.isArray(extra.objectives) ? extra.objectives as MissionObjectiveId[] : []);
        this.checkpoint = this.checkpointForObjectives();
        this.routeChecks = new Set(stringArray(extra.routeChecks).filter(id => /^route-check-[123]$/.test(id)));
        for (const result of Array.isArray(extra.fieldResults) ? extra.fieldResults : []) {
          if (result && isFieldTaskId(result.id) && result.completed && Number.isFinite(result.attempts) && Number.isFinite(result.mistakes)) {
            this.fieldResults.set(result.id, result.inherited
              ? { ...fieldTaskResult(result.id), inherited: true, score: 0, effects: {} }
              : fieldTaskResult(result.id, result.attempts, result.mistakes, result.conditions));
          }
        }
        const validWeather = (value: unknown): value is MissionWorldWeather =>
          value === "CLEAR" || value === "CLOUDY" || value === "LIGHT MIST" || value === "WINDY";
        this.worldWeather = validWeather(extra.worldWeather)
          ? extra.worldWeather
          : this.fieldResults.get("weather")?.conditions ?? null;
        for (const id of FIELD_TASK_IDS) {
          if (extra.fieldDrafts?.[id]) this.fieldDrafts[id] = restoreFieldDraft(extra.fieldDrafts[id]);
        }
        // Earned legacy checkpoints remain earned. New/uncompleted phases use the field tasks.
        if (extra.fieldVersion !== 2) {
          const earned: Array<[boolean, FieldTaskId[]]> = [
            [this.objectives.has("design"), ["assembly", "mass"]],
            [this.objectives.has("testing"), ["calibration", "signal"]],
            [this.objectives.has("prepare"), ["route", "weather"]],
            [this.analyzed.has("Smoked Drum Flight Record"), ["recovery"]],
          ];
          for (const [completed, ids] of earned) if (completed) for (const id of ids) {
            // Compatibility records explain migration and award no retroactive effects.
            if (!this.fieldResults.has(id)) this.fieldResults.set(id, { ...fieldTaskResult(id), inherited: true, score: 0, effects: {} });
          }
          if (this.fieldResults.has("route")) for (const n of [1, 2, 3]) this.routeChecks.add(`route-check-${n}`);
        }
        this.refreshFieldModifiers();
        this.objectives = this.validateSavedObjectives(Array.isArray(extra.objectives) ? extra.objectives as MissionObjectiveId[] : [], true);
        this.checkpoint = this.checkpointForObjectives();
      }
    }
  }

  /** Advances the simulation by one tick, applying passive resource decay. */
  advanceTick(): void {
    if (this.tick >= MISSION_1_TOTAL_TICKS) return;
    this.tick += 1;
    for (const def of RESOURCE_DEFINITIONS) {
      this.resources[def.key] = clamp(this.resources[def.key] - def.decayPerTick, 0, def.max);
    }
  }

  /** Returns the decision event that should fire at the current tick, if any. */
  pendingDecision(): DecisionEvent | null {
    const event = MISSION_1_DECISIONS.find((d) => d.atTick === this.tick);
    if (!event || this.resolvedDecisionIds.has(event.id)) return null;
    return event;
  }

  activateDecision(id: string): DecisionEvent | null {
    const event = MISSION_1_DECISIONS.find((candidate) => candidate.id === id);
    if (!event || this.resolvedDecisionIds.has(id)) return null;
    this.tick = Math.max(this.tick, event.atTick);
    return event;
  }

  applyDecision(event: DecisionEvent, optionId: string): string {
    const option = event.options.find((o) => o.id === optionId);
    if (!option) throw new Error(`Unknown decision option: ${optionId}`);

    for (const [key, delta] of Object.entries(option.effects) as [ResourceKey, number][]) {
      const def = RESOURCE_DEFINITIONS.find((d) => d.key === key)!;
      this.resources[key] = clamp(this.resources[key] + delta, 0, def.max);
    }
    if (option.grantsSample) {
      this.samplesCollected.push(option.grantsSample);
    }

    this.resolvedDecisionIds.add(event.id);
    this.decisionsMade += 1;
    this.log.push(`[T${this.tick}] ${event.title}: ${option.resultText}`);
    return option.resultText;
  }

  addLogEntry(text: string): void {
    if (!this.log.includes(text)) this.log.push(text);
  }

  completeObjective(id: MissionObjectiveId): boolean {
    if (this.objectives.has(id)) return true;
    const index = MISSION_01_OBJECTIVES.findIndex((item) => item.id === id);
    if (index < 0 || MISSION_01_OBJECTIVES.slice(0, index).some((item) => item.required && !this.objectives.has(item.id))) {
      return false;
    }
    if (!this.fieldPrerequisitesMet(id)) return false;
    if (id === "meet-team" && !this.teamMet()) return false;
    if (id === "prototype" && !this.objectives.has("meet-team")) return false;
    if (id === "testing" && !this.testsComplete()) return false;
    if (id === "diagnose" && ((!this.diagnosis && !this.riskAccepted) || !this.engineeringTasks.has("diagnosis"))) return false;
    if (id === "prepare" && (!this.engineeringTasks.has("launch") || !this.checklistComplete() || this.engineering.launchDecision !== "proceed")) return false;
    if (id === "observation" && this.engineering.launchDecision !== "proceed") return false;
    if (id === "flight" && (!this.flightResult || this.engineering.launchDecision !== "proceed")) return false;
    if (id === "analysis" && (!this.analyzed.has("Propulsion & Pressure Data") ||
      !this.analyzed.has("Structural & Frame Data") || !this.analyzed.has("Smoked Drum Flight Record"))) return false;
    this.objectives.add(id);
    const objective = MISSION_01_OBJECTIVES.find((item) => item.id === id);
    if (objective) this.checkpoint = objective.checkpoint;
    const phaseTick: Record<MissionObjectiveId, number> = {
      lab: 2, discover: 4, "meet-team": 7, prototype: 9, design: 14,
      testing: 20, diagnose: 23, prepare: 26, observation: 28, flight: 32, analysis: 38,
    };
    this.tick = Math.max(this.tick, phaseTick[id]);
    this.addLogEntry(`MISSION LOG — ${objective?.label ?? id}`);
    return true;
  }

  collectRecord(id: string): boolean {
    if (this.records.has(id)) return false;
    this.records.add(id);
    this.addLogEntry(`HISTORICAL RECORD FOUND — ${id}`);
    return true;
  }

  setEngineering(patch: Partial<EngineeringProfile>): void {
    const before = calculateEngineering(this.engineering);
    this.engineering = { ...this.engineering, ...patch };
    this.refreshFieldModifiers();
    const metrics = calculateEngineering(this.engineering);
    this.resources.stability = this.objectives.has("design") ? clamp(this.resources.stability + metrics.stability - before.stability, 0, 100) : metrics.stability;
    this.resources.telemetry = this.objectives.has("design") ? clamp(this.resources.telemetry + metrics.data - before.data, 0, 100) : metrics.data;
  }

  setFieldDraft(id: FieldTaskId, draft: FieldTaskDraft): void {
    if (!this.fieldResults.has(id)) this.fieldDrafts[id] = restoreFieldDraft(draft);
  }

  inspectRoute(id: string): boolean {
    if (!this.objectives.has("diagnose") || !/^route-check-[123]$/.test(id)) return false;
    this.routeChecks.add(id);
    return true;
  }

  completeFieldTask(result: MissionMiniGameResult): boolean {
    if (!isFieldTaskId(result.id) || !result.completed) return false;
    if (this.fieldResults.has(result.id)) return true;
    const prerequisite = result.id === "assembly" || result.id === "mass" ? "prototype"
      : result.id === "calibration" || result.id === "signal" ? "design"
      : result.id === "recovery" ? "flight" : "diagnose";
    if (!this.objectives.has(prerequisite)) return false;
    if (result.id === "route" && this.routeChecks.size !== 3) return false;
    if ((result.id === "assembly" || result.id === "mass") && this.testsRun.size > 0) return false;
    if (!Number.isFinite(result.attempts) || !Number.isFinite(result.mistakes)) return false;
    const accepted = fieldTaskResult(result.id, result.attempts, result.mistakes, result.conditions);
    this.fieldResults.set(accepted.id, accepted);
    delete this.fieldDrafts[accepted.id];
    this.refreshFieldModifiers();
    this.resources.stability = clamp(this.resources.stability + (accepted.effects.stability ?? 0), 0, 100);
    this.resources.telemetry = clamp(this.resources.telemetry + (accepted.effects.dataQuality ?? 0), 0, 100);
    this.engineering.budget = clamp(this.engineering.budget + (accepted.effects.budget ?? 0), 0, 100);
    for (let i = 0; i < (accepted.effects.time ?? 0); i++) this.advanceTick();
    this.addLogEntry(`FIELD RESULT — ${accepted.id}: ${accepted.score}/100 · ${accepted.attempts} attempts · ${accepted.mistakes} mistakes`);
    return true;
  }

  get launchReadiness(): number {
    return Math.min(100, [...this.fieldResults.values()].reduce((sum, result) => sum + (result.effects.launchReadiness ?? (result.score === 0 ? result.id === "route" ? 60 : result.id === "weather" ? 40 : 0 : 0)), 0));
  }

  private refreshFieldModifiers(): void {
    const modifiers = { mass: 0, stability: 0, data: 0, cost: 0 };
    for (const result of this.fieldResults.values()) {
      modifiers.mass += result.effects.mass ?? 0;
      modifiers.stability += result.effects.stability ?? 0;
      modifiers.data += result.effects.dataQuality ?? 0;
      modifiers.cost -= result.effects.budget ?? 0;
    }
    this.engineering.fieldModifiers = modifiers;
  }

  analyzeData(topic: string): void {
    this.analyzed.add(topic);
    this.addLogEntry(`ANALYSIS — ${topic} reviewed.`);
  }

  meetNpc(id: string): boolean {
    if (this.metNpcs.has(id)) return false;
    this.metNpcs.add(id);
    return true;
  }

  teamMet(): boolean {
    return ["meet-propulsion", "meet-structural", "meet-data"].every((id) => this.metNpcs.has(id));
  }

  unmetNpc(): string | undefined {
    return ["meet-propulsion", "meet-structural", "meet-data"].find((id) => !this.metNpcs.has(id));
  }

  runTest(id: string): boolean {
    if (this.testsRun.has(id)) return false;
    const index = TEST_ORDER.findIndex((entry) => entry === id);
    if (!this.objectives.has("design") || index < 0 || TEST_ORDER.slice(0, index).some((entry) => !this.testsRun.has(entry))) return false;
    const task = { system: "propulsion", instrumentation: "circuits", communications: "antenna" }[id] as MissionEngineeringTask | undefined;
    if (task && !this.engineeringTasks.has(task)) return false;
    this.testsRun.add(id);
    return true;
  }

  testsComplete(): boolean {
    return TEST_ORDER.every((id) => this.testsRun.has(id)) &&
      (["propulsion", "circuits", "antenna"] as const).every((id) => this.engineeringTasks.has(id));
  }

  /** Called only by a task's validated completion callback, never by proximity. */
  completeEngineeringTask(id: MissionEngineeringTask): boolean {
    if (this.engineeringTasks.has(id)) return true;
    if (!this.objectives.has("design")) return false;
    if (id === "circuits" && !this.testsRun.has("system")) return false;
    if (id === "antenna" && !this.testsRun.has("instrumentation")) return false;
    if (id === "diagnosis" && !this.objectives.has("testing")) return false;
    if (id === "launch" && !this.objectives.has("diagnose")) return false;
    this.engineeringTasks.add(id);
    this.addLogEntry(`ENGINEERING VALIDATED — ${id}`);
    return true;
  }

  markChecklist(id: string): boolean {
    if (this.checklist.has(id)) return false;
    this.checklist.add(id);
    return true;
  }

  checklistComplete(): boolean {
    return ["inspect-vehicle", "check-instruments", "review-conditions", "confirm-observation", "confirm-telemetry"]
      .every((id) => this.checklist.has(id));
  }

  pendingChecklist(): string | undefined {
    return ["inspect-vehicle", "check-instruments", "review-conditions", "confirm-observation", "confirm-telemetry"]
      .find((id) => !this.checklist.has(id));
  }

  expectedDiagnosis(): string {
    if (this.engineering.structure === "light") return "Mass distribution";
    if (this.engineering.instrumentation === "advanced") return "Instrumentation";
    if (this.engineering.structure === "reinforced") return "Structural balance";
    return "System configuration";
  }

  currentStage(): (typeof MISSION_01_STAGES)[number] {
    if (this.objectives.has("analysis")) return "AFTERMATH";
    if (this.objectives.has("flight")) return "ANALYSIS";
    if (this.objectives.has("observation")) return "LAUNCH";
    if (this.objectives.has("prepare")) return "OBSERVATION";
    if (this.objectives.has("diagnose")) return "LAUNCH_PREPARATION";
    if (this.objectives.has("testing")) return "TESTING";
    if (this.objectives.has("design")) return "TESTING";
    if (this.objectives.has("prototype") && this.objectives.has("meet-team")) return "ENGINEERING";
    if (this.objectives.has("discover")) return "OPEN_AIR_EXPLORATION";
    if (this.objectives.has("lab")) return "ARRIVAL";
    return "ARRIVAL";
  }

  isFailed(): boolean {
    return RESOURCE_DEFINITIONS.some((def) => this.resources[def.key] <= 0);
  }

  isComplete(): boolean {
    return MISSION_01_OBJECTIVES.every((item) => !item.required || this.objectives.has(item.id));
  }

  progressPercent(): number {
    return clamp((this.objectives.size / MISSION_01_OBJECTIVES.length) * 100, 0, 100);
  }

  persistenceProgressPercent(): number {
    // Only the explicit end-of-mission report may mark the backend campaign complete.
    return clamp((this.objectives.size / MISSION_01_OBJECTIVES.length) * 99, 0, 99);
  }

  /** Narrative phase covering the current tick (drives the phase-stepper HUD). */
  currentPhase(): MissionPhase {
    return (
      MISSION_1_PHASES.find((phase) => this.tick >= phase.fromTick && this.tick <= phase.toTick) ??
      MISSION_1_PHASES[MISSION_1_PHASES.length - 1]!
    );
  }

  currentPhaseIndex(): number {
    return MISSION_1_PHASES.findIndex((phase) => phase.id === this.currentPhase().id);
  }

  toSaveState(): MissionSaveState {
    return {
      tick: this.tick,
      resources: this.resources,
      resolvedDecisionIds: [...this.resolvedDecisionIds],
      log: this.log,
      decisionsMade: this.decisionsMade,
      samplesCollected: this.samplesCollected,
      mission01: {
        objectives: [...this.objectives], records: [...this.records],
        engineering: this.engineering, checkpoint: this.checkpoint,
        analyzed: [...this.analyzed], flightResult: this.flightResult,
        metNpcs: [...this.metNpcs], testsRun: [...this.testsRun], checklist: [...this.checklist],
        inspectedCauses: [...this.inspectedCauses], diagnosis: this.diagnosis, riskAccepted: this.riskAccepted,
        engineeringTasks: [...this.engineeringTasks], taskVersion: 1,
        fieldVersion: 2, fieldResults: [...this.fieldResults.values()],
        fieldDrafts: structuredClone(this.fieldDrafts), routeChecks: [...this.routeChecks],
        ...(this.worldWeather ? { worldWeather: this.worldWeather } : {}),
      },
    };
  }

  setWorldWeather(weather: MissionWorldWeather): void {
    this.worldWeather = weather;
  }

  buildReport(): MissionReport {
    const failed = this.isFailed();
    // Objective-driven Mission 01 no longer advances the legacy timeline
    // decision counter. Base the report on the recorded experiment instead.
    const result = this.flightResult ?? resolveFlight(this.engineering, this.resources.telemetry);
    const outcome: MissionReport["outcome"] = failed || result === "deviation"
      ? "failure"
      : result === "stable-flight"
        ? "success"
        : "partial";

    const summaries: Record<MissionReport["outcome"], string> = {
      success: "El motor de combustible líquido completó su prueba. Un vuelo breve, pero una demostración decisiva de que la cohetería práctica podía avanzar.",
      partial: "La prueba produjo evidencia útil, aunque no todas las decisiones llegaron a resolverse antes del cierre de la ventana.",
      failure: "La prueba se detuvo antes de completar la secuencia. El equipo documentó las debilidades técnicas para el siguiente intento.",
    };

    return {
      ticksSurvived: this.tick,
      decisionsMade: this.decisionsMade,
      samplesCollected: this.samplesCollected.length,
      finalResources: { ...this.resources },
      outcome,
      summary: `${summaries[outcome]} Resultado del vuelo: ${result}. Registros históricos: ${this.records.size}.`,
      engineeringConfiguration: { ...this.engineering },
      testingDecision: this.engineering.testResponse,
      launchDecision: this.engineering.launchDecision,
      flightResult: this.flightResult ?? resolveFlight(this.engineering, this.resources.telemetry),
      dataRecovered: this.resources.telemetry,
      optionalObjectives: [...this.objectives].filter((id) => id === "prototype" || id === "testing"),
      historicalRecords: [...this.records],
      fieldResults: [...this.fieldResults.values()], launchReadiness: this.launchReadiness,
    };
  }

  private fieldPrerequisitesMet(id: MissionObjectiveId): boolean {
    const requirements: Partial<Record<MissionObjectiveId, FieldTaskId[]>> = {
      design: ["assembly", "mass"], testing: ["calibration", "signal"],
      prepare: ["route", "weather"], analysis: ["recovery"],
    };
    return (requirements[id] ?? []).every(task => this.fieldResults.has(task));
  }

  private validateSavedObjectives(saved: MissionObjectiveId[], includeField = false): Set<MissionObjectiveId> {
    const valid = new Set<MissionObjectiveId>();
    for (const item of MISSION_01_OBJECTIVES) {
      if (!item.required || !saved.includes(item.id)) continue;
      const index = MISSION_01_OBJECTIVES.indexOf(item);
      if (MISSION_01_OBJECTIVES.slice(0, index).some((prior) => prior.required && !valid.has(prior.id))) break;
      if (includeField && !this.fieldPrerequisitesMet(item.id)) break;
      if (item.id === "meet-team" && !this.teamMet()) break;
      if (item.id === "prototype" && !valid.has("meet-team")) break;
      if (item.id === "testing" && !this.testsComplete()) break;
      if (item.id === "diagnose" && ((!this.diagnosis && !this.riskAccepted) || !this.engineeringTasks.has("diagnosis"))) break;
      if (item.id === "prepare" && (!this.engineeringTasks.has("launch") || !this.checklistComplete() || this.engineering.launchDecision !== "proceed")) break;
      if (item.id === "observation" && this.engineering.launchDecision !== "proceed") break;
      if (item.id === "flight" && (!this.flightResult || this.engineering.launchDecision !== "proceed")) break;
      if (item.id === "analysis" && (!this.analyzed.has("Propulsion & Pressure Data") ||
        !this.analyzed.has("Structural & Frame Data") || !this.analyzed.has("Smoked Drum Flight Record"))) break;
      valid.add(item.id);
    }
    return valid;
  }

  private checkpointForObjectives(): string {
    let checkpoint = "Arrival";
    for (const item of MISSION_01_OBJECTIVES) {
      if (this.objectives.has(item.id)) checkpoint = item.checkpoint;
      else break;
    }
    return checkpoint;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

const INSTRUMENTATION_CHOICES: readonly InstrumentationChoice[] = ["basic", "balanced", "advanced"];
const PRIORITY_CHOICES: readonly ProjectPriority[] = ["cost", "stability", "data"];

function restoreInstrumentation(value: unknown): InstrumentationChoice {
  // Saves from before the three-level model stored "extended"; it maps to the advanced level.
  if (value === "extended") return "advanced";
  return INSTRUMENTATION_CHOICES.find((choice) => choice === value) ?? DEFAULT_ENGINEERING.instrumentation;
}

function restorePriority(value: unknown): ProjectPriority {
  return PRIORITY_CHOICES.find((choice) => choice === value) ?? DEFAULT_ENGINEERING.priority;
}

function restoreEngineering(saved?: Partial<EngineeringProfile>): EngineeringProfile {
  const structure = saved?.structure;
  const instrumentation = saved?.instrumentation;
  const priority = saved?.priority;
  const testResponse = saved?.testResponse;
  const launchDecision = saved?.launchDecision;
  return {
    structure: structure === "light" || structure === "balanced" || structure === "reinforced"
      ? structure : DEFAULT_ENGINEERING.structure,
    instrumentation: restoreInstrumentation(instrumentation),
    priority: restorePriority(priority),
    budget: Number.isFinite(saved?.budget) ? clamp(saved!.budget!, 0, 100) : DEFAULT_ENGINEERING.budget,
    testResponse: testResponse === "modify" || testResponse === "retest" || testResponse === "accept-risk"
      ? testResponse : null,
    launchDecision: launchDecision === "proceed" || launchDecision === "delay" ? launchDecision : null,
    riskTolerance: Number.isFinite(saved?.riskTolerance)
      ? clamp(saved!.riskTolerance!, 0, 100) : DEFAULT_ENGINEERING.riskTolerance,
  };
}
