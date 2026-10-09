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
import { DEFAULT_ENGINEERING, calculateEngineering, type EngineeringProfile } from "@/state/Mission01Engineering";
import type { MissionObjectiveId } from "@/state/Mission01Objectives";
import { MISSION_01_OBJECTIVES } from "@/state/Mission01Objectives";
import { resolveFlight, type FlightResult } from "@/state/Mission01Launch";

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

  constructor(saved?: MissionSaveState) {
    this.resources = Object.fromEntries(
      RESOURCE_DEFINITIONS.map((def) => [def.key, def.initial]),
    ) as Record<ResourceKey, number>;

    if (saved && saved.tick !== undefined) {
      this.tick = saved.tick;
      this.resources = { ...this.resources, ...saved.resources };
      this.resolvedDecisionIds = new Set(saved.resolvedDecisionIds ?? []);
      this.log = saved.log ?? [];
      this.decisionsMade = saved.decisionsMade ?? this.resolvedDecisionIds.size;
      this.samplesCollected = saved.samplesCollected ?? [];
      const extra = saved.mission01;
      if (extra) {
        this.objectives = new Set(extra.objectives as MissionObjectiveId[]);
        this.records = new Set(extra.records);
        this.analyzed = new Set(extra.analyzed);
        this.engineering = { ...DEFAULT_ENGINEERING, ...extra.engineering };
        this.checkpoint = extra.checkpoint;
        this.flightResult = extra.flightResult;
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

  completeObjective(id: MissionObjectiveId): void {
    if (this.objectives.has(id)) return;
    this.objectives.add(id);
    const objective = MISSION_01_OBJECTIVES.find((item) => item.id === id);
    if (objective) this.checkpoint = objective.checkpoint;
    const phaseTick: Record<MissionObjectiveId, number> = {
      lab: 2, discover: 5, prototype: 8, design: 13,
      testing: 20, prepare: 26, flight: 32, analysis: 38,
    };
    this.tick = Math.max(this.tick, phaseTick[id]);
    this.addLogEntry(`MISSION LOG — ${objective?.label ?? id}`);
  }

  collectRecord(id: string): boolean {
    if (this.records.has(id)) return false;
    this.records.add(id);
    this.addLogEntry(`HISTORICAL RECORD FOUND — ${id}`);
    return true;
  }

  setEngineering(patch: Partial<EngineeringProfile>): void {
    this.engineering = { ...this.engineering, ...patch };
    const metrics = calculateEngineering(this.engineering);
    this.resources.stability = metrics.stability;
    this.resources.telemetry = metrics.data;
  }

  analyzeData(topic: string): void {
    this.analyzed.add(topic);
    this.addLogEntry(`ANALYSIS — ${topic} reviewed.`);
  }

  isFailed(): boolean {
    return RESOURCE_DEFINITIONS.some((def) => this.resources[def.key] <= 0);
  }

  isComplete(): boolean {
    return this.objectives.has("analysis");
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
      },
    };
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
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
