import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const projectRoot = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { default: ts } = await import(pathToFileURL(path.join(projectRoot, 'frontend/node_modules/typescript/lib/typescript.js')));
const B = await import(pathToFileURL(path.join(projectRoot, 'frontend/node_modules/@babylonjs/core/index.js')));
// The NullEngine check covers geometry and ownership. The minimal drawing
// context only supplies the wool canvas; this does not test GPU appearance.
globalThis.OffscreenCanvas = class {
  constructor(width, height) { this.width = width; this.height = height; }
  getContext() { return { fillRect() {}, clearRect() {} }; }
};
const source = fs.readFileSync(path.join(projectRoot, 'frontend/src/babylon/gameplay/AstronautCharacter.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { createAstronautCharacter } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const engine = new B.NullEngine();
const scene = new B.Scene(engine);
const roles = ['director', 'propulsion', 'structural', 'data'];
const characters = roles.map(role => createAstronautCharacter(B, scene, { role }));
const geometry = characters.map((character, i) => {
  character.root.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
  const bounds = character.root.getHierarchyBoundingVectors(true);
  return { role: roles[i], meshes: character.root.getChildMeshes().length, min: bounds.min.asArray(), max: bounds.max.asArray() };
});
assert.equal(geometry.every(g => g.meshes <= 24), true);
const boot = characters[0].root.getChildMeshes().find(m => m.name.includes('ankle--1') && m.material.name.includes('leather'));
boot.computeWorldMatrix(true);
const bootStart = boot.getBoundingInfo().boundingBox.centerWorld.clone();
characters[0].setMovementState(true, false);
for (let i = 0; i < 30; i++) characters[0].update(1 / 60);
boot.computeWorldMatrix(true);
const bootTravel = B.Vector3.Distance(bootStart, boot.getBoundingInfo().boundingBox.centerWorld);
assert.ok(bootTravel > 0.01, 'boot must follow its animated ankle');
const beforeDisposal = { meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length };
characters.forEach(character => character.dispose());
const cycles = [];
for (let cycle = 0; cycle < 3; cycle++) {
  const a = createAstronautCharacter(B, scene, { role: 'director' });
  const b = createAstronautCharacter(B, scene, { role: 'director' });
  const materials = scene.materials.length;
  a.dispose();
  assert.equal(scene.materials.length, materials, 'shared material disposed before last consumer');
  const original = b.root.getHierarchyBoundingVectors(true);
  b.root.position.set(10, 2, -3);
  b.root.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
  const moved = b.root.getHierarchyBoundingVectors(true);
  assert.ok(Math.abs(moved.min.x - original.min.x - 10) < 0.001, 'merged parent X transform duplicated');
  assert.ok(Math.abs(moved.min.y - original.min.y - 2) < 0.001, 'merged parent Y transform duplicated');
  b.setMovementState(true, true);
  for (let i = 0; i < 60; i++) b.update(1 / 60);
  b.setMovementState(false, false);
  for (let i = 0; i < 120; i++) b.update(1 / 60);
  const hip = b.root.getDescendants().find(node => node.name === 'engineer-hip--1');
  assert.ok(Math.abs(hip.rotation.x) < 0.00001, 'idle failed to settle');
  for (const mesh of b.root.getChildMeshes()) {
    for (const value of mesh.getVerticesData(B.VertexBuffer.PositionKind)) assert.ok(Number.isFinite(value), 'invalid vertex coordinate');
  }
  b.dispose();
  assert.equal(scene.meshes.length, 0);
  assert.equal(scene.materials.length, 0);
  cycles.push({ cycle, meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length });
}
assert.equal(new Set(cycles.map(cycle => cycle.textures)).size, 1, 'texture count grows across cycles');
console.log(JSON.stringify({ result: 'PASS', engine: B.Engine.Version, geometry, bootTravel, beforeDisposal, cycles, limitation: 'NullEngine geometry/lifecycle verification; no GPU or visual assertions. One cached BRDF texture remains stable across cycles.' }, null, 2));
engine.dispose();
