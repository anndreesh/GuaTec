import type * as BABYLON from "@babylonjs/core";
import type { MissionPointOfInterest } from "@/config/gameConfig";
import { createAstronautCharacter, type BabylonNamespace } from "@/babylon/gameplay/AstronautCharacter";
import { createMarsTerrain } from "@/babylon/gameplay/MarsTerrain";

export interface NearbyPoi {
  id: string;
  label: string;
  prompt?: string;
}

export interface GameplayMapState {
  player: { x: number; z: number; direction: number };
  points: Array<{ id: string; label: string; x: number; z: number; navigable?: boolean; discovered?: boolean }>;
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
  setDesign(structure: "light" | "balanced" | "reinforced", instrumentation: "basic" | "balanced" | "advanced"): void;
  playLaunch(): void;
  playOpeningCinematic(onDone?: () => void): void;
  setPeakAltitude(meters: number): void;
  setMissionProgress(progress: number): void;
  setTouchMovement(x: number, y: number): void;
  setTouchSprint(active: boolean): void;
  jump(): void;
  interact(): void;
  getWeather(): AuburnWeather;
  setCameraMode(mode: "cinematic" | "observation" | "telemetry"): void;
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
// Route waypoints stop outside solid station and launch-frame footprints; keep interaction
// reach large enough to use a station without walking through its collider.
const INTERACT_RADIUS = 4;
/** Distance at which a location is marked as discovered on the mission map. */
const DISCOVERY_RADIUS = 18;
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
  const sky = createAuburnSky(BABYLONNS, scene);
  sky.parent = root;
  createAuburnStars(BABYLONNS, scene, root);

  const terrain = createMarsTerrain(BABYLONNS, scene);
  terrain.ground.parent = root;
  scene.fogMode = BABYLONNS.Scene.FOGMODE_EXP2;
  const weatherOptions: Array<{ label: AuburnWeather; fogDensity: number }> = [
    { label: "CLEAR", fogDensity: 0.0022 },
    { label: "CLOUDY", fogDensity: 0.0028 },
    { label: "LIGHT MIST", fogDensity: 0.0032 },
    { label: "WINDY", fogDensity: 0.0025 },
  ];
  const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)]!;
  scene.fogDensity = weather.fogDensity;
  scene.fogColor = BABYLONNS.Color3.FromHexString("#10182b");

  const astronaut = createAstronautCharacter(BABYLONNS, scene);
  astronaut.root.parent = root;
  // ArcRotateCamera needs a real scene node to follow, rather than receiving
  // copied world coordinates each frame. This anchor rides with the avatar's
  // upper body and produces an actual third-person camera pivot.
  const cameraFollowAnchor = BABYLONNS.MeshBuilder.CreateSphere("player-camera-follow-anchor", { diameter: 0.01 }, scene);
  cameraFollowAnchor.parent = astronaut.root;
  cameraFollowAnchor.position.y = 1.12;
  cameraFollowAnchor.isVisible = false;
  cameraFollowAnchor.isPickable = false;
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

  const rocketShellMat = new BABYLONNS.PBRMaterial("rocket-ivory-enamel", scene);
  rocketShellMat.albedoColor = BABYLONNS.Color3.FromHexString("#d8d0b9");
  rocketShellMat.metallic = 0.18;
  rocketShellMat.roughness = 0.58;
  const rocketMarkingMat = new BABYLONNS.PBRMaterial("rocket-oxide-markings", scene);
  rocketMarkingMat.albedoColor = BABYLONNS.Color3.FromHexString("#a54e31");
  rocketMarkingMat.metallic = 0.24;
  rocketMarkingMat.roughness = 0.58;

  const poiRoot = new BABYLONNS.TransformNode("gameplay-poi-root", scene);
  const poiMeshes: { poi: MissionPointOfInterest; position: BABYLON.Vector3 }[] = [];
  // Locations become "discovered" once the player has been near them (see updateNearestPoi).
  const discoveredPoiIds = new Set<string>();
  const getMapPoints = () => [
    ...poiMeshes.map(({ poi, position }) => ({
      id: poi.id, label: poi.label, x: position.x, z: position.z, navigable: true,
      discovered: discoveredPoiIds.has(poi.id),
    })),
    { id: "prototype-platform", label: "Plataforma del prototipo", x: 0, z: ROCKET_PLATFORM_Z, navigable: false, discovered: true },
  ];

  const rocketRoot = new BABYLONNS.TransformNode("gameplay-liquid-rocket", scene);
  rocketRoot.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, ROCKET_PLATFORM_Z), ROCKET_PLATFORM_Z);
  rocketRoot.parent = root;
  const proceduralRocketRoot = new BABYLONNS.TransformNode("procedural-rocket-fallback", scene);
  proceduralRocketRoot.parent = rocketRoot;
  // Keep a clearly visible generated rocket in the scene even if the external
  // GLB fails to load or its model data is incomplete.
  proceduralRocketRoot.scaling.set(1.5, 1.8, 1.5);
  const shuttleModelRoot = new BABYLONNS.TransformNode("nasa-shuttle-model", scene);
  shuttleModelRoot.parent = rocketRoot;
  shuttleModelRoot.setEnabled(false);
  const rocketBody = BABYLONNS.MeshBuilder.CreateCylinder("gameplay-rocket-body", { height: 3.2, diameter: 0.42, tessellation: 16 }, scene);
  rocketBody.position.y = 1.6;
  rocketBody.material = rocketShellMat;
  rocketBody.parent = proceduralRocketRoot;
  const rocketNose = BABYLONNS.MeshBuilder.CreateCylinder("gameplay-rocket-nose", { height: 0.62, diameterTop: 0, diameterBottom: 0.42, tessellation: 16 }, scene);
  rocketNose.position.y = 3.47;
  rocketNose.material = rocketMarkingMat;
  rocketNose.parent = proceduralRocketRoot;
  for (const [index, y] of [0.52, 2.48].entries()) {
    const band = BABYLONNS.MeshBuilder.CreateCylinder(`gameplay-rocket-painted-band-${index}`, {
      height: 0.13,
      diameter: 0.432,
      tessellation: 16,
    }, scene);
    band.position.y = y;
    band.material = rocketMarkingMat;
    band.parent = proceduralRocketRoot;
  }
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const fin = BABYLONNS.MeshBuilder.CreateBox(`gameplay-rocket-fin-${i}`, { width: 0.09, height: 0.58, depth: 0.54 }, scene);
    fin.position = new BABYLONNS.Vector3(Math.cos(angle) * 0.27, 0.5, Math.sin(angle) * 0.27);
    fin.rotation.y = -angle;
    fin.material = rocketMarkingMat;
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

  // High-intensity rocket engine flame
  const launchFlame = new BABYLONNS.ParticleSystem("1926-launch-flame", 160, scene);
  launchFlame.particleTexture = smokeTexture;
  launchFlame.emitter = rocketNozzle;
  launchFlame.minEmitBox = new BABYLONNS.Vector3(-0.06, -0.15, -0.06);
  launchFlame.maxEmitBox = new BABYLONNS.Vector3(0.06, 0.05, 0.06);
  launchFlame.color1 = new BABYLONNS.Color4(1.0, 0.82, 0.22, 0.95);
  launchFlame.color2 = new BABYLONNS.Color4(0.96, 0.42, 0.08, 0.75);
  launchFlame.colorDead = new BABYLONNS.Color4(0.28, 0.12, 0.04, 0);
  launchFlame.minSize = 0.14;
  launchFlame.maxSize = 0.48;
  launchFlame.minLifeTime = 0.12;
  launchFlame.maxLifeTime = 0.35;
  launchFlame.emitRate = 140;
  launchFlame.minEmitPower = 1.6;
  launchFlame.maxEmitPower = 3.2;
  launchFlame.direction1 = new BABYLONNS.Vector3(-0.25, -2.4, -0.25);
  launchFlame.direction2 = new BABYLONNS.Vector3(0.25, -3.2, 0.25);

  // Ambient morning atmospheric dust/pollen motes catching dawn light
  const ambientDust = new BABYLONNS.ParticleSystem("auburn-morning-dust", 85, scene);
  ambientDust.particleTexture = smokeTexture;
  ambientDust.emitter = new BABYLONNS.Vector3(0, 1.5, 0);
  ambientDust.minEmitBox = new BABYLONNS.Vector3(-30, 0.6, -30);
  ambientDust.maxEmitBox = new BABYLONNS.Vector3(30, 3.8, 30);
  ambientDust.color1 = new BABYLONNS.Color4(0.45, 0.53, 0.75, 0.1);
  ambientDust.color2 = new BABYLONNS.Color4(0.57, 0.61, 0.79, 0.07);
  ambientDust.colorDead = new BABYLONNS.Color4(0.3, 0.34, 0.48, 0);
  ambientDust.minSize = 0.03;
  ambientDust.maxSize = 0.12;
  ambientDust.minLifeTime = 3.5;
  ambientDust.maxLifeTime = 7.0;
  ambientDust.emitRate = 2;
  ambientDust.minEmitPower = 0.04;
  ambientDust.maxEmitPower = 0.18;
  ambientDust.direction1 = new BABYLONNS.Vector3(-0.25, 0.04, 0.15);
  ambientDust.direction2 = new BABYLONNS.Vector3(0.25, 0.10, 0.55);
  ambientDust.start();

  let launchElapsed = -1;
  let launchPeakAltitude = 12.5;
  let openingElapsed = -1;
  let openingDone: (() => void) | null = null;
  let activeCameraMode: "cinematic" | "observation" | "telemetry" = "cinematic";

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
  testStand.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, ROCKET_PLATFORM_Z) + 0.07, ROCKET_PLATFORM_Z);
  testStand.material = markerMat;
  testStand.parent = root;

  // Flame blast deflector plate beneath the nozzle
  const blastDeflector = BABYLONNS.MeshBuilder.CreateBox("blast-deflector-bucket", { width: 0.85, height: 0.22, depth: 0.85 }, scene);
  blastDeflector.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, ROCKET_PLATFORM_Z) + 0.16, ROCKET_PLATFORM_Z);
  blastDeflector.rotation.x = 0.28;
  blastDeflector.material = propMat;
  blastDeflector.parent = root;

  // Pressurized nitrogen bottle and pressure regulator
  const nitrogenBottle = BABYLONNS.MeshBuilder.CreateCapsule("launch-nitrogen-tank", { height: 1.35, radius: 0.15 }, scene);
  nitrogenBottle.position = new BABYLONNS.Vector3(1.4, terrain.getHeightAt(1.4, ROCKET_PLATFORM_Z) + 0.68, ROCKET_PLATFORM_Z + 0.7);
  const tankMat = new BABYLONNS.PBRMaterial("nitrogen-tank-mat", scene);
  tankMat.albedoColor = BABYLONNS.Color3.FromHexString("#2e4839");
  tankMat.metallic = 0.62;
  tankMat.roughness = 0.58;
  nitrogenBottle.material = tankMat;
  nitrogenBottle.parent = root;

  // Liquid oxygen and gasoline glass/metal carboys
  const carboyMat = new BABYLONNS.PBRMaterial("propellant-carboy-mat", scene);
  carboyMat.albedoColor = BABYLONNS.Color3.FromHexString("#4a585a");
  carboyMat.metallic = 0.2;
  carboyMat.roughness = 0.4;
  for (const [cx, cz] of [[-1.3, ROCKET_PLATFORM_Z + 0.6], [-1.7, ROCKET_PLATFORM_Z + 0.5]]) {
    const carboy = BABYLONNS.MeshBuilder.CreateCylinder(`carboy-${cx}`, { height: 0.52, diameter: 0.26, tessellation: 12 }, scene);
    carboy.position = new BABYLONNS.Vector3(cx, terrain.getHeightAt(cx, cz) + 0.26, cz);
    carboy.material = carboyMat;
    carboy.parent = root;
  }

  // Safety barrier posts around launch perimeter
  const barrierPosts = new BABYLONNS.TransformNode("launch-barrier-posts", scene);
  barrierPosts.parent = root;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const bx = Math.cos(angle) * 5.8;
    const bz = ROCKET_PLATFORM_Z + Math.sin(angle) * 5.8;
    const post = BABYLONNS.MeshBuilder.CreateCylinder(`barrier-post-${i}`, { height: 1.05, diameter: 0.075 }, scene);
    post.position = new BABYLONNS.Vector3(bx, terrain.getHeightAt(bx, bz) + 0.52, bz);
    post.material = propMat;
    post.parent = barrierPosts;
    const flag = BABYLONNS.MeshBuilder.CreateBox(`barrier-flag-${i}`, { width: 0.28, height: 0.16, depth: 0.02 }, scene);
    flag.position = new BABYLONNS.Vector3(bx + 0.12, post.position.y + 0.42, bz);
    flag.material = markerMat;
    flag.parent = barrierPosts;
  }

  // Weather station with spinning anemometer cups at test area
  const anemometerRoot = new BABYLONNS.TransformNode("weather-anemometer-root", scene);
  anemometerRoot.position = new BABYLONNS.Vector3(-6, terrain.getHeightAt(-6, 12), 12);
  anemometerRoot.parent = root;
  const mast = BABYLONNS.MeshBuilder.CreateCylinder("anemometer-mast", { height: 3.1, diameter: 0.065 }, scene);
  mast.position.y = 1.55;
  mast.material = propMat;
  mast.parent = anemometerRoot;
  const cupHead = new BABYLONNS.TransformNode("anemometer-cups", scene);
  cupHead.position.y = 3.05;
  cupHead.parent = anemometerRoot;
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const arm = BABYLONNS.MeshBuilder.CreateCylinder(`cup-arm-${i}`, { height: 0.26, diameter: 0.018 }, scene);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = angle;
    arm.position = new BABYLONNS.Vector3(Math.cos(angle) * 0.13, 0, Math.sin(angle) * 0.13);
    arm.material = propMat;
    arm.parent = cupHead;
    const cup = BABYLONNS.MeshBuilder.CreateSphere(`cup-bowl-${i}`, { diameter: 0.08, segments: 6 }, scene);
    cup.position = new BABYLONNS.Vector3(Math.cos(angle) * 0.26, 0, Math.sin(angle) * 0.26);
    cup.material = markerMat;
    cup.parent = cupHead;
  }

  // Surveyor theodolite / telescope on tripod at Observation Area
  const theodoliteRoot = new BABYLONNS.TransformNode("observation-theodolite", scene);
  theodoliteRoot.position = new BABYLONNS.Vector3(7.4, terrain.getHeightAt(7.4, -22), -22);
  theodoliteRoot.parent = root;
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const leg = BABYLONNS.MeshBuilder.CreateCylinder(`theodolite-leg-${i}`, { height: 1.3, diameter: 0.04 }, scene);
    leg.position = new BABYLONNS.Vector3(Math.cos(angle) * 0.22, 0.65, Math.sin(angle) * 0.22);
    leg.rotation.z = Math.cos(angle) * 0.22;
    leg.rotation.x = Math.sin(angle) * 0.22;
    leg.material = propMat;
    leg.parent = theodoliteRoot;
  }
  const theodoliteScope = BABYLONNS.MeshBuilder.CreateCylinder("theodolite-scope", { height: 0.52, diameterTop: 0.055, diameterBottom: 0.085 }, scene);
  theodoliteScope.position.y = 1.35;
  theodoliteScope.rotation.x = 0.32;
  theodoliteScope.material = markerMat;
  theodoliteScope.parent = theodoliteRoot;

  const frameRoot = new BABYLONNS.TransformNode("1926-launch-frame", scene);
  frameRoot.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, ROCKET_PLATFORM_Z), ROCKET_PLATFORM_Z);
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
  ];

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

  /** Grid-based outdoor routing respects the launch frame and work-station footprints. */
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
  const paperMat = new BABYLONNS.PBRMaterial("gameplay-aged-paper", scene);
  paperMat.albedoColor = BABYLONNS.Color3.FromHexString("#cbbb96");
  paperMat.roughness = 0.98;
  // Restore the mission's existing 3D rocket asset; keep the generated vehicle
  // visible until the model finishes loading so a missing asset has a fallback.
  void (async () => {
    try {
      await import("@babylonjs/loaders/glTF");
      const result = await BABYLONNS.SceneLoader.ImportMeshAsync(
        null,
        "/assets/models/",
        "space_shuttle_nasa_optimized.glb",
        scene,
      );
      const importedRoot = result.meshes.find((mesh) => mesh.name === "__root__") ?? result.meshes[0];
      if (importedRoot) importedRoot.parent = shuttleModelRoot;
      // The GLB is modeled lengthwise along Z. Rotate it upright, then scale
      // its measured height to a plausible 4.6 m experimental rocket.
      shuttleModelRoot.rotation.x = Math.PI / 2;
      shuttleModelRoot.scaling.setAll(1);
      shuttleModelRoot.position.y = 0;
      shuttleModelRoot.computeWorldMatrix(true);
      result.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
      const modelMeshes = result.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
      const worldBounds = () => {
        shuttleModelRoot.computeWorldMatrix(true);
        modelMeshes.forEach((mesh) => mesh.computeWorldMatrix(true));
        const boxes = modelMeshes.map((mesh) => mesh.getBoundingInfo().boundingBox);
        return {
          minX: Math.min(...boxes.map((box) => box.minimumWorld.x)),
          maxX: Math.max(...boxes.map((box) => box.maximumWorld.x)),
          minY: Math.min(...boxes.map((box) => box.minimumWorld.y)),
          maxY: Math.max(...boxes.map((box) => box.maximumWorld.y)),
          minZ: Math.min(...boxes.map((box) => box.minimumWorld.z)),
          maxZ: Math.max(...boxes.map((box) => box.maximumWorld.z)),
        };
      };
      const initialBounds = worldBounds();
      if (modelMeshes.length && initialBounds.maxY > initialBounds.minY) {
        shuttleModelRoot.scaling.setAll(7.2 / (initialBounds.maxY - initialBounds.minY));
        const scaledBounds = worldBounds();
        const groundY = terrain.getHeightAt(0, ROCKET_PLATFORM_Z);
        // Center the lower body over the support plate. The fins and upper
        // hardware can be asymmetric, so centering the full model makes its
        // "belly" visibly miss the stand.
        const lowerBodyCentersX = modelMeshes
          .map((mesh) => mesh.getBoundingInfo().boundingBox)
          .filter((box) => {
            const widthX = box.maximumWorld.x - box.minimumWorld.x;
            const widthZ = box.maximumWorld.z - box.minimumWorld.z;
            return box.minimumWorld.y <= scaledBounds.minY + 1.1 && widthX <= 2.2 && widthZ <= 2.2;
          })
          .map((box) => (box.minimumWorld.x + box.maximumWorld.x) / 2)
          .sort((a, b) => a - b);
        const baseAxisX = lowerBodyCentersX.length
          ? lowerBodyCentersX[Math.floor(lowerBodyCentersX.length / 2)]!
          : (scaledBounds.minX + scaledBounds.maxX) / 2;
        shuttleModelRoot.position.x += frameRoot.position.x - baseAxisX;
        shuttleModelRoot.position.y += groundY + 0.12 - scaledBounds.minY;
        shuttleModelRoot.position.z += ROCKET_PLATFORM_Z - (scaledBounds.minZ + scaledBounds.maxZ) / 2;
      }
      shuttleModelRoot.setEnabled(true);
    } catch (error) {
      console.warn("Could not load the mission rocket model; using the generated rocket instead.", error);
    }
  })();
  proceduralRocketRoot.setEnabled(true);

  const observationDeck = BABYLONNS.MeshBuilder.CreateBox("observation-deck", {
    width: 3.8,
    height: 0.12,
    depth: 2.4,
  }, scene);
  observationDeck.position = new BABYLONNS.Vector3(11, terrain.getHeightAt(11, -25) + 0.06, -25);
  observationDeck.material = woodMat;
  observationDeck.parent = root;
  const shed = new BABYLONNS.TransformNode("open-equipment-shed", scene);
  shed.position = new BABYLONNS.Vector3(14.2, terrain.getHeightAt(14.2, -2.8), -2.8);
  shed.parent = root;
  const shedRoof = BABYLONNS.MeshBuilder.CreateBox("open-shed-roof", { width: 3.4, height: 0.08, depth: 2.2 }, scene);
  shedRoof.position.y = 2.15;
  shedRoof.rotation.z = -0.08;
  shedRoof.material = woodMat;
  shedRoof.parent = shed;
  for (const x of [-1.5, 1.5]) {
    const post = BABYLONNS.MeshBuilder.CreateBox(`open-shed-post-${x}`, { width: 0.12, height: 2.1, depth: 0.12 }, scene);
    post.position = new BABYLONNS.Vector3(x, 1.05, 0.9);
    post.material = darkMetalMat;
    post.parent = shed;
  }
  const crate = BABYLONNS.MeshBuilder.CreateBox("open-shed-crate", { width: 0.7, height: 0.45, depth: 0.55 }, scene);
  crate.position.y = 0.24;
  crate.material = woodMat;
  crate.parent = shed;
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

  // The open equipment shelter is the only structure. Mission work stays at
  // the outdoor project, engineering, test, launch, and observation stations.
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

    const isRecord = poi.id.startsWith("record-");
    const marker = BABYLONNS.MeshBuilder.CreateCylinder(`gameplay-poi-${poi.id}`, {
      height: isRecord ? 0.55 : 1.1,
      diameter: isRecord ? 0.28 : 0.55,
      tessellation: 8,
    }, scene);
    marker.position = new BABYLONNS.Vector3(x, y + (isRecord ? 0.28 : 0.55), z);
    marker.material = markerMat;
    marker.parent = poiRoot;

    const flag = BABYLONNS.MeshBuilder.CreateBox(`gameplay-poi-flag-${poi.id}`, {
      width: isRecord ? 0.28 : 0.42,
      height: isRecord ? 0.18 : 0.3,
      depth: 0.02,
    }, scene);
    flag.position = new BABYLONNS.Vector3(x + 0.18, y + (isRecord ? 0.62 : 1.15), z);
    flag.material = markerMat;
    flag.parent = poiRoot;

    poiMeshes.push({ poi, position: new BABYLONNS.Vector3(x, y, z) });
  });

  const fieldCrew = [
    { x: 16.8, z: 9.4, radius: 0.55, speed: 0.28, phase: 0.2, role: "propulsion" as const },
    { x: 5.1, z: -12.2, radius: 0.7, speed: 0.22, phase: 2.1, role: "structural" as const },
    { x: 6.6, z: -21.2, radius: 0.5, speed: 0.26, phase: 4.2, role: "data" as const },
    { x: -5.2, z: 2.2, radius: 0.35, speed: 0.18, phase: 1.1, role: "director" as const },
  ].map((worker) => {
    const character = createAstronautCharacter(BABYLONNS, scene, { role: worker.role });
    character.root.parent = root;
    character.root.scaling.setAll(0.78);
    character.root.position = new BABYLONNS.Vector3(worker.x, terrain.getHeightAt(worker.x, worker.z), worker.z);
    character.setMovementState(true, false);
    return { ...worker, character };
  });

  root.setEnabled(false);

  // --- Camera follow setup (reuses the ambient ArcRotateCamera instance) ---
  // Normal exploration is a close third-person follow view.  The older
  // 48-unit establishing-shot radius made the camera feel pinned to the map
  // rather than carried by the astronaut.
  const cameraOffsetRadius = 5.6;
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 56;
  // Keep the orbit on the upper side of the horizon so the camera can never
  // pass below the ground when the player or camera target moves.
  camera.lowerBetaLimit = 0.35;
  camera.upperBetaLimit = 1.5;

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

  /** Lock the orbit pivot to the astronaut's upper body. Only the player
   * controls the orbit angles; world movement carries the camera with them. */
  function followAstronaut(): void {
    camera.lockedTarget = cameraFollowAnchor;
  }

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
      if (distSq <= DISCOVERY_RADIUS * DISCOVERY_RADIUS) discoveredPoiIds.add(entry.poi.id);
      if (distSq <= INTERACT_RADIUS * INTERACT_RADIUS && (!closest || distSq < closest.distSq)) {
        closest = { poi: entry.poi, position: entry.position, distSq };
      }
    }
    const next = closest ? { poi: closest.poi, position: closest.position } : null;
    const changed = next?.poi.id !== nearestPoi?.poi.id;
    nearestPoi = next;
    if (changed) {
      nearestPoiCallback?.(next ? { id: next.poi.id, label: next.poi.label, prompt: next.poi.prompt } : null);
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
        discoveredPoiIds.clear();
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
        openingElapsed = -1;
        launchSmoke.stop();
        launchFlame.stop();
        camera.alpha = -Math.PI / 2;
        camera.beta = 1.05;
        camera.radius = cameraOffsetRadius;
        followAstronaut();
        playAvatarAnimation(false, false);
        this.setDesign("balanced", "basic");
      },
      setDesign(structure, instrumentation) {
        rocketRoot.scaling.y = structure === "light" ? 0.92 : structure === "reinforced" ? 1.12 : 1;
        rocketRoot.scaling.x = structure === "reinforced" ? 1.08 : structure === "light" ? 0.94 : 1;
        rocketRoot.scaling.z = structure === "reinforced" ? 1.08 : structure === "light" ? 0.94 : 1;
        instruments.setEnabled(instrumentation !== "basic");
        frameRoot.setEnabled(structure !== "light");
        frameRoot.scaling.setAll(structure === "reinforced" ? 1.12 : 1);
      },
      navigateTo(poiId) {
        const target = poiMeshes.find((entry) => entry.poi.id === poiId);
        navigationPath = target ? findWalkPath(astronaut.root.position, target.position) : [];
      },
      playLaunch() {
        launchElapsed = 0;
        rocketRoot.position.copyFrom(rocketStart);
        camera.lockedTarget = null;
        camera.radius = 8.5;
        camera.beta = 1.05;
        launchSmoke.start();
        launchFlame.start();
      },
      setCameraMode(mode) {
        activeCameraMode = mode;
        camera.lockedTarget = null;
        if (mode === "observation") {
          camera.target.copyFrom(rocketRoot.position);
          camera.alpha = -Math.PI * 0.45;
          camera.beta = 1.25;
          camera.radius = 16;
        } else if (mode === "telemetry") {
          camera.target.copyFrom(rocketRoot.position);
          camera.alpha = -Math.PI / 3;
          camera.beta = 1.45;
          camera.radius = 4.2;
        } else {
          camera.target.copyFrom(rocketRoot.position);
          camera.alpha = -Math.PI / 2;
          camera.beta = 1.1;
          camera.radius = 8.5;
        }
      },
      playOpeningCinematic(onDone) {
        openingElapsed = 0;
        openingDone = onDone ?? null;
        camera.lockedTarget = null;
        camera.radius = 22;
        camera.beta = 1.02;
        camera.alpha = Math.PI * 0.46;
        camera.target = new BABYLONNS.Vector3(0, 1.4, -5);
      },
      setPeakAltitude(meters) {
        launchPeakAltitude = Math.max(2, Math.min(16, meters));
      },
      setMissionProgress(progress) {
        const launchGlow = Math.max(0, Math.min(1, progress));
        scene.fogColor = BABYLONNS.Color3.Lerp(
          BABYLONNS.Color3.FromHexString("#10182b"),
          BABYLONNS.Color3.FromHexString("#241d32"),
          launchGlow * 0.42,
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
      camera.beta = 1.05;
      followAstronaut();
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
      camera.lockedTarget = null;
      root.setEnabled(false);
    },
    update(deltaSeconds: number) {
      if (!enabled) return;
      elapsed += deltaSeconds;
      if (openingElapsed >= 0) {
        openingElapsed += deltaSeconds;
        camera.lockedTarget = null;
        camera.alpha = -Math.PI * 0.15 - openingElapsed * 0.18;
        camera.radius = 22 - openingElapsed * 0.9;
        camera.target = new BABYLONNS.Vector3(
          Math.sin(openingElapsed * 0.2) * 4,
          1.4 + openingElapsed * 0.04,
          -6 + openingElapsed * 0.4,
        );
        if (openingElapsed >= 7.5) {
          openingElapsed = -1;
          camera.radius = cameraOffsetRadius;
          camera.beta = 1.05;
          camera.alpha = -Math.PI / 2;
          followAstronaut();
          openingDone?.();
          openingDone = null;
        }
        for (const worker of fieldCrew) {
          const angle = elapsed * worker.speed + worker.phase;
          const x = worker.x + Math.cos(angle) * worker.radius;
          const z = worker.z + Math.sin(angle) * worker.radius * 0.55;
          worker.character.root.position.x = x;
          worker.character.root.position.z = z;
          worker.character.root.position.y = terrain.getHeightAt(x, z);
          worker.character.update(deltaSeconds);
        }
        return;
      }
      cupHead.rotation.y += deltaSeconds * (weather.label === "WINDY" ? 9 : 4.5);
      if (launchElapsed >= 0) {
        launchElapsed += deltaSeconds;
        const climb = launchPeakAltitude * (1 - Math.exp(-launchElapsed / 1.8));
        const drift = launchElapsed * 0.55;
        rocketRoot.position.x = rocketStart.x + drift * 0.15;
        rocketRoot.position.z = rocketStart.z - drift;
        rocketRoot.position.y = rocketStart.y + climb;
        if (launchElapsed > 4.5) {
          launchSmoke.stop();
          launchFlame.stop();
        }
      }

      // ArcRotateCamera's alpha vector points from the target toward the
      // camera. The astronaut's forward direction is the opposite vector.
      const cameraDirection = new BABYLONNS.Vector3(Math.cos(camera.alpha), 0, Math.sin(camera.alpha));
      const forward = cameraDirection.scale(-1);
      const right = new BABYLONNS.Vector3(cameraDirection.z, 0, -cameraDirection.x);
      let moveX = 0;
      let moveZ = 0;
      moveX -= right.x * touchMoveX - forward.x * touchMoveY;
      moveZ -= right.z * touchMoveX - forward.z * touchMoveY;
      if (keysDown.has("w") || keysDown.has("arrowup")) {
        // W / ↑ moves forward, away from the camera behind the astronaut.
        moveX += forward.x;
        moveZ += forward.z;
      }
      if (keysDown.has("s") || keysDown.has("arrowdown")) {
        // S / ↓ moves backward.
        moveX -= forward.x;
        moveZ -= forward.z;
      }
      if (keysDown.has("a") || keysDown.has("arrowleft")) {
        moveX += right.x;
        moveZ += right.z;
      }
      if (keysDown.has("d") || keysDown.has("arrowright")) {
        moveX -= right.x;
        moveZ -= right.z;
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
        const distToPlayer = Math.hypot(worker.character.root.position.x - astronaut.root.position.x, worker.character.root.position.z - astronaut.root.position.z);
        if (distToPlayer < 4.2) {
          const lookAngle = Math.atan2(astronaut.root.position.x - worker.character.root.position.x, astronaut.root.position.z - worker.character.root.position.z);
          worker.character.root.rotation.y = lookAngle;
          worker.character.setMovementState(false, false);
        } else {
          const angle = elapsed * worker.speed + worker.phase;
          const x = worker.x + Math.cos(angle) * worker.radius;
          const z = worker.z + Math.sin(angle) * worker.radius * 0.55;
          worker.character.root.position.x = x;
          worker.character.root.position.z = z;
          worker.character.root.position.y = terrain.getHeightAt(x, z);
          worker.character.root.rotation.y = -angle + Math.PI / 2;
          worker.character.setMovementState(true, false);
        }
        worker.character.update(deltaSeconds);
      }

      const cameraTracksRocket = launchElapsed >= 0 && launchElapsed < 14 && openingElapsed < 0;
      if (cameraTracksRocket) {
        camera.lockedTarget = null;
        if (activeCameraMode === "observation") {
          camera.target.copyFrom(rocketRoot.position);
          camera.alpha = -Math.PI * 0.45;
          camera.beta = 1.25;
          camera.radius = 16;
        } else if (activeCameraMode === "telemetry") {
          camera.target.copyFrom(rocketRoot.position);
          camera.alpha = -Math.PI / 3;
          camera.beta = 1.45;
          camera.radius = 4.2;
        } else {
          camera.target.copyFrom(rocketRoot.position);
          camera.target.y += 1.8;
          if (launchElapsed < 2.5) {
            camera.target.x += (Math.random() - 0.5) * 0.04;
            camera.target.y += (Math.random() - 0.5) * 0.04;
          }
        }
      } else if (openingElapsed < 0) {
        followAstronaut();
      }
      if (launchElapsed >= 14) camera.radius = cameraOffsetRadius;

      updateNearestPoi();
      mapStateCallback?.({
        player: { x: astronaut.root.position.x, z: astronaut.root.position.z, direction: astronaut.root.rotation.y },
        points: getMapPoints(),
      });
    },
  dispose() {
      this.disable();
      camera.lockedTarget = null;
      astronaut.dispose();
      for (const worker of fieldCrew) worker.character.dispose();
      launchSmoke.dispose();
      launchFlame.dispose();
      ambientDust.dispose();
      smokeTexture.dispose();
      terrain.dispose();
      poiRoot.dispose(false, true);
      rocketRoot.dispose(false, true);
      testStand.dispose();
      propMat.dispose();
      instrumentMat.dispose();
      woodMat.dispose(false, true);
      darkMetalMat.dispose(false, true);
      paperMat.dispose();
      markerMat.dispose();
      rocketShellMat.dispose();
      rocketMarkingMat.dispose();
      sky.dispose(false, true);
      root.dispose(false, true);
    },
  };
}

function createAuburnSky(BABYLONNS: BabylonNamespace, scene: BABYLON.Scene): BABYLON.Mesh {
  const sky = BABYLONNS.MeshBuilder.CreateSphere("auburn-sky-dome", {
    diameter: 180,
    segments: 48,
    sideOrientation: BABYLONNS.Mesh.BACKSIDE,
  }, scene);
  // Keep the sky dome fixed in the mission world. The star meshes sit just
  // inside this shell, so moving an infinite-distance dome would hide them.
  sky.infiniteDistance = false;
  const texture = new BABYLONNS.DynamicTexture("auburn-procedural-starry-sky", { width: 2048, height: 1024 }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, "#02050d");
  gradient.addColorStop(0.24, "#060b1a");
  gradient.addColorStop(0.43, "#111b35");
  gradient.addColorStop(0.5, "#313047");
  gradient.addColorStop(0.56, "#493847");
  gradient.addColorStop(0.69, "#171b31");
  gradient.addColorStop(1, "#050814");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 1024);

  // A broad, feathered galactic band gives the panorama depth beyond the stars.
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const layer of [
    { color: "rgba(104, 119, 171, 0.04)", width: 190, blur: 90 },
    { color: "rgba(150, 131, 183, 0.055)", width: 108, blur: 54 },
    { color: "rgba(190, 182, 208, 0.07)", width: 36, blur: 28 },
  ]) {
    ctx.beginPath();
    ctx.moveTo(-80, 320);
    ctx.bezierCurveTo(390, 430, 680, 430, 1100, 320);
    ctx.bezierCurveTo(1460, 210, 1700, 210, 2130, 320);
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = layer.width;
    ctx.lineCap = "round";
    ctx.shadowColor = layer.color;
    ctx.shadowBlur = layer.blur;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  let seed = 19260316;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Soft nebula knots and dust lanes sit inside the galactic band.
  for (let i = 0; i < 160; i++) {
    const x = random() * 2048;
    const centerY = 320 + Math.sin(x * 0.00307) * 108;
    const y = centerY + (random() - 0.5) * 190;
    const radius = 18 + random() * 115;
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, random() > 0.5 ? "rgba(167, 177, 213, 0.035)" : "rgba(195, 150, 190, 0.03)");
    cloud.addColorStop(1, "rgba(74, 89, 140, 0)");
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * (0.18 + random() * 0.45), -0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  texture.update();
  const material = new BABYLONNS.StandardMaterial("auburn-sky-material", scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.emissiveColor = BABYLONNS.Color3.White();
  material.disableLighting = true;
  material.backFaceCulling = false;
  sky.material = material;
  sky.isPickable = false;
  return sky;
}

function createAuburnStars(
  BABYLONNS: BabylonNamespace,
  scene: BABYLON.Scene,
  root: BABYLON.TransformNode,
): void {
  const makeMaterial = (name: string, color: string): BABYLON.StandardMaterial => {
    const material = new BABYLONNS.StandardMaterial(name, scene);
    material.diffuseColor = BABYLONNS.Color3.Black();
    material.emissiveColor = BABYLONNS.Color3.FromHexString(color);
    material.specularColor = BABYLONNS.Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = false;
    return material;
  };
  const softIvory = makeMaterial("auburn-star-soft-ivory", "#c7d5ee");
  const coolWhite = makeMaterial("auburn-star-cool-white", "#edf2ff");
  const warmAccent = makeMaterial("auburn-star-warm-accent", "#e6bd91");
  // Seeded random points create a natural sky while staying stable between
  // frames and reloads. A minimum angular gap keeps them from forming noisy
  // clumps; the world-space positions never depend on camera direction.
  let seed = 19260316;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const directions: BABYLON.Vector3[] = [];
  const minimumDot = Math.cos(13 * Math.PI / 180);
  for (let attempt = 0; directions.length < 22 && attempt < 2000; attempt++) {
    // Keep the seeded scatter across the fixed forward sky above the range,
    // where it is visible from the starting position; these world angles do
    // not change when the player or camera moves.
    const azimuth = Math.PI + (random() - 0.5) * Math.PI * 0.9;
    const elevation = (10 + random() * 58) * Math.PI / 180;
    const direction = new BABYLONNS.Vector3(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation),
    );
    if (directions.every((other) => BABYLONNS.Vector3.Dot(other, direction) < minimumDot)) {
      directions.push(direction);
    }
  }
  const skyRadius = 82;
  directions.forEach((direction, index) => {
    const focalStar = index % 7 === 0;
    const size = focalStar ? 0.58 : 0.3 + random() * 0.15;
    const star = BABYLONNS.MeshBuilder.CreateSphere(`auburn-star-${index}`, {
      diameter: size,
      segments: 8,
    }, scene);
    star.position.copyFrom(direction.scale(skyRadius));
    star.parent = root;
    star.material = focalStar
      ? [coolWhite, warmAccent][Math.floor(random() * 2)]!
      : softIvory;
    star.isPickable = false;
    star.receiveShadows = false;
    star.alwaysSelectAsActiveMesh = true;
  });
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
