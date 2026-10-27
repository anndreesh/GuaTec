/** Simulated bench tasks. Values are game references, never launch clearances or
 * measurements of historical hardware. All validation also lives outside the DOM. */
export const FUSE_RATINGS = [5, 10, 15, 20] as const;
export const FUSE_SOCKETS = [10, 20, 5, 15] as const;
export const TELEMETRY_REFERENCE = [62, 74, 58] as const;
export const CABLE_CHANNELS = ['A', 'B', 'C', 'D'] as const;
export const CABLE_TARGET_ORDER = ['C', 'A', 'D', 'B'] as const;
export const FLIGHT_CARDS = [
  { id: 'clearance', time: '01', title: 'Verificación de apoyo', detail: 'Revisar los registros y confirmar el enlace terrestre.' },
  { id: 'crew', time: '02', title: 'Tripulación a bordo', detail: 'Armstrong, Collins y Aldrin ocupan el módulo de mando.' },
  { id: 'ignition', time: '03', title: 'Encendido de motores', detail: 'El encendido precede al despegue del Saturn V.' },
  { id: 'liftoff', time: '04', title: 'Despegue', detail: '09:32 EDT · el Apollo 11 deja la plataforma 39A.' },
] as const;
export const CREW_CARDS = [
  { id: 'armstrong', name: 'Neil Armstrong', role: 'Comandante', initials: 'NA' },
  { id: 'collins', name: 'Michael Collins', role: 'Piloto del módulo de mando', initials: 'MC' },
  { id: 'aldrin', name: 'Buzz Aldrin', role: 'Piloto del módulo lunar', initials: 'BA' },
] as const;

export type StandDraft = { version: 1; kind: string; slots?: (number | null)[]; controls?: number[]; scanned?: boolean[] };
export function restoreStandDraft(kind: string, value: unknown): StandDraft {
  const clean: StandDraft = { version: 1, kind };
  if (!value || typeof value !== 'object') return clean;
  const saved = value as Partial<StandDraft>;
  if (saved.version !== 1 || saved.kind !== kind) return clean;
  const count = kind === 'crew-manifest' ? 3 : 4;
  if (['sequence', 'flight-plan', 'crew-manifest', 'cables'].includes(kind) && Array.isArray(saved.slots) && saved.slots.length === count) {
    const seen = new Set<number>();
    clean.slots = saved.slots.map(item => {
      if (item === null || !Number.isInteger(item) || item! < 0 || item! >= count || seen.has(item!)) return null;
      seen.add(item!); return item!;
    });
  }
  const ranges = kind === 'telemetry' ? [100,100,100] : kind === 'weather' ? [359,100] : [];
  if (ranges.length && Array.isArray(saved.controls) && saved.controls.length === ranges.length && saved.controls.every(Number.isFinite)) clean.controls = saved.controls.map((v,i) => Math.max(0,Math.min(ranges[i]!,v)));
  if (kind === 'beacons' && Array.isArray(saved.scanned) && saved.scanned.length === 3 && saved.scanned.every(v => typeof v === 'boolean')) {
    clean.scanned = [...saved.scanned];
    // A recovered draft is never an automatic completion event. Reacquire the final
    // beacon if the player left during the confirmation delay.
    if (clean.scanned.every(Boolean)) clean.scanned[2] = false;
  }
  return clean;
}

export function slotsCorrect<T>(slots: readonly (T | null)[], reference: readonly T[]): boolean {
  return slots.length === reference.length && slots.every((item, index) => item !== null && item === reference[index]);
}
export function moveIntoSlot(slots: readonly (number | null)[], item: number, slot: number): (number | null)[] {
  if (!Number.isInteger(item) || !Number.isInteger(slot) || item < 0 || item >= slots.length || slot < 0 || slot >= slots.length) return [...slots];
  const next = [...slots], old = next.indexOf(item), displaced = next[slot];
  if (old >= 0) next[old] = displaced;
  next[slot] = item;
  return next;
}
export function readingsAligned(values: readonly number[]): boolean {
  return values.length === TELEMETRY_REFERENCE.length && values.every((v, i) => Number.isFinite(v) && Math.abs(v - TELEMETRY_REFERENCE[i]!) <= 3);
}
export function headingError(value: number, reference: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(reference)) return 180;
  return Math.abs(((value - reference + 540) % 360 + 360) % 360 - 180);
}
export function weatherAligned(heading: number, cloud: number): boolean {
  return headingError(heading, 225) <= 9 && Number.isFinite(cloud) && Math.abs(cloud - 35) <= 5;
}
export function advanceScan(progress: number, dt: number, aligned: boolean): number {
  return Math.max(0, Math.min(1, progress + Math.max(0, Math.min(.05, dt)) * (aligned ? .85 : -.65)));
}
