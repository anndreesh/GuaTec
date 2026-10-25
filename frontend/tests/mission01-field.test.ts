import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mission1State } from '../src/state/Mission1State';
import { fieldTaskResult, restoreFieldDraft } from '../src/state/Mission01FieldTasks';
import { calculateEngineering } from '../src/state/Mission01Engineering';

function prototypeReady() {
  const state = new Mission1State();
  state.completeObjective('lab'); state.completeObjective('discover');
  for (const id of ['meet-propulsion', 'meet-structural', 'meet-data']) state.meetNpc(id);
  state.completeObjective('meet-team'); state.completeObjective('prototype');
  return state;
}

test('field tasks reject early completion and duplicate effects are never applied', () => {
  const state = new Mission1State();
  assert.equal(state.completeFieldTask(fieldTaskResult('assembly')), false);
  const ready = prototypeReady();
  const result = fieldTaskResult('assembly', 2, 1);
  assert.equal(ready.completeFieldTask(result), true);
  const snapshot = structuredClone(ready.toSaveState());
  assert.equal(ready.completeFieldTask(result), true);
  assert.deepEqual(ready.toSaveState(), snapshot);
});

test('results derive bounded effects and ignore injected effects', () => {
  const state = prototypeReady();
  const result = fieldTaskResult('assembly', 1, 0);
  result.effects = { stability: 10000, budget: 10000 };
  state.completeFieldTask(result);
  assert.equal(state.fieldResults.get('assembly')!.effects.stability, 5);
  assert.equal(state.engineering.budget, 80);
  assert.equal(fieldTaskResult('mass', Infinity, NaN).score, 100);
});

test('field drafts survive save/reload and never award completion', () => {
  const state = prototypeReady();
  state.setFieldDraft('assembly', { placements: [0, -1, 2], attempts: 2, mistakes: 1 });
  const restored = new Mission1State(structuredClone(state.toSaveState()));
  assert.deepEqual(restored.fieldDrafts.assembly, state.fieldDrafts.assembly);
  assert.equal(restored.fieldResults.has('assembly'), false);
  assert.deepEqual(restoreFieldDraft({ unsafe: { nested: true }, value: NaN, values: [1, Infinity] }), {});
});

test('saved effects restore once without healing depleted mission resources', () => {
  const state = prototypeReady();
  state.completeFieldTask(fieldTaskResult('assembly', 2, 2));
  state.resources.telemetry = 21;
  const originalMetrics = calculateEngineering(state.engineering);
  const restored = new Mission1State(structuredClone(state.toSaveState()));
  assert.deepEqual(calculateEngineering(restored.engineering), originalMetrics);
  assert.equal(restored.resources.telemetry, 21);
  assert.deepEqual(restored.fieldResults.get('assembly'), state.fieldResults.get('assembly'));
});

test('legacy completed design keeps its checkpoint without retroactive bonuses across reloads', () => {
  const state = prototypeReady(); state.completeObjective('design');
  const save = structuredClone(state.toSaveState());
  delete save.mission01!.fieldVersion;
  delete save.mission01!.fieldResults;
  const restored = new Mission1State(save);
  assert.equal(restored.objectives.has('design'), true);
  assert.equal(restored.fieldResults.get('assembly')!.inherited, true);
  const again = new Mission1State(structuredClone(restored.toSaveState()));
  assert.deepEqual(again.fieldResults.get('assembly')!.effects, {});
  assert.equal(calculateEngineering(again.engineering).stability, calculateEngineering(state.engineering).stability);
});

test('route requires three unique physical inspections and the diagnosis checkpoint', () => {
  const state = prototypeReady();
  assert.equal(state.inspectRoute('route-check-1'), false);
  state.objectives.add('diagnose');
  state.inspectRoute('route-check-1'); state.inspectRoute('route-check-1');
  assert.equal(state.completeFieldTask(fieldTaskResult('route')), false);
  state.inspectRoute('route-check-2'); state.inspectRoute('route-check-3');
  assert.equal(state.inspectRoute('route-check-4'), false);
  assert.equal(state.completeFieldTask(fieldTaskResult('route')), true);
  assert.equal(state.launchReadiness, 60);
  state.completeFieldTask(fieldTaskResult('weather'));
  assert.equal(state.launchReadiness, 100);
});
