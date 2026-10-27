import type {ApolloBonusKind} from './ApolloState';

export type StandModelKind = ApolloBonusKind | 'orientation' | 'survey' | 'records' | 'radio' | 'crew' | 'tracking';
type StandDesign = {
  silhouette: string;
  width: number;
  depth: number;
  deskX: number;
  canopy: 'none' | 'clerk' | 'dispatch';
};

/** Shared construction language; deliberately different massing and working surfaces.
 * Dimensions also drive collision proxies so removed awnings leave no invisible posts. */
export const STAND_DESIGNS: Readonly<Record<StandModelKind, StandDesign>> = {
  sequence: {silhouette:'switchboard',width:3.15,depth:1.55,deskX:0,canopy:'none'},
  'flight-plan': {silhouette:'drafting-table',width:3.6,depth:1.5,deskX:0,canopy:'none'},
  telemetry: {silhouette:'crt-console-and-rack',width:3.2,depth:1.6,deskX:0,canopy:'none'},
  cables: {silhouette:'patch-frame',width:3.1,depth:1.3,deskX:0,canopy:'none'},
  'crew-manifest': {silhouette:'registration-kiosk',width:2.9,depth:1.5,deskX:0,canopy:'clerk'},
  weather: {silhouette:'instrument-cart-and-mast',width:2.5,depth:1.3,deskX:0,canopy:'none'},
  beacons: {silhouette:'range-safety-desk',width:2.2,depth:1.25,deskX:0,canopy:'none'},
  orientation: {silhouette:'map-lectern',width:2.8,depth:1.5,deskX:0,canopy:'none'},
  survey: {silhouette:'survey-theodolite',width:2.2,depth:1.15,deskX:.65,canopy:'none'},
  records: {silhouette:'field-records-office',width:3.4,depth:1.5,deskX:0,canopy:'dispatch'},
  radio: {silhouette:'radio-receiver-and-aerial',width:2.9,depth:1.4,deskX:0,canopy:'none'},
  crew: {silhouette:'crew-equipment-rack',width:3.6,depth:1.5,deskX:0,canopy:'none'},
  tracking: {silhouette:'film-tracking-camera',width:2.05,depth:1.15,deskX:.75,canopy:'none'},
};

export function standIndicatorPosition(kind:StandModelKind):{x:number;y:number;z:number}{
  const design=STAND_DESIGNS[kind];
  return{x:design.deskX+design.width/2-.18,y:1.33,z:design.depth/2-.10};
}

export const standHasIdentityPost=(kind:StandModelKind):boolean=>!['telemetry','radio','cables','sequence','orientation'].includes(kind);
export const standUsesPower=(kind:StandModelKind):boolean=>['sequence','telemetry','radio','cables','records','crew-manifest'].includes(kind);
