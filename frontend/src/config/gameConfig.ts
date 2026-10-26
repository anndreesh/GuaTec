import { FIELD_STATION_LOCATIONS, FIELD_ROUTE_POINTS } from "../babylon/gameplay/FieldStations";

/**
 * Central configuration for the whole frontend.
 *
 * Every tunable constant (API base URL, timing, resource definitions,
 * decision events, colors) lives here so gameplay/UX tweaks don't require
 * hunting through scene/screen files.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

export const STORAGE_KEYS = {
  authToken: "mm.authToken",
  username: "mm.username",
} as const;

export const MISSION_SLUGS = {
  mission1: "mission-1-arrival",
  mission2: "mission-2-deep-exploration",
  mission3: "mission-3-outpost",
} as const;

/** Milliseconds between simulation ticks in the Mission 1 gameplay loop. */
export const TICK_INTERVAL_MS = 45000;

/** Milliseconds between autosave PUT requests to the backend. */
export const AUTOSAVE_INTERVAL_MS = 8000;

/** Number of acts that make up the full 30-minute mission run. */
export const MISSION_1_TOTAL_TICKS = 40;

export type ResourceKey = "fuel" | "pressure" | "stability" | "telemetry";

export interface ResourceDefinition {
  key: ResourceKey;
  label: string;
  unit: string;
  initial: number;
  max: number;
  /** Amount consumed automatically every tick. */
  decayPerTick: number;
  /** Below this percentage of max, the UI shows a critical warning. */
  criticalThreshold: number;
}

export const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  { key: "fuel", label: "Combustible", unit: "%", initial: 100, max: 100, decayPerTick: 0.45, criticalThreshold: 15 },
  { key: "pressure", label: "Presión", unit: "%", initial: 82, max: 100, decayPerTick: 0.2, criticalThreshold: 25 },
  { key: "stability", label: "Estabilidad", unit: "%", initial: 72, max: 100, decayPerTick: 0.12, criticalThreshold: 25 },
  { key: "telemetry", label: "Telemetría", unit: "%", initial: 68, max: 100, decayPerTick: 0.08, criticalThreshold: 20 },
];

export interface DecisionOption {
  id: string;
  label: string;
  /** Positive values add to the resource, negative values consume it. */
  effects: Partial<Record<ResourceKey, number>>;
  /** Optional sample granted for choosing this option. */
  grantsSample?: { sampleKey: string; label: string; type: string; quality: number };
  resultText: string;
}

export interface DecisionEvent {
  id: string;
  atTick: number;
  title: string;
  description: string;
  options: DecisionOption[];
}

/**
 * Scripted decision points for Mission 1. Each fires once, at the given
 * simulation tick, pausing the loop until the player picks an option.
 */
export const MISSION_1_DECISIONS: DecisionEvent[] = [
  {
    id: "engine-selection",
    atTick: 3,
    title: "Banco de diseño: cámara de combustión",
    description:
      "El director pide cerrar el diseño antes de cargar los tanques. Un inyector conservador ofrece una combustión más dócil; uno de alto flujo puede elevar el vuelo, pero exige más al sistema de presión.",
    options: [
      {
        id: "conservative-injector",
        label: "Inyector conservador (+14 estabilidad, -8 telemetría)",
        effects: { stability: 14, telemetry: -8 },
        resultText: "Priorizas una mezcla uniforme. El cohete tendrá menos empuje, pero una mejor oportunidad de mantenerse entero.",
      },
      {
        id: "high-flow-injector",
        label: "Inyector de alto flujo (+12 telemetría, -10 presión)",
        effects: { telemetry: 12, pressure: -10 },
        resultText: "Apuestas por un flujo agresivo. Si la presión aguanta, los instrumentos tendrán un vuelo más útil que registrar.",
      },
    ],
  },
  {
    id: "pressure-test",
    atTick: 10,
    title: "Prueba de presión: oscilación detectada",
    description:
      "El manómetro sube y baja con cada pulso de nitrógeno. Puedes purgar y volver a comprobar las líneas, o conservar el gas y aceptar una lectura menos limpia.",
    options: [
      {
        id: "purge-lines",
        label: "Purgar líneas (-9 combustible, +16 presión)",
        effects: { fuel: -9, pressure: 16 },
        grantsSample: { sampleKey: "pressure-trace-1926", label: "Registro de presión de prueba", type: "telemetry", quality: 0.84 },
        resultText: "La purga libera una burbuja atrapada. Pierdes propelente, pero el trazo de presión se vuelve legible.",
      },
      {
        id: "accept-oscillation",
        label: "Mantener la carga (-12 estabilidad, +6 combustible)",
        effects: { stability: -12, fuel: 6 },
        resultText: "Conservas la carga; la oscilación queda anotada como un riesgo para el encendido.",
      },
    ],
  },
  {
    id: "launch-window",
    atTick: 19,
    title: "Condiciones de lanzamiento",
    description:
      "Auburn, Massachusetts. Amanecer del 16 de marzo de 1926. El anemómetro marca una brisa irregular; el equipo solo tiene una oportunidad razonable de probar el principio.",
    options: [
      {
        id: "launch-now",
        label: "Lanzar en esta ventana (+8 combustible, -10 estabilidad)",
        effects: { fuel: 8, stability: -10 },
        resultText: "Das el visto bueno. Los técnicos se apartan de la plataforma mientras el motor recibe su carga.",
      },
      {
        id: "delay-and-recheck",
        label: "Retrasar y recalibrar (-14 combustible, +12 estabilidad)",
        effects: { fuel: -14, stability: 12 },
        resultText: "Esperas a que la brisa ceda y recalibras las aletas. El margen de combustible se reduce.",
      },
    ],
  },
  {
    id: "telemetry-fluctuation",
    atTick: 29,
    title: "ADVERTENCIA: telemetría intermitente",
    description:
      "En la cuenta regresiva, el registrador de señales cae y vuelve. El vuelo puede demostrar el motor aunque la evidencia sea incompleta; abortar protegería el vehículo para otra prueba.",
    options: [
      {
        id: "continue-with-observer",
        label: "Continuar y asignar observador (-8 telemetría, +10 estabilidad)",
        effects: { telemetry: -8, stability: 10 },
        grantsSample: { sampleKey: "flight-observation-1926", label: "Observación del vuelo de prueba", type: "flight-record", quality: 0.72 },
        resultText: "Un técnico sigue el vehículo a simple vista. Incluso con señal incompleta, habrá un registro del intento.",
      },
      {
        id: "abort-and-safe",
        label: "Abortar y asegurar el vehículo (+18 telemetría, -8 combustible)",
        effects: { telemetry: 18, fuel: -8 },
        resultText: "Cortas la secuencia antes de encender. El equipo conserva datos para una revisión, pero renuncia al vuelo de hoy.",
      },
    ],
  },
];

/** One-time operational callouts, persisted in the mission log for resumed runs. */
export const MISSION_1_TIMELINE_EVENTS = [
  { atTick: 1, text: "06:10 — El director recuerda al equipo: el objetivo es demostrar el principio, no alcanzar el espacio." },
  { atTick: 7, text: "PRUEBA 02 — Los técnicos revisan la alimentación de gasolina y oxígeno líquido." },
  { atTick: 15, text: "PRUEBA 04 — Las aletas y la estructura quedan aseguradas para una prueba de vuelo breve." },
  { atTick: 22, text: "PLATAFORMA — Viento, temperatura, presión y visibilidad registrados en la libreta de lanzamiento." },
  { atTick: 27, text: "T-10 — La plataforma queda despejada. El registrador mecánico comienza a marcar el tiempo." },
  { atTick: 31, text: "IGNICIÓN — La cámara recibe propelentes; todos los ojos siguen el vehículo y el registrador." },
  { atTick: 36, text: "RECUPERACIÓN — El equipo reúne las observaciones y las trazas disponibles para el informe." },
] as const;

/**
 * Narrative phases for the Mission 1 third-person exploration layer. Each
 * phase covers a tick range and drives the phase-stepper HUD in
 * `Mission1Screen`; purely presentational, does not affect simulation math.
 */
export interface MissionPhase {
  id: string;
  title: string;
  objective: string;
  description: string;
  fromTick: number;
  toTick: number;
}

export const MISSION_1_PHASES: MissionPhase[] = [
  {
    id: "arrival",
    title: "Arrival",
    objective: "Find the project area.",
    description:
      "You are a fictional assistant on a rural test field. The equipment shelter is open-sided; every mission activity happens outdoors.",
    fromTick: 0,
    toTick: 3,
  },
  {
    id: "exploration",
    title: "Open-air exploration",
    objective: "Meet the team and inspect the outdoor stations.",
    description:
      "Plans, instruments, and the prototype live at outdoor tables, benches, and an open launch platform.",
    fromTick: 4,
    toTick: 10,
  },
  {
    id: "engineering",
    title: "Engineering",
    objective: "Configure structure, propulsion margin, stability, and instrumentation.",
    description:
      "These are abstract game trade-offs, not construction instructions. The prototype should change when you lock a design.",
    fromTick: 11,
    toTick: 16,
  },
  {
    id: "testing",
    title: "Testing",
    objective: "Run the outdoor systems tests and find the instability.",
    description:
      "A warning appears after the first checks. Diagnose it by walking around the prototype, then choose to retest or accept the configuration.",
    fromTick: 17,
    toTick: 24,
  },
  {
    id: "launch-day",
    title: "Launch preparation",
    objective: "Walk to the launch field, complete the checklist, then observe.",
    description:
      "March 16, 1926. Historical context: about 41 ft / 12.5 m high and 184 ft / 56 m away. Your team and result are fiction.",
    fromTick: 25,
    toTick: 32,
  },
  {
    id: "resolution",
    title: "Flight analysis",
    objective: "Review the record outside and close the experiment.",
    description:
      "The importance of the 1926 flight was not distance. It showed that liquid-fuel propulsion could produce flight.",
    fromTick: 33,
    toTick: MISSION_1_TOTAL_TICKS,
  },
];

/**
 * Fixed points of interest scattered around the player spawn in the
 * Mission 1 third-person scene. Ids matching a `DecisionEvent.id` link the
 * physical location to that scripted decision so the interaction prompt can
 * surface contextual flavor text (see `GameplayLayer`).
 */
export interface MissionPointOfInterest {
  id: string;
  label: string;
  flavorText: string;
  linkedDecisionId?: string;
  prompt?: string;
  /** Fixed outdoor coordinates used by both the world marker and mission map. */
  position: { x: number; z: number };
}

export const MISSION_1_POIS: MissionPointOfInterest[] = [
  ...Object.entries(FIELD_STATION_LOCATIONS).filter(([id]) => id !== "recovery").map(([id, position]) => ({
    id: `field-${id}`, label: `field-task:${id}`, prompt: `field-task:${id}`,
    flavorText: "Abstract outdoor field experiment.", position,
  })),
  ...FIELD_ROUTE_POINTS.map(point => ({
    id: point.id, label: `route-point:${point.id.slice(-1)}`, prompt: "route-inspect",
    flavorText: "A route marker to inspect in the field.", position: { x: point.x, z: point.z },
  })),
  {
    id: "storage-exterior",
    label: "Field equipment shelter",
    flavorText: "A simple open shelter keeps the field crate and tools dry. All work happens at outdoor stations.",
    prompt: "E · CHECK FIELD EQUIPMENT",
    position: { x: 14.2, z: -2.8 },
  },
  {
    id: "director-greeting",
    label: "Project director",
    flavorText: "Engineer Andres L waits beside the outdoor work area.",
    prompt: "E · SPEAK WITH DIRECTOR",
    position: { x: -5.2, z: 2.2 },
  },
  {
    id: "project-area",
    label: "Project area",
    flavorText: "Plans and a field notebook are laid out on an outdoor project table.",
    prompt: "E · EXAMINE PLANS",
    // Put the route marker on the clear side of the table so pathfinding does
    // not stop beside the director and make the wrong interaction win.
    position: { x: -8, z: -2.35 },
  },
  {
    id: "meet-propulsion",
    label: "Propulsion engineer",
    flavorText: "The propulsion engineer works at a technical table in the open air.",
    prompt: "E · TALK TO PROPULSION ENGINEER",
    position: { x: 16.8, z: 9.4 },
  },
  {
    id: "meet-structural",
    label: "Structural engineer",
    flavorText: "Ingeniera Bombilla stands beside the prototype frame.",
    prompt: "E · TALK TO STRUCTURAL ENGINEER",
    position: { x: 5.1, z: -12.2 },
  },
  {
    id: "meet-data",
    label: "Data technician",
    flavorText: "The data technician is preparing the outdoor recorders.",
    prompt: "E · TALK TO DATA TECHNICIAN",
    position: { x: 6.6, z: -21.2 },
  },
  {
    id: "inspect-prototype",
    label: "Experimental vehicle",
    flavorText: "A small liquid-fuel prototype waits on an open stand. Status: untested until you record it.",
    prompt: "E · INSPECT PROTOTYPE",
    position: { x: 4.4, z: -14 },
  },
  {
    id: "inspect-instruments",
    label: "Instrumentation table",
    flavorText: "Data collection is limited. The recorder can only keep a few seconds of useful trace.",
    prompt: "E · INSPECT INSTRUMENTS",
    position: { x: -3.4, z: 9.2 },
  },
  {
    id: "record-notes",
    label: "Field notebook",
    flavorText: "A stained notebook lists morning temperatures and wind. Historical context, not a construction recipe.",
    prompt: "E · READ NOTES",
    position: { x: -10.2, z: 6.4 },
  },
  {
    id: "record-sketch",
    label: "Prototype sketch",
    flavorText: "A charcoal sketch of the frame, with fictional annotations from this team.",
    prompt: "E · EXAMINE SKETCH",
    position: { x: 16.2, z: 6.1 },
  },
  {
    id: "record-photo",
    label: "Field photograph",
    flavorText: "A photograph of the launch frame, observation crew, and rural horizon.",
    prompt: "E · EXAMINE PHOTOGRAPH",
    position: { x: 10.4, z: -21.5 },
  },
  {
    id: "record-log",
    label: "Instrument log",
    flavorText: "A mechanical log sheet waits beside the test posts.",
    prompt: "E · COLLECT LOG",
    position: { x: -7.8, z: 11.4 },
  },
  {
    id: "engine-selection",
    label: "Experimental workbench",
    flavorText: "An outdoor engineering station: plans, tools, instruments, and abstract components.",
    prompt: "E · CONFIGURE VEHICLE",
    linkedDecisionId: "engine-selection",
    position: { x: 18.5, z: 8 },
  },
  {
    id: "pressure-test",
    label: "Test area",
    flavorText: "Open-air posts, barriers, and a mechanical recorder. No interior test cell exists.",
    prompt: "E · RUN SYSTEM TEST",
    linkedDecisionId: "pressure-test",
    position: { x: -6, z: 9 },
  },
  {
    id: "launch-window",
    label: "Launch field",
    flavorText: "Mud, grass, crates, and a short path from the test area. A cross breeze can spoil a brief hop.",
    prompt: "E · PREPARE LAUNCH",
    linkedDecisionId: "launch-window",
    position: { x: 0, z: -24 },
  },
  {
    id: "telemetry-fluctuation",
    label: "Observation area",
    flavorText: "From here the crew will watch the vehicle and the recorder.",
    prompt: "E · TAKE POSITION",
    linkedDecisionId: "telemetry-fluctuation",
    position: { x: 8, z: -23 },
  },
  {
    id: "analysis-station",
    label: "Analysis station",
    flavorText: "A covered outdoor table for the flight record. The office behind it stays closed.",
    prompt: "E · REVIEW FLIGHT DATA",
    position: { x: 11.2, z: -25.4 },
  },
];

export const THEME = {
  colors: {
    background: "#04060f",
    panel: "rgba(10, 16, 32, 0.86)",
    accent: "#ff7a45",
    accentSoft: "#ffb199",
    text: "#eef2ff",
    textMuted: "#9aa5c9",
    success: "#4ade80",
    warning: "#facc15",
    danger: "#f87171",
    locked: "#3a3f55",
  },
} as const;
