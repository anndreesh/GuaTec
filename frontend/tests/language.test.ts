import test from 'node:test';
import assert from 'node:assert/strict';
import { getLanguage, setLanguage, type Language } from '@/core/language';
import { t, languageLabel } from '@/core/i18n';
import { apolloLanguage, apolloText } from '@/apollo/ApolloLocale';

test('menus, mission copy and language labels use one in-memory preference', () => {
  try {
    setLanguage('en');
    assert.equal(getLanguage(), 'en'); assert.equal(apolloLanguage(), 'en');
    assert.equal(t('Comenzar'), 'Start'); assert.equal(languageLabel(), 'EN');
    assert.equal(apolloText('Volver al recorrido'), 'Return to the field');
    setLanguage('fr');
    assert.equal(t('Comenzar'), 'Commencer');
    assert.equal(apolloText('Volver al recorrido'), 'Retour au parcours');
    setLanguage('invalid' as Language); assert.equal(getLanguage(), 'fr');
  } finally { setLanguage('es'); }
});

test('French copy covers account errors, story navigation and mission reports', () => {
  try {
    setLanguage('fr');
    assert.equal(t('Historia anterior'), 'Article précédent');
    assert.equal(t('Siguiente historia'), 'Article suivant');
    assert.equal(t('No se encontró un informe para esta misión.'), 'Aucun rapport n’a été trouvé pour cette mission.');
    assert.match(t('No se pudo guardar el nombre de usuario. Intenta de nuevo.'), /Impossible d’enregistrer/);
  } finally { setLanguage('es'); }
});

test('denied browser storage never prevents a language change or splits menu and mission languages', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.doesNotThrow(() => setLanguage('fr'));
    assert.equal(t('Comenzar'), 'Commencer');
    assert.equal(apolloLanguage(), 'fr'); assert.equal(languageLabel(), 'FR');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    setLanguage('es');
  }
});
