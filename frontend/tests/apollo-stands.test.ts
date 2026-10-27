import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotsCorrect, moveIntoSlot, FUSE_RATINGS, FUSE_SOCKETS, readingsAligned, weatherAligned, headingError, advanceScan, restoreStandDraft } from '../src/apollo/ApolloStandRules';

test('placement preserves uniqueness, swaps occupied sockets and rejects invalid slots', () => {
  let slots: (number | null)[] = [null, null, null, null];
  slots = moveIntoSlot(slots, 1, 0); slots = moveIntoSlot(slots, 2, 1);
  assert.deepEqual(moveIntoSlot(slots, 1, 1), [2, 1, null, null]);
  assert.deepEqual(moveIntoSlot(slots, 3, 0), [3, 2, null, null]);
  assert.deepEqual(moveIntoSlot(slots, 9, 0), slots);
  assert.deepEqual(moveIntoSlot(slots, 1, -1), slots);
  assert.equal(slotsCorrect(slots, [1, 2, 0, 3]), false);
  assert.equal(slotsCorrect([10, 20, 5, 15], FUSE_SOCKETS), true);
  assert.equal(slotsCorrect(FUSE_RATINGS, FUSE_SOCKETS), false);
});
test('signal lock needs all finite readings and weather wraps around north', () => {
  assert.equal(readingsAligned([62, 74, 58]), true);
  assert.equal(readingsAligned([62, 74, 64]), false);
  assert.equal(readingsAligned([62, NaN, 58]), false);
  assert.equal(readingsAligned([62]), false);
  assert.equal(headingError(359, 1), 2);
  assert.equal(weatherAligned(225, 35), true);
  assert.equal(weatherAligned(65, 35), false);
  assert.equal(weatherAligned(225, 75), false);
});
test('perimeter requires continuous dwell and pauses cannot instantly award a scan', () => {
  let lock = 0;
  for (let i = 0; i < 30; i++) lock = advanceScan(lock, 1 / 60, true);
  assert.ok(lock > .4 && lock < .5);
  for (let i = 0; i < 60; i++) lock = advanceScan(lock, 1 / 60, false);
  assert.equal(lock, 0);
  assert.ok(advanceScan(0, 15, true) < .05);
  for (let i = 0; i < 90; i++) lock = advanceScan(lock, 1 / 60, true);
  assert.equal(lock, 1);
});

test('stand drafts retain manipulation but reject duplicate pieces, bad controls and mismatched instruments', () => {
  assert.deepEqual(restoreStandDraft('cables',{version:1,kind:'cables',slots:[2,0,3,null]}).slots,[2,0,3,null]);
  assert.deepEqual(restoreStandDraft('cables',{version:1,kind:'cables',slots:[2,2,9,-1]}).slots,[2,null,null,null]);
  assert.deepEqual(restoreStandDraft('weather',{version:1,kind:'weather',controls:[900,-1]}).controls,[359,0]);
  assert.equal(restoreStandDraft('telemetry',{version:1,kind:'telemetry',controls:[1,Infinity,3]}).controls,undefined);
  assert.equal(restoreStandDraft('weather',{version:1,kind:'cables',slots:[1,2,3,0]}).slots,undefined);
  assert.deepEqual(restoreStandDraft('beacons',{version:1,kind:'beacons',scanned:[true,true,true]}).scanned,[true,true,false]);
});
