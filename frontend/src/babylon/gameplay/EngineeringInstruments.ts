import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "./AstronautCharacter";

export type EngineeringFeedbackKind = "circuits" | "antenna" | "propulsion" | "diagnostic" | "launch";

/** Interpretive training apparatus: original authored geometry, not historical equipment. */
export function createEngineeringInstruments(B: BabylonNamespace, scene: BABYLON.Scene, parent: BABYLON.TransformNode, groundY: number) {
  const root = new B.TransformNode("interpretive-engineering-training-apparatus", scene);
  root.parent = parent;
  root.position.set(-6, groundY, 10.6);
  const metal = new B.PBRMaterial("training-instrument-cast-metal", scene);
  metal.albedoColor = B.Color3.FromHexString("#37413e"); metal.metallic = 0.65; metal.roughness = 0.56;
  const copper = new B.PBRMaterial("training-instrument-brushed-copper", scene);
  copper.albedoColor = B.Color3.FromHexString("#a46f43"); copper.metallic = 0.86; copper.roughness = 0.34;
  const porcelain = new B.PBRMaterial("training-terminal-porcelain", scene);
  porcelain.albedoColor = B.Color3.FromHexString("#d0c5ab"); porcelain.roughness = 0.29;
  const wood = new B.PBRMaterial("training-case-bakelite", scene);
  wood.albedoColor = B.Color3.FromHexString("#33271f"); wood.roughness = 0.66;
  const signals = Array.from({ length: 5 }, (_, i) => {
    const mat = new B.PBRMaterial(`training-status-lamp-${i}`, scene);
    mat.albedoColor = B.Color3.FromHexString("#80562c"); mat.emissiveColor = B.Color3.FromHexString("#301a08"); mat.roughness = 0.26;
    return mat;
  });
  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: BABYLON.Material) => {
    const mesh = B.MeshBuilder.CreateBox(`training-${name}`, { width: w, height: h, depth: d }, scene);
    mesh.parent = root; mesh.position.set(x, y, z); mesh.material = mat; mesh.isPickable = false; mesh.receiveShadows = true;
    return mesh;
  };
  const rod = (name: string, from: BABYLON.Vector3, to: BABYLON.Vector3, radius: number, mat: BABYLON.Material, parentNode = root) => {
    const mesh = B.MeshBuilder.CreateTube(`training-${name}`, { path: [from, to], radius, tessellation: 8 }, scene);
    mesh.material = mat; mesh.parent = parentNode; mesh.isPickable = false;
    return mesh;
  };
  // A stable three-legged field stand, joined by a low triangular brace.
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    rod(`tripod-leg-${i}`, new B.Vector3(Math.sin(a) * 0.5, 0.025, Math.cos(a) * 0.5), new B.Vector3(0, 1.08, 0), 0.026, metal);
    const shoe = box(`tripod-shoe-${i}`, 0.11, 0.035, 0.15, Math.sin(a) * 0.5, 0.025, Math.cos(a) * 0.5, metal);
    shoe.rotation.y = a;
  }
  box("case", 1.02, 0.38, 0.4, 0, 1.13, 0, wood);
  box("brushed-faceplate", 0.96, 0.32, 0.025, 0, 1.13, -0.214, metal);
  for (const x of [-0.46, 0.46]) for (const y of [1, 1.26]) {
    const screw = B.MeshBuilder.CreateCylinder("training-faceplate-slotted-screw", { diameter: 0.028, height: 0.012, tessellation: 8 }, scene);
    screw.parent = root; screw.position.set(x, y, -0.235); screw.rotation.x = Math.PI / 2; screw.material = copper; screw.isPickable = false;
  }
  const antenna = new B.TransformNode("training-directional-loop-antenna", scene);
  antenna.parent = root; antenna.position.set(0.26, 1.34, 0.02);
  rod("antenna-swivel-stem", B.Vector3.Zero(), new B.Vector3(0, 0.57, 0), 0.022, copper, antenna);
  for (let winding = 0; winding < 3; winding++) {
    const loop = B.MeshBuilder.CreateTorus(`training-copper-loop-${winding}`, { diameter: 0.72 + winding * 0.045, thickness: 0.012, tessellation: 48 }, scene);
    loop.parent = antenna; loop.position.set(0, 0.64, winding * 0.012); loop.rotation.x = Math.PI / 2; loop.material = copper; loop.isPickable = false;
  }
  const terminals: BABYLON.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const x = -0.33 + i * 0.22;
    const terminal = B.MeshBuilder.CreateCylinder(`training-circuit-terminal-${i}`, { diameter: 0.075, height: 0.055, tessellation: 12 }, scene);
    terminal.parent = root; terminal.position.set(x, 1.35, -0.1); terminal.material = porcelain; terminal.isPickable = false;
    const cap = B.MeshBuilder.CreateSphere(`training-terminal-copper-contact-${i}`, { diameter: 0.042, segments: 8 }, scene);
    cap.parent = root; cap.position.set(x, 1.39, -0.1); cap.material = copper; cap.isPickable = false;
    const cable = B.MeshBuilder.CreateTube(`training-completed-circuit-${i}`, {
      path: [new B.Vector3(x, 1.39, -0.1), new B.Vector3(x - 0.05, 1.44, -0.23), new B.Vector3(x, 1.14, -0.25)], radius: 0.011, tessellation: 8,
    }, scene);
    cable.parent = root; cable.material = copper; cable.isPickable = false; cable.setEnabled(false); terminals.push(cable);
  }
  const labels = new B.DynamicTexture("training-panel-engraved-labels", { width: 1024, height: 256 }, scene, true);
  const ctx = labels.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#242b28"; ctx.fillRect(0, 0, 1024, 256); ctx.fillStyle = "#dfd5bc"; ctx.textAlign = "center";
  ctx.font = "bold 45px Georgia"; ctx.fillText("ENGINEERING · SIMULATION", 512, 83);
  ctx.font = "25px Georgia"; ctx.fillText("CIRCUIT   /   SIGNAL   /   PRESSURE   /   RELAY   /   READY", 512, 166);
  labels.update();
  const labelMat = new B.PBRMaterial("training-engraved-label-material", scene); labelMat.albedoTexture = labels; labelMat.roughness = 0.8;
  box("engraved-identification", 0.86, 0.21, 0.008, 0, 1.15, -0.233, labelMat);
  for (let i = 0; i < 5; i++) {
    const lamp = B.MeshBuilder.CreateSphere(`training-panel-lamp-${i}`, { diameter: 0.045, segments: 10 }, scene);
    lamp.parent = root; lamp.position.set(-0.34 + i * 0.17, 1.055, -0.25); lamp.material = signals[i]!; lamp.isPickable = false;
  }
  const switchLever = rod("replacement-relay-lever", new B.Vector3(-0.37, 1.3, 0.09), new B.Vector3(-0.37, 1.44, 0.02), 0.018, copper);
  let antennaTarget = 0;
  let repairTarget = 0;
  const kinds: EngineeringFeedbackKind[] = ["circuits", "antenna", "propulsion", "diagnostic", "launch"];
  return {
    setFeedback(kind: EngineeringFeedbackKind, progress: number, value = progress) {
      const amount = Math.max(0, Math.min(1, progress));
      const signal = signals[kinds.indexOf(kind)]!;
      signal.albedoColor = B.Color3.FromHexString(amount >= 1 ? "#75aa7b" : "#ae8344");
      signal.emissiveColor = signal.albedoColor.scale(amount >= 1 ? 0.65 : 0.15 + amount * 0.28);
      if (kind === "circuits") terminals.forEach((cable, i) => cable.setEnabled((i + 1) / 4 <= amount));
      if (kind === "antenna") antennaTarget = (Math.max(0, Math.min(1, value)) - 0.5) * Math.PI;
      if (kind === "diagnostic") repairTarget = amount * 0.38;
    },
    update(dt: number) {
      antenna.rotation.y += (antennaTarget - antenna.rotation.y) * (1 - Math.exp(-5 * dt));
      switchLever.rotation.x += (repairTarget - switchLever.rotation.x) * (1 - Math.exp(-8 * dt));
    },
    dispose() { root.dispose(); [metal, copper, porcelain, wood, labelMat, ...signals].forEach(m => m.dispose()); labels.dispose(); },
  };
}
