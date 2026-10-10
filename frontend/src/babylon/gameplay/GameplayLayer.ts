import type * as BABYLON from "@babylonjs/core";
import type { MissionPointOfInterest } from "@/config/gameConfig";
import { createAstronautCharacter, type BabylonNamespace } from "@/babylon/gameplay/AstronautCharacter";
import { createMarsTerrain } from "@/babylon/gameplay/MarsTerrain";

export interface NearbyPoi {
  id: string;
  label: string;
}

export interface GameplayMapState {
  player: { x: number; z: number; direction: number };
  points: Array<{ id: string; label: string; x: number; z: number; navigable?: boolean }>;
}

export type AuburnWeather = "CLEAR" | "CLOUDY" | "LIGHT MIST" | "WINDY";

/** Handle Mission1Screen (or any playable-mission screen) uses to react to
 * player movement without needing to know about Babylon internals. */
export interface GameplayHandle {
  onNearestPoiChange(cb: (poi: NearbyPoi | null) => void): void;
  onMapStateChange(cb: (state: GameplayMapState) => void): void;
  onInteract(cb: (poiId: string) => void): void;
  reset(): void;
  navigateTo(poiId: string): void;
  setDesign(structure: "light" | "balanced" | "reinforced", instrumentation: "basic" | "extended"): void;
  playLaunch(): void;
  setMissionProgress(progress: number): void;
  setTouchMovement(x: number, y: number): void;
  setTouchSprint(active: boolean): void;
  jump(): void;
  interact(): void;
  getWeather(): AuburnWeather;
}

export interface GameplayLayerController {
  handle: GameplayHandle;
  /** Attaches keyboard/camera controls and shows the gameplay scene. Safe to call repeatedly. */
  enable(): void;
  /** Detaches controls and hides the gameplay scene (used when leaving the mission screen). */
  disable(): void;
  /** Advances player movement, camera follow and character animation. */
  update(deltaSeconds: number): void;
  dispose(): void;
}

const MOVE_SPEED = 3.2; // world units per second
const RUN_SPEED = 6.4; // Earth test range sprint speed
const MOVE_ACCELERATION = 11;
const MOVE_BRAKING = 15;
const EARTH_GRAVITY = 9.81;
const JUMP_SPEED = 5.5;
// Route waypoints stop outside solid table/building footprints; keep interaction
// reach large enough to use a station without walking through its collider.
const INTERACT_RADIUS = 4;
const PLAYER_START = { x: 0, z: 4 };
const FIELD_HALF_SIZE = 33.5;
const ROCKET_PLATFORM_Z = -14;
const PLAYER_COLLISION_RADIUS = 0.48;

/**
 * Builds the full third-person exploration layer for a playable mission:
 * mercenary astronaut, level Auburn field terrain with rural props, a small
 * 1920s experimental range, fixed points of interest, WASD
 * camera-relative movement and an ArcRotateCamera-based follow camera.
 *
 * Everything is created once and toggled via `enable`/`disable` so
 * `BackdropEngine` can reuse the same Babylon engine/scene it already owns
 * for the ambient backdrop instead of spinning up a second renderer.
 */
export function createGameplayLayer(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  canvas: HTMLCanvasElement,
  pois: MissionPointOfInterest[],
  shadowGenerator: BABYLON.ShadowGenerator,
): GameplayLayerController {
  const root = new BABYLONNS.TransformNode("gameplay-root", scene);
  const downloadedProps = new BABYLONNS.TransformNode("polyhaven-props-root", scene);
  downloadedProps.parent = root;
  const sky = createAuburnSky(BABYLONNS, scene);
  sky.parent = root;

  const terrain = createMarsTerrain(BABYLONNS, scene);
  terrain.ground.parent = root;
  scene.fogMode = BABYLONNS.Scene.FOGMODE_EXP2;
  const weatherOptions: Array<{ label: AuburnWeather; fogDensity: number; lightFactor: number }> = [
    { label: "CLEAR", fogDensity: 0.0018, lightFactor: 1.06 },
    { label: "CLOUDY", fogDensity: 0.004, lightFactor: 0.88 },
    { label: "LIGHT MIST", fogDensity: 0.009, lightFactor: 0.78 },
    { label: "WINDY", fogDensity: 0.003, lightFactor: 0.96 },
  ];
  const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)]!;
  scene.fogDensity = weather.fogDensity;
  scene.fogColor = BABYLONNS.Color3.FromHexString("#aeb5b5");

  const astronaut = createAstronautCharacter(BABYLONNS, scene);
  astronaut.root.parent = root;
  const proceduralAvatarMeshes = astronaut.root.getChildMeshes(false);
  astronaut.root.position = new BABYLONNS.Vector3(
    PLAYER_START.x,
    terrain.getHeightAt(PLAYER_START.x, PLAYER_START.z),
    PLAYER_START.z,
  );
  let avatarAnimationGroups: BABYLON.AnimationGroup[] = [];
  let activeAvatarAnimation: BABYLON.AnimationGroup | null = null;
  const playAvatarAnimation = (walking: boolean, running: boolean, jumping = false): void => {
    if (!avatarAnimationGroups.length) return;
    const hasJumpAnimation = jumping && avatarAnimationGroups.some((group) => group.name.toLowerCase().includes("jump"));
    const wanted = hasJumpAnimation ? "jump" : running ? "running" : walking ? "walk" : "idle";
    const next = avatarAnimationGroups.find((group) => group.name.toLowerCase().includes(wanted));
    if (!next || next === activeAvatarAnimation) return;
    activeAvatarAnimation?.stop();
    activeAvatarAnimation = next;
    next.start(true);
  };
  async function loadAnimatedAvatar(): Promise<void> {
    try {
      await import("@babylonjs/loaders/glTF");
      const result = await BABYLONNS.SceneLoader.ImportMeshAsync(null, "/assets/models/", "mercenary_astronaut_optimized.glb", scene);
      const avatarRoot = new BABYLONNS.TransformNode("mercenary-avatar-model", scene);
      avatarRoot.parent = astronaut.root;
      for (const mesh of result.meshes) {
        if (!mesh.parent) mesh.parent = avatarRoot;
        mesh.receiveShadows = true;
        // Imported rig bounds include animation extents; casting their shadow
        // produces a field-long black wedge at the low dawn sun angle.
      }
      avatarRoot.computeWorldMatrix(true);
      let bounds = avatarRoot.getHierarchyBoundingVectors(true);
      const height = Math.max(0.01, bounds.max.y - bounds.min.y);
      avatarRoot.scaling.setAll(1.78 / height);
      avatarRoot.computeWorldMatrix(true);
      bounds = avatarRoot.getHierarchyBoundingVectors(true);
      avatarRoot.position.x += astronaut.root.position.x - (bounds.min.x + bounds.max.x) / 2;
      avatarRoot.position.y += astronaut.root.position.y - bounds.min.y;
      avatarRoot.position.z += astronaut.root.position.z - (bounds.min.z + bounds.max.z) / 2;
      proceduralAvatarMeshes.forEach((mesh) => mesh.setEnabled(false));
      avatarAnimationGroups = result.animationGroups;
      avatarAnimationGroups.forEach((group) => group.stop());
      playAvatarAnimation(false, false);
      console.info("[Mission 01] Mercenary astronaut loaded; idle, walk, and run animations ready.", { height, center: [bounds.min.x, bounds.min.y, bounds.min.z] });
    } catch (error) {
      console.warn("[Mission 01] Could not load mercenary astronaut; procedural engineer remains active.", error);
    }
  }
  void loadAnimatedAvatar();

  // --- Set dressing: a small 1920s test vehicle, launch frame and field stations ---
  const propMat = new BABYLONNS.PBRMaterial("gameplay-aged-steel", scene);
  propMat.albedoColor = BABYLONNS.Color3.FromHexString("#69716d");
  propMat.metallic = 0.48;
  propMat.roughness = 0.72;

  const markerMat = new BABYLONNS.PBRMaterial("gameplay-oxide-paint", scene);
  markerMat.albedoColor = BABYLONNS.Color3.FromHexString("#9a563d");
  markerMat.metallic = 0.12;
  markerMat.roughness = 0.82;

  const poiRoot = new BABYLONNS.TransformNode("gameplay-poi-root", scene);
  const poiMeshes: { poi: MissionPointOfInterest; position: BABYLON.Vector3 }[] = [];
  const getMapPoints = () => [
    ...poiMeshes.map(({ poi, position }) => ({ id: poi.id, label: poi.label, x: position.x, z: position.z, navigable: true })),
    { id: "prototype-platform", label: "Plataforma del prototipo", x: 0, z: ROCKET_PLATFORM_Z, navigable: false },
  ];

  const rocketRoot = new BABYLONNS.TransformNode("gameplay-liquid-rocket", scene);
  rocketRoot.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, 0), ROCKET_PLATFORM_Z);
  rocketRoot.parent = root;
  const proceduralRocketRoot = new BABYLONNS.TransformNode("procedural-rocket-fallback", scene);
  proceduralRocketRoot.parent = rocketRoot;
  const shuttleModelRoot = new BABYLONNS.TransformNode("nasa-shuttle-model", scene);
  shuttleModelRoot.parent = rocketRoot;
  shuttleModelRoot.setEnabled(false);
  const rocketBody = BABYLONNS.MeshBuilder.CreateCylinder("gameplay-rocket-body", { height: 3.2, diameter: 0.38, tessellation: 12 }, scene);
  rocketBody.position.y = 1.6;
  rocketBody.material = propMat;
  rocketBody.parent = proceduralRocketRoot;
  const rocketNose = BABYLONNS.MeshBuilder.CreateCylinder("gameplay-rocket-nose", { height: 0.55, diameterTop: 0, diameterBottom: 0.38, tessellation: 12 }, scene);
  rocketNose.position.y = 3.47;
  rocketNose.material = markerMat;
  rocketNose.parent = proceduralRocketRoot;
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const fin = BABYLONNS.MeshBuilder.CreateBox(`gameplay-rocket-fin-${i}`, { width: 0.08, height: 0.55, depth: 0.5 }, scene);
    fin.position = new BABYLONNS.Vector3(Math.cos(angle) * 0.25, 0.52, Math.sin(angle) * 0.25);
    fin.rotation.y = -angle;
    fin.material = markerMat;
    fin.parent = proceduralRocketRoot;
  }
  const rocketRing = BABYLONNS.MeshBuilder.CreateTorus("gameplay-rocket-coupling", { diameter: 0.42, thickness: 0.045, tessellation: 12 }, scene);
  rocketRing.position.y = 2.35;
  rocketRing.material = markerMat;
  rocketRing.parent = proceduralRocketRoot;
  const rocketNozzle = BABYLONNS.MeshBuilder.CreateCylinder("gameplay-rocket-nozzle", { height: 0.28, diameterTop: 0.16, diameterBottom: 0.28, tessellation: 12 }, scene);
  rocketNozzle.position.y = -0.12;
  rocketNozzle.material = propMat;
  rocketNozzle.parent = proceduralRocketRoot;
  const oxidizedCopper = new BABYLONNS.PBRMaterial("rocket-weathered-copper-lines", scene);
  oxidizedCopper.albedoColor = BABYLONNS.Color3.FromHexString("#8d6746");
  oxidizedCopper.metallic = 0.65;
  oxidizedCopper.roughness = 0.62;
  for (const side of [-1, 1]) {
    const line = BABYLONNS.MeshBuilder.CreateCylinder(`rocket-external-line-${side}`, { height: 2.65, diameter: 0.052, tessellation: 10 }, scene);
    line.position = new BABYLONNS.Vector3(side * 0.25, 1.62, 0);
    line.material = oxidizedCopper;
    line.parent = proceduralRocketRoot;
    for (let y = 0.55; y < 3; y += 0.48) {
      const bracket = BABYLONNS.MeshBuilder.CreateTorus(`rocket-pipe-bracket-${side}-${y}`, { diameter: 0.11, thickness: 0.018, tessellation: 8 }, scene);
      bracket.position = new BABYLONNS.Vector3(side * 0.25, y, 0);
      bracket.rotation.z = Math.PI / 2;
      bracket.material = propMat;
      bracket.parent = proceduralRocketRoot;
    }
  }
  const engineBell = BABYLONNS.MeshBuilder.CreateCylinder("rocket-upper-engine-housing", { height: 0.4, diameterTop: 0.48, diameterBottom: 0.34, tessellation: 16 }, scene);
  engineBell.position.y = 3.13;
  engineBell.material = markerMat;
  engineBell.parent = proceduralRocketRoot;
  const engineCap = BABYLONNS.MeshBuilder.CreateCylinder("rocket-engine-collar", { height: 0.1, diameter: 0.46, tessellation: 16 }, scene);
  engineCap.position.y = 3.34;
  engineCap.material = propMat;
  engineCap.parent = proceduralRocketRoot;
  const rocketStart = rocketRoot.position.clone();
  const smokeTexture = new BABYLONNS.Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL3AAAAAElFTkSuQmCC", scene);
  const launchSmoke = new BABYLONNS.ParticleSystem("1926-launch-smoke", 220, scene);
  launchSmoke.particleTexture = smokeTexture;
  launchSmoke.emitter = rocketBody;
  launchSmoke.minEmitBox = new BABYLONNS.Vector3(-0.22, -1.55, -0.22);
  launchSmoke.maxEmitBox = new BABYLONNS.Vector3(0.22, -1.35, 0.22);
  launchSmoke.color1 = new BABYLONNS.Color4(0.47, 0.45, 0.4, 0.55);
  launchSmoke.color2 = new BABYLONNS.Color4(0.72, 0.7, 0.63, 0.38);
  launchSmoke.colorDead = new BABYLONNS.Color4(0.38, 0.37, 0.34, 0);
  launchSmoke.minSize = 0.32;
  launchSmoke.maxSize = 1.15;
  launchSmoke.minLifeTime = 0.35;
  launchSmoke.maxLifeTime = 1.35;
  launchSmoke.emitRate = 95;
  launchSmoke.minEmitPower = 0.3;
  launchSmoke.maxEmitPower = 1.4;
  launchSmoke.direction1 = new BABYLONNS.Vector3(-0.8, -1.7, -0.8);
  launchSmoke.direction2 = new BABYLONNS.Vector3(0.8, -0.5, 0.8);
  launchSmoke.gravity = new BABYLONNS.Vector3(0, -0.45, 0);
  let launchElapsed = -1;
  const instrumentMat = new BABYLONNS.StandardMaterial("gameplay-instrument-mat", scene);
  instrumentMat.diffuseColor = BABYLONNS.Color3.FromHexString("#b39a66");
  instrumentMat.emissiveColor = BABYLONNS.Color3.FromHexString("#302513");
  const instruments = new BABYLONNS.TransformNode("gameplay-rocket-instruments", scene);
  instruments.parent = proceduralRocketRoot;
  for (let i = 0; i < 3; i++) {
    const dial = BABYLONNS.MeshBuilder.CreateCylinder(`gameplay-rocket-dial-${i}`, { height: 0.045, diameter: 0.15, tessellation: 10 }, scene);
    dial.rotation.x = Math.PI / 2;
    dial.position = new BABYLONNS.Vector3(0.2, 1.25 + i * 0.34, 0);
    dial.material = instrumentMat;
    dial.parent = instruments;
  }
  instruments.setEnabled(false);
  for (let i = 0; i < 4; i++) {
    const bolt = BABYLONNS.MeshBuilder.CreateSphere(`gameplay-rocket-bolt-${i}`, { diameter: 0.055, segments: 6 }, scene);
    const angle = (i * Math.PI) / 2;
    bolt.position = new BABYLONNS.Vector3(Math.cos(angle) * 0.205, 2.35, Math.sin(angle) * 0.205);
    bolt.material = propMat;
    bolt.parent = proceduralRocketRoot;
  }
  const testStand = BABYLONNS.MeshBuilder.CreateBox("gameplay-test-stand", { width: 2.4, height: 0.15, depth: 2.4 }, scene);
  testStand.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, 0) + 0.07, ROCKET_PLATFORM_Z);
  testStand.material = markerMat;
  testStand.parent = root;
  const frameRoot = new BABYLONNS.TransformNode("1926-launch-frame", scene);
  frameRoot.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, 0), ROCKET_PLATFORM_Z);
  frameRoot.parent = root;
  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.55, 0.55]) {
      const upright = BABYLONNS.MeshBuilder.CreateCylinder(`launch-frame-upright-${x}-${z}`, { height: 4.4, diameter: 0.075, tessellation: 10 }, scene);
      upright.position = new BABYLONNS.Vector3(x, 2.2, z);
      upright.material = propMat;
      upright.parent = frameRoot;
    }
  }
  for (const y of [0.35, 1.35, 2.35, 3.35, 4.15]) {
    const crossbar = BABYLONNS.MeshBuilder.CreateBox(`launch-frame-crossbar-${y}`, { width: 1.2, height: 0.055, depth: 1.2 }, scene);
    crossbar.position.y = y;
    crossbar.material = markerMat;
    crossbar.parent = frameRoot;
  }

  const collisionObstacles = [
    { minX: -3.2, maxX: 3.2, minZ: ROCKET_PLATFORM_Z - 3.1, maxZ: ROCKET_PLATFORM_Z + 3.1 },
    // The house models have intentionally varied footprints and stay solid.
    { minX: -16.4, maxX: -5.6, minZ: -14.4, maxZ: -3.6 },
    { minX: 6.2, maxX: 15.8, minZ: 4.2, maxZ: 13.8 },
    { minX: 7.4, maxX: 14.6, minZ: -11.6, maxZ: -4.4 },
  ];
  // Keep tree trunks solid for both manual movement and waypoint routing.
  for (const [x, z] of [[-25, -18], [-22, -8], [25, -12], [24, 19], [-24, 20]]) {
    collisionObstacles.push({ minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.65, maxZ: z + 0.65 });
  }

  function resolveObjectCollisions(position: BABYLON.Vector3): { x: boolean; z: boolean } {
    let blockedX = false;
    let blockedZ = false;
    for (const obstacle of collisionObstacles) {
      const minX = obstacle.minX - PLAYER_COLLISION_RADIUS;
      const maxX = obstacle.maxX + PLAYER_COLLISION_RADIUS;
      const minZ = obstacle.minZ - PLAYER_COLLISION_RADIUS;
      const maxZ = obstacle.maxZ + PLAYER_COLLISION_RADIUS;
      if (position.x <= minX || position.x >= maxX || position.z <= minZ || position.z >= maxZ) continue;
      const pushX = Math.min(position.x - minX, maxX - position.x);
      const pushZ = Math.min(position.z - minZ, maxZ - position.z);
      if (pushX < pushZ) {
        position.x = position.x - minX < maxX - position.x ? minX : maxX;
        blockedX = true;
      } else {
        position.z = position.z - minZ < maxZ - position.z ? minZ : maxZ;
        blockedZ = true;
      }
    }
    return { x: blockedX, z: blockedZ };
  }

  /** Grid-based outdoor routing respects the sealed building footprints. */
  function findWalkPath(start: BABYLON.Vector3, goal: BABYLON.Vector3): BABYLON.Vector3[] {
    type PathNode = { x: number; z: number; g: number; f: number; parent?: PathNode };
    const min = -32;
    const max = 32;
    const blocked = (x: number, z: number) => x < min || x > max || z < min || z > max || collisionObstacles.some((obstacle) =>
      x > obstacle.minX - PLAYER_COLLISION_RADIUS - 0.12 && x < obstacle.maxX + PLAYER_COLLISION_RADIUS + 0.12 &&
      z > obstacle.minZ - PLAYER_COLLISION_RADIUS - 0.12 && z < obstacle.maxZ + PLAYER_COLLISION_RADIUS + 0.12);
    const startX = Math.round(start.x); const startZ = Math.round(start.z);
    let goalX = Math.round(goal.x); let goalZ = Math.round(goal.z);
    if (blocked(goalX, goalZ)) {
      const candidates: Array<{ x: number; z: number; score: number }> = [];
      for (let radius = 1; radius <= 4; radius++) {
        for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = Math.round(goal.x) + dx;
          const z = Math.round(goal.z) + dz;
          if (blocked(x, z)) continue;
          candidates.push({ x, z, score: Math.hypot(x - startX, z - startZ) + Math.hypot(x - goal.x, z - goal.z) * 0.35 });
        }
        if (candidates.length) break;
      }
      candidates.sort((a, b) => a.score - b.score);
      if (!candidates.length) return [];
      goalX = candidates[0]!.x;
      goalZ = candidates[0]!.z;
    }
    const key = (x: number, z: number) => `${x},${z}`;
    const open: PathNode[] = [{ x: startX, z: startZ, g: 0, f: Math.hypot(goalX - startX, goalZ - startZ) }];
    const best = new Map<string, number>([[key(startX, startZ), 0]]);
    const closed = new Set<string>();
    const directions = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ] as const;
    let found: PathNode | undefined;
    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      const currentKey = key(current.x, current.z);
      if (closed.has(currentKey)) continue;
      if (current.x === goalX && current.z === goalZ) { found = current; break; }
      closed.add(currentKey);
      for (const [dx, dz, cost] of directions) {
        const x = current.x + dx; const z = current.z + dz;
        if (blocked(x, z) || (dx !== 0 && dz !== 0 && (blocked(current.x + dx, current.z) || blocked(current.x, current.z + dz)))) continue;
        const nodeKey = key(x, z);
        const g = current.g + cost;
        if (g >= (best.get(nodeKey) ?? Infinity)) continue;
        best.set(nodeKey, g);
        open.push({ x, z, g, f: g + Math.hypot(goalX - x, goalZ - z), parent: current });
      }
    }
    if (!found) return [];
    const path: BABYLON.Vector3[] = [];
    for (let node: PathNode | undefined = found; node?.parent; node = node.parent) {
      path.unshift(new BABYLONNS.Vector3(node.x, terrain.getHeightAt(node.x, node.z), node.z));
    }
    path.push(blocked(Math.round(goal.x), Math.round(goal.z))
      ? new BABYLONNS.Vector3(goalX, terrain.getHeightAt(goalX, goalZ), goalZ)
      : goal.clone());
    return path;
  }

  const woodMat = createWeatheredMaterial(BABYLONNS, scene, "gameplay-weathered-wood", "#75583f", "wood");
  const darkMetalMat = createWeatheredMaterial(BABYLONNS, scene, "gameplay-oxidized-metal", "#3d4543", "metal");
  const plasterMat = createWeatheredMaterial(BABYLONNS, scene, "gameplay-lime-plaster", "#b9b099", "plaster");
  const glassMat = new BABYLONNS.PBRMaterial("gameplay-old-window-glass", scene);
  glassMat.albedoColor = BABYLONNS.Color3.FromHexString("#8eaaa8");
  glassMat.alpha = 0.62;
  glassMat.metallic = 0.08;
  glassMat.roughness = 0.28;
  const paperMat = new BABYLONNS.PBRMaterial("gameplay-aged-paper", scene);
  paperMat.albedoColor = BABYLONNS.Color3.FromHexString("#cbbb96");
  paperMat.roughness = 0.98;
  const grassMat = new BABYLONNS.StandardMaterial("gameplay-field-grass", scene);
  grassMat.diffuseColor = BABYLONNS.Color3.FromHexString("#596545");
  grassMat.roughness = 1;
  const leafMat = new BABYLONNS.StandardMaterial("gameplay-leaf-canopy", scene);
  leafMat.diffuseColor = BABYLONNS.Color3.FromHexString("#526447");
  leafMat.specularColor = new BABYLONNS.Color3(0.015, 0.02, 0.012);
  const missionSun = scene.getLightByName("morningSun");

  const buildZone = (name: string, x: number, z: number, width: number, depth: number) => {
    const baseY = terrain.getHeightAt(x, z);
    const building = new BABYLONNS.TransformNode(`gameplay-${name}`, scene);
    building.position = new BABYLONNS.Vector3(x, baseY, z);
    building.parent = root;
    const foundation = BABYLONNS.MeshBuilder.CreateBox(`${name}-stone-foundation`, { width: width + 0.14, height: 0.3, depth: depth + 0.12 }, scene);
    foundation.position.y = 0.16;
    foundation.material = darkMetalMat;
    foundation.parent = building;
    const wallPiece = (suffix: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const piece = BABYLONNS.MeshBuilder.CreateBox(`${name}-wall-${suffix}`, { width: w, height: h, depth: d }, scene);
      piece.position = new BABYLONNS.Vector3(x, y, z);
      piece.material = plasterMat;
      piece.parent = building;
    };
    for (const side of [-1, 1]) wallPiece(`side-${side}`, side * (width / 2 - 0.07), 1.1, 0, 0.14, 2.2, depth);
    wallPiece("back", 0, 1.1, -depth / 2 + 0.07, width, 2.2, 0.14);
    for (const side of [-1, 1]) {
      const windowX = side * (width * 0.28);
      const sideWidth = width / 2 - 0.45;
      wallPiece(`front-lower-${side}`, side * (width / 4 + 0.225), 0.55, depth / 2 - 0.07, sideWidth, 1.1, 0.14);
      wallPiece(`front-upper-${side}`, side * (width / 4 + 0.225), 1.88, depth / 2 - 0.07, sideWidth, 0.64, 0.14);
      for (const edge of [-1, 1]) wallPiece(`window-pier-${side}-${edge}`, windowX + edge * 0.42, 1.34, depth / 2 - 0.07, 0.24, 0.46, 0.14);
    }
    wallPiece("door-head", 0, 1.82, depth / 2 - 0.07, 0.9, 0.76, 0.14);
    for (const side of [-1, 1]) {
      const roof = BABYLONNS.MeshBuilder.CreateBox(`${name}-roof-slope-${side}`, { width: width + 0.46, height: 0.17, depth: depth * 0.62 }, scene);
      roof.position = new BABYLONNS.Vector3(0, 2.37, side * depth * 0.22);
      roof.rotation.x = side * 0.42;
      roof.material = darkMetalMat;
      roof.parent = building;
      const fascia = BABYLONNS.MeshBuilder.CreateBox(`${name}-fascia-${side}`, { width: width + 0.48, height: 0.19, depth: 0.11 }, scene);
      fascia.position = new BABYLONNS.Vector3(0, 2.22, side * (depth / 2 + 0.06));
      fascia.material = woodMat;
      fascia.parent = building;
    }
    const door = BABYLONNS.MeshBuilder.CreateBox(`${name}-door`, { width: 0.65, height: 1.25, depth: 0.04 }, scene);
    door.position = new BABYLONNS.Vector3(0, 0.62, depth / 2 + 0.025);
    door.material = darkMetalMat;
    door.parent = building;
    for (const side of [-1, 1]) {
      const jamb = BABYLONNS.MeshBuilder.CreateBox(`${name}-door-jamb-${side}`, { width: 0.1, height: 1.4, depth: 0.1 }, scene);
      jamb.position = new BABYLONNS.Vector3(side * 0.39, 0.7, depth / 2 + 0.065);
      jamb.material = woodMat;
      jamb.parent = building;
    }
    const lintel = BABYLONNS.MeshBuilder.CreateBox(`${name}-door-lintel`, { width: 0.88, height: 0.1, depth: 0.1 }, scene);
    lintel.position = new BABYLONNS.Vector3(0, 1.4, depth / 2 + 0.065);
    lintel.material = woodMat;
    lintel.parent = building;
    const handle = BABYLONNS.MeshBuilder.CreateSphere(`${name}-door-handle`, { diameter: 0.07, segments: 8 }, scene);
    handle.position = new BABYLONNS.Vector3(0.19, 0.64, depth / 2 + 0.09);
    handle.material = markerMat;
    handle.parent = building;
    for (const side of [-1, 1]) {
      const window = BABYLONNS.MeshBuilder.CreateBox(`${name}-window-${side}`, { width: 0.58, height: 0.42, depth: 0.035 }, scene);
      window.position = new BABYLONNS.Vector3(side * (width * 0.28), 1.34, depth / 2 + 0.03);
      window.material = glassMat;
      window.parent = building;
      const windowX = side * (width * 0.28);
      for (const edge of [-1, 1]) {
        const trimSide = BABYLONNS.MeshBuilder.CreateBox(`${name}-window-trim-side-${side}-${edge}`, { width: 0.07, height: 0.56, depth: 0.07 }, scene);
        trimSide.position = new BABYLONNS.Vector3(windowX + edge * 0.32, 1.34, depth / 2 + 0.06);
        trimSide.material = woodMat;
        trimSide.parent = building;
        const trimH = BABYLONNS.MeshBuilder.CreateBox(`${name}-window-trim-h-${side}-${edge}`, { width: 0.7, height: 0.065, depth: 0.07 }, scene);
        trimH.position = new BABYLONNS.Vector3(windowX, 1.34 + edge * 0.25, depth / 2 + 0.06);
        trimH.material = woodMat;
        trimH.parent = building;
      }
      const mullion = BABYLONNS.MeshBuilder.CreateBox(`${name}-window-mullion-${side}`, { width: 0.035, height: 0.42, depth: 0.04 }, scene);
      mullion.position = new BABYLONNS.Vector3(windowX, 1.34, depth / 2 + 0.095);
      mullion.material = woodMat;
      mullion.parent = building;
    }
    for (const side of [-1, 1]) {
      const timber = BABYLONNS.MeshBuilder.CreateBox(`${name}-corner-timber-${side}`, { width: 0.14, height: 2.22, depth: 0.14 }, scene);
      timber.position = new BABYLONNS.Vector3(side * (width / 2 - 0.1), 1.12, depth / 2 + 0.045);
      timber.material = woodMat;
      timber.parent = building;
    }
    const chimney = BABYLONNS.MeshBuilder.CreateBox(`${name}-chimney`, { width: 0.42, height: 0.82, depth: 0.42 }, scene);
    chimney.position = new BABYLONNS.Vector3(width * 0.28, 2.55, -depth * 0.2);
    chimney.material = darkMetalMat;
    chimney.parent = building;
    addBuildingSign(BABYLONNS, scene, building, name.replace(/-/g, " ").toUpperCase(), width, depth);
    return building;
  };

  const fallbackBuildings = [
    buildZone("laboratory", -11, -9, 10, 7.5),
    buildZone("storage", 11, -8, 3.2, 2.6),
    buildZone("workshop", 11, 9, 9, 7),
  ];

  async function loadEnvironmentModels(): Promise<void> {
    try {
      await import("@babylonjs/loaders/glTF");
      const treeResult = await BABYLONNS.SceneLoader.ImportMeshAsync(null, "/assets/models/", "arboles_optimized.glb", scene);
      const treeRoot = new BABYLONNS.TransformNode("model-tree-0", scene);
      treeRoot.parent = root;
      for (const mesh of treeResult.meshes) {
        if (!mesh.parent) mesh.parent = treeRoot;
        mesh.receiveShadows = true;
      }
      const treeBounds = treeRoot.getHierarchyBoundingVectors();
      const treeWidth = Math.max(0.01, treeBounds.max.x - treeBounds.min.x);
      treeRoot.scaling.setAll(3.2 / treeWidth);
      treeRoot.position = new BABYLONNS.Vector3(-25, -treeBounds.min.y * treeRoot.scaling.y, -18);
      const treePositions: Array<[number, number]> = [[-22, -8], [25, -12], [24, 19], [-24, 20]];
      for (const [index, position] of treePositions.entries()) {
        const clone = treeRoot.clone(`model-tree-${index}`, root);
        if (clone) clone.position = new BABYLONNS.Vector3(position[0], treeRoot.position.y, position[1]);
      }
    } catch (error) {
      console.warn("[Mission 01] Could not load environment models; using procedural buildings and vegetation.", error);
    }
  }
  void loadEnvironmentModels();

  async function loadBuildingModel(file: string, name: string, x: number, z: number, targetWidth: number): Promise<BABYLON.TransformNode> {
    const result = await BABYLONNS.SceneLoader.ImportMeshAsync(null, "/assets/models/", file, scene);
    const modelRoot = new BABYLONNS.TransformNode(`building-model-${name}`, scene);
    modelRoot.parent = root;
    for (const mesh of result.meshes) {
      if (!mesh.parent) mesh.parent = modelRoot;
      mesh.checkCollisions = false; // Player physics uses matching full-footprint AABBs.
      mesh.receiveShadows = true;
    }
    result.animationGroups.forEach((animation) => animation.stop());
    modelRoot.computeWorldMatrix(true);
    let bounds = modelRoot.getHierarchyBoundingVectors(true);
    const span = Math.max(0.01, bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    modelRoot.scaling.setAll(targetWidth / span);
    modelRoot.computeWorldMatrix(true);
    bounds = modelRoot.getHierarchyBoundingVectors(true);
    const groundY = terrain.getHeightAt(x, z);
    modelRoot.position.set(x - (bounds.min.x + bounds.max.x) / 2, groundY - bounds.min.y, z - (bounds.min.z + bounds.max.z) / 2);
    return modelRoot;
  }

  async function loadRequestedBuildings(): Promise<void> {
    const models: BABYLON.TransformNode[] = [];
    try {
      await import("@babylonjs/loaders/glTF");
      models.push(await loadBuildingModel("edificio_colon_-_modelo_3d_optimized.glb", "project-house", -11, -9, 10.8));
      models.push(await loadBuildingModel("mies_van_der_rohe_oficina_bacardi_optimized.glb", "workshop-house", 11, 9, 9.6));
      models.push(await loadBuildingModel("mies_van_der_rohe_oficina_bacardi_optimized.glb", "storage-house", 11, -8, 7.2));
      fallbackBuildings.forEach((building) => building.dispose(false, true));
    } catch (error) {
      models.forEach((model) => model.dispose(false, true));
      console.warn("[Mission 01] Building model load failed; keeping the procedural houses.", error);
    }
  }
  void loadRequestedBuildings();

  async function loadRequestedShuttle(): Promise<void> {
    try {
      await import("@babylonjs/loaders/glTF");
      const result = await BABYLONNS.SceneLoader.ImportMeshAsync(null, "/assets/models/", "space_shuttle_nasa_optimized.glb", scene);
      for (const mesh of result.meshes) {
        if (!mesh.parent) mesh.parent = shuttleModelRoot;
        mesh.receiveShadows = true;
        // The shuttle's source mesh has a very large shadow volume; keep it
        // lit by the field sun without obscuring the launch area with a wedge.
      }
      result.animationGroups.forEach((animation) => animation.stop());
      shuttleModelRoot.computeWorldMatrix(true);
      let bounds = shuttleModelRoot.getHierarchyBoundingVectors(true);
      const dimensions = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z];
      const longAxis = dimensions.indexOf(Math.max(...dimensions));
      if (longAxis === 0) shuttleModelRoot.rotation.z = -Math.PI / 2;
      else if (longAxis === 2) shuttleModelRoot.rotation.x = Math.PI / 2;
      shuttleModelRoot.computeWorldMatrix(true);
      bounds = shuttleModelRoot.getHierarchyBoundingVectors(true);
      const longest = Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z);
      shuttleModelRoot.scaling.setAll(8.5 / Math.max(0.01, longest));
      shuttleModelRoot.computeWorldMatrix(true);
      bounds = shuttleModelRoot.getHierarchyBoundingVectors(true);
      shuttleModelRoot.position.set(
        rocketRoot.position.x - (bounds.min.x + bounds.max.x) / 2,
        rocketRoot.position.y - bounds.min.y,
        rocketRoot.position.z - (bounds.min.z + bounds.max.z) / 2,
      );
      shuttleModelRoot.setEnabled(true);
      proceduralRocketRoot.setEnabled(false);
      console.info("[Mission 01] NASA shuttle asset loaded and aligned vertically on the launch frame.");
    } catch (error) {
      console.warn("[Mission 01] Could not load NASA shuttle; procedural rocket remains active.", error);
    }
  }
  void loadRequestedShuttle();

  const observationDeck = BABYLONNS.MeshBuilder.CreateBox("observation-deck", {
    width: 3.8,
    height: 0.12,
    depth: 2.4,
  }, scene);
  observationDeck.position = new BABYLONNS.Vector3(11, terrain.getHeightAt(11, -25) + 0.06, -25);
  observationDeck.material = woodMat;
  observationDeck.parent = root;
  for (let i = 0; i < 4; i++) {
    const post = BABYLONNS.MeshBuilder.CreateBox(`observation-post-${i}`, { width: 0.1, height: 1.1, depth: 0.1 }, scene);
    post.position = new BABYLONNS.Vector3(
      11 + (i % 2 === 0 ? -1.6 : 1.6),
      terrain.getHeightAt(11, -25) + 0.6,
      -25 + (i < 2 ? -0.9 : 0.9),
    );
    post.material = darkMetalMat;
    post.parent = root;
  }

  const createTree = (name: string, x: number, z: number, scale: number): void => {
    const y = terrain.getHeightAt(x, z);
    const tree = new BABYLONNS.TransformNode(name, scene);
    tree.position = new BABYLONNS.Vector3(x, y, z);
    tree.parent = root;
    const trunk = BABYLONNS.MeshBuilder.CreateCylinder(`${name}-trunk`, { height: 2.5 * scale, diameter: 0.22 * scale, tessellation: 7 }, scene);
    trunk.position.y = 1.25 * scale;
    trunk.material = woodMat;
    trunk.parent = tree;
    for (let i = 0; i < 7; i++) {
      const side = (i % 3) - 1;
      const crown = BABYLONNS.MeshBuilder.CreateIcoSphere(`${name}-crown-${i}`, { radius: 0.8 * scale, subdivisions: 3 }, scene);
      crown.position = new BABYLONNS.Vector3(side * 0.48 * scale, (2.18 + (i % 2) * 0.54) * scale, (i - 3) * 0.12 * scale);
      crown.scaling = new BABYLONNS.Vector3(0.85 + (i % 3) * 0.12, 1.08 + (i % 2) * 0.14, 0.88 + (i % 2) * 0.1);
      crown.material = leafMat;
      crown.parent = tree;
    }
    for (let i = 0; i < 4; i++) {
      const branch = BABYLONNS.MeshBuilder.CreateCylinder(`${name}-branch-${i}`, { height: 1.05 * scale, diameterTop: 0.045 * scale, diameterBottom: 0.095 * scale, tessellation: 7 }, scene);
      const angle = i * Math.PI / 2 + 0.35;
      branch.position = new BABYLONNS.Vector3(Math.cos(angle) * 0.48 * scale, 1.9 * scale, Math.sin(angle) * 0.48 * scale);
      branch.rotation.z = Math.cos(angle) * -0.78;
      branch.rotation.x = Math.sin(angle) * 0.78;
      branch.material = woodMat;
      branch.parent = tree;
    }
  };
  [
    [-24, -19, 1.3], [-19, -22, 0.95], [20, -19, 1.2], [25, -12, 1.5],
    [-25, 18, 1.1], [21, 21, 1.35], [27, 15, 0.9],
  ].forEach(([x, z, scale], index) => createTree(`field-tree-${index}`, x, z, scale));

  const fenceRoot = new BABYLONNS.TransformNode("field-fence-root", scene);
  for (let i = 0; i < 9; i++) {
    const x = -20 + i * 2.3;
    const post = BABYLONNS.MeshBuilder.CreateBox(`fence-post-${i}`, { width: 0.12, height: 1.15, depth: 0.12 }, scene);
    post.position = new BABYLONNS.Vector3(x, terrain.getHeightAt(x, 5) + 0.57, 5);
    post.material = woodMat;
    post.parent = fenceRoot;
    if (i < 8) {
      const rail = BABYLONNS.MeshBuilder.CreateBox(`fence-rail-${i}`, { width: 2.3, height: 0.1, depth: 0.1 }, scene);
      rail.position = new BABYLONNS.Vector3(x + 1.15, post.position.y + 0.1, 5);
      rail.material = woodMat;
      rail.parent = fenceRoot;
    }
  }

  const trackMat = new BABYLONNS.StandardMaterial("dirt-road-mat", scene);
  trackMat.diffuseColor = BABYLONNS.Color3.FromHexString("#817462");
  trackMat.roughness = 1;
  for (const z of [-10, -4, 2, 8]) {
    const path = BABYLONNS.MeshBuilder.CreateGround(`field-path-${z}`, { width: 0.55, height: 14, subdivisions: 1 }, scene);
    path.position = new BABYLONNS.Vector3(2, terrain.getHeightAt(2, z) + 0.035, z);
    path.material = trackMat;
    path.parent = root;
  }

  // CC0 photogrammetry props are bundled locally; there are no runtime CDN dependencies.
  const loadProp = async (slug: string, filename: string, x: number, z: number, scale: number, yaw = 0) => {
    try {
      await import("@babylonjs/loaders/glTF");
      const result = await BABYLONNS.SceneLoader.ImportMeshAsync(
        null,
        `/assets/polyhaven/models/${slug}/`,
        filename,
        scene,
      );
      const placement = new BABYLONNS.TransformNode(`polyhaven-${slug}-placement`, scene);
      placement.parent = downloadedProps;
      placement.position = new BABYLONNS.Vector3(x, terrain.getHeightAt(x, z), z);
      placement.rotation.y = yaw;
      placement.scaling.setAll(scale);
      for (const mesh of result.meshes) {
        if (!mesh.parent) mesh.parent = placement;
        mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(mesh, true);
      }
    } catch (error) {
      console.warn(`[Mission 01] Could not load local CC0 asset ${slug}.`, error);
    }
  };
  void loadProp("wooden_crate_02", "wooden_crate_02_1k.gltf", 10.2, -7.5, 0.8, 0.3);
  void loadProp("wooden_bucket_02", "wooden_bucket_02_1k.gltf", -2.8, -3.9, 0.7, 1.1);
  void loadProp("trowel_01", "trowel_01_1k.gltf", -9.5, 8.4, 0.78, -0.6);

  // Every interactive work surface is outdoors; the closed buildings are
  // landmarks and contain no usable interior space.
  const fieldStations = [
    { name: "project-notes", x: -8, z: -1, width: 2.8 },
    { name: "engineering-bench", x: 18.5, z: 8, width: 2.8 },
    { name: "test-instruments", x: -6, z: 9, width: 2.4 },
    { name: "observation-table", x: 8, z: -23, width: 2.4 },
  ];
  for (const station of fieldStations) {
    collisionObstacles.push({
      minX: station.x - station.width / 2 - 0.12,
      maxX: station.x + station.width / 2 + 0.12,
      minZ: station.z - 0.55,
      maxZ: station.z + 0.55,
    });
    const y = terrain.getHeightAt(station.x, station.z);
    const top = BABYLONNS.MeshBuilder.CreateBox(`${station.name}-weathered-top`, { width: station.width, height: 0.14, depth: 0.9 }, scene);
    top.position = new BABYLONNS.Vector3(station.x, y + 0.92, station.z);
    top.material = woodMat;
    top.parent = root;
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const leg = BABYLONNS.MeshBuilder.CreateBox(`${station.name}-leg-${side}-${end}`, { width: 0.1, height: 0.86, depth: 0.1 }, scene);
      leg.position = new BABYLONNS.Vector3(station.x + side * (station.width * 0.38), y + 0.43, station.z + end * 0.3);
      leg.material = darkMetalMat;
      leg.parent = root;
    }
    const plans = BABYLONNS.MeshBuilder.CreateBox(`${station.name}-field-notes`, { width: 0.48, height: 0.025, depth: 0.34 }, scene);
    plans.position = new BABYLONNS.Vector3(station.x - 0.4, y + 1.01, station.z - 0.08);
    plans.rotation.y = 0.12;
    plans.material = paperMat;
    plans.parent = root;
    const instrument = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-dial`, { height: 0.18, diameter: 0.32, tessellation: 16 }, scene);
    instrument.position = new BABYLONNS.Vector3(station.x + 0.58, y + 1.08, station.z + 0.08);
    instrument.material = propMat;
    instrument.parent = root;
  }

  pois.forEach((poi) => {
    const { x, z } = poi.position;
    const y = terrain.getHeightAt(x, z);

    const marker = BABYLONNS.MeshBuilder.CreateCylinder(`gameplay-poi-${poi.id}`, { height: 1.1, diameter: 0.7, tessellation: 8 }, scene);
    marker.position = new BABYLONNS.Vector3(x, y + 0.55, z);
    marker.material = markerMat;
    marker.parent = poiRoot;

    const flag = BABYLONNS.MeshBuilder.CreateBox(`gameplay-poi-flag-${poi.id}`, { width: 0.5, height: 0.35, depth: 0.02 }, scene);
    flag.position = new BABYLONNS.Vector3(x + 0.25, y + 1.2, z);
    flag.material = markerMat;
    flag.parent = poiRoot;

    poiMeshes.push({ poi, position: new BABYLONNS.Vector3(x, y, z) });
  });

  const fieldCrew = [
    { x: -6.9, z: -1.2, radius: 0.8, speed: 0.34, phase: 0.2 },
    { x: 18.4, z: 8.4, radius: 0.65, speed: 0.27, phase: 2.1 },
    { x: -5.3, z: 10.5, radius: 0.55, speed: 0.3, phase: 4.2 },
  ].map((worker) => {
    const character = createAstronautCharacter(BABYLONNS, scene);
    character.root.parent = root;
    character.root.scaling.setAll(0.78);
    character.root.position = new BABYLONNS.Vector3(worker.x, terrain.getHeightAt(worker.x, worker.z), worker.z);
    character.setMovementState(true, false);
    return { ...worker, character };
  });

  root.setEnabled(false);

  // --- Camera follow setup (reuses the ambient ArcRotateCamera instance) ---
  const cameraOffsetRadius = 7;
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = 0.02;
  camera.upperBetaLimit = Math.PI - 0.02;

  // --- Input state ---
  const keysDown = new Set<string>();
  let enabled = false;
  let velocity = new BABYLONNS.Vector3(0, 0, 0);
  let verticalVelocity = 0;
  let grounded = true;
  let leftShiftDown = false;
  let touchMoveX = 0;
  let touchMoveY = 0;
  let elapsed = 0;
  let navigationPath: BABYLON.Vector3[] = [];

  function onKeyDown(ev: KeyboardEvent): void {
    const key = ev.key.toLowerCase();
    keysDown.add(key);
    if (launchElapsed >= 0 && ["1", "2", "3"].includes(key)) {
      camera.radius = key === "1" ? 6.8 : key === "2" ? 12 : 8.5;
      camera.beta = key === "3" ? 0.72 : 1.05;
    }
    if (ev.code === "ShiftLeft") leftShiftDown = true;
    if (ev.code === "Space" && grounded && enabled) {
      verticalVelocity = JUMP_SPEED;
      grounded = false;
      ev.preventDefault();
    }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) navigationPath = [];
    if (key === "e" && nearestPoi) {
      navigationPath = [];
      interactCallback?.(nearestPoi.poi.id);
    }
  }
  function onKeyUp(ev: KeyboardEvent): void {
    keysDown.delete(ev.key.toLowerCase());
    if (ev.code === "ShiftLeft") leftShiftDown = false;
  }

  let nearestPoi: { poi: MissionPointOfInterest; position: BABYLON.Vector3 } | null = null;
  let nearestPoiCallback: ((poi: NearbyPoi | null) => void) | null = null;
  let interactCallback: ((poiId: string) => void) | null = null;
  let mapStateCallback: ((state: GameplayMapState) => void) | null = null;

  function updateNearestPoi(): void {
    let closest: { poi: MissionPointOfInterest; position: BABYLON.Vector3; distSq: number } | null = null;
    for (const entry of poiMeshes) {
      const dx = entry.position.x - astronaut.root.position.x;
      const dz = entry.position.z - astronaut.root.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= INTERACT_RADIUS * INTERACT_RADIUS && (!closest || distSq < closest.distSq)) {
        closest = { poi: entry.poi, position: entry.position, distSq };
      }
    }
    const next = closest ? { poi: closest.poi, position: closest.position } : null;
    const changed = next?.poi.id !== nearestPoi?.poi.id;
    nearestPoi = next;
    if (changed) {
      nearestPoiCallback?.(next ? { id: next.poi.id, label: next.poi.label } : null);
    }
  }

  return {
    handle: {
      onNearestPoiChange(cb) {
        nearestPoiCallback = cb;
      },
      onMapStateChange(cb) {
        mapStateCallback = cb;
        cb({
          player: { x: astronaut.root.position.x, z: astronaut.root.position.z, direction: astronaut.root.rotation.y },
          points: getMapPoints(),
        });
      },
      onInteract(cb) {
        interactCallback = cb;
      },
      reset() {
        astronaut.root.position.set(PLAYER_START.x, terrain.getHeightAt(PLAYER_START.x, PLAYER_START.z), PLAYER_START.z);
        astronaut.root.rotation.set(0, 0, 0);
        velocity.set(0, 0, 0);
        verticalVelocity = 0;
        grounded = true;
        touchMoveX = 0;
        touchMoveY = 0;
        leftShiftDown = false;
        navigationPath = [];
        rocketRoot.position.copyFrom(rocketStart);
        rocketRoot.scaling.setAll(1);
        launchElapsed = -1;
        launchSmoke.stop();
        camera.alpha = -Math.PI / 2;
        camera.beta = 1.1;
        camera.radius = cameraOffsetRadius;
        camera.target.copyFrom(astronaut.root.position);
        playAvatarAnimation(false, false);
        this.setDesign("balanced", "basic");
      },
      setDesign(structure, instrumentation) {
        rocketRoot.scaling.y = structure === "light" ? 0.92 : structure === "reinforced" ? 1.12 : 1;
        rocketRoot.scaling.x = structure === "reinforced" ? 1.08 : 1;
        rocketRoot.scaling.z = structure === "reinforced" ? 1.08 : 1;
        instruments.setEnabled(instrumentation === "extended");
      },
      navigateTo(poiId) {
        const target = poiMeshes.find((entry) => entry.poi.id === poiId);
        navigationPath = target ? findWalkPath(astronaut.root.position, target.position) : [];
      },
      playLaunch() {
        launchElapsed = 0;
        rocketRoot.position.copyFrom(rocketStart);
        camera.radius = 8.5;
        camera.beta = 1.05;
        launchSmoke.start();
      },
      setMissionProgress(progress) {
        const morning = Math.max(0, Math.min(1, progress));
        // The mission advances from a low, warm dawn sun toward late morning.
        // Weather changes the strength of direct light while the moving sun
        // direction gradually shortens shadows across the exterior field.
        if (missionSun) {
          missionSun.intensity = (0.88 + morning * 0.52) * weather.lightFactor;
          (missionSun as BABYLON.DirectionalLight).direction = new BABYLONNS.Vector3(
            -0.62 + morning * 0.28,
            -0.54 - morning * 0.36,
            0.36 - morning * 0.08,
          ).normalize();
        }
        scene.fogColor = BABYLONNS.Color3.Lerp(
          BABYLONNS.Color3.FromHexString("#aeb5b5"),
          BABYLONNS.Color3.FromHexString("#c1b49b"),
          morning,
        );
      },
      setTouchMovement(x, y) {
        touchMoveX = Math.max(-1, Math.min(1, x));
        touchMoveY = Math.max(-1, Math.min(1, y));
        if (Math.hypot(touchMoveX, touchMoveY) > 0.12) navigationPath = [];
      },
      setTouchSprint(active) { leftShiftDown = active; },
      jump() {
        if (grounded && enabled) {
          verticalVelocity = JUMP_SPEED;
          grounded = false;
        }
      },
      interact() {
        if (nearestPoi) {
          navigationPath = [];
          interactCallback?.(nearestPoi.poi.id);
        }
      },
      getWeather() { return weather.label; },
    },
    enable() {
      if (enabled) return;
      enabled = true;
      velocity.set(0, 0, 0);
      verticalVelocity = 0;
      grounded = true;
      root.setEnabled(true);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      // The ambient backdrop keeps `camera.inputs` empty (no user control);
      // add mouse-drag orbiting only while the gameplay layer is active, and
      // strip it again on `disable()` to restore the ambient behavior.
      camera.inputs.clear();
      camera.inputs.addPointers();
      camera.attachControl(canvas, true);
      camera.radius = cameraOffsetRadius;
      camera.alpha = -Math.PI / 2;
      camera.beta = 1.1;
      camera.target = astronaut.root.position.clone();
    },
    disable() {
      if (!enabled) return;
      enabled = false;
      keysDown.clear();
      leftShiftDown = false;
      touchMoveX = 0;
      touchMoveY = 0;
      velocity.set(0, 0, 0);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      camera.detachControl();
      camera.inputs.clear();
      root.setEnabled(false);
    },
    update(deltaSeconds: number) {
      if (!enabled) return;
      elapsed += deltaSeconds;
      if (launchElapsed >= 0) {
        launchElapsed += deltaSeconds;
        // Clear the 4.4 m launch frame, then keep climbing at an increasing
        // rate. The vehicle never descends or resets unless the player resets
        // the mission explicitly.
        const poweredAscentTime = Math.min(launchElapsed, 3.5);
        const initialAscent = 0.55 * poweredAscentTime * poweredAscentTime;
        const coastTime = Math.max(0, launchElapsed - 3.5);
        const continuingAscent = 3.85 * coastTime + 0.045 * coastTime * coastTime;
        rocketRoot.position.x = rocketStart.x;
        rocketRoot.position.z = rocketStart.z;
        rocketRoot.position.y = rocketStart.y + initialAscent + continuingAscent;
        if (launchElapsed > 6) launchSmoke.stop();
      }

      // Movement is camera-relative: forward/right derived from the
      // camera's horizontal orbit angle so WASD always feels intuitive
      // regardless of where the player has orbited the view.
      const forward = new BABYLONNS.Vector3(Math.cos(camera.alpha), 0, Math.sin(camera.alpha));
      const right = new BABYLONNS.Vector3(forward.z, 0, -forward.x);
      let moveX = 0;
      let moveZ = 0;
      moveX += right.x * touchMoveX - forward.x * touchMoveY;
      moveZ += right.z * touchMoveX - forward.z * touchMoveY;
      if (keysDown.has("w") || keysDown.has("arrowup")) {
        moveX -= forward.x;
        moveZ -= forward.z;
      }
      if (keysDown.has("s") || keysDown.has("arrowdown")) {
        moveX += forward.x;
        moveZ += forward.z;
      }
      if (keysDown.has("a") || keysDown.has("arrowleft")) {
        moveX -= right.x;
        moveZ -= right.z;
      }
      if (keysDown.has("d") || keysDown.has("arrowright")) {
        moveX += right.x;
        moveZ += right.z;
      }

      let movementStrength = Math.min(1, Math.hypot(moveX, moveZ));
      if (navigationPath.length > 0) {
        const waypoint = navigationPath[0]!;
        const dx = waypoint.x - astronaut.root.position.x;
        const dz = waypoint.z - astronaut.root.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance <= 0.85) navigationPath.shift();
        else { moveX = dx / distance; moveZ = dz / distance; movementStrength = 1; }
      }

      const moveLenSq = moveX * moveX + moveZ * moveZ;
      const hasInput = moveLenSq > 0.0001;
      if (hasInput) {
        const invLen = 1 / Math.sqrt(moveLenSq);
        moveX *= invLen;
        moveZ *= invLen;
        const speed = (leftShiftDown ? RUN_SPEED : MOVE_SPEED) * movementStrength;
        const targetX = moveX * speed;
        const targetZ = moveZ * speed;
        velocity.x += (targetX - velocity.x) * Math.min(1, MOVE_ACCELERATION * deltaSeconds);
        velocity.z += (targetZ - velocity.z) * Math.min(1, MOVE_ACCELERATION * deltaSeconds);
      } else {
        const damping = Math.max(0, 1 - MOVE_BRAKING * deltaSeconds);
        velocity.x *= damping;
        velocity.z *= damping;
      }
      const walking = velocity.lengthSquared() > 0.02;
      astronaut.root.position.x += velocity.x * deltaSeconds;
      astronaut.root.position.z += velocity.z * deltaSeconds;
      astronaut.root.position.x = Math.max(-FIELD_HALF_SIZE, Math.min(FIELD_HALF_SIZE, astronaut.root.position.x));
      astronaut.root.position.z = Math.max(-FIELD_HALF_SIZE, Math.min(FIELD_HALF_SIZE, astronaut.root.position.z));
      const collision = resolveObjectCollisions(astronaut.root.position);
      if (collision.x) velocity.x = 0;
      if (collision.z) velocity.z = 0;
      verticalVelocity -= EARTH_GRAVITY * deltaSeconds;
      astronaut.root.position.y += verticalVelocity * deltaSeconds;
      const groundY = terrain.getHeightAt(astronaut.root.position.x, astronaut.root.position.z);
      if (astronaut.root.position.y <= groundY) {
        astronaut.root.position.y = groundY;
        verticalVelocity = 0;
        grounded = true;
      }
      if (walking) astronaut.root.rotation.y = Math.atan2(velocity.x, velocity.z);
      astronaut.setMovementState(walking, walking && leftShiftDown);
      playAvatarAnimation(walking, walking && leftShiftDown, !grounded);
      astronaut.update(deltaSeconds);
      for (const worker of fieldCrew) {
        const angle = elapsed * worker.speed + worker.phase;
        const x = worker.x + Math.cos(angle) * worker.radius;
        const z = worker.z + Math.sin(angle) * worker.radius * 0.55;
        worker.character.root.position.x = x;
        worker.character.root.position.z = z;
        worker.character.root.position.y = terrain.getHeightAt(x, z);
        worker.character.root.rotation.y = -angle + Math.PI / 2;
        worker.character.update(deltaSeconds);
      }

      const cameraTracksRocket = launchElapsed >= 0 && launchElapsed < 14;
      camera.target.copyFrom(cameraTracksRocket ? rocketRoot.position : astronaut.root.position);
      camera.target.y += cameraTracksRocket ? 1.8 : 1.2;
      if (launchElapsed >= 14) camera.radius = cameraOffsetRadius;

      updateNearestPoi();
      mapStateCallback?.({
        player: { x: astronaut.root.position.x, z: astronaut.root.position.z, direction: astronaut.root.rotation.y },
        points: getMapPoints(),
      });
    },
  dispose() {
      this.disable();
      astronaut.dispose();
      for (const worker of fieldCrew) worker.character.dispose();
      launchSmoke.dispose();
      smokeTexture.dispose();
      terrain.dispose();
      poiRoot.dispose(false, true);
      downloadedProps.dispose(false, true);
      rocketRoot.dispose(false, true);
      fenceRoot.dispose(false, true);
      testStand.dispose();
      propMat.dispose();
      instrumentMat.dispose();
      woodMat.dispose(false, true);
      darkMetalMat.dispose(false, true);
      plasterMat.dispose(false, true);
      paperMat.dispose();
      markerMat.dispose();
      glassMat.dispose();
      grassMat.dispose();
      leafMat.dispose();
      sky.dispose(false, true);
      trackMat.dispose();
      root.dispose(false, true);
    },
  };
}

function createAuburnSky(BABYLONNS: BabylonNamespace, scene: BABYLON.Scene): BABYLON.Mesh {
  const sky = BABYLONNS.MeshBuilder.CreateSphere("auburn-sky-dome", {
    diameter: 180,
    segments: 24,
    sideOrientation: BABYLONNS.Mesh.BACKSIDE,
  }, scene);
  sky.infiniteDistance = true;
  const texture = new BABYLONNS.DynamicTexture("auburn-overcast-sky", { width: 1024, height: 512 }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#667988");
  gradient.addColorStop(0.46, "#a9b8bf");
  gradient.addColorStop(0.78, "#d1d3cc");
  gradient.addColorStop(1, "#b4b9b1");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 54; i++) {
    const x = Math.random() * 1024;
    const y = 80 + Math.random() * 220;
    const w = 45 + Math.random() * 170;
    const h = 6 + Math.random() * 22;
    ctx.globalAlpha = 0.025 + Math.random() * 0.055;
    ctx.fillStyle = i % 3 ? "#f2eee3" : "#6e8088";
    ctx.beginPath(); ctx.ellipse(x, y, w, h, (Math.random() - 0.5) * 0.08, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; texture.update();
  const material = new BABYLONNS.StandardMaterial("auburn-sky-material", scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.disableLighting = true;
  material.backFaceCulling = false;
  sky.material = material;
  sky.isPickable = false;
  return sky;
}

function createWeatheredMaterial(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  name: string,
  baseColor: string,
  style: "wood" | "metal" | "plaster",
): BABYLON.PBRMaterial {
  const texture = new BABYLONNS.DynamicTexture(`${name}-surface`, { width: 512, height: 512 }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);
  const palette = style === "wood"
    ? ["#34281e", "#b08b5b", "#4c3828", "#c2a071"]
    : style === "metal"
      ? ["#252f2e", "#744a32", "#9b6946", "#62665d"]
      : ["#e1d9c4", "#8c8068", "#aa9b7d", "#f0e7d0"];
  for (let i = 0; i < 1850; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.globalAlpha = 0.025 + Math.random() * 0.17;
    ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)]!;
    if (style === "wood") {
      ctx.fillRect(x, y, 80 + Math.random() * 280, 0.5 + Math.random() * 2.4);
    } else {
      const radius = 2 + Math.random() * (style === "metal" ? 28 : 44);
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * (0.4 + Math.random()), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (style === "wood") {
    ctx.globalAlpha = 0.12;
    for (let x = 12; x < 512; x += 54) {
      ctx.strokeStyle = "#2e231a"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 7, 140, x - 8, 320, x + 2, 512); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + 15, 190 + (x % 4) * 40, 5, 12, 0.3, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  texture.update();
  texture.wrapU = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  texture.wrapV = BABYLONNS.Texture.WRAP_ADDRESSMODE;
  const material = new BABYLONNS.PBRMaterial(name, scene);
  material.albedoTexture = texture;
  material.roughness = style === "metal" ? 0.75 : 0.94;
  material.metallic = style === "metal" ? 0.38 : 0;
  return material;
}

function addBuildingSign(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  parent: BABYLON.TransformNode,
  label: string,
  width: number,
  depth: number,
): void {
  const board = BABYLONNS.MeshBuilder.CreateBox(`${label}-sign-board`, { width: Math.min(1.8, width * 0.65), height: 0.34, depth: 0.08 }, scene);
  board.position = new BABYLONNS.Vector3(0, 1.94, depth / 2 + 0.09);
  board.material = new BABYLONNS.StandardMaterial(`${label}-sign-wood`, scene);
  (board.material as BABYLON.StandardMaterial).diffuseColor = BABYLONNS.Color3.FromHexString("#493b2b");
  board.parent = parent;
  const face = BABYLONNS.MeshBuilder.CreatePlane(`${label}-sign-face`, { width: Math.min(1.72, width * 0.63), height: 0.27 }, scene);
  face.position = new BABYLONNS.Vector3(0, 1.94, depth / 2 + 0.137);
  const texture = new BABYLONNS.DynamicTexture(`${label}-sign-lettering`, { width: 512, height: 96 }, scene, true);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#493b2b"; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#e0cda5"; ctx.font = "bold 37px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, 256, 48, 480);
  texture.update();
  const material = new BABYLONNS.StandardMaterial(`${label}-sign-face-material`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = BABYLONNS.Color3.FromHexString("#211c14");
  face.material = material;
  face.parent = parent;
}
