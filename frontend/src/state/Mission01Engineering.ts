export type StructureChoice = "light" | "balanced" | "reinforced";
export type InstrumentationChoice = "basic" | "balanced" | "advanced";
/** What the team optimises for when the trade-offs conflict (MISSION_01_DESIGN_SPEC, phase D). */
export type ProjectPriority = "cost" | "stability" | "data";

export interface EngineeringProfile {
  structure: StructureChoice;
  instrumentation: InstrumentationChoice;
  priority: ProjectPriority;
  budget: number;
  testResponse: "modify" | "retest" | "accept-risk" | null;
  launchDecision: "proceed" | "delay" | null;
  riskTolerance: number;
  /** Derived from persisted field-task results, never an independent save authority. */
  fieldModifiers?: { mass: number; stability: number; data: number; cost: number };
}

export const DEFAULT_ENGINEERING: EngineeringProfile = {
  structure: "balanced", instrumentation: "basic", priority: "stability", budget: 80,
  testResponse: null, launchDecision: null, riskTolerance: 50,
};

/** Budget available for the design before testing; the rest is spent by configuration cost. */
export const DESIGN_BUDGET = 80;

interface Modifiers {
  stability: number;
  reliability: number;
  data: number;
  cost: number;
}

const INSTRUMENTATION_EFFECTS: Record<InstrumentationChoice, Modifiers> = {
  basic: { stability: 0, reliability: 0, data: 58, cost: 0 },
  balanced: { stability: -2, reliability: 2, data: 74, cost: 9 },
  advanced: { stability: -5, reliability: 4, data: 88, cost: 18 },
};

const PRIORITY_EFFECTS: Record<ProjectPriority, Modifiers> = {
  cost: { stability: -3, reliability: -2, data: 0, cost: -6 },
  stability: { stability: 4, reliability: 2, data: 0, cost: 4 },
  data: { stability: -2, reliability: 0, data: 6, cost: 3 },
};

function percent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function calculateEngineering(profile: EngineeringProfile) {
  const structure = {
    light: { mass: 34, stability: 48, reliability: 43, cost: 18 },
    balanced: { mass: 52, stability: 68, reliability: 67, cost: 30 },
    reinforced: { mass: 77, stability: 86, reliability: 84, cost: 48 },
  }[profile.structure];
  const instrumentation = INSTRUMENTATION_EFFECTS[profile.instrumentation];
  const priority = PRIORITY_EFFECTS[profile.priority];
  return {
    mass: percent(structure.mass + (profile.fieldModifiers?.mass ?? 0)),
    stability: percent(structure.stability + instrumentation.stability + priority.stability + (profile.fieldModifiers?.stability ?? 0)),
    reliability: percent(structure.reliability + instrumentation.reliability + priority.reliability),
    data: percent(instrumentation.data + priority.data + (profile.fieldModifiers?.data ?? 0)),
    cost: Math.max(0, structure.cost + instrumentation.cost + priority.cost + (profile.fieldModifiers?.cost ?? 0)),
  };
}
