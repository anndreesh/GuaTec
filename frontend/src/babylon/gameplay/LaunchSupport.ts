import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "./AstronautCharacter";

export interface SupportFootprint { minX: number; maxX: number; minZ: number; maxZ: number }

/** A ground gantry fitted to the loaded vehicle, with retracting contact jacks. */
export function createLaunchSupport(
  B: BabylonNamespace,
  scene: BABYLON.Scene,
  parent: BABYLON.TransformNode,
  origin: BABYLON.Vector3,
  materials: { steel: BABYLON.Material; dark: BABYLON.Material; paint: BABYLON.Material; pad: BABYLON.Material; hardware: BABYLON.Material; foundation: BABYLON.Material },
  shadows: BABYLON.ShadowGenerator,
) {
  const root = new B.TransformNode("vehicle-fitted-service-gantry", scene);
  root.parent = parent;
  root.position.copyFrom(origin);
  const jacks: Array<{ tube: BABYLON.Mesh; shoe: BABYLON.Mesh; travel: number; startZ: number }> = [];
  const footprint: SupportFootprint = { minX: -3, maxX: 3, minZ: origin.z - 3, maxZ: origin.z + 3 };
  let release = 0;

  const finish = (mesh: BABYLON.Mesh, material: BABYLON.Material) => {
    mesh.parent = root;
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.checkCollisions = true;
    shadows.addShadowCaster(mesh);
    return mesh;
  };
  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material = materials.steel) => {
    const mesh = finish(B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), material);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const beam = (name: string, a: BABYLON.Vector3, b: BABYLON.Vector3, diameter: number, material = materials.dark) => {
    const direction = b.subtract(a);
    const mesh = finish(B.MeshBuilder.CreateCylinder(name, { height: direction.length(), diameter, tessellation: 12 }, scene), material);
    mesh.position.copyFrom(a.add(b).scale(0.5));
    mesh.rotationQuaternion = B.Quaternion.FromUnitVectorsToRef(B.Vector3.Up(), direction.normalize(), new B.Quaternion());
    return mesh;
  };
  const v = (x: number, y: number, z: number) => new B.Vector3(x, y, z);

  function setRelease(progress: number) {
    release = Math.max(0, Math.min(1, progress));
    const eased = release * release * (3 - 2 * release);
    for (const jack of jacks) {
      const length = Math.max(0.08, jack.travel * (1 - eased));
      jack.tube.scaling.z = length / jack.travel;
      jack.tube.position.z = jack.startZ + length / 2;
      jack.shoe.position.z = jack.startZ + length + 0.045;
    }
  }

  function fitToVehicle(meshes: BABYLON.AbstractMesh[]) {
    if (!meshes.length) return;
    for (const mesh of root.getChildMeshes()) {
      shadows.removeShadowCaster(mesh);
      mesh.dispose();
    }
    jacks.length = 0;
    meshes.forEach(mesh => mesh.computeWorldMatrix(true));
    const bounds = meshes.map(mesh => mesh.getBoundingInfo().boundingBox);
    const minX = Math.min(...bounds.map(b => b.minimumWorld.x));
    const maxX = Math.max(...bounds.map(b => b.maximumWorld.x));
    const minY = Math.min(...bounds.map(b => b.minimumWorld.y));
    const maxY = Math.max(...bounds.map(b => b.maximumWorld.y));
    const minZ = Math.min(...bounds.map(b => b.minimumWorld.z));
    const maxZ = Math.max(...bounds.map(b => b.maximumWorld.z));
    const centerX = (minX + maxX) / 2 - origin.x;
    const halfWidth = Math.max(1.6, (maxX - minX) / 2 + 0.36);
    // Every fixed member sits behind the entire model, including wings and gear.
    const backZ = minZ - origin.z - 0.68;
    const height = (maxY - minY) * 0.72;
    const deckY = height * 0.69;
    Object.assign(footprint, {
      minX: Math.min(minX - 0.3, origin.x + centerX - halfWidth - 0.42),
      maxX: Math.max(maxX + 0.3, origin.x + centerX + halfWidth + 0.42),
      minZ: origin.z + backZ - 1.2,
      maxZ: maxZ + 0.3,
    });
    for (const side of [-1, 1]) {
      const x = centerX + side * halfWidth;
      for (const dz of [-0.11, 0.11]) box(`gantry-I-flange-${side}-${dz}`, 0.24, height, 0.055, x, height / 2 + 0.15, backZ + dz);
      box(`gantry-I-web-${side}`, 0.065, height, 0.22, x, height / 2 + 0.15, backZ);
      box(`gantry-concrete-plinth-${side}`, 0.86, 0.15, 1.04, x, 0.075, backZ, materials.foundation);
      box(`gantry-foundation-${side}`, 0.76, 0.16, 0.94, x, 0.2, backZ, materials.dark);
      for (const dx of [-0.25, 0.25]) for (const dz of [-0.32, 0.32]) {
        const bolt = finish(B.MeshBuilder.CreateCylinder(`foundation-anchor-${side}-${dx}-${dz}`, { diameter: 0.085, height: 0.09, tessellation: 6 }, scene), materials.hardware);
        bolt.position.set(x + dx, 0.31, backZ + dz);
      }
      for (const y of [0.5, height * 0.5, height - 0.18]) {
        box(`gantry-bolted-gusset-${side}-${y}`, 0.33, 0.4, 0.045, x, y, backZ - 0.16, materials.paint);
      }
      beam(`gantry-outrigger-${side}`, v(x, 0.34, backZ - 1.02), v(x, height * 0.6, backZ), 0.11);
      box(`gantry-outrigger-foot-${side}`, 0.44, 0.12, 0.42, x, 0.18, backZ - 1.02);
    }
    for (const y of [0.5, height / 2, height]) box(`gantry-cross-channel-${y}`, halfWidth * 2 + 0.24, 0.19, 0.24, centerX, y, backZ);
    for (const side of [-1, 1]) beam(`gantry-rear-diagonal-${side}`, v(centerX - halfWidth + 0.12, side < 0 ? 0.6 : height - 0.2, backZ - 0.15), v(centerX + halfWidth - 0.12, side < 0 ? height - 0.2 : 0.6, backZ - 0.15), 0.07);

    // A correctly connected deck: close-spaced steel grating, toe board and rails.
    const deckWidth = halfWidth * 2 - 0.28;
    const slats = Math.ceil(deckWidth / 0.1);
    for (let i = 0; i < slats; i++) box(`gantry-grating-${i}`, 0.038, 0.055, 0.78, centerX - deckWidth / 2 + i * deckWidth / slats, deckY, backZ - 0.5, materials.dark);
    for (const dz of [-0.9, -0.1]) box(`gantry-deck-channel-${dz}`, deckWidth, 0.14, 0.06, centerX, deckY - 0.08, backZ + dz);
    box("gantry-toe-board", deckWidth, 0.13, 0.035, centerX, deckY + 0.08, backZ - 0.9, materials.paint);
    for (const x of [centerX - halfWidth + 0.16, centerX, centerX + halfWidth - 0.16]) beam(`gantry-rail-upright-${x}`, v(x, deckY, backZ - 0.9), v(x, deckY + 0.95, backZ - 0.9), 0.045);
    for (const y of [deckY + 0.48, deckY + 0.95]) beam(`gantry-safety-rail-${y}`, v(centerX - halfWidth + 0.16, y, backZ - 0.9), v(centerX + halfWidth - 0.16, y, backZ - 0.9), 0.045, materials.paint);
    const ladderX = centerX + halfWidth - 0.46;
    for (const dx of [-0.2, 0.2]) beam(`gantry-ladder-stringer-${dx}`, v(ladderX + dx, 0.28, backZ - 0.97), v(ladderX + dx, deckY + 0.9, backZ - 0.97), 0.05);
    for (let y = 0.4; y < deckY; y += 0.28) beam(`gantry-ladder-rung-${y}`, v(ladderX - 0.2, y, backZ - 0.97), v(ladderX + 0.2, y, backZ - 0.97), 0.032);

    // Raycast the actual rear surface at each shoe. No guessed fuselage depth.
    for (const ratio of [0.3, 0.56]) {
      const railY = minY + (maxY - minY) * ratio - origin.y;
      box(`gantry-adjuster-rail-${ratio}`, halfWidth * 2, 0.16, 0.2, centerX, railY, backZ);
      for (const side of [-1, 1]) {
      const x = origin.x + centerX + side * 0.3;
      const worldY = minY + (maxY - minY) * ratio;
      const ray = new B.Ray(v(x, worldY, minZ - 2), B.Vector3.Forward(), maxZ - minZ + 4);
      const hit = ray.intersectsMeshes(meshes, false).find(pick => pick.hit && pick.pickedPoint);
      if (!hit?.pickedPoint) continue;
      const localX = x - origin.x;
      const y = worldY - origin.y;
      const startZ = backZ + 0.15;
      // Fit the complete pad face, including its corners, outside the skin.
      // A center-only ray can let a flat shoe cut into a curved fuselage.
      let surfaceZ = hit.pickedPoint.z;
      for (const dx of [-0.16, 0, 0.16]) for (const dy of [-0.135, 0, 0.135]) {
        const cornerRay = new B.Ray(v(x + dx, worldY + dy, minZ - 2), B.Vector3.Forward(), maxZ - minZ + 4);
        const corner = cornerRay.intersectsMeshes(meshes, false).find(pick => pick.hit && pick.pickedPoint);
        if (corner?.pickedPoint) surfaceZ = Math.min(surfaceZ, corner.pickedPoint.z);
      }
      const contactZ = surfaceZ - origin.z - 0.008;
      const travel = Math.max(0.12, contactZ - startZ - 0.09);
      box(`gantry-jack-carriage-${ratio}-${side}`, 0.4, 0.32, 0.34, localX, y, backZ, materials.paint);
      const tube = box(`gantry-retracting-jack-${ratio}-${side}`, 0.11, 0.11, travel, localX, y, startZ + travel / 2, materials.hardware);
      const shoe = box(`gantry-contact-shoe-${ratio}-${side}`, 0.32, 0.27, 0.09, localX, y, contactZ - 0.045, materials.pad);
      jacks.push({ tube, shoe, travel, startZ });
      }
    }
    setRelease(release);
    console.info("[Mission 01] Gantry fitted outside NASA vehicle bounds", { minX, maxX, minZ, maxZ, contactShoes: jacks.length });
  }
  return { root, footprint, fitToVehicle, setRelease };
}
