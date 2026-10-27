import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {STAND_DESIGNS, standIndicatorPosition, standHasIdentityPost, standUsesPower, type StandModelKind} from './ApolloStandDesigns';
import {CABLE_CHANNELS,CABLE_TARGET_ORDER} from './ApolloStandRules';
export type {StandModelKind} from './ApolloStandDesigns';

export type StandMaterialFactory = (name: string, color: number, roughness?: number, metalness?: number) => THREE.MeshStandardMaterial;
export interface StandMovingPart { node:THREE.Group; axis:'y'|'z'; speed:number; activity:'weather'|'tracking' }

/** Ground-plane proxies are kept separate from the visual mesh batches. */
export function standCollisionProxies(kind: StandModelKind, x: number, z: number): {x:number;z:number;w:number;d:number}[] {
  const design=STAND_DESIGNS[kind];
  const colliders=[{x:x+design.deskX,z,w:design.width/2+.06,d:design.depth/2+.06}];
  if(design.canopy!=='none')for(const dx of[-1.88,1.88])colliders.push({x:x+dx,z:z-1.2,w:.09,d:.09});
  if(standHasIdentityPost(kind))colliders.push({x:x-1.5,z:z-1.02,w:.05,d:.05});
  if(kind==='telemetry')colliders.push({x:x+2.02,z:z-.35,w:.4,d:.4});
  if(kind==='sequence')colliders.push({x:x+2.12,z:z-.35,w:.4,d:.48});
  if(kind==='flight-plan')colliders.push({x:x-2.35,z:z-.85,w:.4,d:.3});
  if(kind==='radio')colliders.push({x:x+2.25,z:z-.85,w:.12,d:.12});
  if(kind==='weather')colliders.push({x:x+2.35,z:z-.72,w:.12,d:.12},{x:x-2.35,z:z-.55,w:.28,d:.28});
  if(kind==='beacons')for(const dx of[-2.25,0,2.25])colliders.push({x:x+dx,z:z-1.6,w:.2,d:.2});
  if(kind==='survey'||kind==='tracking')colliders.push({x:x-2.13,z:z-.05,w:.4,d:.5});
  return colliders;
}

/** One shared instrument atlas. Printed labels, meter scales, paper and phosphor displays
 * share a texture instead of allocating a canvas for each dial or console. */
export function createStandAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const c = canvas.getContext('2d')!;
  const titles = ['GROUND SUPPORT / 1969', 'VOLTAGE / DC', 'SIGNAL / RF', 'CONTINUITY / BUS', 'FLIGHT OPERATIONS', 'CREW / AS-506', 'WEATHER / RANGE', 'RANGE SAFETY', 'OPTICAL SURVEY', 'FIELD RECORD', 'VOICE / UHF', 'TRACKING / 39A', 'LC-39A / KENNEDY', 'FLIGHT PLAN / 16 JUL', 'S-IVB / TELEMETRY', 'PAD / TELEMETRY'];
  for (let index = 0; index < 16; index++) {
    const x = index % 4 * 256, y = Math.floor(index / 4) * 256;
    c.save(); c.translate(x, y);
    const paper = [4, 5, 9, 13].includes(index);
    c.fillStyle = paper ? '#d9ceb0' : '#142c30'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = paper ? '#796d52' : '#708b80'; c.lineWidth = 2; c.strokeRect(9, 9, 238, 238);
    c.fillStyle = paper ? '#303c37' : '#e3c68e'; c.font = '600 13px monospace'; c.fillText(titles[index]!, 19, 31);
    c.fillStyle = paper ? '#74674c' : '#8bb9a4'; c.font = '10px monospace'; c.fillText('APOLLO 11    •    AS-506', 19, 48);
    if ([1, 6].includes(index)) {
      c.fillStyle = '#e2d9be'; c.beginPath(); c.arc(128, 151, 86, Math.PI, 0); c.lineTo(214, 189); c.lineTo(42, 189); c.fill();
      c.strokeStyle = '#394a43'; c.lineWidth = 2;
      for (let tick = 0; tick <= 10; tick++) {
        const a = Math.PI + tick * Math.PI / 10;
        c.beginPath(); c.moveTo(128 + Math.cos(a) * 69, 151 + Math.sin(a) * 69); c.lineTo(128 + Math.cos(a) * 79, 151 + Math.sin(a) * 79); c.stroke();
      }
      c.strokeStyle = '#af4a34'; c.lineWidth = 4; c.beginPath(); c.moveTo(128, 154); c.lineTo(151, 94); c.stroke();
      c.fillStyle = '#34433b'; c.font = '12px monospace'; c.fillText(index === 6 ? 'RANGE WX' : index === 1 ? '28 V DC' : 'S-BAND', 92, 178);
    } else if (index === 3) {
      // Isolated label tiles for physical terminals, legible without color cues.
      CABLE_CHANNELS.forEach((letter,i)=>{
        c.fillStyle='#e2d9be';c.fillRect(i*64+5,104,54,64);
        c.fillStyle='#243d3c';c.font='bold 43px monospace';c.textAlign='center';
        c.fillText(letter,i*64+32,151);
      });
    } else if ([2, 7, 10, 11, 14, 15].includes(index)) {
      c.strokeStyle = '#39665b'; c.lineWidth = 1;
      for (let t = 0; t <= 6; t++) { c.beginPath(); c.moveTo(23, 72 + t * 23); c.lineTo(232, 72 + t * 23); c.stroke(); }
      c.strokeStyle = '#9bc7a3'; c.lineWidth = 2; c.beginPath();
      for (let t = 0; t < 210; t++) {
        const py = index===14 ? 150-Math.exp(-(((t-64)/19)**2))*43+Math.sin(t*.18)*5
          : index===15 ? 140+(Math.floor(t/30)%2?18:-18)
          : 140 + Math.sin(t * .12) * 25 * Math.sin(t * .025);
        t ? c.lineTo(23 + t, py) : c.moveTo(23, py);
      } c.stroke();
      c.fillStyle = '#b2d2b0'; c.font = '11px monospace'; c.fillText(index===14?'S-IVB     CH 01':index===15?'PAD       CH 03':'LINK      CH 02', 24, 220);
    } else {
      c.strokeStyle = paper ? '#a49a7b' : '#45635a'; c.lineWidth = 1;
      for (let row = 0; row < 6; row++) {
        c.strokeRect(23, 70 + row * 22, 10, 10);
        c.fillStyle = paper ? '#59624e' : '#91ac96'; c.fillRect(44, 73 + row * 22, 100 + (row % 3) * 30, 2);
      }
      c.fillStyle = paper ? '#8e4937' : '#ddbc79'; c.font = 'bold 14px monospace'; c.fillText('16 JUL 1969', 23, 228);
    }
    c.restore();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** Human-scale authored stations. Static parts are merged per shared material; each
 * station retains its own bounds so distant desks can be culled independently. */
export function buildStandModel(kind: StandModelKind, mat: StandMaterialFactory, atlas: THREE.Texture, index: number, animated = false): THREE.Group {
  const root = new THREE.Group(); root.name = `apollo-stand-${kind}`;
  const movingParts:StandMovingPart[]=[];root.userData.movingParts=movingParts;
  const design=STAND_DESIGNS[kind];root.userData.silhouette=design.silhouette;
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const paint = mat('stand-painted-enamel', 0x627c73, .57, .12);
  const cream = mat('stand-ivory-enamel', 0xd5ceaf, .65, .05);
  const steel = mat('stand-brushed-steel', 0x879b99, .36, .78);
  const dark = mat('stand-rubber-bakelite', 0x17282a, .84, .04);
  const amber = mat('stand-safety-ochre', 0xca984b, .6, .08);
  const red = mat('stand-red-insulation', 0x9e4c39, .71, .03);
  const paper = mat('stand-paper', 0xdad1b4, .94);
  const copper = mat('stand-copper', 0xa77951, .47, .68);
  const display = mat('stand-instrument-atlas', 0xffffff, .65, .05); display.map = atlas;
  const put = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone(); nonIndexed.applyMatrix4(transform); geometry.dispose();
    const list = batches.get(material) ?? []; list.push(nonIndexed); batches.set(material, list);
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, ry = 0) => put(new THREE.BoxGeometry(w, h, d), material, x, y, z, 0, ry);
  const cyl = (r: number, h: number, material: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => put(new THREE.CylinderGeometry(r, r, h, 12), material, x, y, z, rx, 0, rz);
  const tube = (points: number[][], radius: number, material: THREE.Material) => put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2]))), 18, radius, 6, false), material, 0, 0, 0);
  const sheet = (cell: number, w: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0) => {
    const geometry = new THREE.PlaneGeometry(w, h), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cell % 4 + .025 + uv.getX(i) * .95) / 4, (3 - Math.floor(cell / 4) + .025 + uv.getY(i) * .95) / 4);
    put(geometry, display, x, y, z, rx, ry);
  };
  const terminalLabel=(letter:typeof CABLE_CHANNELS[number],x:number,y:number)=>{
    const geometry=new THREE.PlaneGeometry(.17,.20),uv=geometry.getAttribute('uv'),column=CABLE_CHANNELS.indexOf(letter);
    // Cell 3 occupies x=768..1024, y=0..256 in the shared 1024 atlas.
    for(let i=0;i<uv.count;i++)uv.setXY(i,(768+column*64+4+uv.getX(i)*56)/1024,1-(168-uv.getY(i)*64)/1024);
    put(geometry,display,x,y,-.46);
  };
  const beveled = (w: number, h: number, depth: number, material: THREE.Material, x: number, y: number, z: number) => {
    const s = new THREE.Shape(), r = .09;
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    put(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 1, steps: 1, curveSegments: 3 }), material, x, y, z);
  };
  const meter = (x: number, y: number, z: number, cell = 1) => { beveled(.63, .53, .1, dark, x, y, z); sheet(cell, .54, .45, x, y, z + .128); };
  const knob = (x: number, y: number, z: number, r = .08) => {
    // A mounting washer, radial grip flutes and a raised index, all in existing batches.
    cyl(r * 1.16, .018, steel, x, y, z - .045, Math.PI / 2);
    cyl(r, .095, dark, x, y, z, Math.PI / 2);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      put(new THREE.BoxGeometry(r*.18,r*.28,.074),dark,x+Math.sin(a)*r,y+Math.cos(a)*r,z,0,0,-a);
    }
    box(r*.17,r*.7,.012,cream,x,y+r*.3,z+.052);
  };
  const handle = (x:number,y:number,z:number,w=.34,h=.10) => {
    // Raised bail leaves an actual gap behind the grip instead of a solid bar.
    for(const dx of[-w/2,w/2]){
      box(.055,.07,.02,steel,x+dx,y,z);
      cyl(.018,.035,dark,x+dx,y,z+.02,Math.PI/2);
    }
    tube([[x-w/2,y,z+.035],[x-w/2,y+h,z+.065],[x+w/2,y+h,z+.065],[x+w/2,y,z+.035]],.016,steel);
  };
  const caseHardware = (w:number,h:number,d:number,x:number,y:number,z:number) => {
    const seamY=y+h*.27,front=z+d+.03;
    box(w,.014,.016,dark,x,seamY,front);
    for(const side of[-1,1]){
      box(.014,.014,d,dark,x+side*(w/2+.026),seamY,z+d/2);
      // Two rear hinge leaves and a horizontal pin joining lid to body.
      box(.12,.11,.018,steel,x+side*w*.3,seamY,z-.032);
      cyl(.023,.15,steel,x+side*w*.3,seamY,z-.05,0,Math.PI/2);
      box(.055,.11,.028,steel,x+side*w*.31,seamY,front+.016);
      box(.031,.035,.018,dark,x+side*w*.31,seamY-.018,front+.036);
    }
    handle(x,y+h*.36,front,.36,.07);
  };
  const multimeter = (x:number) => {
    // Portable analogue test set: recessed scale, rotary range selector and two
    // separate socket-to-probe leads. It stays on the existing electrical bench.
    beveled(.46,.57,.16,dark,x,1.49,.05);
    box(.39,.49,.018,cream,x,1.49,.243);
    sheet(1,.34,.24,x,1.61,.254);knob(x,1.39,.282,.065);
    handle(x,1.79,.12,.29,.07);
    for(const side of[-1,1]){
      const insulation=side===1?red:dark,sz=side===1?.57:.40;
      cyl(.032,.026,copper,x+side*.125,1.285,.266,Math.PI/2);
      cyl(.018,.038,insulation,x+side*.125,1.285,.282,Math.PI/2);
      tube([[x+side*.125,1.285,.302],[x-.32+side*.035,1.22,.35],[x-.30,1.20,sz],[x-.08,1.20,sz]],.012,insulation);
      cyl(.025,.20,insulation,x+.02,1.20,sz,0,Math.PI/2);
      cyl(.035,.022,insulation,x+.12,1.20,sz,0,Math.PI/2);
      cyl(.009,.13,steel,x+.195,1.20,sz,0,Math.PI/2);
      for(let i=0;i<3;i++)cyl(.028,.009,dark,x-.04+i*.05,1.20,sz,0,Math.PI/2);
    }
  };
  const clipboard = (x: number, y: number, z: number, cell = 9, angle = -.12) => {
    box(.65, .035, .83, dark, x, y, z, angle); sheet(cell, .59, .77, x, y + .023, z, -Math.PI / 2,angle); box(.24, .028, .07, steel, x-Math.sin(angle)*.32, y + .04, z-Math.cos(angle)*.32,angle);
  };
  const tools = (cx=.92) => {
    // A real open jaw and ring eye, ridged screwdriver grip and hinged pliers.
    // The tray lip separates tools from the enamel instead of intersecting it.
    box(.88,.035,.54,dark,cx,1.185,.39);
    for(const dz of[-.265,.265])box(.9,.06,.025,steel,cx,1.21,.39+dz);
    for(const dx of[-.44,.44])box(.025,.06,.54,steel,cx+dx,1.21,.39);
    const outline=new THREE.Shape();
    const points=[[-.25,-.065],[.11,-.045],[.18,-.12],[.29,-.12],[.32,-.06],[.23,-.075],[.19,-.01],[.23,.045],[.32,.02],[.29,.10],[.18,.12],[.10,.045],[-.25,.065]];
    points.forEach(([x,y],i)=>i?outline.lineTo(x!,y!):outline.moveTo(x!,y!));outline.closePath();
    const eye=new THREE.Path();eye.absarc(-.21,0,.034,0,Math.PI*2,true);outline.holes.push(eye);
    put(new THREE.ExtrudeGeometry(outline,{depth:.018,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:1,steps:1,curveSegments:8}),steel,cx-.10,1.23,.25,-Math.PI/2,0,.10);
    cyl(.044,.19,amber,cx-.20,1.24,.55,0,Math.PI/2);
    cyl(.009,.25,steel,cx+.02,1.24,.55,0,Math.PI/2);box(.055,.012,.023,steel,cx+.17,1.24,.55);
    for(let i=0;i<4;i++)cyl(.046,.008,dark,cx-.27+i*.04,1.24,.55,0,Math.PI/2);
    for(const side of[-1,1]){
      tube([[cx+.28,1.245,.39],[cx+.1,1.245,.39+side*.06],[cx-.02,1.245,.39+side*.075]],.022,red);
      tube([[cx+.28,1.245,.39],[cx+.35,1.245,.39+side*.04],[cx+.40,1.245,.39+side*.025]],.015,steel);
    }cyl(.033,.035,steel,cx+.28,1.255,.39);
  };
  // Base, skids, tactile edge and an open working side; no decorative loose cargo.
  box(5.6,.10,4,cream,0,.02,0);box(5.4,.025,.07,dark,0,.085,1.8);
  const hazard=['sequence','cables','beacons'].includes(kind);
  for(let i=0;i<(hazard?10:2);i++)box(.17,.025,.07,hazard?amber:steel,hazard?-2.4+i*.53:-2.4+i*4.8,.10,1.8,-.35);
  const half=design.width/2-.16,tx=design.deskX,depth=design.depth;
  for(const x of[tx-half,tx+half]){
    box(.08,.96,.08,steel,x,.62,-depth/2+.12);box(.08,.96,.08,steel,x,.62,depth/2-.12);
    box(.18,.07,depth+.12,dark,x,.16,.04);
    if(kind==='weather')for(const z of[-depth/2+.12,depth/2-.12]){cyl(.095,.075,dark,x,.15,z,0,Math.PI/2);cyl(.035,.085,steel,x,.15,z,0,Math.PI/2);}
  }
  box(design.width,.11,depth,dark,tx,1.04,.04);box(design.width-.04,.055,depth-.04,paint,tx,1.12,.04);
  box(design.width-.25,.04,.045,steel,tx,1.17,depth/2+.025);box(design.width-.3,.07,.07,steel,tx,.37,-depth/2+.08);
  const tile = ({ sequence: 1, telemetry: 2, cables: 3, 'flight-plan': 13, 'crew-manifest': 5, weather: 6, beacons: 7, orientation: 12, survey: 8, records: 9, radio: 10, crew: 5, tracking: 11 })[kind];
  // Only the two paperwork offices need sun awnings. Instruments use open frames,
  // a lectern, a drafting table or a mobile cart rather than thirteen identical roofs.
  if(design.canopy!=='none'){
    const roofY=design.canopy==='dispatch'?2.95:2.7;
    for(const x of[-1.88,1.88])box(.065,roofY-.14,.065,steel,x,roofY/2,-1.2);
    box(4,.065,1.4,design.canopy==='clerk'?cream:paint,0,roofY,-.85);
    for(let i=0;i<9;i++)box(.025,.08,1.4,steel,-1.84+i*.46,roofY+.04,-.85);
    box(4,.16,.045,dark,0,roofY-.08,-.15);
  }
  if(standHasIdentityPost(kind)){
    box(.04,2.12,.04,steel,-1.50,1.15,-1.02);
    beveled(.87,.48,.025,dark,-1.50,2.18,-1.02);sheet(tile,.78,.39,-1.50,2.18,-.955);
  }
  for(const x of[tx-half,tx+half])for(const z of[-depth/2+.12,depth/2-.12])cyl(.027,.025,steel,x,1.165,z);
  const indicator=standIndicatorPosition(kind);
  cyl(.075,.10,dark,indicator.x,1.23,indicator.z);cyl(.085,.025,steel,indicator.x,1.29,indicator.z);
  if (kind === 'sequence') {
    // Vertical switchboard, ceramic cartridges, knife-switch grip and vented transformer.
    beveled(2.6,1.22,.24,paint,-.12,1.85,-.65);meter(-.86,2.06,-.38,1);
    box(1.1,.10,.07,copper,.48,2.24,-.35);box(1.1,.10,.07,copper,.48,1.6,-.35);
    for(let i=0;i<4;i++){
      const x=-.37+i*.36;
      cyl(.05,.33,cream,x,1.9,-.27);cyl(.066,.06,copper,x,1.73,-.27);cyl(.066,.06,copper,x,2.07,-.27);
      for(let ring=0;ring<3;ring++)cyl(.057,.014,steel,x,1.82+ring*.055,-.27);
    }
    cyl(.07,.10,steel,1.02,1.83,-.3,Math.PI/2);cyl(.025,.43,steel,.92,2.0,-.18,0,-.48);cyl(.065,.20,red,.82,2.20,-.18,0,Math.PI/2);
    beveled(.68,1.35,.65,paint,2.12,.85,-.64);
    caseHardware(.68,1.35,.65,2.12,.85,-.64);
    for(let i=0;i<7;i++)box(.51,.025,.025,dark,2.12,.42+i*.14,.04);
    tube([[1.72,.35,-.5],[1.55,.18,-.9],[.8,.15,-.9],[.4,.45,-.6]],.035,red);
    tools(.6);multimeter(-1.02);
  } else if(kind==='telemetry') {
    // Three recessed CRT faces, control shelf and a full-height tape/data rack.
    beveled(2.95,.95,.45,paint,0,1.72,-.66);
    for(let i=0;i<3;i++){
      const x=-.96+i*.96;meter(x,1.84,-.18,[14,2,15][i]!);knob(x-.18,1.39,-.11,.075);knob(x+.15,1.39,-.11,.05);
      box(.78,.06,.18,dark,x,2.15,-.13);
    }
    beveled(.73,2.23,.61,dark,2.02,1.31,-.70);
    // Rack ears, repeated fixings and pull handles make the removable modules read.
    for(const x of[1.68,2.36]){
      box(.035,1.53,.035,steel,x,1.10,-.055);
      for(let i=0;i<10;i++)cyl(.012,.014,dark,x,.40+i*.145,-.032,Math.PI/2);
    }
    for(let i=0;i<5;i++){
      const y=.5+i*.24;
      box(.63,.22,.06,paint,2.02,y,-.055);knob(2.23,y,-.015,.035);
      handle(1.91,y-.025,.002,.20,.05);
      for(let vent=0;vent<4;vent++)box(.014,.07,.012,dark,2.07+vent*.035,y,.009);
    }
    for(const x of[1.85,2.18]){
      cyl(.17,.06,steel,x,2.11,-.02,Math.PI/2);cyl(.055,.075,dark,x,2.11,.022,Math.PI/2);
      for(let n=0;n<3;n++)put(new THREE.BoxGeometry(.025,.25,.014),dark,x,2.11,.025,0,0,n*Math.PI*2/3);
    }
    tube([[1.25,1.2,-.5],[1.55,.6,-.6],[1.75,.3,-.45],[2,.32,-.3]],.025,dark);
    clipboard(-.3,1.19,.24,2,.08);
  } else if(kind==='radio') {
    // A stacked receiver/transmitter, speaker grille and a wired handset.
    beveled(2.5,.59,.48,cream,-.12,1.56,-.64);beveled(2.22,.42,.43,paint,-.25,2.08,-.61);
    for(const x of[-1.12,.87])handle(x,2.04,-.145,.12,.11);
    for(const x of[-1.24,1.0])for(const y of[1.34,1.78])cyl(.022,.018,steel,x,y,-.125,Math.PI/2);
    sheet(10,1.24,.30,-.55,2.08,-.15);knob(.63,2.07,-.12,.12);
    meter(-.83,1.57,-.13,2);knob(-.17,1.57,-.10,.10);
    for(let i=0;i<8;i++)box(.025,.36,.018,dark,.2+i*.085,1.57,-.12);
    tube([[.3,1.19,.46],[.46,1.45,.30],[.9,1.46,.24],[1.04,1.18,.15]],.035,dark);
    cyl(.12,.10,dark,.33,1.21,.46,Math.PI/2);cyl(.12,.10,dark,1.02,1.21,.15,Math.PI/2);
    tube([[.85,1.18,-.50],[.84,1.65,-.4],[1.08,1.75,-.2]],.018,steel);cyl(.065,.16,dark,1.12,1.75,-.15,Math.PI/2);
    cyl(.035,3.24,steel,2.25,1.72,-.85);box(1.05,.035,.035,steel,2.25,3.0,-.85);
    for(const dx of[-.38,0,.38])box(.025,.025,.65,steel,2.25+dx,3,-.85);
    box(.3,.065,.24,dark,-.7,1.2,.37);box(.18,.045,.08,copper,-.7,1.25,.37);
  } else if (kind === 'cables') {
    // Braced patch frame with two rows of ferrules and cables dropping into a tray.
    beveled(2.7,1.10,.14,cream,-.05,1.78,-.64);
    for(const x of[-1.39,1.29]){box(.065,1.25,.065,steel,x,1.75,-.7);tube([[x,1.3,-.4],[x,2.3,-.72],[x,.35,-1.3]],.025,steel);}
    for (let i = 0; i < 4; i++) {
      const x = -1 + i * .64;
      for(const y of[1.62,2.0]){
        box(.25,.23,.025,steel,x,y,-.485);
        cyl(.095,.08,dark,x,y,-.43,Math.PI/2);cyl(.052,.10,copper,x,y,-.38,Math.PI/2);
        put(new THREE.TorusGeometry(.044,.012,6,12),steel,x,y,-.316);
        // Recessed socket mouth and two screw heads distinguish the hardware
        // from a painted dot without changing terminal labels or cable order.
        cyl(.025,.012,dark,x,y,-.318,Math.PI/2);
        for(const dx of[-.101,.101]){
          cyl(.014,.014,dark,x+dx,y,-.463,Math.PI/2);
          box(.017,.004,.004,steel,x+dx,y,-.454);
        }
      }
      terminalLabel(CABLE_CHANNELS[i]!,x,2.20);terminalLabel(CABLE_TARGET_ORDER[i]!,x,1.81);
      tube([[x,2,-.3],[x-.13,1.64,-.1],[x+.16,1.34,.04],[x+.12,1.21,.39]],.022,i%2?dark:red);
      cyl(.035,.15,copper,x+.12,1.21,.39,Math.PI/2);
    }
    box(2.7,.10,.19,dark,-.05,1.29,-.15);tools(.57);multimeter(-.94);
  } else if(kind==='flight-plan') {
    put(new THREE.BoxGeometry(3.32,.065,1.22),cream,0,1.34,-.02,-.16);
    sheet(13,2.86,1.04,0,1.378,-.025,-Math.PI/2-.16);
    cyl(.038,3.23,steel,0,1.25,.60,0,Math.PI/2);
    cyl(.065,.64,paper,1.18,1.5,-.37,0,Math.PI/2);cyl(.022,.72,dark,1.18,1.5,-.37,0,Math.PI/2);
    for(const x of[-2.72,-1.98])box(.04,2.4,.04,steel,x,1.28,-1.03);
    box(.86,.05,.055,steel,-2.35,2.48,-1.03);sheet(13,.74,1.05,-2.35,1.94,-.98);
    box(.55,.04,.16,copper,-.94,1.45,-.4);box(.21,.10,.15,dark,-1.06,1.52,-.4);
  } else if (kind === 'weather') {
    meter(-.5,1.52,-.41,6);meter(.25,1.52,-.41,1);clipboard(-.64,1.18,.22,6);
    cyl(.11,.44,cream,.83,1.4,.05);cyl(.025,.52,steel,.83,1.44,.05);
    tube([[.82,1.18,.15],[.95,1.24,.4],[.55,1.22,.50],[.38,1.24,.24]],.018,red);
    cyl(.045, 3.9, steel, 2.35, 2.05, -.72); cyl(.16, .18, dark, 2.35, 3.8, -.72);
    if(animated){
      const rotor=new THREE.Group();rotor.name='weather-anemometer-rotor';rotor.position.set(2.35,3.86,-.72);root.add(rotor);
      for(let a=0;a<3;a++){
        const angle=a*Math.PI*2/3,x=Math.cos(angle)*.65,z=Math.sin(angle)*.65;
        const arm=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.65,8),steel);arm.position.set(x/2,0,z/2);arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(x,0,z).normalize());rotor.add(arm);
        const cup=new THREE.Mesh(new THREE.SphereGeometry(.14,10,6,0,Math.PI*2,0,Math.PI/2),cream);cup.rotation.set(Math.PI/2,angle,0);cup.position.set(x,0,z);rotor.add(cup);
      }
      movingParts.push({node:rotor,axis:'y',speed:1.7,activity:'weather'});
    }else for (let a = 0; a < 3; a++) { const angle = a * Math.PI * 2 / 3; const x = 2.35 + Math.cos(angle) * .65, z = -.72 + Math.sin(angle) * .65; tube([[2.35, 3.86, -.72], [x, 3.86, z]], .025, steel); put(new THREE.SphereGeometry(.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cream, x, 3.86, z, Math.PI / 2, angle); }
    for(let i=0;i<5;i++)box(.59,.035,.52,cream,-2.35,1.25+i*.085,-.55);
    box(.7,.065,.63,cream,-2.35,1.67,-.55);box(.53,.36,.34,dark,-2.35,1.44,-.60);
    for(const dx of[-.22,.22])for(const dz of[-.18,.18])box(.045,1.12,.045,steel,-2.35+dx,.66,-.55+dz);
  } else if (kind === 'beacons') {
    sheet(7,1.35,.93,-.15,1.185,.04,-Math.PI/2);cyl(.11,.18,dark,.72,1.28,.32,Math.PI/2);cyl(.11,.18,dark,.97,1.28,.32,Math.PI/2);
    tube([[.72,1.28,.28],[.83,1.32,.23],[.97,1.28,.28]],.028,steel);
    for (let i = 0; i < 3; i++) {
      const x = -2.25 + i * 2.25;
      cyl(.19, .16, dark, x, .23, -1.6); cyl(.055, 1.3, steel, x, .96, -1.6); cyl(.14, .22, amber, x, 1.70, -1.6);
      cyl(.19, .045, dark, x, 1.84, -1.6); box(.27, .27, .055, cream, x, 1.42, -1.47);
    }
  } else if(kind==='orientation') {
    beveled(2.55,1.29,.08,dark,0,1.92,-.76);sheet(12,2.39,1.13,0,1.92,-.65);
    cyl(.18,.065,steel,.89,1.23,.24);cyl(.15,.02,cream,.89,1.28,.24);
    box(.015,.025,.25,red,.89,1.30,.24,.45);box(.92,.025,.055,copper,-.34,1.20,.42);
  } else if(kind==='crew') {
    // Equipment display, not another paperwork desk: three generic protective hoods.
    for(let i=0;i<3;i++){
      const x=-1.1+i*1.1;cyl(.21,.12,steel,x,1.24,-.12);
      put(new THREE.SphereGeometry(.28,16,10),cream,x,1.57,-.12);
      const visor=new THREE.SphereGeometry(.235,16,8);visor.scale(1,.62,.6);put(visor,dark,x,1.60,.09);
      put(new THREE.TorusGeometry(.2,.027,6,18),dark,x,1.34,-.12,Math.PI/2);
      box(.065,1.01,.065,steel,x,1.68,-.66);sheet(5,.48,.31,x,2.13,-.61);
    }
  } else if (kind === 'records' || kind === 'crew-manifest') {
    if(kind==='records')for(let i=0;i<2;i++)clipboard(-.82+i*.72,1.19+i*.006,.12,9,-.08+i*.06);
    if(kind==='records'){
      beveled(.83,.65,.61,paint,-1.13,.70,-.28);
      for(const y of[.49,.76]){
        box(.77,.22,.045,cream,-1.13,y,.36);handle(-1.13,y-.025,.40,.24,.055);
        box(.15,.055,.012,steel,-1.13,y+.065,.39);box(.12,.032,.014,paper,-1.13,y+.065,.399);
      }
      caseHardware(.83,.65,.61,-1.13,.70,-.28);
    }else{
      for(let i=0;i<3;i++){const x=-.9+i*.77;box(.6,.045,.19,dark,x,1.35,-.48);sheet(5,.44,.57,x,1.65,-.56);}
      box(2.55,.045,.045,steel,0,1.98,-.62);
      clipboard(-.9,1.19,.22,5,0);
      box(1.12,.075,.68,dark,.49,1.20,.17);sheet(5,.70,.45,.49,1.245,.17,-Math.PI/2);
      for(const z of[-.11,.45])box(1.06,.035,.035,steel,.49,1.26,z);
      cyl(.07,.64,steel,.16,1.33,.17,Math.PI/2);
      for(const z of[-.20,.54])cyl(.10,.12,dark,.16,1.35,z,Math.PI/2);
    }
    // Filing sorter, binder rings, stamp and a gooseneck lamp.
    for (let i = 0; i < 3; i++) { box(.64, .035, .66, dark, -1.1, 1.28 + i * .16, -.4); box(.55, .025, .56, paper, -1.1, 1.31 + i * .16, -.4); }
    cyl(.10, .04, dark, 1.28, 1.18, -.33); cyl(.025, .55, copper, 1.28, 1.45, -.33);
    tube([[1.28, 1.72, -.33], [1.28, 1.93, -.33], [1.05, 1.94, -.12], [.98, 1.81, .01]], .025, copper);
    put(new THREE.ConeGeometry(.21, .16, 12, 1, true), paint, .98, 1.75, .01);
    box(.18, .05, .13, dark, .99, 1.20, .47); cyl(.04, .14, copper, .99, 1.29, .47);
  } else {
    // Survey uses an open gimbal/theodolite; tracking uses a twin-reel film camera.
    const cx=-2.13;
    if(kind==='tracking'){
      beveled(.72,.5,.60,paint,cx,1.83,-.32);
      for(const dx of[-.20,.20]){
        cyl(.22,.13,dark,cx+dx,2.22,.03,Math.PI/2);cyl(.175,.018,steel,cx+dx,2.22,.105,Math.PI/2);
        cyl(.045,.035,copper,cx+dx,2.22,.12,Math.PI/2);
        if(animated){
          const reel=new THREE.Group();reel.name='tracking-film-reel';reel.position.set(cx+dx,2.22,.12);root.add(reel);
          for(let spoke=0;spoke<3;spoke++){
            const mesh=new THREE.Mesh(new THREE.BoxGeometry(.025,.30,.008),dark);mesh.rotation.z=spoke*Math.PI/3;reel.add(mesh);
          }
          movingParts.push({node:reel,axis:'z',speed:dx<0?.8:1.1,activity:'tracking'});
        }
      }
      box(.40,.055,.07,dark,cx,2.08,-.27);
    }else{
      for(const dx of[-.29,.29]){box(.07,.52,.12,paint,cx+dx,1.79,-.04);cyl(.125,.08,cream,cx+dx,1.95,-.04,0,Math.PI/2);}
      cyl(.085,.67,paint,cx,1.95,-.17,Math.PI/2);cyl(.22,.065,cream,cx,1.55,-.05);cyl(.18,.025,dark,cx,1.59,-.05);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.013,.018,.045,copper,cx+Math.cos(a)*.17,1.61,-.05+Math.sin(a)*.17,a);}
    }
    const lensY=kind==='tracking'?1.83:1.95;
    cyl(.15,.25,dark,cx,lensY,-.60,Math.PI/2);cyl(.17,.035,steel,cx,lensY,-.74,Math.PI/2);cyl(.13,.035,dark,cx,lensY,-.77,Math.PI/2);
    cyl(.12,.08,steel,cx+.47,1.7,-.05,0,Math.PI/2);
    cyl(.06, .62, steel, cx, 1.25, -.05);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,fx=cx+Math.cos(a)*.6,fz=-.05+Math.sin(a)*.6;
      tube([[cx,1.25,-.05],[fx,.2,fz]],.035,steel);box(.15,.04,.12,dark,fx,.18,fz,a);
      tube([[cx, .67,-.05],[(cx+fx)/2,.72,(fz-.05)/2]],.018,steel);
    }
    clipboard(.87, 1.18, .25, 8);
  }
  if(standUsesPower(kind)){
    for(let i=0;i<5;i++)box(.5,.025,.025,dark,-1.2,.62+i*.07,-.55);
    tube([[1.25,1.1,-.55],[1.6,.66,-.65],[1.7,.20,-.9],[2.15,.14,-1.3]],.022,dark);
  }
  root.userData.standIndex = index;
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    if (merged) { merged.computeBoundingSphere(); const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); }
    geometries.forEach(geometry => geometry.dispose());
  }
  return root;
}
