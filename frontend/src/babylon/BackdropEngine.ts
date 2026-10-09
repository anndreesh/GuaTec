import { MISSION_1_POIS, THEME } from "@/config/gameConfig";
import { createGameplayLayer, type GameplayHandle } from "@/babylon/gameplay/GameplayLayer";
import type { HDRCubeTexture, Node } from "@babylonjs/core";

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
  shadowGenerator.blurKernel = 24;

  const planet = BABYLON.MeshBuilder.CreateSphere("planet", { diameter: 6, segments: 32 }, scene);
  const planetMaterial = new BABYLON.StandardMaterial("planetMat", scene);
  planetMaterial.diffuseColor = BABYLON.Color3.FromHexString("#b1502f");
  planetMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  planet.material = planetMaterial;
  planet.position.y = -1.5;

  const starfield = BABYLON.MeshBuilder.CreateSphere("starfield", { diameter: 200, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
  const starMaterial = new BABYLON.StandardMaterial("starMat", scene);
  starMaterial.emissiveColor = BABYLON.Color3.FromHexString("#0b0f22");
  starMaterial.disableLighting = true;
  starfield.material = starMaterial;

  // The playable third-person layer (procedural astronaut, terrain, POIs,
  // WASD + follow camera) is built lazily the first time it's needed so the
  // ambient-only modes (splash/mission-select/report) stay cheap.
  let gameplayLayer: ReturnType<typeof createGameplayLayer> | null = null;
  let fieldEnvironment: HDRCubeTexture | null = null;
  function ensureGameplayLayer(): ReturnType<typeof createGameplayLayer> {
    if (!gameplayLayer) {
      gameplayLayer = createGameplayLayer(BABYLON, scene, camera, canvas, MISSION_1_POIS, shadowGenerator);
    }
    return gameplayLayer;
  }

  let currentMode: BackdropMode = "starfield";

  engine.runRenderLoop(() => {
    if (currentMode !== "mission1-gameplay") {
      planet.rotation.y += 0.0015;
    } else {
      gameplayLayer?.update(engine.getDeltaTime() / 1000);
    }
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
          // The bundled shuttle and its launch frame cast an oversized
          // shadow at dawn. Keep this small test range evenly lit and readable.
          scene.shadowsEnabled = false;
          planet.setEnabled(false);
          starfield.setEnabled(false);
          if (!fieldEnvironment) {
            fieldEnvironment = new BABYLON.HDRCubeTexture(
              "/assets/polyhaven/hdri/suburban_field_01_1k.hdr", scene, 256, false, true, false, true,
            );
            fieldEnvironment.isBlocking = false;
            fieldEnvironment.rotationY = Math.PI * 0.82;
          }
          scene.environmentTexture = fieldEnvironment;
          scene.environmentIntensity = 0.62;
          scene.imageProcessingConfiguration.toneMappingEnabled = true;
          scene.imageProcessingConfiguration.exposure = 1.04;
          scene.imageProcessingConfiguration.contrast = 1.12;
          ensureGameplayLayer().enable();
          scene.meshes.forEach((mesh) => {
            let node: Node | null = mesh;
            let belongsToGameplay = false;
            let castsSceneBlockingShadow = false;
            while (node) {
              if (node.name === "gameplay-root") belongsToGameplay = true;
              if (node.name === "1926-launch-frame" || node.name === "nasa-shuttle-model" || node.name === "mercenary-avatar-model") {
                castsSceneBlockingShadow = true;
              }
              node = node.parent;
            }
            if (belongsToGameplay && !castsSceneBlockingShadow && mesh.name !== "auburn-sky-dome") {
              shadowGenerator.addShadowCaster(mesh, true);
              mesh.receiveShadows = true;
            }
          });
          break;
      }
    },
    getGameplayHandle() {
      return currentMode === "mission1-gameplay" ? ensureGameplayLayer().handle : null;
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      gameplayLayer?.dispose();
      fieldEnvironment?.dispose();
      engine.dispose();
    },
  };
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
    stars = Array.from({ length: 140 }, () => ({
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
