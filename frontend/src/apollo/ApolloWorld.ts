import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { txt, world, type Txt } from './ApolloCopy';

export type ApolloQuality = 'low' | 'medium' | 'high';
type Mode = 'intro' | 'crew' | 'launch' | null;
type Collider = { x: number; z: number; w: number; d: number };
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

/** All positions are metres. The traversable support route is deliberately compressed;
 * the 110.6 m Saturn V, its tower, vehicles and people keep a common physical scale. */
export class ApolloWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.15, 12500);
  readonly renderer: THREE.WebGLRenderer;
  readonly player = new THREE.Vector3(-35, 0, 130);
  readonly ready: Promise<void>;
  readonly assetErrors: string[] = [];
  yaw = 0;
  private pitch = 0.28;
  private zoomed = false;
  /** Jump: vertical velocity (m/s) and a queued Space press, consumed when the player is on the ground. */
  private vy = 0;
  private jumpQueued = false;
  /** The Mercenary Astronaut GLB faces +Z; the procedural fallback suit faces -Z. */
  private facingOffset = Math.PI;
  private keys = new Set<string>();
  private suspended = false;
  private disposed = false;
  private quality: ApolloQuality = 'medium';
  private mode: Mode = null;
  private cinematicElapsed = 0;
  private clock = 0;
  /** Repaint callbacks for every text sign, so 3D lettering follows the selected language. */
  private textRepaints: Array<() => void> = [];
  private playerRoot = new THREE.Group();
  private crewRoot = new THREE.Group();
  private rocket = new THREE.Group();
  private van = new THREE.Group();
  private arms: THREE.Group[] = [];
  private crew: THREE.Group[] = [];
  private people: { root: THREE.Group; mixer: THREE.AnimationMixer; walk: THREE.AnimationAction | null; idle: THREE.AnimationAction | null; run: THREE.AnimationAction | null }[] = [];
  /** Smoothed blend weights of the player's idle / walk / run(+jump) animations. */
  private animWeights = { idle: 1, walk: 0, run: 0 };
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
  private lastPointer: { x: number; y: number } | null = null;
  private loadedModel: Record<string, unknown> = {};
  private staticBuffers: Map<THREE.Material, THREE.BufferGeometry[]> = new Map();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private resizeObserver: ResizeObserver;
  private frameDurations: number[] = [];
  private palmLeaves: THREE.InstancedMesh | null = null;

  constructor(private host: HTMLElement, private callbacks: { onInteract: () => void; onMap: () => void }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.domElement.className = 'apollo-world-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Centro Espacial Kennedy en 1969. Escenario 3D de Apollo 11.');
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x9dcce7);
    this.scene.fog = new THREE.FogExp2(0xb9d4dc, 0.00038);
    this.scene.add(new THREE.HemisphereLight(0xc7e6ff, 0x66734b, 1.7));
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
    this.buildVegetation();
    this.buildVehicles();
    this.buildClouds();
    for (const child of [...this.scene.children]) if (child instanceof THREE.Group) this.mergeAuthored(child);
    this.flushStatic();
    this.scene.add(this.playerRoot, this.crewRoot);
    this.playerRoot.position.copy(this.player);
    this.camera.position.set(this.player.x, 4.8, this.player.z + 11); this.camera.lookAt(0, 58, 0);
    this.buildMarker();
    const smokeMaterial = new THREE.MeshStandardMaterial({ color: 0xdfd8c5, roughness: 1, transparent: true, opacity: 0.75, depthWrite: false });
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), smokeMaterial, this.smokeCount);
    this.smoke.frustumCulled = false;
    this.smoke.visible = false;
    this.scene.add(this.smoke);
    this.setQuality('medium');
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
  private texture(type: 'grass' | 'concrete' | 'asphalt' | 'gravel', repeat: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const palette = { grass: [103, 113, 65], concrete: [164, 160, 145], asphalt: [58, 62, 61], gravel: [161, 147, 118] }[type];
    let seed = 109;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * (type === 'grass' ? 42 : 28);
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
    const grass = new THREE.MeshStandardMaterial({ map: this.texture('grass', 180), roughness: 1 });
    this.groundPlane(16000, 16000, 0, 0, grass, -0.12);
    this.groundPlane(42, 35, 0, 5600, new THREE.MeshStandardMaterial({ map: this.texture('concrete', 3), roughness: 1 }), 0.04);
    this.sign(() => world('launchObs'), () => world('safetyDistance'), -8, 2.2, 5590, 0, 8);
    const concrete = new THREE.MeshStandardMaterial({ map: this.texture('concrete', 7), roughness: 0.95 });
    this.groundPlane(132, 130, 0, 0, concrete, 0.01);
    const asphalt = new THREE.MeshStandardMaterial({ map: this.texture('asphalt', 22), roughness: 0.98 });
    this.groundPlane(13, 510, 0, 215, asphalt, 0.03);
    this.groundPlane(180, 11, 0, 145, asphalt, 0.04);
    this.groundPlane(165, 10, 0, 250, asphalt, 0.04);
    this.groundPlane(100, 10, -40, 210, asphalt, 0.04);
    this.groundPlane(130, 10, 0, 365, asphalt, 0.04);
    const gravel = new THREE.MeshStandardMaterial({ map: this.texture('gravel', 50), roughness: 1 });
    for (const offset of [-11, 11]) this.groundPlane(13, 1800, -220 + offset, -300, gravel, 0.02);
    const mark = this.material('road-line', 0xdacb9b);
    for (let z = 85; z < 465; z += 13) this.box(0.18, 0.015, 4.8, mark, 0, 0.07, z);
    for (const x of [-6, 6]) this.box(0.1, 0.02, 410, mark, x, 0.07, 250);
    const water = this.material('water', 0x4e9ba8, 0.3, 0.22);
    this.groundPlane(3200, 10000, 3000, 0, water, -0.09);
    const sand = this.material('sand', 0xcdbd91);
    this.groundPlane(100, 10000, 1375, 0, sand, -0.07);
    for (let i = 0; i < 11; i++) {
      this.groundPlane(30 + (i % 3) * 13, 100 + i * 7, -150 - (i % 3) * 50, 90 + i * 80, water, -0.04);
    }
    this.groundPlane(26, 920, 195, 220, water, -0.03);
    this.sign(() => world('kennedy'), () => world('groundOps'), -18, 2.2, 118, 0, 7);
    this.sign(() => world('pad'), () => world('restricted'), -11, 1.9, 91, 0, 4.5);
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
    this.sign('APOLLO 11', () => world('rocket'), 22, 4, 47, 0, 11);
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
    const vabSub = this.textPlane(() => world('vab'), 105, 5, '#31434b', false); vabSub.position.set(0, 151, 67.5); vab.add(vabSub);
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
    this.station(-35, 130, () => world('s1'), () => world('s1sub'), 'map');
    this.station(-70, 165, () => world('s2'), () => world('s2sub'), 'camera');
    this.station(-100, 220, () => world('s3'), () => world('s3sub'), 'desk');
    this.station(70, 235, () => world('s4'), () => world('s4sub'), 'radio');
    this.station(0, 150, () => world('s5'), () => world('s5sub'), 'crew');
    this.station(0, 355, () => world('s6'), () => world('s6sub'), 'camera');
    // Minigame stations: each one is a hands-on task (see ApolloMinigames).
    this.station(-92, 190, () => world('sWiring'), () => world('sWiringSub'), 'panel');
    this.station(45, 200, () => world('sTracking'), () => world('sTrackingSub'), 'dishstation');
    this.station(-45, 255, () => world('sCard'), () => world('sCardSub'), 'card');
    this.station(-25, 300, () => world('sSequence'), () => world('sSequenceSub'), 'panel');
    this.station(40, 320, () => world('sTelemetry'), () => world('sTelemetrySub'), 'panel');
    const steel = this.material('galvanized', 0xa4aaa5, 0.58, 0.7);
    // Deep-space style parabolic dish, original geometry; visual educational approximation.
    const g = new THREE.Group(); g.position.set(82, 0, 236);
    this.cylinder(0.6, 1, 7, steel, 0, 3.5, 0, g);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(4.8, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.43), this.material('dish', 0xd0d1c5, 0.6, 0.45));
    dish.rotation.z = 0.6; dish.position.y = 8; g.add(dish);
    this.beam(new THREE.Vector3(0, 8, 0), new THREE.Vector3(0, 12, 0), 0.1, steel, g);
    this.scene.add(g);
    this.colliders.push({ x: 82, z: 236, w: 3.8, d: 3.8 });
    for (const [x, z] of [[-58, 217], [-52, 216], [71, 259], [7, 372], [-13, 136]]) {
      const wood = this.material('crate', 0x94734f, 0.95);
      this.box(1.1, 0.8, 0.75, wood, x, 0.4, z);
      for (const dx of [-0.43, 0.43]) this.box(0.12, 0.85, 0.78, this.material('crate-trim', 0x544c3e), x + dx, 0.43, z);
    }
    // Tracking tripod at the spectator area is a distinct authored piece.
    for (let i = 0; i < 6; i++) this.box(3.2, 0.14, 0.55, this.material('bench', 0x7b6651), -22 + i * 9, 0.9, 381);
  }
  private station(x: number, z: number, title: Txt, subtitle: Txt, type: string): void {
    const steel = this.material('station-steel', 0x63746f, 0.6, 0.4);
    const cream = this.material('station-cream', 0xc6c4ad, 0.8);
    this.box(7, 0.12, 5, this.material('station-concrete', 0xb7b3a0), x, 0.05, z);
    if (type === 'camera') {
      this.box(0.9, 0.6, 1.4, this.material('camera', 0x283b41), x, 1.8, z);
      this.beam(new THREE.Vector3(x, 1.8, z - 0.7), new THREE.Vector3(x, 1.8, z - 1.35), 0.38, this.material('lens', 0x243443));
      for (let i = 0; i < 3; i++) this.beam(new THREE.Vector3(x, 1.5, z), new THREE.Vector3(x + Math.sin(i * Math.PI * 2 / 3) * 0.9, 0.1, z + Math.cos(i * Math.PI * 2 / 3) * 0.9), 0.08, steel);
      for (const dx of [-0.27, 0.27]) this.cylinder(0.33, 0.33, 0.15, steel, x + dx, 2.4, z);
    } else {
      this.box(2.7, 0.15, 1.3, cream, x, 1.05, z);
      for (const dx of [-1.1, 1.1]) for (const dz of [-0.45, 0.45]) this.box(0.08, 1, 0.08, steel, x + dx, 0.5, z + dz);
      this.box(1.1, 0.55, 0.7, steel, x + 0.4, 1.4, z);
      this.box(0.9, 0.35, 0.08, this.material('radio-panel', 0x242f2b), x + 0.4, 1.45, z + 0.37);
      for (let i = 0; i < 4; i++) this.cylinder(0.045, 0.045, 0.08, cream, x + 0.1 + i * 0.2, 1.66, z + 0.4);
      this.box(0.6, 0.02, 0.8, this.material('paper', 0xe4ddc3), x - 0.7, 1.15, z);
      if (type === 'radio') {
        this.cylinder(0.025, 0.025, 2.1, steel, x + 1, 2.6, z - 0.1);
        this.box(0.3, 0.22, 0.25, this.material('radio-panel', 0x242f2b), x - 0.7, 1.25, z + 0.25);
      }
      if (type === 'panel') {
        // Equipment cabinet with a lit status face and loose colored wires.
        this.box(1.5, 2.2, 0.5, this.material('cabinet', 0x3a4d52, 0.55, 0.45), x + 1.7, 1.1, z);
        this.box(1.2, 1.7, 0.06, this.material('radio-panel', 0x242f2b), x + 1.7, 1.15, z + 0.27);
        [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xd946ef, 0xfb923c].forEach((c, i) => this.box(0.22, 0.22, 0.05, this.material('led' + i, c, 0.35), x + 1.3 + (i % 3) * 0.4, 1.55 - Math.floor(i / 3) * 0.45, z + 0.32));
        this.beam(new THREE.Vector3(x + 1.7, 0.4, z + 0.3), new THREE.Vector3(x + 0.6, 1.0, z + 0.55), 0.05, this.material('led0', 0xef4444, 0.35));
        this.beam(new THREE.Vector3(x + 1.5, 0.4, z + 0.3), new THREE.Vector3(x + 0.5, 1.0, z + 0.4), 0.05, this.material('led1', 0x3b82f6, 0.35));
      }
      if (type === 'dishstation') {
        // Small tracking dish on a pole next to the console.
        this.cylinder(0.08, 0.1, 2.4, steel, x + 1.7, 1.2, z);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), this.material('dish', 0xd0d1c5, 0.6, 0.45));
        cap.position.set(x + 1.7, 2.65, z); cap.rotation.set(-0.7, 0, 0.4); this.addStatic(cap);
      }
      if (type === 'card') {
        // Wall-style card reader on a stand.
        this.box(0.36, 0.55, 0.22, steel, x - 0.9, 1.45, z + 0.1);
        this.box(0.3, 0.05, 0.24, this.material('radio-panel', 0x242f2b), x - 0.9, 1.6, z + 0.1);
        this.box(0.07, 0.07, 0.04, this.material('led3', 0x22c55e, 0.35), x - 0.9, 1.35, z + 0.22);
      }
    }
    this.sign(title, subtitle, x + 0.5, 2.5, z - 2, 0, 5.5);
    const wide = type === 'panel' || type === 'dishstation';
    this.colliders.push({ x, z, w: type === 'camera' ? 0.65 : wide ? 2.5 : 1.5, d: type === 'camera' ? 0.65 : 0.85 });
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
  private sign(title: Txt, sub: Txt, x: number, y: number, z: number, rotation = 0, w = 6): void {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotation;
    const plate = this.textPlane(() => txt(title) + '\n' + txt(sub), w, 1.25, '#f2e8cb', true); group.add(plate);
    this.box(0.08, y + 0.45, 0.08, this.material('sign-post', 0x697c78, 0.5, 0.6), -w * 0.36, -y / 2, -0.08, group);
    this.box(0.08, y + 0.45, 0.08, this.material('sign-post', 0x697c78, 0.5, 0.6), w * 0.36, -y / 2, -0.08, group);
    this.scene.add(group);
  }
  private textPlane(text: Txt, w: number, h: number, color: string, background: boolean): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const draw = () => {
      ctx.clearRect(0, 0, 1024, 256);
      if (background) { ctx.fillStyle = '#243d3d'; ctx.fillRect(0, 0, 1024, 256); ctx.strokeStyle = '#b8bc9d'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 1012, 244); }
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = txt(text).split('\n');
      lines.forEach((line, i) => { ctx.font = `${i ? 31 : 58}px Arial`; ctx.fillText(line, 512, lines.length > 1 ? 92 + i * 86 : 128, 940); });
      tex.needsUpdate = true;
    };
    draw();
    if (typeof text === 'function') this.textRepaints.push(draw);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: !background, side: THREE.DoubleSide }));
  }
  /** Repaints all localized 3D signs in the active language (no scene rebuild). */
  refreshLanguage(): void { for (const repaint of this.textRepaints) repaint(); }
  private buildVegetation(): void {
    const count = 100;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.25, 6.8, 6), this.material('palm-trunk', 0x77664d), count);
    const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 3), this.material('palm-leaf', 0x455c31), count * 7);
    const scrub = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.material('scrub', 0x52663a), 500);
    let seed = 229;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < count; i++) {
      const x = (i % 2 ? -1 : 1) * (150 + rand() * 800); const z = -240 + rand() * 1250;
      const height = 5 + rand() * 4;
      this.dummy.position.set(x, height / 2, z); this.dummy.scale.set(1, height / 6.8, 1); this.dummy.rotation.set(0, rand() * 6, (rand() - 0.5) * 0.1); this.dummy.updateMatrix(); trunks.setMatrixAt(i, this.dummy.matrix);
      for (let j = 0; j < 7; j++) {
        const a = j * Math.PI * 2 / 7;
        this.dummy.position.set(x + Math.sin(a) * 1.8, height - 0.3, z + Math.cos(a) * 1.8);
        this.dummy.rotation.set(0.16 * Math.sin(a), a, 0.22); this.dummy.scale.set(0.55, 0.13, 2.7); this.dummy.updateMatrix(); leaves.setMatrixAt(i * 7 + j, this.dummy.matrix);
      }
    }
    for (let i = 0; i < 500; i++) {
      const side = i % 2 ? -1 : 1;
      this.dummy.position.set(side * (95 + rand() * 1000), 0.3, -220 + rand() * 1500);
      this.dummy.scale.set(0.8 + rand() * 2.8, 0.45 + rand() * 1, 0.8 + rand() * 2.3); this.dummy.rotation.set(0, rand() * 6, 0); this.dummy.updateMatrix(); scrub.setMatrixAt(i, this.dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = scrub.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, leaves, scrub); this.palmLeaves = leaves;
    trunks.castShadow = true;
  }
  private vehicle(x: number, z: number, crew = false): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = this.material('van-body', crew ? 0xe4e1ca : 0x6a827f, 0.6, 0.28);
    const chrome = this.material('chrome', 0xaab8b4, 0.3, 0.8);
    const glass = this.material('vehicle-glass', 0x345463, 0.23, 0.35);
    this.box(2.4, 1.9, 5.4, body, 0, 1.65, 0, g);
    this.box(2.2, 0.5, 2.1, body, 0, 2.75, 0.55, g);
    this.box(2.2, 1.1, 0.1, glass, 0, 2.3, -2.72, g);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) this.box(0.09, 0.8, 1, glass, side * 1.22, 2.2, -1.7 + i * 1.3, g);
      this.box(0.06, 0.12, 0.35, chrome, side * 1.25, 1.7, -0.7, g);
      for (const pz of [-1.7, 1.7]) {
        const wheel = this.cylinder(0.52, 0.52, 0.3, this.material('tire', 0x252a2b), side * 1.17, 0.53, pz, g, 16); wheel.rotation.z = Math.PI / 2;
        const hub = this.cylinder(0.25, 0.25, 0.32, chrome, side * 1.2, 0.53, pz, g, 16); hub.rotation.z = Math.PI / 2;
      }
    }
    for (const pz of [-2.8, 2.8]) this.box(2.6, 0.2, 0.15, chrome, 0, 0.95, pz, g);
    this.box(1.3, 0.45, 0.09, this.material('grille', 0x353d3b), 0, 1.4, -2.76, g);
    for (const side of [-1, 1]) this.box(0.35, 0.35, 0.11, this.material('headlight', 0xf4e5b0), side * 0.9, 1.6, -2.78, g);
    if (crew) {
      const label = this.textPlane('NASA', 1.4, 0.4, '#24466a', false); label.position.set(1.26, 1.3, 0.5); label.rotation.y = Math.PI / 2; g.add(label);
    }
    this.scene.add(g); return g;
  }
  private buildVehicles(): void {
    this.van = this.vehicle(-17, 75, true);
    this.van.visible = false;
    for (const [x, z] of [[-88, 220], [90, 264], [-88, 345], [90, 139]]) {
      const car = this.vehicle(x, z); car.rotation.y = Math.PI / 2;
      this.colliders.push({ x, z, w: 3.1, d: 1.5 });
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
  private buildClouds(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.43, depthWrite: false });
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), mat, 45);
    for (let i = 0; i < 45; i++) {
      const angle = i * 2.399;
      this.dummy.position.set(Math.sin(angle) * (1800 + i * 70), 500 + (i % 4) * 80, Math.cos(angle) * (1800 + i * 70));
      this.dummy.scale.set(190 + i % 5 * 40, 45 + i % 3 * 20, 110 + i % 4 * 30); this.dummy.rotation.set(0, angle, 0); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true; this.scene.add(mesh);
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
      // The GLB ships Mixamo Walk, Idle and Running (no jump clip). Keep Running in place by removing
      // horizontal hip drift, so the speed of the character comes only from the game's own movement.
      const runClip = gltf.animations.find(c => /run/i.test(c.name));
      const hipTrack = runClip?.tracks.find(track => /^Hips.*\.position$/.test(track.name));
      if (hipTrack) {
        const n = hipTrack.values.length / 3;
        for (const axis of [0, 2]) { let sum = 0; for (let k = 0; k < n; k++) sum += hipTrack.values[k * 3 + axis]; const mean = sum / n; for (let k = 0; k < n; k++) hipTrack.values[k * 3 + axis] = mean; }
      }
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
        const walk = walking ? mixer.clipAction(walking).setEffectiveWeight(i ? 1 : 0).play() : null;
        const idle = idling ? mixer.clipAction(idling).setEffectiveWeight(i ? 0 : 1).play() : null;
        const run = i === 0 && running ? mixer.clipAction(running).setEffectiveWeight(0).play() : null;
        if (walk) walk.time = i * 0.35;
        this.people.push({ root: holder, mixer, walk, idle, run }); this.mixers.push(mixer);
      }
      this.crewRoot.visible = false;
      // Ambient technical staff use a cheap authored period-uniform rig, not a fifth
      // high-poly clone. They remain silhouettes appropriate to support operations.
      for (const [x, z] of [[-73, 163], [-103, 219], [72, 237], [-16, 350]]) this.addTechnician(x, z);
      this.flushStatic();
    } catch (error) {
      this.assetErrors.push(`Mercenary Astronaut: ${String(error)}`);
      // Failure remains visible in diagnostics. A local authored suit preserves play.
      this.facingOffset = 0;
      this.addFallbackSuit(this.playerRoot);
      for (let i = 0; i < 3; i++) { const root = new THREE.Group(); this.addFallbackSuit(root); this.crewRoot.add(root); this.crew.push(root); }
      this.crewRoot.visible = false;
    }
  }
  private addTechnician(x: number, z: number): void {
    const shirt = this.material('technician-shirt', 0xe0dcc7); const pants = this.material('technician-pants', 0x42585f);
    this.box(0.5, 0.65, 0.32, shirt, x, 1.13, z);
    this.cylinder(0.15, 0.16, 0.3, this.material('skin', 0xb98e67), x, 1.64, z);
    for (const dx of [-0.14, 0.14]) this.box(0.2, 0.8, 0.22, pants, x + dx, 0.41, z);
    for (const dx of [-0.33, 0.33]) this.box(0.13, 0.58, 0.17, shirt, x + dx, 1.08, z);
    this.cylinder(0.22, 0.22, 0.13, shirt, x, 1.84, z);
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
  setZoom(value: boolean): void { this.zoomed = value; }
  setSuspended(value: boolean): void { this.suspended = value; if (value) this.keys.clear(); }
  setQuality(value: ApolloQuality): void {
    this.quality = value;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, { low: 1, medium: 1.35, high: 1.75 }[value]));
    this.renderer.shadowMap.enabled = value !== 'low';
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
    this.playerRoot.rotation.y = Math.atan2(-dx, -dz) + this.facingOffset;
    return true;
  }
  /** Simple ballistic jump (about 1.1 m apex); ignored while paused, in cinematics and at the 5.6 km site. */
  private stepJump(dt: number): void {
    if (this.suspended || this.mode || this.player.z > 5000) { this.player.y = 0; this.vy = 0; this.jumpQueued = false; return; }
    if (this.jumpQueued && this.player.y === 0) this.vy = 6.2;
    this.jumpQueued = false;
    if (this.vy !== 0 || this.player.y > 0) {
      this.vy -= 17 * dt; this.player.y = Math.max(0, this.player.y + this.vy * dt);
      if (this.player.y === 0) this.vy = 0;
    }
  }
  update(dt: number): void {
    if (this.disposed) return;
    if (dt > 0) { this.frameDurations.push(dt * 1000); if (this.frameDurations.length > 300) this.frameDurations.shift(); }
    dt = Math.min(Math.max(dt, 0), 0.05); this.clock += dt;
    this.stepJump(dt);
    const moving = this.move(dt); this.playerRoot.position.copy(this.player);
    // The observation site is genuinely 5.6 km away: keep humid distance haze
    // subtle enough for the long lens instead of hiding the rocket in dense fog.
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.player.z > 5000 || this.mode === 'launch' ? 0.00004 : 0.00038;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      if (i === 0) {
        // Player: idle / walk / run, with Running reused as the airborne pose (the GLB has no jump clip).
        const sprint = moving && this.keys.has('shift'), air = this.player.y > 0;
        const goal = { idle: moving || air ? 0 : 1, walk: moving && !sprint && !air ? 1 : 0, run: air || sprint ? 1 : 0 };
        const k = 1 - Math.exp(-dt * 12);
        for (const key of ['idle', 'walk', 'run'] as const) { this.animWeights[key] += (goal[key] - this.animWeights[key]) * k; p[key]?.setEffectiveWeight(this.animWeights[key]); }
        p.run?.setEffectiveTimeScale(air ? 0.55 : 1);
        p.mixer.update(dt);
        // Slight forward lean while sprinting or jumping.
        const model = p.mixer.getRoot() as THREE.Object3D;
        model.rotation.x += ((air ? 0.2 : sprint ? 0.1 : 0) - model.rotation.x) * k;
        continue;
      }
      const walking = this.mode === 'crew';
      p.walk?.setEffectiveWeight(walking ? 1 : 0); p.idle?.setEffectiveWeight(walking ? 0 : 1);
      if (this.mode === 'crew') p.mixer.update(dt);
    }
    if (this.target.visible) { this.target.children[1].rotation.y += dt; this.target.children[1].position.y = 3.8 + Math.sin(this.clock * 2) * 0.22; }
    if (this.mode === 'intro') this.introCamera(this.cinematicElapsed);
    else if (this.mode === 'crew') this.crewCamera(this.cinematicElapsed);
    else if (this.mode === 'launch') this.launchCamera(this.cinematicElapsed);
    else {
      // Close third-person camera: behind the shoulder, aimed at the upper body.
      this.cameraGoal.set(this.player.x + Math.sin(this.yaw) * 4.4, 1.9 + this.pitch * 2.4 + this.player.y * 0.7, this.player.z + Math.cos(this.yaw) * 4.4);
      this.cameraLook.set(this.player.x - Math.sin(this.yaw) * 1.6, 1.45 + this.player.y * 0.8, this.player.z - Math.cos(this.yaw) * 1.6);
      this.camera.position.lerp(this.cameraGoal, 1 - Math.exp(-dt * 7)); this.camera.lookAt(this.cameraLook);
      if (this.player.z > 5000) { this.camera.position.set(this.player.x, 5, this.player.z); this.camera.lookAt(0, 64, 0); }
      this.camera.fov = this.player.z > 5000 ? 3.4 : this.zoomed ? 22 : 62; this.camera.updateProjectionMatrix();
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
        this.dummy.scale.set(scale, scale * 0.75, scale); this.dummy.rotation.set(age, a, age); this.dummy.updateMatrix(); this.smoke.setMatrixAt(i, this.dummy.matrix);
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
    return { engine: 'Three.js', player: this.player.toArray(), yaw: this.yaw, quality: this.quality, drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, pixelRatio: this.renderer.getPixelRatio(), shadowMap: this.renderer.shadowMap.enabled ? this.sun.shadow.mapSize.x : 0, shadowLights: this.renderer.shadowMap.enabled ? 1 : 0, samples: times.length, meanFrameMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0, p95FrameMs: times[Math.floor(times.length * 0.95)] ?? 0, rocketHeightMeters: 110.6, colliders: this.colliders.length, launchY: this.rocket.position.y, crew: this.crew.length, loadedModel: { ...this.loadedModel, playerBounds: new THREE.Box3().setFromObject(this.playerRoot).getSize(new THREE.Vector3()).toArray(), modelScale: this.playerRoot.children[0]?.scale.toArray() }, assetErrors: [...this.assetErrors] };
  }
  private onKeyDown = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement)?.closest('input,textarea,select,button')) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(key)) { if (!this.suspended && !this.mode) this.keys.add(key); event.preventDefault(); }
    if (key === ' ' && !event.repeat && !this.suspended && !this.mode) this.jumpQueued = true;
    if (key === 'e' && !event.repeat && !this.suspended && !this.mode) this.callbacks.onInteract();
    if (key === 'm' && !event.repeat && !this.mode) this.callbacks.onMap();
  };
  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.key.toLowerCase()); };
  private onBlur = (): void => { this.keys.clear(); this.lastPointer = null; };
  private onPointerDown = (event: PointerEvent): void => { if (this.suspended || this.mode) return; this.lastPointer = { x: event.clientX, y: event.clientY }; this.renderer.domElement.setPointerCapture(event.pointerId); };
  private onPointerMove = (event: PointerEvent): void => {
    if (!this.lastPointer || this.suspended || this.mode) return;
    this.yaw -= (event.clientX - this.lastPointer.x) * 0.004;
    this.pitch = clamp(this.pitch + (event.clientY - this.lastPointer.y) * 0.003, -0.2, 1);
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
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
