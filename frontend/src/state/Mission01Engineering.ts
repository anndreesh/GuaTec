export type StructureChoice = "light" | "balanced" | "reinforced";

export interface EngineeringProfile {
  structure: StructureChoice;
  instrumentation: "basic" | "extended";
  budget: number;
  testResponse: "modify" | "retest" | "accept-risk" | null;
  launchDecision: "proceed" | "delay" | null;
  riskTolerance: number;
}

export const DEFAULT_ENGINEERING: EngineeringProfile = {
  structure: "balanced", instrumentation: "basic", budget: 80,
  testResponse: null, launchDecision: null, riskTolerance: 50,
};

export function calculateEngineering(profile: EngineeringProfile) {
  const structure = {
    light: { mass: 34, stability: 48, reliability: 43, cost: 18 },
    balanced: { mass: 52, stability: 68, reliability: 67, cost: 30 },
    reinforced: { mass: 77, stability: 86, reliability: 84, cost: 48 },
  }[profile.structure];
  return {
    mass: structure.mass,
    stability: Math.min(100, structure.stability + (profile.instrumentation === "extended" ? -5 : 0)),
    reliability: Math.min(100, structure.reliability + (profile.instrumentation === "extended" ? 4 : 0)),
    data: profile.instrumentation === "extended" ? 88 : 58,
    cost: structure.cost + (profile.instrumentation === "extended" ? 18 : 0),
  };
}
