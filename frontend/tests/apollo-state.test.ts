import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApolloState, CHECKPOINTS, DIALOGUES } from '../src/apollo/ApolloState';

function completeCheckpoint(state: ApolloState): void {
  for (const action of state.current.actions) assert.equal(state.act(action.id), true);
}

test('Apollo begins at orientation and rejects unknown or future interactions', () => {
  const state = new ApolloState();
  const before = state.toJSON();
  for (const id of ['launch-film', 'finish', 'crew-film', 'ready', 'unknown']) {
    assert.equal(state.act(id), false);
  }
  assert.deepEqual(state.toJSON(), before);
});

test('all required actions must be recorded once before a checkpoint advances', () => {
  const state = new ApolloState();
  assert.equal(state.act('map'), true);
  assert.equal(state.act('map'), false);
  assert.equal(state.act('arrive'), true);
  assert.equal(state.checkpoint, 0);
  assert.equal(state.act('landmark'), true);
  assert.equal(state.checkpoint, 1);
  assert.deepEqual(state.completed, ['orientation']);
  assert.deepEqual(state.checks, []);
  assert.equal(state.act('arrive'), false);
});

test('the eight-checkpoint journey only completes after launch and epilogue', () => {
  const state = new ApolloState();
  CHECKPOINTS.forEach((checkpoint, index) => {
    assert.equal(state.checkpoint, index);
    assert.equal(state.current.id, checkpoint.id);
    assert.equal(state.done, false);
    completeCheckpoint(state);
    assert.equal(state.completed.length, index + 1);
  });
  assert.equal(state.done, true);
  assert.equal(state.checkpoint, 7);
  assert.deepEqual(state.completed, CHECKPOINTS.map(checkpoint => checkpoint.id));
  const completed = state.toJSON();
  assert.equal(state.act('finish'), false);
  assert.equal(state.act('launch-film'), false);
  assert.deepEqual(state.toJSON(), completed);
  assert.deepEqual(new ApolloState(completed).toJSON(), completed);
});

test('a partial checkpoint and completed dialogue survive a save roundtrip without aliasing', () => {
  const state = new ApolloState();
  completeCheckpoint(state);
  state.act('tower');
  state.dialogues.push('intro-history', 'orientation-complete', 'complex-enter');
  state.elapsed = 156.5;
  const save = state.toJSON();
  const resumed = new ApolloState(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(resumed.toJSON(), save);
  assert.equal(resumed.act('tower'), false);
  assert.equal(resumed.act('pad'), true);
  save.checks.push('vab');
  assert.deepEqual(resumed.checks, ['tower', 'pad']);
});

test('corrupt, noncontiguous and future state cannot confer launch clearance', () => {
  const state = new ApolloState();
  completeCheckpoint(state);
  const valid = state.toJSON();
  const invalid = [
    { ...valid, version: 'apollo11-v2' },
    { ...valid, checkpoint: 6 },
    { ...valid, completed: ['launch'] },
    { ...valid, completed: ['orientation', 'orientation'] },
    { ...valid, checks: ['launch-film'] },
    { ...valid, checks: ['tower', 'tower'] },
    { ...valid, checks: ['tower', 'pad', 'vab', 'technician'] },
    { ...valid, checkpoint: -1 },
    { ...valid, checkpoint: 2.5 },
    { ...valid, checkpoint: 8 },
    { ...valid, elapsed: -1 },
    { ...valid, elapsed: Infinity },
    { ...valid, done: true },
    { ...valid, dialogues: ['launch-complete'] },
    { ...valid, dialogues: ['complex-complete'] },
    { ...valid, dialogues: ['not-a-dialogue'] },
    { ...valid, dialogues: ['intro-history', 'intro-history'] },
  ];
  for (const saved of invalid) assert.deepEqual(new ApolloState(saved).toJSON(), new ApolloState().toJSON());
});

test('legacy engineering progress starts the historical Apollo mission fresh', () => {
  const legacy = { tick: 150, mission01: { objectives: ['flight', 'analysis'], checkpoint: 'Complete' } };
  assert.deepEqual(new ApolloState(legacy).toJSON(), new ApolloState().toJSON());
  for (const saved of [null, undefined, 'apollo', [], 12, {}]) {
    assert.equal(new ApolloState(saved).checkpoint, 0);
  }
});

test('dependent documentation, communication and authorization actions require their evidence', () => {
  const state = new ApolloState();
  completeCheckpoint(state); completeCheckpoint(state);
  assert.equal(state.current.id, 'documentation');
  assert.equal(state.act('report'), false);
  assert.equal(state.act('log'), true);
  assert.equal(state.act('report'), true);
  assert.equal(state.act('identify'), true);
  assert.equal(state.current.id, 'communications');
  assert.equal(state.act('ready'), false);
  assert.equal(state.act('antenna'), true);
  assert.equal(state.act('ready'), false);
  assert.equal(state.act('signal'), true);
  assert.equal(state.act('ready'), true);
  completeCheckpoint(state);
  assert.equal(state.current.id, 'observation');
  assert.equal(state.act('authorize'), false);
  assert.equal(state.act('audio'), true);
  assert.equal(state.act('authorize'), false);
  assert.equal(state.act('camera'), true);
  assert.equal(state.act('authorize'), true);
  assert.equal(state.current.id, 'launch');
});

test('restoring checks without prerequisites cannot grant an earned checkpoint', () => {
  const state = new ApolloState();
  completeCheckpoint(state); completeCheckpoint(state);
  const documentation = state.toJSON();
  assert.equal(new ApolloState({ ...documentation, checks: ['report'] }).checkpoint, 0);
  assert.equal(new ApolloState({ ...documentation, checks: ['report', 'log'] }).checkpoint, 0);
  state.act('log'); state.act('report');
  assert.deepEqual(new ApolloState(state.toJSON()).checks, ['log', 'report']);
  state.act('identify');
  assert.equal(new ApolloState({ ...state.toJSON(), checks: ['ready'] }).checkpoint, 0);
  completeCheckpoint(state); completeCheckpoint(state);
  assert.equal(new ApolloState({ ...state.toJSON(), checks: ['authorize'] }).checkpoint, 0);
});

test('checkpoint and dialogue data are internally consistent', () => {
  assert.equal(new Set(CHECKPOINTS.map(checkpoint => checkpoint.id)).size, 8);
  assert.equal(new Set(DIALOGUES.map(dialogue => dialogue.id)).size, DIALOGUES.length);
  CHECKPOINTS.forEach((checkpoint, index) => {
    assert.deepEqual(checkpoint.requirements, index ? [CHECKPOINTS[index - 1].id] : []);
    assert.ok(checkpoint.actions.length > 0);
    assert.equal(new Set(checkpoint.actions.map(action => action.id)).size, checkpoint.actions.length);
    assert.ok(Number.isFinite(checkpoint.target.x) && Number.isFinite(checkpoint.target.z));
    assert.ok(DIALOGUES.some(dialogue => dialogue.checkpoint === index && dialogue.trigger === 'enter'));
  });
  for (const dialogue of DIALOGUES) {
    assert.ok(dialogue.checkpoint >= 0 && dialogue.checkpoint < 8);
    assert.ok(dialogue.duration >= 1 && dialogue.text.length > 20);
    assert.ok(!['Neil Armstrong', 'Buzz Aldrin', 'Michael Collins'].includes(dialogue.character));
  }
});
