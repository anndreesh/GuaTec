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
});

test('bonus progress survives saves and rejects unknown bonus ids', () => {
  const state = new ApolloState();
  state.completeBonus('telemetry-rack');
  const save = state.toJSON();
  assert.deepEqual(new ApolloState(JSON.parse(JSON.stringify(save))).toJSON(), save);
  assert.deepEqual(new ApolloState({ ...save, bonusCompleted: ['not-a-bonus'] }).toJSON(), new ApolloState().toJSON());
  // Saves created before the optional operations existed remain valid.
  const { bonusCompleted: _legacyBonus, ...legacy } = save;
  assert.deepEqual(new ApolloState(legacy).bonusCompleted, []);
});
