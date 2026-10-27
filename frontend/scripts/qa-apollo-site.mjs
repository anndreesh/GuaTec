/** Inspect actual authored work yards and their collision/navigation contract. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('Use a local Vite server.');
const out=resolve('artifacts/apollo-site');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/apollo-site-acceptance',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`
 <meta charset="utf-8"><style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}*{box-sizing:border-box}#label{position:fixed;left:24px;top:24px;padding:10px 18px;color:#ece5cc;background:#122a30e8;font:14px system-ui;letter-spacing:.1em}</style><div id="world"></div><div id="label"></div>
 <script type="module">
 import {ApolloWorld} from '/src/apollo/ApolloWorld.ts';
 import {SITE_PLOTS,SITE_WALKWAYS,SITE_ZONES,zoneBounds} from '/src/apollo/ApolloSiteLayout.ts';
 window.world=new ApolloWorld(document.querySelector('#world'),{onInteract(){},onMap(){}});await world.ready;world.setSuspended(true);world.update(0);
 window.plots=SITE_PLOTS;window.zones=SITE_ZONES;
 window.inspectCollisions=()=>{
   const blocked=[];for(const plot of SITE_PLOTS){if(!world.canMove(plot.target.x,plot.target.z+4.7))blocked.push({id:plot.id,approach:plot.target})}
   for(const points of SITE_WALKWAYS)for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(a.x-b.x,a.z-b.z);for(let d=0;d<=length;d+=.5){const x=a.x+(b.x-a.x)*d/length,z=a.z+(b.z-a.z)*d/length;if(!world.canMove(x,z))blocked.push({walkway:i,x,z})}}
   return blocked;
 };
 window.framePlot=(id,mobile=false)=>{const plot=SITE_PLOTS.find(p=>p.id===id),{x,z}=plot.target;world.playerRoot.visible=false;world.camera.position.set(x+(mobile?5.5:4),mobile?3.3:3.2,z+(mobile?8:6));world.camera.lookAt(x,1.4,z-.1);world.camera.fov=50;world.camera.updateProjectionMatrix();document.querySelector('#label').textContent=id.toUpperCase();world.renderer.render(world.scene,world.camera);return world.diagnostics()};
 window.frameYard=id=>{const zone=SITE_ZONES.find(z=>z.id===id),area=zoneBounds(zone.members);world.playerRoot.visible=false;world.camera.position.set(area.x+area.width*.65,20,area.z+area.depth*.8+18);world.camera.lookAt(area.x,0,area.z);world.camera.fov=50;world.camera.updateProjectionMatrix();document.querySelector('#label').textContent=id.toUpperCase();world.renderer.render(world.scene,world.camera)};
 window.ready=true;
 </script>`}));
try{
 await page.goto(new URL('/apollo-site-acceptance',base).href);await page.waitForFunction(()=>window.ready,undefined,{timeout:60000});
 assert.deepEqual(await page.evaluate(()=>world.assetErrors),[]);
 assert.deepEqual(await page.evaluate(()=>inspectCollisions()),[],'World collisions leave every approach and walkway open.');
 const plots=await page.evaluate(()=>window.plots.map(p=>p.id)),diagnostics={};
 for(const id of plots){diagnostics[id]=await page.evaluate(id=>framePlot(id),id);await page.screenshot({path:resolve(out,'model-'+id+'.png')});}
 for(const id of await page.evaluate(()=>window.zones.map(z=>z.id))){await page.evaluate(id=>frameYard(id),id);await page.screenshot({path:resolve(out,'yard-'+id+'.png')});}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>world.setQuality('medium'));
 for(const id of['power-bus','telemetry-rack','weather-window']){diagnostics['mobile-'+id]=await page.evaluate(id=>framePlot(id,true),id);await page.screenshot({path:resolve(out,'mobile-'+id+'.png')});}
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({plots,errors,diagnostics},null,2));
 console.log('PASS: '+plots.length+' station approaches, shared walkways and 22 captured desktop/mobile views.');
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});throw error}finally{await browser.close()}
