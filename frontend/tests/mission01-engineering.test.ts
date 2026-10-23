// Run with: tsx --test tests/mission01-engineering.test.ts  (tsx is not a project dependency; install it globally or via npx)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ENGINEERING,
  calculateEngineering,
  type EngineeringProfile,
} from "../src/state/Mission01Engineering";
import { resolveFlight, flightPeakAltitude, LAUNCH_DELAY_BUDGET_COST } from "../src/state/Mission01Launch";

function profile(overrides: Partial<EngineeringProfile> = {}): EngineeringProfile {
  return { ...DEFAULT_ENGINEERING, ...overrides };
}

test("default configuration uses basic instrumentation and stability priority", () => {
  assert.equal(DEFAULT_ENGINEERING.instrumentation, "basic");
  assert.equal(DEFAULT_ENGINEERING.priority, "stability");
});

test("instrumentation levels increase data and cost monotonically", () => {
  const basic = calculateEngineering(profile({ instrumentation: "basic", priority: "cost" }));
  const balanced = calculateEngineering(profile({ instrumentation: "balanced", priority: "cost" }));
  const advanced = calculateEngineering(profile({ instrumentation: "advanced", priority: "cost" }));
  assert.ok(basic.data < balanced.data && balanced.data < advanced.data, "data grows with instrumentation");
  assert.ok(basic.cost < balanced.cost && balanced.cost < advanced.cost, "cost grows with instrumentation");
});

test("cost priority is the cheapest build and stability priority the steadiest", () => {
  const cost = calculateEngineering(profile({ priority: "cost" }));
  const stability = calculateEngineering(profile({ priority: "stability" }));
  assert.ok(cost.cost < stability.cost, "cost priority spends less");
  assert.ok(stability.stability > cost.stability, "stability priority is steadier");
});

test("data priority records more data than stability priority", () => {
  const data = calculateEngineering(profile({ priority: "data" }));
  const stability = calculateEngineering(profile({ priority: "stability" }));
  assert.ok(data.data > stability.data);
});

test("all derived percentages stay within 0..100", () => {
  for (const structure of ["light", "balanced", "reinforced"] as const) {
    for (const instrumentation of ["basic", "balanced", "advanced"] as const) {
      for (const priority of ["cost", "stability", "data"] as const) {
        const m = calculateEngineering(profile({ structure, instrumentation, priority }));
        for (const value of [m.stability, m.reliability, m.data]) {
          assert.ok(value >= 0 && value <= 100, `${structure}/${instrumentation}/${priority} => ${value}`);
        }
        assert.ok(m.cost >= 0, "cost never negative");
      }
    }
  }
});

test("basic instrumentation is reported as incomplete data regardless of design", () => {
  const result = resolveFlight(profile({ instrumentation: "basic", structure: "reinforced", launchDecision: "proceed" }), 100);
  assert.equal(result, "incomplete-data");
});

test("a delayed launch never resolves to a flight", () => {
  assert.equal(resolveFlight(profile({ launchDecision: "delay" }), 100), "delayed");
});

test("peak altitude follows the historical scale for a stable flight", () => {
  assert.equal(flightPeakAltitude("stable-flight"), 12.5);
});

test("the delay cost is a positive budget charge", () => {
  assert.ok(LAUNCH_DELAY_BUDGET_COST > 0);
});
