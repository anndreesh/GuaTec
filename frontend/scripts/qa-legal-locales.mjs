/** Exercise the actual legal entrypoint, including denied storage and another tab. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=new URL(process.env.APOLLO_QA_URL||'http://127.0.0.1:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Use a local Vite server.');
const out=resolve('artifacts/legal-locales');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
const errors=[],checks=[];
try{
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const blocked of [false,true]){
  const testContext=await browser.newContext();
  if(blocked)await testContext.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}}));
  const testPage=await testContext.newPage();testPage.on('pageerror',e=>errors.push(e.message));
  for(const [language,titles]of[
   ['es',['Política de privacidad','Términos y condiciones de uso','Contacto']],
   ['en',['Privacy policy','Terms and conditions of use','Contact']],
   ['fr',['Politique de confidentialité','Conditions générales d’utilisation','Contact']],
  ]){
   for(const [i,documentId]of ['privacy','terms','contact'].entries()){
    await testPage.goto(new URL(`/legal.html?document=${documentId}&lang=${language}`,base).href);
    await testPage.getByRole('heading',{level:1,name:titles[i],exact:true}).waitFor();
    assert.equal(await testPage.locator('html').getAttribute('lang'),language);
    assert.equal(await testPage.locator('.legal-nav [aria-current=page]').count(),1);
    assert.ok(await testPage.locator('.legal-sections').innerText());
    for(const href of await testPage.locator('.legal-nav a').evaluateAll(links=>links.map(a=>a.href)))assert.equal(new URL(href).searchParams.get('lang'),language);
   }
   checks.push(`${language}: three documents, storage ${blocked?'denied':'available'}`);
  }
  await testPage.setViewportSize({width:390,height:844});
  await testPage.getByRole('button',{name:'English',exact:true}).click();
  await testPage.getByRole('heading',{level:1,name:'Contact',exact:true}).waitFor();
  assert.equal(await testPage.locator('[data-language=en]').evaluate(el=>el===document.activeElement),true);
  assert.equal(new URL(testPage.url()).searchParams.get('lang'),'en');
  assert.equal(await testPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await testPage.screenshot({path:resolve(out,`mobile-storage-${blocked?'denied':'available'}.png`),fullPage:true});
  await testContext.close();
 }
 await page.goto(new URL('/legal.html?lang=en',base).href);
 const other=await context.newPage();await other.goto(new URL('/legal.html?lang=fr',base).href);
 await page.waitForFunction(()=>document.documentElement.lang==='fr');
 assert.equal(new URL(page.url()).searchParams.get('lang'),'fr');
 await page.getByRole('heading',{name:'Politique de confidentialité',exact:true}).waitFor();
 await other.evaluate(()=>localStorage.removeItem('mm.language'));
 await page.waitForFunction(()=>document.documentElement.lang==='es');
 await page.getByRole('heading',{name:'Política de privacidad',exact:true}).waitFor();
 checks.push('another tab updates rendered copy and URL; clearing the preference restores Spanish');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));
 console.log('PASS: '+checks.length+' legal locale checks, including 18 document loads and denied storage.');
}finally{await browser.close()}
