import { MISSION_1_POIS, THEME } from "@/config/gameConfig";
import { createGameplayLayer, type GameplayHandle } from "@/babylon/gameplay/GameplayLayer";
import type { AbstractMesh, Node } from "@babylonjs/core";

/** Keep shadow submission tied to world-scale silhouettes, not local source bounds. */
export function isMissionShadowCaster(mesh: AbstractMesh): boolean {
  let node: Node | null = mesh;
  let belongsToGameplay = false;
  let crew = false;
  while (node) {
    if (node.name === "gameplay-root") belongsToGameplay = true;
    if (node.name === "field-engineer-root") crew = true;
    if (node.name === "field-station-kit" || node.name === "1926-launch-frame"
      || node.name === "nasa-shuttle-model" || node.name === "mercenary-avatar-model"
      || /^field-(adjustable_wrench|vintage_oil_lamp|metal_toolbox)-/.test(node.name)) return false;
    node = node.parent;
  }
  if (!belongsToGameplay || !mesh.isVisible || mesh.getTotalVertices() === 0) return false;
  const name = mesh.name;
  if (name === "mars-ground" || name === "auburn-distant-ground" || name === "auburn-sky-dome"
    || name === "player-contact-shadow" || name === "nearby-activity-focus-ring" || name === "rocket-exhaust-emitter"
    || /^(auburn-star-|field-surface-patch-|dry-grass-|rocket-engine-)/.test(name)
    || /^shed-(roof-standing-seam-|floor-board-|back-siding-|siding-nail-)/.test(name)) return false;
  mesh.computeWorldMatrix(true);
  const extent = mesh.getBoundingInfo().boundingBox.extendSizeWorld;
  const largestDimension = 2 * Math.max(extent.x, extent.y, extent.z);
  return Number.isFinite(largestDimension) && largestDimension > (crew ? 0.3 : 0.6);
}

export type BackdropMode = "starfield" | "mars-orbit" | "mars-surface" | "mission1-gameplay";

export interface Backdrop {
  setMode(mode: BackdropMode): void;
  /** Returns the interactive gameplay handle when the current mode is a
   * playable third-person scene, or `null` otherwise (including when the
   * CSS fallback backdrop is active, since it has no Babylon scene). */
  getGameplayHandle(): GameplayHandle | null;
  dispose(): void;
}

/**
 * Builds an ambient 3D backdrop with Babylon.js behind the DOM-based UI.
 *
 * Babylon.js is loaded dynamically so that if the package is missing (e.g.
 * `npm install` wasn't run for the heavy 3D deps, or the CDN/registry is
 * unreachable in a constrained environment) the app still boots: it falls
 * back to a CSS gradient/starfield-via-canvas-2D background instead of a
 * blank screen.
 */
export async function createBackdrop(canvas: HTMLCanvasElement): Promise<Backdrop> {
  try {
    return await createBabylonBackdrop(canvas);
  } catch (err) {
    console.warn("[BackdropEngine] Babylon.js unavailable, using CSS fallback backdrop.", err);
    return createCssFallbackBackdrop(canvas);
  }
}

async function createBabylonBackdrop(canvas: HTMLCanvasElement): Promise<Backdrop> {
  const BABYLON = await import("@babylonjs/core");

  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString(THEME.colors.background + "ff");

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 2.4,
    12,
    BABYLON.Vector3.Zero(),
    scene,
  );
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 20;
  camera.inputs.clear(); // ambient backdrop only, not user-controlled by default

  const ambient = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0.3), scene);
  ambient.intensity = 0.42;
  const sun = new BABYLON.DirectionalLight("morningSun", new BABYLON.Vector3(-0.35, -1, 0.45), scene);
  sun.position = new BABYLON.Vector3(18, 24, -20);
  sun.intensity = 1.35;
  const shadowGenerator = new BABYLON.ShadowGenerator(2048, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 16;
  shadowGenerator.bias = 0.0004;
  shadowGenerator.normalBias = 0.018;
  sun.shadowMinZ = 0.1; sun.shadowMaxZ = 125;

  const planet = BABYLON.MeshBuilder.CreateSphere("planet", { diameter: 6, segments: 32 }, scene);
  const planetMaterial = new BABYLON.StandardMaterial("planetMat", scene);
  planetMaterial.diffuseColor = BABYLON.Color3.FromHexString("#b1502f");
  planetMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  planet.material = planetMaterial;
  planet.position.y = -1.5;

  const starfield = BABYLON.MeshBuilder.CreateSphere("starfield", { diameter: 200, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
  const starMaterial = new BABYLON.StandardMaterial("starMat", scene);
  const starTexture = createStarfieldTexture(BABYLON, scene, "ambient-starfield", 1500);
  starMaterial.diffuseTexture = starTexture;
  starMaterial.emissiveTexture = starTexture;
  starMaterial.disableLighting = true;
  starfield.material = starMaterial;

  // The playable third-person layer (procedural astronaut, terrain, POIs,
  // WASD + follow camera) is built lazily the first time it's needed so the
  // ambient-only modes (splash/mission-select/report) stay cheap.
  let gameplayLayer: ReturnType<typeof createGameplayLayer> | null = null;
  function ensureGameplayLayer(): ReturnType<typeof createGameplayLayer> {
    if (!gameplayLayer) {
      gameplayLayer = createGameplayLayer(BABYLON, scene, camera, canvas, MISSION_1_POIS, shadowGenerator);
    }
    return gameplayLayer;
  }

  let fieldEnvironment: InstanceType<typeof BABYLON.HDRCubeTexture> | null = null;
  let currentMode: BackdropMode = "starfield";
  let shadowBudgetDirty = true;
  const shadowMeshObserver = scene.onNewMeshAddedObservable.add(() => { shadowBudgetDirty = true; });
  const updateShadowBudget = () => {
    if (currentMode !== "mission1-gameplay" || !shadowBudgetDirty) return;
    shadowBudgetDirty = false;
    for (const mesh of scene.meshes) {
      if (isMissionShadowCaster(mesh)) {
        shadowGenerator.addShadowCaster(mesh, false);
        const receiver = mesh instanceof BABYLON.InstancedMesh ? mesh.sourceMesh : mesh;
        receiver.receiveShadows = true;
      } else {
        shadowGenerator.removeShadowCaster(mesh, false);
      }
    }
  };

  engine.runRenderLoop(() => {
    if (currentMode !== "mission1-gameplay") {
      planet.rotation.y += 0.0015;
    } else {
      gameplayLayer?.update(engine.getDeltaTime() / 1000);
    }
    // Async GLBs and rebuilt gantry parts receive the same policy after their
    // transforms are assigned, without scanning every mesh on unchanged frames.
    updateShadowBudget();
    scene.render();
  });

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);

  return {
    setMode(mode: BackdropMode) {
      if (currentMode === "mission1-gameplay" && mode !== "mission1-gameplay") {
        gameplayLayer?.disable();
        scene.environmentTexture = null;
      }
      currentMode = mode;
      if (mode !== "mission1-gameplay") {
        scene.shadowsEnabled = true;
        scene.environmentIntensity = 1;
        scene.imageProcessingConfiguration.toneMappingEnabled = false;
        scene.imageProcessingConfiguration.exposure = 1;
        scene.imageProcessingConfiguration.contrast = 1;
        ambient.intensity = 0.42;
        ambient.diffuse = BABYLON.Color3.White();
        ambient.groundColor = BABYLON.Color3.FromHexString("#282334");
        sun.intensity = 1.35;
        sun.diffuse = BABYLON.Color3.White();
        sun.specular = BABYLON.Color3.White();
      }

      switch (mode) {
        case "starfield":
          camera.radius = 18;
          planet.setEnabled(false);
          starfield.setEnabled(true);
          break;
        case "mars-orbit":
          camera.radius = 12;
          planet.setEnabled(true);
          planet.position.y = -1.5;
          starfield.setEnabled(true);
          break;
        case "mars-surface":
          camera.radius = 9;
          planet.setEnabled(true);
          planet.position.y = -4.5;
          starfield.setEnabled(true);
          break;
        case "mission1-gameplay":
          // Soft, warm morning fill matches the Auburn field while directional
          // light keeps the rocket and launch frame readable against the sky.
          scene.shadowsEnabled = true;
          planet.setEnabled(false);
          starfield.setEnabled(false);
          fieldEnvironment ??= new BABYLON.HDRCubeTexture("/assets/polyhaven/hdri/suburban_field_01_1k.hdr", scene, 128, false, true, false, true);
          scene.environmentTexture = fieldEnvironment;
          scene.environmentIntensity = 0.42;
          ambient.intensity = 0.58;
          ambient.diffuse = BABYLON.Color3.FromHexString("#ead8bd");
          ambient.groundColor = BABYLON.Color3.FromHexString("#625440");
          sun.direction = new BABYLON.Vector3(-0.18, -0.9, 0.32).normalize();
          sun.position = new BABYLON.Vector3(18, 24, -20);
          sun.intensity = 1.05;
          sun.diffuse = BABYLON.Color3.FromHexString("#ffe0b4");
          sun.specular = BABYLON.Color3.FromHexString("#f7e8d3");
          scene.imageProcessingConfiguration.toneMappingEnabled = true;
          scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
          scene.imageProcessingConfiguration.exposure = 1.02;
          scene.imageProcessingConfiguration.contrast = 1.03;
          const layer = ensureGameplayLayer();
          layer.enable();
          let savedQuality: "high" | "balanced" = "balanced";
          try { if (localStorage.getItem("guatec-graphics-quality") === "high") savedQuality = "high"; } catch { /* storage can be unavailable */ }
          layer.handle.setQuality(savedQuality);
          shadowBudgetDirty = true;
          updateShadowBudget();
          break;
      }
    },
    getGameplayHandle() {
      return currentMode === "mission1-gameplay" ? ensureGameplayLayer().handle : null;
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      scene.onNewMeshAddedObservable.remove(shadowMeshObserver);
      gameplayLayer?.dispose();
      engine.dispose();
    },
  };
}

/** Paint a dense, varied star map instead of relying on a flat dark material.
 * The larger stars are deliberately sparse so the background reads as depth,
 * not as uniform visual noise. */
function createStarfieldTexture(
  BABYLON: typeof import("@babylonjs/core"),
  scene: import("@babylonjs/core").Scene,
  name: string,
  count: number,
): import("@babylonjs/core").DynamicTexture {
  const texture = new BABYLON.DynamicTexture(name, { width: 2048, height: 1024 }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#030714";
  ctx.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 1024;
    const bright = Math.random() < 0.07;
    const radius = bright ? 1.1 + Math.random() * 1.3 : 0.2 + Math.random() * 0.75;
    ctx.globalAlpha = bright ? 0.68 + Math.random() * 0.32 : 0.28 + Math.random() * 0.55;
    ctx.fillStyle = Math.random() < 0.12 ? "#b9d4ff" : Math.random() < 0.12 ? "#ffe3b0" : "#f4f7ff";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  texture.update();
  return texture;
}

/** No-3D-dependency fallback: an animated CSS/canvas-2D starfield gradient. */
function createCssFallbackBackdrop(canvas: HTMLCanvasElement): Backdrop {
  canvas.classList.add("backdrop-fallback");
  const ctx = canvas.getContext("2d");
  let raf = 0;
  let stars: { x: number; y: number; r: number; s: number }[] = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 420 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      s: Math.random() * 0.4 + 0.05,
    }));
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#eef2ff";
    for (const star of stars) {
      star.y += star.s;
      if (star.y > canvas.height) star.y = 0;
      ctx.globalAlpha = 0.4 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);

  return {
    setMode() {
      /* no-op: single ambient look in fallback mode */
    },
    getGameplayHandle() {
      return null;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.classList.remove("backdrop-fallback");
    },
  };
}
