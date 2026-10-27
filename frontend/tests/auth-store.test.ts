import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthStore} from '@/core/AuthStore';
import {ApiClient} from '@/core/ApiClient';

function withStorage(storage:()=>unknown,run:()=>void|Promise<void>){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get:storage});
  const restore=()=>{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');};
  try{const result=run();if(result instanceof Promise)return result.finally(restore);restore();}
  catch(error){restore();throw error;}
}
test('a denied storage getter preserves only the live account session and logout clears it',()=>withStorage(()=>{throw new Error('SecurityError');},()=>{
  AuthStore.setToken('fixture-session');AuthStore.setCachedUsername('Visitor');AuthStore.setPendingOAuthEmail('fixture@example.invalid');
  assert.equal(AuthStore.getToken(),'fixture-session');assert.equal(AuthStore.getCachedUsername(),'Visitor');assert.equal(AuthStore.getPendingOAuthEmail(),'fixture@example.invalid');
  AuthStore.clearToken();AuthStore.clearPendingOAuthEmail();assert.equal(AuthStore.getToken(),null);assert.equal(AuthStore.getPendingOAuthEmail(),null);
}));
test('rejected writes do not revive an older persisted token or lose a new login',()=>{
  const stored=new Map([['mm.authToken','expired-fixture']]);
  return withStorage(()=>({getItem:(key:string)=>stored.get(key)??null,setItem(){throw new Error('QuotaExceededError')},removeItem(){throw new Error('SecurityError')}}),()=>{
    AuthStore.setToken('new-fixture');assert.equal(AuthStore.getToken(),'new-fixture');
    AuthStore.clearToken();assert.equal(AuthStore.getToken(),null);assert.equal(stored.get('mm.authToken'),'expired-fixture');
  });
});
test('available storage reflects external session changes instead of caching an old login',()=>{
  const stored=new Map<string,string>();
  return withStorage(()=>({getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)}),()=>{
    AuthStore.setToken('first-fixture');assert.equal(stored.get('mm.authToken'),'first-fixture');
    stored.set('mm.authToken','other-tab-fixture');assert.equal(AuthStore.getToken(),'other-tab-fixture');
    stored.delete('mm.authToken');assert.equal(AuthStore.getToken(),null);
  });
});
test('API calls use the volatile login and stop sending it after logout',async()=>{
  const previousFetch=globalThis.fetch,headers:Array<Record<string,string>>=[];
  globalThis.fetch=async(_url,init)=>{headers.push(init!.headers as Record<string,string>);return new Response('{}',{headers:{'Content-Type':'application/json'}})};
  try{await withStorage(()=>{throw new Error('SecurityError');},async()=>{
    AuthStore.setToken('volatile-fixture');await ApiClient.get('/user/me');
    AuthStore.clearToken();await ApiClient.get('/auth/providers');
    assert.equal(headers[0].Authorization,'Bearer volatile-fixture');assert.equal(headers[1].Authorization,undefined);
  });}finally{globalThis.fetch=previousFetch;}
});
