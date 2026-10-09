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
    id: "the-call",
    title: "Acto I: El llamado",
    objective: "Recorre el banco de pruebas antes del amanecer e identifica los sistemas experimentales.",
    description:
      "No eres Robert Goddard: eres un ingeniero ficticio en un equipo pequeño. La meta no es el espacio; es demostrar que un motor de combustible líquido puede volar.",
    fromTick: 0,
    toTick: 3,
  },
  {
    id: "engineering",
    title: "Actos II–III: Preparación e ingeniería",
    objective: "Cierra la configuración del motor, tanques, estructura e instrumentación.",
    description:
      "Cada kilogramo y cada línea de combustible importan. Las métricas muestran consecuencias físicas: combustible, presión de alimentación, estabilidad y telemetría.",
    fromTick: 4,
    toTick: 10,
  },
  {
    id: "testing",
    title: "Acto IV: Pruebas",
    objective: "Inspecciona las líneas de combustible, la cámara y el registrador antes de armar la plataforma.",
    description:
      "La prueba de presión revela por qué la cohetería temprana era una disciplina de mediciones, no de certezas.",
    fromTick: 11,
    toTick: 18,
  },
  {
    id: "launch-day",
    title: "Actos V–VI: Día de lanzamiento",
    objective: "Evalúa el viento, fija la ventana y acompaña al equipo a la plataforma.",
    description:
      "El 16 de marzo de 1926, en Auburn, Massachusetts, una prueba histórica empleó gasolina y oxígeno líquido. Esta misión recrea su contexto; tu equipo y decisiones son ficción.",
    fromTick: 19,
    toTick: 28,
  },
  {
    id: "resolution",
    title: "Actos VII–IX: Decisión e informe",
    objective: "Resuelve la anomalía, ejecuta la cuenta regresiva y conserva la evidencia del vuelo.",
    description:
      "Una observación fiable también es un logro. El informe conectará este pequeño experimento con los vehículos que vendrían después.",
    fromTick: 29,
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
  /** Fixed outdoor coordinates used by both the world marker and mission map. */
  position: { x: number; z: number };
}

export const MISSION_1_POIS: MissionPointOfInterest[] = [
  {
    id: "main-building-exterior",
    label: "Edificio principal — exterior",
    flavorText: "La puerta del edificio principal permanece cerrada. Las instalaciones jugables están todas en el campo exterior.",
    position: { x: -11, z: -2.5 },
  },
  {
    id: "storage-exterior",
    label: "Almacén — exterior",
    flavorText: "El almacén sirve como referencia visual; la puerta está cerrada y el equipo se recoge en las mesas exteriores.",
    position: { x: 11, z: -2.5 },
  },
  {
    id: "workshop-exterior",
    label: "Taller — exterior",
    flavorText: "El taller es solo una referencia de navegación. No hay interiores accesibles.",
    position: { x: 4.5, z: 9 },
  },
  {
    id: "project-area",
    label: "Mesa de proyecto exterior",
    flavorText: "Los planos y la libreta están dispuestos sobre una mesa exterior. El edificio queda cerrado; aquí se reúne el equipo.",
    position: { x: -8, z: -1 },
  },
  {
    id: "engine-selection",
    label: "Banco de ingeniería",
    flavorText: "Una mesa de trabajo al aire libre sostiene los esquemas del prototipo. Las opciones son abstracciones de juego, no instrucciones de fabricación.",
    position: { x: 18.5, z: 8 },
  },
  {
    id: "pressure-test",
    label: "Zona de pruebas",
    flavorText: "Las agujas mecánicas delatan cada pulso del sistema de alimentación.",
    position: { x: -6, z: 9 },
  },
  {
    id: "launch-window",
    label: "Campo de lanzamiento",
    flavorText: "Una brisa cruzada puede convertir una prueba corta en una recuperación peligrosa.",
    position: { x: 0, z: -24 },
  },
  {
    id: "telemetry-fluctuation",
    label: "Área de observación",
    flavorText: "El pequeño registrador debe convertir unos segundos de vuelo en evidencia útil. Desde aquí el equipo seguirá el vehículo.",
    position: { x: 8, z: -23 },
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
