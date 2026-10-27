import {t} from './i18n';
import {ACCOUNT_ERROR_SOURCES} from './AccountCopy';
const knownMessages=new Set([...Object.values(ACCOUNT_ERROR_SOURCES),'Envía un correo electrónico y una contraseña.','Ingresa un correo electrónico válido.','Ingresa una contraseña.']);

/** Translate known account messages; unknown server diagnostics use the caller's
 * localized recovery text instead of leaking technical copy into the product flow. */
export function accountErrorText(error:unknown,fallback:string):string{
  if(error&&typeof error==='object'&&'body'in error){
    const body=error.body;
    if(body&&typeof body==='object'&&!Array.isArray(body)){
      const value=body as {error?:unknown;message?:unknown};
      if(typeof value.error==='string'){const source=ACCOUNT_ERROR_SOURCES[value.error];if(typeof source==='string')return t(source);}
      if(typeof value.message==='string'){
        if(knownMessages.has(value.message))return t(value.message);
        const short=value.message.match(/^La contraseña debe tener al menos (\d+) caracteres\.$/);
        if(short)return t('La contraseña debe tener al menos {count} caracteres.').replace('{count}',short[1]!);
        const long=value.message.match(/^La contraseña no puede superar los (\d+) caracteres\.$/);
        if(long)return t('La contraseña no puede superar los {count} caracteres.').replace('{count}',long[1]!);
      }
    }
  }
  return t(fallback);
}
