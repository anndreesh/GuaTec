import test from 'node:test';
import assert from 'node:assert/strict';
import { APOLLO_TRANSLATIONS } from '@/apollo/ApolloLocale';

test('Apollo locale catalog has complete ES/EN/FR rows', () => {
  assert.ok(APOLLO_TRANSLATIONS.size > 150, 'Apollo copy catalog should cover the full mission surface');
  for (const [source, translations] of APOLLO_TRANSLATIONS) {
    assert.notEqual(source.trim(), '', 'translation keys cannot be empty');
    assert.notEqual(translations.en.trim(), '', `missing English translation for ${source}`);
    assert.notEqual(translations.fr.trim(), '', `missing French translation for ${source}`);
  }
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
