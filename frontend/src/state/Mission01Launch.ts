import type { EngineeringProfile } from "@/state/Mission01Engineering";
import { calculateEngineering } from "@/state/Mission01Engineering";

export type FlightResult = "stable-flight" | "deviation" | "incomplete-data" | "underperformance" | "delayed";

/** Abstract game outcome only; this is not a real vehicle performance model. */
export function resolveFlight(profile: EngineeringProfile, recoveredData: number): FlightResult {
  if (profile.launchDecision === "delay") return "delayed";
  const design = calculateEngineering(profile);
  if (recoveredData < 40 || profile.instrumentation === "basic") return "incomplete-data";
  if (design.stability >= 75 && design.reliability >= 75) return "stable-flight";
  if (design.stability < 55) return "deviation";
  return "underperformance";
}
