/** Narrative and checkpoint identifiers used by Mission 01. */
export const MISSION_01_CHECKPOINTS = [
  "Arrival", "Project discovery", "Engineering", "Testing",
  "Launch preparation", "Launch", "Aftermath",
] as const;

export const MISSION_01_DIAGNOSTIC_CAUSES = [
  "Mass distribution", "Instrumentation load", "System instability", "Structural stress",
] as const;

export const MISSION_01_DIALOGUE = {
  director: [
    "ING. TOMÁS ELDRICH · PROJECT DIRECTOR: You're the new assistant?",
    "ING. TOMÁS ELDRICH · PROJECT DIRECTOR: Today we didn't reach the sky.",
    "ING. TOMÁS ELDRICH · PROJECT DIRECTOR: We proved that we could leave the ground. That's enough for a beginning.",
  ],
  engineeringLead: [
    "RADIO — ING. JOSE VEGA · ENGINEERING LEAD",
    "Welcome to the Auburn field station. You are looking at a small experiment with a large consequence.",
    "We are not trying to reach space today. We are asking one careful question: can liquid-fuel propulsion lift a vehicle clear of the ground?",
    "Inspect the prototype, listen to the team, and record what we learn. The design choices here are game abstractions, not real construction instructions.",
  ],
  engineerLight: "ING. ANDREW WELLS — It's light. Let's hope we've given it enough stability.",
  engineerHeavy: "ING. ANDREW WELLS — It's heavier than I wanted, but at least it won't flex as much.",
  historicalNote: "The 1926 flight was brief: about 41 feet high and 184 feet in distance. Its importance was proving liquid-fuel propulsion could produce flight.",
} as const;
