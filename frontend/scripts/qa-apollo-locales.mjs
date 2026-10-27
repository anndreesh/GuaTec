/** Real mission UI, with a local API fixture; no shortcuts are shipped in the game. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('Use a local Vite server for the intercepted fixtures.');
const out=resolve('artifacts/apollo-locales');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
let saved={state:{}};
await page.route('**/api/progress/**',async route=>{
  if(route.request().method()==='PUT')saved=route.request().postDataJSON();
  await route.fulfill({json:saved});
});
await page.route('**/apollo-locale-acceptance',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`
 <meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Inter,system-ui,sans-serif;color:#edf2ed}*,*::before,*::after{box-sizing:border-box}#game{position:fixed;inset:0}</style><div id="game"></div>
 <script type="module">
 import {ApolloScreen} from '/src/apollo/ApolloScreen.ts';
 import {BONUS_CHECKPOINTS} from '/src/apollo/ApolloState.ts';
 import {setLanguage,getLanguage} from '/src/core/language.ts';
 window.setLocale=setLanguage;window.getLocale=getLanguage;window.mapCopy=[];
 const fillText=CanvasRenderingContext2D.prototype.fillText;
 CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.mapCopy.push(text);return fillText.call(this,text,...args)};
 const getContext=HTMLCanvasElement.prototype.getContext;let fail=false;
 HTMLCanvasElement.prototype.getContext=function(type,...args){return fail&&type.startsWith('webgl')?null:getContext.call(this,type,...args)};
 const app={currentUser:{id:'locale-fixture'},showMissionSelect(){window.returned=true},showMission1(){window.retried=true}};
 window.start=async(failure=false)=>{window.mission?.unmount();document.querySelector('#game').replaceChildren();fail=failure;window.mission=new ApolloScreen(app);window.ready=false;await mission.mount(document.querySelector('#game'));window.ready=true;};
 window.nearPower=()=>{const b=BONUS_CHECKPOINTS[0];mission.world.player.set(b.target.x,0,b.target.z+5);};
 window.addEventListener('languagechange',()=>mission?.refreshLanguage());
 window.booted=true;
 </script>`}));
try{
 await page.goto(new URL('/apollo-locale-acceptance',base).href);await page.waitForFunction(()=>window.booted);
 await page.evaluate(()=>{void window.start();window.setLocale('fr')});await page.waitForFunction(()=>window.ready,undefined,{timeout:60000});
 await page.getByRole('button',{name:'Commencer les opérations',exact:true}).click();
 await page.waitForTimeout(120);const before=await page.locator('.ap-cinema-caption').innerText();
 await page.evaluate(()=>window.setLocale('en'));await page.waitForTimeout(80);
 const after=await page.locator('.ap-cinema-caption').innerText();assert.notEqual(after,before);assert.match(after,/FLORIDA|JULY/i);
 checks.push('Language changes during loading and the introduction update the live scene without errors.');
 await page.getByRole('button',{name:'Skip introduction'}).click();await page.evaluate(()=>{window.setLocale('es');window.nearPower()});
 await page.getByRole('button',{name:'E · Banco de alimentación',exact:true}).click();
 await page.locator('[data-item="1"]').click();await page.locator('[data-slot="0"]').click();
 for(const [language,title]of[['en','Power distribution bench'],['fr','Banc d’alimentation'],['es','Banco de alimentación']]){
   await page.evaluate(lang=>window.setLocale(lang),language);
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
   assert.equal(await page.locator('[data-filled="true"]').count(),1);assert.equal(await page.locator('.ap-stand').count(),1);
   await page.screenshot({path:resolve(out,'power-'+language+'.png')});
 }
 checks.push('ES → EN → FR → ES retains the open stand and its placed fuse.');
 await page.keyboard.press('Escape');await page.evaluate(()=>window.setLocale('fr'));await page.keyboard.press('Escape');
 assert.match(await page.locator('.ap-pause-intro').innerText(),/La mission est en pause/);
 await page.getByRole('button',{name:/Langue/}).click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('.ap-language-options').count(),0);assert.equal(await page.locator('.ap-pause-dialog').count(),1);
 assert.match(await page.evaluate(()=>document.activeElement.textContent),/Langue/);
 assert.ok(await page.evaluate(()=>window.mapCopy.includes('39A · ZONE INTERDITE')));
 await page.screenshot({path:resolve(out,'pause-fr.png')});checks.push('French pause copy, canvas map and Escape focus restoration are localized.');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'E · Banc d’alimentation',exact:true}).click();
 assert.equal(await page.locator('[data-filled="true"]').count(),1);checks.push('Closing and reopening in another language retains the partial operation.');
 await page.evaluate(()=>window.start(true));await page.getByRole('heading',{name:'Le mode 3D n’a pas pu démarrer',exact:true}).waitFor();
 await page.evaluate(()=>window.setLocale('en'));await page.getByRole('heading',{name:'3D mode could not start',exact:true}).waitFor();
 await page.getByRole('button',{name:'Retry mission',exact:true}).click();assert.equal(await page.evaluate(()=>window.retried),true);
 await page.getByRole('button',{name:'Back to missions',exact:true}).click();assert.equal(await page.evaluate(()=>window.returned),true);
 await page.screenshot({path:resolve(out,'webgl-error-en.png')});checks.push('A WebGL failure can switch language, retry and return without touching an absent world.');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));
 console.log('PASS: '+checks.length+' language and live-mission acceptance checks.');
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});await writeFile(resolve(out,'failure.json'),JSON.stringify({error:String(error),errors,screen:await page.locator('body').innerText()},null,2));throw error;}finally{await browser.close()}
