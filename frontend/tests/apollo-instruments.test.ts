import test from 'node:test';
import assert from 'node:assert/strict';
import { SURVEY_TARGETS, RECORDS, PULSE_PATTERN, newInstrumentDraft, restoreInstrumentDraft, surveyAligned, trackingAligned, signalAligned, advanceInstrumentLock, recordsCorrect, pulseCorrect, pulseSequenceCorrect } from '../src/apollo/ApolloInstrumentRules';

test('survey requires correct bearing, magnification and focus for each distinct structure', () => {
  SURVEY_TARGETS.forEach((target, index) => {
    const correct = [target.azimuth, target.zoom, target.focus];
    assert.equal(surveyAligned(correct, index), true);
    for (const [axis, amount] of [[0, 4], [1, 8], [2, 10]]) {
      const wrong = [...correct]; wrong[axis] += amount;
      assert.equal(surveyAligned(wrong, index), false);
    }
    assert.equal(surveyAligned(correct, (index + 1) % 3), false);
  });
});

test('optical lock takes continuous alignment and resets immediately after drift', () => {
  let lock = 0;
  for (let i = 0; i < 7; i++) lock = advanceInstrumentLock(lock, true, .1, .8);
  assert.ok(lock < .8);
  assert.equal(advanceInstrumentLock(lock, false, .1, .8), 0);
  for (let i = 0; i < 12; i++) lock = advanceInstrumentLock(lock, true, .1, .8);
  assert.equal(lock, .8);
  assert.equal(advanceInstrumentLock(lock, true, Infinity, .8), 0);
  assert.equal(advanceInstrumentLock(lock, true, -1, .8), 0);
  assert.equal(advanceInstrumentLock(0, true, 30, .8), .1);
});

test('tracking requires both pointing axes, focus and a two second stable exposure', () => {
  assert.equal(trackingAligned([61, 57, 79]), true);
  assert.equal(trackingAligned([61, 40, 79]), false);
  assert.equal(trackingAligned([30, 57, 79]), false);
  assert.equal(trackingAligned([61, 57, 20]), false);
  assert.equal(trackingAligned([NaN, 57, 79]), false);
  let lock=0;for(let i=0;i<19;i++)lock=advanceInstrumentLock(lock,true,.1,2);
  assert.ok(lock<2);assert.equal(advanceInstrumentLock(lock,true,.1,2),2);
});

test('record stamping rejects omissions, swapped values, duplicates and extra cards', () => {
  assert.equal(recordsCorrect([...RECORDS]), true);
  assert.equal(recordsCorrect([RECORDS[0], null, RECORDS[2]]), false);
  assert.equal(recordsCorrect([RECORDS[1], RECORDS[0], RECORDS[2]]), false);
  assert.equal(recordsCorrect([RECORDS[0], RECORDS[0], RECORDS[2]]), false);
  assert.equal(recordsCorrect([...RECORDS, 'extra']), false);
});

test('radio tuning requires frequency and gain together before sending pulses', () => {
  assert.equal(signalAligned([67, 73]), true);
  assert.equal(signalAligned([67, 40]), false);
  assert.equal(signalAligned([40, 73]), false);
  assert.equal(signalAligned([Infinity, 73]), false);
});

test('short-long-short checks actual key durations, not the number of button presses', () => {
  assert.equal(pulseSequenceCorrect(PULSE_PATTERN), true);
  assert.equal(pulseSequenceCorrect([.28, .82]), false);
  assert.equal(pulseSequenceCorrect([.28, .82, .28, .28]), false);
  assert.equal(pulseSequenceCorrect([.01, .01, .01]), false);
  assert.equal(pulseSequenceCorrect([.28, .28, .82]), false);
  assert.equal(pulseCorrect(1.5,0), false);
  assert.equal(pulseCorrect(NaN,1), false);
  assert.equal(pulseCorrect(.28,3), false);
});

test('draft recovery preserves partial manipulation but cannot restore timers or completion', () => {
  const saved = { ...newInstrumentDraft('survey'), values: [26,62,83], captures:['tower','pad'], lock:800, completed:true };
  const restored=restoreInstrumentDraft('survey',saved);
  assert.deepEqual(restored.values,[26,62,83]);assert.deepEqual(restored.captures,['tower','pad']);
  assert.equal('lock' in restored,false);assert.equal('completed' in restored,false);
  saved.values[0]=0;assert.equal(restored.values[0],26);
  assert.deepEqual(restoreInstrumentDraft('survey',{...saved,captures:['vab']}).captures,[]);
  assert.deepEqual(restoreInstrumentDraft('survey',{...saved,captures:['tower','pad','vab']}).captures,['tower','pad']);
});

test('draft validation isolates instrument types, caps ranges and rejects invalid card values', () => {
  const saved={...newInstrumentDraft('records'),slots:['AS-506','AS-506','future-command']};
  assert.deepEqual(restoreInstrumentDraft('records',saved).slots,['AS-506',null,null]);
  assert.deepEqual(restoreInstrumentDraft('tracking',saved),newInstrumentDraft('tracking'));
  assert.deepEqual(restoreInstrumentDraft('signal',{...newInstrumentDraft('signal'),values:[-100,1000],pulses:[.28,.82,.28]}).values,[0,100]);
  assert.deepEqual(restoreInstrumentDraft('signal',{...newInstrumentDraft('signal'),pulses:[.28,.82,.28]}).pulses,[]);
  for(const saved of [null,undefined,12,'signal',{},[]])assert.deepEqual(restoreInstrumentDraft('signal',saved),newInstrumentDraft('signal'));
});
