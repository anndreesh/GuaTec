import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Procedural, parametric road vehicles for the Kennedy support area.
 *
 * Everything that defines a vehicle's silhouette lives in `CarSpec`, so a new model is a
 * new object, not new geometry code: change a number and the hood, windshield, roof and
 * tail follow. The body is a rounded side profile extruded across the width and then
 * pinched in towards the roof ("tumblehome") and towards the nose and tail, which is what
 * stops it from reading as a stack of boxes.
 *
 * Axes: the car faces -Z, width runs along X, origin is the ground below the centre.
 * Side-profile coordinates are `s` (lengthwise, + = front) and `t` (height).
 */
export interface CarSpec {
  length: number;
  width: number;
  height: number;
  /** Distance between the axles. */
  wheelbase: number;
  wheelRadius: number;
  /** Underbody clearance. */
  clearance: number;
  /** Height of the shoulder line where the glass starts. */
  belt: number;
  /** Side-profile positions measured from the centre (+ = front). */
  windshieldBase: number;
  roofFront: number;
  roofRear: number;
  rearGlassBase: number;
  /** Thickness of the roof panel above the glass (a van has a deep one). */
  roofThickness: number;
  /** Corner rounding of the profile, metres. */
  corner: number;
  /** How much the sides lean in towards the roof, 0–0.2. */
  tumblehome: number;
  /** Extra glass pillar positions (B pillar etc.). */
  pillars: readonly number[];
  /** Solid body-colour panel from here to the tail instead of glass (cargo area of a van). */
  blindFrom?: number;
  roofRails?: boolean;
  /** Nose and tail lights as one full-width bar (modern) or separate clusters. */
  lightBar?: boolean;
}

export const CAR_SPECS = {
  suv: { length: 4.72, width: 1.93, height: 1.68, wheelbase: 2.86, wheelRadius: 0.39, clearance: 0.2, belt: 1.0, windshieldBase: 1.18, roofFront: 0.38, roofRear: -1.82, rearGlassBase: -2.12, roofThickness: 0.1, corner: 0.2, tumblehome: 0.11, pillars: [-0.1, -0.78], roofRails: true, lightBar: true },
  sedan: { length: 4.86, width: 1.88, height: 1.46, wheelbase: 2.9, wheelRadius: 0.35, clearance: 0.15, belt: 0.93, windshieldBase: 1.1, roofFront: 0.22, roofRear: -0.78, rearGlassBase: -1.86, roofThickness: 0.08, corner: 0.24, tumblehome: 0.13, pillars: [-0.12], lightBar: true },
  van: { length: 5.95, width: 2.02, height: 2.42, wheelbase: 3.65, wheelRadius: 0.4, clearance: 0.22, belt: 1.12, windshieldBase: 2.08, roofFront: 1.58, roofRear: -2.9, rearGlassBase: -2.95, roofThickness: 0.42, corner: 0.16, tumblehome: 0.05, pillars: [0.55, -0.55], blindFrom: -1.45, lightBar: true },
} as const satisfies Record<string, CarSpec>;
export type CarKind = keyof typeof CAR_SPECS;

export interface CarOptions {
  kind: CarKind;
  paint: number;
  /** Optional decal drawn on both flanks (e.g. the NASA insignia on the crew transport). */
  decal?: THREE.Texture;
}
/** Shared, cached material factory supplied by the scene (so parts can be merged per material). */
export type MaterialFactory = (name: string, color: number, roughness?: number, metalness?: number) => THREE.MeshStandardMaterial;

type Point = readonly [number, number];

/** A closed 2D shape with rounded corners (quadratic blends clipped to half of each edge). */
function roundedShape(points: readonly Point[], radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i + n - 1) % n], cur = points[i], next = points[(i + 1) % n];
    const toPrev = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]), toNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
    const kPrev = Math.min(radius / toPrev, 0.5), kNext = Math.min(radius / toNext, 0.5);
    const ax = cur[0] + (prev[0] - cur[0]) * kPrev, ay = cur[1] + (prev[1] - cur[1]) * kPrev;
    const bx = cur[0] + (next[0] - cur[0]) * kNext, by = cur[1] + (next[1] - cur[1]) * kNext;
    if (i === 0) shape.moveTo(ax, ay); else shape.lineTo(ax, ay);
    shape.quadraticCurveTo(cur[0], cur[1], bx, by);
  }
  shape.closePath();
  return shape;
}

/** Extrudes a side profile across `depth`, centred on X, with the profile's +s pointing to -Z (the front). */
function extrudeProfile(points: readonly Point[], radius: number, depth: number, bevel = 0.035, x = 0): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(points, radius), { depth: Math.max(depth - bevel * 2, 0.01), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  geometry.rotateY(Math.PI / 2);
  geometry.translate(x, 0, 0);
  return geometry;
}

/** Pinches X towards the roof and the nose/tail; computed on the final vertex positions. */
function sculpt(geometry: THREE.BufferGeometry, spec: CarSpec, tumble: number): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const half = spec.length / 2, span = Math.max(spec.height - spec.clearance, 0.01);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), z = position.getZ(i);
    const lean = 1 - tumble * Math.max(0, y - spec.clearance) / span;
    const end = Math.max(0, (Math.abs(z) - (half - 0.7)) / 0.7);
    const nose = 1 - 0.09 * end * end;
    position.setX(i, position.getX(i) * lean * nose);
  }
  position.needsUpdate = true;
  // Smooth the rounded profile but keep the hard creases (bumper edges, window frames).
  const smooth = toCreasedNormals(geometry, 0.75);
  geometry.dispose();
  return smooth;
}

export function buildCar(spec: CarSpec, options: CarOptions, paint: MaterialFactory): THREE.Group {
  const group = new THREE.Group();
  const half = spec.length / 2, width = spec.width;
  const body = paint(`car-paint-${options.paint.toString(16)}`, options.paint, 0.38, 0.15);
  const glass = paint('car-glass', 0x24384a, 0.1, 0.35);
  const trim = paint('car-trim', 0x15181a, 0.55, 0.3);
  const chrome = paint('car-chrome', 0xdfe5e7, 0.28, 0.5);
  const tire = paint('car-tire', 0x16181a, 0.9, 0);
  const brake = paint('car-brake', 0x3a3f42, 0.5, 0.7);
  const headlamp = paint('car-headlamp', 0xf5f7ff, 0.2, 0.2); headlamp.emissive.setHex(0xdfe8ff); headlamp.emissiveIntensity = 0.7;
  const taillamp = paint('car-taillamp', 0xb3141b, 0.3, 0.2); taillamp.emissive.setHex(0xff1822); taillamp.emissiveIntensity = 0.55;
  const plate = paint('car-plate', 0xe9e6d8, 0.6, 0);

  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => add(new THREE.BoxGeometry(w, h, d), material, x, y, z);

  const gc = spec.clearance, belt = spec.belt, top = spec.height;
  const beltTop = belt + 0.08;
  const roofBase = top - spec.roofThickness;
  /** Profile `s` (+ = front) to world Z, and the flank's X at a given height (the body leans in towards the roof). */
  const Z = (s: number): number => -s;
  const flank = (y: number): number => (width / 2) * (1 - spec.tumblehome * 0.35 * Math.max(0, y - gc) / (top - gc));
  const fore = half + 0.045;

  // Lower shell: bumpers, hood, shoulder line and tail in one rounded profile.
  add(sculpt(extrudeProfile([
    [-half + 0.04, gc], [half - 0.04, gc], [half, gc + 0.22], [half, belt - 0.16],
    [half - 0.08, belt - 0.04], [spec.windshieldBase, beltTop],
    [spec.rearGlassBase, beltTop + 0.02], [-half + 0.1, belt + 0.04], [-half, belt - 0.14], [-half, gc + 0.22],
  ], spec.corner, width), spec, spec.tumblehome * 0.35), body);

  // Greenhouse glass, then body-colour roof panel and pillars on top of it.
  const cabin: Point[] = [[spec.windshieldBase, beltTop - 0.02], [spec.roofFront, roofBase], [spec.roofRear, roofBase], [spec.rearGlassBase, beltTop - 0.02]];
  add(sculpt(extrudeProfile(cabin, 0.05, width * 0.9, 0.012), spec, spec.tumblehome), glass);
  add(sculpt(extrudeProfile([[spec.roofFront + 0.04, top], [spec.roofRear - 0.02, top], [spec.roofRear, roofBase], [spec.roofFront, roofBase]], 0.06, width * 0.92, 0.02), spec, spec.tumblehome), body);
  const pillar = (a: Point, b: Point, c: Point, d: Point): void => {
    for (const side of [-1, 1]) add(sculpt(extrudeProfile([a, b, c, d], 0.015, 0.07, 0.01, side * width * 0.455), spec, spec.tumblehome), body);
  };
  pillar([spec.windshieldBase + 0.07, beltTop], [spec.windshieldBase - 0.03, beltTop], [spec.roofFront - 0.03, roofBase], [spec.roofFront + 0.07, roofBase]);
  pillar([spec.rearGlassBase - 0.1, beltTop], [spec.rearGlassBase + 0.02, beltTop], [spec.roofRear + 0.02, roofBase], [spec.roofRear - 0.1, roofBase]);
  for (const s of spec.pillars) pillar([s + 0.05, beltTop], [s - 0.05, beltTop], [s - 0.05, roofBase], [s + 0.05, roofBase]);
  if (spec.blindFrom !== undefined) {
    add(sculpt(extrudeProfile([[spec.blindFrom, beltTop - 0.02], [spec.blindFrom, top - 0.04], [spec.roofRear - 0.06, top - 0.04], [spec.rearGlassBase, beltTop - 0.02]], 0.04, width * 0.93, 0.02), spec, spec.tumblehome), body);
  }
  // Dark underbody and side sills close the gap between wheels so no daylight shows through.
  box(width * 0.86, 0.16, spec.length * 0.9, trim, 0, gc + 0.06, 0);
  for (const side of [-1, 1]) box(0.05, 0.1, spec.wheelbase * 0.8, trim, side * width * 0.5 * 0.97, gc + 0.14, 0);

  // Wheels: tyre, rim with spokes, brake disc and a dark arch disc on the body side.
  const rim = paint('car-rim', 0xd9dfe2, 0.3, 0.45);
  for (const axle of [spec.wheelbase / 2, -spec.wheelbase / 2]) {
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 0.1), r = spec.wheelRadius;
      const wheel = new THREE.Group(); wheel.position.set(x, r, axle); group.add(wheel);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.26, 28), tire); tyre.rotation.z = Math.PI / 2; wheel.add(tyre);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.27, 24), rim); face.rotation.z = Math.PI / 2; wheel.add(face);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.46, r * 0.46, 0.2, 20), brake); disc.rotation.z = Math.PI / 2; wheel.add(disc);
      for (let k = 0; k < 5; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, r * 1.2, r * 0.13), rim);
        spoke.position.x = side * 0.14; spoke.rotation.x = (k * Math.PI * 2) / 5 + Math.PI / 2; wheel.add(spoke);
      }
      for (const m of wheel.children) if (m instanceof THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; }
      const arch = new THREE.Mesh(new THREE.CircleGeometry(r * 1.2, 28), trim);
      arch.rotation.y = side * Math.PI / 2; arch.position.set(side * (flank(r) + 0.006), r, axle); group.add(arch);
    }
  }

  // Lights, grille, plates, mirrors, handles.
  const noseZ = -fore, tailZ = fore;
  if (spec.lightBar) {
    box(width * 0.72, 0.06, 0.04, headlamp, 0, belt - 0.2, noseZ);
    box(width * 0.7, 0.07, 0.04, taillamp, 0, belt - 0.09, tailZ);
  }
  for (const side of [-1, 1]) {
    box(0.36, 0.1, 0.05, headlamp, side * width * 0.36, belt - 0.2, noseZ);
    box(0.3, 0.12, 0.05, taillamp, side * width * 0.38, belt - 0.1, tailZ);
    box(0.1, 0.13, 0.2, body, side * (flank(belt + 0.12) + 0.05), belt + 0.12, Z(spec.windshieldBase - 0.2));
    box(0.02, 0.1, 0.16, trim, side * (flank(belt + 0.12) + 0.105), belt + 0.12, Z(spec.windshieldBase - 0.2));
    for (const s of [0.1, -0.7]) box(0.03, 0.025, 0.2, chrome, side * (flank(belt - 0.08) + 0.01), belt - 0.08, Z(s));
    if (spec.roofRails) {
      box(0.04, 0.04, (spec.roofFront - spec.roofRear) * 0.82, chrome, side * flank(top) * 0.78, top + 0.045, Z((spec.roofFront + spec.roofRear) / 2));
    }
  }
  box(width * 0.5, 0.22, 0.04, trim, 0, gc + 0.34, noseZ);
  for (let i = 0; i < 4; i++) box(width * 0.46, 0.012, 0.045, chrome, 0, gc + 0.27 + i * 0.045, noseZ - 0.002);
  box(0.52, 0.12, 0.03, plate, 0, gc + 0.2, noseZ - 0.015);
  box(0.52, 0.12, 0.03, plate, 0, gc + 0.38, tailZ + 0.015);
  box(width * 0.9, 0.1, 0.18, trim, 0, gc + 0.12, -half + 0.03);
  box(width * 0.9, 0.1, 0.18, trim, 0, gc + 0.12, half - 0.03);

  if (options.decal) {
    const decal = new THREE.MeshBasicMaterial({ map: options.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const size = Math.min(spec.height * 0.38, 0.82);
    for (const side of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decal);
      plane.rotation.y = side * Math.PI / 2;
      plane.position.set(side * (flank(belt - 0.34) + 0.012), belt - 0.34, Z(spec.windshieldBase - 1.2 - size / 2));
      group.add(plane);
    }
  }
  return group;
}
