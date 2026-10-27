import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('Use a local Vite server.');
const out=resolve('artifacts/apollo-report');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],checks=[];let mode='apollo',sampleRequests=0;
page.on('pageerror',e=>errors.push(e.message));
const report={ticksSurvived:240,decisionsMade:26,samplesCollected:0,finalResources:{fuel:100,pressure:100,stability:100,telemetry:100},outcome:'success',summary:'Apollo 11: quince operaciones de apoyo terrestre completadas; traslado y lanzamiento observados desde el área segura.'};
const state={version:'apollo11-v1',checkpoint:7,done:true,elapsed:240,checks:[],dialogues:[],completed:['orientation','complex','documentation','communications','crew','observation','launch','epilogue'],bonusCompleted:['power-bus','flight-record','telemetry-rack','umbilical-check','crew-manifest','weather-window','pad-safety']};
await page.route('**/api/progress/**',r=>r.fulfill({json:{state:mode==='apollo'?{apollo11:state}:{},report}}));
await page.route('**/api/samples',r=>{sampleRequests++;return r.fulfill({json:{samples:[]}})});
await page.route('**/apollo-report-acceptance',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`
 <meta charset="utf-8"><link rel="stylesheet" href="/src/style.css"><style>body{background:#10262d}#ui-root{position:relative;min-height:100vh}#app{min-height:100vh}</style><div id="app"><div id="ui-root"></div></div>
 <script type="module">import {ReportScreen} from '/src/screens/ReportScreen.ts';import {setLanguage} from '/src/core/language.ts';let active;const app={showMissionSelect(){window.back=true},showMission1(){window.replay=true}};window.start=async language=>{setLanguage(language);active?.unmount();const host=document.querySelector('#ui-root');host.replaceChildren();active=new ReportScreen(app,'mission-1-arrival');await active.mount(host)};window.ready=true;</script>`}));
try{
 await page.goto(new URL('/apollo-report-acceptance',base).href);await page.waitForFunction(()=>window.ready);
 for(const language of['es','en','fr']){
   sampleRequests=0;await page.evaluate(language=>window.start(language),language);
   assert.equal(await page.locator('.ap-report-operation').count(),15);assert.equal(await page.locator('.ap-report-operation[data-completed=true]').count(),15);
   assert.equal(await page.locator('.report-resource-list').count(),0);assert.equal(sampleRequests,0);assert.ok(!(await page.locator('body').innerText()).includes('1926'));
   assert.ok((await page.locator('.ap-report-completion').innerText()).includes('15'));
   await page.screenshot({path:resolve(out,language+'-desktop.png')});checks.push(language+': fifteen ordered operations, coherent historical reference and no invented fuel/sample metrics.');
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.start('fr'));assert.equal(await page.locator('.ap-report').evaluate(el=>el.scrollWidth>el.clientWidth),false);await page.screenshot({path:resolve(out,'fr-mobile.png')});
 await page.locator('.ap-report-operation').last().scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'fr-mobile-bottom.png')});
 await page.getByRole('button',{name:'Retour aux missions',exact:true}).click();assert.equal(await page.evaluate(()=>window.back),true);
 mode='legacy';sampleRequests=0;await page.evaluate(()=>window.start('es'));assert.equal(await page.locator('.ap-report').count(),0);assert.ok((await page.locator('body').innerText()).includes('1926'));assert.equal(sampleRequests,1);checks.push('Legacy reports keep their original engineering layout.');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS: Apollo reports in ES/EN/FR, mobile scrolling and legacy report preservation.');
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});throw error}finally{await browser.close()}
