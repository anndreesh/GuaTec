import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApolloState, BONUS_CHECKPOINTS } from '../src/apollo/ApolloState';

test('mandatory stands complete independently and persist alongside the historical route', () => {
  const state = new ApolloState();
  assert.equal(BONUS_CHECKPOINTS.length, 7);
  assert.deepEqual(state.bonusCompleted, []);
  assert.equal(state.completeBonus(BONUS_CHECKPOINTS[0]!.id), true);
  assert.equal(state.checkpoint, 0);
  assert.deepEqual(state.bonusCompleted, [BONUS_CHECKPOINTS[0]!.id]);
  assert.equal(state.completeBonus(BONUS_CHECKPOINTS[0]!.id), false);
  assert.equal(state.completeBonus('telemetry-rack'), false);
  assert.equal(state.completeBonus('flight-record'), false);
  for (const action of state.current.actions) assert.equal(state.act(action.id), true);
  assert.equal(state.completeBonus('flight-record'), true);
  assert.equal(state.completeBonus('telemetry-rack'), false);
  for (const action of state.current.actions) assert.equal(state.act(action.id), true);
  assert.equal(state.completeBonus('telemetry-rack'), true);
});

test('bonus progress survives saves and rejects unknown bonus ids', () => {
  const state = new ApolloState();
  state.completeBonus('power-bus');
  for (const action of state.current.actions) state.act(action.id);
  state.completeBonus('flight-record');
  for (const action of state.current.actions) state.act(action.id);
  state.completeBonus('telemetry-rack');
  const save = state.toJSON();
  assert.deepEqual(new ApolloState(JSON.parse(JSON.stringify(save))).toJSON(), save);
  assert.deepEqual(new ApolloState({ ...save, bonusCompleted: ['not-a-bonus'] }).toJSON(), new ApolloState().toJSON());
  // Saves created before the optional operations existed remain valid.
  const { bonusCompleted: _legacyBonus, ...legacy } = save;
  assert.deepEqual(new ApolloState(legacy).bonusCompleted, []);
});

test('navigation resolves chained stands and chronology never awards future clearances', () => {
  const state = new ApolloState();
  assert.equal(state.requiredStand?.id, 'power-bus');
  for (const stand of BONUS_CHECKPOINTS.slice(1)) assert.equal(state.completeBonus(stand.id), false);
  state.completeBonus('power-bus');
  assert.equal(state.requiredStand, undefined);
  for (const action of state.current.actions) state.act(action.id);
  assert.equal(state.requiredStand?.id, 'flight-record');
  state.completeBonus('flight-record');
  for (const action of state.current.actions) state.act(action.id);
  assert.equal(state.current.id, 'documentation');
  assert.equal(state.requiredStand?.id, 'telemetry-rack');
  assert.equal(state.completeBonus('umbilical-check'), false);
  state.completeBonus('telemetry-rack');
  assert.equal(state.requiredStand?.id, 'umbilical-check');
  state.completeBonus('umbilical-check');
  assert.equal(state.completeBonus('crew-manifest'), false);
  for (const action of state.current.actions) state.act(action.id);
  for (const action of state.current.actions) state.act(action.id);
  assert.equal(state.current.id, 'crew');
  assert.equal(state.act('crew-film'), false);
  state.completeBonus('crew-manifest');
  assert.equal(state.completeBonus('weather-window'), false);
  assert.equal(state.act('crew-film'), true);
  assert.equal(state.requiredStand?.id, 'weather-window');
});
