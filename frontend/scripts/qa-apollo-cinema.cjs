// Focused cinematic fixtures, separate from the real-input end-to-end playthrough.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:4173',dir=path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname,'../../artifacts/apollo11'));
let browser,page;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined});
 const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:path.join(dir,'cinema-motion'),size:{width:960,height:600}}});page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Comenzar',exact:true}).click();await page.locator('.provider-guest').click();await page.locator('.username-screen input').fill('CinemaQA'+Math.floor(Math.random()*1e8));await page.locator('.username-screen button').click();
 const entry=await page.locator('script[type="module"][src]').first().getAttribute('src'),source=await(await page.request.get(new URL(entry,base).href)).text();const module=source.match(/ApolloScreen-[A-Za-z0-9_-]+\.js/)[0];
 await page.evaluate(async url=>{const m=await import(url),mount=m.ApolloScreen.prototype.mount;m.ApolloScreen.prototype.mount=function(...args){window.q=this;return mount.apply(this,args);}},new URL('/assets/'+module,base).href);
 await page.locator('.mission-card').first().click();await page.getByRole('button',{name:'Comenzar operaciones',exact:true}).click();await page.waitForTimeout(800);await page.screenshot({path:path.join(dir,'intro-black.png')});
 assert.equal(await page.locator('.language-menu').evaluate(n=>getComputedStyle(n).visibility),'hidden');
 await page.waitForFunction(()=>q.movie===null,{},{timeout:45000});assert.equal(await page.evaluate(()=>q.state.checkpoint),0);
 const audioState=await page.evaluate(()=>({state:q.audio.ctx?.state,muted:q.audio.muted}));assert.equal(audioState.state,'running');
 await page.evaluate(()=>{q.world.player.set(25,0,130);q.world.yaw=0;});await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForTimeout(4000);await page.keyboard.up('w');await page.keyboard.up('Shift');
 const boundary=await page.evaluate(()=>({x:q.world.player.x,z:q.world.player.z}));assert.ok(boundary.z>=100 && boundary.z<102);
 await page.evaluate(()=>{q.world.player.set(-125,0,225);q.world.yaw=0;});await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForTimeout(2500);await page.keyboard.up('w');await page.keyboard.up('Shift');
 const building=await page.evaluate(()=>({x:q.world.player.x,z:q.world.player.z}));assert.ok(building.z>=211 && building.z<214);
 // Assemble a valid stage fixture using its own FSM, without shipping test hooks.
 await page.evaluate(()=>{while(q.state.checkpoint<4){for(const action of [...q.state.current.actions])q.act(action.id);}q.world.player.set(0,0,150);q.beginMovie('crew');});
 await page.waitForTimeout(5000);await page.screenshot({path:path.join(dir,'crew-transfer.png')});
 await page.waitForFunction(()=>q.movieTime>=26,{},{timeout:30000});await page.screenshot({path:path.join(dir,'crew-blackout.png')});
 assert.equal(await page.locator('.ap-cinema').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(0, 0, 0)');
 await page.waitForFunction(()=>q.state.checkpoint===5,{},{timeout:10000});
 assert.equal(await page.locator('.language-menu').evaluate(n=>getComputedStyle(n).visibility),'visible');
 assert.equal(await page.evaluate(()=>q.world.assetErrors.length),0);
 fs.writeFileSync(path.join(dir,'cinema-qa.json'),JSON.stringify({errors,audioState,boundary,building,introComplete:true,crewBlackout:true,languageControlRestored:true,diagnostics:await page.evaluate(()=>q.diagnostics())},null,2));
 await ctx.close();await browser.close();if(errors.length)process.exitCode=1;
})().catch(async error=>{console.error(error);await page?.screenshot({path:path.join(dir,'cinema-failure.png')}).catch(()=>{});await browser?.close();process.exitCode=1;});
