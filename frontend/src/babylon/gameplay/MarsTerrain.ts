import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "@/babylon/gameplay/FieldEngineerCharacter";

export interface MarsTerrain {
  ground: BABYLON.Mesh;
  /** Analytic terrain height at a given world (x, z), matching the mesh displacement. */
  getHeightAt(x: number, z: number): number;
  dispose(): void;
}

function terrainHeight(x: number, z: number): number {
  // Broad, low-amplitude field undulations keep the horizon from reading as a
  // perfectly flat game plane while remaining gentle enough for walking and
  // the short historical flight sequence.
  const localRelief = Math.sin(x * 0.105 + z * 0.055) * 0.14
    + Math.cos(z * 0.13 - x * 0.065) * 0.09
    + Math.sin((x - z) * 0.24) * 0.025;
  const distance = Math.hypot(x, z);
  const horizonBlend = smoothstep(30, 74, distance);
  const distantRollingCountry = (
    Math.sin(x * 0.018 + z * 0.009) * 2.8
    + Math.cos(z * 0.023 - x * 0.013) * 1.6
  ) * horizonBlend;
  return localRelief + distantRollingCountry;
}

function smoothstep(start: number, end: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

/**
 * Builds the level rural test field and its ground variation.
 */
export function createMarsTerrain(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  options: { size?: number; subdivisions?: number } = {},
): MarsTerrain {
  const size = options.size ?? 220;
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

  const groundMat = createPbrGroundMaterial(BABYLONNS, scene, "auburn-farm-soil",
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_diff_1k.jpg",
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_nor_gl_1k.jpg",
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_arm_1k.jpg", 17 * size / 70);
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
  surfaceRoot.parent = ground;
  // Small irregular patches blend into the field texture without the hard
  // circular edges of flat discs. The seeded layout is stable across reloads.
  for (let i = 0; i < 28; i++) {
    const seed = i * 17 + 31;
    const x = -29 + ((i * 37) % 59);
    const z = -27 + ((i * 23 + 11) % 55);
    const radiusX = 0.45 + (seed % 7) * 0.11;
    const radiusZ = 0.32 + ((seed * 3) % 6) * 0.1;
    createOrganicPatch(
      BABYLONNS,
      scene,
      surfaceRoot,
      `field-surface-patch-${i}`,
      x,
      z,
      radiusX,
      radiusZ,
      i % 4 === 0 ? grassMat : mudMat,
      seed,
    );
  }

  return {
    ground,
    getHeightAt: terrainHeight,
    dispose() {
      surfaceRoot.dispose(false, true);
      groundMat.dispose(false, true);
      mudMat.dispose(false, true);
      grassMat.dispose(false, true);
      ground.dispose();
    },
  };
}

function createOrganicPatch(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  parent: BABYLON.TransformNode,
  name: string,
  x: number,
  z: number,
  radiusX: number,
  radiusZ: number,
  material: BABYLON.Material,
  seed: number,
): void {
  const segments = 16;
  const patch = new BABYLONNS.Mesh(name, scene);
  const positions: number[] = [0, 0.006, 0];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  const rings = [0.62, 1];
  for (const ring of rings) {
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const wobble = 0.82 + (((seed + i * 13) % 11) / 55);
      const dx = Math.cos(angle) * radiusX * ring * wobble;
      const dz = Math.sin(angle) * radiusZ * ring * wobble;
      const y = terrainHeight(x + dx, z + dz) - terrainHeight(x, z) + 0.006;
      positions.push(dx, y, dz);
      const uvRadius = ring * 0.5;
      uvs.push(0.5 + Math.cos(angle) * uvRadius, 0.5 + Math.sin(angle) * uvRadius);
    }
  }
  const innerStart = 1;
  const outerStart = innerStart + segments;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const inner = innerStart + i;
    const innerNext = innerStart + next;
    const outer = outerStart + i;
    const outerNext = outerStart + next;
    indices.push(0, innerNext, inner, inner, innerNext, outerNext, inner, outerNext, outer);
  }
  const normals: number[] = [];
  BABYLONNS.VertexData.ComputeNormals(positions, indices, normals);
  const vertexData = new BABYLONNS.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(patch);
  patch.position.set(x, terrainHeight(x, z), z);
  patch.material = material;
  patch.parent = parent;
  patch.isPickable = false;
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
