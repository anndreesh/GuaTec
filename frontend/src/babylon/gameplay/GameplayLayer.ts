import type * as BABYLON from "@babylonjs/core";
import type { MissionPointOfInterest } from "@/config/gameConfig";
import { createAstronautCharacter, type BabylonNamespace } from "@/babylon/gameplay/AstronautCharacter";
import { createMarsTerrain } from "@/babylon/gameplay/MarsTerrain";
import { createLaunchSupport } from "./LaunchSupport";
import { createEngineeringInstruments, type EngineeringFeedbackKind } from "./EngineeringInstruments";
import { createWorkshopAssets, type WorkshopAsset } from "./WorkshopAssets";
import { createFieldStations, FIELD_STATION_LOCATIONS, type FieldStationId } from "./FieldStations";

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
  onLaunchExit(cb: (() => void) | null): void;
  finishLaunch(): void;
  setFieldDraftFeedback(id: FieldStationId, draft: import("../../state/Mission01FieldTasks").FieldTaskDraft): void;
  setFieldFocus(id: Exclude<FieldStationId, "route"> | null): void;
  setFieldFeedback(id: FieldStationId, progress: number, value?: number): void;
  setRouteInspections(ids: string[]): void;
  playOpeningCinematic(onDone?: () => void): void;
  setPeakAltitude(meters: number): void;
  setMissionProgress(progress: number): void;
  setTouchMovement(x: number, y: number): void;
  setTouchSprint(active: boolean): void;
  jump(): void;
  interact(): void;
  getWeather(): AuburnWeather;
  setCameraMode(mode: "cinematic" | "observation" | "telemetry"): void;
  setEngineeringFeedback(kind: EngineeringFeedbackKind, progress: number, value?: number): void;
  setInputSuspended(suspended: boolean): void;
  setQuality(profile: "high" | "balanced"): void;
  getDiagnostics(): { fps: number; frameMs: number; drawCalls: number; activeMeshes: number; vertices: number; materials: number; textures: number; quality: "high" | "balanced" };
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
  const instrumentation = new BABYLONNS.SceneInstrumentation(scene);
  let disposed = false;
  let inputSuspended = false;
  let quality: "high" | "balanced" = "balanced";
  try { if (localStorage.getItem("guatec-graphics-quality") === "high") quality = "high"; } catch { /* optional storage */ }
  let pressureFeedback = 0;
  let fieldFocus: Exclude<FieldStationId, "route"> | null = null;
  let fieldCameraBackup: { alpha: number; beta: number; radius: number } | null = null;
  const sky = createAuburnSky(BABYLONNS, scene);
  sky.parent = root;
  const terrain = createMarsTerrain(BABYLONNS, scene);
  terrain.ground.parent = root;
  // The floor never changes after creation; avoid per-frame transform work.
  terrain.ground.freezeWorldMatrix();
  scene.fogMode = BABYLONNS.Scene.FOGMODE_EXP2;
  const weatherOptions: Array<{ label: AuburnWeather; fogDensity: number }> = [
    { label: "CLEAR", fogDensity: 0.0022 },
    { label: "CLOUDY", fogDensity: 0.0028 },
    { label: "LIGHT MIST", fogDensity: 0.0032 },
    { label: "WINDY", fogDensity: 0.0025 },
  ];
  const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)]!;
  scene.fogDensity = weather.fogDensity;
  scene.fogColor = BABYLONNS.Color3.FromHexString("#b9aa91");

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
  const contactTexture = new BABYLONNS.DynamicTexture("player-soft-ground-contact", { width: 64, height: 64 }, scene, true);
  const contactContext = contactTexture.getContext() as unknown as CanvasRenderingContext2D;
  const contactGradient = contactContext.createRadialGradient(32, 32, 3, 32, 32, 31);
  contactGradient.addColorStop(0, "rgba(0,0,0,0.5)"); contactGradient.addColorStop(1, "rgba(0,0,0,0)");
  contactContext.fillStyle = contactGradient; contactContext.fillRect(0, 0, 64, 64); contactTexture.hasAlpha = true; contactTexture.update();
  const contactMaterial = new BABYLONNS.StandardMaterial("player-ground-contact-material", scene);
  contactMaterial.diffuseTexture = contactTexture; contactMaterial.opacityTexture = contactTexture;
  contactMaterial.disableLighting = true; contactMaterial.emissiveColor = BABYLONNS.Color3.Black();
  const playerContact = BABYLONNS.MeshBuilder.CreateGround("player-contact-shadow", { width: 0.95, height: 0.72 }, scene);
  playerContact.material = contactMaterial; playerContact.parent = root; playerContact.isPickable = false;
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
      const result = await BABYLONNS.SceneLoader.ImportMeshAsync(null, "/assets/models/", quality === "balanced" ? "mercenary_astronaut_balanced.glb" : "mercenary_astronaut_optimized.glb", scene);
      if (disposed) { result.animationGroups.forEach(group => group.dispose()); result.skeletons.forEach(skeleton => skeleton.dispose()); result.meshes.forEach(mesh => mesh.dispose(false, true)); return; }
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
      avatarAnimationGroups.forEach((group) => { group.stop(); group.enableBlending = true; group.blendingSpeed = 0.08; });
      playAvatarAnimation(false, false);
      if (!enabled) activeAvatarAnimation?.pause();
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

  const createBeam = (
    name: string,
    start: BABYLON.Vector3,
    end: BABYLON.Vector3,
    diameter: number,
    material: BABYLON.Material,
    parent: BABYLON.TransformNode,
  ): BABYLON.Mesh => {
    const direction = end.subtract(start);
    const beam = BABYLONNS.MeshBuilder.CreateCylinder(name, { height: direction.length(), diameter, tessellation: 10 }, scene);
    beam.position = start.add(end).scale(0.5);
    beam.rotationQuaternion = new BABYLONNS.Quaternion();
    BABYLONNS.Quaternion.FromUnitVectorsToRef(BABYLONNS.Vector3.Up(), direction.normalize(), beam.rotationQuaternion);
    beam.material = material;
    beam.parent = parent;
    return beam;
  };

  const brassMat = new BABYLONNS.PBRMaterial("field-hardware-aged-brass", scene);
  brassMat.albedoColor = BABYLONNS.Color3.FromHexString("#8d7046");
  brassMat.metallic = 0.72;
  brassMat.roughness = 0.48;
  const saddleLeatherMat = new BABYLONNS.PBRMaterial("rocket-saddle-dark-leather", scene);
  saddleLeatherMat.albedoColor = BABYLONNS.Color3.FromHexString("#51372d");
  saddleLeatherMat.metallic = 0.02;
  saddleLeatherMat.roughness = 0.92;
  const recorderLampMaterials = [
    { name: "recorder-lamp-green", color: "#71bc79" },
    { name: "recorder-lamp-amber", color: "#dda45a" },
    { name: "recorder-lamp-red", color: "#bd6652" },
  ].map(({ name, color }) => {
    const material = new BABYLONNS.PBRMaterial(name, scene);
    material.albedoColor = BABYLONNS.Color3.FromHexString(color);
    material.emissiveColor = BABYLONNS.Color3.FromHexString(color).scale(0.42);
    material.metallic = 0.08;
    material.roughness = 0.38;
    return material;
  });
  const gaugeTexture = new BABYLONNS.DynamicTexture("aged-analogue-gauge-face", { width: 512, height: 512 }, scene, false);
  const gaugeContext = gaugeTexture.getContext() as unknown as CanvasRenderingContext2D;
  gaugeContext.fillStyle = "#d8cba9";
  gaugeContext.fillRect(0, 0, 512, 512);
  gaugeContext.strokeStyle = "#493c2d";
  gaugeContext.lineWidth = 8;
  gaugeContext.beginPath(); gaugeContext.arc(256, 256, 226, 0, Math.PI * 2); gaugeContext.stroke();
  gaugeContext.lineWidth = 5;
  for (let i = 0; i <= 20; i++) {
    const angle = Math.PI * 0.76 + (Math.PI * 1.48 * i) / 20;
    const major = i % 5 === 0;
    const innerRadius = major ? 167 : 183;
    gaugeContext.beginPath();
    gaugeContext.moveTo(256 + Math.cos(angle) * innerRadius, 256 + Math.sin(angle) * innerRadius);
    gaugeContext.lineTo(256 + Math.cos(angle) * 206, 256 + Math.sin(angle) * 206);
    gaugeContext.stroke();
    if (major) {
      gaugeContext.font = "bold 26px Georgia";
      gaugeContext.textAlign = "center";
      gaugeContext.textBaseline = "middle";
      gaugeContext.fillText(String(i * 5), 256 + Math.cos(angle) * 137, 256 + Math.sin(angle) * 137);
    }
  }
  gaugeContext.font = "bold 30px Georgia";
  gaugeContext.textAlign = "center";
  gaugeContext.fillText("PRESSURE", 256, 322);
  gaugeContext.font = "20px Georgia";
  gaugeContext.fillText("FIELD INSTRUMENT · 1926", 256, 370);
  gaugeTexture.update(false);
  const gaugeFaceMat = new BABYLONNS.PBRMaterial("ivory-printed-instrument-dial", scene);
  gaugeFaceMat.albedoTexture = gaugeTexture;
  gaugeFaceMat.roughness = 0.94;
  gaugeFaceMat.metallic = 0;

  const chartTexture = new BABYLONNS.DynamicTexture("pressure-recorder-ruled-chart", { width: 1024, height: 512 }, scene, false);
  const chartContext = chartTexture.getContext() as unknown as CanvasRenderingContext2D;
  chartContext.fillStyle = "#e4d5b8"; chartContext.fillRect(0, 0, 1024, 512);
  chartContext.strokeStyle = "#b69d7b"; chartContext.lineWidth = 1;
  for (let x = 0; x < 1024; x += 24) { chartContext.beginPath(); chartContext.moveTo(x, 0); chartContext.lineTo(x, 512); chartContext.stroke(); }
  for (let y = 0; y < 512; y += 24) { chartContext.beginPath(); chartContext.moveTo(0, y); chartContext.lineTo(1024, y); chartContext.stroke(); }
  chartContext.strokeStyle = "#3e5660"; chartContext.lineWidth = 3; chartContext.beginPath();
  for (let x = 0; x < 1024; x += 3) {
    const y = 275 - Math.sin(x * 0.018) * 14 - Math.sin(x * 0.19) * 4 - (x > 340 && x < 680 ? Math.sin((x - 340) * Math.PI / 340) * 130 : 0);
    if (x === 0) chartContext.moveTo(x, y); else chartContext.lineTo(x, y);
  }
  chartContext.stroke(); chartTexture.update(false);
  const chartMat = new BABYLONNS.PBRMaterial("cream-pressure-trace-paper", scene);
  chartMat.albedoTexture = chartTexture; chartMat.roughness = 1;

  const gaugeNeedles: BABYLON.Mesh[] = [];
  const addGauge = (name: string, position: BABYLON.Vector3, radius: number, parent: BABYLON.TransformNode): void => {
    const body = BABYLONNS.MeshBuilder.CreateCylinder(`${name}-cast-case`, { height: radius * 0.38, diameter: radius * 2.16, tessellation: 32 }, scene);
    body.position = position.clone();
    body.rotation.x = Math.PI / 2;
    body.material = darkMetalMat;
    body.parent = parent;
    const bezel = BABYLONNS.MeshBuilder.CreateTorus(`${name}-brass-bezel`, { diameter: radius * 2.04, thickness: radius * 0.12, tessellation: 40 }, scene);
    bezel.position = new BABYLONNS.Vector3(position.x, position.y, position.z + radius * 0.2);
    bezel.rotation.x = Math.PI / 2;
    bezel.material = brassMat;
    bezel.parent = parent;
    const face = BABYLONNS.MeshBuilder.CreateDisc(`${name}-printed-face`, { radius: radius * 0.92, tessellation: 48 }, scene);
    face.position = new BABYLONNS.Vector3(position.x, position.y, position.z + radius * 0.21);
    face.rotation.y = Math.PI;
    face.material = gaugeFaceMat;
    face.parent = parent;
    const needle = BABYLONNS.MeshBuilder.CreateBox(`${name}-needle`, { width: radius * 0.045, height: radius * 0.92, depth: radius * 0.025 }, scene);
    needle.position = new BABYLONNS.Vector3(position.x + radius * 0.07, position.y + radius * 0.12, position.z + radius * 0.235);
    needle.rotation.z = -0.43;
    needle.material = markerMat;
    needle.parent = parent;
    gaugeNeedles.push(needle);
    const pivot = BABYLONNS.MeshBuilder.CreateSphere(`${name}-needle-pivot`, { diameter: radius * 0.16, segments: 12 }, scene);
    pivot.position = new BABYLONNS.Vector3(position.x, position.y, position.z + radius * 0.25);
    pivot.material = brassMat;
    pivot.parent = parent;
  };

  const addFrontBolt = (name: string, x: number, y: number, z: number, parent: BABYLON.TransformNode, diameter = 0.085): void => {
    const bolt = BABYLONNS.MeshBuilder.CreateCylinder(name, { height: 0.035, diameter, tessellation: 6 }, scene);
    bolt.position = new BABYLONNS.Vector3(x, y, z);
    bolt.rotation.x = Math.PI / 2;
    bolt.material = brassMat;
    bolt.parent = parent;
  };

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
  const shuttleModelRoot = new BABYLONNS.TransformNode("nasa-shuttle-model", scene);
  shuttleModelRoot.parent = rocketRoot;
  // Show only the imported NASA-marked vehicle; remain empty if its asset fails.
  shuttleModelRoot.setEnabled(false);
  const rocketStart = rocketRoot.position.clone();
  const rocketExhaustEmitter = BABYLONNS.MeshBuilder.CreateBox("rocket-exhaust-emitter", { size: 0.01 }, scene);
  rocketExhaustEmitter.parent = rocketRoot;
  rocketExhaustEmitter.position.y = 0.15;
  rocketExhaustEmitter.visibility = 0;
  rocketExhaustEmitter.isPickable = false;
  // Shared soft sprite avoids the hard square edges of the previous one-pixel image.
  const smokeTexture = new BABYLONNS.DynamicTexture("soft-atmospheric-particle", { width: 128, height: 128 }, scene, true);
  const smokeContext = smokeTexture.getContext() as unknown as CanvasRenderingContext2D;
  const smokeGradient = smokeContext.createRadialGradient(64, 64, 3, 64, 64, 63);
  smokeGradient.addColorStop(0, "rgba(255,255,255,0.9)");
  smokeGradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  smokeGradient.addColorStop(1, "rgba(255,255,255,0)");
  smokeContext.fillStyle = smokeGradient; smokeContext.fillRect(0, 0, 128, 128); smokeTexture.update();
  const launchSmoke = new BABYLONNS.ParticleSystem("1926-launch-smoke", 220, scene);
  launchSmoke.particleTexture = smokeTexture;
  launchSmoke.emitter = rocketExhaustEmitter;
  launchSmoke.minEmitBox = new BABYLONNS.Vector3(-0.22, -0.12, -0.22);
  launchSmoke.maxEmitBox = new BABYLONNS.Vector3(0.22, 0.08, 0.22);
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
  launchFlame.emitter = rocketExhaustEmitter;
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

  // Emissive tapered plumes stay attached to the nozzle between particle bursts.
  const outerFlameMat = new BABYLONNS.StandardMaterial("rocket-flame-outer-material", scene);
  outerFlameMat.emissiveColor = new BABYLONNS.Color3(1, 0.22, 0.025);
  outerFlameMat.disableLighting = true;
  outerFlameMat.backFaceCulling = false;
  outerFlameMat.alpha = 0.78;
  const innerFlameMat = new BABYLONNS.StandardMaterial("rocket-flame-inner-material", scene);
  innerFlameMat.emissiveColor = new BABYLONNS.Color3(1, 0.78, 0.22);
  innerFlameMat.disableLighting = true;
  innerFlameMat.backFaceCulling = false;
  const outerFlame = BABYLONNS.MeshBuilder.CreateCylinder("rocket-engine-outer-flame", {
    height: 2.5, diameterTop: 0, diameterBottom: 0.62, tessellation: 16,
  }, scene);
  outerFlame.parent = rocketExhaustEmitter;
  outerFlame.position.y = -1.3;
  outerFlame.rotation.z = Math.PI;
  outerFlame.material = outerFlameMat;
  outerFlame.isPickable = false;
  const innerFlame = BABYLONNS.MeshBuilder.CreateCylinder("rocket-engine-inner-flame", {
    height: 1.55, diameterTop: 0, diameterBottom: 0.34, tessellation: 16,
  }, scene);
  innerFlame.parent = rocketExhaustEmitter;
  innerFlame.position.y = -0.88;
  innerFlame.rotation.z = Math.PI;
  innerFlame.material = innerFlameMat;
  innerFlame.isPickable = false;
  outerFlame.setEnabled(false);
  innerFlame.setEnabled(false);

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
  let launchStartedAt = 0;
  let launchExitNotified = false;
  let launchExitCallback: (() => void) | null = null;
  let launchPeakAltitude = 12.5;
  let openingElapsed = -1;
  let openingDone: (() => void) | null = null;
  let activeCameraMode: "cinematic" | "observation" | "telemetry" = "cinematic";

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

  // Real rope barriers keep the crew clear of the launch range; no decorative flags.
  const barrierPosts = new BABYLONNS.TransformNode("launch-barrier-posts", scene);
  barrierPosts.parent = root;
  const barrierPositions: BABYLON.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const bx = Math.cos(angle) * 5.8;
    const bz = ROCKET_PLATFORM_Z + Math.sin(angle) * 5.8;
    barrierPositions.push(new BABYLONNS.Vector3(bx, 0, bz));
    const post = BABYLONNS.MeshBuilder.CreateCylinder(`barrier-post-${i}`, { height: 1.05, diameter: 0.075 }, scene);
    post.position = new BABYLONNS.Vector3(bx, terrain.getHeightAt(bx, bz) + 0.52, bz);
    post.material = propMat;
    post.parent = barrierPosts;
    const footing = BABYLONNS.MeshBuilder.CreateCylinder(`barrier-post-foot-${i}`, { height: 0.08, diameter: 0.28, tessellation: 8 }, scene);
    footing.position = new BABYLONNS.Vector3(bx, terrain.getHeightAt(bx, bz) + 0.04, bz);
    footing.material = markerMat;
    footing.parent = barrierPosts;
  }
  for (let i = 0; i < barrierPositions.length; i++) {
    const start = barrierPositions[i]!;
    const end = barrierPositions[(i + 1) % barrierPositions.length]!;
    for (const height of [0.43, 0.72]) {
      createBeam(
        `launch-safety-rope-${i}-${height}`,
        new BABYLONNS.Vector3(start.x, terrain.getHeightAt(start.x, start.z) + height, start.z),
        new BABYLONNS.Vector3(end.x, terrain.getHeightAt(end.x, end.z) + height, end.z),
        0.026,
        markerMat,
        barrierPosts,
      );
    }
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

  // An octagonal concrete apron and an open steel cradle support the shuttle
  // from the ground while leaving its NASA markings and silhouette visible.
  const groundPadRoot = new BABYLONNS.TransformNode("1926-ground-launch-pad", scene);
  groundPadRoot.position = new BABYLONNS.Vector3(0, terrain.getHeightAt(0, ROCKET_PLATFORM_Z), ROCKET_PLATFORM_Z);
  groundPadRoot.parent = root;
  const launchPadMat = createWeatheredMaterial(
    BABYLONNS,
    scene,
    "weathered-launch-pad-concrete",
    "#77756a",
    "plaster",
  );
  const launchContactMat = createWeatheredMaterial(
    BABYLONNS,
    scene,
    "oxidized-launch-contact-plate",
    "#35403d",
    "metal",
  );
  const launchMarkingMat = new BABYLONNS.PBRMaterial("aged-ivory-pad-markings", scene);
  launchMarkingMat.albedoColor = BABYLONNS.Color3.FromHexString("#d3c6a5");
  launchMarkingMat.roughness = 0.9;
  const darkMetalMat = createWeatheredMaterial(BABYLONNS, scene, "gameplay-oxidized-metal", "#3d4543", "metal");
  const padSlab = BABYLONNS.MeshBuilder.CreateCylinder("octagonal-concrete-launch-apron", {
    diameter: 5.1, height: 0.12, tessellation: 8,
  }, scene);
  padSlab.position.y = 0.06;
  padSlab.material = launchPadMat;
  padSlab.parent = groundPadRoot;
  const padRim = BABYLONNS.MeshBuilder.CreateTorus("oxide-pad-perimeter", {
    diameter: 4.92, thickness: 0.055, tessellation: 8,
  }, scene);
  padRim.position.y = 0.126;
  padRim.material = markerMat;
  padRim.parent = groundPadRoot;
  const contactPlate = BABYLONNS.MeshBuilder.CreateCylinder("rocket-contact-plate", {
    diameter: 1.72, height: 0.025, tessellation: 32,
  }, scene);
  contactPlate.position.y = 0.1325;
  contactPlate.material = launchContactMat;
  contactPlate.parent = groundPadRoot;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const marking = BABYLONNS.MeshBuilder.CreateBox(`launch-pad-safety-mark-${i}`, {
      width: 0.11, height: 0.012, depth: 0.38,
    }, scene);
    marking.position = new BABYLONNS.Vector3(Math.sin(angle) * 2.12, 0.126, Math.cos(angle) * 2.12);
    marking.rotation.y = angle;
    marking.material = i % 2 === 0 ? markerMat : launchMarkingMat;
    marking.parent = groundPadRoot;
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const anchor = BABYLONNS.MeshBuilder.CreateSphere(`launch-pad-rim-anchor-${i}`, {
      diameter: 0.075, segments: 8,
    }, scene);
    anchor.position = new BABYLONNS.Vector3(Math.sin(angle) * 2.31, 0.142, Math.cos(angle) * 2.31);
    anchor.material = launchContactMat;
    anchor.parent = groundPadRoot;
  }

  let vehicleMeshes: BABYLON.AbstractMesh[] = [];
  const launchSupport = createLaunchSupport(BABYLONNS, scene, root, groundPadRoot.position, {
    steel: propMat, dark: darkMetalMat, paint: markerMat, pad: saddleLeatherMat, hardware: brassMat, foundation: launchPadMat,
  }, shadowGenerator);
  const instruments = createEngineeringInstruments(BABYLONNS, scene, root, terrain.getHeightAt(-6, 10.6));
  const fieldKit = createFieldStations(BABYLONNS, scene, root, terrain.getHeightAt);
  fieldKit.setWeather(weather.label);
  const collisionObstacles = [launchSupport.footprint, { minX: -6.55, maxX: -5.45, minZ: 10.05, maxZ: 11.15 }, ...fieldKit.colliders];

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

  /** Grid-based outdoor routing respects the low launch pad and work-station footprints. */
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

  const workshopAssets = createWorkshopAssets(BABYLONNS, scene, shadowGenerator);
  const woodMat = createWeatheredMaterial(BABYLONNS, scene, "gameplay-weathered-wood", "#75583f", "wood");
  const paperMat = new BABYLONNS.PBRMaterial("gameplay-aged-paper", scene);
  paperMat.albedoColor = BABYLONNS.Color3.FromHexString("#cbbb96");
  paperMat.roughness = 0.98;
  const fieldPlanTexture = new BABYLONNS.DynamicTexture("hand-inked-field-schematic", { width: 512, height: 512 }, scene, false);
  const planContext = fieldPlanTexture.getContext() as unknown as CanvasRenderingContext2D;
  planContext.fillStyle = "#d5c7a4"; planContext.fillRect(0, 0, 512, 512);
  planContext.strokeStyle = "#6a5942"; planContext.lineWidth = 2;
  planContext.strokeRect(18, 18, 476, 476);
  planContext.font = "bold 24px Georgia"; planContext.fillStyle = "#493d31";
  planContext.fillText("AUBURN TEST RANGE · FLIGHT SHEET", 34, 54);
  planContext.font = "17px Georgia"; planContext.fillText("LIQUID PROPULSION / MARCH 1926", 34, 80);
  planContext.beginPath(); planContext.moveTo(34, 94); planContext.lineTo(478, 94); planContext.stroke();
  planContext.strokeStyle = "#4b5c60"; planContext.lineWidth = 3;
  // Hand-drawn vehicle elevation and dimension callouts.
  planContext.beginPath();
  planContext.moveTo(137, 410); planContext.lineTo(137, 198); planContext.lineTo(148, 163);
  planContext.lineTo(159, 198); planContext.lineTo(159, 410); planContext.closePath(); planContext.stroke();
  planContext.moveTo(137, 338); planContext.lineTo(116, 360); planContext.lineTo(137, 354);
  planContext.moveTo(159, 338); planContext.lineTo(180, 360); planContext.lineTo(159, 354); planContext.stroke();
  planContext.beginPath(); planContext.moveTo(106, 410); planContext.lineTo(190, 410); planContext.moveTo(111, 416); planContext.lineTo(185, 416); planContext.stroke();
  planContext.strokeStyle = "#9a563d"; planContext.lineWidth = 2;
  planContext.beginPath(); planContext.moveTo(203, 165); planContext.lineTo(203, 410); planContext.moveTo(196, 174); planContext.lineTo(203, 165); planContext.lineTo(210, 174); planContext.moveTo(196, 401); planContext.lineTo(203, 410); planContext.lineTo(210, 401); planContext.stroke();
  planContext.font = "18px Georgia"; planContext.fillStyle = "#493d31"; planContext.fillText("8.4 M", 213, 290);
  // Simple cross-section, bench notes, ruled log and a stamped revision box.
  planContext.strokeStyle = "#4b5c60"; planContext.lineWidth = 2;
  planContext.beginPath(); planContext.arc(337, 221, 55, 0, Math.PI * 2); planContext.moveTo(337, 160); planContext.lineTo(337, 282); planContext.moveTo(276, 221); planContext.lineTo(398, 221); planContext.stroke();
  for (let row = 0; row < 5; row++) { planContext.beginPath(); planContext.moveTo(245, 321 + row * 23); planContext.lineTo(463 - (row % 2) * 28, 321 + row * 23); planContext.stroke(); }
  planContext.strokeStyle = "#9a563d"; planContext.strokeRect(326, 414, 140, 55);
  planContext.font = "bold 18px Georgia"; planContext.fillText("REV. 02 · FIELD", 338, 448);
  fieldPlanTexture.update(false);
  paperMat.albedoTexture = fieldPlanTexture;
  // Load the mission's NASA-marked model as the only vehicle shown in the scene.
  void (async () => {
    try {
      await import("@babylonjs/loaders/glTF");
      const result = await BABYLONNS.SceneLoader.ImportMeshAsync(
        null,
        "/assets/models/",
        "space_shuttle_nasa_optimized.glb",
        scene,
      );
      if (disposed) { result.animationGroups.forEach(group => group.dispose()); result.skeletons.forEach(skeleton => skeleton.dispose()); result.meshes.forEach(mesh => mesh.dispose(false, true)); return; }
      const importedRoot = result.meshes.find((mesh) => mesh.name === "__root__") ?? result.meshes[0];
      if (importedRoot) importedRoot.parent = shuttleModelRoot;
      // The GLB is modeled lengthwise along Z. Rotate it upright, then scale
      // its measured height to a large, clearly visible experimental rocket.
      shuttleModelRoot.rotation.x = Math.PI / 2;
      shuttleModelRoot.scaling.setAll(1);
      shuttleModelRoot.position.y = 0;
      shuttleModelRoot.computeWorldMatrix(true);
      result.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
      const modelMeshes = result.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
      const worldBounds = () => {
        shuttleModelRoot.computeWorldMatrix(true);
        modelMeshes.forEach((mesh) => mesh.computeWorldMatrix(true));
        // Rotated per-mesh boxes overestimate the outline and can leave the
        // real landing surface above the pad. Measure transformed vertices.
        const measured = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
        const local = new BABYLONNS.Vector3();
        const world = new BABYLONNS.Vector3();
        for (const mesh of modelMeshes) {
          const positions = mesh.getVerticesData(BABYLONNS.VertexBuffer.PositionKind);
          if (!positions) continue;
          const matrix = mesh.getWorldMatrix();
          for (let i = 0; i < positions.length; i += 3) {
            local.set(positions[i]!, positions[i + 1]!, positions[i + 2]!);
            BABYLONNS.Vector3.TransformCoordinatesToRef(local, matrix, world);
            measured.minX = Math.min(measured.minX, world.x); measured.maxX = Math.max(measured.maxX, world.x);
            measured.minY = Math.min(measured.minY, world.y); measured.maxY = Math.max(measured.maxY, world.y);
            measured.minZ = Math.min(measured.minZ, world.z); measured.maxZ = Math.max(measured.maxZ, world.z);
          }
        }
        return measured;
      };
      const initialBounds = worldBounds();
      if (modelMeshes.length && initialBounds.maxY > initialBounds.minY) {
        const rocketHeight = 8.4;
        shuttleModelRoot.scaling.setAll(rocketHeight / (initialBounds.maxY - initialBounds.minY));
        const scaledBounds = worldBounds();
        // Center the lower body over the ground pad; fins and upper hardware
        // can be asymmetric, so the full model bounds are not a good X axis.
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
        shuttleModelRoot.position.x += groundPadRoot.position.x - baseAxisX;
        // Set the model's lowest point directly onto the thin central contact
        // plate so the rocket reads as grounded rather than suspended.
        const padSurfaceY = groundPadRoot.position.y + contactPlate.position.y + 0.025 / 2;
        shuttleModelRoot.position.y += padSurfaceY - scaledBounds.minY;
        shuttleModelRoot.position.z += ROCKET_PLATFORM_Z - (scaledBounds.minZ + scaledBounds.maxZ) / 2;
      }
      shuttleModelRoot.setEnabled(true);
      vehicleMeshes = modelMeshes;
      vehicleMeshes.forEach(mesh => { mesh.checkCollisions = true; mesh.receiveShadows = true; });
      launchSupport.fitToVehicle(vehicleMeshes);
    } catch (error) {
      console.warn("Could not load the NASA-marked mission rocket model; no substitute vehicle will be shown.", error);
    }
  })();

  // A framed service shed: roof rests on rafters, siding meets the sill and
  // the open front leaves room to walk up to real storage furniture.
  const shed = new BABYLONNS.TransformNode("field-service-shed", scene);
  shed.position.set(14.2, terrain.getHeightAt(14.2, -2.8), -2.8);
  shed.parent = root;
  const shedBox = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: BABYLON.Material = woodMat) => {
    const mesh = BABYLONNS.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.parent = shed; mesh.position.set(x, y, z); mesh.material = material;
    mesh.receiveShadows = true; mesh.checkCollisions = true;
    shadowGenerator.addShadowCaster(mesh);
    return mesh;
  };
  const roofMat = createWeatheredMaterial(BABYLONNS, scene, "shed-weathered-zinc-roof", "#52615d", "metal");
  for (let board = 0; board < 15; board++) shedBox(`shed-floor-board-${board}`, 0.227, 0.07, 2.28, -1.64 + board * 0.235, 0.185, 0);
  for (const x of [-1.7, 1.7]) for (const z of [-1.05, 1.05]) {
    shedBox(`shed-concrete-pier-${x}-${z}`, 0.3, 0.22, 0.3, x, 0.11, z, launchPadMat);
    shedBox(`shed-timber-post-${x}-${z}`, 0.16, 2.22, 0.16, x, 1.29, z);
    shedBox(`shed-steel-post-socket-${x}-${z}`, 0.19, 0.2, 0.19, x, 0.28, z, darkMetalMat);
    collisionObstacles.push({ minX: 14.2 + x - 0.12, maxX: 14.2 + x + 0.12, minZ: -2.8 + z - 0.12, maxZ: -2.8 + z + 0.12 });
    createBeam(`shed-knee-brace-${x}-${z}`, new BABYLONNS.Vector3(x, 1.83, z), new BABYLONNS.Vector3(x - Math.sign(x) * 0.47, 2.31, z), 0.09, woodMat, shed);
  }
  for (const z of [-1.05, 1.05]) shedBox(`shed-eave-beam-${z}`, 3.7, 0.18, 0.16, 0, 2.34, z);
  for (const x of [-1.7, 0, 1.7]) {
    for (const side of [-1, 1]) createBeam(`shed-rafter-${x}-${side}`, new BABYLONNS.Vector3(x, 2.35, side * 1.36), new BABYLONNS.Vector3(x, 2.84, 0), 0.09, woodMat, shed);
    shedBox(`shed-tie-beam-${x}`, 0.12, 0.13, 2.27, x, 2.31, 0);
  }
  for (let i = 0; i < 15; i++) {
    const x = -1.58 + i * 0.226;
    shedBox(`shed-back-siding-${i}`, 0.216, 1.92, 0.045, x, 1.23, -1.1);
    for (const y of [0.43, 2.02]) addFrontBolt(`shed-siding-nail-${i}-${y}`, x, y, -1.13, shed, 0.022);
  }
  shedBox("shed-rear-sill", 3.55, 0.13, 0.12, 0, 0.27, -1.05);
  collisionObstacles.push({ minX: 12.45, maxX: 15.95, minZ: -3.95, maxZ: -3.82 });
  for (const side of [-1, 1]) {
    const roof = shedBox(`shed-zinc-roof-panel-${side}`, 3.95, 0.045, 1.57, 0, 2.58, side * 0.7, roofMat);
    roof.position.y = 2.65;
    roof.rotation.x = side * 0.345;
    for (let rib = 0; rib < 32; rib++) {
      const raised = shedBox(`shed-roof-standing-seam-${side}-${rib}`, 0.022, 0.034, 1.57, -1.9 + rib * 0.123, 2.682, side * 0.7, roofMat);
      raised.rotation.x = side * 0.345;
    }
  }
  shedBox("shed-ridge-cap", 4.02, 0.07, 0.19, 0, 2.94, 0, roofMat);
  // The corrugated roof is static and shares one material: preserve every seam
  // while drawing the two panels, 64 ribs and ridge as one authored surface.
  const roofParts = shed.getChildMeshes().filter((mesh): mesh is BABYLON.Mesh => mesh instanceof BABYLONNS.Mesh && mesh.material === roofMat);
  for (const mesh of roofParts) shadowGenerator.removeShadowCaster(mesh, false);
  const mergedRoof = BABYLONNS.Mesh.MergeMeshes(roofParts, true, true, undefined, false, false);
  if (mergedRoof) {
    mergedRoof.name = "shed-zinc-corrugated-roof-batch";
    mergedRoof.parent = root;
    mergedRoof.receiveShadows = true;
    mergedRoof.isPickable = false;
    mergedRoof.freezeWorldMatrix();
    shadowGenerator.addShadowCaster(mergedRoof, false);
  }
  void workshopAssets.place("worn_metal_rack", shed, new BABYLONNS.Vector3(-0.69, 0.22, -0.64), { width: 1.5, height: 1.7, depth: 0.48 });
  void workshopAssets.place("metal_toolbox", shed, new BABYLONNS.Vector3(0.93, 0.22, 0.18), { width: 0.86 }, -0.14);
  collisionObstacles.push({ minX: 12.73, maxX: 14.26, minZ: -3.71, maxZ: -3.19 });
  collisionObstacles.push({ minX: 14.65, maxX: 15.63, minZ: -2.92, maxZ: -2.35 });
  void workshopAssets.place("metal_toolbox", shed, new BABYLONNS.Vector3(-0.78, 0.88, -0.65), { width: 0.62 }, 0.09);
  void workshopAssets.place("adjustable_wrench", shed, new BABYLONNS.Vector3(-0.39, 1.42, -0.66), { width: 0.36, rotationZ: Math.PI / 2 }, 0.3);

  // Every work area is an outdoor station: plans, engine parts, recorders,
  // or the flight log make its mission role visible before the player reads it.
  type StationKind = "drafting" | "propulsion" | "recorder" | "observation" | "analysis";
  const fieldStations: Array<{ name: string; x: number; z: number; width: number; kind: StationKind }> = [
    { name: "project-planning-table", x: -8, z: -1, width: 2.8, kind: "drafting" },
    { name: "propulsion-engineering-bench", x: 18.5, z: 8, width: 2.8, kind: "propulsion" },
    { name: "pressure-recorder-table", x: -6, z: 9, width: 2.4, kind: "recorder" },
    { name: "flight-observation-table", x: 8.2, z: -23.1, width: 2.5, kind: "observation" },
    { name: "flight-analysis-table", x: 11.2, z: -25.4, width: 2.1, kind: "analysis" },
  ];
  for (const station of fieldStations) {
    collisionObstacles.push({
      minX: station.x - station.width / 2 - 0.12,
      maxX: station.x + station.width / 2 + 0.12,
      minZ: station.z - 0.55,
      maxZ: station.z + 0.55,
    });
    const y = terrain.getHeightAt(station.x, station.z);
    const tableDepth = station.kind === "propulsion" ? 1.1 : 0.9;
    const tableModel: WorkshopAsset = station.kind === "propulsion" ? "WoodenTable_03"
      : station.kind === "analysis" ? "metal_office_desk" : "painted_wooden_table";
    const tableLoad = workshopAssets.place(tableModel, root, new BABYLONNS.Vector3(station.x, y, station.z), {
      width: station.width, height: 0.99, depth: tableDepth,
    });
    void workshopAssets.place("wooden_stool_01", root, new BABYLONNS.Vector3(station.x - station.width / 2 - 0.48, y, station.z + 0.38), { height: 0.59 }, 0.21);
    const stoolX = station.x - station.width / 2 - 0.48;
    collisionObstacles.push({ minX: stoolX - 0.23, maxX: stoolX + 0.23, minZ: station.z + 0.15, maxZ: station.z + 0.61 });
    if (station.kind === "propulsion" || station.kind === "drafting") {
      void workshopAssets.place("metal_toolbox", root, new BABYLONNS.Vector3(station.x + 0.34, y + 1.0, station.z - 0.26), { width: 0.58 }, 0.06);
      void workshopAssets.place("adjustable_wrench", root, new BABYLONNS.Vector3(station.x - 0.2, y + 1.005, station.z + 0.2), { width: 0.43, rotationZ: Math.PI / 2 }, -0.42);
    }
    if (station.kind === "analysis" || station.kind === "drafting" || station.kind === "recorder") {
      void workshopAssets.place("vintage_oil_lamp", root, new BABYLONNS.Vector3(station.x + station.width / 2 - 0.19, y + 1, station.z - 0.21), { height: 0.4 }).then(async lampModel => {
        const table = await tableLoad;
        if (!lampModel || !table || root.isDisposed()) return;
        const light = new BABYLONNS.PointLight(`${station.name}-oil-lamp-light`, new BABYLONNS.Vector3(station.x + station.width / 2 - 0.19, y + 1.3, station.z - 0.21), scene);
        light.parent = root; light.diffuse = BABYLONNS.Color3.FromHexString("#ffd6a0");
        light.intensity = 0.7; light.range = 3; light.radius = 0.25;
        light.includedOnlyMeshes = [...table.getChildMeshes(), ...lampModel.getChildMeshes(), ...root.getChildMeshes().filter(mesh => mesh.name.startsWith(station.name))];
      });
    }
    const addBox = (name: string, width: number, height: number, depth: number, x: number, topY: number, z: number, material: BABYLON.Material) => {
      const mesh = BABYLONNS.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
      mesh.position = new BABYLONNS.Vector3(x, topY, z);
      mesh.material = material;
      mesh.parent = root;
      return mesh;
    };
    if (station.kind === "drafting" || station.kind === "observation" || station.kind === "analysis") {
      const page = addBox(`${station.name}-document`, 0.58, 0.025, 0.42, station.x - 0.48, y + 1.01, station.z - 0.08, paperMat);
      page.rotation.y = 0.12;
      // A slim drafting rule and charcoal pencil ground the paper in the scene.
      addBox(`${station.name}-ruler`, 0.52, 0.035, 0.055, station.x - 0.42, y + 1.04, station.z + 0.19, markerMat);
      const pencil = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-pencil`, { height: 0.42, diameter: 0.025, tessellation: 8 }, scene);
      pencil.position = new BABYLONNS.Vector3(station.x - 0.5, y + 1.06, station.z - 0.05);
      pencil.rotation.z = Math.PI / 2;
      pencil.material = darkMetalMat;
      pencil.parent = root;
    }
    if (station.kind === "propulsion") {
      // Bench vise, injector mock-up, short pressure line, and an analogue gauge.
      // Cast vise, guide screw, machined chamber and flanged fittings.
      const viseX = station.x - 0.9;
      addBox(`${station.name}-vise-mount`, 0.46, 0.065, 0.34, viseX, y + 1.025, station.z + 0.22, darkMetalMat);
      const viseBody = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-vise-swivel-base`, { diameter: 0.29, height: 0.1, tessellation: 32 }, scene);
      viseBody.position.set(viseX, y + 1.1, station.z + 0.22); viseBody.material = propMat; viseBody.parent = root;
      for (const side of [-1, 1]) {
        addBox(`${station.name}-cast-jaw-${side}`, 0.1, 0.17, 0.28, viseX + side * 0.11, y + 1.23, station.z + 0.22, propMat);
        addBox(`${station.name}-hardened-jaw-${side}`, 0.028, 0.08, 0.29, viseX + side * 0.055, y + 1.28, station.z + 0.22, darkMetalMat);
      }
      createBeam(`${station.name}-vise-lead-screw`, new BABYLONNS.Vector3(viseX - 0.35, y + 1.16, station.z + 0.22), new BABYLONNS.Vector3(viseX + 0.2, y + 1.16, station.z + 0.22), 0.045, brassMat, root);
      createBeam(`${station.name}-vise-sliding-handle`, new BABYLONNS.Vector3(viseX - 0.35, y + 1.01, station.z + 0.22), new BABYLONNS.Vector3(viseX - 0.35, y + 1.32, station.z + 0.22), 0.023, darkMetalMat, root);
      const profile = [[0.08, 0], [0.11, 0.025], [0.11, 0.07], [0.07, 0.11], [0.065, 0.22], [0.095, 0.3], [0.13, 0.34], [0.13, 0.39], [0.05, 0.39]].map(([r, h]) => new BABYLONNS.Vector3(r, h, 0));
      const chamber = BABYLONNS.MeshBuilder.CreateLathe(`${station.name}-machined-test-chamber`, { shape: profile, tessellation: 48, sideOrientation: BABYLONNS.Mesh.DOUBLESIDE, cap: BABYLONNS.Mesh.CAP_ALL }, scene);
      chamber.rotation.z = Math.PI / 2; chamber.position.set(station.x + 0.16, y + 1.19, station.z + 0.02); chamber.material = propMat; chamber.parent = root;
      for (const dx of [-0.17, 0.13]) addBox(`${station.name}-chamber-saddle-${dx}`, 0.07, 0.1, 0.22, station.x + dx, y + 1.045, station.z + 0.02, darkMetalMat);
      const hosePath = BABYLONNS.Curve3.CreateCatmullRomSpline([
        new BABYLONNS.Vector3(station.x + 0.18, y + 1.17, station.z + 0.02),
        new BABYLONNS.Vector3(station.x + 0.4, y + 1.06, station.z + 0.25),
        new BABYLONNS.Vector3(station.x + 0.76, y + 1.05, station.z + 0.25),
        new BABYLONNS.Vector3(station.x + 0.88, y + 1.25, station.z + 0.08),
      ], 24).getPoints();
      const hose = BABYLONNS.MeshBuilder.CreateTube(`${station.name}-flexible-pressure-hose`, { path: hosePath, radius: 0.018, tessellation: 10 }, scene);
      hose.material = saddleLeatherMat; hose.parent = root;
      createBeam(`${station.name}-gauge-neck`, new BABYLONNS.Vector3(station.x + 0.88, y + 1.0, station.z + 0.08), new BABYLONNS.Vector3(station.x + 0.88, y + 1.27, station.z + 0.08), 0.055, brassMat, root);
      addGauge(`${station.name}-pressure-gauge`, new BABYLONNS.Vector3(station.x + 0.88, y + 1.42, station.z + 0.08), 0.19, root);
    }
    if (station.kind === "recorder") {
      // A paper-drum recorder, stylus arm, and paired test-pressure dials.
      addBox(`${station.name}-recorder-chassis`, 0.64, 0.06, 0.4, station.x - 0.48, y + 1.04, station.z - 0.06, darkMetalMat);
      for (const side of [-1, 1]) addBox(`${station.name}-drum-bearing-${side}`, 0.055, 0.15, 0.16, station.x - 0.48 + side * 0.25, y + 1.14, station.z - 0.06, brassMat);
      const drum = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-chart-drum`, { height: 0.43, diameter: 0.3, tessellation: 20 }, scene);
      drum.position = new BABYLONNS.Vector3(station.x - 0.48, y + 1.2, station.z - 0.06);
      drum.rotation.z = Math.PI / 2;
      drum.material = chartMat;
      drum.parent = root;
      const axle = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-drum-axle`, { height: 0.55, diameter: 0.055, tessellation: 12 }, scene);
      axle.position.copyFrom(drum.position);
      axle.rotation.z = Math.PI / 2;
      axle.material = darkMetalMat;
      axle.parent = root;
      for (const side of [-1, 1]) {
        const collar = BABYLONNS.MeshBuilder.CreateTorus(`${station.name}-drum-end-collar-${side}`, { diameter: 0.31, thickness: 0.045, tessellation: 24 }, scene);
        collar.position = new BABYLONNS.Vector3(station.x - 0.48 + side * 0.21, y + 1.2, station.z - 0.06);
        collar.rotation.z = Math.PI / 2;
        collar.material = brassMat;
        collar.parent = root;
      }
      createBeam(`${station.name}-stylus`, new BABYLONNS.Vector3(station.x - 0.08, y + 1.34, station.z + 0.2), new BABYLONNS.Vector3(station.x - 0.33, y + 1.19, station.z + 0.03), 0.035, markerMat, root);
      for (let i = 0; i < 2; i++) {
        const dialX = station.x + 0.44 + i * 0.42;
        const foot = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-cast-dial-foot-${i}`, { diameter: 0.23, height: 0.045, tessellation: 32 }, scene);
        foot.position.set(dialX, y + 1.015, station.z - 0.06); foot.material = darkMetalMat; foot.parent = root;
        createBeam(`${station.name}-dial-stem-${i}`, new BABYLONNS.Vector3(dialX, y + 1.08, station.z - 0.06), new BABYLONNS.Vector3(dialX, y + 1.23, station.z - 0.06), 0.06, brassMat, root);
        addGauge(`${station.name}-dial-${i}`, new BABYLONNS.Vector3(dialX, y + 1.31, station.z - 0.06), 0.14, root);
      }
      // A tactile channel board makes the pressure, recorder and vibration
      // tasks legible in the 3D world before the player opens the console.
      const channelBoard = addBox(`${station.name}-signal-routing-board`, 0.72, 0.075, 0.34, station.x - 0.04, y + 1.045, station.z + 0.31, darkMetalMat);
      channelBoard.rotation.x = -0.13;
      for (let i = 0; i < 3; i++) {
        const portX = station.x - 0.27 + i * 0.23;
        const bezel = BABYLONNS.MeshBuilder.CreateTorus(`${station.name}-signal-port-bezel-${i}`, { diameter: 0.13, thickness: 0.018, tessellation: 20 }, scene);
        bezel.position.set(portX, y + 1.12, station.z + 0.32);
        bezel.rotation.x = Math.PI / 2;
        bezel.material = brassMat;
        bezel.parent = root;
        const lamp = BABYLONNS.MeshBuilder.CreateSphere(`${station.name}-channel-lamp-${i}`, { diameter: 0.071, segments: 12 }, scene);
        lamp.position.set(portX, y + 1.125, station.z + 0.32);
        lamp.material = recorderLampMaterials[i]!;
        lamp.parent = root;
      }
      for (let screw = 0; screw < 4; screw++) {
        const x = station.x - 0.35 + (screw % 2) * 0.62;
        const z = station.z + 0.19 + Math.floor(screw / 2) * 0.23;
        const fastener = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-board-fastener-${screw}`, { diameter: 0.035, height: 0.016, tessellation: 12 }, scene);
        fastener.position.set(x, y + 1.091, z);
        fastener.material = brassMat;
        fastener.parent = root;
      }
    }
    if (station.kind === "observation") {
      // Wooden plate camera and hood point back to the launch pad.
      const cameraBody = addBox(`${station.name}-plate-camera-body`, 0.42, 0.32, 0.28, station.x + 0.68, y + 1.16, station.z - 0.1, darkMetalMat);
      cameraBody.material = woodMat;
      const cameraFront = addBox(`${station.name}-camera-standard`, 0.28, 0.22, 0.09, station.x + 0.68, y + 1.16, station.z + 0.08, propMat);
      cameraFront.material = darkMetalMat;
      const lens = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-camera-lens`, { height: 0.23, diameterTop: 0.12, diameterBottom: 0.16, tessellation: 20 }, scene);
      lens.position = new BABYLONNS.Vector3(station.x + 0.68, y + 1.16, station.z + 0.23);
      lens.rotation.x = Math.PI / 2;
      lens.material = darkMetalMat;
      lens.parent = root;
      const glass = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-camera-lens-glass`, { height: 0.018, diameter: 0.1, tessellation: 20 }, scene);
      glass.position = new BABYLONNS.Vector3(station.x + 0.68, y + 1.16, station.z + 0.35);
      glass.rotation.x = Math.PI / 2;
      glass.material = launchContactMat;
      glass.parent = root;
      for (let fold = 0; fold < 9; fold++) {
        const ring = addBox(`${station.name}-camera-bellows-${fold}`, 0.32 - fold * 0.006, 0.24 - fold * 0.004, 0.018, station.x + 0.68, y + 1.16, station.z - 0.05 + fold * 0.018, saddleLeatherMat);
        ring.rotation.z = 0.015;
      }
      for (let leg = 0; leg < 3; leg++) {
        const angle = (leg * Math.PI * 2) / 3;
        createBeam(`${station.name}-tripod-leg-${leg}`, new BABYLONNS.Vector3(station.x + 0.68, y + 1.01, station.z - 0.1), new BABYLONNS.Vector3(station.x + 0.68 + Math.cos(angle) * 0.29, y + 0.05, station.z - 0.1 + Math.sin(angle) * 0.29), 0.035, woodMat, root);
      }
    }
    if (station.kind === "analysis") {
      // Sheltered flight-log desk with a specimen tray and ink bottle.
      const tray = addBox(`${station.name}-recovered-parts-tray`, 0.58, 0.06, 0.4, station.x + 0.52, y + 1.04, station.z + 0.12, darkMetalMat);
      tray.rotation.y = 0;
      for (const dz of [-0.19, 0.19]) addBox(`${station.name}-tray-long-rim-${dz}`, 0.58, 0.045, 0.018, station.x + 0.52, y + 1.085, station.z + 0.12 + dz, darkMetalMat);
      for (const dx of [-0.28, 0.28]) addBox(`${station.name}-tray-end-rim-${dx}`, 0.018, 0.045, 0.4, station.x + 0.52 + dx, y + 1.085, station.z + 0.12, darkMetalMat);
      for (let part = 0; part < 3; part++) {
        const recovered = BABYLONNS.MeshBuilder.CreateTorus(`${station.name}-recovered-seal-${part}`, { diameter: 0.095, thickness: 0.018, tessellation: 20 }, scene);
        recovered.position.set(station.x + 0.35 + part * 0.16, y + 1.084, station.z + 0.12); recovered.material = brassMat; recovered.parent = root;
      }
      const ink = BABYLONNS.MeshBuilder.CreateCylinder(`${station.name}-inkwell`, { height: 0.14, diameter: 0.12, tessellation: 12 }, scene);
      ink.position = new BABYLONNS.Vector3(station.x + 0.82, y + 1.13, station.z - 0.19);
      ink.material = markerMat;
      ink.parent = root;
    }
  }

  void workshopAssets.place("portable_welding_cart", root,
    new BABYLONNS.Vector3(20.7, terrain.getHeightAt(20.7, 7.8), 7.8), { height: 1.5 }, -0.42);
  collisionObstacles.push({ minX: 20.25, maxX: 21.15, minZ: 7.4, maxZ: 8.2 });

  // Timber-and-canvas observation awning shelters the analysis desk while
  // leaving an unobstructed sightline to the launch apron.
  const analysisAwning = new BABYLONNS.TransformNode("flight-analysis-awning", scene);
  analysisAwning.position = new BABYLONNS.Vector3(11.2, terrain.getHeightAt(11.2, -25.4), -25.4);
  analysisAwning.parent = root;
  collisionObstacles.push({ minX: 9.95, maxX: 12.45, minZ: -26.5, maxZ: -24.3 });
  for (const x of [-1.2, 1.2]) for (const z of [-1, 1]) {
    const post = BABYLONNS.MeshBuilder.CreateCylinder(`analysis-awning-post-${x}-${z}`, { height: 2.15, diameter: 0.09, tessellation: 10 }, scene);
    post.position = new BABYLONNS.Vector3(x, 1.08, z);
    post.material = darkMetalMat;
    post.parent = analysisAwning;
  }
  const canvasTexture = new BABYLONNS.DynamicTexture("tent-canvas-weave", { width: 512, height: 512 }, scene, false);
  const canvasContext = canvasTexture.getContext() as unknown as CanvasRenderingContext2D;
  canvasContext.fillStyle = "#aaa082"; canvasContext.fillRect(0, 0, 512, 512);
  canvasContext.strokeStyle = "#6e6653"; canvasContext.globalAlpha = 0.12; canvasContext.lineWidth = 1;
  for (let i = 0; i < 512; i += 4) {
    canvasContext.beginPath(); canvasContext.moveTo(i, 0); canvasContext.lineTo(i, 512); canvasContext.stroke();
    canvasContext.beginPath(); canvasContext.moveTo(0, i); canvasContext.lineTo(512, i); canvasContext.stroke();
  }
  canvasContext.globalAlpha = 0.5; canvasContext.strokeStyle = "#d6c8a2";
  canvasContext.setLineDash([3, 4]);
  for (const x of [8, 256, 504]) { canvasContext.beginPath(); canvasContext.moveTo(x, 0); canvasContext.lineTo(x, 512); canvasContext.stroke(); }
  canvasContext.globalAlpha = 1; canvasTexture.update(false);
  const canvasMat = new BABYLONNS.PBRMaterial("field-tent-woven-canvas", scene);
  canvasMat.albedoTexture = canvasTexture; canvasMat.roughness = 1; canvasMat.backFaceCulling = false;
  const canopyPaths: BABYLON.Vector3[][] = [];
  for (let xIndex = 0; xIndex <= 16; xIndex++) {
    const x = -1.45 + xIndex * 2.9 / 16;
    const path: BABYLON.Vector3[] = [];
    for (let zIndex = 0; zIndex <= 16; zIndex++) {
      const z = -1.2 + zIndex * 2.4 / 16;
      const ridge = 0.47 * (1 - Math.abs(z) / 1.2);
      const sag = 0.075 * Math.sin((xIndex / 16) * Math.PI);
      path.push(new BABYLONNS.Vector3(x, 2.18 + ridge - sag, z));
    }
    canopyPaths.push(path);
  }
  const canopy = BABYLONNS.MeshBuilder.CreateRibbon("tensioned-canvas-observation-awning", { pathArray: canopyPaths, sideOrientation: BABYLONNS.Mesh.DOUBLESIDE }, scene);
  canopy.material = canvasMat; canopy.parent = analysisAwning; canopy.receiveShadows = true;
  shadowGenerator.addShadowCaster(canopy);
  for (const side of [-1, 1]) {
    createBeam(`awning-ridge-support-${side}`, new BABYLONNS.Vector3(side * 1.2, 2.14, -1), new BABYLONNS.Vector3(side * 1.2, 2.63, 0), 0.05, darkMetalMat, analysisAwning);
    createBeam(`awning-front-rafter-${side}`, new BABYLONNS.Vector3(side * 1.2, 2.63, 0), new BABYLONNS.Vector3(side * 1.2, 2.14, 1), 0.05, darkMetalMat, analysisAwning);
    for (const z of [-1, 1]) {
      createBeam(`awning-guy-rope-${side}-${z}`, new BABYLONNS.Vector3(side * 1.2, 2.12, z), new BABYLONNS.Vector3(side * 1.7, 0.12, z * 1.5), 0.012, saddleLeatherMat, analysisAwning);
      createBeam(`awning-ground-stake-${side}-${z}`, new BABYLONNS.Vector3(side * 1.7, 0.02, z * 1.5), new BABYLONNS.Vector3(side * 1.66, 0.22, z * 1.5), 0.032, darkMetalMat, analysisAwning);
    }
  }

  pois.forEach((poi) => {
    const { x, z } = poi.position;
    const y = terrain.getHeightAt(x, z);
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
    character.root.scaling.setAll(0.98);
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
  let navigationTargetPoiId: string | null = null;

  /** Lock the orbit pivot to the astronaut's upper body. Only the player
   * controls the orbit angles; world movement carries the camera with them. */
  function followAstronaut(): void {
    camera.lockedTarget = cameraFollowAnchor;
  }

  function onKeyDown(ev: KeyboardEvent): void {
    if (inputSuspended || openingElapsed >= 0) return;
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
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      navigationPath = [];
      navigationTargetPoiId = null;
    }
    if (key === "e" && nearestPoi) {
      navigationPath = [];
      interactCallback?.(nearestPoi.poi.id);
      navigationTargetPoiId = null;
    }
  }
  function onKeyUp(ev: KeyboardEvent): void {
    keysDown.delete(ev.key.toLowerCase());
    if (ev.code === "ShiftLeft") leftShiftDown = false;
  }

  const onBlur = () => { keysDown.clear(); leftShiftDown = false; touchMoveX = 0; touchMoveY = 0; velocity.set(0, 0, 0); navigationPath = []; navigationTargetPoiId = null; };

  const focusMaterial = new BABYLONNS.StandardMaterial("nearby-activity-ground-highlight", scene);
  focusMaterial.diffuseColor = BABYLONNS.Color3.Black(); focusMaterial.emissiveColor = BABYLONNS.Color3.FromHexString("#b6c7ad");
  focusMaterial.disableLighting = true; focusMaterial.alpha = 0.4;
  const focusRing = BABYLONNS.MeshBuilder.CreateTorus("nearby-activity-focus-ring", { diameter: 1.1, thickness: 0.025, tessellation: 40 }, scene);
  focusRing.parent = root; focusRing.material = focusMaterial; focusRing.isPickable = false; focusRing.setEnabled(false);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let nearestPoi: { poi: MissionPointOfInterest; position: BABYLON.Vector3 } | null = null;
  let nearestPoiCallback: ((poi: NearbyPoi | null) => void) | null = null;
  let interactCallback: ((poiId: string) => void) | null = null;
  let mapStateCallback: ((state: GameplayMapState) => void) | null = null;

  function updateNearestPoi(): void {
    let closest: { poi: MissionPointOfInterest; position: BABYLON.Vector3; distSq: number } | null = null;
    let navigationTarget: { poi: MissionPointOfInterest; position: BABYLON.Vector3 } | null = null;
    for (const entry of poiMeshes) {
      const dx = entry.position.x - astronaut.root.position.x;
      const dz = entry.position.z - astronaut.root.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= DISCOVERY_RADIUS * DISCOVERY_RADIUS) discoveredPoiIds.add(entry.poi.id);
      if (entry.poi.id === navigationTargetPoiId && distSq <= INTERACT_RADIUS * INTERACT_RADIUS) {
        navigationTarget = { poi: entry.poi, position: entry.position };
      }
      if (distSq <= INTERACT_RADIUS * INTERACT_RADIUS && (!closest || distSq < closest.distSq)) {
        closest = { poi: entry.poi, position: entry.position, distSq };
      }
    }
    // Keep the selected destination actionable when nearby map markers overlap.
    const next = navigationTarget ?? (closest ? { poi: closest.poi, position: closest.position } : null);
    const changed = next?.poi.id !== nearestPoi?.poi.id;
    nearestPoi = next;
    focusRing.setEnabled(!!next && !inputSuspended);
    if (next) {
      focusRing.position.set(next.position.x, terrain.getHeightAt(next.position.x, next.position.z) + 0.045, next.position.z);
      focusMaterial.alpha = reducedMotion ? 0.34 : 0.3 + Math.sin(elapsed * 2.3) * 0.1;
    }
    if (changed) {
      nearestPoiCallback?.(next ? { id: next.poi.id, label: next.poi.label, prompt: next.poi.prompt } : null);
    }
  }

  return {
    handle: {
      setEngineeringFeedback(kind, progress, value) {
        instruments.setFeedback(kind, progress, value);
        if (kind === "propulsion") pressureFeedback = Math.max(0, Math.min(1, value ?? progress));
      },
      setInputSuspended(suspended) {
        inputSuspended = suspended;
        keysDown.clear(); touchMoveX = 0; touchMoveY = 0; leftShiftDown = false;
        velocity.set(0, 0, 0); navigationPath = []; navigationTargetPoiId = null;
        if (suspended) camera.detachControl();
        else if (enabled) camera.attachControl(canvas, true);
      },
      setQuality(profile) {
        quality = profile;
        const dprCap = profile === "high" ? 1.5 : 1;
        scene.getEngine().setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, dprCap));
        shadowGenerator.mapSize = profile === "high" ? 2048 : 1024;
        shadowGenerator.blurKernel = profile === "high" ? 16 : 8;
        ambientDust.emitRate = profile === "high" ? 2 : 0.7;
        scene.getEngine().resize();
      },
      getDiagnostics() {
        const engine = scene.getEngine();
        return { fps: engine.getFps(), frameMs: engine.getDeltaTime(), drawCalls: instrumentation.drawCallsCounter.current, activeMeshes: scene.getActiveMeshes().length, vertices: scene.getActiveMeshes().data.slice(0, scene.getActiveMeshes().length).reduce((count, mesh) => count + mesh.getTotalVertices(), 0), materials: scene.materials.length, textures: scene.textures.length, quality };
      },
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
      setFieldDraftFeedback(id, draft) { fieldKit.setDraft(id, draft); },
      setFieldFocus(id) {
        if (id && !fieldFocus) fieldCameraBackup = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius };
        fieldFocus = id;
        if (id) camera.lockedTarget = null;
        else {
          if (fieldCameraBackup) { camera.alpha = fieldCameraBackup.alpha; camera.beta = fieldCameraBackup.beta; camera.radius = fieldCameraBackup.radius; }
          fieldCameraBackup = null;
          followAstronaut();
        }
      },
      setFieldFeedback(id, progress, value) { fieldKit.setProgress(id, progress, value); },
      setRouteInspections(ids) { fieldKit.setRouteInspection(ids); },
      onLaunchExit(cb) { launchExitCallback = cb; },
      finishLaunch() {
        launchElapsed = -1; launchExitCallback = null;
        launchSmoke.stop(); launchFlame.stop();
        outerFlame.setEnabled(false); innerFlame.setEnabled(false);
        camera.radius = cameraOffsetRadius; camera.checkCollisions = false; followAstronaut();
      },
      reset() {
        fieldFocus = null; fieldKit.reset(); fieldKit.setWeather(weather.label);
        launchExitNotified = false; launchExitCallback = null;
        inputSuspended = false;
        keysDown.clear();
        for (const kind of ["circuits", "antenna", "propulsion", "diagnostic", "launch"] as const) instruments.setFeedback(kind, 0);
        pressureFeedback = 0;
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
        launchSupport.setRelease(0);
        openingElapsed = -1;
        launchSmoke.stop();
        launchFlame.stop();
        outerFlame.setEnabled(false);
        innerFlame.setEnabled(false);
        camera.alpha = -Math.PI / 2;
        camera.beta = 1.05;
        camera.radius = cameraOffsetRadius;
        camera.checkCollisions = false;
        followAstronaut();
        playAvatarAnimation(false, false);
        this.setDesign("balanced", "basic");
      },
      setDesign(structure, _instrumentation) {
        rocketRoot.scaling.y = structure === "light" ? 0.92 : structure === "reinforced" ? 1.12 : 1;
        rocketRoot.scaling.x = structure === "reinforced" ? 1.08 : structure === "light" ? 0.94 : 1;
        rocketRoot.scaling.z = structure === "reinforced" ? 1.08 : structure === "light" ? 0.94 : 1;
        rocketRoot.computeWorldMatrix(true);
        launchSupport.fitToVehicle(vehicleMeshes);
      },
      navigateTo(poiId) {
        const target = poiMeshes.find((entry) => entry.poi.id === poiId);
        navigationTargetPoiId = target?.poi.id ?? null;
        navigationPath = target ? findWalkPath(astronaut.root.position, target.position) : [];
      },
      playLaunch() {
        launchStartedAt = performance.now(); launchExitNotified = false;
        activeCameraMode = "cinematic";
        launchElapsed = 0;
        launchSupport.setRelease(0);
        rocketRoot.position.copyFrom(rocketStart);
        camera.lockedTarget = null;
        // The vehicle is the cutscene target, not an obstacle for its camera.
        camera.checkCollisions = false;
        camera.radius = 18;
        camera.beta = 1.2;
        camera.alpha = Math.PI * 0.35;
        launchSmoke.start();
        launchFlame.start();
        outerFlame.setEnabled(true);
        innerFlame.setEnabled(true);
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
          camera.alpha = Math.PI * 0.35;
          camera.beta = 1.2;
          camera.radius = 18;
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
          BABYLONNS.Color3.FromHexString("#b9aa91"),
          BABYLONNS.Color3.FromHexString("#d09a70"),
          launchGlow * 0.42,
        );
      },
      setTouchMovement(x, y) {
        if (inputSuspended) return;
        touchMoveX = Math.max(-1, Math.min(1, x));
        touchMoveY = Math.max(-1, Math.min(1, y));
        if (Math.hypot(touchMoveX, touchMoveY) > 0.12) {
          navigationPath = [];
          navigationTargetPoiId = null;
        }
      },
      setTouchSprint(active) { leftShiftDown = !inputSuspended && active; },
      jump() {
        if (grounded && enabled && !inputSuspended) {
          verticalVelocity = JUMP_SPEED;
          grounded = false;
        }
      },
      interact() {
        if (nearestPoi && !inputSuspended) {
          navigationPath = [];
          interactCallback?.(nearestPoi.poi.id);
          navigationTargetPoiId = null;
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
      activeAvatarAnimation?.play(true);
      // Movement uses the explicit obstacle resolver below. Disable Babylon's
      // broad collision pass so the static floor and camera cannot fight it.
      scene.collisionsEnabled = false;
      camera.checkCollisions = false;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
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
      activeAvatarAnimation?.pause();
      keysDown.clear();
      leftShiftDown = false;
      touchMoveX = 0;
      touchMoveY = 0;
      velocity.set(0, 0, 0);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      camera.detachControl();
      camera.checkCollisions = false;
      camera.inputs.clear();
      camera.lockedTarget = null;
      root.setEnabled(false);
    },
    update(deltaSeconds: number) {
      if (!enabled) return;
      deltaSeconds = Math.max(0, Math.min(deltaSeconds, 1 / 30));
      elapsed += deltaSeconds;
      instruments.update(deltaSeconds);
      fieldKit.update(deltaSeconds, enabled && openingElapsed < 0, reducedMotion);
      const contactY = terrain.getHeightAt(astronaut.root.position.x, astronaut.root.position.z);
      playerContact.position.set(astronaut.root.position.x, contactY + 0.012, astronaut.root.position.z);
      playerContact.visibility = Math.max(0, 1 - Math.max(0, astronaut.root.position.y - contactY) / 2);
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
      gaugeNeedles.forEach((needle, index) => { needle.rotation.z = -0.43 + pressureFeedback * 1.5 + Math.sin(elapsed * 1.4 + index) * 0.025; });
      cupHead.rotation.y += deltaSeconds * (weather.label === "WINDY" ? 9 : 4.5);
      if (launchElapsed >= 0) {
        launchElapsed = Math.max(launchElapsed + deltaSeconds, (performance.now() - launchStartedAt) / 1000);
        // Contact jacks withdraw completely before the vehicle rises. Keep the
        // climb vertical until the tail clears the rear gantry and its deck.
        launchSupport.setRelease(launchElapsed / 0.85);
        const flightTime = Math.max(0, launchElapsed - 0.95);
        // Keep climbing beyond the launch frame so the rocket visibly leaves the map.
        const climb = launchPeakAltitude * 5.5 * (1 - Math.exp(-flightTime / 8.5));
        const drift = Math.max(0, flightTime - 2.6) * 1.15;
        rocketRoot.position.x = rocketStart.x + drift * 0.1;
        rocketRoot.position.z = rocketStart.z + drift;
        rocketRoot.position.y = rocketStart.y + climb;
        if (launchElapsed > 9) {
          launchSmoke.stop();
          launchFlame.stop();
          outerFlame.setEnabled(false);
          innerFlame.setEnabled(false);
        } else {
          const flutter = 0.9 + Math.sin(elapsed * 29) * 0.11 + Math.sin(elapsed * 17) * 0.06;
          outerFlame.scaling.set(0.72 + flutter * 0.22, flutter, 0.72 + flutter * 0.22);
          innerFlame.scaling.set(0.76 + flutter * 0.18, 0.8 + flutter * 0.2, 0.76 + flutter * 0.18);
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

      if (inputSuspended) { moveX = 0; moveZ = 0; }
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
        velocity.x += (targetX - velocity.x) * (1 - Math.exp(-MOVE_ACCELERATION * deltaSeconds));
        velocity.z += (targetZ - velocity.z) * (1 - Math.exp(-MOVE_ACCELERATION * deltaSeconds));
      } else {
        const damping = Math.exp(-MOVE_BRAKING * deltaSeconds);
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
      const onShedDeck = astronaut.root.position.x > 12.45 && astronaut.root.position.x < 15.95 && astronaut.root.position.z > -3.94 && astronaut.root.position.z < -1.66;
      const groundY = Math.max(terrain.getHeightAt(astronaut.root.position.x, astronaut.root.position.z), onShedDeck ? shed.position.y + 0.22 : -Infinity);
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

      // Every camera returns to the fixed observation frame for the final departure.
      if (launchElapsed >= 12) activeCameraMode = "cinematic";
      const cameraTracksRocket = launchElapsed >= 0 && !launchExitNotified && openingElapsed < 0;
      if (cameraTracksRocket) {
        camera.lockedTarget = null;
        if (activeCameraMode === "cinematic" && launchElapsed >= 4) {
          camera.target.set(rocketStart.x, rocketStart.y + 2, rocketStart.z);
          camera.radius = 12;
        } else if (activeCameraMode === "observation") {
          camera.target.copyFrom(rocketRoot.position);
          camera.target.y += 4.2 * rocketRoot.scaling.y;
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
          camera.target.y += 4.2 * rocketRoot.scaling.y;
          if (launchElapsed < 2.5 && !reducedMotion) {
            camera.target.x += (Math.random() - 0.5) * 0.04;
            camera.target.y += (Math.random() - 0.5) * 0.04;
          }
        }
      } else if (openingElapsed < 0 && launchElapsed < 0) {
        if (fieldFocus) {
          const point = FIELD_STATION_LOCATIONS[fieldFocus];
          camera.lockedTarget = null;
          const blend = reducedMotion ? 1 : 1 - Math.exp(-8 * deltaSeconds);
          camera.target.x += (point.x + 1.1 - camera.target.x) * blend;
          camera.target.y += (terrain.getHeightAt(point.x, point.z) + (fieldFocus === "weather" ? 1.9 : 1.05) - camera.target.y) * blend;
          camera.target.z += (point.z - camera.target.z) * blend;
          camera.alpha += Math.atan2(Math.sin(-Math.PI / 2 - camera.alpha), Math.cos(-Math.PI / 2 - camera.alpha)) * blend;
          camera.beta += (1.05 - camera.beta) * blend; camera.radius += (6 - camera.radius) * blend;
        } else followAstronaut();
      }
      if (launchElapsed >= 4 && !launchExitNotified) {
        camera.getViewMatrix(true);
        const visibleVehicle = vehicleMeshes.some(mesh => mesh.getTotalVertices() > 0 && camera.isInFrustum(mesh));
        if ((!visibleVehicle && vehicleMeshes.length > 0) || (vehicleMeshes.length === 0 && launchElapsed >= 18)) {
          launchExitNotified = true;
          launchSmoke.stop(); launchFlame.stop();
          outerFlame.setEnabled(false); innerFlame.setEnabled(false);
          launchExitCallback?.();
        }
      }

      updateNearestPoi();
      mapStateCallback?.({
        player: { x: astronaut.root.position.x, z: astronaut.root.position.z, direction: astronaut.root.rotation.y },
        points: getMapPoints(),
      });
    },
    dispose() {
      instrumentation.dispose();
      disposed = true;
      this.disable();
      fieldKit.dispose();
      instruments.dispose();
      focusRing.dispose(); focusMaterial.dispose();
      playerContact.dispose(); contactMaterial.dispose(); contactTexture.dispose();
      camera.lockedTarget = null;
      avatarAnimationGroups.forEach(group => group.dispose());
      astronaut.dispose();
      for (const worker of fieldCrew) worker.character.dispose();
      launchSmoke.dispose();
      launchFlame.dispose();
      outerFlame.dispose();
      innerFlame.dispose();
      outerFlameMat.dispose();
      innerFlameMat.dispose();
      rocketExhaustEmitter.dispose();
      ambientDust.dispose();
      smokeTexture.dispose();
      terrain.dispose();
      rocketRoot.dispose(false, true);
      propMat.dispose();
      workshopAssets.dispose();
      roofMat.dispose(false, true);
      canvasMat.dispose(false, true);
      woodMat.dispose(false, true);
      darkMetalMat.dispose(false, true);
      paperMat.dispose(true, true);
      brassMat.dispose();
      saddleLeatherMat.dispose();
      recorderLampMaterials.forEach(material => material.dispose());
      gaugeFaceMat.dispose(true, true);
      chartMat.dispose(true, true);
      markerMat.dispose();
      launchPadMat.dispose(false, true);
      launchContactMat.dispose(false, true);
      launchMarkingMat.dispose();
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
  const texture = new BABYLONNS.DynamicTexture("auburn-morning-sky", { width: 2048, height: 1024 }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, "#7794aa");
  gradient.addColorStop(0.27, "#a7b5b7");
  gradient.addColorStop(0.46, "#d8c4a0");
  gradient.addColorStop(0.52, "#efc08a");
  gradient.addColorStop(0.58, "#d3b18c");
  gradient.addColorStop(0.74, "#a9aaa0");
  gradient.addColorStop(1, "#8399a4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 1024);

  // The diffuse low sun reads as morning light without a hard artificial orb.
  const sunrise = ctx.createRadialGradient(1480, 520, 12, 1480, 520, 330);
  sunrise.addColorStop(0, "rgba(255, 226, 176, 0.42)");
  sunrise.addColorStop(0.35, "rgba(244, 202, 155, 0.2)");
  sunrise.addColorStop(1, "rgba(244, 202, 155, 0)");
  ctx.fillStyle = sunrise;
  ctx.fillRect(0, 0, 2048, 1024);

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
  const packed = new BABYLONNS.DynamicTexture(`${name}-linear-arm`, { width: 128, height: 128 }, scene, true);
  const packedContext = packed.getContext() as unknown as CanvasRenderingContext2D;
  const roughness = style === "metal" ? 177 : style === "wood" ? 235 : 245;
  const metallic = style === "metal" ? 165 : 0;
  for (let y = 0; y < 128; y++) {
    const variation = Math.round(Math.sin(y * 1.73) * (style === "metal" ? 20 : 6));
    packedContext.fillStyle = `rgb(255,${roughness + variation},${metallic})`;
    packedContext.fillRect(0, y, 128, 1);
  }
  packed.update(); packed.gammaSpace = false;
  material.metallicTexture = packed;
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.roughness = style === "metal" ? 0.75 : 0.94;
  material.metallic = style === "metal" ? 1 : 0;
  return material;
}
