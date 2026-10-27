import test from 'node:test';
import assert from 'node:assert/strict';
import { APOLLO_TRANSLATIONS, APOLLO_TRANSLATION_ROWS, apolloText } from '@/apollo/ApolloLocale';
import { CHECKPOINTS, BONUS_CHECKPOINTS, DIALOGUES } from '@/apollo/ApolloState';
import { FLIGHT_CARDS, CREW_CARDS } from '@/apollo/ApolloStandRules';

test('Apollo locale catalog has complete ES/EN/FR rows', () => {
  assert.ok(APOLLO_TRANSLATIONS.size > 150, 'Apollo copy catalog should cover the full mission surface');
  for (const [source, translations] of APOLLO_TRANSLATIONS) {
    assert.notEqual(source.trim(), '', 'translation keys cannot be empty');
    assert.notEqual(translations.en.trim(), '', `missing English translation for ${source}`);
    assert.notEqual(translations.fr.trim(), '', `missing French translation for ${source}`);
  }
});

test('every authored objective, action, stand and dialogue has English and French copy', () => {
  const sources = [
    ...CHECKPOINTS.flatMap(cp => [cp.title, cp.objective, ...cp.actions.flatMap(action => [action.label, action.description])]),
    ...BONUS_CHECKPOINTS.flatMap(stand => [stand.title, stand.objective]),
    ...DIALOGUES.map(line => line.text),
    ...FLIGHT_CARDS.flatMap(card => [card.title, card.detail]),
    ...CREW_CARDS.map(card => card.role),
  ];
  for (const source of sources) assert.ok(APOLLO_TRANSLATIONS.has(source), `Missing authored mission copy: ${source}`);
});

test('duplicate source keys cannot silently overwrite a different translation', () => {
  const entries = new Map<string, readonly string[]>();
  for (const [source, en, fr] of APOLLO_TRANSLATION_ROWS) {
    if (entries.has(source)) assert.deepEqual([en, fr], entries.get(source), `Conflicting translations for ${source}`);
    entries.set(source, [en, fr]);
  }
});

test('dynamic navigation, connectors and progress preserve values in all languages', () => {
  const cases = [
    ['E · Banco de alimentación', 'E · Power distribution bench', 'E · Banc d’alimentation'],
    ['✓ REGISTRO VALIDADO', '✓ RECORD VERIFIED', '✓ REGISTRE VALIDÉ'],
    ['3 / 4 CONECTORES', '3 / 4 CONNECTORS', '3 / 4 CONNECTEURS'],
    ['2 / 3 CREDENCIALES', '2 / 3 CREDENTIALS', '2 / 3 BADGES'],
    ['20 A / PORTAFUSIBLE', '20 A / FUSE SOCKET', '20 A / PORTE-FUSIBLE'],
    ['C / CANAL 3', 'C / CHANNEL 3', 'C / CANAL 3'],
    ['42 m · Plan de vuelo', '42 m · Flight plan', '42 m · Plan de vol'],
    ['STAND BLOQUEADO · COMPLETA Banco de alimentación', 'STATION LOCKED · COMPLETE Power distribution bench', 'POSTE VERROUILLÉ · TERMINEZ Banc d’alimentation'],
    ['STANDS OBLIGATORIOS · 2 / 7 COMPLETADOS', 'REQUIRED STATIONS · 2 / 7 COMPLETE', 'POSTES OBLIGATOIRES · 2 / 7 TERMINÉS'],
  ];
  for (const [es, en, fr] of cases) {
    assert.equal(apolloText(es, 'es'), es); assert.equal(apolloText(es, 'en'), en); assert.equal(apolloText(es, 'fr'), fr);
  }
  assert.equal(apolloText('Saturn V AS-506 · 28 V DC', 'fr'), 'Saturn V AS-506 · 28 V DC');
});

test('Apollo locale catalog covers dynamic mission surfaces', () => {
  for (const source of [
    'Misión 01: Apollo 11', 'Mapa de operaciones', 'Reiniciar misión',
    'OPERACIONES TERRESTRES · 1969', 'PLATAFORMA 39A',
    'Centro Espacial Kennedy en 1969. Escenario 3D de Apollo 11.',
  ]) {
    assert.ok(APOLLO_TRANSLATIONS.has(source), `missing dynamic Apollo copy: ${source}`);
  }
});
