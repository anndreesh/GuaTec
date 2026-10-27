/** Verify truthful persistence feedback when local storage and the API fail independently. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use local Vite.');
const out=resolve('artifacts/apollo-saving');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const errors=[],checks=[];
try{
 for(const [language,missing,failed,local,synced]of[
  ['es','Sin conexión · no hay registro guardado disponible','No se pudo guardar · conserva esta sesión e intenta de nuevo','Guardado local · sin conexión al servidor','Registro guardado y sincronizado'],
  ['en','Offline · no saved record is available','Could not save · keep this session open and try again','Saved locally · server offline','Log saved and synchronized'],
  ['fr','Hors ligne · aucune sauvegarde disponible','Sauvegarde impossible · gardez cette session ouverte et réessayez','Enregistré localement · serveur hors ligne','Registre enregistré et synchronisé'],
 ]){
  const context=await browser.newContext(),page=await context.newPage();let offline=true;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/progress/**',route=>route.fulfill(offline?{status:503,json:{error:'offline'}}:{json:{state:{}}}));
  await page.route('**/apollo-save-acceptance',route=>route.fulfill({contentType:'text/html',body:`
   <meta charset="utf-8"><style>html,body,#host{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="host"></div>
   <script type="module">
   import {ApolloScreen} from '/src/apollo/ApolloScreen.ts';import {setLanguage} from '/src/core/language.ts';
   const nativeStorage=window.localStorage;window.allowStorage=enabled=>Object.defineProperty(window,'localStorage',{configurable:true,get(){if(!enabled)throw new DOMException('Blocked','SecurityError');return nativeStorage;}});
   window.start=async language=>{setLanguage(language);window.allowStorage(false);window.mission=new ApolloScreen({currentUser:{id:'saving-fixture'}});await mission.mount(document.querySelector('#host'));window.ready=true;};window.booted=true;
   </script>`}));
  await page.goto(new URL('/apollo-save-acceptance',base).href);await page.waitForFunction(()=>window.booted);
  await page.evaluate(language=>window.start(language),language);await page.waitForFunction(()=>window.ready,undefined,{timeout:60000});
  assert.equal(await page.locator('.ap-save').innerText(),missing);
  await page.evaluate(async()=>{mission.started=true;await mission.save()});assert.equal(await page.locator('.ap-save').innerText(),failed);
  await page.evaluate(async()=>{allowStorage(true);await mission.save()});assert.equal(await page.locator('.ap-save').innerText(),local);
  offline=false;await page.evaluate(async()=>{allowStorage(false);await mission.save()});assert.equal(await page.locator('.ap-save').innerText(),synced);
  await page.screenshot({path:resolve(out,language+'-synced.png')});checks.push(language+': absent record, double failure, local fallback and cloud-only save');await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS: twelve persistence outcomes across ES/EN/FR.');
}finally{await browser.close()}
