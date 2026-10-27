/** Real movement input and loaded clip weights; no authored jump clip is assumed. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use local Vite.');
const out=resolve('artifacts/apollo-movement');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/apollo-movement-acceptance',route=>route.fulfill({contentType:'text/html',body:`
 <meta charset="utf-8"><style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="world"></div><script type="module">
 import {ApolloWorld} from '/src/apollo/ApolloWorld.ts';
 window.world=new ApolloWorld(document.querySelector('#world'),{onInteract(){},onMap(){}});await world.ready;world.player.set(0,0,300);
 window.sample=()=>{const p=world.people[0];return{position:world.player.toArray(),grounded:world.grounded,weights:Object.fromEntries(['walk','idle','run','jump'].map(key=>[key,p[key]?.getEffectiveWeight()??0]))}};
 let previous=performance.now();function frame(now){world.update((now-previous)/1000);previous=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);window.ready=true;
 </script>`}));
try{
 await page.goto(new URL('/apollo-movement-acceptance',base).href);await page.waitForFunction(()=>window.ready,undefined,{timeout:60000});
 await page.waitForTimeout(100);const idle=await page.evaluate(()=>sample());assert.equal(idle.weights.idle,1);
 await page.keyboard.down('w');await page.waitForTimeout(350);const walk=await page.evaluate(()=>sample());await page.keyboard.up('w');assert.ok(walk.weights.walk>.98);assert.ok(walk.position[2]<idle.position[2]-1);
 await page.waitForTimeout(80);const runStart=await page.evaluate(()=>sample());await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForTimeout(350);const run=await page.evaluate(()=>sample());await page.keyboard.up('w');await page.keyboard.up('Shift');assert.ok(run.weights.run>.98);assert.ok(runStart.position[2]-run.position[2]>(idle.position[2]-walk.position[2])*1.4);checks.push({idle,walk,run});
 await page.keyboard.down('Space');await page.waitForTimeout(210);await page.keyboard.up('Space');const airborne=await page.evaluate(()=>sample());assert.equal(airborne.grounded,false);assert.ok(airborne.position[1]>.6);assert.ok(Object.values(airborne.weights).some(weight=>weight>0),'Airborne pose is animated, never the unweighted bind pose.');
 await page.screenshot({path:resolve(out,'jump-authored-pose.png')});checks.push({airborne});
 await page.waitForTimeout(800);const landed=await page.evaluate(()=>sample());assert.equal(landed.grounded,true);assert.equal(landed.position[1],0);assert.ok(landed.weights.idle>.98);checks.push({landed});
 for(const state of [idle,walk,run,airborne,landed])assert.ok(Math.abs(Object.values(state.weights).reduce((a,b)=>a+b,0)-1)<.01,'Crossfade retains a weighted authored pose.');
 await page.evaluate(()=>{world.setTouchSprint(true);world.setTouchMovement(0,1)});await page.waitForTimeout(350);assert.ok((await page.evaluate(()=>sample())).weights.run>.98);await page.evaluate(()=>{world.setTouchMovement(0,0);world.setTouchSprint(false)});checks.push('Touch sprint selects the same running animation as Shift.');
 await page.evaluate(()=>world.setSuspended(true));const stopped=await page.evaluate(()=>sample());await page.keyboard.down('w');await page.keyboard.press('Space');await page.waitForTimeout(200);await page.keyboard.up('w');assert.deepEqual((await page.evaluate(()=>sample())).position,stopped.position);await page.evaluate(()=>world.setSuspended(false));checks.push('Suspended controls cannot move or jump.');
 await page.waitForTimeout(800);const settled=await page.evaluate(()=>sample());assert.equal(settled.weights.walk,0);assert.equal(settled.weights.run,0);assert.equal(settled.weights.idle,1);checks.push('Completed crossfades stop evaluating inactive animation tracks.');
 await page.keyboard.down('w');await page.waitForTimeout(120);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const lostFocus=await page.evaluate(()=>sample());await page.waitForTimeout(250);assert.deepEqual((await page.evaluate(()=>sample())).position,lostFocus.position);await page.keyboard.up('w');checks.push('Explicit blur lifecycle clears movement before the physical key is released.');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({clips:await page.evaluate(()=>world.diagnostics().loadedModel.clips),checks,errors},null,2));console.log('PASS: idle, walk, run, posed jump, landing, suspension and focus loss.');
}finally{await browser.close()}
