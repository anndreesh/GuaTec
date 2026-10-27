/** Browser acceptance for all four historical instruments and slow-frame input timing. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('Use a local Vite server.');
const out=resolve('artifacts/apollo-instruments');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/apollo-instrument-acceptance*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`
 <meta charset="utf-8"><style>html,body{margin:0;width:100%;min-height:100%;font-family:Inter,system-ui,sans-serif;color:#edf2ed;background:#17312e}*,*::before,*::after{box-sizing:border-box}#host{width:min(100%,1080px);padding:20px;margin:auto}</style><div id="host"></div>
 <script type="module">
 import {mountInstrument} from '/src/apollo/ApolloInstruments.ts';
 if(new URL(location.href).searchParams.has('slow')){window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),120);window.cancelAnimationFrame=clearTimeout;}
 window.mount=(kind,language='es')=>{window.handle?.dispose();document.querySelector('#host').replaceChildren();window.completed=0;window.draft=null;window.handle=mountInstrument(document.querySelector('#host'),kind,{language,muted:true,onComplete(){window.completed++},onCancel(){},onDraft(d){window.draft=d}});};
 window.ready=true;
 </script>`}));
const open=(kind,language='es')=>page.evaluate(({kind,language})=>mount(kind,language),{kind,language});
const range=async(index,value)=>{
 const locator=page.getByRole('slider').nth(index),box=await locator.boundingBox();await page.mouse.click(box.x+8+(box.width-16)*value/100,box.y+box.height/2);
 const left=value-Number(await locator.inputValue());await locator.focus();for(let i=0;i<Math.abs(left);i++)await page.keyboard.press(left>0?'ArrowRight':'ArrowLeft');
};
const finish=()=>page.waitForFunction(()=>window.completed===1);
const pulses=async()=>{await page.locator('.ap-inst-telegraph').focus();for(const duration of[300,840,300]){await page.keyboard.down('Space');await page.waitForTimeout(duration);await page.keyboard.up('Space');await page.waitForTimeout(120)}};
try{
 await page.goto(new URL('/apollo-instrument-acceptance',base).href);await page.waitForFunction(()=>window.ready);
 for(const language of['es','en','fr']){
   for(const kind of['survey','records','signal','tracking']){
     await open(kind,language);await page.screenshot({path:resolve(out,kind+'-'+language+'.png')});
     assert.equal(await page.locator('.ap-instrument').evaluate(el=>el.scrollWidth>el.clientWidth),false);
     if(kind==='survey'){
       for(const values of[[26,62,83],[52,72,79],[82,48,86]]){for(const[i,v]of values.entries())await range(i,v);await page.locator('.ap-inst-action').click();}
     }
     if(kind==='records'){
       await page.locator('.ap-inst-stamp').click();assert.equal(await page.evaluate(()=>window.completed),0);
       for(const[i,id]of['AS-506','LC-39A','09:32 EDT'].entries()){await page.locator('[data-card="'+id+'"]').focus();await page.keyboard.press('Enter');await page.locator('.ap-inst-record-slot').nth(i).focus();await page.keyboard.press('Enter');}
       await page.locator('.ap-inst-stamp').click();
     }
     if(kind==='signal'){
       for(const[i,v]of[67,73].entries())await range(i,v);await page.locator('.ap-inst-status-locked').waitFor();
       await page.locator('.ap-inst-telegraph').click();assert.equal(await page.evaluate(()=>window.completed),0);
       await pulses();
     }
     if(kind==='tracking'){for(const[i,v]of[61,57,79].entries())await range(i,v);await page.locator('.ap-inst-action').click();}
     await finish();checks.push(language+' / '+kind+' completes through real controls.');
     if(kind==='records'){
       await open('records',language);
       for(const[i,id]of['AS-506','LC-39A','09:32 EDT'].entries()){await page.locator('[data-card="'+id+'"]').click();await page.locator('.ap-inst-record-slot').nth(i).click();}
       await page.locator('.ap-inst-stamp').click();await finish();checks.push(language+' / records also accepts native pointer clicks after focus.');
     }
   }
 }
 await page.setViewportSize({width:390,height:844});
 for(const kind of['survey','records','signal','tracking']){await open(kind,'fr');assert.equal(await page.locator('.ap-instrument').evaluate(el=>el.scrollWidth>el.clientWidth),false);await page.screenshot({path:resolve(out,kind+'-fr-mobile.png')});}
 await page.goto(new URL('/apollo-instrument-acceptance?slow=1',base).href);await page.waitForFunction(()=>window.ready);await open('signal');
 for(const[i,v]of[67,73].entries())await range(i,v);await page.locator('.ap-inst-status-locked').waitFor();
 await pulses();await finish();checks.push('At 8 fps, physical 0.3 / 0.84 / 0.3-second holds still validate the radio pattern.');
 await page.screenshot({path:resolve(out,'radio-slow-frames.png')});
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));
 console.log('PASS: '+checks.length+' instrument checks, ES/EN/FR and mobile layouts.');
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});await writeFile(resolve(out,'failure.json'),JSON.stringify({error:String(error),checks,errors,screen:await page.locator('body').innerText()},null,2));throw error}finally{await browser.close()}
