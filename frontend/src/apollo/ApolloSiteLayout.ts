import {BONUS_CHECKPOINTS, CHECKPOINTS} from './ApolloState';
import type {StandModelKind} from './ApolloStandDesigns';
export type SitePoint={x:number;z:number};
export type SiteRect=SitePoint&{width:number;depth:number};

/** Map and world consume the same roads; the access road ends before the pedestrian yard. */
export const SITE_ROADS:readonly {from:SitePoint;to:SitePoint;width:number;shoulder:number}[]=[
  {from:{x:0,z:40},to:{x:0,z:355},width:16,shoulder:24},
  {from:{x:-95,z:150},to:{x:95,z:150},width:12,shoulder:22},
  {from:{x:-110,z:235},to:{x:110,z:235},width:12,shoulder:22},
  {from:{x:-75,z:355},to:{x:75,z:355},width:12,shoulder:22},
];
const historicalKinds:readonly StandModelKind[]=['orientation','survey','records','radio','crew','tracking'];
export const SITE_PLOTS=[
  ...CHECKPOINTS.slice(0,6).map((cp,i)=>({id:cp.id,target:cp.target,kind:historicalKinds[i]!})),
  ...BONUS_CHECKPOINTS.map(stand=>({id:stand.id,target:stand.target,kind:stand.kind as StandModelKind})),
];
export const SITE_ZONES:readonly {id:string;members:readonly string[]}[]=[
  {id:'arrival',members:['orientation','power-bus']},
  {id:'survey',members:['complex','flight-record']},
  {id:'engineering',members:['documentation','telemetry-rack','umbilical-check']},
  {id:'communications',members:['communications']},
  {id:'crew',members:['crew','crew-manifest']},
  {id:'range',members:['observation','weather-window','pad-safety']},
];
export function zoneBounds(members:readonly string[]):SiteRect {
  const plots=SITE_PLOTS.filter(plot=>members.includes(plot.id));
  if(!plots.length)throw Error('A work area must contain at least one plot.');
  const left=Math.min(...plots.map(p=>p.target.x))-7,right=Math.max(...plots.map(p=>p.target.x))+7;
  const back=Math.min(...plots.map(p=>p.target.z))-6,front=Math.max(...plots.map(p=>p.target.z))+6;
  return{x:(left+right)/2,z:(back+front)/2,width:right-left,depth:front-back};
}

/** Walkways run along the working side and around equipment, never through a desk.
 * Each chain joins a road to a work yard; the short branch links the cable panel. */
export const SITE_WALKWAYS:readonly (readonly SitePoint[])[]=[
  [{x:-28,z:144},{x:-28,z:140},{x:-49,z:140}],
  [{x:-60,z:156},{x:-60,z:188},{x:-66,z:188}],
  [{x:-77,z:229},{x:-77,z:225},{x:-100,z:225}],
  [{x:-100,z:225},{x:-106,z:225},{x:-106,z:206},{x:-100,z:206}],
  [{x:76,z:241},{x:76,z:257},{x:70,z:257}],
  [{x:-18,z:156},{x:-18,z:193},{x:-25,z:193}],
  [{x:0,z:361},{x:0,z:384},{x:-36,z:384}],
  [{x:0,z:384},{x:15,z:384}],
];

export function pointOnRoad(point:SitePoint,padding=0):boolean {
  return SITE_ROADS.some(road=>{
    const half=road.width/2+padding;
    return point.x>=Math.min(road.from.x,road.to.x)-(road.from.x===road.to.x?half:0)
      &&point.x<=Math.max(road.from.x,road.to.x)+(road.from.x===road.to.x?half:0)
      &&point.z>=Math.min(road.from.z,road.to.z)-(road.from.z===road.to.z?half:0)
      &&point.z<=Math.max(road.from.z,road.to.z)+(road.from.z===road.to.z?half:0);
  });
}
