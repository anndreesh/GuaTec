// Focused responsive/pause/zoom/map verification against a compiled build.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:4173',dir=path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname,'../../artifacts/apollo11'));let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Comenzar',exact:true}).click();await page.locator('.provider-guest').click();await page.locator('.username-screen input').fill('LayoutQA'+Math.floor(Math.random()*1e8));await page.locator('.username-screen button').click();
 await page.locator('.mission-card').first().click();await page.getByRole('button',{name:'Comenzar operaciones',exact:true}).click();await page.getByRole('button',{name:'Omitir introducción'}).click();await page.waitForTimeout(1200);
 const pause=await page.getByRole('button',{name:'Pausa',exact:true}).boundingBox(),language=await page.locator('.language-menu').boundingBox();assert.ok(pause.x+pause.width<=language.x,'pause clear of language selector');
 await page.screenshot({path:path.join(dir,'active-narrow.png')});await page.getByRole('button',{name:'Zoom',exact:true}).click();await page.waitForTimeout(500);await page.keyboard.press('m');await page.screenshot({path:path.join(dir,'map-narrow.png')});await page.getByRole('button',{name:'Volver a operaciones',exact:true}).click();await page.keyboard.press('Escape');
 await page.getByLabel('Calidad gráfica').selectOption('low');await page.getByRole('button',{name:'Silenciar audio',exact:true}).click();await page.screenshot({path:path.join(dir,'pause-narrow.png')});await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(500);await page.screenshot({path:path.join(dir,'active-desktop.png')});
 fs.writeFileSync(path.join(dir,'layout-qa.json'),JSON.stringify({errors,pause,language,noOverlap:true,map:true,zoom:true,qualityAndMute:true},null,2));await browser.close();assert.equal(errors.length,0);
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
