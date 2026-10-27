/** Local intercepted account requests exercise real translated screens and failures. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use a local Vite server.');
const out=resolve('artifacts/app-locales');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],checks=[];
let guestAttempts=0,nameRequests=0;
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/auth/providers',r=>r.fulfill({status:503,json:{error:'unavailable'}}));
await page.route('**/api/auth/guest',r=>{
 guestAttempts++;
 return r.fulfill(guestAttempts===1?{status:503,json:{error:'unavailable'}}:{json:{token:'local-fixture-only',user:{id:'locale-fixture',hasUsername:false}}});
});
await page.route('**/api/user/username',async r=>{
 nameRequests++;const username=r.request().postDataJSON().username;
 if(username==='?')return r.fulfill({status:400,json:{error:'invalid_username',message:'El nombre de usuario debe tener 3-20 caracteres alfanuméricos, guiones o guiones bajos.'}});
 await new Promise(resolve=>setTimeout(resolve,300));return r.fulfill({json:{id:'locale-fixture',username,hasUsername:true}});
});
await page.route('**/api/missions',r=>r.fulfill({json:{missions:[]}}));
await page.route('**/api/nasa/mission-briefing',r=>r.fulfill({json:{stories:[0,1].map(i=>({kind:'APOD',title:'Actualización de NASA',summary:'Registro científico NASA.',date:'2026-07-16T12:00:00Z',imageUrl:null,sourceUrl:null}))}}));
await page.route('**/app-locale-acceptance',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`
 <meta charset="utf-8"><link rel="stylesheet" href="/src/style.css"><style>body{background:#10262d}#ui-root{position:relative;min-height:100vh}#app{min-height:100vh}</style><div id="app"><div id="ui-root"></div></div>
 <script type="module">
 import {AuthScreen} from '/src/screens/AuthScreen.ts';import {UsernameScreen} from '/src/screens/UsernameScreen.ts';import {MissionSelectScreen} from '/src/screens/MissionSelectScreen.ts';import {setLanguage} from '/src/core/language.ts';
 const host=document.querySelector('#ui-root');let active;
 const app={currentUser:null,showUsername(){active?.unmount();host.replaceChildren();active=new UsernameScreen(app);active.mount(host)},showMissionSelect(){window.arrivals++;host.textContent='DONE'}};
 window.start=async language=>{setLanguage(language);active?.unmount();host.replaceChildren();window.arrivals=0;active=new AuthScreen(app);await active.mount(host)};
 window.missions=async language=>{setLanguage(language);active?.unmount();host.replaceChildren();active=new MissionSelectScreen(app);await active.mount(host)};window.ready=true;
 </script>`}));
try{
 await page.goto(new URL('/app-locale-acceptance',base).href);await page.waitForFunction(()=>window.ready);
 for(const[language,guest,failed,invalid]of[
   ['es','Continuar con Invitado','No se pudo completar la autenticación. Intenta de nuevo.','El nombre de usuario debe tener 3-20'],
   ['en','Continue with Guest','Could not complete authentication. Try again.','Your username must contain 3–20'],
   ['fr','Continuer avec Invité','Impossible de terminer l’authentification. Réessayez.','Le nom d’utilisateur doit contenir de 3 à 20'],
 ]){
   guestAttempts=0;nameRequests=0;await page.evaluate(language=>window.start(language),language);
   const button=page.getByRole('button',{name:guest,exact:true});await button.click();await page.waitForFunction(text=>document.querySelector('.auth-screen [role=alert]')?.textContent===text,failed);assert.equal(await button.isEnabled(),true);
   await page.screenshot({path:resolve(out,'guest-error-'+language+'.png')});
   await button.click();await page.locator('.username-screen input').waitFor();
   await page.locator('.username-screen input').fill('?');await page.locator('.username-screen button').click();
   await page.waitForFunction(text=>document.querySelector('.username-screen [role=alert]')?.textContent?.startsWith(text),invalid);
   await page.screenshot({path:resolve(out,'username-error-'+language+'.png')});
   await page.locator('.username-screen input').fill('AtlasQA');await page.locator('.username-screen input').focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');
   await page.waitForFunction(()=>window.arrivals===1);assert.equal(nameRequests,2,'One invalid and one valid request; repeated Enter never duplicates submission.');
   assert.equal(guestAttempts,2);checks.push(language+': unavailable provider, guest retry, localized validation and single submission pass.');
 }
 for(const[language,prefix,dot]of[['es','Publicado el','Historia 1'],['en','Published on','Story 1'],['fr','Publié le','Article 1']]){
   await page.evaluate(language=>window.missions(language),language);assert.ok((await page.locator('.nasa-briefing-date').innerText()).includes(prefix));assert.equal(await page.locator('.nasa-carousel-dot').first().getAttribute('aria-label'),dot);checks.push(language+': NASA date prefix and story navigation are localized.');
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS: '+checks.length+' account locale and recovery flows.');
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});await writeFile(resolve(out,'failure.json'),JSON.stringify({error:String(error),errors,screen:await page.locator('body').innerText()},null,2));throw error}finally{await browser.close()}
