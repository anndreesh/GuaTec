import type * as BABYLON from "@babylonjs/core";

/** Babylon.js module shape as returned by the dynamic import. */
export type BabylonNamespace = typeof BABYLON;
export interface AstronautCharacter {
  root: BABYLON.TransformNode;
  setMovementState(walking: boolean, running: boolean): void;
  setAttention(attending: boolean): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}
export interface CharacterOptions {
  coatColor?: string;
  trouserColor?: string;
  role?: "engineer" | "director" | "propulsion" | "structural" | "data";
}

type SharedMaterial = { material: BABYLON.PBRMaterial; users: number };
const sceneMaterials = new WeakMap<BABYLON.Scene, Map<string, SharedMaterial>>();

/** Tailored 1920s field clothing, with a small articulated rig and shared materials. */
export function createAstronautCharacter(B: BabylonNamespace, scene: BABYLON.Scene, options: CharacterOptions = {}): AstronautCharacter {
  const root = new B.TransformNode("field-engineer-root", scene);
  let cache = sceneMaterials.get(scene);
  if (!cache) { cache = new Map(); sceneMaterials.set(scene, cache); }
  const acquired: string[] = [];
  const material = (name: string, color: string, roughness: number, metallic = 0, wool = false) => {
    const key = `${name}-${color}`;
    let entry = cache!.get(key);
    if (!entry) {
      const mat = new B.PBRMaterial(key, scene);
      mat.albedoColor = B.Color3.FromHexString(color); mat.roughness = roughness; mat.metallic = metallic;
      if (wool) mat.albedoTexture = createWoolTexture(B, scene);
      entry = { material: mat, users: 0 }; cache!.set(key, entry);
    }
    entry.users++; acquired.push(key);
    return entry.material;
  };
  const colors = { director: "#232931", propulsion: "#4e3825", structural: "#3e4752", data: "#2e3b33", engineer: "#f2f2ef" };
  const coat = material("field-wool", options.coatColor ?? colors[options.role ?? "engineer"], 0.95, 0, true);
  const shirt = material("field-cotton", "#c9c1ae", 0.96);
  const trousers = material("field-trousers", options.trouserColor ?? "#3c443f", 0.97);
  const leather = material("field-worn-leather", "#493126", 0.7);
  const sole = material("field-rubber-and-face-detail", "#24221e", 0.9);
  const skin = material("field-skin", "#bc8c70", 0.84);
  const brass = material("field-brass", "#917446", 0.48, 0.75);
  const meshGroups = new Map<BABYLON.TransformNode, Map<BABYLON.Material, BABYLON.Mesh[]>>();
  const own = (mesh: BABYLON.Mesh, mat: BABYLON.Material, parent = root) => {
    mesh.material = mat; mesh.parent = parent; mesh.isPickable = false; mesh.receiveShadows = true;
    let group = meshGroups.get(parent); if (!group) { group = new Map(); meshGroups.set(parent, group); }
    const meshes = group.get(mat) ?? []; meshes.push(mesh); group.set(mat, meshes);
    return mesh;
  };
  const sphere = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: BABYLON.Material, parent = root) => {
    const m = own(B.MeshBuilder.CreateSphere(name, { diameter: 1, segments: 12 }, scene), mat, parent);
    m.position.set(x, y, z); m.scaling.set(sx, sy, sz); return m;
  };
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: BABYLON.Material, parent = root) => {
    const m = own(B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), mat, parent);
    m.position.set(x, y, z); return m;
  };
  const capsule = (name: string, length: number, radius: number, mat: BABYLON.Material, parent: BABYLON.TransformNode) => {
    const m = own(B.MeshBuilder.CreateCapsule(name, { height: length, radius, tessellation: 10, subdivisions: 1, capSubdivisions: 3 }, scene), mat, parent);
    m.position.y = -length / 2; return m;
  };
  const pivot = (name: string, x: number, y: number, z: number, parent = root) => {
    const node = new B.TransformNode(name, scene); node.position.set(x, y, z); node.parent = parent; return node;
  };
  const headPivot = pivot("engineer-head-pivot", 0, 1.61, 0);
  const headSphere = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: BABYLON.Material) =>
    sphere(name, x, y - 1.61, z, sx, sy, sz, mat, headPivot);
  const headBox = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: BABYLON.Material) =>
    box(name, x, y - 1.61, z, w, h, d, mat, headPivot);
  // Adult proportions: narrow pelvis, tailored waist, shoulders above the rib cage.
  const profile = [[0.17, 0.83], [0.185, 0.91], [0.155, 1.06], [0.185, 1.25], [0.205, 1.36], [0.16, 1.42], [0.078, 1.46]];
  const body = own(B.MeshBuilder.CreateLathe("engineer-tailored-coat", { shape: profile.map(([r, y]) => new B.Vector3(r, y, 0)), tessellation: 20, cap: B.Mesh.CAP_ALL }, scene), coat);
  body.scaling.z = 0.63;
  box("engineer-shirt-opening", 0, 1.33, 0.113, 0.105, 0.23, 0.018, shirt);
  // Lapels use a cut polygon rather than slabs; the neckline follows the shirt.
  for (const side of [-1, 1]) {
    const lapel = new B.Mesh(`engineer-notched-lapel-${side}`, scene);
    const v = new B.VertexData();
    v.positions = [side * 0.045, 1.46, 0.09, side * 0.14, 1.39, 0.12, side * 0.1, 1.34, 0.13, side * 0.15, 1.33, 0.127, side * 0.035, 1.16, 0.116];
    v.indices = side > 0 ? [0, 2, 1, 0, 4, 2, 2, 4, 3] : [0, 1, 2, 0, 2, 4, 2, 3, 4]; v.normals = [];
    v.uvs = [0.3, 1, 1, 0.8, 0.7, 0.65, 1, 0.6, 0.2, 0];
    B.VertexData.ComputeNormals(v.positions, v.indices, v.normals); v.applyToMesh(lapel); own(lapel, coat);
    box(`engineer-pocket-welt-${side}`, side * 0.11, 1.02, 0.116, 0.1, 0.018, 0.018, leather);
    const collar = box(`engineer-shirt-collar-${side}`, side * 0.035, 1.44, 0.075, 0.07, 0.05, 0.025, shirt); collar.rotation.z = side * 0.35;
  }
  box("engineer-coat-center-seam", 0.012, 1.08, 0.121, 0.005, 0.33, 0.006, leather);
  for (let i = 0; i < 3; i++) sphere(`engineer-coat-button-${i}`, 0.025, 0.99 + i * 0.12, 0.129, 0.017, 0.017, 0.01, brass);
  // A cross-body satchel is fitted to the hip, with a curved strap and rounded pouch.
  own(B.MeshBuilder.CreateTube("engineer-satchel-strap", { path: [new B.Vector3(0.15, 1.4, 0.09), new B.Vector3(0.02, 1.2, 0.14), new B.Vector3(-0.19, 0.92, 0.1)], radius: 0.012, tessellation: 6 }, scene), leather);
  sphere("engineer-worn-satchel", -0.19, 0.94, 0.035, 0.15, 0.22, 0.095, leather);
  box("engineer-satchel-flap", -0.19, 1.01, 0.087, 0.12, 0.065, 0.014, leather);
  box("engineer-satchel-buckle", -0.19, 1.005, 0.098, 0.025, 0.028, 0.011, brass);
  // A seven-and-a-half-head silhouette; cap band touches the brow and hairline.
  sphere("engineer-neck", 0, 1.49, 0, 0.09, 0.12, 0.09, skin);
  headSphere("engineer-head", 0, 1.635, 0.002, 0.16, 0.235, 0.17, skin);
  headSphere("engineer-jaw", 0, 1.565, 0.022, 0.132, 0.095, 0.135, skin);
  const eyeMeshes: BABYLON.Mesh[] = [];
  for (const side of [-1, 1]) {
    headSphere(`engineer-ear-${side}`, side * 0.081, 1.635, 0, 0.027, 0.052, 0.024, skin);
    const eyeSocket = pivot(`engineer-eye-socket-${side}`, side * 0.032, 1.654 - 1.61, 0.080, headPivot);
    eyeMeshes.push(sphere(`engineer-eye-${side}`, 0, 0, 0, 0.018, 0.008, 0.008, sole, eyeSocket));
    const brow = headBox(`engineer-brow-${side}`, side * 0.033, 1.673, 0.077, 0.028, 0.005, 0.007, sole); brow.rotation.z = side * 0.07;
  }
  headSphere("engineer-nose-bridge", 0, 1.637, 0.084, 0.021, 0.045, 0.025, skin);
  headSphere("engineer-nose-tip", 0, 1.619, 0.099, 0.028, 0.02, 0.025, skin);
  own(B.MeshBuilder.CreateTube("engineer-mouth", { path: [new B.Vector3(-0.021, 1.589 - 1.61, 0.087), new B.Vector3(0, 1.587 - 1.61, 0.091), new B.Vector3(0.021, 1.589 - 1.61, 0.087)], radius: 0.0025, tessellation: 5 }, scene), sole, headPivot);
  headSphere("engineer-flat-cap-crown", 0, 1.744, 0.011, 0.194, 0.105, 0.203, coat);
  headSphere("engineer-flat-cap-visor", 0, 1.716, 0.074, 0.167, 0.013, 0.159, coat);
  const band = own(B.MeshBuilder.CreateCylinder("engineer-cap-sewn-band", { diameter: 0.176, height: 0.018, tessellation: 16 }, scene), leather, headPivot);
  band.position.y = 1.712 - 1.61; band.scaling.z = 0.92;

  const legs = [-1, 1].map(side => {
    const hip = pivot(`engineer-hip-${side}`, side * 0.091, 0.89, 0);
    const thigh = capsule(`engineer-trouser-thigh-${side}`, 0.41, 0.076, trousers, hip); thigh.scaling.z = 0.94;
    const knee = pivot(`engineer-knee-${side}`, 0, -0.385, 0, hip);
    const shin = capsule(`engineer-trouser-calf-${side}`, 0.38, 0.059, trousers, knee); shin.scaling.z = 0.9;
    const boot = pivot(`engineer-ankle-${side}`, 0, -0.475, 0.018, knee);
    sphere(`engineer-boot-upper-${side}`, 0, 0.06, -0.003, 0.105, 0.16, 0.115, leather, boot);
    sphere(`engineer-boot-toecap-${side}`, 0, 0.018, 0.048, 0.115, 0.082, 0.225, leather, boot);
    sphere(`engineer-boot-sole-${side}`, 0, -0.012, 0.04, 0.121, 0.03, 0.232, sole, boot);
    box(`engineer-boot-heel-${side}`, 0, -0.021, -0.027, 0.092, 0.025, 0.07, sole, boot);
    for (let lace = 0; lace < 3; lace++) box(`engineer-boot-lace-${side}-${lace}`, 0, 0.052 + lace * 0.019, 0.053 - lace * 0.01, 0.048, 0.004, 0.009, sole, boot);
    return { hip, knee, boot };
  });
  const arms = [-1, 1].map(side => {
    const shoulder = pivot(`engineer-shoulder-${side}`, side * 0.207, 1.366, 0);
    shoulder.rotation.z = side * 0.065;
    capsule(`engineer-upper-sleeve-${side}`, 0.275, 0.064, coat, shoulder);
    const elbow = pivot(`engineer-elbow-${side}`, 0, -0.26, 0, shoulder);
    elbow.rotation.x = -0.12;
    capsule(`engineer-forearm-sleeve-${side}`, 0.245, 0.049, coat, elbow);
    sphere(`engineer-sleeve-cuff-${side}`, 0, -0.225, 0, 0.09, 0.055, 0.085, coat, elbow);
    sphere(`engineer-gloved-hand-${side}`, 0, -0.29, 0.006, 0.071, 0.117, 0.052, leather, elbow);
    sphere(`engineer-glove-thumb-${side}`, -side * 0.029, -0.275, 0.017, 0.03, 0.057, 0.033, leather, elbow);
    return { shoulder, elbow };
  });
  // Each joint retains its own motion, while details sharing a material become
  // one draw instead of a draw per button, facial feature, cuff or boot lace.
  for (const [parent, groups] of meshGroups) for (const [mat, meshes] of groups) {
    if (meshes.length < 2) continue;
    parent.computeWorldMatrix(true);
    const merged = B.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (!merged) continue;
    merged.bakeTransformIntoVertices(parent.getWorldMatrix().clone().invert());
    merged.parent = parent; merged.material = mat; merged.isPickable = false; merged.receiveShadows = true;
    merged.name = `${parent.name}-${mat.name}-details`;
  }

  let walking = false; let running = false; let attending = false; let phase = 0; let stride = 0; let blinkClock = 0; let blinkAmount = 0; let disposed = false;
  return {
    root,
    setMovementState(nextWalking, nextRunning) { walking = nextWalking; running = nextRunning && nextWalking; },
    setAttention(value) { attending = value; },
    update(deltaSeconds) {
      const dt = Math.max(0, Math.min(deltaSeconds, 0.05));
      stride += ((walking ? 1 : 0) - stride) * (1 - Math.exp(-11 * dt));
      phase += dt * (walking ? running ? 11 : 7.5 : 1.6);
      const swing = Math.sin(phase) * stride * (running ? 0.66 : 0.43);
      legs.forEach((leg, i) => {
        const opposite = i === 0 ? 1 : -1;
        leg.hip.rotation.x = swing * opposite;
        leg.knee.rotation.x = Math.max(0, -Math.sin(phase + i * Math.PI)) * stride * (running ? 0.9 : 0.48);
        leg.boot.rotation.x = -leg.knee.rotation.x * 0.36;
      });
      arms.forEach((arm, i) => {
        const side = i === 0 ? -1 : 1;
        const breathing = Math.sin(phase * 0.5 + i * 0.7) * 0.018;
        arm.shoulder.rotation.x = swing * (side * -0.68) + breathing;
        arm.shoulder.rotation.z = side * (0.065 + Math.sin(phase * 0.5) * 0.012);
        arm.elbow.rotation.x = -0.12 - (running ? 0.62 : 0.12) * stride + Math.sin(phase * 0.5 + i) * 0.012;
      });
      headPivot.rotation.y += ((attending ? Math.sin(phase * 0.42) * 0.055 : Math.sin(phase * 0.3) * 0.025) - headPivot.rotation.y) * (1 - Math.exp(-3 * dt));
      headPivot.rotation.x += ((attending ? -0.035 : Math.sin(phase * 0.5) * 0.018) - headPivot.rotation.x) * (1 - Math.exp(-2.5 * dt));
      blinkClock += dt;
      if (blinkClock > 3.2 + (options.role === "director" ? 0.8 : 0)) { blinkClock = 0; blinkAmount = 0.12; }
      blinkAmount = Math.max(0, blinkAmount - dt);
      const eyeOpen = 1 - Math.sin((1 - blinkAmount / 0.12) * Math.PI) * 0.92;
      for (const eye of eyeMeshes) eye.scaling.y = 0.008 * Math.max(0.08, eyeOpen);
    },
    dispose() {
      if (disposed) return; disposed = true;
      root.dispose();
      for (const key of acquired) {
        const entry = cache!.get(key);
        if (entry && --entry.users === 0) { entry.material.dispose(false, true); cache!.delete(key); }
      }
    },
  };
}

function createWoolTexture(B: BabylonNamespace, scene: BABYLON.Scene): BABYLON.Texture {
  const texture = new B.DynamicTexture("field-neutral-wool-weave", { width: 128, height: 128 }, scene, true);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#c9c5ba"; ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) for (let x = 0; x < 128; x += 2) {
    ctx.fillStyle = (x + y) % 4 === 0 ? "rgba(30,26,21,.13)" : "rgba(255,255,255,.09)";
    ctx.fillRect(x, y, 2, 1);
  }
  texture.update(); texture.wrapU = B.Texture.WRAP_ADDRESSMODE; texture.wrapV = B.Texture.WRAP_ADDRESSMODE;
  return texture;
}
