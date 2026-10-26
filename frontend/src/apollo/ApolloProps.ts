import * as THREE from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * GLB props for the Apollo 11 scene. Every model arrives with its own units and origin
 * (one is offset by 800 km, another is authored in millimetres), so each one is
 * normalised here: hidden parts removed, scaled so one axis matches a real-world size in
 * metres, centred on X/Z, resting on y = 0 and merged to one mesh per material so a
 * 6,000-node model costs a handful of draw calls instead of thousands.
 */
export interface PropFit {
  /** Axis that is scaled to `size` metres; `max` uses the largest side. */
  axis: 'x' | 'y' | 'z' | 'max';
  size: number;
}
export interface PropOptions {
  fit: PropFit;
  /** Parts to leave out, matched against the mesh name and every ancestor name (e.g. a lawn baked into the model). */
  hide?: RegExp;
}
export interface Prop {
  /** Origin at the centre of the footprint, base on y = 0, facing +Z as authored. */
  group: THREE.Group;
  /** Final size in metres (x = width, y = height, z = depth). */
  size: THREE.Vector3;
  triangles: number;
}
export interface Placement { x: number; z: number; yaw: number; scale: number; y?: number }

const PLAIN_ATTRIBUTES = ['position', 'normal', 'uv', 'color'];

/** Copies position/normal/uv into plain (non-interleaved) buffers and bakes `matrix`, so any source mesh can be merged. */
function plainGeometry(source: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const position = source.getAttribute('position');
  const count = position.count;
  const out = new THREE.BufferGeometry();
  const copy = (name: string, size: number): Float32Array | null => {
    const attribute = source.getAttribute(name);
    if (!attribute) return null;
    const data = new Float32Array(count * size);
    for (let i = 0; i < count; i++) {
      data[i * size] = attribute.getX(i);
      data[i * size + 1] = attribute.getY(i);
      if (size > 2) data[i * size + 2] = attribute.getZ(i);
    }
    return data;
  };
  out.setAttribute('position', new THREE.BufferAttribute(copy('position', 3)!, 3));
  const normal = copy('normal', 3);
  if (normal) out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(copy('uv', 2) ?? new Float32Array(count * 2), 2));
  const color = copy('color', 3);
  if (color) out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  if (source.index) out.setIndex(new THREE.BufferAttribute(Uint32Array.from(source.index.array as ArrayLike<number>), 1));
  else {
    const sequence = new Uint32Array(count);
    for (let i = 0; i < count; i++) sequence[i] = i;
    out.setIndex(new THREE.BufferAttribute(sequence, 1));
  }
  out.applyMatrix4(matrix);
  if (!normal) out.computeVertexNormals();
  for (const name of Object.keys(out.attributes)) if (!PLAIN_ATTRIBUTES.includes(name)) out.deleteAttribute(name);
  return out;
}

function isHidden(node: THREE.Object3D, pattern: RegExp | undefined): boolean {
  if (!pattern) return false;
  for (let current: THREE.Object3D | null = node; current; current = current.parent) if (pattern.test(current.name)) return true;
  return false;
}

export async function loadProp(loader: GLTFLoader, url: string, options: PropOptions): Promise<Prop> {
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse(node => {
    if (node instanceof THREE.Mesh && node.geometry.getAttribute('position') && !isHidden(node, options.hide)) meshes.push(node);
  });
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox();
    part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    box.union(part);
  }
  if (box.isEmpty()) throw new Error(`${url}: no visible geometry`);
  const raw = box.getSize(new THREE.Vector3());
  const side = options.fit.axis === 'max' ? Math.max(raw.x, raw.y, raw.z) : raw[options.fit.axis];
  const scale = options.fit.size / Math.max(side, 1e-6);
  const centre = box.getCenter(new THREE.Vector3());
  const normalise = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));

  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  let triangles = 0;
  for (const mesh of meshes) {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const geometry = plainGeometry(mesh.geometry, new THREE.Matrix4().multiplyMatrices(normalise, mesh.matrixWorld));
    triangles += (geometry.index?.count ?? 0) / 3;
    const list = batches.get(material) ?? [];
    list.push(geometry);
    batches.set(material, list);
  }
  const group = new THREE.Group();
  for (const [material, geometries] of batches) {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) continue;
    if (geometries.length > 1) geometries.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group, size: raw.multiplyScalar(scale), triangles };
}

/** Many copies of one prop as instanced meshes (one per material), e.g. a grove of trees. */
export function scatter(prop: Prop, placements: readonly Placement[]): THREE.Group {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  prop.group.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const instanced = new THREE.InstancedMesh(node.geometry, node.material, placements.length);
    placements.forEach((p, i) => {
      dummy.position.set(p.x, p.y ?? 0, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    group.add(instanced);
  });
  return group;
}
