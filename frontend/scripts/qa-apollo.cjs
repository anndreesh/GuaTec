// Compiled-build end-to-end harness. Captures instance by patching its module only inside this browser.
// No production hooks or bypass UI are shipped. Station travel uses real held WASD input.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
const dir=path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname,'../../artifacts/apollo11'));fs.mkdirSync(dir,{recursive:true});
let activeBrowser,activePage;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--autoplay-policy=no-user-gesture-required']});
 activeBrowser=browser;
 const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:path.join(dir,'motion'),size:{width:960,height:600}}});
 const page=await ctx.newPage();activePage=page; const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('requestfailed',r=>failed.push(r.url()));
 await page.addInitScript(()=>localStorage.setItem('mm.language','es'));
 await page.goto(base); await page.waitForSelector('.splash-screen,.mission-card');
 if(!await page.locator('.mission-card').count()) {
  await page.getByRole('button',{name:'Comenzar',exact:true}).click();await page.locator('.provider-guest').click();
  await page.locator('.username-screen input').fill('ApolloQA'+Math.floor(Math.random()*1e8));await page.locator('.username-screen button').click();
 }
 const entry=await page.locator('script[type="module"][src]').first().getAttribute('src');
 const source=await(await page.request.get(new URL(entry,base).href)).text();const module=source.match(/ApolloScreen-[A-Za-z0-9_-]+\.js/)?.[0];assert.ok(module,'Apollo lazy chunk exists');
 await page.evaluate(async url=>{const m=await import(url),mount=m.ApolloScreen.prototype.mount;m.ApolloScreen.prototype.mount=function(...args){window.q=this;return mount.apply(this,args);}},new URL('/assets/'+module,base).href);
 await page.locator('.mission-card').first().click();await page.getByRole('button',{name:'Comenzar operaciones',exact:true}).waitFor({timeout:60000});
 await page.screenshot({path:path.join(dir,'welcome.png')});await page.getByRole('button',{name:'Comenzar operaciones',exact:true}).click();
 await page.getByRole('button',{name:'Omitir introducción'}).click();await page.waitForTimeout(1400);
 await page.screenshot({path:path.join(dir,'active-desktop.png')});
 console.log('loaded',JSON.stringify(await page.evaluate(()=>q.diagnostics())));
 const gpu=await page.evaluate(()=>{const gl=q.world.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}});
 const activePerf={};for(const quality of ['low','medium','high']){await page.evaluate(v=>{q.quality=v;q.world.setQuality(v);q.frameTimes=[];},quality);await page.waitForTimeout(6000);activePerf[quality]=await page.evaluate(()=>q.diagnostics());}
 await page.screenshot({path:path.join(dir,'active-high.png')});
 await page.evaluate(()=>q.world.setQuality('medium'));
 console.log('active profiles',JSON.stringify(activePerf));
 await page.keyboard.press('m');await page.getByRole('button',{name:'Volver a operaciones',exact:true}).click();
 await page.keyboard.press('e');await page.getByRole('button',{name:'Reconocer el Saturn V',exact:true}).click();
 await page.getByRole('button',{name:'Space Shuttle',exact:true}).click();assert.equal(await page.evaluate(()=>q.state.checks.includes('landmark')),false);
 await page.getByRole('button',{name:'Saturn V · AS-506',exact:true}).click();await page.getByRole('button',{name:'Llegar a orientación',exact:true}).click();
 assert.equal(await page.evaluate(()=>q.state.checkpoint),1);
 async function go(x,z){
  for(let tries=0;tries<90;tries++){
   const p=await page.evaluate(()=>({x:q.world.player.x,z:q.world.player.z}));const dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);if(dist<10)return;
   await page.evaluate(({dx,dz})=>{q.world.yaw=Math.atan2(-dx,-dz);},{dx,dz});
   await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForTimeout(Math.min(800,Math.max(80,dist/8*1000)));await page.keyboard.up('w');await page.keyboard.up('Shift');
  } throw Error('Real-input travel stuck '+x+','+z+' '+JSON.stringify(await page.evaluate(()=>q.world.player)));
 }
 async function task(label,answer){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:answer,exact:true}).click();}
 await go(-70,165);await page.keyboard.press('e');
 await task('Examinar la torre umbilical','Torre de servicio umbilical');await task('Identificar la plataforma 39A','39A');await task('Localizar el VAB','Vehicle Assembly Building (VAB)');
 await page.getByRole('button',{name:'Hablar con el técnico',exact:true}).click();await page.getByRole('button',{name:'Registrar conversación',exact:true}).click();assert.equal(await page.evaluate(()=>q.state.checkpoint),2);
 await go(-100,220);await page.keyboard.press('e');await task('Revisar el registro','AS-506');
 // Partial task survives serialized backend save and app re-entry.
 await page.evaluate(()=>q.save());await page.getByRole('button',{name:'Regresar al recorrido',exact:true}).click();
 const saved=await page.evaluate(()=>q.state.toJSON());assert.ok(saved.checks.includes('log'));
 await page.getByRole('button',{name:'Pausa',exact:true}).click();await page.getByRole('button',{name:'Guardar y volver a misiones',exact:true}).click();await page.locator('.mission-card').first().click();await page.getByRole('button',{name:'Continuar misión',exact:true}).click();assert.equal(await page.evaluate(()=>q.state.checkpoint),2);assert.deepEqual(await page.evaluate(()=>q.state.checks),['log']);
 console.log('partial resume passed');
 await taskAfterOpen();
 async function taskAfterOpen(){await page.keyboard.press('e');await task('Confirmar el informe','LC-39A · 09:32 EDT');await task('Registrar la identificación','Cinco');}
 await go(70,235);await page.keyboard.press('e');await task('Reconocer las antenas','Comunicación por radio');await task('Identificar la señal','APOYO TERRESTRE → LC-39A → RECIBIDO');await task('Comunicar estación lista','Estación de apoyo lista');assert.equal(await page.evaluate(()=>q.state.checkpoint),4);
 await go(0,150);await page.keyboard.press('e');await page.waitForTimeout(5000);await page.screenshot({path:path.join(dir,'crew-transfer.png')});
 await page.waitForFunction(()=>q.movieTime>=24,{},{timeout:40000});await page.screenshot({path:path.join(dir,'crew-blackout.png')});
 await page.waitForFunction(()=>q.state.checkpoint===5,{},{timeout:12000});
 await go(0,355);await page.keyboard.press('e');await task('Preparar la cámara','Encuadrar la plataforma desde el área segura');await task('Confirmar audio','Confirmar recepción del canal de apoyo');await task('Solicitar autorización','Solicitar autorización de observación');
 assert.equal(await page.evaluate(()=>q.state.checkpoint),6);assert.equal(await page.evaluate(()=>q.world.player.z),5600);
 await page.keyboard.press('e');await page.waitForTimeout(7000);await page.screenshot({path:path.join(dir,'countdown.png')});await page.waitForTimeout(12000);await page.screenshot({path:path.join(dir,'launch.png')});
 await page.waitForFunction(()=>q.state.checkpoint===7,{},{timeout:70000});await page.screenshot({path:path.join(dir,'epilogue.png')});
 const perf={};for(const quality of ['low','medium','high']){await page.evaluate(v=>{q.quality=v;q.world.setQuality(v);q.closeModal();q.frameTimes=[];},quality);await page.waitForTimeout(5500);perf[quality]=await page.evaluate(()=>q.diagnostics());}
 await page.evaluate(()=>q.showEnd());await page.getByRole('button',{name:'Completar misión y regresar',exact:true}).click();await page.locator('.mission-card').first().waitFor();
 assert.ok(await page.locator('.mission-card').first().textContent().then(x=>x.includes('Completada')));
 await page.locator('.mission-card').first().click();await page.getByRole('button',{name:'Ver epílogo',exact:true}).waitFor({timeout:60000});
 const recovered=await page.evaluate(()=>q.state.toJSON());assert.equal(recovered.done,true);assert.equal(recovered.completed.length,8);
 await page.getByRole('button',{name:'Ver epílogo',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'epilogue-narrow.png')});
 await page.evaluate(()=>q.closeModal());await page.keyboard.press('Escape');await page.getByRole('button',{name:'Reiniciar solo Misión 01',exact:true}).click();await page.getByRole('button',{name:'Reiniciar Apollo 11',exact:true}).click();await page.getByRole('button',{name:'Comenzar operaciones',exact:true}).waitFor({timeout:60000});assert.equal(await page.evaluate(()=>q.state.completed.length),0);
 await page.getByRole('button',{name:'Comenzar operaciones',exact:true}).click();await page.getByRole('button',{name:'Omitir introducción'}).click();await page.waitForTimeout(1000);await page.screenshot({path:path.join(dir,'active-narrow.png')});
 await page.evaluate(()=>{q.world.yaw=0;});await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForTimeout(6500);await page.keyboard.up('w');await page.keyboard.up('Shift');const blocked=await page.evaluate(()=>({x:q.world.player.x,z:q.world.player.z,checkpoint:q.state.checkpoint}));assert.ok(blocked.z>=100);assert.equal(blocked.checkpoint,0);
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(dir,'restricted-boundary.png')});
 const result={errors,failed,gpu,activePerf,perf,recovered,partialSave:saved,partialResume:true,restart:true,restrictedBoundary:blocked,fullProgression:true,realInputTravel:true,viewport:[1440,900],completedAt:new Date().toISOString()};
 fs.writeFileSync(path.join(dir,'qa.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 await ctx.close();await browser.close();if(errors.length)process.exitCode=1;
})().catch(async e=>{console.error(e);await activePage?.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});await activeBrowser?.close();process.exitCode=1});
