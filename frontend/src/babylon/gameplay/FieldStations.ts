import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "./AstronautCharacter";

/** World positions are engine independent so the map and POIs share this layout. */
export const FIELD_STATION_LOCATIONS = {
  assembly: { x: 18.5, z: 5.3 },
  mass: { x: 21.5, z: 5.5 },
  calibration: { x: -9.2, z: 8 },
  signal: { x: -9.2, z: 11.2 },
  weather: { x: -5.2, z: 12 },
  recovery: { x: 11.2, z: -25.4 },
} as const;

export const FIELD_ROUTE_POINTS = [
  { id: "route-check-1", x: 11, z: 0 },
  { id: "route-check-2", x: 8, z: -8 },
  { id: "route-check-3", x: 4, z: -20 },
] as const;

export type FieldStationId = keyof typeof FIELD_STATION_LOCATIONS | "route";
type FieldStationDraft = Record<string, string | number | boolean | number[] | string[] | null>;
type Shape = "box" | "cylinder" | "ring" | "sphere";
type MaterialRole = "wood" | "metal" | "brass" | "ivory" | "ink" | "blue" | "green" | "amber";
export interface FieldStationCollider { minX: number; maxX: number; minZ: number; maxZ: number }

/**
 * A compact, project-authored 1926 field kit. Four shared geometries and instanced
 * material batches provide functional silhouettes without new textures, lights
 * or shadow casters. Only large physical footprints enter the collision list.
 */
export function createFieldStations(
  B: BabylonNamespace,
  scene: BABYLON.Scene,
  parent: BABYLON.TransformNode,
  getHeightAt: (x: number, z: number) => number,
) {
  const root = new B.TransformNode("field-station-kit", scene);
  root.parent = parent;
  const geometryRoot = new B.TransformNode("field-station-shared-geometry", scene);
  geometryRoot.parent = root;
  const materials = {} as Record<MaterialRole, BABYLON.PBRMaterial>;
  const materialSpecs: Array<[MaterialRole, string, number, number]> = [
    ["wood", "#796044", 0.91, 0], ["metal", "#39433f", 0.64, 0.55],
    ["brass", "#a58a53", 0.43, 0.72], ["ivory", "#d8cfb2", 0.92, 0],
    ["ink", "#282f2b", 0.88, 0], ["blue", "#526e76", 0.71, 0.15],
    ["green", "#76977b", 0.58, 0.08], ["amber", "#bb8548", 0.7, 0.08],
  ];
  for (const [role, color, roughness, metallic] of materialSpecs) {
    const material = new B.PBRMaterial(`field-kit-${role}`, scene);
    material.albedoColor = B.Color3.FromHexString(color);
    material.roughness = roughness;
    material.metallic = metallic;
    materials[role] = material;
  }

  // A single chamfered unit part gives rails, cabinet edges and cast plates
  // real highlight planes without a separate trim mesh on every box.
  function beveledUnitBox() {
    const positions: number[] = [], indices: number[] = [], normals: number[] = [], uvs: number[] = [];
    const inset = 0.47;
    const vertex = (axisA: number, valueA: number, axisB: number, valueB: number, axisC: number, valueC: number) => {
      const point = [0, 0, 0]; point[axisA] = valueA; point[axisB] = valueB; point[axisC] = valueC; return point;
    };
    function face(points: number[][]) {
      const a = B.Vector3.FromArray(points[0]!), b = B.Vector3.FromArray(points[1]!), c = B.Vector3.FromArray(points[2]!);
      const outward = a.add(b).add(c).scale(1 / 3);
      // Babylon's default left-handed front-face order is clockwise.
      if (B.Vector3.Dot(B.Vector3.Cross(b.subtract(a), c.subtract(a)), outward) > 0) points.reverse();
      const start = positions.length / 3;
      points.forEach((point, i) => { positions.push(...point); uvs.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); });
      for (let i = 1; i < points.length - 1; i++) indices.push(start, start + i, start + i + 1);
    }
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const a = (axis + 1) % 3, b = (axis + 2) % 3;
      face([vertex(axis, sign * 0.5, a, -inset, b, -inset), vertex(axis, sign * 0.5, a, inset, b, -inset),
        vertex(axis, sign * 0.5, a, inset, b, inset), vertex(axis, sign * 0.5, a, -inset, b, inset)]);
    }
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const free = 3 - a - b;
      face([vertex(a, sa * 0.5, b, sb * inset, free, -inset), vertex(a, sa * inset, b, sb * 0.5, free, -inset),
        vertex(a, sa * inset, b, sb * 0.5, free, inset), vertex(a, sa * 0.5, b, sb * inset, free, inset)]);
    }
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      face([[x * 0.5, y * inset, z * inset], [x * inset, y * 0.5, z * inset], [x * inset, y * inset, z * 0.5]]);
    }
    B.VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new B.Mesh("field-kit-box-geometry", scene), data = new B.VertexData();
    data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs;
    data.applyToMesh(mesh);
    return mesh;
  }
  const prototypes: Record<Shape, BABYLON.Mesh> = {
    box: beveledUnitBox(),
    cylinder: B.MeshBuilder.CreateCylinder("field-kit-cylinder-geometry", { height: 1, diameter: 1, tessellation: 16 }, scene),
    ring: B.MeshBuilder.CreateTorus("field-kit-ring-geometry", { diameter: 1, thickness: 0.05, tessellation: 24 }, scene),
    sphere: B.MeshBuilder.CreateSphere("field-kit-sphere-geometry", { diameter: 1, segments: 8 }, scene),
  };
  for (const mesh of Object.values(prototypes)) {
    mesh.parent = geometryRoot;
    mesh.isVisible = false;
    mesh.isPickable = false;
  }
  const batches = new Map<string, BABYLON.Mesh>();
  function part(name: string, shape: Shape, role: MaterialRole, owner: BABYLON.TransformNode,
    x: number, y: number, z: number, sx: number, sy: number, sz: number): BABYLON.InstancedMesh {
    const key = `${shape}-${role}`;
    let source = batches.get(key);
    if (!source) {
      source = prototypes[shape].clone(`field-kit-batch-${key}`, geometryRoot)!;
      source.material = materials[role];
      source.isVisible = false;
      source.isPickable = false;
      source.receiveShadows = true;
      batches.set(key, source);
    }
    const mesh = source.createInstance(`field-kit-${name}`);
    mesh.parent = owner;
    mesh.position.set(x, y, z);
    mesh.scaling.set(sx, sy, sz);
    mesh.isVisible = true;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = true;
    return mesh;
  }
  const box = (name: string, owner: BABYLON.TransformNode, role: MaterialRole,
    x: number, y: number, z: number, w: number, h: number, d: number) => part(name, "box", role, owner, x, y, z, w, h, d);
  const rod = (name: string, owner: BABYLON.TransformNode, role: MaterialRole,
    x: number, y: number, z: number, diameter: number, height: number) => part(name, "cylinder", role, owner, x, y, z, diameter, height, diameter);
  const colliders: FieldStationCollider[] = [];
  const stationRoots = new Map<FieldStationId, BABYLON.TransformNode>();
  function station(id: keyof typeof FIELD_STATION_LOCATIONS, w: number, d: number, collider = true) {
    const position = FIELD_STATION_LOCATIONS[id];
    const stationRoot = new B.TransformNode(`field-${id}-root`, scene);
    stationRoot.parent = root;
    stationRoot.position.set(position.x, getHeightAt(position.x, position.z), position.z);
    const visualRoot = new B.TransformNode(`field-${id}-visualRoot`, scene);
    visualRoot.parent = stationRoot;
    const interactionRoot = new B.TransformNode(`field-${id}-interactionRoot`, scene);
    interactionRoot.parent = stationRoot;
    interactionRoot.position.set(0, 1, -d / 2 - 0.35);
    const collisionRoot = new B.TransformNode(`field-${id}-collisionRoot`, scene);
    collisionRoot.parent = stationRoot;
    if (collider) colliders.push({ minX: position.x - w / 2, maxX: position.x + w / 2, minZ: position.z - d / 2, maxZ: position.z + d / 2 });
    stationRoots.set(id, stationRoot);
    return visualRoot;
  }
  function table(name: string, owner: BABYLON.TransformNode, width: number, depth: number) {
    box(`${name}-worktop`, owner, "wood", 0, 0.96, 0, width, 0.09, depth);
    box(`${name}-front-apron`, owner, "metal", 0, 0.81, -depth / 2 + 0.04, width - 0.12, 0.17, 0.055);
    box(`${name}-lower-crossbar`, owner, "metal", 0, 0.24, 0, width - 0.2, 0.07, 0.07);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const x = side * (width / 2 - 0.11), z = end * (depth / 2 - 0.1);
      box(`${name}-leg-${side}-${end}`, owner, "wood", x, 0.46, z, 0.085, 0.91, 0.085);
      box(`${name}-shoe-${side}-${end}`, owner, "metal", x, 0.035, z, 0.14, 0.06, 0.14);
    }
  }
  function dial(name: string, owner: BABYLON.TransformNode, x: number, y: number, z: number, size: number) {
    const pivot = new B.TransformNode(`field-kit-${name}-dial`, scene);
    pivot.parent = owner;
    pivot.position.set(x, y, z);
    const casing = rod(`${name}-case`, pivot, "metal", 0, 0, 0, size, size * 0.2);
    casing.rotation.x = Math.PI / 2;
    const face = rod(`${name}-face`, pivot, "ivory", 0, 0, -size * 0.113, size * 0.86, size * 0.025);
    face.rotation.x = Math.PI / 2;
    const rim = part(`${name}-bezel`, "ring", "brass", pivot, 0, 0, -size * 0.14, size * 0.96, size * 0.96, size * 0.96);
    rim.rotation.x = Math.PI / 2;
    for (let tick = 0; tick <= 8; tick++) {
      const angle = -Math.PI * 0.72 + tick * Math.PI * 1.44 / 8;
      const mark = box(`${name}-tick-${tick}`, pivot, "ink", Math.sin(angle) * size * 0.33, Math.cos(angle) * size * 0.33, -size * 0.138, size * 0.02, size * 0.075, size * 0.012);
      mark.rotation.z = -angle;
    }
    const needlePivot = new B.TransformNode(`field-kit-${name}-needle-pivot`, scene);
    needlePivot.parent = pivot;
    needlePivot.position.z = -size * 0.16;
    box(`${name}-needle`, needlePivot, "amber", 0, size * 0.13, 0, size * 0.025, size * 0.33, size * 0.025);
    part(`${name}-hub`, "sphere", "brass", needlePivot, 0, 0, -size * 0.01, size * 0.09, size * 0.09, size * 0.06);
    return needlePivot;
  }

  // A low, open assembly jig shows the actual components as they are fitted.
  const assembly = station("assembly", 2.3, 0.95);
  table("assembly", assembly, 2.3, 0.95);
  box("assembly-blueprint", assembly, "blue", 0, 1.015, 0, 1.36, 0.018, 0.61);
  const assemblyPieces: BABYLON.InstancedMesh[] = [];
  for (const side of [-1, 1]) {
    box(`assembly-guide-${side}`, assembly, "ivory", side * 0.56, 1.03, 0, 0.032, 0.012, 0.56);
    assemblyPieces.push(box(`assembly-side-rail-${side}`, assembly, "metal", side * 0.56, 1.09, 0, 0.07, 0.12, 0.56));
  }
  for (const end of [-1, 1]) assemblyPieces.push(box(`assembly-cross-plate-${end}`, assembly, "metal", 0, 1.09, end * 0.235, 1.13, 0.12, 0.065));
  for (const side of [-1, 1]) {
    const ring = part(`assembly-clamp-ring-${side}`, "ring", "brass", assembly, side * 0.3, 1.19, 0, 0.31, 0.31, 0.31);
    ring.rotation.x = Math.PI / 2;
    assemblyPieces.push(ring);
    for (const z of [-0.24, 0.24]) rod(`assembly-bolt-${side}-${z}`, assembly, "brass", side * 0.56, 1.17, z, 0.055, 0.028);
  }
  assemblyPieces.push(box("assembly-registration-marker", assembly, "amber", 0, 1.19, -0.25, 0.2, 0.065, 0.055));
  const assemblyRestY = assemblyPieces.map(piece => piece.position.y);
  const assemblyGroups = [[0, 1], [2, 3], [4, 5], [6]];
  box("assembly-parts-tray", assembly, "metal", 0.91, 1.03, 0, 0.27, 0.055, 0.6);
  for (let i = 0; i < 3; i++) box(`assembly-spare-${i}`, assembly, "brass", 0.91, 1.075, -0.18 + i * 0.18, 0.16, 0.035, 0.09);

  // A mechanical two-pan balance, with pivoted beam and visible calibration mass.
  const mass = station("mass", 1.25, 0.9);
  table("mass", mass, 1.25, 0.9);
  box("mass-cast-base", mass, "blue", 0, 1.04, 0, 0.76, 0.09, 0.51);
  rod("mass-column", mass, "brass", 0, 1.35, 0, 0.065, 0.58);
  const balancePivot = new B.TransformNode("field-kit-balance-pivot", scene);
  balancePivot.parent = mass;
  balancePivot.position.set(0, 1.62, 0);
  box("mass-balance-beam", balancePivot, "brass", 0, 0, 0, 1.02, 0.055, 0.055);
  const pans: BABYLON.TransformNode[] = [];
  const loadBlocks: BABYLON.InstancedMesh[] = [];
  for (const side of [-1, 1]) {
    const pan = new B.TransformNode(`field-kit-balance-pan-${side}`, scene);
    pan.parent = balancePivot;
    pan.position.set(side * 0.45, 0, 0);
    rod(`mass-pan-hanger-${side}`, pan, "metal", 0, -0.14, 0, 0.018, 0.28);
    rod(`mass-pan-${side}`, pan, "metal", 0, -0.285, 0, 0.34, 0.035);
    for (let i = 0; i < 2; i++) loadBlocks.push(box(`mass-load-${side}-${i}`, pan, "wood", (i - 0.5) * 0.12, -0.23, 0, 0.1, 0.07 + loadBlocks.length * 0.02, 0.12));
    pans.push(pan);
  }
  const massNeedle = dial("mass", mass, 0, 1.17, -0.3, 0.23);

  // Three independent analogue channels on a protected blue instrument panel.
  const calibration = station("calibration", 1.25, 0.72);
  table("calibration", calibration, 1.25, 0.72);
  box("calibration-case", calibration, "wood", 0, 1.22, 0.04, 1.1, 0.39, 0.34);
  box("calibration-faceplate", calibration, "blue", 0, 1.23, -0.145, 1.05, 0.34, 0.025);
  const calibrationNeedles: BABYLON.TransformNode[] = [];
  const calibrationRecords: Array<{ pending: BABYLON.InstancedMesh; ready: BABYLON.InstancedMesh }> = [];
  for (let i = 0; i < 3; i++) {
    calibrationNeedles.push(dial(`calibration-${i}`, calibration, -0.34 + i * 0.34, 1.25, -0.18, 0.27));
    const knob = rod(`calibration-knob-${i}`, calibration, "brass", -0.34 + i * 0.34, 1.055, -0.19, 0.075, 0.06);
    knob.rotation.x = Math.PI / 2;
    calibrationRecords.push({
      pending: box(`calibration-${i}-pending`, calibration, "amber", -0.34 + i * 0.34, 1.443, -0.18, 0.12, 0.025, 0.03),
      ready: box(`calibration-${i}-recorded`, calibration, "green", -0.34 + i * 0.34, 1.45, -0.18, 0.12, 0.05, 0.03),
    });
  }

  // Six terminal sockets make both the valid path and decoy nodes visible.
  const signal = station("signal", 1.16, 0.7);
  table("signal", signal, 1.16, 0.7);
  box("signal-case", signal, "wood", 0, 1.2, 0.02, 1.02, 0.34, 0.3);
  box("signal-faceplate", signal, "blue", 0, 1.21, -0.145, 0.98, 0.3, 0.025);
  const signalConnections: BABYLON.InstancedMesh[] = [];
  const signalNodePositions = [[-0.43, 1.21], [-0.16, 1.31], [-0.16, 1.11], [0.16, 1.31], [0.16, 1.11], [0.43, 1.21]];
  const signalPath = [0, 1, 3, 5];
  for (let i = 0; i < 6; i++) {
    const [x, y] = signalNodePositions[i]!;
    const terminal = rod(`signal-terminal-${i}`, signal, "ivory", x, y, -0.18, 0.075, 0.05);
    terminal.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < signalPath.length - 1; i++) {
    const a = signalNodePositions[signalPath[i]!]!, b = signalNodePositions[signalPath[i + 1]!]!;
    const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!;
    const cable = box(`signal-continuity-${i}`, signal, "brass", (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2, -0.225, Math.hypot(dx, dy), 0.018, 0.018);
    cable.rotation.z = Math.atan2(dy, dx);
    signalConnections.push(cable);
  }

  // Companion gauge and windsock extend the existing anemometer at (-6, 12).
  const weather = station("weather", 0.88, 0.66);
  box("weather-cabinet", weather, "wood", 0, 0.72, 0, 0.74, 1.25, 0.52);
  box("weather-rain-cap", weather, "metal", 0, 1.39, 0, 0.88, 0.07, 0.66);
  for (let i = 0; i < 4; i++) box(`weather-louvre-${i}`, weather, "ivory", 0, 0.55 + i * 0.12, -0.278, 0.63, 0.055, 0.045);
  const weatherNeedle = dial("weather", weather, 0, 1.15, -0.29, 0.29);
  rod("weather-flag-mast", weather, "metal", 0.48, 1.15, 0.08, 0.032, 2.3);
  const flagPivot = new B.TransformNode("field-kit-weather-flag-pivot", scene);
  flagPivot.parent = weather;
  flagPivot.position.set(0.48, 2.17, 0.08);
  // A tapered ribbon gives wind a readable shape without transparent cloth.
  const flag = new B.TransformNode("field-kit-weather-flag", scene);
  flag.parent = flagPivot;
  for (let i = 0; i < 3; i++) box(`weather-windsock-${i}`, flag, i % 2 ? "ivory" : "amber", 0.1 + i * 0.16, -0.04 - i * 0.035, 0, 0.17, 0.15 - i * 0.025, 0.025);

  // A standing file rack augments the existing analysis desk, rather than
  // placing another table or obstruction inside its awning.
  const recovery = station("recovery", 0, 0, false);
  box("recovery-log-rack", recovery, "wood", 0, 1.35, 0.32, 0.83, 0.65, 0.06);
  box("recovery-rack-ledge", recovery, "metal", 0, 1.07, 0.25, 0.89, 0.045, 0.18);
  const recordCards: BABYLON.TransformNode[] = [];
  const recordIds = ["recorder", "liftoff", "peak", "distance"];
  for (let i = 0; i < recordIds.length; i++) {
    const card = new B.TransformNode(`field-kit-recovery-record-${recordIds[i]}`, scene);
    card.parent = recovery;
    card.position.set(-0.3 + i * 0.2, 1.38, 0.265);
    box(`recovery-record-card-${i}`, card, "ivory", 0, 0, 0, 0.17, 0.43, 0.012);
    recordCards.push(card);
    box(`recovery-record-clip-${i}`, card, "brass", 0, 0.21, -0.015, 0.075, 0.065, 0.02);
    for (let row = 0; row < 3; row++) box(`recovery-record-trace-${i}-${row}`, card, "ink", 0, 0.06 - row * 0.08, -0.013, 0.12 - (row % 2) * 0.04, 0.012, 0.007);
    for (let mark = 0; mark <= i; mark++) box(`recovery-record-identity-${i}-${mark}`, card, "ink", (mark - i / 2) * 0.032, 0.13, -0.013, 0.014, 0.035, 0.007);
  }

  const routeSignals: Array<{ pending: BABYLON.InstancedMesh; ready: BABYLON.InstancedMesh }> = [];
  for (let i = 0; i < FIELD_ROUTE_POINTS.length; i++) {
    const point = FIELD_ROUTE_POINTS[i]!;
    const routeRoot = new B.TransformNode(`field-${point.id}-root`, scene);
    routeRoot.parent = root;
    routeRoot.position.set(point.x, getHeightAt(point.x, point.z), point.z);
    const visualRoot = new B.TransformNode(`field-${point.id}-visualRoot`, scene);
    visualRoot.parent = routeRoot;
    for (const kind of ["interactionRoot", "collisionRoot"]) {
      const child = new B.TransformNode(`field-${point.id}-${kind}`, scene);
      child.parent = routeRoot;
    }
    rod(`route-${i}-post`, visualRoot, "wood", 0, 0.55, 0, 0.06, 1.1);
    box(`route-${i}-sign`, visualRoot, "metal", 0, 0.95, 0, 0.4, 0.28, 0.045);
    // Each inspection point has one, two or three brass studs, so state and
    // identity remain legible without relying exclusively on color.
    for (let stud = 0; stud <= i; stud++) {
      const dot = rod(`route-${i}-identity-${stud}`, visualRoot, "ivory", (stud - i / 2) * 0.09, 0.97, -0.03, 0.045, 0.018);
      dot.rotation.x = Math.PI / 2;
    }
    const pending = box(`route-${i}-pending`, visualRoot, "amber", 0, 0.84, -0.035, 0.27, 0.035, 0.015);
    const ready = box(`route-${i}-confirmed`, visualRoot, "green", 0, 0.84, -0.04, 0.27, 0.05, 0.02);
    routeSignals.push({ pending, ready });
    // A small check tab physically rises when the point is inspected.
    ready.position.x = 0.025;
    ready.rotation.z = -0.15;
  }

  let balanceTarget = 0.18;
  let calibrationProgress = 0;
  let weatherValue = 0.22;
  let weatherSpeed = 0.7;
  let weatherAngle = -0.25;
  let animationTime = 0;
  let disposed = false;
  function setRouteInspection(inspectedIds: readonly string[]) {
    routeSignals.forEach(({ pending, ready }, i) => {
      const confirmed = inspectedIds.includes(FIELD_ROUTE_POINTS[i]!.id);
      pending.setEnabled(!confirmed);
      ready.setEnabled(confirmed);
    });
  }
  function setProgress(id: FieldStationId, progress: number, value = progress) {
    const amount = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    const reading = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : amount;
    if (id === "assembly") assemblyPieces.forEach((piece, i) => {
      const fitted = i < Math.round(amount * assemblyPieces.length);
      if (fitted && !piece.isEnabled()) piece.position.y = assemblyRestY[i]! + 0.12;
      piece.setEnabled(fitted);
    });
    if (id === "mass") { balanceTarget = amount >= 1 ? 0 : (reading - 0.5) * 0.55; massNeedle.rotation.z = balanceTarget * 3; }
    if (id === "calibration") {
      calibrationProgress = amount;
      calibrationNeedles.forEach((needle, i) => { needle.rotation.z = (i + 1) / 3 <= amount ? 0 : (reading - 0.5) * 1.8; });
      calibrationRecords.forEach(({ pending, ready }, i) => {
        const registered = (i + 1) / 3 <= amount;
        pending.setEnabled(!registered); ready.setEnabled(registered);
      });
    }
    if (id === "signal") signalConnections.forEach((cable, i) => cable.setEnabled((i + 1) / signalConnections.length <= amount));
    if (id === "route") setRouteInspection(FIELD_ROUTE_POINTS.slice(0, Math.round(amount * FIELD_ROUTE_POINTS.length)).map(point => point.id));
    if (id === "weather") weatherNeedle.rotation.z = amount >= 1 ? (weatherValue - 0.5) * 1.6 : (reading - 0.5) * 1.6;
    if (id === "recovery") recordCards.forEach((card, i) => { card.position.y = 1.38 + ((i + 1) / recordCards.length <= amount ? 0.025 : 0); card.rotation.z = (i + 1) / recordCards.length <= amount ? 0 : (i - 1.5) * 0.06; });
  }
  /** Exact identities override aggregate progress after each persisted UI edit. */
  function setDraft(id: FieldStationId, draft: FieldStationDraft) {
    const numberAt = (value: FieldStationDraft[string], index: number, fallback: number) =>
      Array.isArray(value) && typeof value[index] === "number" && Number.isFinite(value[index]) ? Number(value[index]) : fallback;
    if (id === "assembly") {
      assemblyGroups.forEach((indices, group) => {
        const fitted = numberAt(draft.placements, group, -1) === group;
        for (const i of indices) {
          const piece = assemblyPieces[i]!;
          if (fitted && !piece.isEnabled()) piece.position.y = assemblyRestY[i]! + 0.12;
          piece.setEnabled(fitted);
        }
      });
    }
    if (id === "mass") {
      const arms = [-2, -1, 1, 2], occupied = new Set<number>();
      let torque = 0;
      loadBlocks.forEach((block, i) => {
        const position = numberAt(draft.positions, i, -1);
        const placed = Number.isInteger(position) && position >= 0 && position < arms.length && !occupied.has(position);
        if (placed) {
          occupied.add(position); torque += (i + 1) * arms[position]!;
          block.parent = pans[position < 2 ? 0 : 1]!;
          block.position.set((position % 2 - 0.5) * 0.13, -0.267 + block.scaling.y / 2, 0);
        } else {
          block.parent = mass;
          block.position.set(-0.4 + i * 0.25, 1.005 + block.scaling.y / 2, 0.32);
        }
      });
      balanceTarget = Math.max(-0.26, Math.min(0.26, torque * 0.035));
      massNeedle.rotation.z = Math.max(-0.8, Math.min(0.8, torque * 0.1));
    }
    if (id === "calibration") {
      let registeredCount = 0;
      calibrationNeedles.forEach((needle, i) => {
        const value = Math.max(0, Math.min(100, numberAt(draft.values, i, 12)));
        const registered = numberAt(draft.recorded, i, 0) === 1;
        needle.rotation.z = (value - 50) / 50 * 1.2;
        calibrationRecords[i]!.pending.setEnabled(!registered);
        calibrationRecords[i]!.ready.setEnabled(registered);
        if (registered) registeredCount++;
      });
      calibrationProgress = registeredCount / calibrationNeedles.length;
    }
    if (id === "signal") {
      const path = Array.isArray(draft.path) ? draft.path : [];
      signalConnections.forEach((cable, i) => cable.setEnabled(path.length > i + 1 && path.slice(0, i + 2).every((node, j) => node === signalPath[j])));
    }
    if (id === "weather" && typeof draft.reading === "number" && Number.isFinite(draft.reading)) {
      weatherNeedle.rotation.z = (Math.max(0, Math.min(100, draft.reading)) / 100 - 0.5) * 1.6;
    }
    if (id === "recovery") {
      const order = Array.isArray(draft.order) && draft.order.length === recordIds.length &&
        new Set<unknown>(draft.order).size === recordIds.length && draft.order.every(value => typeof value === "string" && recordIds.includes(value))
        ? draft.order as string[] : recordIds;
      recordCards.forEach((card, i) => {
        const slot = order.indexOf(recordIds[i]!);
        card.position.x = -0.3 + slot * 0.2;
        card.position.y = draft.registered === true ? 1.405 : 1.38;
        card.rotation.z = draft.registered === true ? 0 : (slot - i) * 0.035;
      });
    }
  }
  function reset() {
    for (const id of ["assembly", "mass", "calibration", "signal", "route", "weather", "recovery"] as const) setProgress(id, 0);
    setDraft("mass", {});
    setDraft("recovery", {});
    balanceTarget = 0.18;
    balancePivot.rotation.z = balanceTarget;
    animationTime = 0;
    flagPivot.rotation.y = weatherAngle;
    flag.rotation.z = -weatherSpeed * 0.1;
  }
  reset();
  return {
    root,
    colliders,
    setProgress,
    setDraft,
    setRouteInspection,
    setWeather(weatherState: string) {
      const windy = weatherState === "WINDY";
      weatherValue = windy ? 0.82 : weatherState === "LIGHT MIST" ? 0.58 : weatherState === "CLOUDY" ? 0.4 : 0.22;
      weatherSpeed = windy ? 2 : weatherState === "LIGHT MIST" ? 1.1 : 0.7;
      weatherAngle = windy ? 0.7 : -0.25;
      weatherNeedle.rotation.z = (weatherValue - 0.5) * 1.6;
    },
    update(dt: number, active = true, reducedMotion = false) {
      if (disposed || !active) return;
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      const settle = reducedMotion ? 1 : 1 - Math.exp(-7 * step);
      assemblyPieces.forEach((piece, i) => {
        if (piece.isEnabled() && Math.abs(piece.position.y - assemblyRestY[i]!) > 0.0001) {
          piece.position.y += (assemblyRestY[i]! - piece.position.y) * settle;
        }
      });
      balancePivot.rotation.z += (balanceTarget - balancePivot.rotation.z) * settle;
      for (const pan of pans) pan.rotation.z = -balancePivot.rotation.z;
      if (reducedMotion) {
        flagPivot.rotation.y = weatherAngle;
        flag.rotation.z = -weatherSpeed * 0.1;
      } else {
        animationTime += step;
        flagPivot.rotation.y = weatherAngle + Math.sin(animationTime * weatherSpeed * 1.1) * 0.1;
        flag.rotation.z = -weatherSpeed * 0.1 + Math.sin(animationTime * weatherSpeed * 2.1) * 0.035;
      }
    },
    reset,
    /** The whole kit owns these resources; prototypes share exactly four geometries. */
    dispose() {
      if (disposed) return;
      disposed = true;
      root.dispose();
      for (const material of Object.values(materials)) material.dispose();
      batches.clear();
      stationRoots.clear();
    },
    getDiagnostics() {
      return { materialBatches: batches.size, sharedGeometries: 4, materials: Object.keys(materials).length, textures: 0, shadowCasters: 0, calibrationProgress };
    },
  };
}
