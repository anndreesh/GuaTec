import * as THREE from 'three';

/**
 * Tables, benches and the small props on them for the Apollo 11 support stations.
 *
 * Each station gets furniture that says what is done there: a map table with pins and a
 * compass, a clerk's desk with stamps and folders, a radio operator's set, a suit-check rack,
 * a wiring bench, a star-chart table, a punch-card sorter, a light-pad panel and a radar
 * scope. The scene supplies a 'Kit' (its own box/cylinder helpers), so everything is merged
 * into the same static batches as the rest of the world.
 */
export type StationKind = 'map' | 'camera' | 'desk' | 'radio' | 'crew' | 'wiring' | 'dishstation' | 'card' | 'sequence' | 'telemetry';

export interface Kit {
  mat(name: string, color: number, roughness?: number, metalness?: number): THREE.MeshStandardMaterial;
  box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ry?: number): void;
  /** Cylinder along Y; 'rx'/'rz' tip it (π/2 about Z lays it along X, π/2 about X lays it along Z). */
  cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, rx?: number, rz?: number): void;
  /** Sphere, optionally squashed on Y or cut to its upper half. */
  ball(r: number, m: THREE.Material, x: number, y: number, z: number, squash?: number, dome?: boolean): void;
  tube(a: THREE.Vector3, b: THREE.Vector3, width: number, m: THREE.Material): void;
  /** Flat textured sheet. 'tilt' 0 lies flat facing up, π/2 stands upright facing +Z. */
  sheet(w: number, d: number, tex: THREE.Texture, x: number, y: number, z: number, tilt?: number): void;
}
export interface FurnitureCollider { x: number; z: number; w: number; d: number }

/** Height of every table surface. */
const TOP = 1.06;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

function canvasTexture(width: number, height: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** A hand-inked map of the coast, roads and launch complex (labels are universal symbols, not words). */
function mapTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 232, c => {
    c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, 512, 232);
    c.fillStyle = '#a9b883'; c.beginPath(); c.moveTo(0, 20); c.bezierCurveTo(140, 0, 260, 60, 330, 40); c.bezierCurveTo(400, 25, 450, 90, 512, 80); c.lineTo(512, 232); c.lineTo(0, 232); c.fill();
    c.fillStyle = '#c9d6cf'; c.beginPath(); c.moveTo(512, 80); c.bezierCurveTo(450, 90, 400, 25, 330, 40); c.bezierCurveTo(400, 0, 470, 0, 512, 0); c.fill();
    c.strokeStyle = '#7d8a6c'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(90,70,40,0.35)'; c.lineWidth = 1;
    for (let x = 0; x <= 512; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 232); c.stroke(); }
    for (let y = 0; y <= 232; y += 29) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
    c.strokeStyle = '#4a4036'; c.lineWidth = 4; c.beginPath(); c.moveTo(40, 190); c.lineTo(250, 150); c.lineTo(360, 100); c.lineTo(470, 90); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(250, 150); c.lineTo(250, 40); c.stroke();
    c.fillStyle = '#b3282d'; c.beginPath(); c.arc(360, 100, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2d2a26'; c.fillRect(244, 34, 14, 12); c.fillRect(120, 168, 16, 12);
    c.save(); c.translate(458, 188); c.fillStyle = '#2d2a26'; c.beginPath(); c.moveTo(0, -24); c.lineTo(8, 8); c.lineTo(0, 2); c.lineTo(-8, 8); c.closePath(); c.fill(); c.font = '700 14px sans-serif'; c.textAlign = 'center'; c.fillText('N', 0, 26); c.restore();
  });
}

function chartTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, c => {
    c.fillStyle = '#e9e1c8'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#4b4438'; c.lineWidth = 1.5;
    for (const r of [40, 80, 118]) { c.beginPath(); c.arc(128, 128, r, 0, Math.PI * 2); c.stroke(); }
    for (let a = 0; a < 12; a++) { c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(a * Math.PI / 6) * 118, 128 + Math.sin(a * Math.PI / 6) * 118); c.stroke(); }
    let seed = 7; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    c.fillStyle = '#2b2620';
    for (let i = 0; i < 70; i++) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 114; c.beginPath(); c.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1 + rand() * 2.4, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#b3282d'; c.lineWidth = 2; c.beginPath(); c.arc(128, 128, 60, 0.4, 2.2); c.stroke();
  });
}

function scopeTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, c => {
    c.fillStyle = '#04120b'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#2f9a5b'; c.lineWidth = 1.5;
    for (const r of [32, 64, 96, 122]) { c.beginPath(); c.arc(128, 128, r, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(128, 6); c.lineTo(128, 250); c.moveTo(6, 128); c.lineTo(250, 128); c.stroke();
    const sweep = c.createRadialGradient(128, 128, 0, 128, 128, 122);
    sweep.addColorStop(0, 'rgba(90,255,150,0.55)'); sweep.addColorStop(1, 'rgba(90,255,150,0)');
    c.fillStyle = sweep; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 122, -1.2, -0.3); c.closePath(); c.fill();
    c.fillStyle = '#9dffc2'; for (const [x, y] of [[170, 80], [96, 150], [150, 170]]) { c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill(); }
  });
}

function table(k: Kit, x: number, z: number, w = 2.7, d = 1.3, metal = false): void {
  const top = k.mat(metal ? 'f-top-steel' : 'f-top-wood', metal ? 0x76827f : 0xa88358, 0.7, metal ? 0.35 : 0);
  const edge = k.mat('f-edge', 0x47403a, 0.8, 0.1);
  const leg = k.mat('f-leg', 0x4f5a58, 0.55, 0.5);
  k.box(w, 0.06, d, top, x, TOP - 0.03, z);
  k.box(w + 0.04, 0.05, d + 0.04, edge, x, TOP - 0.085, z);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) k.box(0.07, TOP - 0.11, 0.07, leg, x + dx * (w / 2 - 0.1), (TOP - 0.11) / 2, z + dz * (d / 2 - 0.1));
  k.box(w - 0.3, 0.04, 0.04, leg, x, 0.28, z - d / 2 + 0.1);
  k.box(w - 0.3, 0.04, 0.04, leg, x, 0.28, z + d / 2 - 0.1);
  for (const dx of [-1, 1]) k.box(0.04, 0.04, d - 0.2, leg, x + dx * (w / 2 - 0.1), 0.28, z);
}

function mapTable(k: Kit, x: number, z: number): void {
  table(k, x, z);
  k.sheet(2.3, 1.05, mapTexture(), x, TOP + 0.004, z);
  [[-0.8, 0.1, 0xc4302b], [0.2, -0.2, 0xe2b93b], [0.75, 0.22, 0x3c8f4f]].forEach(([dx, dz, color], i) => {
    const m = k.mat('f-pin' + i, color, 0.4);
    k.cyl(0.012, 0.012, 0.09, k.mat('f-pin-steel', 0xbfc4c4, 0.3, 0.8), x + dx, TOP + 0.045, z + dz);
    k.ball(0.035, m, x + dx, TOP + 0.1, z + dz);
  });
  const brass = k.mat('f-brass', 0xb08d3c, 0.35, 0.7);
  k.cyl(0.13, 0.13, 0.035, brass, x + 0.95, TOP + 0.02, z + 0.35);
  k.cyl(0.1, 0.1, 0.01, k.mat('f-compass-face', 0xe8e2cf, 0.6), x + 0.95, TOP + 0.042, z + 0.35);
  k.box(0.9, 0.012, 0.07, k.mat('f-ruler', 0xd8b86a, 0.6), x - 0.35, TOP + 0.012, z + 0.42, 0.12);
  k.cyl(0.05, 0.05, 0.13, k.mat('f-jar', 0x7d4f3b, 0.7), x - 1.1, TOP + 0.065, z - 0.45);
}

function deskTable(k: Kit, x: number, z: number): FurnitureCollider[] {
  table(k, x, z, 2.7, 1.3, true);
  const paper = k.mat('f-paper', 0xece5cf, 0.9), manila = k.mat('f-manila', 0xd6b46c, 0.8), dark = k.mat('f-dark', 0x24292a, 0.6, 0.2);
  k.box(0.46, 0.16, 0.33, paper, x - 0.85, TOP + 0.08, z + 0.1, 0.1);
  k.box(0.4, 0.09, 0.3, paper, x - 0.3, TOP + 0.045, z - 0.2, -0.15);
  for (let i = 0; i < 3; i++) k.box(0.34, 0.018, 0.25, manila, x + 0.2 + i * 0.05, TOP + 0.012 + i * 0.02, z + 0.25 - i * 0.04, 0.25 * i - 0.2);
  k.box(0.2, 0.03, 0.13, dark, x + 0.55, TOP + 0.015, z - 0.15);
  k.cyl(0.032, 0.032, 0.1, k.mat('f-stamp-wood', 0x7a4a2c, 0.6), x + 0.55, TOP + 0.08, z - 0.15);
  k.ball(0.04, k.mat('f-stamp-wood', 0x7a4a2c, 0.6), x + 0.55, TOP + 0.14, z - 0.15);
  const brassMat = k.mat('f-brass', 0xb08d3c, 0.35, 0.7);
  k.cyl(0.09, 0.1, 0.03, brassMat, x + 1.0, TOP + 0.015, z - 0.35);
  k.tube(v(x + 1.0, TOP + 0.03, z - 0.35), v(x + 1.0, TOP + 0.5, z - 0.3), 0.03, brassMat);
  k.cyl(0.05, 0.17, 0.15, k.mat('f-lamp-shade', 0x2f6b4b, 0.4, 0.2), x + 1.0, TOP + 0.55, z - 0.27);
  k.box(0.22, 0.1, 0.2, dark, x - 1.0, TOP + 0.05, z - 0.4);
  k.tube(v(x - 1.0, TOP + 0.12, z - 0.4), v(x - 0.88, TOP + 0.14, z - 0.4), 0.04, dark);
  // Filing cabinet at the end of the desk.
  const steel = k.mat('f-cabinet', 0x7b8784, 0.55, 0.45);
  k.box(0.56, 1.3, 0.6, steel, x + 2.15, 0.65, z - 0.2);
  for (let i = 0; i < 3; i++) {
    k.box(0.5, 0.36, 0.02, k.mat('f-cabinet-front', 0x8b9794, 0.5, 0.4), x + 2.15, 0.25 + i * 0.4, z + 0.115);
    k.box(0.16, 0.025, 0.03, k.mat('f-handle', 0xcbd2d1, 0.3, 0.8), x + 2.15, 0.33 + i * 0.4, z + 0.14);
  }
  return [{ x: x + 2.15, z: z - 0.2, w: 0.3, d: 0.32 }];
}

function radioTable(k: Kit, x: number, z: number): void {
  table(k, x, z, 2.7, 1.3, true);
  const olive = k.mat('f-olive', 0x4d5a44, 0.6, 0.35), plate = k.mat('f-radio-plate', 0x9aa08a, 0.5, 0.3), black = k.mat('f-dark', 0x24292a, 0.6, 0.2), cream = k.mat('f-cream', 0xe4ddc3, 0.5);
  k.box(0.95, 0.4, 0.45, olive, x + 0.4, TOP + 0.2, z - 0.1);
  k.box(0.86, 0.3, 0.03, plate, x + 0.4, TOP + 0.2, z + 0.13);
  for (let i = 0; i < 3; i++) k.cyl(0.055, 0.055, 0.05, cream, x + 0.15 + i * 0.25, TOP + 0.2, z + 0.16, Math.PI / 2);
  for (let i = 0; i < 5; i++) k.box(0.2, 0.012, 0.02, black, x + 0.73, TOP + 0.28 - i * 0.04, z + 0.15);
  k.tube(v(x + 0.8, TOP + 0.4, z - 0.1), v(x + 1.0, 2.4, z - 0.1), 0.012, black);
  // Headset, Morse key and a desk microphone.
  for (const dx of [-0.07, 0.07]) k.cyl(0.07, 0.07, 0.045, black, x - 0.6 + dx * 2.1, TOP + 0.03, z + 0.25);
  k.tube(v(x - 0.74, TOP + 0.05, z + 0.25), v(x - 0.6, TOP + 0.2, z + 0.25), 0.02, black);
  k.tube(v(x - 0.6, TOP + 0.2, z + 0.25), v(x - 0.46, TOP + 0.05, z + 0.25), 0.02, black);
  k.box(0.24, 0.03, 0.14, black, x - 0.2, TOP + 0.015, z + 0.3);
  k.tube(v(x - 0.28, TOP + 0.04, z + 0.3), v(x - 0.12, TOP + 0.09, z + 0.3), 0.02, k.mat('f-brass', 0xb08d3c, 0.35, 0.7));
  k.ball(0.025, black, x - 0.12, TOP + 0.1, z + 0.3);
  k.cyl(0.07, 0.08, 0.02, black, x - 1.0, TOP + 0.01, z - 0.2);
  k.tube(v(x - 1.0, TOP + 0.02, z - 0.2), v(x - 1.0, TOP + 0.34, z - 0.2), 0.02, black);
  k.ball(0.055, k.mat('f-mic', 0x8a9290, 0.4, 0.6), x - 1.0, TOP + 0.38, z - 0.2);
  k.box(0.34, 0.04, 0.24, k.mat('f-logbook', 0x6b3e2a, 0.8), x - 0.45, TOP + 0.02, z - 0.35, 0.1);
}

function crewTable(k: Kit, x: number, z: number): FurnitureCollider[] {
  table(k, x, z);
  const white = k.mat('f-suit', 0xe9e8df, 0.7), gold = k.mat('f-visor', 0x9a7d35, 0.2, 0.7), dark = k.mat('f-dark', 0x24292a, 0.6, 0.2);
  for (let i = -1; i <= 1; i++) {
    k.cyl(0.13, 0.15, 0.04, k.mat('f-ring', 0xb8bdbb, 0.4, 0.6), x + i * 0.8, TOP + 0.02, z + 0.05);
    k.ball(0.2, white, x + i * 0.8, TOP + 0.22, z + 0.05);
    k.ball(0.15, gold, x + i * 0.8, TOP + 0.24, z + 0.17, 0.7, true);
  }
  for (const dx of [-0.45, 0.45]) { k.box(0.12, 0.05, 0.2, white, x + dx, TOP + 0.025, z + 0.38); k.box(0.1, 0.05, 0.18, white, x + dx + 0.14, TOP + 0.025, z + 0.34, 0.3); }
  k.box(0.26, 0.02, 0.34, k.mat('f-clip', 0x6b3e2a, 0.8), x - 1.05, TOP + 0.01, z - 0.3, 0.2);
  k.box(0.22, 0.005, 0.3, k.mat('f-paper', 0xece5cf, 0.9), x - 1.05, TOP + 0.024, z - 0.3, 0.2);
  // Suit rack behind the table with three flight suits on hangers.
  const steel = k.mat('f-rack', 0x7b8784, 0.5, 0.5);
  for (const dx of [-1.5, 1.5]) k.box(0.06, 2.1, 0.06, steel, x + dx, 1.05, z - 1.0);
  k.box(3.06, 0.05, 0.05, steel, x, 2.05, z - 1.0);
  for (let i = -1; i <= 1; i++) {
    const sx = x + i * 0.95;
    k.tube(v(sx, 2.05, z - 1.0), v(sx, 1.88, z - 1.0), 0.02, steel);
    k.box(0.46, 0.5, 0.24, white, sx, 1.62, z - 1.0);
    for (const dx of [-0.12, 0.12]) k.box(0.17, 0.7, 0.19, white, sx + dx, 1.02, z - 1.0);
    for (const dx of [-0.31, 0.31]) k.box(0.13, 0.5, 0.15, white, sx + dx, 1.58, z - 1.0);
    k.box(0.2, 0.12, 0.02, dark, sx, 1.72, z - 0.87);
  }
  return [{ x: x - 1.5, z: z - 1.0, w: 0.1, d: 0.1 }, { x: x + 1.5, z: z - 1.0, w: 0.1, d: 0.1 }];
}

function wiringTable(k: Kit, x: number, z: number): void {
  table(k, x, z, 2.7, 1.3, true);
  [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xd946ef, 0xfb923c].forEach((color, i) => {
    const wire = k.mat('f-wire' + i, color, 0.45), flange = k.mat('f-flange', 0x2f3534, 0.6, 0.3);
    const sx = x - 1.0 + i * 0.22;
    k.cyl(0.06, 0.06, 0.12, wire, sx, TOP + 0.09, z - 0.4, 0, Math.PI / 2);
    for (const dx of [-0.065, 0.065]) k.cyl(0.09, 0.09, 0.012, flange, sx + dx, TOP + 0.09, z - 0.4, 0, Math.PI / 2);
    k.box(0.12, 0.03, 0.12, flange, sx, TOP + 0.015, z - 0.4);
  });
  const red = k.mat('f-toolbox', 0xa8302b, 0.5, 0.3);
  k.box(0.52, 0.2, 0.26, red, x + 0.8, TOP + 0.1, z + 0.15);
  k.tube(v(x + 0.6, TOP + 0.2, z + 0.15), v(x + 1.0, TOP + 0.2, z + 0.15), 0.025, k.mat('f-handle', 0xcbd2d1, 0.3, 0.8));
  const steel = k.mat('f-tool-steel', 0xaeb6b6, 0.3, 0.8);
  k.box(0.2, 0.012, 0.03, steel, x - 0.2, TOP + 0.012, z + 0.3, 0.5);
  k.box(0.2, 0.012, 0.03, steel, x - 0.2, TOP + 0.016, z + 0.3, -0.5);
  k.box(0.5, 0.05, 0.14, k.mat('f-terminal', 0x2f3534, 0.6), x + 0.1, TOP + 0.025, z + 0.1);
  [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xd946ef, 0xfb923c].forEach((color, i) => k.cyl(0.018, 0.018, 0.05, k.mat('f-stud' + i, color, 0.4), x - 0.08 + i * 0.075, TOP + 0.075, z + 0.1));
  // Pegboard with hanging tools.
  k.box(1.7, 0.9, 0.04, k.mat('f-pegboard', 0x8a7a5e, 0.9), x - 0.3, 1.75, z - 0.62);
  for (let i = 0; i < 5; i++) k.tube(v(x - 1.0 + i * 0.32, 1.95, z - 0.58), v(x - 1.0 + i * 0.32, 1.45 + (i % 2) * 0.1, z - 0.58), 0.03, i % 2 ? steel : k.mat('f-toolbox', 0xa8302b, 0.5, 0.3));
}

function dishTable(k: Kit, x: number, z: number): void {
  table(k, x, z);
  k.sheet(1.0, 1.0, chartTexture(), x - 0.2, TOP + 0.004, z + 0.05);
  const brass = k.mat('f-brass', 0xb08d3c, 0.35, 0.7);
  k.cyl(0.12, 0.14, 0.04, brass, x - 1.0, TOP + 0.02, z - 0.25);
  k.tube(v(x - 1.0, TOP + 0.04, z - 0.25), v(x - 1.0, TOP + 0.24, z - 0.25), 0.025, brass);
  k.ball(0.19, k.mat('f-globe', 0x6d8a5a, 0.6), x - 1.0, TOP + 0.43, z - 0.25);
  k.cyl(0.19, 0.19, 0.01, brass, x - 1.0, TOP + 0.43, z - 0.25, 0, 0.5);
  const black = k.mat('f-dark', 0x24292a, 0.6, 0.2);
  for (const dz of [-0.04, 0.04]) { k.cyl(0.035, 0.035, 0.22, black, x + 0.7, TOP + 0.04, z + 0.3 + dz, Math.PI / 2); k.cyl(0.05, 0.05, 0.05, black, x + 0.58, TOP + 0.04, z + 0.3 + dz, Math.PI / 2); }
  k.box(0.28, 0.025, 0.2, k.mat('f-logbook', 0x6b3e2a, 0.8), x + 0.6, TOP + 0.013, z - 0.3, -0.2);
  k.cyl(0.1, 0.1, 0.008, k.mat('f-protractor', 0xe9e4d2, 0.4), x + 0.3, TOP + 0.004, z + 0.5);
}

function cardTable(k: Kit, x: number, z: number): void {
  table(k, x, z, 2.7, 1.3, true);
  const tray = k.mat('f-tray', 0x3a4442, 0.6, 0.3), cardMat = k.mat('f-card', 0xe9dfbf, 0.8), grey = k.mat('f-sorter', 0x7b8784, 0.55, 0.45), dark = k.mat('f-dark', 0x24292a, 0.6, 0.2);
  // Trays of punched cards.
  for (let row = 0; row < 3; row++) {
    k.box(0.96, 0.1, 0.24, tray, x + 0.55, TOP + 0.05, z - 0.4 + row * 0.33);
    for (let i = 0; i < 9; i++) k.box(0.012, 0.085, 0.2, cardMat, x + 0.2 + i * 0.08, TOP + 0.06, z - 0.4 + row * 0.33, 0);
  }
  // Card sorter with a lit slot.
  k.box(0.78, 0.4, 0.52, grey, x - 0.7, TOP + 0.2, z - 0.1);
  k.box(0.5, 0.05, 0.04, dark, x - 0.7, TOP + 0.3, z + 0.17);
  k.box(0.4, 0.025, 0.02, k.mat('f-slot-glow', 0xffd47a, 0.4), x - 0.7, TOP + 0.3, z + 0.19);
  for (let i = 0; i < 4; i++) k.cyl(0.03, 0.03, 0.03, k.mat('f-led' + i, [0xef4444, 0xfacc15, 0x22c55e, 0xe4ddc3][i], 0.4), x - 0.95 + i * 0.16, TOP + 0.2, z + 0.17, Math.PI / 2);
  // Pinboard of badges.
  k.box(1.3, 0.75, 0.04, k.mat('f-cork', 0xb98f5f, 0.95), x - 0.2, 1.75, z - 0.62);
  for (let i = 0; i < 6; i++) {
    k.box(0.2, 0.28, 0.01, k.mat('f-badge', 0xe9e8df, 0.7), x - 0.7 + i * 0.2, 1.75 + (i % 2) * 0.05, z - 0.595, (i % 3 - 1) * 0.06);
    k.box(0.2, 0.05, 0.012, k.mat('f-badge-band' + (i % 3), [0xb3282d, 0x2f6b4b, 0xc99a45][i % 3], 0.6), x - 0.7 + i * 0.2, 1.84 + (i % 2) * 0.05, z - 0.59);
  }
}

function sequenceTable(k: Kit, x: number, z: number): void {
  table(k, x, z, 2.7, 1.3, true);
  const base = k.mat('f-panel-base', 0x2e3836, 0.5, 0.4);
  k.box(1.9, 0.07, 0.8, base, x - 0.1, TOP + 0.035, z);
  [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xd946ef, 0xfb923c].forEach((color, i) => {
    const pad = k.mat('f-pad' + i, color, 0.35); pad.emissive.setHex(color); pad.emissiveIntensity = 0.35;
    k.box(0.4, 0.05, 0.3, pad, x - 0.65 + (i % 3) * 0.55, TOP + 0.095, z - 0.17 + Math.floor(i / 3) * 0.36);
  });
  const dark = k.mat('f-dark', 0x24292a, 0.6, 0.2), steel = k.mat('f-tool-steel', 0xaeb6b6, 0.3, 0.8);
  for (let i = 0; i < 5; i++) { k.box(0.06, 0.05, 0.06, dark, x + 0.95 + i * 0.0, TOP + 0.1, z - 0.3 + i * 0.15); k.tube(v(x + 0.95, TOP + 0.1, z - 0.3 + i * 0.15), v(x + 0.95, TOP + 0.2, z - 0.3 + i * 0.15 + (i % 2) * 0.04), 0.015, steel); }
}

function telemetryTable(k: Kit, x: number, z: number): void {
  table(k, x, z, 2.7, 1.3, true);
  const housing = k.mat('f-scope-housing', 0x2b3331, 0.5, 0.4), dark = k.mat('f-dark', 0x24292a, 0.6, 0.2), cream = k.mat('f-cream', 0xe4ddc3, 0.5), steel = k.mat('f-tool-steel', 0xaeb6b6, 0.3, 0.8);
  k.cyl(0.14, 0.18, 0.05, housing, x - 0.55, TOP + 0.025, z - 0.1);
  k.tube(v(x - 0.55, TOP + 0.05, z - 0.1), v(x - 0.55, TOP + 0.5, z - 0.1), 0.05, housing);
  k.cyl(0.4, 0.4, 0.16, housing, x - 0.55, TOP + 0.62, z - 0.1, Math.PI / 2);
  k.sheet(0.7, 0.7, scopeTexture(), x - 0.55, TOP + 0.62, z - 0.01, Math.PI / 2);
  for (let i = 0; i < 3; i++) k.cyl(0.04, 0.04, 0.03, cream, x - 0.8 + i * 0.25, TOP + 0.1, z + 0.35, Math.PI / 2);
  // Chart recorder with a paper strip and reels.
  k.box(0.7, 0.3, 0.45, housing, x + 0.7, TOP + 0.15, z - 0.1);
  k.box(0.5, 0.03, 0.18, k.mat('f-paper', 0xece5cf, 0.9), x + 0.7, TOP + 0.315, z - 0.1);
  for (const dx of [-0.2, 0.2]) { k.cyl(0.09, 0.09, 0.05, dark, x + 0.7 + dx, TOP + 0.34, z - 0.32, Math.PI / 2); k.cyl(0.04, 0.04, 0.06, steel, x + 0.7 + dx, TOP + 0.34, z - 0.32, Math.PI / 2); }
  k.cyl(0.11, 0.11, 0.1, k.mat('f-reel', 0xd8d4c2, 0.6), x + 1.05, TOP + 0.05, z + 0.4, Math.PI / 2);
}

function cameraSide(k: Kit, x: number, z: number): void {
  const top = k.mat('f-top-steel', 0x76827f, 0.7, 0.35), leg = k.mat('f-leg', 0x4f5a58, 0.55, 0.5), grey = k.mat('f-film', 0x8f9795, 0.5, 0.5), dark = k.mat('f-dark', 0x24292a, 0.6, 0.2);
  k.box(0.9, 0.05, 0.6, top, x, 0.95, z);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) k.box(0.05, 0.93, 0.05, leg, x + dx * 0.4, 0.465, z + dz * 0.25);
  for (let i = 0; i < 4; i++) k.cyl(0.075, 0.075, 0.035, grey, x - 0.25, 0.995 + i * 0.037, z - 0.1);
  k.cyl(0.07, 0.08, 0.2, dark, x + 0.2, 1.07, z + 0.05, Math.PI / 2);
  k.cyl(0.085, 0.085, 0.03, k.mat('f-lens', 0x3a5560, 0.1, 0.7), x + 0.31, 1.07, z + 0.05, Math.PI / 2);
  k.box(0.1, 0.07, 0.05, k.mat('f-cream', 0xe4ddc3, 0.5), x + 0.2, 1.005, z + 0.22);
}

/** The table for a station and everything on it. Returns extra colliders for pieces that stand outside the station's own. */
export function buildTable(k: Kit, kind: StationKind, x: number, z: number): FurnitureCollider[] {
  switch (kind) {
    case 'map': mapTable(k, x, z); return [];
    case 'desk': return deskTable(k, x, z);
    case 'radio': radioTable(k, x, z); return [];
    case 'crew': return crewTable(k, x, z);
    case 'wiring': wiringTable(k, x, z); return [];
    case 'dishstation': dishTable(k, x, z); return [];
    case 'card': cardTable(k, x, z); return [];
    case 'sequence': sequenceTable(k, x, z); return [];
    case 'telemetry': telemetryTable(k, x, z); return [];
    case 'camera': cameraSide(k, x + 1.6, z); return [{ x: x + 1.6, z, w: 0.45, d: 0.3 }];
  }
}

/** Bench seen from above: seat faces local −Z, backrest is on +Z. 'ry' rotates the whole thing about Y. */
export function buildBench(k: Kit, x: number, z: number, ry = 0, length = 1.8, steel = false): FurnitureCollider {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const at = (lx: number, lz: number): [number, number] => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
  const slat = k.mat(steel ? 'f-bench-steel' : 'f-bench-wood', steel ? 0x8b9694 : 0x9b7b53, 0.75, steel ? 0.45 : 0);
  const frame = k.mat('f-bench-frame', 0x3d4745, 0.55, 0.5);
  for (let i = 0; i < 3; i++) { const [px, pz] = at(0, -0.14 + i * 0.14); k.box(length, 0.04, 0.12, slat, px, 0.45, pz, ry); }
  for (let i = 0; i < 2; i++) { const [px, pz] = at(0, 0.2); k.box(length, 0.11, 0.03, slat, px, 0.7 + i * 0.16, pz, ry); }
  for (const side of [-1, 1]) {
    const [px, pz] = at(side * (length / 2 - 0.12), 0.0); k.box(0.05, 0.44, 0.42, frame, px, 0.22, pz, ry);
    const [bx, bz] = at(side * (length / 2 - 0.12), 0.2); k.box(0.05, 0.5, 0.05, frame, bx, 0.7, bz, ry);
  }
  const c = Math.abs(cos), s = Math.abs(sin);
  return { x, z, w: c * length / 2 + s * 0.25, d: s * length / 2 + c * 0.25 };
}
