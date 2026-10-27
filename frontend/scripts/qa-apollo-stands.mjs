/** Browser acceptance checks for real stand input, responsive layout and teardown.
 * Run against the local Vite server. Playwright may be provided by the host runtime:
 * PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright CHROME_BIN=/path/to/chrome npm run qa:apollo
 * Fixtures are intercepted by Playwright and never added to the shipped game. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let chromium;
try { ({chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')); }
catch { throw new Error('Provide Playwright with PLAYWRIGHT_MODULE_PATH, or install playwright in the frontend development environment.'); }
const base = process.env.APOLLO_QA_URL || 'http://127.0.0.1:5173';
const url = new URL(base);
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw new Error('Run these fixtures against a local development server.');
const out = resolve('artifacts/apollo-qa'); await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true,...(process.env.CHROME_BIN ? {executablePath:process.env.CHROME_BIN} : {})});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[], checks=[];
page.on('pageerror',e=>errors.push(e.message));
// Avoid the development hot-reload websocket inside the intercepted fixture.
await page.route('**/@vite/client',r=>r.fulfill({contentType:'text/javascript',body:`
 export function createHotContext(){return{accept(){},prune(){},dispose(){},invalidate(){},on(){},off(){},send(){}}}
 export function updateStyle(id,css){let el=document.querySelector('style[data-id="'+id+'"]');if(!el){el=document.createElement('style');el.dataset.id=id;document.head.append(el)}el.textContent=css}
 export function removeStyle(){}
`}));
await page.route('**/apollo-stand-acceptance',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`
 <meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Inter,system-ui,sans-serif;color:#edf2ed}*,*::before,*::after{box-sizing:border-box}#world,#games{position:fixed;inset:0}#games{display:none}</style>
 <div id="world"></div><div id="games"></div><script type="module">
 import {ApolloWorld} from '/src/apollo/ApolloWorld.ts';
 import {BONUS_CHECKPOINTS} from '/src/apollo/ApolloState.ts';
 import {mountBonusMission} from '/src/apollo/ApolloBonusMissions.ts';
 import '/src/apollo/apollo.css';
 window.world=new ApolloWorld(document.querySelector('#world'),{onInteract(){},onMap(){}});await world.ready;
 window.mountGame=(kind,draft)=>{
   window.handle?.dispose();const bonus=BONUS_CHECKPOINTS.find(b=>b.kind===kind),host=document.querySelector('#games');host.style.display='block';
   host.innerHTML='<div class="ap-modal"><section class="ap-dialog"><small class="ap-kicker">OPERACIONES DE APOYO · 1969</small><h1></h1></section></div>';
   host.querySelector('h1').textContent=bonus.title;world.setSuspended(true);world.setStandFocus(bonus.target);window.completed=0;
   window.handle=mountBonusMission(host.querySelector('section'),bonus,{draft,onComplete(){window.completed++},onCancel(){handle.dispose();host.style.display='none'},onDraft(d){window.draft=d}});
 };
 let previous=performance.now();function frame(now){world.update(Math.min(.05,(now-previous)/1000));previous=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
 window.ready=true;
 </script>
`}));
const open = async (kind,draft) => {await page.evaluate(({kind,draft})=>window.mountGame(kind,draft),{kind,draft});await page.waitForTimeout(80);};
const drag = async (item,slot) => {
 const source=page.locator('[data-item="'+item+'"]'),target=page.locator('[data-slot="'+slot+'"]');
 const a=await source.boundingBox(),b=await target.boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:14});await page.mouse.up();await page.waitForTimeout(100);
};
const assign = async (order,keyboard=false) => {
 for(let slot=0;slot<order.length;slot++){
   if(!keyboard){await drag(order[slot],slot);continue;}
   await page.locator('[data-item="'+order[slot]+'"]').focus();await page.keyboard.press('Enter');
   await page.locator('[data-slot="'+slot+'"]').focus();await page.keyboard.press('Enter');
 }
};
const range = async (name,value) => {
 const control=page.getByRole('slider',{name}),r=await control.boundingBox(),max=Number(await control.getAttribute('max'));
 await page.mouse.click(r.x+8+(r.width-16)*value/max,r.y+r.height/2);
};
const finish = async () => {await page.waitForFunction(()=>window.completed===1,{timeout:5000});};
const imprint=async(travel=1)=>{
 const handle=page.locator('.ap-imprinter-roller'),a=await handle.boundingBox(),span=await handle.evaluate(el=>el.parentElement.clientWidth-98);
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
 for(let n=1;n<=15;n++){await page.mouse.move(a.x+a.width/2+span*travel*n/15,a.y+a.height/2);await page.waitForTimeout(50);}
 await page.mouse.up();
};
try {
 await page.goto(new URL('/apollo-stand-acceptance',url).href);await page.waitForFunction(()=>window.ready,{timeout:60000});
 assert.deepEqual(await page.evaluate(()=>world.assetErrors),[]);
 await open('sequence');await page.waitForTimeout(1000);
 const focusedFov=await page.evaluate(()=>world.camera.fov);assert.ok(Math.abs(focusedFov-48)<.5,'Stand camera reaches its working lens.');
 await page.evaluate(()=>world.setStandFocus(null));await page.waitForTimeout(60);
 const returningFov=await page.evaluate(()=>world.camera.fov);assert.ok(returningFov>focusedFov&&returningFov<61,'Returning lens eases instead of snapping.');
 await page.waitForTimeout(1000);assert.ok(Math.abs(await page.evaluate(()=>world.camera.fov)-62)<.1);
 checks.push('Camera: station focus and return lens ease smoothly while world movement is suspended.');
 for(const kind of ['sequence','flight-plan','telemetry','cables','crew-manifest','weather','beacons']){
   await open(kind);await page.waitForTimeout(300);await page.screenshot({path:resolve(out,'desktop-'+kind+'.png')});
   assert.equal(await page.locator('.ap-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,kind+' desktop overflow');
 }
 await open('sequence');await range('Palanca de alimentación',100);assert.match(await page.locator('.ap-stand-feedback').innerText(),/Circuito abierto/);
 await assign([1,3,0,2]);await range('Palanca de alimentación',100);await finish();checks.push('Fuses: wrong circuit rejected; pointer placement and power lever succeed.');
 await open('flight-plan');await page.getByRole('button',{name:'Sellar plan de vuelo'}).click();assert.equal(await page.evaluate(()=>window.completed),0);
 await assign([1,3,0,2],true);await page.getByRole('button',{name:'Sellar plan de vuelo'}).click();await finish();checks.push('Flight plan: missing pieces rejected; full keyboard ordering succeeds.');
 await open('crew-manifest');await imprint(.4);assert.equal(await page.locator('[data-recorded=true]').count(),0);
 await imprint();assert.equal(await page.locator('[data-recorded=true]').count(),1);
 await page.locator('.ap-imprinter-roller').focus();await page.keyboard.down('Space');await page.waitForTimeout(1000);await page.keyboard.up('Space');assert.equal(await page.locator('[data-recorded=true]').count(),2);
 const credentials=await page.evaluate(()=>handle.snapshot());await open('crew-manifest',credentials);assert.equal(await page.locator('[data-recorded=true]').count(),2);
 await page.setViewportSize({width:390,height:844});await page.locator('.ap-imprinter-track').scrollIntoViewIfNeeded();
 const reader=await page.locator('.ap-imprinter-roller').boundingBox(),travel=await page.locator('.ap-imprinter-track').evaluate(el=>el.clientWidth-98),readerCdp=await page.context().newCDPSession(page);
 await readerCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:reader.x+reader.width/2,y:reader.y+reader.height/2}]});
 await readerCdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:reader.x+reader.width/2+travel*.4,y:reader.y+reader.height/2}]});await readerCdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.locator('[data-recorded=true]').count(),2);
 await readerCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:reader.x+reader.width/2,y:reader.y+reader.height/2}]});
 for(let n=1;n<=12;n++){await readerCdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:reader.x+reader.width/2+travel*n/12,y:reader.y+reader.height/2}]});await page.waitForTimeout(65);}
 await readerCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await readerCdp.detach();await finish();await page.setViewportSize({width:1440,height:900});
 checks.push('Crew: incomplete stroke rejected; mouse, Space hold, native touch and restored credentials verified.');
 await open('cables');await assign([2,0,3,1]);assert.equal(await page.locator('.ap-patch-wires path').count(),4);await page.screenshot({path:resolve(out,'cables-connected.png')});
 await page.getByRole('button',{name:'Probar continuidad'}).click();await finish();checks.push('Cables: four visible curves and continuity verification succeed.');
 await open('telemetry');await page.getByRole('button',{name:'Fijar enlace'}).click();assert.equal(await page.evaluate(()=>window.completed),0);
 for(const [name,value]of[['S-IVB',62],['Enlace',74],['Plataforma',58]])await range(name,value);
 await page.getByRole('button',{name:'Fijar enlace'}).click();await finish();checks.push('Telemetry: misalignment rejected; all three tuners verified.');
 await open('weather');await range('Rumbo de veleta',225);await range('Obturador de nubosidad',35);await page.getByRole('button',{name:'Sellar parte de observación'}).click();await finish();checks.push('Weather: vane and cloud plate matched.');
 await open('beacons');const r=await page.locator('.ap-perimeter canvas').boundingBox();
 for(const [x,y]of[[.22,.3],[.73,.65],[.48,.24]]){await page.mouse.move(r.x+r.width*x,r.y+r.height*y,{steps:8});await page.waitForTimeout(1450);}
 await finish();checks.push('Perimeter: three continuous dwell scans succeed.');
 await open('cables');await drag(2,0);await drag(0,1);const draft=await page.evaluate(()=>handle.snapshot());
 await page.getByRole('button',{name:'Volver al recorrido'}).click();await open('cables',draft);
 assert.equal(await page.locator('[data-filled=true]').count(),2);assert.equal(await page.evaluate(()=>window.completed),0);checks.push('Partial draft: two connectors restore without earning clearance.');
 for(const [width,height]of[[768,1024],[390,844]]){
   await page.setViewportSize({width,height});
   for(const kind of ['cables','telemetry','weather','flight-plan','crew-manifest']){
     await open(kind);assert.equal(await page.locator('.ap-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,kind+' responsive overflow');
     await page.screenshot({path:resolve(out,width+'-'+kind+'.png')});
   }
 }
 await open('cables');await page.locator('.ap-patch-board').scrollIntoViewIfNeeded();
 const a=await page.locator('[data-item="2"]').boundingBox(),b=await page.locator('[data-slot="0"]').boundingBox(),cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
 for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*n/12,y:a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*n/12}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.match(await page.locator('[data-slot="0"] strong').innerText(),/C \/ CANAL 3/);
 const cancel=await page.locator('[data-item="1"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cancel.x+15,y:cancel.y+15}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cancel.x+55,y:cancel.y+25}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.locator('.ap-placement-ghost').count(),0);await cdp.detach();
 checks.push('Touch: native 390px drag succeeds and cancellation removes the drag ghost.');
 await page.getByRole('button',{name:'Volver al recorrido'}).click();await page.waitForTimeout(1000);assert.equal(await page.locator('.ap-stand').count(),0);assert.equal(await page.evaluate(()=>window.completed),0);checks.push('Teardown: no late completion after cancellation.');
 assert.deepEqual(errors,[]);
 const diagnostics=await page.evaluate(()=>world.diagnostics());
 await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors,diagnostics},null,2));
 console.log('PASS: '+checks.length+' browser acceptance checks. Reports: '+out);
}finally{await browser.close();}
