import type * as BABYLON from "@babylonjs/core";
import type { BabylonNamespace } from "./AstronautCharacter";

export type WorkshopAsset = "WoodenTable_03" | "painted_wooden_table" | "metal_office_desk" | "wooden_stool_01" | "metal_toolbox" | "adjustable_wrench" | "vintage_oil_lamp" | "portable_welding_cart" | "worn_metal_rack";

/** Shared geometry/materials, local GLBs and measured placement for field props. */
export function createWorkshopAssets(B: BabylonNamespace, scene: BABYLON.Scene, shadows: BABYLON.ShadowGenerator) {
  const containers = new Map<WorkshopAsset, Promise<BABYLON.AssetContainer>>();
  const placements = new Set<BABYLON.TransformNode>();
  let disposed = false;
  let instanceId = 0;
  const load = (asset: WorkshopAsset) => {
    let promise = containers.get(asset);
    if (!promise) {
      promise = import("@babylonjs/loaders/glTF")
        .then(() => B.SceneLoader.LoadAssetContainerAsync("/assets/workshop/", `${asset}.glb`, scene))
        .catch(error => { containers.delete(asset); throw error; });
      containers.set(asset, promise);
    }
    return promise;
  };
  async function place(asset: WorkshopAsset, parent: BABYLON.TransformNode, position: BABYLON.Vector3, size: { width?: number; height?: number; depth?: number; rotationX?: number; rotationZ?: number }, yaw = 0) {
    if (disposed || parent.isDisposed()) return null;
    try {
      const container = await load(asset);
      if (disposed || parent.isDisposed()) return null;
      const pivot = new B.TransformNode(`field-${asset}-${instanceId++}`, scene);
      pivot.parent = parent;
      pivot.rotation.set(size.rotationX ?? 0, 0, size.rotationZ ?? 0);
      // Babylon preserves the hierarchy/transforms and clones any skinned node,
      // while repeated unskinned primitives share the source draw batch.
      const instance = container.instantiateModelsToScene(name => `${pivot.name}-${name}`, false, { doNotInstantiate: false });
      for (const node of instance.rootNodes) node.parent = pivot;
      pivot.computeWorldMatrix(true);
      let bounds = pivot.getHierarchyBoundingVectors(true);
      const extent = bounds.max.subtract(bounds.min);
      const scale = size.width ? size.width / Math.max(0.001, extent.x) : (size.height ?? 1) / Math.max(0.001, extent.y);
      pivot.scaling.set(scale, size.height ? size.height / Math.max(0.001, extent.y) : scale, size.depth ? size.depth / Math.max(0.001, extent.z) : scale);
      pivot.computeWorldMatrix(true);
      bounds = pivot.getHierarchyBoundingVectors(true);
      // Ground the feet and center the measured silhouette before applying yaw.
      const model = new B.TransformNode(`${pivot.name}-placement`, scene);
      model.parent = parent;
      placements.add(model);
      model.onDisposeObservable.add(() => placements.delete(model));
      model.position.copyFrom(position);
      model.rotation.y = yaw;
      pivot.parent = model;
      // Bounds are in world space; convert their center through the parent's
      // inverse matrix so nested shelter offsets never get applied twice.
      parent.computeWorldMatrix(true);
      const inverse = parent.getWorldMatrix().clone().invert();
      const center = B.Vector3.TransformCoordinates(new B.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2), inverse);
      pivot.position.copyFrom(center.scale(-1));
      for (const mesh of pivot.getChildMeshes()) {
        const sourceMesh = mesh instanceof B.InstancedMesh ? mesh.sourceMesh : mesh;
        sourceMesh.receiveShadows = true;
        mesh.checkCollisions = true;
        mesh.isPickable = true;
        // Small hand tools and lamp internals contribute little silhouette but
        // otherwise multiply shadow passes every time a table is placed.
        if (mesh.getTotalVertices() > 0 && asset !== "adjustable_wrench" && asset !== "vintage_oil_lamp" && asset !== "metal_toolbox") shadows.addShadowCaster(mesh, false);
        if (mesh.material instanceof B.PBRMaterial) mesh.material.environmentIntensity = 0.7;
      }
      console.info(`[Mission 01] Workshop GLB ready: ${asset}`);
      return model;
    } catch (error) {
      console.warn(`[Mission 01] Could not load workshop prop: ${asset}`, error);
      return null;
    }
  }
  return {
    place,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const model of placements) {
        for (const mesh of model.getChildMeshes()) shadows.removeShadowCaster(mesh, false);
        // Materials belong to the cached source container, not each instance.
        model.dispose();
      }
      placements.clear();
      for (const promise of containers.values()) void promise.then(container => container.dispose()).catch(() => {});
      containers.clear();
    },
  };
}
