/** Mission objectives are data so the HUD and saved progress can share one source. */
export const MISSION_01_OBJECTIVES = [
  { id: "lab", label: "Find the project area", location: "Project Area", required: true, checkpoint: "Arrival" },
  { id: "discover", label: "Meet the director and understand the experiment", location: "Project Area", required: true, checkpoint: "Project discovery" },
  { id: "meet-team", label: "Meet the team", location: "Work Area", required: true, checkpoint: "Project discovery" },
  { id: "prototype", label: "Understand the prototype", location: "Prototype Area", required: true, checkpoint: "Project discovery" },
  { id: "design", label: "Prepare the vehicle", location: "Engineering Bench", required: true, checkpoint: "Engineering" },
  { id: "testing", label: "Complete testing", location: "Test Area", required: true, checkpoint: "Testing" },
  { id: "diagnose", label: "Investigate the instability", location: "Prototype Area", required: true, checkpoint: "Testing" },
  { id: "prepare", label: "Prepare the launch", location: "Launch Field", required: true, checkpoint: "Launch preparation" },
  { id: "observation", label: "Go to the observation area", location: "Observation Area", required: true, checkpoint: "Launch" },
  { id: "flight", label: "Attempt flight", location: "Observation Area", required: true, checkpoint: "Launch" },
  { id: "analysis", label: "Analyze the results", location: "Analysis Station", required: true, checkpoint: "Analysis" },
] as const;

export type MissionObjectiveId = (typeof MISSION_01_OBJECTIVES)[number]["id"];

export const MAP_OBJECTIVE_TARGET: Record<MissionObjectiveId, string> = {
  lab: "project-area",
  discover: "director-greeting",
  "meet-team": "meet-propulsion",
  prototype: "inspect-prototype",
  design: "engine-selection",
  testing: "pressure-test",
  diagnose: "inspect-prototype",
  prepare: "launch-window",
  observation: "telemetry-fluctuation",
  flight: "telemetry-fluctuation",
  analysis: "analysis-station",
};

export function mapTargetForObjective(id: MissionObjectiveId, unmetNpc?: string): string {
  if (id === "meet-team" && unmetNpc) return unmetNpc;
  return MAP_OBJECTIVE_TARGET[id];
}
