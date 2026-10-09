/** Mission objectives are data so the HUD and saved progress can share one source. */
export const MISSION_01_OBJECTIVES = [
  { id: "lab", label: "Find the outdoor project area", checkpoint: "Arrival" },
  { id: "discover", label: "Learn what the experiment must prove", checkpoint: "Project discovery" },
  { id: "prototype", label: "Inspect the prototype and field notes", checkpoint: "Project discovery" },
  { id: "design", label: "Configure the vehicle at the open workbench", checkpoint: "Engineering" },
  { id: "testing", label: "Investigate the test anomaly", checkpoint: "Testing" },
  { id: "prepare", label: "Complete the outdoor launch checklist", checkpoint: "Launch preparation" },
  { id: "flight", label: "Observe the experimental flight", checkpoint: "Launch" },
  { id: "analysis", label: "Review the flight data outside", checkpoint: "Analysis" },
] as const;

export type MissionObjectiveId = (typeof MISSION_01_OBJECTIVES)[number]["id"];
