import { test } from "node:test";
import assert from "node:assert/strict";
import { CIRCUIT_DESTINATIONS, circuitMatches, isSignalAligned, signalStrength, isPropulsionBalanced, LAUNCH_RELAYS, relayMatches } from "../src/state/Mission01Tasks.ts";

test("continuity rejects every wrong terminal and invalid source", () => {
  for (let source = 0; source < 4; source++) {
    for (let destination = 0; destination < 4; destination++) {
      assert.equal(circuitMatches(source, destination), destination === CIRCUIT_DESTINATIONS[source]);
    }
  }
  for (const source of [-1, 4, 0.5, NaN]) assert.equal(circuitMatches(source, 0), false);
});
test("signal requires both axes inside tolerance; partial alignment never validates", () => {
  assert.equal(isSignalAligned(42, 64), true);
  assert.equal(isSignalAligned(38, 68), true);
  assert.equal(isSignalAligned(37, 64), false);
  assert.equal(isSignalAligned(42, 69), false);
  assert.equal(isSignalAligned(NaN, 64), false);
  assert.equal(signalStrength(42, 64), 100);
  assert.equal(signalStrength(0, 100), 0);
  assert.equal(signalStrength(Infinity, 64), 0);
});
test("fictional propulsion test requires simultaneous valid bands", () => {
  assert.equal(isPropulsionBalanced(60, 40), true);
  assert.equal(isPropulsionBalanced(56, 44), true);
  assert.equal(isPropulsionBalanced(55, 40), false);
  assert.equal(isPropulsionBalanced(60, 45), false);
  assert.equal(isPropulsionBalanced(NaN, 40), false);
});
test("launch relays reject wrong order and nonexistent steps", () => {
  for (let step = 0; step < 4; step++) {
    for (let relay = 0; relay < 4; relay++) {
      assert.equal(relayMatches(step, relay), relay === LAUNCH_RELAYS[step]);
    }
  }
  for (const step of [-1, 4, 0.5, NaN]) assert.equal(relayMatches(step, 0), false);
});
