import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "@/babylon/gameplay/AstronautCharacter";

export interface MarsTerrain {
  ground: BABYLON.Mesh;
  /** Stable floor height used by the player and all field props. */
  getHeightAt(x: number, z: number): number;
  dispose(): void;
}

/**
 * The playable floor is deliberately flat and static. A single height keeps
 * movement and gravity deterministic and avoids terrain/collision conflicts on
 * low-resource computers and mobile devices.
 */
function terrainHeight(_x: number, _z: number): number {
  return 0;
}

/** Builds the lightweight floor used by the playable field. */
export function createMarsTerrain(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  options: { size?: number; subdivisions?: number } = {},
): MarsTerrain {
  const size = options.size ?? 110;
  // Keep this as one quad even if an old caller passes a dense subdivision count.
  const ground = BABYLONNS.MeshBuilder.CreateGround("mars-ground", {
    width: size,
    height: size,
    subdivisions: 1,
  }, scene);
  const groundMat = new BABYLONNS.PBRMaterial("Auburn-field-soil-PBR", scene);
  // The bundled farm-soil set is glTF/GL compatible: albedo, normal and packed
  // AO/roughness/metallic. Use all three for scale and contact under daylight.
  const dirtTexture = new BABYLONNS.Texture(
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_diff_1k.jpg",
    scene,
    false,
    false,
    BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE,
  );
  dirtTexture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  dirtTexture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  // Lower repetition plus moderate anisotropy prevents the soil grain from
  // shimmering when the third-person camera changes angle.
  dirtTexture.uScale = 4;
  dirtTexture.vScale = 4;
  dirtTexture.anisotropicFilteringLevel = 4;
  groundMat.albedoTexture = dirtTexture;
  groundMat.albedoColor = BABYLONNS.Color3.FromHexString("#d9cbb3");
  groundMat.roughness = 0.96;
  groundMat.metallic = 0;

  const normalTexture = new BABYLONNS.Texture(
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_nor_gl_1k.jpg",
    scene,
    false,
    false,
    BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE,
  );
  normalTexture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  normalTexture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  normalTexture.uScale = 4;
  normalTexture.vScale = 4;
  normalTexture.anisotropicFilteringLevel = 4;
  normalTexture.level = 0.32;
  groundMat.bumpTexture = normalTexture;

  const armTexture = new BABYLONNS.Texture(
    "/assets/polyhaven/textures/farm_soil/textures/farm_soil_arm_1k.jpg",
    scene,
    false,
    false,
    BABYLONNS.Texture.TRILINEAR_SAMPLINGMODE,
  );
  armTexture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  armTexture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  armTexture.uScale = 4;
  armTexture.vScale = 4;
  armTexture.anisotropicFilteringLevel = 4;
  groundMat.metallicTexture = armTexture;
  groundMat.useMetallnessFromMetallicTextureBlue = true;
  groundMat.useRoughnessFromMetallicTextureGreen = true;
  groundMat.ambientTexture = armTexture;
  groundMat.useAmbientInGrayScale = true;
  groundMat.ambientTextureStrength = 0.28;
  ground.material = groundMat;
  ground.checkCollisions = false;
  ground.isPickable = false;
  ground.receiveShadows = true;

  return {
    ground,
    getHeightAt: terrainHeight,
    dispose() {
      ground.dispose();
      dirtTexture.dispose();
      normalTexture.dispose();
      armTexture.dispose();
      groundMat.dispose();
    },
  };
}
