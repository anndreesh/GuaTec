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
  const groundMat = new BABYLONNS.StandardMaterial("static-mars-ground-material", scene);
  // Use the project's real farm-soil albedo so the field reads as earth,
  // while keeping the expensive normal/ARM maps disabled.
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
  groundMat.diffuseTexture = dirtTexture;
  groundMat.specularColor = BABYLONNS.Color3.Black();
  ground.material = groundMat;
  ground.checkCollisions = false;
  ground.isPickable = false;
  ground.receiveShadows = false;

  return {
    ground,
    getHeightAt: terrainHeight,
    dispose() {
      ground.dispose();
      dirtTexture.dispose();
      groundMat.dispose();
    },
  };
}
