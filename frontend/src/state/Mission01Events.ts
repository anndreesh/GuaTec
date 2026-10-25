/** Narrative and checkpoint identifiers used by Mission 01. */
export const MISSION_01_CHECKPOINTS = [
  "Arrival", "Project discovery", "Engineering", "Testing",
  "Launch preparation", "Launch", "Analysis", "Aftermath",
] as const;

export const MISSION_01_STAGES = [
  "OPENING", "ARRIVAL", "OPEN_AIR_EXPLORATION", "PROJECT_BRIEFING",
  "ENGINEERING", "TESTING", "LAUNCH_PREPARATION", "OBSERVATION",
  "LAUNCH", "FLIGHT", "ANALYSIS", "AFTERMATH", "ENDING", "COMPLETE",
] as const;

export const MISSION_01_DIAGNOSTIC_CAUSES = [
  "Mass distribution",
  "Instrumentation",
  "Structural balance",
  "System configuration",
] as const;

export const MISSION_01_DIALOGUE = {
  director: [
    "You're here.",
    "Good.",
    "Today is an important day.",
    "Today we're going to attempt something people have doubted for years.",
    "We are going to see whether our machine can actually fly.",
  ],
  directorWelcome: [
    "Today is an important day for history.",
    "Not because we're going somewhere.",
    "Not because we're trying to reach space.",
    "We're trying to prove one thing: that this machine can leave the ground.",
    "Welcome to the project.",
  ],
  briefing: [
    "We don't need a perfect machine.",
    "We need a successful experiment.",
    "If it flies, we learn.",
    "If it fails, we learn why.",
  ],
  engineeringLead: [
    "RADIO — INGENIERO ANDRES L · LÍDER DE INGENIERÍA",
    "Welcome to the Auburn field station. You are looking at a small experiment with a large consequence.",
    "We are not trying to reach space today. We are asking one careful question: can liquid-fuel propulsion lift a vehicle clear of the ground?",
    "Inspect the prototype, listen to the team, and record what we learn. The design choices here are game abstractions, not real construction instructions.",
  ],
  ambient: {
    propulsion: "Check the readings again.",
    structural: "I already did.",
    data: "Then we'll check them once more.",
  },
  anomaly: {
    propulsion: "That wasn't there before.",
    structural: "Then something changed.",
    director: "Find it.",
  },
  preLaunch: {
    data: "Recording ready.",
    propulsion: "System ready.",
    director: "All right. Let's see what happens.",
  },
  engineerLight: "It's light. Let's hope we've given it enough stability.",
  engineerHeavy: "Better. But heavier.",
  engineerBalanced: "This leaves room for both structure and useful measurements.",
  itFlew: "It flew.",
  aftermathStructural: "We still have work to do.",
  aftermathDirector: "Of course. That's how this begins.",
  historicalNote: "The historic 1926 flight was extremely short. Its importance was not its distance. It demonstrated that liquid-fuel propulsion could produce flight.",
} as const;
