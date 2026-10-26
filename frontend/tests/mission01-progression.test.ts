import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mission1State } from '../src/state/Mission1State';
import { fieldTaskResult } from '../src/state/Mission01FieldTasks';

function designReady() {
  const state = new Mission1State();
  for (const id of ['lab', 'discover'] as const) assert.equal(state.completeObjective(id), true);
  for (const id of ['meet-propulsion', 'meet-structural', 'meet-data']) state.meetNpc(id);
  for (const id of ['meet-team', 'prototype'] as const) assert.equal(state.completeObjective(id), true);
  state.completeFieldTask(fieldTaskResult('assembly')); state.completeFieldTask(fieldTaskResult('mass'));
  assert.equal(state.completeObjective('design'), true);
  state.completeFieldTask(fieldTaskResult('calibration')); state.completeFieldTask(fieldTaskResult('signal'));
  return state;
}
function testingReady() {
  const state = designReady();
  for (const [task, testId] of [['propulsion', 'system'], ['circuits', 'instrumentation'], ['antenna', 'communications']] as const) {
    assert.equal(state.completeEngineeringTask(task), true);
    assert.equal(state.runTest(testId), true);
  }
  assert.equal(state.runTest('stability'), true);
  assert.equal(state.completeObjective('testing'), true);
  return state;
}

test('out of order tasks and tests cannot advance a new mission', () => {
  const state = new Mission1State();
  assert.equal(state.completeObjective('design'), false);
  assert.equal(state.runTest('system'), false);
  assert.equal(state.completeEngineeringTask('propulsion'), false);
  assert.equal(state.completeEngineeringTask('launch'), false);
  assert.equal(state.objectives.size, 0);
});
test('tests require solved task and strict ordering, including antenna', () => {
  const state = designReady();
  assert.equal(state.runTest('system'), false);
  assert.equal(state.completeEngineeringTask('circuits'), false);
  assert.equal(state.completeEngineeringTask('antenna'), false);
  state.completeEngineeringTask('propulsion'); state.runTest('system');
  state.completeEngineeringTask('circuits'); state.runTest('instrumentation');
  assert.equal(state.runTest('stability'), false);
  assert.equal(state.completeObjective('testing'), false);
  state.completeEngineeringTask('antenna'); state.runTest('communications'); state.runTest('stability');
  assert.equal(state.completeObjective('testing'), true);
});
test('diagnosis and launch require validated engineering tasks', () => {
  const state = testingReady();
  state.diagnosis = state.expectedDiagnosis();
  assert.equal(state.completeObjective('diagnose'), false);
  assert.equal(state.completeEngineeringTask('diagnosis'), true);
  assert.equal(state.completeObjective('diagnose'), true);
  for (const id of ['inspect-vehicle','check-instruments','review-conditions','confirm-observation','confirm-telemetry']) state.markChecklist(id);
  state.engineering.launchDecision = 'proceed';
  for (const n of [1,2,3]) state.inspectRoute(`route-check-${n}`);
  state.completeFieldTask(fieldTaskResult('route')); state.completeFieldTask(fieldTaskResult('weather'));
  assert.equal(state.completeObjective('prepare'), false);
  assert.equal(state.completeEngineeringTask('launch'), true);
  assert.equal(state.completeObjective('prepare'), true);
});
test('roundtrip preserves partial tests and prevents phantom future checkpoint', () => {
  const state = designReady(); state.completeEngineeringTask('propulsion'); state.runTest('system');
  const saved = structuredClone(state.toSaveState());
  saved.mission01!.objectives.push('flight');
  const resumed = new Mission1State(saved);
  assert.equal(resumed.engineeringTasks.has('propulsion'), true);
  assert.equal(resumed.testsRun.has('system'), true);
  assert.equal(resumed.objectives.has('flight'), false);
  assert.equal(resumed.checkpoint, 'Engineering');
  assert.equal(resumed.testsComplete(), false);
});
test('legacy earned testing checkpoint is preserved with migration', () => {
  const state = testingReady(); const saved = structuredClone(state.toSaveState());
  delete saved.mission01!.taskVersion; delete saved.mission01!.engineeringTasks;
  saved.mission01!.testsRun = ['system','instrumentation','stability'];
  const resumed = new Mission1State(saved);
  assert.equal(resumed.objectives.has('testing'), true);
  assert.equal(resumed.testsRun.has('communications'), true);
  assert.equal(resumed.engineeringTasks.has('antenna'), true);
});
test('current version cannot restore testing without an antenna result', () => {
  const state = testingReady(); const saved = structuredClone(state.toSaveState());
  saved.mission01!.testsRun = ['system','instrumentation','stability'];
  const resumed = new Mission1State(saved);
  assert.equal(resumed.objectives.has('testing'), false);
  assert.equal(resumed.objectives.has('diagnose'), false);
});
test('current saves require validated task records as well as test IDs', () => {
  const state = testingReady(); const saved = structuredClone(state.toSaveState());
  saved.mission01!.engineeringTasks = ['propulsion','circuits'];
  const resumed = new Mission1State(saved);
  assert.equal(resumed.testsComplete(), false);
  assert.equal(resumed.objectives.has('testing'), false);
});
