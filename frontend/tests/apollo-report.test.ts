import test from 'node:test';
import assert from 'node:assert/strict';
import {ApolloState,CHECKPOINTS,BONUS_CHECKPOINTS} from '@/apollo/ApolloState';
import {APOLLO_OPERATION_ORDER,apolloOperationLog,readApolloReportState} from '@/apollo/ApolloOperationLog';

test('the report timeline follows the fifteen mandatory operations accepted by the actual mission rules',()=>{
  const state=new ApolloState();
  assert.equal(new Set(APOLLO_OPERATION_ORDER).size,15);
  assert.deepEqual(new Set(APOLLO_OPERATION_ORDER),new Set([...CHECKPOINTS,...BONUS_CHECKPOINTS].map(item=>item.id)));
  for(const id of APOLLO_OPERATION_ORDER){
    if(BONUS_CHECKPOINTS.some(stand=>stand.id===id))assert.equal(state.completeBonus(id),true,id);
    else{assert.equal(state.current.id,id);for(const action of state.current.actions)assert.equal(state.act(action.id),true,id+' / '+action.id);}
  }
  const report=readApolloReportState({apollo11:state.toJSON()})!,operations=apolloOperationLog(report);
  assert.equal(report.done,true);assert.equal(operations.filter(item=>item.completed).length,15);
  assert.equal(operations.filter(item=>item.kind==='stand').length,7);
});

test('partial and invalid report snapshots cannot fabricate completed operations or mutate the saved state',()=>{
  const state=new ApolloState();state.completeBonus('power-bus');const save=state.toJSON();
  const restored=readApolloReportState({apollo11:save})!;assert.equal(apolloOperationLog(restored).filter(item=>item.completed).length,1);
  restored.bonusCompleted.push('flight-record');assert.deepEqual(save.bonusCompleted,['power-bus']);
  const corrupt=readApolloReportState({apollo11:{...save,checkpoint:99,done:true,completed:CHECKPOINTS.map(c=>c.id),bonusCompleted:BONUS_CHECKPOINTS.map(b=>b.id)}})!;
  assert.equal(apolloOperationLog(corrupt).filter(item=>item.completed).length,0);
  for(const value of[null,[],{},save,{apollo11:{version:'mission-01-engineering'}}])assert.equal(readApolloReportState(value),null);
});
