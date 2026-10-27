import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { batchCharacterMeshes } from '../src/apollo/ApolloCharacterBatches';

function fixture() {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const hip = new THREE.Bone(), arm = new THREE.Bone();
  hip.name = 'hip'; arm.name = 'arm'; arm.position.y = 1;
  root.add(hip); hip.add(arm); root.updateMatrixWorld(true);
  const makeMesh = (reversed = false) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    const h = reversed ? 1 : 0, a = reversed ? 0 : 1;
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([h, a, 0, 0, a, h, 0, 0, h, a, 0, 0], 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([.25, .75, 0, 0, 1, 0, 0, 0, .5, .5, 0, 0], 4));
    geometry.setIndex([0, 1, 2]);
    const mesh = new THREE.SkinnedMesh(geometry, material);
    const skeleton = new THREE.Skeleton(reversed ? [arm, hip] : [hip, arm]);
    // Same bone, genuinely different inverse bind: preserve both palette entries.
    if (reversed) skeleton.boneInverses[0].multiply(new THREE.Matrix4().makeTranslation(.125, 0, 0));
    mesh.bind(skeleton, new THREE.Matrix4()); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false; root.add(mesh); return mesh;
  };
  return { root, hip, arm, material, makeMesh };
}

test('batches two skeletons with reordered bones and distinct inverse binds without changing deformation or resources', () => {
  const { root, hip, arm, material, makeMesh } = fixture(), a = makeMesh(), b = makeMesh(true);
  const sourceIndices = [Array.from(a.geometry.getAttribute('skinIndex').array), Array.from(b.geometry.getAttribute('skinIndex').array)];
  const originalSkeletons = [a.skeleton, b.skeleton]; let disposed = 0;
  for (const resource of [a.geometry, b.geometry, material]) resource.addEventListener('dispose', () => disposed++);
  for (const skeleton of originalSkeletons) {
    const dispose = skeleton.dispose;
    skeleton.dispose = function () { disposed++; dispose.call(this); };
  }
  const stats = batchCharacterMeshes(root);
  assert.deepEqual(stats, { meshesBefore: 2, meshesAfter: 1, batches: 1, drawCallsSavedPerPass: 1, trianglesBefore: 2, trianglesAfter: 2, skippedMeshes: 0 });
  const merged = root.children.find(node => node instanceof THREE.SkinnedMesh && node.visible) as THREE.SkinnedMesh;
  assert.ok(merged); assert.equal(a.visible, false); assert.equal(b.visible, false);
  assert.equal(a.parent, root); assert.equal(b.parent, root); assert.equal(merged.material, material);
  assert.deepEqual([a.skeleton, b.skeleton], originalSkeletons); assert.equal(disposed, 0);
  assert.equal(merged.skeleton.bones.length, 3, 'deduplicates identical pairs while keeping both arm inverse binds');
  assert.equal(merged.geometry.groups.length, 0); assert.equal(merged.castShadow, true); assert.equal(merged.receiveShadow, true);
  assert.deepEqual([Array.from(a.geometry.getAttribute('skinIndex').array), Array.from(b.geometry.getAttribute('skinIndex').array)], sourceIndices);
  const expected = new THREE.Vector3(), actual = new THREE.Vector3();
  for (const angle of [0, .3, -.8, 1.6]) {
    hip.position.x = angle * .1; arm.rotation.z = angle; root.updateMatrixWorld(true);
    for (const [index, source] of [a, b].entries()) for (let vertex = 0; vertex < 3; vertex++) {
      source.getVertexPosition(vertex, expected).applyMatrix4(source.matrixWorld);
      merged.getVertexPosition(index * 3 + vertex, actual).applyMatrix4(merged.matrixWorld);
      assert.ok(expected.distanceTo(actual) < 1e-12);
    }
  }
  const copy = clone(root), copiedBatch = copy.getObjectByName(merged.name) as THREE.SkinnedMesh;
  assert.equal(copiedBatch.geometry, merged.geometry, 'source batching shares generated geometry with clones');
  assert.notEqual(copiedBatch.skeleton, merged.skeleton);
  assert.ok(copiedBatch.skeleton.bones.every(bone => bone !== hip && bone !== arm));
  assert.equal(batchCharacterMeshes(root).batches, 0, 'repeated calls do not duplicate batches');
});

test('keeps transparent, morphing and incompatible layouts or transforms as original nodes', () => {
  for (const change of [
    (mesh: THREE.SkinnedMesh) => { mesh.material = new THREE.MeshStandardMaterial({ transparent: true }); },
    (mesh: THREE.SkinnedMesh) => { mesh.geometry.morphAttributes.position = [mesh.geometry.getAttribute('position').clone()]; },
    (mesh: THREE.SkinnedMesh) => { mesh.geometry.deleteAttribute('uv'); },
    (mesh: THREE.SkinnedMesh) => { mesh.position.x = 1; },
    (mesh: THREE.SkinnedMesh) => { mesh.bindMatrix.makeTranslation(0, 0, 1); },
    (mesh: THREE.SkinnedMesh) => { mesh.geometry.addGroup(0, 3, 0); },
    (mesh: THREE.SkinnedMesh) => { mesh.geometry.setDrawRange(0, 0); },
    (mesh: THREE.SkinnedMesh) => { mesh.geometry.getAttribute('skinIndex').setX(0, 1234); },
    (mesh: THREE.SkinnedMesh) => { mesh.onBeforeRender = () => {}; },
  ]) {
    const { root, makeMesh } = fixture(), a = makeMesh(), b = makeMesh(true); change(b);
    const stats = batchCharacterMeshes(root);
    assert.equal(stats.batches, 0); assert.equal(stats.meshesAfter, 2);
    assert.equal(a.visible, true); assert.equal(b.visible, true); assert.equal(root.children.length, 3);
  }
});

test('accepts padded interleaved normalized attributes without changing packed values or source buffers', () => {
  const { root, makeMesh } = fixture(), a = makeMesh(), b = makeMesh(true);
  const positions = new Int16Array([0, 0, 0, 123, 32767, 0, 0, 123, 0, 32767, 0, 123]);
  const normals = new Int8Array([0, 0, 127, 23, 0, 0, 127, 23, 0, 0, 127, 23]);
  for (const mesh of [a, b]) {
    mesh.geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(positions, 4), 3, 0, true));
    mesh.geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(normals, 4), 3, 0, true));
    mesh.geometry.setAttribute('skinWeight', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Uint8Array([99, 64, 191, 0, 0, 99, 255, 0, 0, 0, 99, 128, 127, 0, 0]), 5), 4, 1, true));
  }
  assert.equal(batchCharacterMeshes(root).batches, 1);
  const merged = root.children.find(node => node instanceof THREE.SkinnedMesh && node.visible) as THREE.SkinnedMesh;
  assert.deepEqual(Array.from(merged.geometry.getAttribute('position').array), [0, 0, 0, 32767, 0, 0, 0, 32767, 0, 0, 0, 0, 32767, 0, 0, 0, 32767, 0]);
  assert.deepEqual(Array.from(merged.geometry.getAttribute('normal').array), [0, 0, 127, 0, 0, 127, 0, 0, 127, 0, 0, 127, 0, 0, 127, 0, 0, 127]);
  assert.equal(merged.geometry.getAttribute('position').normalized, true);
  assert.equal(a.geometry.getAttribute('position').array, positions);
  assert.equal(b.geometry.getAttribute('normal').array, normals);
  assert.deepEqual(Array.from(positions), [0, 0, 0, 123, 32767, 0, 0, 123, 0, 32767, 0, 123]);
  for (const source of [a, b]) for (let vertex = 0; vertex < 3; vertex++) {
    const index = (source === a ? 0 : 3) + vertex;
    assert.equal(source.getVertexPosition(vertex, new THREE.Vector3()).distanceTo(merged.getVertexPosition(index, new THREE.Vector3())), 0);
  }
});

test('real Meshopt crew GLB produces seven batches and preserves deformation in all imported clips', async () => {
  const file = await readFile(resolve('public/assets/apollo/mercenary-astronaut.glb'));
  const jsonLength = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
  // Keep actual meshopt buffers, skins, nodes and animation data; omit image
  // loading in Node, preserving material identity, sidedness and alpha modes.
  json.materials = json.materials.map((material: Record<string, unknown>) => ({
    name: material.name, doubleSided: material.doubleSided, alphaMode: material.alphaMode, alphaCutoff: material.alphaCutoff,
  }));
  delete json.images; delete json.textures;
  const encoded = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20);
  encoded.copy(padded);
  const bin = file.subarray(20 + jsonLength), header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + bin.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const bytes = Buffer.concat([header, padded, bin]);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const originals: THREE.SkinnedMesh[] = [];
  gltf.scene.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    const association = gltf.parser.associations.get(node);
    const name = association?.meshes !== undefined ? json.meshes[association.meshes].name : node.name;
    node.visible = !/crate|backpack_cargo/i.test(name); node.frustumCulled = false;
    if (node.visible) originals.push(node);
  });
  const stats = batchCharacterMeshes(gltf.scene);
  assert.equal(stats.meshesBefore, 34); assert.equal(stats.meshesAfter, 23); assert.equal(stats.batches, 7);
  assert.equal(stats.drawCallsSavedPerPass, 11); assert.equal(stats.trianglesBefore, 135704); assert.equal(stats.trianglesAfter, 135704);
  const groups: { batch: THREE.SkinnedMesh; sources: THREE.SkinnedMesh[] }[] = [];
  gltf.scene.traverseVisible(node => {
    if (node instanceof THREE.SkinnedMesh && node.name.startsWith('character-batch-')) {
      groups.push({ batch: node, sources: originals.filter(source => !source.visible && source.material === node.material) });
    }
  });
  const mixer = new THREE.AnimationMixer(gltf.scene), expected = new THREE.Vector3(), actual = new THREE.Vector3();
  let maxError = 0, compared = 0;
  assert.equal(gltf.animations.length, 3);
  for (const clip of gltf.animations) {
    mixer.stopAllAction(); mixer.clipAction(clip).reset().play();
    for (const phase of [0, .47, 1.4]) {
      mixer.setTime(phase); gltf.scene.updateMatrixWorld(true);
      for (const { batch, sources } of groups) {
        let offset = 0;
        for (const source of sources) {
          const count = source.geometry.getAttribute('position').count;
          for (let vertex = 0; vertex < count; vertex++) {
            source.getVertexPosition(vertex, expected).applyMatrix4(source.matrixWorld);
            batch.getVertexPosition(offset + vertex, actual).applyMatrix4(batch.matrixWorld);
            maxError = Math.max(maxError, expected.distanceTo(actual)); compared++;
          }
          offset += count;
        }
        assert.equal(offset, batch.geometry.getAttribute('position').count);
      }
    }
  }
  assert.ok(compared > 900_000); assert.equal(maxError, 0);
  mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
});

test('ignores hidden equipment and partitions one material into compatible layout groups', () => {
  const { root, makeMesh } = fixture(), a = makeMesh(), b = makeMesh(true), incompatible = makeMesh(), hidden = makeMesh();
  incompatible.geometry.deleteAttribute('uv'); hidden.visible = false;
  const stats = batchCharacterMeshes(root);
  assert.equal(stats.meshesBefore, 3); assert.equal(stats.meshesAfter, 2); assert.equal(stats.skippedMeshes, 1);
  assert.equal(stats.drawCallsSavedPerPass, 1); assert.equal(incompatible.visible, true); assert.equal(hidden.visible, false);
  assert.equal(a.visible, false); assert.equal(b.visible, false);
});
