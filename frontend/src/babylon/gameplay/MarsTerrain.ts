import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "@/babylon/gameplay/AstronautCharacter";

export interface MarsTerrain {
  ground: BABYLON.Mesh;
  /** Analytic terrain height at a given world (x, z), matching the mesh displacement. */
  getHeightAt(x: number, z: number): number;
  dispose(): void;
}

/** Gentle uneven ground keeps the field readable while giving it a walked-in rural profile. */
function terrainHeight(x: number, z: number): number {
  return Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.17
    + Math.sin(x * 0.075 + z * 0.16) * 0.11
    + Math.cos((x - z) * 0.24) * 0.045;
}

/**
 * Builds the level rural test field and its ground variation.
 */
export function createMarsTerrain(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  options: { size?: number; subdivisions?: number } = {},
): MarsTerrain {
  // A wide, fogged field reaches beyond the camera's visible horizon while
  // the gameplay movement bounds remain intentionally local to the mission.
  const size = options.size ?? 110;
  const subdivisions = options.subdivisions ?? 192;

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
  // Fine topology is reserved for the playable field. A coarse skirt supplies
  // the distant horizon at a fraction of the former 524,288 ground triangles.
  const distantGround = BABYLONNS.MeshBuilder.CreateGround("auburn-distant-ground", { width: 1600, height: 1600, subdivisions: 64 }, scene);
  const distantPositions = distantGround.getVerticesData(BABYLONNS.VertexBuffer.PositionKind);
  if (distantPositions) {
    for (let i = 0; i < distantPositions.length; i += 3) distantPositions[i + 1] = terrainHeight(distantPositions[i]!, distantPositions[i + 2]!) - 1;
    distantGround.updateVerticesData(BABYLONNS.VertexBuffer.PositionKind, distantPositions); distantGround.createNormals(false);
  }
  distantGround.parent = ground; distantGround.material = groundMat; distantGround.isPickable = false;

  const mudMat = createPbrGroundMaterial(BABYLONNS, scene, "wet-soil-mat",
    "/assets/polyhaven/textures/muddy_tracks/textures/muddy_tracks_diff_1k.jpg",
    "/assets/polyhaven/textures/muddy_tracks/textures/muddy_tracks_nor_gl_1k.jpg",
    "/assets/polyhaven/textures/muddy_tracks/textures/muddy_tracks_arm_1k.jpg", 1.7);
  const grassMat = createPbrGroundMaterial(BABYLONNS, scene, "grass-mat",
    "/assets/polyhaven/textures/grass_ground/textures/grass_ground_diff_1k.jpg",
    "/assets/polyhaven/textures/grass_ground/textures/grass_ground_nor_gl_1k.jpg",
    "/assets/polyhaven/textures/grass_ground/textures/grass_ground_arm_1k.jpg", 1.4);
  const surfaceRoot = new BABYLONNS.TransformNode("auburn-surface-variation", scene);
  surfaceRoot.parent = ground;
  const surfacePatches: Array<[number, number, number, boolean]> = [
    [-26, -22, 4.2, false], [-19, 9, 3.8, true], [23, -21, 4.4, true],
    [27, 8, 4.1, false], [-28, 19, 3.7, true], [20, 21, 4.3, false],
  ];
  surfacePatches.forEach(([x, z, radius, grass], i) => {
    const patch = BABYLONNS.MeshBuilder.CreateDisc(`field-surface-patch-${i}`, {
      radius,
      tessellation: 24,
    }, scene);
    // Deform the circular edge into irregular worn turf and shallow muddy scuffs.
    const patchPositions = patch.getVerticesData(BABYLONNS.VertexBuffer.PositionKind);
    if (patchPositions) {
      for (let v = 0; v < patchPositions.length; v += 3) {
        const px = patchPositions[v]!;
        const pz = patchPositions[v + 1]!;
        const angle = Math.atan2(pz, px);
        const radial = 1 + Math.sin(angle * 3 + i * 1.7) * 0.075 + Math.cos(angle * 5 - i) * 0.045;
        patchPositions[v] = px * radial;
        patchPositions[v + 1] = pz * radial * (0.78 + (i % 3) * 0.07);
        // The disc rotates onto XZ; negative local Z is world-space up.
        patchPositions[v + 2] = -(terrainHeight(x + patchPositions[v]!, z + patchPositions[v + 1]!) - terrainHeight(x, z));
      }
      patch.updateVerticesData(BABYLONNS.VertexBuffer.PositionKind, patchPositions);
      patch.createNormals(false);
    }
    patch.rotation.x = Math.PI / 2;
    patch.position = new BABYLONNS.Vector3(x, terrainHeight(x, z) + 0.015, z);

    patch.material = grass ? grassMat : mudMat;
    patch.parent = surfaceRoot;
  });

  // Sparse tufts show the dry field edge without burying walkways or work areas.
  // Seeded placement keeps the composition stable between scene loads.
  const grassRandom = (seed: number): number => {
    const value = Math.sin(seed * 91.713 + 17.131) * 43758.5453;
    return value - Math.floor(value);
  };
  const grassBlade = BABYLONNS.MeshBuilder.CreateBox("dry-grass-blade-prototype", {
    width: 0.035, height: 0.3, depth: 0.035,
  }, scene);
  grassBlade.position.set(-1000, -5, -1000);
  grassBlade.material = grassMat;
  grassBlade.parent = surfaceRoot;
  for (let tuftIndex = 0; tuftIndex < 44; tuftIndex++) {
    const x = -30 + grassRandom(tuftIndex + 1) * 60;
    const z = -29 + grassRandom(tuftIndex + 101) * 56;
    const nearLaunch = Math.hypot(x, z + 14) < 7.5;
    const nearWorkTables = (x > 15 && z > 4 && z < 12)
      || (x < -3 && x > -11 && z > -3 && z < 12)
      || (x > 6 && x < 14 && z < -19 && z > -28)
      || (x > 12 && z < 0 && z > -6);
    const onMainWalkway = Math.abs(x + 2.5) < 1.15 && z < -1 && z > -24;
    const onTestWalkway = Math.abs(x + 6) < 1.05 && z > -1 && z < 9;
    if (nearLaunch || nearWorkTables || onMainWalkway || onTestWalkway) continue;
    const baseY = terrainHeight(x, z);
    const blades = 2 + Math.floor(grassRandom(tuftIndex + 205) * 2);
    for (let bladeIndex = 0; bladeIndex < blades; bladeIndex++) {
      const height = 0.16 + grassRandom(tuftIndex * 7 + bladeIndex + 307) * 0.2;
      const blade = grassBlade.createInstance(`dry-grass-tuft-${tuftIndex}-${bladeIndex}`);
      blade.position = new BABYLONNS.Vector3(
        x + (grassRandom(tuftIndex * 11 + bladeIndex + 401) - 0.5) * 0.18,
        baseY + height * 0.5,
        z + (grassRandom(tuftIndex * 13 + bladeIndex + 503) - 0.5) * 0.18,
      );
      blade.scaling.y = height / 0.3;
      blade.rotation.z = (grassRandom(tuftIndex * 17 + bladeIndex + 607) - 0.5) * 0.5;
      blade.rotation.y = grassRandom(tuftIndex * 19 + bladeIndex + 709) * Math.PI;
      blade.parent = surfaceRoot;
    }
  }

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
      pixels.data[index] = Math.max(0, Math.min(255, 111 + variation - damp * 28 - grass * 13));
      pixels.data[index + 1] = Math.max(0, Math.min(255, 87 + variation * 0.88 - damp * 17 + grass * 5));
      pixels.data[index + 2] = Math.max(0, Math.min(255, 63 + variation * 0.72 - damp * 9 - grass * 4));
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  albedo.update(false);
  albedo.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  albedo.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  albedo.uScale = 64;
  albedo.vScale = 64;
  albedo.anisotropicFilteringLevel = 8;

  const material = new BABYLONNS.PBRMaterial("auburn-generated-soil", scene);
  material.albedoTexture = albedo;
  const normal = new BABYLONNS.Texture(normalUrl, scene, false, false, BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE);
  const arm = new BABYLONNS.Texture(armUrl, scene, false, false, BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE);
  for (const texture of [normal, arm]) {
    texture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
    texture.uScale = 128;
    texture.vScale = 128;
    texture.anisotropicFilteringLevel = 8;
  }
  normal.gammaSpace = false;
  arm.gammaSpace = false;
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
  normal.gammaSpace = false;
  arm.gammaSpace = false;
  material.bumpTexture = normal;
  material.metallicTexture = arm;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.roughness = 0.94;
  material.metallic = 0;
  return material;
}
