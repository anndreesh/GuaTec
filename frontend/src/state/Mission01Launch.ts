import type { EngineeringProfile } from "@/state/Mission01Engineering";
import { calculateEngineering } from "@/state/Mission01Engineering";

export type FlightResult = "stable-flight" | "deviation" | "incomplete-data" | "underperformance" | "delayed";

/** Budget points spent each time the launch is delayed to recheck conditions. */
export const LAUNCH_DELAY_BUDGET_COST = 6;

/** Abstract game outcome only; this is not a real vehicle performance model. */
export function resolveFlight(profile: EngineeringProfile, recoveredData: number): FlightResult {
  if (profile.launchDecision === "delay") return "delayed";
  const design = calculateEngineering(profile);
  if (profile.testResponse === "accept-risk" && design.stability < 70) return "deviation";
  if (recoveredData < 40 || profile.instrumentation === "basic") return "incomplete-data";
  if (design.stability >= 75 && design.reliability >= 75) return "stable-flight";
  if (design.stability < 55) return "deviation";
  return "underperformance";
}

export function flightResultLabel(result: FlightResult): string {
  if (result === "stable-flight") return "SUCCESSFUL FLIGHT";
  if (result === "underperformance") return "PARTIAL SUCCESS";
  if (result === "deviation") return "EXPERIMENTAL FAILURE";
  return "LIMITED DATA";
}

/** Peak altitude in metres for the cinematic, kept near the 1926 historical scale. */
export function flightPeakAltitude(result: FlightResult): number {
  if (result === "stable-flight") return 12.5;
  if (result === "underperformance") return 8.2;
  if (result === "incomplete-data" || result === "delayed") return 6.4;
  return 3.8;
}
