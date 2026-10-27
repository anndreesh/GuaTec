import test from 'node:test';
import assert from 'node:assert/strict';
import {setLanguage,t,UI_TRANSLATIONS} from '@/core/i18n';
import {ACCOUNT_ERROR_SOURCES} from '@/core/AccountCopy';
import {accountErrorText} from '@/core/apiErrorCopy';

test('account codes display localized errors even when the server sends Spanish text',()=>{
  try{
    setLanguage('en');assert.equal(accountErrorText({body:{error:'username_taken',message:'Ese nombre de usuario ya está en uso.'}},'No se pudo guardar el nombre de usuario. Intenta de nuevo.'),'That username is already in use.');
    setLanguage('fr');assert.equal(accountErrorText({body:{error:'invalid_credentials'}},'No se pudo completar la autenticación. Intenta de nuevo.'),'L’adresse e-mail ou le mot de passe est incorrect.');
    assert.equal(accountErrorText({body:{error:'validation_error',message:'La contraseña debe tener al menos 8 caracteres.'}},'No se pudo completar la autenticación. Intenta de nuevo.'),'Le mot de passe doit contenir au moins 8 caractères.');
    assert.equal(accountErrorText({body:{message:'La contraseña no puede superar los 128 caracteres.'}},'No se pudo completar la autenticación. Intenta de nuevo.'),'Le mot de passe ne peut pas dépasser 128 caractères.');
  }finally{setLanguage('es');}
});

test('unrecognized transport failures and diagnostics retain a readable recovery message',()=>{
  try{
    setLanguage('fr');const fallback='No se pudo guardar el nombre de usuario. Intenta de nuevo.';
    for(const error of[null,new Error('NetworkError'),{body:null},{body:[]},{body:{error:'__proto__',message:'SQL traceback'}},{body:{error:'toString'}}])assert.equal(accountErrorText(error,fallback),'Impossible d’enregistrer le nom d’utilisateur. Réessayez.');
  }finally{setLanguage('es');}
});

test('every known account error has English and French copy and technical names keep their identity',()=>{
  for(const source of Object.values(ACCOUNT_ERROR_SOURCES)){assert.ok(Object.hasOwn(UI_TRANSLATIONS.en,source));assert.ok(Object.hasOwn(UI_TRANSLATIONS.fr,source));}
  for(const language of['en','fr','es'] as const){setLanguage(language);for(const text of['toString','constructor','__proto__','Saturn V AS-506'])assert.equal(t(text),text);}
  setLanguage('es');
});
