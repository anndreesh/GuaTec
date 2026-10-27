import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildCar, CAR_SPECS, type CarKind } from './ApolloVehicles';
import { buildBench, type Kit, type StationKind } from './ApolloFurniture';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { apolloText } from './ApolloLocale';
import { BONUS_CHECKPOINTS, type ApolloBonusCheckpoint } from './ApolloState';
import { buildStandModel, createStandAtlas, standCollisionProxies, type StandModelKind } from './ApolloStandModels';

export type ApolloQuality = 'low' | 'medium' | 'high';
type Mode = 'intro' | 'crew' | 'launch' | null;
type Collider = { x: number; z: number; w: number; d: number };
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

function useConservativeRenderer(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Safari/iOS can expose WebGL2 while still rejecting an aggressive context
  // request on integrated or mobile GPUs. Prefer a smaller, default context.
  return /Safari\//.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
}

/** All positions are metres. The traversable support route is deliberately compressed;
 * the 110.6 m Saturn V, its tower, vehicles and people keep a common physical scale. */
export class ApolloWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.15, 12500);
  readonly renderer: THREE.WebGLRenderer;
  readonly player = new THREE.Vector3(-35, 0, 136);
  readonly ready: Promise<void>;
  readonly assetErrors: string[] = [];
  yaw = 0;
  // Vertical orbit offset: dragging upward raises the view toward the sky.
  private pitch = 0.22;
  private zoomed = false;
  private keys = new Set<string>();
  private suspended = false;
  private disposed = false;
  private quality: ApolloQuality = 'medium';
  private mode: Mode = null;
  private cinematicElapsed = 0;
  private clock = 0;
  private playerRoot = new THREE.Group();
  private verticalVelocity = 0;
  private grounded = true;
  private crewRoot = new THREE.Group();
  private rocket = new THREE.Group();
  private van = new THREE.Group();
  private arms: THREE.Group[] = [];
  private crew: THREE.Group[] = [];
  private people: { root: THREE.Group; mixer: THREE.AnimationMixer; walk: THREE.AnimationAction | null; idle: THREE.AnimationAction | null; run: THREE.AnimationAction | null; jump: THREE.AnimationAction | null }[] = [];
  private mixers: THREE.AnimationMixer[] = [];
  private colliders: Collider[] = [];
  private sun = new THREE.DirectionalLight(0xfff0d3, 3.2);
  private exhaustLight = new THREE.PointLight(0xffa139, 0, 240, 1.5);
  private target = new THREE.Group();
  private targetPoint: { x: number; z: number } | null = null;
  private flames: THREE.Mesh[] = [];
  private smoke: THREE.InstancedMesh;
  private smokeCount = 100;
  private dummy = new THREE.Object3D();
  private cameraGoal = new THREE.Vector3();
  private cameraLook = new THREE.Vector3();
  private lookGoal = new THREE.Vector3();
  private navProjection = new THREE.Vector3();
  private standFocus: { x: number; z: number } | null = null;
  private lastCameraUpdate = performance.now();
  private shadowAge = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private loadedModel: Record<string, unknown> = {};
  private staticBuffers: Map<THREE.Material, THREE.BufferGeometry[]> = new Map();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private resizeObserver: ResizeObserver;
  private frameDurations: number[] = [];
  private furniture: Kit;
  private inspectionTarget:'rocket'|'tower'|'vab'|null=null;
  private inspectionPosition=new THREE.Vector3();
  private smokeBillboard=new THREE.Quaternion();
  private nasaTexture: THREE.Texture | null = null;
  private cloudSprites = new THREE.Group();
  private localizedSigns: { title: string; subtitle: string; planes: THREE.Mesh[]; width: number }[] = [];
  private bonusAccents: { mesh: THREE.Mesh; phase: number; id: string }[] = [];
  private standAtlas: THREE.CanvasTexture | null = null;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;

  constructor(private host: HTMLElement, private callbacks: { onInteract: () => void; onMap: () => void }) {
    this.furniture = {
      mat: (name, color, roughness, metalness) => this.material(name, color, roughness, metalness),
      box: (w, h, d, material, x, y, z, ry = 0) => { this.box(w, h, d, material, x, y, z, undefined, ry); },
      cyl: (rt, rb, h, material, x, y, z, rx = 0, rz = 0) => { const mesh = this.cylinder(rt, rb, h, material, x, y, z); mesh.rotation.x = rx; mesh.rotation.z = rz; },
      ball: (r, material, x, y, z, squash = 1, dome = false) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, dome ? 6 : 10, 0, Math.PI * 2, dome ? 0 : 0, dome ? Math.PI / 2 : Math.PI), material); mesh.position.set(x, y, z); mesh.scale.y = squash; mesh.castShadow = true; this.staticBuffers.set(material, [...(this.staticBuffers.get(material) ?? []), mesh.geometry.clone().applyMatrix4(mesh.matrix)]); },
      tube: (a, b, width, material) => this.beam(a, b, width, material),
      sheet: (w, d, tex, x, y, z, tilt = 0) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); mesh.rotation.x = -Math.PI / 2 + tilt; mesh.position.set(x, y, z); this.scene.add(mesh); },
    };
    const conservativeRenderer = useConservativeRenderer();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !conservativeRenderer,
      powerPreference: conservativeRenderer ? 'default' : 'high-performance',
      precision: conservativeRenderer ? 'mediump' : 'highp',
    });
    this.renderer.domElement.className = 'apollo-world-canvas';
    this.renderer.domElement.setAttribute('aria-label', apolloText('Centro Espacial Kennedy en 1969. Escenario 3D de Apollo 11.'));
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(environment, .08);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = .32;
    environment.dispose(); pmrem.dispose();
    host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x9dcce7);
    this.scene.fog = new THREE.FogExp2(0xb9d4dc, 0.00038);
    this.scene.add(new THREE.HemisphereLight(0xd3e8f2, 0x827860, 1.45));
    this.sun.position.set(220, 260, 120);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -180; this.sun.shadow.camera.right = 180;
    this.sun.shadow.camera.top = 200; this.sun.shadow.camera.bottom = -200;
    this.sun.shadow.camera.near = 10; this.sun.shadow.camera.far = 750;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.14;
    this.sun.target.position.set(0, 0, 140);
    this.scene.add(this.sun, this.sun.target, this.exhaustLight);
    this.exhaustLight.position.set(0, 12, 0);
    this.buildGround();
    this.buildPad();
    this.buildSaturn();
    this.buildBuildings();
    this.buildStations();
    this.buildBonusStations();
    this.buildVehicles();
    this.buildClouds();
    this.buildServiceDetails();
    for (const child of [...this.scene.children]) if (child instanceof THREE.Group) this.mergeAuthored(child);
    this.flushStatic();
    this.scene.add(this.playerRoot, this.crewRoot);
    this.playerRoot.position.copy(this.player);
    // Keep the astronaut readable as a third-person hero from the first frame.
    this.camera.position.set(this.player.x, 3.35, this.player.z + 5.8); this.camera.lookAt(this.player.x, 1.35, this.player.z);
    this.buildMarker();
    const smokeMaterial = new THREE.MeshBasicMaterial({ map:createSmokeTexture(), color:0xe8e3d6, transparent:true, opacity:.72, depthWrite:false, side:THREE.DoubleSide });
    this.smoke = new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2), smokeMaterial, this.smokeCount);
    this.smoke.frustumCulled = false;
    this.smoke.visible = false;
    this.scene.add(this.smoke);
    this.setQuality('high');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.onPointerUp);
    this.ready = this.loadAstronauts();
  }

  /** Refresh only language-dependent canvas textures; geometry and player state stay intact. */
  refreshLanguage(): void {
    this.renderer.domElement.setAttribute('aria-label', apolloText('Centro Espacial Kennedy en 1969. Escenario 3D de Apollo 11.'));
    for (const sign of this.localizedSigns) {
      const materials = new Set(sign.planes.map(plane=>plane.material as THREE.MeshBasicMaterial));
      for (const material of materials) {
        const previous = material.map;
        material.map = this.textTexture(`${apolloText(sign.title)}\n${apolloText(sign.subtitle)}`, '#f2e8cb', true);
        material.needsUpdate = true;
        previous?.dispose();
      }
    }
  }

  private material(name: string, color: number, roughness = 0.8, metalness = 0): THREE.MeshStandardMaterial {
    if (!this.materials.has(name)) this.materials.set(name, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return this.materials.get(name)!;
  }
  private box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, parent?: THREE.Group, rotation = 0): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.rotation.y = rotation;
    mesh.castShadow = h > 1; mesh.receiveShadow = true;
    if (parent) parent.add(mesh); else this.addStatic(mesh);
    return mesh;
  }
  private cylinder(rt: number, rb: number, h: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Group, segments = 24): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    if (parent) parent.add(mesh); else this.addStatic(mesh);
    return mesh;
  }
  private beam(a: THREE.Vector3, b: THREE.Vector3, width: number, mat: THREE.Material, parent?: THREE.Group): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, a.distanceTo(b), width), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    if (parent) { mesh.castShadow = true; parent.add(mesh); } else this.addStatic(mesh);
  }
  private addStatic(mesh: THREE.Mesh): void {
    mesh.updateMatrix();
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const material = mesh.material as THREE.Material;
    const batch = this.staticBuffers.get(material) ?? [];
    batch.push(g); this.staticBuffers.set(material, batch);
    mesh.geometry.dispose();
  }
  private addStaticModel(root: THREE.Group): void {
    root.updateMatrixWorld(true);
    root.traverse(node=>{
      if(!(node instanceof THREE.Mesh)||Array.isArray(node.material))return;
      const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
      const batch=this.staticBuffers.get(node.material)??[];batch.push(geometry);this.staticBuffers.set(node.material,batch);
      node.geometry.dispose();
    });
  }
  private mergeAuthored(group: THREE.Group): void {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const removals: THREE.Mesh[] = [];
    group.traverse(node => {
      if (!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial)) return;
      const geometry = (node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
      const list = batches.get(node.material) ?? []; list.push(geometry); batches.set(node.material, list); removals.push(node);
    });
    for (const mesh of removals) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    for (const [material, gs] of batches) {
      const merged = mergeGeometries(gs, false);
      if (merged) { const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }
      gs.forEach(g => g.dispose());
    }
  }
  private flushStatic(): void {
    for (const [mat, geometries] of this.staticBuffers) {
      const merged = mergeGeometries(geometries, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh);
      }
      for (const g of geometries) g.dispose();
    }
    this.staticBuffers.clear();
  }
  private texture(type: 'soil' | 'concrete' | 'asphalt' | 'gravel', repeat: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const palette = { soil: [139, 132, 108], concrete: [164, 160, 145], asphalt: [58, 62, 61], gravel: [161, 147, 118] }[type];
    let seed = 109;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * (type === 'soil' ? 7 : 24);
      img.data[i] = palette[0] + n; img.data[i + 1] = palette[1] + n; img.data[i + 2] = palette[2] + n; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (type === 'concrete') {
      ctx.strokeStyle = '#77766d'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(256, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 256); ctx.stroke();
      for (let i = 0; i < 60; i++) { ctx.globalAlpha = rand() * 0.08; ctx.fillStyle = '#513d29'; ctx.fillRect(rand() * 256, rand() * 256, rand() * 50, 1); }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); tex.anisotropy = 4;
    return tex;
  }
  private groundPlane(w: number, d: number, x: number, z: number, mat: THREE.Material, y = 0): void {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    plane.rotation.x = -Math.PI / 2; plane.position.set(x, y, z); plane.receiveShadow = true;
    this.scene.add(plane);
  }
  private buildGround(): void {
    const soil = new THREE.MeshStandardMaterial({ map: this.texture('soil', 1600), roughness: 1 });
    this.groundPlane(16000, 16000, 0, 0, soil, -0.12);
    this.groundPlane(42, 35, 0, 5600, new THREE.MeshStandardMaterial({ map: this.texture('concrete', 3), roughness: 1 }), 0.04);
    this.sign('OBSERVACIÓN DEL LANZAMIENTO', 'DISTANCIA DE SEGURIDAD · 5,6 KM', -8, 2.2, 5590, 0, 8);
    const concrete = new THREE.MeshStandardMaterial({ map: this.texture('concrete', 7), roughness: 0.95 });
    this.groundPlane(132, 130, 0, 0, concrete, 0.01);
    const asphalt = new THREE.MeshStandardMaterial({ map: this.texture('asphalt', 15), roughness: 0.98 });
    const gravel = new THREE.MeshStandardMaterial({ map: this.texture('gravel', 50), roughness: 1 });
    // A clear north-south access road with three service-road junctions gives
    // the compressed launch complex a readable circulation pattern.
    this.groundPlane(24, 470, 0, 270, gravel, 0.015);
    this.groundPlane(16, 460, 0, 270, asphalt, 0.03);
    for (const [z, width] of [[150, 190], [235, 220], [355, 150]] as const) {
      this.groundPlane(width + 10, 22, 0, z, gravel, 0.02);
      this.groundPlane(width, 12, 0, z, asphalt, 0.04);
    }
    for (const offset of [-11, 11]) this.groundPlane(13, 1800, -220 + offset, -300, gravel, 0.02);
    const mark = this.material('road-line', 0xdacb9b);
    for (let z = 55; z < 500; z += 13) this.box(0.18, 0.015, 4.8, mark, 0, 0.07, z);
    for (const [z, width] of [[150, 190], [235, 220], [355, 150]] as const) {
      for (let x = -width / 2 + 10; x < width / 2; x += 13) this.box(4.8, 0.015, 0.18, mark, x, 0.07, z);
    }
    this.sign('CENTRO ESPACIAL KENNEDY', 'OPERACIONES TERRESTRES · 1969', -18, 2.2, 118, 0, 7);
    this.sign('PLATAFORMA 39A', 'ÁREA RESTRINGIDA · NO PASAR', -11, 1.9, 91, 0, 4.5);
  }
  private buildPad(): void {
    const steel = this.material('tower', 0x8f3c30, 0.64, 0.45);
    const dark = this.material('pad-dark', 0x41494b, 0.83, 0.35);
    const silver = this.material('galvanized', 0xa4aaa5, 0.58, 0.7);
    const cream = this.material('concrete', 0xc1bda9);
    this.box(48, 7.6, 42, dark, 0, 3.8, 0);
    this.box(46, 0.8, 40, silver, 0, 8, 0);
    this.box(24, 0.15, 20, this.material('scorch', 0x34312c), 0, 8.48, 0);
    this.box(72, 4, 82, cream, 0, 1.8, 0);
    const trench = this.material('trench', 0x3c3a36);
    this.box(14, 0.12, 120, trench, 0, 0.12, 5);
    const tx = -17, tz = -4;
    for (const x of [-6, 6]) for (const z of [-6, 6]) this.box(0.65, 115, 0.65, steel, tx + x, 65.5, tz + z);
    for (let y = 10; y <= 120; y += 8) {
      this.box(13, 0.32, 13, steel, tx, y, tz);
      for (const z of [-6, 6]) {
        this.beam(new THREE.Vector3(tx - 6, y, tz + z), new THREE.Vector3(tx + 6, y + 8, tz + z), 0.28, steel);
        this.beam(new THREE.Vector3(tx + 6, y, tz + z), new THREE.Vector3(tx - 6, y + 8, tz + z), 0.28, steel);
      }
      for (const x of [-6, 6]) {
        this.beam(new THREE.Vector3(tx + x, y, tz - 6), new THREE.Vector3(tx + x, y + 8, tz + 6), 0.28, steel);
      }
      this.box(4.2, 0.22, 11, silver, tx, y + 0.25, tz);
    }
    this.box(3.8, 113, 3.8, silver, tx - 1, 65, tz + 1);
    this.box(3.4, 111, 0.15, dark, tx - 1, 65, tz + 3);
    this.box(23, 1.1, 2, steel, tx + 5, 124, tz - 2);
    for (const y of [23, 40, 53, 67, 82, 94, 102]) {
      const arm = new THREE.Group(); arm.position.set(tx + 6, y, tz + 2);
      this.box(10.7, 0.65, 2.3, steel, 5.35, 0, 0, arm);
      this.box(10, 0.15, 2.5, silver, 5.3, 0.45, 0, arm);
      for (let i = 0; i < 5; i++) {
        this.beam(new THREE.Vector3(i * 2, 0, -1.1), new THREE.Vector3(i * 2 + 2, 1.6, -1.1), 0.14, steel, arm);
        this.box(0.11, 1.6, 0.11, steel, i * 2, 1.1, 1.1, arm);
      }
      this.scene.add(arm); this.arms.push(arm);
    }
    for (const x of [-37, 37]) {
      this.cylinder(1.1, 1.1, 27, silver, x, 13.5, -30);
      this.cylinder(2.1, 2.1, 0.6, silver, x, 27, -30);
      this.beam(new THREE.Vector3(x, 27, -30), new THREE.Vector3(x - Math.sign(x) * 8, 31, -30), 0.26, silver);
    }
    for (let i = 0; i < 8; i++) {
      this.beam(new THREE.Vector3(-42 + i * 0.55, 1.5, 42), new THREE.Vector3(-42 + i * 0.55, 1.5, -26), 0.28, silver);
    }
    this.fence(-80, 80, 91);
    for (const x of [-72, 72]) for (const z of [-65, 60]) {
      this.box(1.2, 45, 1.2, silver, x, 22.5, z);
      this.box(5, 0.35, 1.5, silver, x, 45, z);
      for (let i = 0; i < 3; i++) this.box(0.9, 0.9, 0.5, this.material('floodlight', 0xe9e6c9), x - 1.5 + i * 1.5, 44.6, z + 0.5);
    }
    this.sign('APOLLO 11', 'SATURN V · AS-506 · LC-39A', 22, 4, 47, 0, 11);
  }
  private buildSaturn(): void {
    const white = this.material('saturn-white', 0xf1f0e5, 0.46, 0.22);
    const black = this.material('saturn-black', 0x151a1e, 0.48, 0.25);
    const aluminum = this.material('rocket-aluminum', 0x9dabae, 0.28, 0.8);
    const nozzle = this.material('nozzle', 0x48484a, 0.43, 0.9);
    this.rocket.name = 'Saturn V AS-506 — original model — 110.6 metres';
    this.rocket.position.y = 8.5;
    this.scene.add(this.rocket);
    // Engine section (0–6), S-IC (6–42), interstage (42–47), S-II (47–69),
    // S-IVB + SLA (69–91), spacecraft + LES (91–110.6).
    this.cylinder(5.05, 5.05, 36, white, 0, 24, 0, this.rocket, 64);
    this.cylinder(5.05, 5.05, 5, black, 0, 44.5, 0, this.rocket, 64);
    this.cylinder(5.05, 5.05, 22, white, 0, 58, 0, this.rocket, 64);
    this.cylinder(3.3, 5.05, 4.5, white, 0, 71.25, 0, this.rocket, 64);
    this.cylinder(3.3, 3.3, 11.5, white, 0, 79.25, 0, this.rocket, 64);
    this.cylinder(2.1, 3.3, 6, white, 0, 88, 0, this.rocket, 48);
    this.cylinder(2, 2, 4, aluminum, 0, 93, 0, this.rocket, 48);
    this.cylinder(0.1, 2, 3.2, aluminum, 0, 96.6, 0, this.rocket, 48);
    this.cylinder(0.1, 0.22, 9.1, white, 0, 105.95, 0, this.rocket, 16);
    this.cylinder(0.5, 0.5, 3.2, white, 0, 102, 0, this.rocket, 16);
    this.cylinder(0.01, 0.13, 0.1, white, 0, 110.55, 0, this.rocket, 16);
    const bands = [6.6, 9.8, 12.2, 38.5, 41, 47.8, 50, 66.5, 68.7, 74.5, 83.7];
    for (const y of bands) this.cylinder(y > 70 ? 3.33 : 5.08, y > 70 ? 3.33 : 5.08, 0.19, aluminum, 0, y, 0, this.rocket, 64);
    // Roll-pattern panels follow cylinder curvature, rather than rectangular sticks.
    for (const [y, h, radius] of [[15, 13, 5.063], [39.3, 4, 5.063], [50, 5.5, 5.063], [79, 8, 3.312]]) {
      for (let i = 0; i < 4; i++) {
        const panel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 16, 1, true, i * Math.PI / 2, Math.PI / 5), black);
        panel.position.y = y; this.rocket.add(panel);
      }
    }
    // Corrugated tank/interstage details are shared merged cylinders.
    const ribs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = i / 80 * Math.PI * 2;
      for (const [y, h] of [[8, 3], [45, 4.5], [68, 1.5]]) {
        const g = new THREE.BoxGeometry(0.045, h, 0.05);
        const m = new THREE.Matrix4().makeRotationY(-angle);
        m.setPosition(Math.sin(angle) * 5.075, y, Math.cos(angle) * 5.075);
        g.applyMatrix4(m); ribs.push(g);
      }
    }
    const ribMesh = new THREE.Mesh(mergeGeometries(ribs)!, aluminum); this.rocket.add(ribMesh); ribs.forEach(g => g.dispose());
    for (const [x, z] of [[0, 0], [-2.9, -2.9], [-2.9, 2.9], [2.9, -2.9], [2.9, 2.9]]) {
      this.cylinder(0.78, 1.52, 3.8, nozzle, x, 2.9, z, this.rocket, 32);
      this.cylinder(1.57, 1.57, 0.16, aluminum, x, 1.02, z, this.rocket, 32);
      this.cylinder(0.7, 0.9, 2.8, aluminum, x, 5.2, z, this.rocket);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(1.6, 18, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9c22, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      flame.rotation.z = Math.PI; flame.position.set(x, -7.9, z); flame.visible = false;
      this.rocket.add(flame); this.flames.push(flame);
      const core = new THREE.Mesh(new THREE.ConeGeometry(1, 10, 12), new THREE.MeshBasicMaterial({ color: 0xfff8ce, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
      core.rotation.z = Math.PI; core.position.set(x, -3.9, z); core.visible = false;
      this.rocket.add(core); this.flames.push(core);
    }
    for (let i = 0; i < 4; i++) {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(3.5, 0); shape.lineTo(0, 6); shape.closePath();
      const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false }), aluminum);
      fin.position.set(Math.sin(i * Math.PI / 2) * 4.8, 4.5, Math.cos(i * Math.PI / 2) * 4.8);
      fin.rotation.y = i * Math.PI / 2 - Math.PI / 2; this.rocket.add(fin);
    }
    // Markings are original text canvases; no remote texture or protected model.
    for (const azimuth of [0, Math.PI]) {
      const label = this.textPlane('U S A', 2.8, 12, '#10191e', false);
      label.position.set(Math.sin(azimuth) * 5.1, 28, Math.cos(azimuth) * 5.1); label.rotation.y = azimuth; this.rocket.add(label);
      const flag = this.flag(); flag.position.set(0, 34.5, Math.cos(azimuth) * 5.11); flag.rotation.y = azimuth; this.rocket.add(flag);
    }
  }
  private flag(): THREE.Mesh {
    const c = document.createElement('canvas'); c.width = 190; c.height = 100;
    const x = c.getContext('2d')!;
    x.fillStyle = '#f5f1e8'; x.fillRect(0, 0, 190, 100);
    x.fillStyle = '#a13736'; for (let i = 0; i < 13; i += 2) x.fillRect(0, i * 100 / 13, 190, 100 / 13);
    x.fillStyle = '#25334f'; x.fillRect(0, 0, 77, 54);
    x.fillStyle = '#fff'; for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) x.fillRect(6 + k * 12, 5 + r * 10, 3, 3);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.32), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  }
  private buildBuildings(): void {
    const wall = this.material('building', 0xc2c2b7, 0.87);
    const roof = this.material('roof', 0x5f6e6d, 0.7, 0.3);
    const dark = this.material('windows', 0x3f6878, 0.3, 0.5);
    const vab = new THREE.Group(); vab.position.set(-1000, 0, -100);
    this.box(158, 160, 134, wall, 0, 80, 0, vab);
    this.box(160, 2, 136, roof, 0, 161, 0, vab);
    for (let i = 0; i < 6; i++) this.box(13, 130, 0.3, this.material('vab-door', 0x929e9f), -60 + i * 24, 65, 67.2, vab);
    for (let y = 4; y < 155; y += 4) this.box(158, 0.1, 0.2, roof, 0, y, 67.4, vab);
    const vabSub = this.textPlane('VEHICLE ASSEMBLY BUILDING', 105, 5, '#31434b', false); vabSub.position.set(0, 151, 67.5); vab.add(vabSub);
    const vabLod = new THREE.LOD();
    vab.position.set(0, 0, 0); this.mergeAuthored(vab);
    const distantVab = new THREE.Group();
    this.box(158, 160, 134, wall, 0, 80, 0, distantVab);
    this.box(160, 2, 136, roof, 0, 161, 0, distantVab);
    vabLod.addLevel(vab, 0); vabLod.addLevel(distantVab, 2300); vabLod.position.set(-1000, 0, -100); this.scene.add(vabLod);
    // Support buildings form solid closed shells: no doors/interiors are traversable.
    for (const [x, z, w, d, h] of [[-125, 200, 26, 21, 6], [116, 250, 22, 17, 5], [-118, 338, 28, 19, 6], [120, 130, 24, 17, 5]]) {
      this.box(w, h, d, wall, x, h / 2, z);
      this.box(w + 1, 0.35, d + 1, roof, x, h, z);
      this.colliders.push({ x, z, w: w / 2 + 0.7, d: d / 2 + 0.7 });
      for (let i = 0; i < 4; i++) this.box(2.7, 1.5, 0.12, dark, x - 8 + i * 5, 3, z + d / 2 + 0.1);
      this.box(2, 2.7, 0.13, roof, x, 1.4, z + d / 2 + 0.12);
      this.box(2, 1.3, 2, roof, x + 4, h + 0.7, z);
      this.cylinder(0.05, 0.05, 9, roof, x - 4, h + 4.5, z);
    }
    // Red/white weather mast and dish belong to support operations, not modern pad hardware.
    for (let i = 0; i < 7; i++) this.box(0.6, 2, 0.6, i % 2 ? wall : this.material('red', 0x9f3d32), 91, 1 + i * 2, 270);
    this.beam(new THREE.Vector3(91, 14, 270), new THREE.Vector3(91, 1, 277), 0.05, roof);
    this.fence(-150, -80, 325);
  }
  private buildStations(): void {
    this.station(-35, 130, 'ORIENTACIÓN', '01 · OPERACIONES DE APOYO', 'map');
    this.station(-70, 165, 'RECONOCIMIENTO', '02 · OBSERVACIÓN DEL COMPLEJO', 'camera');
    this.station(-100, 220, 'DOCUMENTACIÓN', '03 · REGISTRO DE COMUNICACIONES', 'desk');
    this.station(70, 235, 'COMUNICACIONES', '04 · ESTACIÓN DE APOYO', 'radio');
    this.station(-24, 170, 'LA TRIPULACIÓN', '05 · RECREACIÓN HISTÓRICA', 'crew');
    this.station(0, 355, 'OBSERVACIÓN', '06 · CÁMARA DE SEGUIMIENTO', 'camera');
    const steel = this.material('galvanized', 0xa4aaa5, 0.58, 0.7);
    // Deep-space style parabolic dish, original geometry; visual educational approximation.
    const g = new THREE.Group(); g.position.set(82, 0, 236);
    this.cylinder(0.6, 1, 7, steel, 0, 3.5, 0, g);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(4.8, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.43), this.material('dish', 0xd0d1c5, 0.6, 0.45));
    dish.rotation.z = 0.6; dish.position.y = 8; g.add(dish);
    this.beam(new THREE.Vector3(0, 8, 0), new THREE.Vector3(0, 12, 0), 0.1, steel, g);
    this.scene.add(g);
    this.colliders.push({ x: 82, z: 236, w: 3.8, d: 3.8 });
    // Tracking tripod at the spectator area is a distinct authored piece.
    for (let i = 0; i < 6; i++) this.colliders.push(buildBench(this.furniture, -22 + i * 9, 381, 0, 3.2, i % 2 === 0));
  }
  private buildBonusStations(): void {
    const atlas = this.standAtlas ??= createStandAtlas();
    BONUS_CHECKPOINTS.forEach((bonus, index) => {
      const { x, z } = bonus.target;
      const model = buildStandModel(bonus.kind, (name, color, roughness, metalness) => this.material(name, color, roughness, metalness), atlas, index);
      model.position.set(x, 0, z); this.addStaticModel(model);
      this.colliders.push(...standCollisionProxies(bonus.kind,x,z));
      const accent = new THREE.Mesh(new THREE.SphereGeometry(.10, 10, 6), new THREE.MeshBasicMaterial({ color: 0xc99550 }));
      accent.position.set(x + 1.82, 2.31, z - 1.10); this.scene.add(accent);
      this.bonusAccents.push({ mesh: accent, phase: index * 1.8, id: bonus.id });
    });
  }
  private station(x: number, z: number, title: string, subtitle: string, type: StationKind): void {
    const atlas = this.standAtlas ??= createStandAtlas();
    const kinds: Record<string, StandModelKind> = { map: 'orientation', camera: z > 300 ? 'tracking' : 'survey', desk: 'records', radio: 'radio', crew: 'crew' };
    const model = buildStandModel(kinds[type] ?? 'records', (name, color, roughness, metalness) => this.material(name, color, roughness, metalness), atlas, 0);
    model.position.set(x, 0, z); this.addStaticModel(model);
    this.colliders.push(...standCollisionProxies(kinds[type] ?? 'records',x,z));
    // Keep the existing authored mission names visible above the shared instrument kit.
    this.sign(title, subtitle, x + .1, 3.48, z - 1.25, 0, 4.5);
  }
  private fence(from: number, to: number, z: number): void {
    const metal = this.material('fence', 0x717b79, 0.8, 0.5);
    for (let x = from; x <= to; x += 6) {
      if (Math.abs(x) < 8) continue;
      this.box(0.1, 2.7, 0.1, metal, x, 1.35, z);
      for (const y of [0.35, 1.25, 2.3]) this.box(6, 0.04, 0.04, metal, x + 3, y, z);
      this.beam(new THREE.Vector3(x, 0.35, z), new THREE.Vector3(x + 6, 2.3, z), 0.025, metal);
    }
  }
  private sign(title: string, sub: string, x: number, y: number, z: number, rotation = 0, w = 6): void {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotation;
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, 1.25, .08), this.material('sign-back', 0x243331, .9, .05)); group.add(board);
    // Use a separate, rotated plane for the rear face. Rendering one plane
    // with DoubleSide would expose the same UVs from behind and mirror the
    // lettering instead of giving the player a readable sign.
    const front = this.textPlane(`${apolloText(title)}\n${apolloText(sub)}`, w - .12, 1.13, '#f2e8cb', true);
    front.position.z = .046;
    group.add(front);
    const rear = front.clone();
    rear.position.z = -.046;
    rear.rotation.y = Math.PI;
    group.add(rear);
    this.localizedSigns.push({ title, subtitle: sub, planes: [front, rear], width: w - .12 });
    this.box(0.08, y + 0.45, 0.08, this.material('sign-post', 0x697c78, 0.5, 0.6), -w * 0.36, -y / 2, -0.08, group);
    this.box(0.08, y + 0.45, 0.08, this.material('sign-post', 0x697c78, 0.5, 0.6), w * 0.36, -y / 2, -0.08, group);
    this.scene.add(group);
    const angle = Math.abs(rotation);
    const halfWidth = (w * Math.cos(angle) + .08 * Math.sin(angle)) / 2 + .12;
    const halfDepth = (w * Math.sin(angle) + .08 * Math.cos(angle)) / 2 + .12;
    // Player movement is resolved on the ground plane, so the whole sign
    // footprint is solid even though the board itself is elevated on posts.
    this.colliders.push({ x, z, w: halfWidth, d: halfDepth });
  }
  private textPlane(text: string, w: number, h: number, color: string, background: boolean): THREE.Mesh {
    const tex = this.textTexture(text, color, background);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: !background, side: THREE.FrontSide }));
  }
  private textTexture(text: string, color: string, background: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    if (background) { ctx.fillStyle = '#243d3d'; ctx.fillRect(0, 0, 1024, 256); ctx.strokeStyle = '#b8bc9d'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 1012, 244); }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((line, i) => { ctx.font = `${i ? 31 : 58}px Arial`; ctx.fillText(line, 512, lines.length > 1 ? 92 + i * 86 : 128, 940); });
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  private vehicle(x: number, z: number, crew = false): THREE.Group {
    const kind: CarKind = crew ? 'van' : (Math.abs(x) > 80 ? 'suv' : 'sedan');
    const decal = crew ? new THREE.TextureLoader().load('/icon-512.png') : undefined;
    const group = buildCar(CAR_SPECS[kind], { kind, paint: crew ? 0xd9d6bd : 0x687e7b, decal }, (name, color, roughness, metalness) => this.material(name, color, roughness, metalness));
    group.position.set(x, 0, z); this.scene.add(group); return group;
  }
  private buildVehicles(): void {
    this.van = this.vehicle(-17, 75, true);
    this.van.visible = false;
    for (const [x, z] of [[-88, 220], [90, 264], [-88, 345], [90, 139]]) {
      const kind: CarKind = Math.abs(x) > 80 ? 'suv' : 'sedan';
      const car = this.vehicle(x, z); car.rotation.y = Math.PI / 2;
      this.colliders.push({ x, z, w: CAR_SPECS[kind].length / 2 + .35, d: CAR_SPECS[kind].width / 2 + .35 });
    }
    // Crawler is parked off the active pad, consistent with launch operations.
    const crawler = new THREE.Group(); crawler.position.set(-235, 0, 52);
    const steel = this.material('crawler', 0x63746e, 0.75, 0.5);
    this.box(40, 4, 35, steel, 0, 5, 0, crawler);
    for (const x of [-15, 15]) for (const z of [-12, 12]) {
      this.box(8, 3.8, 8, this.material('crawler-track', 0x343e3c), x, 2, z, crawler);
      for (let i = 0; i < 9; i++) this.box(8.1, 0.08, 0.18, steel, x, 3.95, z - 3.5 + i * 0.85, crawler);
    }
    this.scene.add(crawler);
  }
  private buildServiceDetails():void {
    const grit=this.material('service-gravel',0x9d967e,.98,0);
    const curb=this.material('curb',0xb9b69d,.92,.08);
    const metal=this.material('utility-pipe',0x6d7d76,.65,.5);
    const stations=[[-35,130],[-70,165],[-100,220],[70,235],[-24,170],[0,355],...BONUS_CHECKPOINTS.map(stand=>[stand.target.x,stand.target.z])];
    const path = this.material('service-walkway',0xb8b49e,.96);
    for(const [x,z] of stations) {
      this.groundPlane(10,8,x,z,grit,-.015);
      // Connect every work area to the nearest authored road instead of stranding
      // technical benches in the sand. The front of every bench stays open.
      const cross=[150,235,355].reduce((nearest,candidate)=>Math.abs(z-candidate)<Math.abs(z-nearest)?candidate:nearest,150);
      if(Math.abs(x)-8<Math.abs(z-cross)-6) {
        const end=Math.sign(x)*9,span=Math.abs(x-end);
        if(span>6)this.groundPlane(span,2.1,(x+end)/2,z+2.5,path,.025);
      }else{
        const end=cross+Math.sign(z-cross)*7,span=Math.abs(z-end);
        if(span>4)this.groundPlane(2.1,span,x+3.3,(z+end)/2,path,.025);
      }
      for(const dx of [-5.1,5.1])this.box(.16,.15,8.3,curb,x+dx,.07,z);
      this.box(10.3,.15,.16,curb,x,.07,z-4.1);
      // Low cable tray and conduit follow the back of the station; approach stays open.
      this.box(7,.09,.28,metal,x,.14,z-3.5);
      for(let i=0;i<18;i++)this.box(.025,.08,.26,curb,x-3.3+i*.39,.16,z-3.5);
      this.cylinder(.29, .29, .88, metal, x + 4.3, .48, z - 2.6);
    }
    // Low drainage aprons and pipe work give the service buildings a functional edge.
    for(const [x,z,depth]of[[-125,200,21],[116,250,17],[-118,338,19],[120,130,17]]) {
      this.box(25,.12,3,grit,x,.015,z+12);
      for(let i=0;i<4;i++)this.box(.08,.09,2.8,metal,x-11+i*.4,.13,z+12);
      this.box(4,.55,.75,metal,x+8,.3,z-10);
      for(let i=0;i<10;i++)this.box(.12,.6,.8,curb,x+6.1+i*.4,.31,z-10);
      // Rain hood, recessed entrance and horizontal window mullions establish
      // the service-building scale without more imported assets.
      const glass=this.material('service-window-glass',0x344b50,.25,.25);
      const ivory=this.material('service-building-trim',0xc4c6b4,.7,.12);
      this.box(3.1,.14,1.8,metal,x,3.02,z+depth/2+.8);
      for(const dx of[-1.14,1.14])this.box(.12,2.6,.16,ivory,x+dx,1.46,z+depth/2+.18);
      for(let i=0;i<4;i++) {
        this.box(2.5,1.2,.06,glass,x-8+i*5,2.93,z+depth/2+.19);
        this.box(2.6,.065,.075,ivory,x-8+i*5,2.93,z+depth/2+.23);
        this.box(.065,1.25,.075,ivory,x-8+i*5,2.93,z+depth/2+.23);
      }
    }
  }
  private buildClouds(): void {
    // The old version used one radial smoke stamp per cloud, which read as a
    // ring of white circles. A cloud bank is now made from broad, irregular
    // silhouettes with a darker underside and a few offset layers for depth.
    const textures = [0, 1, 2, 3].map(seed => createCloudTexture(seed));
    const materials = textures.map(texture => new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0.74, depthWrite: false, side: THREE.DoubleSide,
    }));
    let seed = 1847;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 18; i++) {
      const angle = i * 2.399 + random() * 0.28;
      const distance = 1550 + i * 112 + random() * 420;
      const bank = new THREE.Group();
      bank.position.set(Math.sin(angle) * distance, 520 + random() * 210, Math.cos(angle) * distance);
      bank.rotation.y = angle;
      const width = 460 + random() * 260;
      const height = 100 + random() * 55;
      for (let layer = 0; layer < 2; layer++) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materials[(i + layer) % materials.length]);
        mesh.position.set((random() - 0.5) * width * 0.24, (layer - 1) * 18, (layer - 1) * 16);
        mesh.rotation.y = (random() - 0.5) * 0.12;
        mesh.scale.set(width * (1 - layer * 0.11), height * (1 - layer * 0.08), 1);
        mesh.renderOrder = -2 + layer;
        bank.add(mesh);
      }
      this.cloudSprites.add(bank);
    }
    this.scene.add(this.cloudSprites);
  }
  private buildMarker(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xecd89e, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.6, 48), mat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; this.target.add(ring);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), mat); diamond.position.y = 4; this.target.add(diamond);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), new THREE.MeshBasicMaterial({ color: 0xf0daa3, transparent: true, opacity: 0.35 })); beam.position.y = 2; this.target.add(beam);
    this.target.visible = false; this.scene.add(this.target);
  }
  private async loadAstronauts(): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    try {
      const gltf = await loader.loadAsync('/assets/apollo/mercenary-astronaut.glb');
      if (this.disposed) { this.disposeObject(gltf.scene); return; }
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const size = bounds.getSize(new THREE.Vector3());
      this.loadedModel = { source: 'Peter_D / Mercenary Astronaut / CC BY 4.0', url: '/assets/apollo/mercenary-astronaut.glb', originalBounds: size.toArray(), clips: gltf.animations.map(c => ({ name: c.name, duration: c.duration })), characterHeight: 1.85, skeletonClones: 4 };
      // Sketchfab asset root contains non-character equipment meshes. Keep the authored
      // suit but hide detached crate/backpack display objects to preserve human bounds.
      const standardMaterials = new Map<THREE.Material, THREE.Material>();
      gltf.scene.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true; node.receiveShadow = true;
          node.frustumCulled = false;
          const association = gltf.parser.associations.get(node);
          const sourceName = association?.meshes !== undefined ? gltf.parser.json.meshes[association.meshes]?.name ?? node.name : node.name;
          node.userData.authorMeshName = sourceName;
          if (/crate|backpack_cargo/i.test(sourceName)) node.visible = false;
          const materials = (Array.isArray(node.material) ? node.material : [node.material]).map(original => {
            if (standardMaterials.has(original)) return standardMaterials.get(original)!;
            if (!(original instanceof THREE.MeshStandardMaterial)) return original;
            const material = new THREE.MeshStandardMaterial({ name: original.name, color: original.color, map: original.map, normalMap: original.normalMap, roughnessMap: original.roughnessMap, metalnessMap: original.metalnessMap, roughness: Math.max(0.6, original.roughness), metalness: original.metalness, transparent: original.transparent, opacity: original.opacity, alphaTest: original.alphaTest, side: original.side });
            material.normalScale.copy(original.normalScale);
            standardMaterials.set(original, material); return material;
          });
          node.material = Array.isArray(node.material) ? materials : materials[0];
        }
      });
      // Box3.setFromObject uses SkinnedMesh bounds after bone transforms. Raw
      // geometry bounds omit the FBX bone-scale correction (100x in this asset).
      const activeBounds = bounds;
      const height = activeBounds.getSize(new THREE.Vector3()).y;
      const scale = 1.85 / Math.max(height, 0.01);
      for (let i = 0; i < 4; i++) {
        const model = clone(gltf.scene);
        const holder = i === 0 ? this.playerRoot : new THREE.Group();
        model.scale.multiplyScalar(scale);
        model.position.set(-activeBounds.getCenter(new THREE.Vector3()).x * scale, -activeBounds.min.y * scale, -activeBounds.getCenter(new THREE.Vector3()).z * scale);
        holder.add(model);
        if (i) {
          const name = ['Neil Armstrong', 'Michael Collins', 'Buzz Aldrin'][i - 1];
          const label = this.textPlane(name, 2.2, 0.35, '#fff4d8', true); label.position.set(0, 2.45, 0); holder.add(label);
          holder.position.set(-10 + i * 2.2, 0, 76 + i * 2.2); holder.rotation.y = Math.PI;
          this.crewRoot.add(holder); this.crew.push(holder);
        }
        const mixer = new THREE.AnimationMixer(model);
        const walking = gltf.animations.find(c => /walk/i.test(c.name));
        const idling = gltf.animations.find(c => /idle/i.test(c.name));
        const running = gltf.animations.find(c => /run/i.test(c.name));
        const jumping = gltf.animations.find(c => /jump|fall|airborne/i.test(c.name));
        const walk = walking ? mixer.clipAction(walking).setEffectiveWeight(i ? 1 : 0).play() : null;
        const idle = idling ? mixer.clipAction(idling).setEffectiveWeight(i ? 0 : 1).play() : null;
        const run = running ? mixer.clipAction(running).setEffectiveWeight(0).play() : null;
        const jump = jumping ? mixer.clipAction(jumping).setEffectiveWeight(0) : null;
        if (jump) { jump.setLoop(THREE.LoopOnce, 1); jump.clampWhenFinished = true; }
        if (walk) walk.time = i * 0.35;
        this.people.push({ root: holder, mixer, walk, idle, run, jump }); this.mixers.push(mixer);
      }
      this.crewRoot.visible = false;
      // Ambient technical staff use a cheap authored period-uniform rig, not a fifth
      // high-poly clone. They remain silhouettes appropriate to support operations.
      for (const [x, z] of [[-73, 163], [-103, 219], [72, 237], [-16, 350]]) this.addTechnician(x, z);
      this.flushStatic();
    } catch (error) {
      this.assetErrors.push(`Mercenary Astronaut: ${String(error)}`);
      // Failure remains visible in diagnostics. A local authored suit preserves play.
      this.addFallbackSuit(this.playerRoot);
      for (let i = 0; i < 3; i++) { const root = new THREE.Group(); this.addFallbackSuit(root); this.crewRoot.add(root); this.crew.push(root); }
      this.crewRoot.visible = false;
    }
  }
  private addTechnician(x: number, z: number): void {
    const shirt=this.material('technician-shirt',0xd9d4bd,.96,0),pants=this.material('technician-pants',0x42585f,.94,0),skin=this.material('skin',0xb98e67,.85,0),shoe=this.material('worker-shoe',0x303a35,.8,.05);
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(.25,.22,.6,8),shirt);torso.position.set(x,1.19,z);torso.scale.z=.65;this.addStatic(torso);
    this.box(.42,.08,.28,this.material('worker-belt',0x4b4d3e),x,.91,z);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.15,12,10),skin);head.scale.set(1,1.2,.93);head.position.set(x,1.69,z);this.addStatic(head);
    this.cylinder(.074,.074,.13,skin,x,1.48,z);
    // Period work cap, brim and face cues preserve a human silhouette at station range.
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.16,12,6,0,Math.PI*2,0,Math.PI*.51),shirt);cap.position.set(x,1.77,z);this.addStatic(cap);
    this.box(.27,.025,.15,shirt,x,1.77,z+.13);
    for(const dx of [-.052,.052])this.box(.022,.016,.009,shoe,x+dx,1.71,z+.137);
    this.box(.13,.1,.012,shirt,x-.11,1.27,z+.168);this.box(.07,.028,.013,this.material('worker-badge',0x718b8d),x-.11,1.29,z+.18);
    for(const dx of [-.115,.115]) {
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(.095,.084,.42,8),pants);thigh.position.set(x+dx,.69,z);this.addStatic(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(.083,.069,.43,8),pants);shin.position.set(x+dx,.29,z);this.addStatic(shin);
      this.box(.16,.12,.29,shoe,x+dx,.07,z+.055);
    }
    // Articulated upper arm/forearm segments instead of a box-person stand-in.
    for(const side of [-1,1]) {
      this.beam(new THREE.Vector3(x+side*.24,1.37,z),new THREE.Vector3(x+side*.32,1.09,z+.025),.12,shirt);
      this.beam(new THREE.Vector3(x+side*.32,1.09,z+.025),new THREE.Vector3(x+side*.29,.96,z+.21),.09,skin);
      const hand=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),skin);hand.position.set(x+side*.29,.95,z+.21);hand.scale.y=1.3;this.addStatic(hand);
    }
  }
  private addFallbackSuit(root: THREE.Group): void {
    const suit = this.material('fallback-suit', 0xd9d8c6);
    this.box(0.6, 0.8, 0.38, suit, 0, 1.05, 0, root);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), this.material('helmet', 0xd7d8ce)); head.position.y = 1.73; root.add(head);
    for (const x of [-0.18, 0.18]) this.box(0.22, 0.72, 0.25, suit, x, 0.38, 0, root);
    this.box(0.38, 0.22, 0.15, this.material('visor', 0x3c5b62, 0.2, 0.6), 0, 1.76, -0.22, root);
  }
  setTarget(position: { x: number; z: number } | null): void {
    this.targetPoint = position; this.target.visible = !!position && !this.mode;
    if (position) this.target.position.set(position.x, 0, position.z);
  }
  setBonusStatus(completed: readonly string[], active?: string): void {
    const done = new Set(completed);
    this.bonusAccents.forEach(({ mesh, id }) => {
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(done.has(id) ? 0x9bc79f : id === active ? 0xf0b45e : 0x536863);
      mesh.userData.active = id === active;
      mesh.userData.completed = done.has(id);
    });
  }
  nearbyBonus(): { id: string; title: string; objective: string; distance: number } | null {
    let nearest: { bonus: ApolloBonusCheckpoint; distance: number } | null = null;
    for (const bonus of BONUS_CHECKPOINTS) {
      const distance = Math.hypot(this.player.x - bonus.target.x, this.player.z - bonus.target.z);
      if (distance <= 11 && (!nearest || distance < nearest.distance)) nearest = { bonus, distance };
    }
    return nearest ? { ...nearest.bonus, distance: nearest.distance } : null;
  }
  setStationStatus(_completed:string[],_active:string):void { /* station furniture is static; minigame state remains in ApolloScreen. */ }
  setInspectionTarget(kind:'rocket'|'tower'|'vab'|null):void { this.inspectionTarget=kind; }
  setStandFocus(target: { x: number; z: number } | null): void { this.standFocus = target; }
  projectDestination(target: {x:number;z:number}): {x:number;y:number;behind:boolean} {
    this.navProjection.set(target.x,2.4,target.z).project(this.camera);
    return {x:this.navProjection.x,y:this.navProjection.y,behind:this.navProjection.z>1};
  }
  setZoom(value: boolean): void { this.zoomed = value; }
  setSuspended(value: boolean): void { this.suspended = value; if (value) this.keys.clear(); }
  setQuality(value: ApolloQuality): void {
    this.quality = value;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, { low: 1, medium: 1.35, high: 1.75 }[value]));
    this.renderer.shadowMap.enabled = value !== 'low';
    this.renderer.shadowMap.needsUpdate = true;
    const size = value === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(size, size); }
    this.smokeCount = { low: 35, medium: 65, high: 100 }[value];
    if (this.smoke) this.smoke.count = this.smokeCount;
    this.resize();
  }
  setCinematic(mode: Mode, elapsedSeconds: number): void {
    if (mode !== this.mode) {
      this.mode = mode;
      this.keys.clear();
      this.crewRoot.visible = mode === 'crew'; this.van.visible = mode === 'crew';
      this.playerRoot.visible = mode === null;
      this.target.visible = !mode && !!this.targetPoint;
    }
    this.cinematicElapsed = Math.max(0, elapsedSeconds);
    this.arms.forEach((arm, i) => { if (i === this.arms.length - 1) arm.rotation.y = mode === 'crew' ? 0 : -Math.PI * 0.68; });
  }
  /** Diagonal movement is normalized; axis-separated capsule/AABB sweep prevents
   * moving through closed buildings, props or the fenced 39A exclusion circle. */
  private canMove(x: number, z: number): boolean {
    if (this.player.z > 5000) return x >= -30 && x <= 30 && z >= 5560 && z <= 5640;
    if (x < -145 || x > 150 || z < 100 || z > 405 || Math.hypot(x, z) < 95) return false;
    return !this.colliders.some(c => Math.abs(x - c.x) < c.w + 0.4 && Math.abs(z - c.z) < c.d + 0.4);
  }
  private move(dt: number): boolean {
    if (this.suspended || this.mode) return false;
    let forward = Number(this.keys.has('w') || this.keys.has('arrowup')) - Number(this.keys.has('s') || this.keys.has('arrowdown'));
    let right = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    if (!forward && !right) return false;
    const norm = Math.hypot(forward, right); forward /= norm; right /= norm;
    const speed = this.keys.has('shift') ? 10 : 5.2;
    const dx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * speed * dt;
    const dz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * speed * dt;
    // Substeps cap wall crossings even after a slow frame.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.25));
    for (let i = 0; i < steps; i++) { if (this.canMove(this.player.x + dx / steps, this.player.z)) this.player.x += dx / steps; if (this.canMove(this.player.x, this.player.z + dz / steps)) this.player.z += dz / steps; }
    // Face the actual displacement vector, not the input axes, so camera
    // relative movement and the walk animation always agree visually.
    this.playerRoot.rotation.y = Math.atan2(dx, dz);
    return true;
  }
  update(dt: number): void {
    if (this.disposed) return;
    const cameraNow = performance.now(), cameraDt = Math.min(.05, Math.max(0, (cameraNow-this.lastCameraUpdate)/1000)); this.lastCameraUpdate=cameraNow;
    if (dt > 0) { this.frameDurations.push(dt * 1000); if (this.frameDurations.length > 300) this.frameDurations.shift(); }
    dt = Math.min(Math.max(dt, 0), 0.05); this.clock += dt;
    this.cloudSprites.position.x += dt * .8;
    this.bonusAccents.forEach(({ mesh, phase }) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 1;
      mesh.scale.setScalar(mesh.userData.active ? 1 + Math.sin(this.clock * 2 + phase) * .08 : 1);
    });
    const moving = this.move(dt);
    if (!this.suspended && !this.mode && this.keys.has(' ') && this.grounded) {
      this.verticalVelocity = 6.4; this.grounded = false; this.keys.delete(' ');
      const jump = this.people[0]?.jump;
      jump?.reset().setEffectiveWeight(1).play();
    }
    if (!this.grounded) {
      this.verticalVelocity -= 18 * dt;
      this.player.y = Math.max(0, this.player.y + this.verticalVelocity * dt);
      if (this.player.y === 0) {
        this.verticalVelocity = 0; this.grounded = true;
        this.people[0]?.jump?.stop().setEffectiveWeight(0);
      }
    }
    this.playerRoot.position.copy(this.player);
    // The observation site is genuinely 5.6 km away: keep humid distance haze
    // subtle enough for the long lens instead of hiding the rocket in dense fog.
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.player.z > 5000 || this.mode === 'launch' ? 0.00004 : 0.00038;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      const airborne = i === 0 && !this.grounded;
      const walking = i === 0 ? moving : this.mode === 'crew';
      const running = i === 0 && walking && this.keys.has('shift');
      p.walk?.setEffectiveWeight(!airborne && walking && !running ? 1 : 0);
      p.run?.setEffectiveWeight(!airborne && running ? 1 : 0);
      p.idle?.setEffectiveWeight(!airborne && !walking ? 1 : 0);
      if (!p.jump || !airborne) p.jump?.setEffectiveWeight(0);
      if (i === 0 || this.mode === 'crew') p.mixer.update(dt);
    }
    if (this.target.visible) { this.target.children[1].rotation.y += dt; this.target.children[1].position.y = 3.8 + Math.sin(this.clock * 2) * 0.22; }
    if (this.mode === 'intro') this.introCamera(this.cinematicElapsed);
    else if (this.mode === 'crew') this.crewCamera(this.cinematicElapsed);
    else if (this.mode === 'launch') this.launchCamera(this.cinematicElapsed);
    else if(this.inspectionTarget) {
      this.camera.position.set(this.player.x,2.15,this.player.z);
      this.inspectionPosition.set(this.inspectionTarget==='vab'?-1000:this.inspectionTarget==='tower'?-17:0,this.inspectionTarget==='vab'?81:65,this.inspectionTarget==='vab'?-100:0);
      this.camera.lookAt(this.inspectionPosition);this.camera.fov=this.inspectionTarget==='vab'?18:35;this.camera.updateProjectionMatrix();
    } else if (this.standFocus) {
      const {x,z}=this.standFocus,blend=1-Math.exp(-cameraDt*5);
      this.cameraGoal.set(x+3.7,3.1,z+5.4); this.lookGoal.set(x,1.4,z-.15);
      this.camera.position.lerp(this.cameraGoal,blend);this.cameraLook.lerp(this.lookGoal,blend);this.camera.lookAt(this.cameraLook);
      this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,48,blend);this.camera.updateProjectionMatrix();
    } else {
      const followDistance = 5.8;
      this.cameraGoal.set(this.player.x + Math.sin(this.yaw) * followDistance, this.player.y + 3.35 + this.pitch * 0.9, this.player.z + Math.cos(this.yaw) * followDistance);
      this.lookGoal.set(this.player.x - Math.sin(this.yaw) * 6.3, this.player.y + 1.4 + this.pitch * 3, this.player.z - Math.cos(this.yaw) * 6.3);
      this.cameraLook.lerp(this.lookGoal,1-Math.exp(-cameraDt*9));
      this.camera.position.lerp(this.cameraGoal, 1 - Math.exp(-cameraDt * 7)); this.camera.lookAt(this.cameraLook);
      if (this.player.z > 5000) { this.camera.position.set(this.player.x, 5, this.player.z); this.camera.lookAt(0, 64, 0); }
      this.camera.fov = this.player.z > 5000 ? 3.4 : this.zoomed ? 22 : 62; this.camera.updateProjectionMatrix();
    }
    // Static support furniture does not need a full shadow pass every frame.
    // Moving characters, jumps and cinematics keep their shadows live.
    this.shadowAge += dt;
    if (moving || !this.grounded || this.mode || this.shadowAge > .16 || !this.sun.shadow.map) {
      this.renderer.shadowMap.needsUpdate = true; this.shadowAge = 0;
    }
    this.renderer.render(this.scene, this.camera);
  }
  private introCamera(t: number): void {
    if (t < 10) {
      const p = t / 10;
      this.camera.position.set(1500 - p * 1000, 180 - p * 60, 800 - p * 470); this.cameraLook.set(0, 50, 0);
    } else if (t < 25) {
      const p = (t - 10) / 15;
      this.camera.position.set(500 - p * 420, 120 - p * 35, 330 - p * 110); this.cameraLook.set(0, 64, 0);
    } else {
      const p = clamp((t - 25) / 11, 0, 1);
      this.camera.position.set(-80 + p * 50, 85 - p * 77, 220 - p * 80); this.cameraLook.set(-10, 50 - p * 40, 70 + p * 30);
    }
    this.camera.lookAt(this.cameraLook);
  }
  private crewCamera(t: number): void {
    const p = clamp(t / 24, 0, 1);
    this.crew.forEach((root, i) => { root.position.set(-8 + i * 2, 0, 77 - p * 48 + i * 2); root.rotation.y = Math.PI; });
    this.van.position.set(-16, 0, 76 - p * 44);
    if (t < 7) {
      this.camera.position.set(5, 3.1, 65 - p * 48);
      this.cameraLook.set(-5, 1.8, 77 - p * 48);
    } else if (t < 17) {
      this.camera.position.set(20, 4.2, 86 - p * 48);
      this.cameraLook.set(-5, 8, 64 - p * 48);
    } else {
      this.camera.position.set(73, 39, 130);
      this.cameraLook.set(0, 52, 0);
    }
    this.camera.fov = 62; this.camera.updateProjectionMatrix(); this.camera.lookAt(this.cameraLook);
    this.crew.forEach(root => root.children[1]?.lookAt(this.camera.position));
  }
  private launchCamera(t: number): void {
    const after = Math.max(0, t - 10);
    const height = after * after * 0.9;
    this.rocket.position.y = 8.5 + height;
    const ignition = clamp((t - 1) / 7, 0, 1);
    this.flames.forEach((f, i) => { f.visible = ignition > 0; f.scale.set(0.8 + ignition * 0.2, ignition * (0.9 + Math.sin(t * 35 + i) * 0.1), 0.8 + ignition * 0.2); });
    this.exhaustLight.intensity = ignition * 90; this.exhaustLight.position.y = 10 + height;
    this.arms.forEach((a, i) => { a.rotation.y = i === this.arms.length - 1 ? -Math.PI * 0.68 : -clamp((t - 10) / 1.5, 0, 1) * Math.PI * 0.68; });
    this.smoke.visible = ignition > 0;
    if (ignition > 0) {
      for (let i = 0; i < this.smokeCount; i++) {
        const age = ((t * 0.16 + i / this.smokeCount) % 1);
        const a = i * 2.399;
        const spread = age * 110 * ignition;
        this.dummy.position.set(Math.sin(a) * spread, 2 + age * 20 + Math.min(height * 0.5, age * 80), Math.cos(a) * spread * 0.65);
        const scale = (3 + age * 15) * ignition;
        this.dummy.scale.set(scale*1.35, scale, 1);this.dummy.quaternion.copy(this.camera.quaternion);this.dummy.rotateZ(a+age*.3);this.dummy.updateMatrix();this.smoke.setMatrixAt(i,this.dummy.matrix);
      }
      this.smoke.instanceMatrix.needsUpdate = true;
    }
    const shake = t > 2 && t < 22 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.sin(t * 36) * 0.07 * ignition : 0;
    if (t < 3) { this.camera.position.set(95, 44, 160); this.cameraLook.set(0, 60, 0); }
    else if (t < 6.5) { this.camera.position.set(23, 12, 38); this.cameraLook.set(0, 15, 0); }
    else if (t < 9) { this.camera.position.set(-41, 92, 52); this.cameraLook.set(0, 83, 0); }
    else if (t < 18) { this.camera.position.set(0 + shake, 5 + shake, 5600); this.camera.fov = 3.4; this.camera.updateProjectionMatrix(); this.cameraLook.set(0, 63 + height, 0); }
    else { this.camera.position.set(180 + after * 4, 80 + height * 0.45, 350 + after * 8); this.cameraLook.set(0, 58 + height, 0); }
    if (t < 9 || t >= 18) { this.camera.fov = 62; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(this.cameraLook);
  }
  resize(): void {
    if (!this.renderer || this.disposed) return;
    const w = Math.max(this.host.clientWidth, 1), h = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  diagnostics(): Record<string, unknown> {
    const info = this.renderer.info;
    const times = [...this.frameDurations].sort((a, b) => a - b);
    return { engine: 'Three.js', player: this.player.toArray(), yaw: this.yaw, quality: this.quality, drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, pixelRatio: this.renderer.getPixelRatio(), shadowMap: this.renderer.shadowMap.enabled ? this.sun.shadow.mapSize.x : 0, shadowLights: this.renderer.shadowMap.enabled ? 1 : 0, samples: times.length, meanFrameMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0, p95FrameMs: times[Math.floor(times.length * 0.95)] ?? 0, rocketHeightMeters: 110.6, colliders: this.colliders.length, launchY: this.rocket.position.y, crew: this.crew.length, loadedModel: { ...this.loadedModel, playerBounds: new THREE.Box3().setFromObject(this.playerRoot).getSize(new THREE.Vector3()).toArray(), modelScale: this.playerRoot.children[0]?.scale.toArray() }, assetErrors: [...this.assetErrors], originalProps:true, softSmoke:true, stationIndicators:0 };
  }
  private onKeyDown = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement)?.closest('input,textarea,select,button')) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(key)) { if (!this.suspended && !this.mode) this.keys.add(key); event.preventDefault(); }
    if (key === 'e' && !event.repeat && !this.suspended && !this.mode) this.callbacks.onInteract();
    if (key === 'm' && !event.repeat && !this.mode) this.callbacks.onMap();
  };
  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.key.toLowerCase()); };
  private onBlur = (): void => { this.keys.clear(); this.lastPointer = null; };
  private onPointerDown = (event: PointerEvent): void => { if (this.suspended || this.mode) return; this.lastPointer = { x: event.clientX, y: event.clientY }; this.renderer.domElement.setPointerCapture(event.pointerId); };
  private onPointerMove = (event: PointerEvent): void => {
    if (!this.lastPointer || this.suspended || this.mode) return;
    this.yaw -= (event.clientX - this.lastPointer.x) * 0.004;
    // Screen-up drag should look up. The wider range makes it possible to
    // follow the full Saturn V stack without allowing an upside-down view.
    this.pitch = clamp(this.pitch - (event.clientY - this.lastPointer.y) * 0.004, -0.65, 1.8);
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };
  private onPointerUp = (): void => { this.lastPointer = null; };
  private disposeObject(root: THREE.Object3D): void {
    const geoms = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    root.traverse(node => { if (node instanceof THREE.Mesh) { geoms.add(node.geometry); for (const mat of Array.isArray(node.material) ? node.material : [node.material]) { mats.add(mat); for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value); } } });
    geoms.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  }
  dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('blur', this.onBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown); this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove); this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp); this.renderer.domElement.removeEventListener('pointercancel', this.onPointerUp);
    this.mixers.forEach(m => m.stopAllAction());
    this.disposeObject(this.scene); this.sun.shadow.map?.dispose();
    this.environmentTarget?.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

function createSmokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255,255,255,.9)'); gradient.addColorStop(.55, 'rgba(245,243,236,.5)'); gradient.addColorStop(1, 'rgba(230,228,218,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function createCloudTexture(seed: number): THREE.CanvasTexture {
  const width = 512, height = 256;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const lobes = [
    { x: 0.12 + seed * 0.01, y: 0.54, w: 0.24, h: 0.30, strength: 0.72 },
    { x: 0.31 + seed * 0.013, y: 0.43, w: 0.28, h: 0.42, strength: 0.94 },
    { x: 0.53 + seed * 0.009, y: 0.36, w: 0.25, h: 0.48, strength: 0.9 },
    { x: 0.74 + seed * 0.011, y: 0.46, w: 0.31, h: 0.36, strength: 0.82 },
    { x: 0.91 + seed * 0.007, y: 0.58, w: 0.22, h: 0.25, strength: 0.62 },
  ];
  const noise = (x: number, y: number) => (
    Math.sin(x * 17.3 + seed * 3.1) * 0.45 + Math.sin(y * 23.7 - seed * 1.7) * 0.3 + Math.sin((x + y) * 41.1 + seed) * 0.25
  );
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = x / width, ny = y / height;
    let density = 0;
    for (const lobe of lobes) {
      const dx = (nx - ((lobe.x % 1) + 1) % 1) / lobe.w;
      const dy = (ny - lobe.y) / lobe.h;
      density = Math.max(density, Math.max(0, 1 - Math.hypot(dx, dy)) * lobe.strength);
    }
    // A wide, uneven shelf joins the puffs into a cloud bank instead of dots.
    const shelf = Math.max(0, 1 - Math.abs(ny - 0.67) / 0.23) * (0.52 + noise(nx, ny) * 0.12);
    density = Math.max(density, shelf);
    density *= Math.min(1, nx * 12, (1 - nx) * 12, ny * 16, (1 - ny) * 9);
    density = Math.max(0, Math.min(1, density + noise(nx, ny) * 0.08));
    const underside = Math.max(0, Math.min(1, (ny - 0.39) * 1.5));
    const shade = 248 - underside * 54;
    const index = (y * width + x) * 4;
    image.data[index] = shade;
    image.data[index + 1] = shade + 2;
    image.data[index + 2] = shade + 1;
    image.data[index + 3] = Math.round(density * 215);
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}
