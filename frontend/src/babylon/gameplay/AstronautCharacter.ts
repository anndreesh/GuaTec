import type * as BABYLON from "@babylonjs/core";

/** Babylon.js module shape as returned by the dynamic `import("@babylonjs/core")`. */
export type BabylonNamespace = typeof BABYLON;

export interface AstronautCharacter {
  /** Root transform node other systems (camera, controller) attach to / read position from. */
  root: BABYLON.TransformNode;
  setMovementState(walking: boolean, running: boolean): void;
  /** Advances the idle/walk limb-swing animation. */
  update(deltaSeconds: number): void;
  dispose(): void;
}

/** Procedural early-1920s field engineer; no Blender export is required. */
export function createAstronautCharacter(BABYLONNS: BabylonNamespace, scene: BABYLON.Scene): AstronautCharacter {
  const root = new BABYLONNS.TransformNode("field-engineer-root", scene);

  const coatMat = new BABYLONNS.PBRMaterial("engineer-wool-coat", scene);
  coatMat.albedoTexture = createWoolTexture(BABYLONNS, scene);
  coatMat.albedoColor = BABYLONNS.Color3.FromHexString("#f2f2ef");
  coatMat.roughness = 0.96;
  const shirtMat = new BABYLONNS.PBRMaterial("engineer-cotton-shirt", scene);
  shirtMat.albedoColor = BABYLONNS.Color3.FromHexString("#b7ad93");
  shirtMat.roughness = 0.94;
  const trouserMat = new BABYLONNS.PBRMaterial("engineer-wool-trousers", scene);
  trouserMat.albedoColor = BABYLONNS.Color3.FromHexString("#3c443f");
  trouserMat.roughness = 0.97;
  const leatherMat = new BABYLONNS.PBRMaterial("engineer-aged-leather", scene);
  leatherMat.albedoColor = BABYLONNS.Color3.FromHexString("#5b3825");
  leatherMat.roughness = 0.82;
  leatherMat.metallic = 0.02;
  const skinMat = new BABYLONNS.PBRMaterial("engineer-skin", scene);
  skinMat.albedoColor = BABYLONNS.Color3.FromHexString("#c58f70");
  skinMat.roughness = 0.88;
  const faceDetailMat = new BABYLONNS.PBRMaterial("engineer-face-details", scene);
  faceDetailMat.albedoColor = BABYLONNS.Color3.FromHexString("#332721");
  faceDetailMat.roughness = 0.92;
  const metalMat = new BABYLONNS.PBRMaterial("engineer-aged-brass", scene);
  metalMat.albedoColor = BABYLONNS.Color3.FromHexString("#8f7042");
  metalMat.roughness = 0.62;
  metalMat.metallic = 0.72;

  const torso = BABYLONNS.MeshBuilder.CreateCapsule("engineer-coat-body", { height: 0.86, radius: 0.27, tessellation: 16 }, scene);
  torso.position.y = 1.04;
  torso.scaling.z = 0.86;
  torso.material = coatMat;
  torso.parent = root;

  const shirt = BABYLONNS.MeshBuilder.CreateBox("engineer-shirt-front", { width: 0.18, height: 0.48, depth: 0.035 }, scene);
  shirt.position = new BABYLONNS.Vector3(0, 1.18, 0.24);
  shirt.material = shirtMat;
  shirt.parent = root;

  for (const side of [-1, 1]) {
    const lapel = BABYLONNS.MeshBuilder.CreateBox(`engineer-coat-lapel-${side}`, { width: 0.13, height: 0.4, depth: 0.055 }, scene);
    lapel.position = new BABYLONNS.Vector3(side * 0.105, 1.32, 0.264);
    lapel.rotation.z = side * -0.22;
    lapel.material = coatMat;
    lapel.parent = root;
    const pocket = BABYLONNS.MeshBuilder.CreateBox(`engineer-coat-pocket-${side}`, { width: 0.18, height: 0.16, depth: 0.035 }, scene);
    pocket.position = new BABYLONNS.Vector3(side * 0.18, 0.91, 0.257);
    pocket.material = coatMat;
    pocket.parent = root;
    const pocketFlap = BABYLONNS.MeshBuilder.CreateBox(`engineer-coat-pocket-flap-${side}`, { width: 0.2, height: 0.045, depth: 0.045 }, scene);
    pocketFlap.position = new BABYLONNS.Vector3(side * 0.18, 1, 0.277);
    pocketFlap.material = coatMat;
    pocketFlap.parent = root;
  }

  const beltMesh = BABYLONNS.MeshBuilder.CreateCylinder("engineer-leather-belt", { height: 0.1, diameter: 0.62, tessellation: 16 }, scene);
  beltMesh.position.y = 0.72;
  beltMesh.material = leatherMat;
  beltMesh.parent = root;

  const satchel = BABYLONNS.MeshBuilder.CreateBox("engineer-tool-satchel", { width: 0.34, height: 0.34, depth: 0.15 }, scene);
  satchel.position = new BABYLONNS.Vector3(-0.34, 0.86, 0.02);
  satchel.rotation.z = -0.12;
  satchel.material = leatherMat;
  satchel.parent = root;
  const satchelFlap = BABYLONNS.MeshBuilder.CreateBox("engineer-satchel-flap", { width: 0.37, height: 0.08, depth: 0.17 }, scene);
  satchelFlap.position = new BABYLONNS.Vector3(-0.34, 1.06, 0.02);
  satchelFlap.material = leatherMat;
  satchelFlap.parent = root;

  const suspenders = [-0.13, 0.13].map((x, index) => {
    const strap = BABYLONNS.MeshBuilder.CreateBox(`engineer-suspender-${index}`, { width: 0.045, height: 0.58, depth: 0.035 }, scene);
    strap.position = new BABYLONNS.Vector3(x, 1.12, 0.255);
    strap.rotation.z = index === 0 ? -0.08 : 0.08;
    strap.material = leatherMat;
    strap.parent = root;
    return strap;
  });

  const neck = BABYLONNS.MeshBuilder.CreateCylinder("engineer-neck", { height: 0.12, diameter: 0.2, tessellation: 12 }, scene);
  neck.position.y = 1.51;
  neck.material = skinMat;
  neck.parent = root;
  const head = BABYLONNS.MeshBuilder.CreateSphere("engineer-head", { diameter: 0.42, segments: 16 }, scene);
  head.position.y = 1.73;
  head.material = skinMat;
  head.parent = root;
  for (const side of [-1, 1]) {
    const eye = BABYLONNS.MeshBuilder.CreateSphere(`engineer-eye-${side}`, { diameter: 0.042, segments: 8 }, scene);
    eye.position = new BABYLONNS.Vector3(side * 0.078, 1.76, 0.197);
    eye.material = faceDetailMat;
    eye.parent = root;
    const ear = BABYLONNS.MeshBuilder.CreateSphere(`engineer-ear-${side}`, { diameter: 0.09, segments: 10 }, scene);
    ear.scaling = new BABYLONNS.Vector3(0.6, 1, 0.7);
    ear.position = new BABYLONNS.Vector3(side * 0.205, 1.73, 0);
    ear.material = skinMat;
    ear.parent = root;
  }
  const nose = BABYLONNS.MeshBuilder.CreateSphere("engineer-nose", { diameter: 0.07, segments: 8 }, scene);
  nose.scaling.z = 1.5;
  nose.position = new BABYLONNS.Vector3(0, 1.71, 0.207);
  nose.material = skinMat;
  nose.parent = root;
  const cap = BABYLONNS.MeshBuilder.CreateSphere("engineer-rounded-wool-cap", { diameter: 0.46, segments: 16 }, scene);
  cap.scaling.y = 0.42;
  cap.position.y = 1.99;
  cap.material = coatMat;
  cap.parent = root;
  const capBrim = BABYLONNS.MeshBuilder.CreateBox("engineer-cap-brim", { width: 0.3, height: 0.045, depth: 0.16 }, scene);
  capBrim.position = new BABYLONNS.Vector3(0, 1.92, 0.18);
  capBrim.material = coatMat;
  capBrim.parent = root;

  for (let i = 0; i < 4; i++) {
    const button = BABYLONNS.MeshBuilder.CreateSphere(`engineer-coat-button-${i}`, { diameter: 0.045, segments: 8 }, scene);
    button.position = new BABYLONNS.Vector3(0, 0.88 + i * 0.17, 0.268);
    button.material = metalMat;
    button.parent = root;
  }

  const leftBoot = BABYLONNS.MeshBuilder.CreateBox("engineer-left-boot", { width: 0.19, height: 0.16, depth: 0.36 }, scene);
  leftBoot.position = new BABYLONNS.Vector3(-0.13, 0.1, 0.08);
  leftBoot.material = leatherMat;
  leftBoot.parent = root;
  const rightBoot = leftBoot.clone("engineer-right-boot");
  rightBoot.position.x = 0.13;
  rightBoot.parent = root;

  const gloves = ["left", "right"].map((side, index) => {
    const glove = BABYLONNS.MeshBuilder.CreateSphere(`engineer-${side}-glove`, { diameter: 0.15, segments: 10 }, scene);
    glove.position = new BABYLONNS.Vector3(index === 0 ? -0.37 : 0.37, 0.86, 0.03);
    glove.material = leatherMat;
    glove.parent = root;
    return glove;
  });

  function createLimbPivot(name: string, hipPosition: BABYLON.Vector3): BABYLON.TransformNode {
    const pivot = new BABYLONNS.TransformNode(name, scene);
    pivot.position = hipPosition;
    pivot.parent = root;
    return pivot;
  }

  function attachLimb(pivot: BABYLON.TransformNode, name: string, length: number, radius: number, material: BABYLON.Material): void {
    const limb = BABYLONNS.MeshBuilder.CreateCapsule(name, { height: length, radius, tessellation: 10 }, scene);
    limb.position.y = -length / 2;
    limb.material = material;
    limb.parent = pivot;
  }

  const leftLegPivot = createLimbPivot("engineer-left-leg-pivot", new BABYLONNS.Vector3(-0.13, 0.68, 0));
  attachLimb(leftLegPivot, "engineer-left-trouser-leg", 0.62, 0.11, trouserMat);
  const rightLegPivot = createLimbPivot("engineer-right-leg-pivot", new BABYLONNS.Vector3(0.13, 0.68, 0));
  attachLimb(rightLegPivot, "engineer-right-trouser-leg", 0.62, 0.11, trouserMat);

  const leftArmPivot = createLimbPivot("engineer-left-arm-pivot", new BABYLONNS.Vector3(-0.34, 1.32, 0));
  attachLimb(leftArmPivot, "engineer-left-coat-sleeve", 0.52, 0.09, coatMat);
  const rightArmPivot = createLimbPivot("engineer-right-arm-pivot", new BABYLONNS.Vector3(0.34, 1.32, 0));
  attachLimb(rightArmPivot, "engineer-right-coat-sleeve", 0.52, 0.09, coatMat);

  let walking = false;
  let walkTime = 0;
  const swingAmplitude = 0.55;
  return {
    root,
    setMovementState(nextWalking: boolean, running: boolean) {
      walking = nextWalking;
    },
    update(deltaSeconds: number) {
      if (walking) {
        walkTime += deltaSeconds * 7;
        const swing = Math.sin(walkTime) * swingAmplitude;
        leftLegPivot.rotation.x = swing;
        rightLegPivot.rotation.x = -swing;
        leftArmPivot.rotation.x = -swing * 0.8;
        rightArmPivot.rotation.x = swing * 0.8;
      } else {
        // Ease limbs back to a neutral idle pose.
        leftLegPivot.rotation.x *= 0.8;
        rightLegPivot.rotation.x *= 0.8;
        leftArmPivot.rotation.x *= 0.8;
        rightArmPivot.rotation.x *= 0.8;
        walkTime = 0;
      }
    },
    dispose() {
      root.dispose(false, true);
    },
  };
}

function createWoolTexture(BABYLONNS: BabylonNamespace, scene: BABYLON.Scene): BABYLON.Texture {
  const texture = new BABYLONNS.DynamicTexture("engineer-wool-weave", { width: 256, height: 256 }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#3f4a43"; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    ctx.globalAlpha = 0.03 + Math.random() * 0.11;
    ctx.fillStyle = Math.random() < 0.5 ? "#d1c8a7" : "#101916";
    const x = Math.random() * 256; const y = Math.random() * 256;
    ctx.fillRect(x, y, 1 + Math.random() * 4, 1 + Math.random() * 2);
  }
  ctx.globalAlpha = 1; texture.update();
  texture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE; texture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  return texture;
}
