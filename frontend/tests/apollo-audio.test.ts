import test from 'node:test';
import assert from 'node:assert/strict';
import { ApolloAudio } from '../src/apollo/ApolloAudio';

/** Reproduces a browser rejecting a queued transition when navigation closes audio. */
class PendingContext {
  state: AudioContextState = 'suspended';
  requests: Array<(error: Error)=>void> = [];
  resumes=0;
  resume() { this.resumes++; return new Promise<void>((_,reject)=>this.requests.push(reject)); }
  suspend() { return new Promise<void>((_,reject)=>this.requests.push(reject)); }
  close() { this.state='closed';this.requests.forEach(reject=>reject(new Error('AudioContext closed before pending transition')));this.requests=[];return Promise.resolve(); }
}
const install = () => {
  const audio=new ApolloAudio(),context=new PendingContext();
  (audio as unknown as {ctx:AudioContext}).ctx=context as unknown as AudioContext;
  return {audio,context};
};
const settle = () => new Promise<void>(resolve=>setImmediate(resolve));

test('restarting consumes a pending audio resume rejection on teardown',async()=>{
  const {audio,context}=install();audio.pause(false);audio.dispose();await settle();
  assert.equal(context.resumes,1);assert.equal(context.state,'closed');
});
test('leaving a menu consumes a pending audio suspend rejection on teardown',async()=>{
  const {audio,context}=install();audio.pause(true);audio.dispose();await settle();
  assert.equal(context.state,'closed');audio.dispose();audio.pause(false);await settle();
});
test('start treats an intentionally closed context as completed teardown',async()=>{
  const {audio,context}=install();const starting=audio.start();audio.dispose();
  await assert.doesNotReject(starting);assert.equal(context.state,'closed');
});
test('pause does not request a resume after the context is already closed',()=>{
  const {audio,context}=install();context.state='closed';audio.pause(false);
  assert.equal(context.resumes,0);audio.dispose();
});
test('stand mode keeps interface audio running while the world bus is ducked',async()=>{
  const {audio,context}=install(),levels:number[]=[];
  (audio as unknown as {worldBus:unknown}).worldBus={gain:{setTargetAtTime:(value:number)=>levels.push(value)}};
  audio.pause(true,true);assert.equal(context.resumes,1);assert.deepEqual(levels,[0]);
  audio.pause(false);assert.deepEqual(levels,[0,1]);audio.dispose();await settle();
});
