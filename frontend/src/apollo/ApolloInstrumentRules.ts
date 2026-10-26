/** Educational instrument rules; none operate a real launch system. */
export type InstrumentKind = 'survey' | 'records' | 'signal' | 'tracking';
export type InstrumentLanguage = 'es' | 'en' | 'fr';
export type InstrumentDraft = {
  version: 1;
  kind: InstrumentKind;
  values: number[];
  captures: string[];
  slots: Array<string | null>;
  pulses: number[];
};
export const SURVEY_TARGETS = [
  { id: 'tower', azimuth: 26, zoom: 62, focus: 83 },
  { id: 'pad', azimuth: 52, zoom: 72, focus: 79 },
  { id: 'vab', azimuth: 82, zoom: 48, focus: 86 },
] as const;
export const RECORDS = ['AS-506', 'LC-39A', '09:32 EDT'] as const;
export const PULSE_PATTERN = [0.28, 0.82, 0.28] as const;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const clampInstrument = (value: number) => Math.min(100, Math.max(0, finite(value) ? value : 0));
export function newInstrumentDraft(kind: InstrumentKind): InstrumentDraft {
  return { version: 1, kind, values: kind === 'survey' ? [10, 30, 30] : kind === 'signal' ? [25, 25] : [30, 30, 30], captures: [], slots: [null, null, null], pulses: [] };
}
/** Saved drafts never restore a lock timer or a callback/completed flag. */
export function restoreInstrumentDraft(kind: InstrumentKind, saved: unknown): InstrumentDraft {
  const fresh = newInstrumentDraft(kind);
  if (!saved || typeof saved !== 'object') return fresh;
  const value = saved as Partial<InstrumentDraft>;
  if (value.version !== 1 || value.kind !== kind) return fresh;
  if (Array.isArray(value.values) && value.values.length === fresh.values.length && value.values.every(finite)) fresh.values = value.values.map(clampInstrument);
  if (kind === 'survey' && Array.isArray(value.captures)) {
    // Only a contiguous survey prefix can be resumed; the next capture still requires a fresh lock.
    for (const target of SURVEY_TARGETS) { if (value.captures.includes(target.id)) fresh.captures.push(target.id); else break; }
    if (fresh.captures.length === SURVEY_TARGETS.length) fresh.captures.pop();
  }
  if (kind === 'records' && Array.isArray(value.slots) && value.slots.length === 3) {
    const used = new Set<string>();
    fresh.slots = value.slots.map(slot => { if (typeof slot !== 'string' || !(RECORDS as readonly string[]).includes(slot) || used.has(slot)) return null; used.add(slot); return slot; });
  }
  // Radio pulse timings are deliberately not trusted across sessions: listen and key again.
  return fresh;
}
export function surveyAligned(values: readonly number[], targetIndex: number): boolean {
  const target = SURVEY_TARGETS[targetIndex];
  return !!target && values.length === 3 && values.every(finite) && Math.abs(values[0] - target.azimuth) <= 2 && Math.abs(values[1] - target.zoom) <= 4 && Math.abs(values[2] - target.focus) <= 5;
}
export function trackingAligned(values: readonly number[]): boolean {
  return values.length === 3 && values.every(finite) && Math.abs(values[0] - 61) <= 2.5 && Math.abs(values[1] - 57) <= 3 && Math.abs(values[2] - 79) <= 5;
}
export function signalAligned(values: readonly number[]): boolean {
  return values.length === 2 && values.every(finite) && Math.abs(values[0] - 67) <= 2 && Math.abs(values[1] - 73) <= 3;
}
export function advanceInstrumentLock(seconds: number, aligned: boolean, delta: number, required: number): number {
  if (!aligned || !finite(delta) || delta < 0 || !finite(seconds)) return 0;
  return Math.min(required, seconds + Math.min(delta, 0.1));
}
export function recordsCorrect(slots: readonly (string | null)[]): boolean {
  return slots.length === RECORDS.length && slots.every((value, index) => value === RECORDS[index]);
}
export function pulseCorrect(duration: number, index: number): boolean {
  return finite(duration) && index >= 0 && index < PULSE_PATTERN.length && Math.abs(duration - PULSE_PATTERN[index]) <= (index === 1 ? 0.28 : 0.2);
}
export function pulseSequenceCorrect(durations: readonly number[]): boolean {
  return durations.length === PULSE_PATTERN.length && durations.every(pulseCorrect);
}
