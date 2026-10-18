import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "@/babylon/gameplay/AstronautCharacter";

export interface MarsTerrain {
  ground: BABYLON.Mesh;
  /** Analytic terrain height at a given world (x, z), matching the mesh displacement. */
  getHeightAt(x: number, z: number): number;
  dispose(): void;
}

/** The Earth test range uses a level ground plane so the player never appears
 * to sink below the surface while moving or landing from a jump. */
function terrainHeight(x: number, z: number): number {
  void x;
  void z;
  return 0;
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

  const groundMat = createPbrGroundMaterial(BABYLONNS, scene, "auburn-farm-soil",
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_diff_1k.jpg",
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_nor_gl_1k.jpg",
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_arm_1k.jpg", 17);
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
  for (let i = 0; i < 28; i++) {
    const x = -30 + (i % 7) * 9.8;
    const z = -26 + Math.floor(i / 7) * 14.5;
    const patch = BABYLONNS.MeshBuilder.CreateDisc(`field-surface-patch-${i}`, {
      radius: 1.8 + (i % 4) * 0.45,
      tessellation: 14,
    }, scene);
    patch.rotation.x = Math.PI / 2;
    patch.position = new BABYLONNS.Vector3(x, terrainHeight(x, z) + 0.015, z);
    patch.scaling.y = 0.65;
    patch.material = i % 2 === 0 ? mudMat : grassMat;
    patch.parent = surfaceRoot;
  }
  for (let i = 0; i < 14; i++) {
    const track = BABYLONNS.MeshBuilder.CreateBox(`field-wheel-track-${i}`, {
      width: 0.38,
      height: 0.025,
      depth: 3.8,
    }, scene);
    const z = -24 + i * 3.6;
    track.position = new BABYLONNS.Vector3(-12, terrainHeight(-12, z) + 0.02, z);
    track.material = mudMat;
    track.parent = surfaceRoot;
  }

  // Wooden duckboard walkways connecting outdoor stations over muddy March soil
  const woodPlankMat = new BABYLONNS.PBRMaterial("duckboard-wood-mat", scene);
  woodPlankMat.albedoColor = BABYLONNS.Color3.FromHexString("#5a422e");
  woodPlankMat.roughness = 0.92;
  woodPlankMat.metallic = 0.02;

  // Path 1: From main building/work area to launch field (z: -2 to -22)
  for (let i = 0; i < 24; i++) {
    const z = -2 - i * 0.95;
    const plank = BABYLONNS.MeshBuilder.CreateBox(`duckboard-main-${i}`, {
      width: 1.15,
      height: 0.04,
      depth: 0.28,
    }, scene);
    plank.position = new BABYLONNS.Vector3(-2.5 + Math.sin(i * 0.25) * 0.4, terrainHeight(-2.5, z) + 0.025, z);
    plank.rotation.y = (Math.random() - 0.5) * 0.08;
    plank.material = woodPlankMat;
    plank.parent = surfaceRoot;
    plank.receiveShadows = true;
  }

  // Path 2: From work area to test area (z: -1 to 8)
  for (let i = 0; i < 12; i++) {
    const z = 0 + i * 0.8;
    const plank = BABYLONNS.MeshBuilder.CreateBox(`duckboard-test-${i}`, {
      width: 1.0,
      height: 0.04,
      depth: 0.26,
    }, scene);
    plank.position = new BABYLONNS.Vector3(-6 + (i % 2) * 0.05, terrainHeight(-6, z) + 0.025, z);
    plank.material = woodPlankMat;
    plank.parent = surfaceRoot;
    plank.receiveShadows = true;
  }

  // Scattered field stones along the edge of paths
  const stoneMat = new BABYLONNS.PBRMaterial("field-stone-mat", scene);
  stoneMat.albedoColor = BABYLONNS.Color3.FromHexString("#787a74");
  stoneMat.roughness = 0.88;
  stoneMat.metallic = 0.05;

  const stoneCoords: [number, number][] = [
    [-3.8, -4], [-1.2, -7], [-4.1, -12], [-1.5, -17], [-7.2, 3], [-4.8, 6],
    [5.5, -14], [8.2, -18], [-9.5, -3], [-14.2, 2], [12.4, 5], [17.1, 4]
  ];
  stoneCoords.forEach(([sx, sz], idx) => {
    const stone = BABYLONNS.MeshBuilder.CreateSphere(`field-stone-${idx}`, {
      diameter: 0.22 + (idx % 3) * 0.12,
      segments: 5,
    }, scene);
    stone.position = new BABYLONNS.Vector3(sx, terrainHeight(sx, sz) + 0.08, sz);
    stone.scaling = new BABYLONNS.Vector3(1.2, 0.6, 0.9);
    stone.rotation.y = idx * 0.7;
    stone.material = stoneMat;
    stone.parent = surfaceRoot;
    stone.receiveShadows = true;
  });

  return {
    ground,
    getHeightAt: terrainHeight,
    dispose() {
      surfaceRoot.dispose(false, true);
      woodPlankMat.dispose(false, true);
      stoneMat.dispose(false, true);
      groundMat.dispose(false, true);
      mudMat.dispose(false, true);
      grassMat.dispose(false, true);
      ground.dispose();
    },
  };
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
