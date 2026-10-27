/** Local motion acceptance: rigs, independent lights, planted contacts and pause. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use a local server.');
const out=resolve('artifacts/apollo-actors');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/apollo-actor-acceptance',route=>route.fulfill({contentType:'text/html',body:`
<style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="world"></div><script type="module">
import {ApolloWorld} from '/src/apollo/ApolloWorld.ts';
window.world=new ApolloWorld(document.querySelector('#world'),{onInteract(){},onMap(){}});await world.ready;
let previous=performance.now();window.animate=true;function frame(now){if(window.animate)world.update((now-previous)/1000);previous=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);window.ready=true;
</script>`}));
const pose=()=>page.evaluate(()=>world.technicians.map(t=>({x:t.root.position.x,z:t.root.position.z,head:t.head.rotation.y,arm:t.rightArm.rotation.x,collider:world.colliders.some(c=>c.x===t.root.position.x&&c.z===t.root.position.z)})));
try{
 await page.goto(new URL('/apollo-actor-acceptance',base).href);await page.waitForFunction(()=>window.ready);
 assert.deepEqual(await page.evaluate(()=>world.assetErrors),[]);
 await page.evaluate(()=>{world.player.set(-70,0,179);world.yaw=0;world.setSuspended(false)});
 const before=await pose();assert.equal(before.length,4);await page.waitForTimeout(800);const after=await pose();
 assert.ok(after.every((t,i)=>t.x===before[i].x&&t.z===before[i].z&&t.collider));
 assert.ok(after.some((t,i)=>Math.abs(t.arm-before[i].arm)>.001));checks.push('Four working technicians animate with feet and colliders planted.');
 await page.evaluate(()=>{const t=world.technicians[0];world.setStandFocus({x:t.baseX,z:t.baseZ})});await page.waitForTimeout(1000);
 await page.screenshot({path:resolve(out,'technicians-motion-a.png')});await page.waitForTimeout(700);await page.screenshot({path:resolve(out,'technicians-motion-b.png')});
 const exploration=await page.evaluate(()=>world.diagnostics());
 await page.evaluate(()=>world.setSuspended(true));const paused=await pose();await page.waitForTimeout(400);assert.deepEqual(await pose(),paused);checks.push('Pause freezes technician gestures.');
 await page.evaluate(()=>{window.animate=false;world.setCinematic('crew',4);world.update(1/60)});
 const first=await page.evaluate(()=>({wheel:world.van.userData.vehicleRig.wheels[0].rotation.x,z:world.van.position.z,parked:world.vehicleRigs[1].userData.vehicleRig.headlamp.emissiveIntensity}));
 await page.evaluate(()=>{world.setCinematic('crew',8);world.update(1/60)});
 const second=await page.evaluate(()=>({wheel:world.van.userData.vehicleRig.wheels[0].rotation.x,z:world.van.position.z,parked:world.vehicleRigs[1].userData.vehicleRig.headlamp.emissiveIntensity}));
 assert.ok(Math.abs((second.wheel-first.wheel)-(second.z-first.z)/.4)<.0001);assert.equal(first.parked,second.parked);
 checks.push('Crew transport wheel travel matches road distance; parked lights remain independent.');
 await page.screenshot({path:resolve(out,'crew-transport.png')});
 const metrics=await page.evaluate(()=>world.diagnostics());
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{world.setCinematic(null,0);world.player.set(-70,0,179);world.setSuspended(false);window.animate=true});await page.waitForTimeout(700);await page.screenshot({path:resolve(out,'technicians-mobile.png')});
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,exploration,metrics,errors},null,2));console.log(`PASS: ${checks.length} actor checks. Exploration ${exploration.drawCalls} calls / ${exploration.triangles} triangles; crew ${metrics.drawCalls} calls / ${metrics.triangles} triangles.`);
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});throw error}finally{await browser.close()}
