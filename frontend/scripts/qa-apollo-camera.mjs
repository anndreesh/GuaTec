/** Native mouse/touch orbit, complete rocket framing and interruption checks. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use local Vite.');
const out=resolve('artifacts/apollo-camera');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/apollo-camera-acceptance',route=>route.fulfill({contentType:'text/html',body:`
 <meta charset="utf-8"><style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="world"></div><script type="module">
 import {ApolloWorld} from '/src/apollo/ApolloWorld.ts';
 window.world=new ApolloWorld(document.querySelector('#world'),{onInteract(){},onMap(){}});await world.ready;
 window.angle=()=>Math.asin(world.camera.getWorldDirection(world.player.clone()).y)*180/Math.PI;
 window.rocketProjection=()=>[8.5,119.1].map(y=>world.player.clone().set(0,y,0).project(world.camera).toArray());
 window.reset=()=>{world.pitch=.22;world.yaw=0;world.setSuspended(false);world.setStandFocus(null);};
 let previous=performance.now();function frame(now){world.update((now-previous)/1000);previous=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);window.ready=true;
 </script>`}));
const drag=async(from,to)=>{await page.mouse.move(720,from);await page.mouse.down();await page.mouse.move(720,to,{steps:20});await page.mouse.up();await page.waitForTimeout(1000);};
try{
 await page.goto(new URL('/apollo-camera-acceptance',base).href);await page.waitForFunction(()=>window.ready,undefined,{timeout:60000});await page.waitForTimeout(900);
 const initial=await page.evaluate(()=>angle());assert.ok(initial<-4&&initial>-12);
 await drag(650,524);const full=await page.evaluate(()=>rocketProjection());assert.ok(full.every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1&&p[2]<1),'Both ends of the Saturn V fit in the view after an upward drag.');
 await page.screenshot({path:resolve(out,'complete-saturn-v.png')});checks.push({fullRocket:full});
 await drag(750,100);const sky=await page.evaluate(()=>angle());assert.ok(sky>55&&sky<70);checks.push({maximumSkyAngle:sky});
 await page.mouse.move(700,400);await page.mouse.down();await page.evaluate(()=>world.setSuspended(true));assert.equal(await page.evaluate(()=>world.lastPointer),null);
 await page.mouse.move(1000,650);await page.mouse.up();await page.evaluate(()=>world.setSuspended(false));const yaw=await page.evaluate(()=>world.yaw);await page.mouse.move(1100,680);assert.equal(await page.evaluate(()=>world.yaw),yaw);checks.push('Suspension releases the orbit and returning does not resume a stale drag.');
 await page.evaluate(()=>reset());await page.waitForTimeout(700);await page.mouse.move(720,500);await page.mouse.down({button:'right'});await page.mouse.move(1000,550);await page.mouse.up({button:'right'});assert.equal(await page.evaluate(()=>world.yaw),0);checks.push('Secondary mouse buttons do not rotate the camera.');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>reset());
 const cdp=await page.context().newCDPSession(page),touch=(x,y,id)=>({x,y,id});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(180,500,1)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(180,430,1)]});const before=await page.evaluate(()=>({pitch:world.pitch,yaw:world.yaw}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(180,430,1),touch(300,250,2)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(180,430,1),touch(340,120,2)]});assert.deepEqual(await page.evaluate(()=>({pitch:world.pitch,yaw:world.yaw})),before);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.evaluate(()=>world.lastPointer),null);await cdp.detach();checks.push('Native touch: a second finger cannot steal the orbit; cancel releases it.');
 await page.waitForTimeout(900);await page.screenshot({path:resolve(out,'mobile-sky.png')});assert.deepEqual(errors,[]);
 await writeFile(resolve(out,'report.json'),JSON.stringify({initial,sky,checks,errors},null,2));console.log('PASS: full rocket, sky angle, suspension, mouse buttons and native multi-touch.');
}finally{await browser.close()}
