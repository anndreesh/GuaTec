import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface CharacterBatchStats {
  meshesBefore: number;
  meshesAfter: number;
  batches: number;
  drawCallsSavedPerPass: number;
  trianglesBefore: number;
  trianglesAfter: number;
  skippedMeshes: number;
}

// SkeletonUtils.clone shares geometry, so batching the source once before cloning
// also shares the generated buffers. No global geometry cache owns their lifetime.
const generatedMeshes = new WeakSet<THREE.SkinnedMesh>();

function triangles(mesh: THREE.SkinnedMesh): number {
  return (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position')?.count ?? 0) / 3;
}

function compatibleLayout(mesh: THREE.SkinnedMesh): string | null {
  const { geometry, material } = mesh;
  if (!mesh.parent || mesh.children.length || Array.isArray(material) || !material.visible || material.transparent
    || ('transmission' in material && Number(material.transmission) > 0)
    || mesh.customDepthMaterial || mesh.customDistanceMaterial
    || Object.keys(geometry.morphAttributes).length || geometry.groups.length
    || mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender
    || mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender
    || mesh.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow
    || mesh.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow) return null;

  const position = geometry.getAttribute('position');
  const indices = geometry.getAttribute('skinIndex');
  const weights = geometry.getAttribute('skinWeight');
  const count = geometry.index?.count ?? position?.count ?? 0;
  if (!position || !indices || !weights || indices.itemSize !== 4 || indices.normalized || weights.itemSize !== 4
    || indices.count !== position.count || weights.count !== position.count
    || geometry.drawRange.start !== 0 || geometry.drawRange.count < count
    || !mesh.skeleton?.bones.length || mesh.skeleton.bones.length !== mesh.skeleton.boneInverses.length) return null;

  const attributes: unknown[] = [];
  for (const name of Object.keys(geometry.attributes).sort()) {
    const attribute = geometry.getAttribute(name);
    // Meshopt retains packed/interleaved attributes in this GLB. Their layout is
    // compatible once copied without padding; Float16 still needs special rules.
    if (!(attribute instanceof THREE.BufferAttribute || attribute instanceof THREE.InterleavedBufferAttribute)
      || 'isFloat16BufferAttribute' in attribute
      || attribute.count !== position.count) return null;
    const gpuType = attribute instanceof THREE.BufferAttribute ? attribute.gpuType : THREE.FloatType;
    if (name !== 'skinIndex') attributes.push([name, attribute.array.constructor.name, attribute.itemSize, attribute.normalized, gpuType]);
  }
  const finite = [...mesh.matrix.elements, ...mesh.bindMatrix.elements, ...mesh.bindMatrixInverse.elements,
    ...mesh.skeleton.boneInverses.flatMap(inverse => inverse.elements)].every(Number.isFinite);
  if (!finite) return null;

  return JSON.stringify([mesh.parent.uuid, material.uuid, attributes, !!geometry.index, mesh.matrix.elements,
    mesh.bindMode, mesh.bindMatrix.elements, mesh.bindMatrixInverse.elements, mesh.matrixAutoUpdate,
    mesh.castShadow, mesh.receiveShadow, mesh.frustumCulled, mesh.layers.mask, mesh.renderOrder]);
}

/** Batch visible opaque skin meshes without changing imported bones or animation targets.
 * Call once on the loaded source, before SkeletonUtils.clone. Original mesh nodes
 * remain hidden in the hierarchy; this function never disposes source resources.
 */
export function batchCharacterMeshes(root: THREE.Object3D): CharacterBatchStats {
  root.updateMatrixWorld(true);
  const groups = new Map<string, THREE.SkinnedMesh[]>();
  const stats: CharacterBatchStats = {
    meshesBefore: 0, meshesAfter: 0, batches: 0, drawCallsSavedPerPass: 0,
    trianglesBefore: 0, trianglesAfter: 0, skippedMeshes: 0,
  };
  root.traverseVisible(node => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    stats.meshesBefore++;
    stats.trianglesBefore += triangles(node);
    const key = generatedMeshes.has(node) ? null : compatibleLayout(node);
    if (key === null) { stats.skippedMeshes++; return; }
    const group = groups.get(key) ?? [];
    group.push(node); groups.set(key, group);
  });

  for (const meshes of groups.values()) {
    if (meshes.length < 2) { stats.skippedMeshes += meshes.length; continue; }
    const reference = meshes[0];
    const bones: THREE.Bone[] = [];
    const inverses: THREE.Matrix4[] = [];
    const palette = new Map<string, number>();
    const geometries: THREE.BufferGeometry[] = [];
    let valid = true;
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone();
      geometries.push(geometry);
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        if (!(attribute instanceof THREE.InterleavedBufferAttribute)) continue;
        // Copy raw packed components rather than decode/requantize normalized
        // values. This preserves the GLB's exact integer attributes and padding.
        const array = attribute.array.slice(0, attribute.count * attribute.itemSize);
        for (let vertex = 0; vertex < attribute.count; vertex++) {
          for (let component = 0; component < attribute.itemSize; component++) {
            array[vertex * attribute.itemSize + component] = attribute.array[vertex * attribute.data.stride + attribute.offset + component];
          }
        }
        geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
      }
      const indices = geometry.getAttribute('skinIndex');
      const weights = geometry.getAttribute('skinWeight');
      const remapped = new Uint16Array(indices.count * 4);
      for (let vertex = 0; vertex < indices.count && valid; vertex++) {
        for (let component = 0; component < 4; component++) {
          const weight = weights.getComponent(vertex, component);
          if (!Number.isFinite(weight)) { valid = false; break; }
          if (weight === 0) continue;
          const sourceIndex = indices.getComponent(vertex, component);
          const bone = mesh.skeleton.bones[sourceIndex];
          const inverse = mesh.skeleton.boneInverses[sourceIndex];
          if (!Number.isInteger(sourceIndex) || !bone || !inverse) { valid = false; break; }
          // A bone name/index alone cannot identify a skin palette entry: this
          // asset has different inverse bind matrices for the same imported bone.
          const key = `${bone.uuid}:${inverse.elements.join(',')}`;
          let index = palette.get(key);
          if (index === undefined) {
            index = bones.length;
            if (index > 65535) { valid = false; break; }
            palette.set(key, index); bones.push(bone); inverses.push(inverse.clone());
          }
          remapped[vertex * 4 + component] = index;
        }
      }
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(remapped, 4));
      if (!valid) break;
    }
    const geometry = valid && bones.length ? mergeGeometries(geometries, false) : null;
    // Only temporary geometry clones belong to this function.
    geometries.forEach(temporary => temporary.dispose());
    if (!geometry) { stats.skippedMeshes += meshes.length; continue; }

    const material = reference.material as THREE.Material;
    const batch = new THREE.SkinnedMesh(geometry, material);
    batch.name = `character-batch-${material.name || material.uuid}`;
    batch.position.copy(reference.position); batch.quaternion.copy(reference.quaternion); batch.scale.copy(reference.scale);
    batch.matrix.copy(reference.matrix); batch.matrixAutoUpdate = reference.matrixAutoUpdate;
    batch.bindMode = reference.bindMode;
    batch.bindMatrix.copy(reference.bindMatrix); batch.bindMatrixInverse.copy(reference.bindMatrixInverse);
    batch.skeleton = new THREE.Skeleton(bones, inverses);
    batch.castShadow = reference.castShadow; batch.receiveShadow = reference.receiveShadow;
    batch.layers.mask = reference.layers.mask; batch.renderOrder = reference.renderOrder;
    // Avoid a stale bind-pose sphere clipping animated limbs. Apollo source meshes
    // already disable frustum culling; no CPU vertex scan is added to each frame.
    batch.frustumCulled = false;
    generatedMeshes.add(batch);
    reference.parent!.add(batch);
    meshes.forEach(mesh => { mesh.visible = false; });
    stats.batches++;
    stats.drawCallsSavedPerPass += meshes.length - 1;
  }
  stats.meshesAfter = stats.meshesBefore - stats.drawCallsSavedPerPass;
  stats.trianglesAfter = stats.trianglesBefore;
  return stats;
}
