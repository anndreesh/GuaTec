import { restoreInstrumentDraft, type InstrumentKind, type InstrumentDraft } from './ApolloInstrumentRules';
/** Instrument drafts cannot confer clearance; only the mission FSM stores earned actions. */
export const FIELD_INSTRUMENTS: Readonly<Partial<Record<number,InstrumentKind>>> = {0:'survey',1:'survey',2:'records',3:'signal',5:'tracking'};
export type FieldDrafts = Record<string,InstrumentDraft>;
export function fieldDraftKey(checkpoint:number,kind:InstrumentKind) { return `${checkpoint}:${kind}`; }
export function restoreFieldDrafts(value:unknown,checkpoint:number):FieldDrafts {
  if(!value || typeof value!=='object' || Array.isArray(value))return {};
  const kind=FIELD_INSTRUMENTS[checkpoint];if(!kind)return {};
  const key=fieldDraftKey(checkpoint,kind),raw=(value as Record<string,unknown>)[key];
  if(!raw || typeof raw!=='object')return {};
  try {if(JSON.stringify(raw).length>16000)return {};}catch{return {};}
  return {[key]:restoreInstrumentDraft(kind,raw)};
}
