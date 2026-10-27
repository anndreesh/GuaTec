import {ApolloState,BONUS_CHECKPOINTS,CHECKPOINTS,type ApolloSave} from './ApolloState';

export const APOLLO_OPERATION_ORDER= ['power-bus','orientation','flight-record','complex','telemetry-rack','umbilical-check','documentation','communications','crew-manifest','crew','weather-window','pad-safety','observation','launch','epilogue'] as const;

export function readApolloReportState(envelope:unknown):ApolloSave|null{
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))return null;
  const raw=(envelope as {apollo11?:unknown}).apollo11;
  if(!raw||typeof raw!=='object'||(raw as {version?:unknown}).version!=='apollo11-v1')return null;
  return new ApolloState(raw).toJSON();
}

export function apolloOperationLog(save:ApolloSave):{id:string;title:string;kind:'stand'|'checkpoint';completed:boolean}[]{
  return APOLLO_OPERATION_ORDER.map(id=>{
    const stand=BONUS_CHECKPOINTS.find(s=>s.id===id),checkpoint=CHECKPOINTS.find(cp=>cp.id===id);
    return{id,title:(stand??checkpoint)!.title,kind:stand?'stand':'checkpoint',completed:stand?save.bonusCompleted.includes(id):save.completed.includes(id)};
  });
}
