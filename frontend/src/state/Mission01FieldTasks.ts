/** Abstract, recoverable field experiments; no real construction quantities. */
export const FIELD_TASK_IDS = ["assembly", "mass", "calibration", "route", "weather", "signal", "recovery"] as const;
export type FieldTaskId = typeof FIELD_TASK_IDS[number];
export type FieldTaskDraft = Record<string, string | number | boolean | number[] | string[] | null>;
export interface FieldTaskEffects {
  stability: number;
  mass: number;
  dataQuality: number;
  launchReadiness: number;
  structureScore: number;
  budget: number;
  time: number;
}
export interface MissionMiniGameResult {
  id: FieldTaskId;
  completed: boolean;
  inherited?: boolean;
  score: number;
  attempts: number;
  mistakes: number;
  effects: Partial<FieldTaskEffects>;
}

export function isFieldTaskId(value: unknown): value is FieldTaskId {
  return typeof value === "string" && (FIELD_TASK_IDS as readonly string[]).includes(value);
}

export function fieldTaskResult(id: FieldTaskId, attempts = 1, mistakes = 0): MissionMiniGameResult {
  attempts = Math.max(1, Math.min(999, Math.floor(Number.isFinite(attempts) ? attempts : 1)));
  mistakes = Math.max(0, Math.min(999, Math.floor(Number.isFinite(mistakes) ? mistakes : 0)));
  const score = Math.max(40, 100 - mistakes * 8 - (attempts - 1) * 2);
  const effects: Record<FieldTaskId, Partial<FieldTaskEffects>> = {
    assembly: { stability: score >= 80 ? 5 : 2, mass: 1, structureScore: score },
    mass: { stability: score >= 80 ? 4 : 2, mass: -2 },
    calibration: { dataQuality: score >= 80 ? 6 : 3 },
    route: { launchReadiness: 60 },
    weather: { launchReadiness: 40, stability: mistakes === 0 ? 2 : 1 },
    signal: { dataQuality: score >= 80 ? 5 : 2 },
    recovery: { dataQuality: score >= 80 ? 7 : 3 },
  };
  return { id, completed: true, score, attempts, mistakes,
    effects: { ...effects[id], time: Math.min(3, mistakes), budget: -Math.min(3, mistakes) } };
}

/** Restore only bounded scalar/flat-array data from opaque API snapshots. */
export function restoreFieldDraft(value: unknown): FieldTaskDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: FieldTaskDraft = {};
  for (const [key, entry] of Object.entries(value).slice(0, 32)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (entry === null || typeof entry === "boolean") result[key] = entry;
    else if (typeof entry === "string") result[key] = entry.slice(0, 120);
    else if (typeof entry === "number" && Number.isFinite(entry)) result[key] = Math.max(-10000, Math.min(10000, entry));
    else if (Array.isArray(entry) && entry.length <= 24) {
      if (entry.every(item => typeof item === "number" && Number.isFinite(item))) result[key] = entry.map(item => Math.max(-10000, Math.min(10000, item)));
      else if (entry.every(item => typeof item === "string")) result[key] = entry.map(item => item.slice(0, 120));
    }
  }
  return result;
}
