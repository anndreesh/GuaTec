import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ApolloBonusKind } from './ApolloState';

export type StandModelKind = ApolloBonusKind | 'orientation' | 'survey' | 'records' | 'radio' | 'crew' | 'tracking';
export type StandMaterialFactory = (name: string, color: number, roughness?: number, metalness?: number) => THREE.MeshStandardMaterial;

/** Ground-plane proxies are kept separate from the visual mesh batches. */
export function standCollisionProxies(kind: StandModelKind, x: number, z: number): {x:number;z:number;w:number;d:number}[] {
  const colliders=[{x,z,w:1.8,d:.95},...[-2.12,2.12].map(dx=>({x:x+dx,z:z-1.2,w:.09,d:.09}))];
  if(kind==='telemetry')colliders.push({x:x+2.02,z:z-.35,w:.4,d:.4});
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
  const titles = ['GROUND SUPPORT / 1969', 'VOLTAGE / DC', 'SIGNAL / RF', 'CONTINUITY / BUS', 'FLIGHT OPERATIONS', 'CREW / AS-506', 'WEATHER / RANGE', 'RANGE SAFETY', 'OPTICAL SURVEY', 'FIELD RECORD', 'VOICE / UHF', 'TRACKING / 39A', 'LC-39A / KENNEDY', 'FLIGHT PLAN / 16 JUL', 'TOOL CONTROL', 'SERVICE / AUTHORIZED'];
  for (let index = 0; index < 16; index++) {
    const x = index % 4 * 256, y = Math.floor(index / 4) * 256;
    c.save(); c.translate(x, y);
    const paper = [4, 5, 9, 13].includes(index);
    c.fillStyle = paper ? '#d9ceb0' : '#142c30'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = paper ? '#796d52' : '#708b80'; c.lineWidth = 2; c.strokeRect(9, 9, 238, 238);
    c.fillStyle = paper ? '#303c37' : '#e3c68e'; c.font = '600 13px monospace'; c.fillText(titles[index]!, 19, 31);
    c.fillStyle = paper ? '#74674c' : '#8bb9a4'; c.font = '10px monospace'; c.fillText('APOLLO 11    •    AS-506', 19, 48);
    if ([1, 2, 6].includes(index)) {
      c.fillStyle = '#e2d9be'; c.beginPath(); c.arc(128, 151, 86, Math.PI, 0); c.lineTo(214, 189); c.lineTo(42, 189); c.fill();
      c.strokeStyle = '#394a43'; c.lineWidth = 2;
      for (let tick = 0; tick <= 10; tick++) {
        const a = Math.PI + tick * Math.PI / 10;
        c.beginPath(); c.moveTo(128 + Math.cos(a) * 69, 151 + Math.sin(a) * 69); c.lineTo(128 + Math.cos(a) * 79, 151 + Math.sin(a) * 79); c.stroke();
      }
      c.strokeStyle = '#af4a34'; c.lineWidth = 4; c.beginPath(); c.moveTo(128, 154); c.lineTo(151, 94); c.stroke();
      c.fillStyle = '#34433b'; c.font = '12px monospace'; c.fillText(index === 6 ? 'RANGE WX' : index === 1 ? '28 V DC' : 'S-BAND', 92, 178);
    } else if ([2, 3, 7, 10, 11].includes(index)) {
      c.strokeStyle = '#39665b'; c.lineWidth = 1;
      for (let t = 0; t <= 6; t++) { c.beginPath(); c.moveTo(23, 72 + t * 23); c.lineTo(232, 72 + t * 23); c.stroke(); }
      c.strokeStyle = '#9bc7a3'; c.lineWidth = 2; c.beginPath();
      for (let t = 0; t < 210; t++) { const py = 140 + Math.sin(t * .12) * 25 * Math.sin(t * .025); t ? c.lineTo(23 + t, py) : c.moveTo(23, py); } c.stroke();
      c.fillStyle = '#b2d2b0'; c.font = '11px monospace'; c.fillText('LINK A     STBY     01', 24, 220);
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
export function buildStandModel(kind: StandModelKind, mat: StandMaterialFactory, atlas: THREE.Texture, index: number): THREE.Group {
  const root = new THREE.Group(); root.name = `apollo-stand-${kind}`;
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
  const sheet = (cell: number, w: number, h: number, x: number, y: number, z: number, rx = 0) => {
    const geometry = new THREE.PlaneGeometry(w, h), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cell % 4 + .025 + uv.getX(i) * .95) / 4, (3 - Math.floor(cell / 4) + .025 + uv.getY(i) * .95) / 4);
    put(geometry, display, x, y, z, rx);
  };
  const beveled = (w: number, h: number, depth: number, material: THREE.Material, x: number, y: number, z: number) => {
    const s = new THREE.Shape(), r = .09;
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    put(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 1, steps: 1, curveSegments: 3 }), material, x, y, z);
  };
  const meter = (x: number, y: number, z: number, cell = 1) => { beveled(.63, .53, .1, dark, x, y, z); sheet(cell, .54, .45, x, y, z + .128); };
  const knob = (x: number, y: number, z: number, r = .08) => { cyl(r, .095, dark, x, y, z, Math.PI / 2); box(.014, r * .7, .014, cream, x, y + r * .3, z + .052); };
  const clipboard = (x: number, y: number, z: number, cell = 9, angle = -.12) => {
    box(.65, .035, .83, dark, x, y, z, angle); sheet(cell, .59, .77, x, y + .023, z, -Math.PI / 2); box(.24, .028, .07, steel, x, y + .04, z - .32);
  };
  const tools = () => {
    // Inset tool tray: open-ended spanner, screwdriver, insulated pliers and test leads.
    box(.9, .055, .55, dark, 1.12, 1.166, .4);
    box(.4, .025, .07, steel, 1.05, 1.21, .28, .22); cyl(.075, .025, steel, .84, 1.21, .24); box(.08, .04, .07, dark, .80, 1.23, .24);
    box(.25, .035, .035, steel, 1.18, 1.21, .5); box(.17, .065, .09, amber, .97, 1.22, .5);
    box(.24, .045, .055, red, 1.27, 1.21, .3, .3); box(.24, .045, .055, red, 1.27, 1.21, .4, -.3);
  };
  // Base, skids, tactile edge and an open working side; no decorative loose cargo.
  box(5.6, .13, 4, cream, 0, .02, 0); box(5.4, .025, .11, dark, 0, .1, 1.8);
  for (let i = 0; i < 10; i++) box(.17, .03, .11, amber, -2.4 + i * .53, .12, 1.8, -.35);
  for (const x of [-1.5, 1.5]) { box(.1, 1.02, .1, steel, x, .62, -.35); box(.1, 1.02, .1, steel, x, .62, .65); box(.18, .08, 1.4, dark, x, .15, .12); }
  box(3.5, .11, 1.55, dark, 0, 1.04, .04); box(3.46, .055, 1.51, paint, 0, 1.12, .04);
  box(3.2, .055, .055, steel, 0, 1.17, .77); box(3.15, .08, .08, steel, 0, .37, -.58);
  const tile = ({ sequence: 1, telemetry: 2, cables: 3, 'flight-plan': 13, 'crew-manifest': 5, weather: 6, beacons: 7, orientation: 12, survey: 8, records: 9, radio: 10, crew: 5, tracking: 11 })[kind];
  // Low overhead visor and offset identity plate create a recognisable workstation silhouette.
  for (const x of [-2.12, 2.12]) box(.065, 2.65, .065, steel, x, 1.4, -1.2);
  box(4.4, .09, 1.3, paint, 0, 2.79, -.9); box(4.4, .12, .065, dark, 0, 2.72, -.24);
  beveled(1.04, .65, .025, dark, -1.53, 2.30, -1.14); sheet(tile, .94, .55, -1.53, 2.30, -1.075);
  for (const x of [-1.5, 1.5]) { cyl(.035, .04, steel, x, 1.18, .67); cyl(.035, .04, steel, x, 1.18, -.59); }
  if (kind === 'sequence' || kind === 'telemetry' || kind === 'radio') {
    beveled(2.75, .84, .30, paint, -.12, 1.63, -.61);
    for (let i = 0; i < 3; i++) { meter(-1.05 + i * .91, 1.73, -.27, kind === 'radio' ? 10 : kind === 'sequence' ? 1 : 2); knob(-1.05 + i * .91, 1.29, -.22); }
    for (let vent = 0; vent < 9; vent++) box(.14, .018, .012, dark, -.7 + vent * .18, 1.18, -.24);
    if (kind === 'sequence') {
      for (let i = 0; i < 4; i++) { cyl(.06, .10, copper, -.91 + i * .55, 1.25, .32); box(.055, .22, .045, cream, -.91 + i * .55, 1.4, .32); }
      tube([[-1, 1.13, -.5], [-1.3, .9, -.8], [-1.2, .25, -.6], [-.7, .18, -.8]], .035, red);
    } else if (kind === 'telemetry') {
      beveled(.68, 1.35, .45, dark, 2.02, .85, -.55);
      for (let y = .35; y < 1.4; y += .20) { box(.6, .11, .05, paint, 2.02, y, -.065); knob(2.22, y, -.02, .035); }
    } else {
      tube([[.45, 1.17, .35], [.9, 1.30, .55], [1.4, 1.3, .32], [1.15, 1.18, -.2]], .028, dark);
      cyl(.06, .5, steel, 1.35, 1.4, -.55); cyl(.14, .1, dark, 1.35, 1.68, -.55, Math.PI / 2);
    }
    tools();
  } else if (kind === 'cables') {
    beveled(2.7, .93, .15, cream, -.05, 1.68, -.62);
    for (let i = 0; i < 4; i++) {
      const x = -1 + i * .64;
      cyl(.105, .08, dark, x, 1.86, -.4, Math.PI / 2); cyl(.065, .1, copper, x, 1.86, -.35, Math.PI / 2);
      tube([[x, 1.86, -.27], [x - .15, 1.45, .15], [x + .18, 1.24, .35], [x + .22, 1.15, .55]], .026, i % 2 ? dark : red);
    } tools();
  } else if (kind === 'weather') {
    meter(-.5, 1.52, -.41, 6); meter(.25, 1.52, -.41, 1); clipboard(-.75, 1.18, .34, 6); tools();
    cyl(.045, 3.9, steel, 2.35, 2.05, -.72); cyl(.16, .18, dark, 2.35, 3.8, -.72);
    for (let a = 0; a < 3; a++) { const angle = a * Math.PI * 2 / 3; const x = 2.35 + Math.cos(angle) * .65, z = -.72 + Math.sin(angle) * .65; tube([[2.35, 3.86, -.72], [x, 3.86, z]], .025, steel); put(new THREE.SphereGeometry(.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cream, x, 3.86, z, Math.PI / 2, angle); }
    for (let i = 0; i < 5; i++) box(.53, .045, .45, cream, -2.35, 1.25 + i * .1, -.55);
    box(.1, 1.2, .1, steel, -2.35, .65, -.55);
  } else if (kind === 'beacons') {
    sheet(7, 1.1, 1.1, -.5, 1.185, .05, -Math.PI / 2); tools();
    for (let i = 0; i < 3; i++) {
      const x = -2.25 + i * 2.25;
      cyl(.19, .16, dark, x, .23, -1.6); cyl(.055, 1.3, steel, x, .96, -1.6); cyl(.14, .22, amber, x, 1.70, -1.6);
      cyl(.19, .045, dark, x, 1.84, -1.6); box(.27, .27, .055, cream, x, 1.42, -1.47);
    }
  } else if (kind === 'flight-plan' || kind === 'records' || kind === 'crew-manifest' || kind === 'crew' || kind === 'orientation') {
    if (kind === 'orientation') { sheet(12, 1.5, 1.15, -.55, 1.185, .06, -Math.PI / 2); cyl(.16, .04, steel, .85, 1.2, -.3); }
    else {
      for (let i = 0; i < (kind === 'crew' || kind === 'crew-manifest' ? 3 : 4); i++) { clipboard(-1.1 + i * .63, 1.19 + i * .006, .10, kind === 'crew-manifest' || kind === 'crew' ? 5 : 13); }
    }
    // Filing sorter, binder rings, stamp and a gooseneck lamp.
    for (let i = 0; i < 3; i++) { box(.64, .035, .66, dark, -1.1, 1.28 + i * .16, -.4); box(.55, .025, .56, paper, -1.1, 1.31 + i * .16, -.4); }
    cyl(.10, .04, dark, 1.28, 1.18, -.33); cyl(.025, .55, copper, 1.28, 1.45, -.33);
    tube([[1.28, 1.72, -.33], [1.28, 1.93, -.33], [1.05, 1.94, -.12], [.98, 1.81, .01]], .025, copper);
    put(new THREE.ConeGeometry(.21, .16, 12, 1, true), paint, .98, 1.75, .01);
    box(.18, .05, .13, dark, .99, 1.20, .47); cyl(.04, .14, copper, .99, 1.29, .47);
  } else {
    // Optical head with lens hood, film magazine, handwheels and a braced tripod.
    const cx=-2.13;
    box(.75, .5, .65, paint, cx, 1.83, -.05); cyl(.20, .6, dark, cx, 1.83, -.52, Math.PI / 2);
    cyl(.18, .05, steel, cx, 1.83, -.84, Math.PI / 2); cyl(.14, .06, dark, cx, 1.83, -.88, Math.PI / 2);
    cyl(.22, .15, dark, cx, 2.22, .10, Math.PI / 2); cyl(.12, .08, steel, cx+.47, 1.7, -.05, 0, Math.PI / 2);
    cyl(.06, .62, steel, cx, 1.25, -.05);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; tube([[cx, 1.25, -.05], [cx + Math.cos(a) * .6, .2, -.05 + Math.sin(a) * .6]], .035, steel); }
    clipboard(.87, 1.18, .25, 8);
  }
  // Cable drops and louvred service panel join the desk to the grounded work area.
  for (let i = 0; i < 5; i++) box(.5, .025, .025, dark, -1.5, .62 + i * .07, -.55);
  tube([[1.45, 1.1, -.55], [1.6, .66, -.65], [1.7, .20, -.9], [2.15, .14, -1.3]], .022, dark);
  root.userData.standIndex = index;
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    if (merged) { merged.computeBoundingSphere(); const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); }
    geometries.forEach(geometry => geometry.dispose());
  }
  return root;
}
