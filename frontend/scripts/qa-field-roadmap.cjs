// Full guest progression through the compiled game. Optional Playwright is supplied by the QA environment.
// QA_BASE_URL, QA_OUTPUT_DIR, PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE configure the runner.
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const dir=require('node:path').resolve(process.env.QA_OUTPUT_DIR || 'artifacts/browser-qa');
fs.mkdirSync(dir,{recursive:true});
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await browser.newContext({viewport:{width:1440,height:900},...(process.env.QA_STORAGE_STATE ? {storageState:process.env.QA_STORAGE_STATE} : {})}); const page=await ctx.newPage();
 const pendingRequests=new Map();page.on('request',r=>{if(r.url().includes('/api/'))pendingRequests.set(r.url(),Date.now())});page.on('requestfinished',r=>pendingRequests.delete(r.url()));page.on('requestfailed',r=>pendingRequests.delete(r.url()));
 const errors=[];page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('mm.language','es'));
 await page.goto(base);
 await page.waitForSelector('.splash-screen, .mission-card');
 if(!(await page.locator('.mission-card').count())) {
   await page.getByRole('button',{name:'Comenzar',exact:true}).click();
   await page.locator('.provider-guest').click({timeout:120000});
   await page.locator('.username-screen input').fill('MissionQA'+Math.floor(Math.random()*1000000));
   await page.locator('.username-screen button').click();
 }
 // Capture the screen instance inside this test browser only. No test hook is shipped.
 const entry=await page.locator('script[type="module"][src]').first().getAttribute('src');
 const source=await (await page.request.get(new URL(entry,base).href)).text();
 const module=source.match(/Mission1Screen-[A-Za-z0-9_-]+\.js/)?.[0];
 if(!module) throw Error('Run this harness against a production build/preview');
 await page.evaluate(async(url)=>{const m=await import(url);const mount=m.Mission1Screen.prototype.mount;m.Mission1Screen.prototype.mount=function(...args){window.q=this;return mount.apply(this,args)}},new URL('/assets/'+module,base).href);
 await page.locator('.mission-card').first().click();
 await page.waitForFunction(()=>window.q?.gameplay);
 await page.waitForTimeout(3500);
 if(await page.locator('.mission-opening-start').count()) {await page.locator('.mission-opening-start').click(); await page.locator('.tutorial-card button').click();}
 console.log('start',await page.evaluate(()=>({objectives:[...q.state.objectives],position:q.mapState?.player,diag:q.gameplay.getDiagnostics()})));
 async function chooseFirst(){await page.locator('.modal-overlay:not(.modal-overlay--hidden) .modal-options button').first().click();}
 async function go(){
  await page.locator('.field-minimap').click();
  const walk=page.locator('.mission-map-route-button.btn-primary');
  const target=await walk.getAttribute('data-poi-id');
  console.log('walking to',target);
  await walk.click();
  await page.waitForFunction(id=>q.nearbyPoi?.id===id,target,{timeout:60000});
  await page.waitForTimeout(250);await page.keyboard.press('e');await page.waitForTimeout(100);
 }
 async function setRange(locator,value){await locator.focus();await page.keyboard.press('Home');for(let i=0;i<value;i++)await page.keyboard.press('ArrowRight');}
 async function confirmTask(){const btn=page.locator('.mission-task-actions .btn-primary');await btn.click();}
 async function solveField(kind) {
  await page.waitForSelector(`[data-field-task="${kind}"]`);
  if(kind==='assembly') {
   await page.locator('[data-part="0"]').click();await page.locator('[data-socket="1"]').click();
   if(await page.locator('.mission-task-actions .btn-primary').isEnabled())throw Error('Wrong assembly passed');
   await page.locator('[data-socket="0"]').click();
   // Language refresh must preserve a partial task and reopen it.
   const before=await page.evaluate(()=>q.state.fieldDrafts.assembly.placements.slice());
   await page.locator('.language-menu-trigger').click();await page.locator('.language-option').nth(2).click();
   await page.waitForFunction(()=>window.q?.activeFieldTask==='assembly');
   if(JSON.stringify(before)!==JSON.stringify(await page.evaluate(()=>q.state.fieldDrafts.assembly.placements)))throw Error('Language refresh lost draft');
   await page.locator('.language-menu-trigger').click();await page.locator('.language-option').nth(0).click();await page.waitForSelector('[data-field-task=assembly]');
   for(const [i,turns] of [[1,1],[2,0],[3,2]]){await page.locator(`[data-part="${i}"]`).click();for(let n=0;n<turns;n++)await page.locator('.field-task__rotate').click();await page.locator(`[data-socket="${i}"]`).click();}
  } else if(kind==='mass') {
   await page.locator('.field-task__record').click();
   for(const [i,slot] of [[0,0],[1,1],[3,2]]){await page.locator(`[data-weight="${i}"]`).click();await page.locator(`[data-arm="${slot}"]`).click();}
   await page.locator('.field-task__record').click();
  } else if(kind==='calibration') {
   await page.locator('[data-record-dial="0"]').click();
   for(const [i,value] of [32,58,76].entries()){await setRange(page.locator(`[data-dial="${i}"]`),value);await page.locator(`[data-record-dial="${i}"]`).click();}
  } else if(kind==='signal') {
   await page.locator('[data-signal-node="2"]').click();
   for(const node of [0,1,3,5])await page.locator(`[data-signal-node="${node}"]`).click();
  } else if(kind==='weather') {
   await page.locator('[data-weather-record]').click();
   const weather=await page.evaluate(()=>q.gameplay.getWeather());
   const target={CLEAR:22,CLOUDY:40,'LIGHT MIST':58,WINDY:82}[weather];
   await setRange(page.locator('.field-task--weather input'),target);
   await page.locator(`[data-weather="${weather==='CLEAR'?'stable':weather==='WINDY'?'adverse':'changing'}"]`).click();
   await page.locator('[data-weather-record]').click();
  }
  await page.screenshot({path:dir+`/${kind}-validated.png`});await confirmTask();
 }
 try {
  if(!(await page.evaluate(()=>q.state.objectives.has('lab')))){await go(); await chooseFirst();}
  if(!(await page.evaluate(()=>q.state.objectives.has('discover')))){
   await go();
   const before=await page.evaluate(()=>q.state.objectives.has('discover'));
   await page.keyboard.press('Escape');
   if(before||await page.evaluate(()=>q.state.objectives.has('discover'))) throw Error('Dialogue granted premature credit');
   await page.keyboard.press('e');await chooseFirst();await chooseFirst();
  }
  for(let i=0;i<3&&!(await page.evaluate(()=>q.state.teamMet()));i++){await go();await chooseFirst();}
  if(!(await page.evaluate(()=>q.state.objectives.has('prototype')))){await go();await chooseFirst();}
  await page.screenshot({path:dir+'/mission-field-desktop.png'});
  console.log('field',await page.evaluate(()=>({objectives:[...q.state.objectives],diag:q.gameplay.getDiagnostics()})));
  for(const id of ['assembly','mass'])if(!(await page.evaluate(id=>q.state.fieldResults.has(id),id))){await go();await solveField(id);}
  if(!(await page.evaluate(()=>q.state.objectives.has('design')))){
   await go();
   await page.locator('[data-group="instrumentation"][data-value="balanced"]').click();
   await setRange(page.locator('.mission-design-balance-slider'),68);
   await page.locator('.mission-task-readout').click(); await confirmTask();
  }
  for(const id of ['calibration','signal'])if(!(await page.evaluate(id=>q.state.fieldResults.has(id),id))){await go();await solveField(id);}
  await go();
  if(!(await page.evaluate(()=>q.state.testsRun.has('system')))) {
   await chooseFirst();
   const startPos=await page.evaluate(()=>q.mapState.player);
   await page.keyboard.press('w',{delay:300});
   const stopPos=await page.evaluate(()=>q.mapState.player);
   if(Math.hypot(startPos.x-stopPos.x,startPos.z-stopPos.z)>.02) throw Error('World moves beneath task');
   await page.getByRole('button',{name:'3 · Registrar respuesta',exact:true}).click();
   if(await page.locator('.mission-task-actions .btn-primary').isEnabled())throw Error('Invalid propulsion passed');
   await page.getByRole('button',{name:'1 · Acoplar simulador',exact:true}).click();
   await setRange(page.getByRole('slider',{name:'Presión simulada',exact:true}),60);
   await setRange(page.getByRole('slider',{name:'Respuesta térmica simulada'}),40);
   await page.getByRole('button',{name:'3 · Registrar respuesta',exact:true}).click();
   await page.screenshot({path:dir+'/propulsion-validated.png'}); await confirmTask();
  }
  if(!(await page.evaluate(()=>q.state.testsRun.has('instrumentation')))) {
   await page.locator('.modal-options button').nth(1).click();
   await page.getByRole('button',{name:'Origen I · A',exact:true}).click();
   await page.getByRole('button',{name:'Destino II · B',exact:true}).click();
   if(await page.locator('.mission-task-actions .btn-primary').isEnabled())throw Error('Wrong circuit passed');
   await page.keyboard.press('Escape');
   if(await page.evaluate(()=>q.state.testsRun.has('instrumentation')))throw Error('Cancellation granted credit');
   await go();await page.locator('.modal-options button').nth(1).click();
   const labels=['I · A','II · B','III · C','IV · D'];
   // First wire through a real pointer drag, remaining wires through keyboard activation.
   const source=page.getByRole('button',{name:'Origen I · A',exact:true});const dest=page.getByRole('button',{name:'Destino I · A',exact:true});
   const sb=await source.boundingBox(), db=await dest.boundingBox();
   await page.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2);await page.mouse.down();await page.mouse.move(db.x+db.width/2,db.y+db.height/2,{steps:12});await page.mouse.up();
   for(const label of labels.slice(1)){await page.getByRole('button',{name:'Origen '+label,exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Destino '+label,exact:true}).focus();await page.keyboard.press('Enter');}
   await page.screenshot({path:dir+'/circuits-validated.png'});await confirmTask();
  }
  if(!(await page.evaluate(()=>q.state.testsRun.has('communications')))) {
   await page.locator('.modal-options button').nth(2).click();
   await page.getByRole('button',{name:'Fijar señal',exact:true}).click();
   if(await page.locator('.mission-task-actions .btn-primary').isEnabled())throw Error('Bad antenna passed');
   await setRange(page.getByRole('slider',{name:'Orientación del captador'}),42);
   await setRange(page.getByRole('slider',{name:'Sintonía del registrador'}),64);
   await page.getByRole('button',{name:'Fijar señal',exact:true}).click();
   await page.screenshot({path:dir+'/antenna-validated.png'});await confirmTask();
  }
  if(!(await page.evaluate(()=>q.state.testsRun.has('stability')))) {
   await page.locator('.modal-options button').nth(3).click();await page.locator('.mission-wave-choice').nth(1).click();await confirmTask();await chooseFirst();
  }
  await go();
  if(!(await page.evaluate(()=>q.state.engineeringTasks.has('diagnosis')))) {
   for(const name of ['A · Entrada','B · Registro','C · Salida'])await page.getByRole('button',{name,exact:true}).click();
   await page.getByRole('button',{name:'Aislar módulo seleccionado',exact:true}).click();
   if(await page.getByRole('slider',{name:'Inserción del recambio'}).isEnabled())throw Error('Healthy module isolated');
   await page.getByRole('button',{name:'B · Registro',exact:true}).click();await page.getByRole('button',{name:'Aislar módulo seleccionado',exact:true}).click();
   await page.getByRole('slider',{name:'Inserción del recambio'}).focus();await page.keyboard.press('End');
   await page.screenshot({path:dir+'/diagnosis-validated.png'});await confirmTask();
  }
  for(const item of await page.locator('.mission-evidence-chip').all()) await item.click();
  const expected=await page.evaluate(()=>q.state.expectedDiagnosis());
  const diagnosisLabels={'System configuration':'Configuración del sistema','Structural balance':'Equilibrio estructural','Instrumentation':'Instrumentación','Mass distribution':'Distribución de masa'};
  await page.getByRole('button',{name:diagnosisLabels[expected],exact:true}).click();await page.locator('.mission-diagnosis-verify').click();await confirmTask();
  for(let i=0;i<3&&!await page.evaluate(()=>q.state.fieldResults.has('route'));i++)await go();
  if(!await page.evaluate(()=>q.state.fieldResults.has('weather'))){await go();await solveField('weather');}
  await go();await chooseFirst();
  const relays=page.locator('.engineering-task__relays button');
  await relays.nth(0).click();
  if(await page.locator('.engineering-task__seal').isEnabled())throw Error('Unverified launch seal enabled');
  for(const i of [1,3,0,2])await relays.nth(i).click();
  await page.locator('.engineering-task__seal').focus();await page.keyboard.down('Enter');await page.waitForTimeout(300);await page.keyboard.up('Enter');
  if(await page.locator('.mission-task-actions .btn-primary').isEnabled())throw Error('Short hold passed');
  await page.keyboard.down('Enter');await page.waitForTimeout(1350);await page.keyboard.up('Enter');
  await page.screenshot({path:dir+'/launch-validated.png'});await confirmTask();await chooseFirst();
  await go();await chooseFirst();
  await page.waitForTimeout(13000);await page.screenshot({path:dir+'/launch-flight.png'});
  await page.waitForSelector('.mission-cinematic-transition[data-phase="black-hold"]',{timeout:60000});await page.screenshot({path:dir+'/launch-blackout.png'});await page.waitForFunction(()=>q.state.objectives.has('flight')&&!q.cinematicTransition,{},{timeout:120000});
  console.log('FLIGHT',await page.evaluate(()=>({objectives:[...q.state.objectives],tasks:[...q.state.engineeringTasks],diag:q.gameplay.getDiagnostics()})));
  await go();
  for(const [index,topic] of ['Propulsion & Pressure Data','Structural & Frame Data','Smoked Drum Flight Record'].entries()) {
    if(await page.evaluate(t=>q.state.analyzed.has(t),topic)) continue;
    await page.locator('.modal-options button').nth(index).click();
    if(index===0){await setRange(page.locator('.mission-gauge-slider'),68);await page.locator('.mission-task-readout').click();}
    if(index===1)await page.locator('.mission-wave-choice').nth(0).click();
    if(index===2){
     await page.locator('.flight-recovery__register').click();
     for(const id of ['distance','peak','liftoff','recorder']){await page.locator(`[data-record="${id}"] .flight-recovery__handle`).focus();await page.keyboard.press('Home');}
     await page.locator('.flight-recovery__register').click();
    }
    await confirmTask();
  }
  await page.locator('.modal-options button').nth(3).click();
  const completed=await page.evaluate(()=>({complete:q.state.isComplete(),objectives:[...q.state.objectives],tasks:[...q.state.engineeringTasks],fieldResults:[...q.state.fieldResults.values()],diagnostics:q.gameplay.getDiagnostics()}));
  if(!completed.complete || completed.tasks.length!==5 || completed.fieldResults.length!==7)throw Error('Mission completion invalid');
  await page.locator('.mission-ending-card button').click();
  await page.waitForSelector('.report-screen',{timeout:120000});await page.waitForTimeout(400);
  await page.screenshot({path:dir+'/mission-report.png'});
  if(errors.length)throw Error('Console/page errors: '+errors.join(' | '));
  fs.writeFileSync(dir+'/progression-results.json',JSON.stringify({base,...completed,errors},null,2));
  console.log('PASS · full mission, seven field experiments, five existing tasks, recovered drafts, blackout, report');
 }catch(e){console.error(e);console.log('PENDING', [...pendingRequests].map(([url,time])=>({route:new URL(url).pathname,seconds:(Date.now()-time)/1000})));console.log('STATE',await page.evaluate(()=>({ended:q?.ended,pending:q?.pendingAutosaves?.size})));console.log('BODY',(await page.locator('body').innerText()).slice(-4500));await page.screenshot({path:dir+'/qa-failure.png'});process.exitCode=1}
 await browser.close();
})();
