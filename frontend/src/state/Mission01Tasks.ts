/** Fictional training signals, deliberately unrelated to real propulsion procedures. */
export type EngineeringTaskKind = "circuits" | "antenna" | "propulsion" | "diagnosis" | "launch";
export const CIRCUIT_DESTINATIONS = [2, 0, 3, 1] as const;
export const SIGNAL_TARGET = { orientation: 42, frequency: 64, tolerance: 4 } as const;
export const LAUNCH_RELAYS = [1, 3, 0, 2] as const;

export function circuitMatches(source: number, destination: number): boolean {
  return Number.isInteger(source) && source >= 0 && source < CIRCUIT_DESTINATIONS.length
    && CIRCUIT_DESTINATIONS[source] === destination;
}

export function signalStrength(orientation: number, frequency: number): number {
  if (!Number.isFinite(orientation) || !Number.isFinite(frequency)) return 0;
  return Math.max(0, Math.round(100 - Math.hypot(orientation - SIGNAL_TARGET.orientation, frequency - SIGNAL_TARGET.frequency) * 1.8));
}

export function isSignalAligned(orientation: number, frequency: number): boolean {
  return Number.isFinite(orientation) && Number.isFinite(frequency)
    && Math.abs(orientation - SIGNAL_TARGET.orientation) <= SIGNAL_TARGET.tolerance
    && Math.abs(frequency - SIGNAL_TARGET.frequency) <= SIGNAL_TARGET.tolerance;
}

export function isPropulsionBalanced(pressure: number, temperature: number): boolean {
  return Number.isFinite(pressure) && Number.isFinite(temperature)
    && pressure >= 56 && pressure <= 64 && temperature >= 36 && temperature <= 44;
}

export function relayMatches(step: number, relay: number): boolean {
  return Number.isInteger(step) && step >= 0 && step < LAUNCH_RELAYS.length && LAUNCH_RELAYS[step] === relay;
}
