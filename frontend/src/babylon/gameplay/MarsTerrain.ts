import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "@/babylon/gameplay/AstronautCharacter";

export interface MarsTerrain {
  ground: BABYLON.Mesh;
  /** Analytic terrain height at a given world (x, z), matching the mesh displacement. */
  getHeightAt(x: number, z: number): number;
  dispose(): void;
}

/** Low, smooth rolls keep the field readable and agree with player movement. */
function terrainHeight(x: number, z: number): number {
  return Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.12
    + Math.sin(x * 0.075 + z * 0.16) * 0.075
    + Math.cos((x - z) * 0.24) * 0.035;
}

/**
 * Builds the level rural test field and its ground variation.
 */
export function createMarsTerrain(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  options: { size?: number; subdivisions?: number } = {},
): MarsTerrain {
  const size = options.size ?? 70;
  const subdivisions = options.subdivisions ?? 48;

  const ground = BABYLONNS.MeshBuilder.CreateGround("mars-ground", { width: size, height: size, subdivisions }, scene);
  const positions = ground.getVerticesData(BABYLONNS.VertexBuffer.PositionKind);
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]!;
      const z = positions[i + 2]!;
      positions[i + 1] = terrainHeight(x, z);
    }
    ground.updateVerticesData(BABYLONNS.VertexBuffer.PositionKind, positions);
    ground.createNormals(false);
  }

  const groundMat = createProceduralSoilMaterial(BABYLONNS, scene,
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_nor_gl_1k.jpg",
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_arm_1k.jpg");
  ground.material = groundMat;
  ground.receiveShadows = true;

  const mudMat = createPbrGroundMaterial(BABYLONNS, scene, "wet-soil-mat",
    "/assets/polyhaven/textures/muddy_tracks/textures/muddy_tracks_diff_1k.jpg",
    "/assets/polyhaven/textures/muddy_tracks/textures/muddy_tracks_nor_gl_1k.jpg",
    "/assets/polyhaven/textures/muddy_tracks/textures/muddy_tracks_arm_1k.jpg", 1.7);
  const grassMat = createPbrGroundMaterial(BABYLONNS, scene, "grass-mat",
    "/assets/polyhaven/textures/grass_ground/textures/grass_ground_diff_1k.jpg",
    "/assets/polyhaven/textures/grass_ground/textures/grass_ground_nor_gl_1k.jpg",
    "/assets/polyhaven/textures/grass_ground/textures/grass_ground_arm_1k.jpg", 1.4);
  const surfaceRoot = new BABYLONNS.TransformNode("auburn-surface-variation", scene);
  const surfacePatches: Array<[number, number, number, boolean]> = [
    [-26, -22, 4.2, false], [-19, 9, 3.8, true], [23, -21, 4.4, true],
    [27, 8, 4.1, false], [-28, 19, 3.7, true], [20, 21, 4.3, false],
  ];
  surfacePatches.forEach(([x, z, radius, grass], i) => {
    const patch = BABYLONNS.MeshBuilder.CreateDisc(`field-surface-patch-${i}`, {
      radius,
      tessellation: 10,
    }, scene);
    patch.rotation.x = Math.PI / 2;
    patch.position = new BABYLONNS.Vector3(x, terrainHeight(x, z) + 0.015, z);
    patch.scaling.y = 0.82;
    patch.material = grass ? grassMat : mudMat;
    patch.parent = surfaceRoot;
  });

  // Wooden duckboard walkways connecting outdoor stations over muddy March soil
  const woodPlankMat = new BABYLONNS.PBRMaterial("duckboard-wood-mat", scene);
  woodPlankMat.albedoColor = BABYLONNS.Color3.FromHexString("#5a422e");
  woodPlankMat.roughness = 0.92;
  woodPlankMat.metallic = 0.02;

  // Path 1: From the outdoor work area to the launch field (z: -2 to -22)
  for (let i = 0; i < 12; i++) {
    const z = -2 - i * 1.8;
    const plank = BABYLONNS.MeshBuilder.CreateBox(`duckboard-main-${i}`, {
      width: 1.15,
      height: 0.04,
      depth: 1.55,
    }, scene);
    plank.position = new BABYLONNS.Vector3(-2.5, terrainHeight(-2.5, z) + 0.025, z);
    plank.material = woodPlankMat;
    plank.parent = surfaceRoot;
    plank.receiveShadows = true;
  }

  // Path 2: From work area to test area (z: -1 to 8)
  for (let i = 0; i < 5; i++) {
    const z = i * 1.8;
    const plank = BABYLONNS.MeshBuilder.CreateBox(`duckboard-test-${i}`, {
      width: 1.0,
      height: 0.04,
      depth: 1.55,
    }, scene);
    plank.position = new BABYLONNS.Vector3(-6 + (i % 2) * 0.05, terrainHeight(-6, z) + 0.025, z);
    plank.material = woodPlankMat;
    plank.parent = surfaceRoot;
    plank.receiveShadows = true;
  }

  return {
    ground,
    getHeightAt: terrainHeight,
    dispose() {
      surfaceRoot.dispose(false, true);
      woodPlankMat.dispose(false, true);
      groundMat.dispose(true, true);
      mudMat.dispose(true, true);
      grassMat.dispose(true, true);
      ground.dispose();
    },
  };
}

function createProceduralSoilMaterial(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  normalUrl: string,
  armUrl: string,
): BABYLON.PBRMaterial {
  const size = 1024;
  const albedo = new BABYLONNS.DynamicTexture("generated-auburn-soil-albedo", { width: size, height: size }, scene, false);
  const ctx = albedo.getContext() as unknown as CanvasRenderingContext2D;
  const pixels = ctx.createImageData(size, size);
  const hash = (x: number, y: number, seed: number): number => {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const valueNoise = (x: number, y: number, cell: number, seed: number): number => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const rawX = x / cell - gx;
    const rawY = y / cell - gy;
    const fx = rawX * rawX * (3 - 2 * rawX);
    const fy = rawY * rawY * (3 - 2 * rawY);
    const top = hash(gx, gy, seed) * (1 - fx) + hash(gx + 1, gy, seed) * fx;
    const bottom = hash(gx, gy + 1, seed) * (1 - fx) + hash(gx + 1, gy + 1, seed) * fx;
    return top * (1 - fy) + bottom * fy;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const broad = valueNoise(x, y, 150, 1);
      const medium = valueNoise(x, y, 38, 2);
      const fine = valueNoise(x, y, 9, 3);
      const grain = hash(x, y, 4);
      const damp = Math.max(0, 0.58 - broad) * 0.42;
      const grass = Math.max(0, broad - 0.69) * 0.36;
      const variation = (broad - 0.5) * 26 + (medium - 0.5) * 19 + (fine - 0.5) * 11 + (grain - 0.5) * 13;
      const index = (y * size + x) * 4;
      pixels.data[index] = Math.max(0, Math.min(255, 83 + variation - damp * 28 - grass * 13));
      pixels.data[index + 1] = Math.max(0, Math.min(255, 67 + variation * 0.88 - damp * 17 + grass * 5));
      pixels.data[index + 2] = Math.max(0, Math.min(255, 49 + variation * 0.72 - damp * 9 - grass * 4));
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  albedo.update(false);
  albedo.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  albedo.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  albedo.anisotropicFilteringLevel = 8;

  const material = new BABYLONNS.PBRMaterial("auburn-generated-soil", scene);
  material.albedoTexture = albedo;
  const normal = new BABYLONNS.Texture(normalUrl, scene, false, false, BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE);
  const arm = new BABYLONNS.Texture(armUrl, scene, false, false, BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE);
  for (const texture of [normal, arm]) {
    texture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
    texture.uScale = 9;
    texture.vScale = 9;
    texture.anisotropicFilteringLevel = 8;
  }
  material.bumpTexture = normal;
  material.metallicTexture = arm;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.roughness = 0.96;
  material.metallic = 0;
  return material;
}

function createPbrGroundMaterial(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  name: string,
  albedoUrl: string,
  normalUrl: string,
  armUrl: string,
  tiling: number,
): BABYLON.PBRMaterial {
  const material = new BABYLONNS.PBRMaterial(name, scene);
  const albedo = new BABYLONNS.Texture(albedoUrl, scene, false, false, BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE);
  const normal = new BABYLONNS.Texture(normalUrl, scene, false, false, BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE);
  const arm = new BABYLONNS.Texture(armUrl, scene, false, false, BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE);
  for (const texture of [albedo, normal, arm]) {
    texture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
    texture.uScale = tiling;
    texture.vScale = tiling;
  }
  material.albedoTexture = albedo;
  material.bumpTexture = normal;
  material.metallicTexture = arm;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.roughness = 0.94;
  material.metallic = 0;
  return material;
}
