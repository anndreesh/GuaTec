/** Actual guest flow against local Vite/API, with browser storage deliberately denied. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use local Vite and the local API.');
const out=resolve('artifacts/app-storage');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const checks=[],errors=[];
try{
 for(const mode of ['reads','writes']){
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(mode=>{
   if(mode==='reads')for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new DOMException('Storage blocked','SecurityError')}});
   else{Storage.prototype.setItem=function(){throw new DOMException('Storage full','QuotaExceededError')};Storage.prototype.removeItem=function(){throw new DOMException('Storage blocked','SecurityError')};}
  },mode);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base.href);await page.getByRole('button',{name:'Comenzar',exact:true}).click();await page.locator('.provider-guest').click();
  await page.locator('.username-screen input').fill('StorageQA'+Math.floor(Math.random()*1e8));await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  await page.getByText('Misión 01: Apollo 11',{exact:true}).click();await page.getByRole('button',{name:'Comenzar operaciones',exact:true}).click();await page.getByRole('button',{name:'Omitir introducción'}).click();
  await page.keyboard.down('Shift');await page.keyboard.down('a');await page.waitForTimeout(750);await page.keyboard.up('a');await page.keyboard.up('Shift');
  await page.getByRole('button',{name:'E · Banco de alimentación',exact:true}).click();
  for(const [item,slot]of [[1,0],[3,1],[0,2],[2,3]]){await page.locator(`[data-item="${item}"]`).click();await page.locator(`[data-slot="${slot}"]`).click();}
  const saved=page.waitForResponse(response=>response.url().includes('/api/progress/')&&response.request().method()==='PUT'&&response.status()===200&&response.request().postDataJSON()?.state?.apollo11?.bonusCompleted.includes('power-bus'));
  await page.getByRole('slider',{name:'Palanca de alimentación'}).focus();await page.keyboard.press('End');const cloud=await(await saved).json();
  await page.waitForFunction(()=>!document.querySelector('.ap-stand'));
  assert.ok(cloud.state.apollo11.bonusCompleted.includes('power-bus'),'Cloud saving works without local persistence.');
  await page.screenshot({path:resolve(out,mode+'-denied.png')});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:/Volver a misiones/}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  const unauthenticated=page.waitForRequest(request=>request.url().includes('/api/auth/providers'));
  await page.getByRole('button',{name:'Comenzar',exact:true}).click();
  assert.equal((await unauthenticated).headers().authorization,undefined,'Logout clears the volatile bearer token.');
  checks.push(mode+': actual guest, username, stand input, cloud save and logout');await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log('PASS: guest gameplay and cloud saving with denied reads and rejected writes.');
}finally{await browser.close()}
