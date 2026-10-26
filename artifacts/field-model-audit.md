# Field stations and 3D asset audit — 2026-10-25

> **Update 2026-10-26:** Mission 01 now uses the project-authored, articulated 1920s field engineer as its player character. The two Mercenary astronaut variants audited below are historical audit records only; they are no longer loaded or included in the production bundle. The NASA shuttle GLB remains unchanged.

## Scope and method

Inspected the Babylon.js scene, local workshop loader, asset registry and GLB JSON/accessor/image chunks. Counts below describe source assets, not visible-frame counters. No external models were downloaded, no existing hero model was replaced, and no production FPS claim follows from these counts.

The current scene already contains five detailed outdoor tables, an engineering training apparatus, a cup anemometer, a theodolite, plate camera, open equipment shelter, analysis awning and a fitted launch support. Those assets remain useful. Their functions need clearer world feedback; replacing every table would duplicate work and increase cost.

## Implemented functional additions

`frontend/src/babylon/gameplay/FieldStations.ts` adds the following project-authored pieces:

| Role | Position x,z | Visual behavior |
| --- | --- | --- |
| Assembly | 18.5, 5.3 | Four UI components map to seven visible pieces: two support rails, two plates, two clamp rings and a registration marker. Parts seat as their exact component is fitted, in any order. |
| Mass balance | 21.5, 5.5 | Cast base, upright column, pivoted beam, hanging pans, abstract load blocks and analogue balance gauge. The pans stay vertical as the beam settles. |
| Calibration | -9.2, 8 | Protected blue three-channel instrument case with separate needles, bezels, graduations and adjustment knobs. |
| Signal | -9.2, 11.2 | Six ceramic terminal sockets and three continuity segments along the actual clean path. |
| Weather | -5.2, 12 | Louvre cabinet, analogue gauge and tapered striped flag beside the existing anemometer at -6,12. `setWeather()` synchronizes gauge and flag strength with the scene's four weather states. |
| Record recovery | 11.2, -25.4 | Upright rack with four clipped records over the existing analysis desk. Distinct identity marks and complete card groups move with the persisted ordering. |
| Route checks | 11,0 / 8,-8 / 4,-20 | Timber posts with one/two/three identity studs. Confirming inspection changes both the signal color and the physical check tab. `setRouteInspection(ids)` supports checks in any order. |

The route avoids placing a check inside the NASA vehicle/launch support around 0,-14. New large furniture exposes five simple AABB colliders; the analysis rack reuses the existing desk's footprint, and narrow route posts are visual markers rather than navigation barriers.

Every station separates `visualRoot`, `interactionRoot` and `collisionRoot`. The module uses four shared geometries, fourteen instanced shape/material batches and eight shared PBR materials. A shared chamfered box (96 vertices / 44 triangles) gives cast plates, cabinet corners, table edges and beams physical highlight planes without separate edge-trim meshes. There are no new textures, lights, particle systems or shadow casters. The 243 mesh entries include hidden geometry sources and instances; this is not a claim of 243 draw calls. Actual frame batching remains subject to Babylon's visibility/material/shadow passes and must be measured in the integrated browser scene.

`setDraft(id, draft)` applies exact input identities after aggregate progress updates: selecting the marker first reveals only its plate, recording the third dial first marks only that channel, mass positions move individual blocks between pans/tray and determine the beam torque, and signal/recovery use their persisted path/order. `setProgress(id, 1)` remains the complete-result visual state. This avoids falsely depicting leading components as finished when the player solves tasks out of order.

Animations only update while the module is active. The assembly pieces and balance settle after player input; reduced motion settles immediately and holds the flag in a stable pose. Reset clears fitted parts and route marks. Owned resources are released by an idempotent `dispose()`.

## Existing source asset costs

Sizes use decimal MB. Triangles are summed from triangle-list primitive accessors, without treating vertices as triangles or multiplying by shadow passes.

| Active asset | Transfer bytes | Source triangles | Primitives | Materials | Textures |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mercenary astronaut optimized | 80,856,792 | 704,714 | 51 | 22 | 67 |
| Mercenary astronaut balanced variant | 67,467,708 | 704,714 | 51 | 22 | 67 |
| NASA shuttle optimized | 18,559,728 | 76,637 | 93 | 64 | 53 |
| Wooden Table 03 | 634,344 | 2,298 | 6 | 1 | 3 |
| Painted wooden table | 1,778,568 | 600 | 1 | 1 | 3 |
| Metal office desk | 1,601,112 | 6,898 | 9 | 1 | 3 |
| Wooden stool | 960,828 | 10,946 | 1 | 1 | 3 |
| Metal toolbox | 2,742,644 | 14,228 | 6 | 1 | 3 |
| Adjustable wrench | 2,640,088 | 5,390 | 3 | 1 | 3 |
| Oil lamp | 2,159,680 | 7,208 | 3 | 3 | 8 |
| Welding cart | 3,504,664 | 29,418 | 2 | 2 | 6 |
| Metal rack | 2,008,200 | 6,372 | 1 | 1 | 3 |

The astronaut contains 52 embedded 2048×2048 images, twelve 1024×1024 images, two 128×128 images and one 4096×4096 image; its embedded image bytes total 33,287,125. Its three animation clips are `Mixamo Walk`, `Mixamo Idle` and `Mixamo Running`. Any offline reduction must preserve the rig and all three clips.

The shuttle has 64 source materials for 93 primitives and 53 textures. Its embedded image bytes total 11,240,728. The NASA logo, measured placement, nozzle/launch attachment and silhouette must survive material consolidation or LOD authoring.

Other bundled optimized building/tree models are not imported by the current playable field. Their repository presence alone is not evidence that they affect a mission frame. Large untracked originals exist locally; the optimized files are the source-controlled variants used by the mission.

## Follow-up optimizations implemented

### Shared workshop instances and ownership

`WorkshopAssets.ts` now requests real unskinned instances (`doNotInstantiate: false`), retaining Babylon's automatic clone path for hierarchy-only or skinned nodes. Source materials remain shared; their source meshes receive shadows instead of trying to set an ineffective property on an `InstancedMesh`. Small hand tools, toolbox internals and oil lamps no longer enter the shadow list. Large tables and storage props retain silhouette shadows.

The placement roots are owned by the loader. Disposal removes their shadow entries and disposes their nodes before disposing the cached containers/materials. A disposed loader refuses new placements; rejected loads are removed from the cache so a later request can retry. The measured placement/inverse-parent transform code is retained.

Chrome verification loaded two painted tables: every geometry-bearing child was an `InstancedMesh`; both tables shared one geometry and one material. The measured width remained 2.300 m and height 0.990 m under a translated parent, with a 3.000 m gap between corresponding bounds. Disposing the loader returned to zero scene meshes and materials. Babylon's shadow-map/BRDF resources remained owned by the test scene, not the loader.

### Shadow submission policy

`BackdropEngine.ts` now excludes the entire `field-station-kit` ancestry from shadow casting, rather than classifying its small instances by their unit source bounds. The policy evaluates world-space dimensions, removes shelter roof-seam/floor-board/siding microdetail from the caster list, and keeps major roofs/posts/structural forms and appropriate crew silhouettes. It adds only the selected mesh, without automatically reintroducing all descendants.

An observer marks the policy dirty when asynchronous GLBs or rebuilt support pieces add meshes. The render loop revisits the policy only while dirty, after transforms have been assigned. Thus later-loaded geometry follows the same policy as the initial scene. The quality default is `balanced`, with `high` restored only when explicitly saved, matching the HUD default. These changes reduce avoidable shadow submissions; their frame-time benefit still requires comparable integrated profiling.

### Avatar texture variant

Created `frontend/public/assets/models/mercenary_astronaut_balanced.glb` without changing the existing optimized source. A local Pillow 11.3 workflow reduced 53 embedded 2K/4K images to a maximum of 1024 pixels per side, preserved each JPEG/PNG MIME type and repacked the GLB with aligned buffer views. The other fourteen images were already at or below 1K and retained their original bytes.

The variant is 67,467,708 bytes versus 80,856,792 bytes: **13,389,084 bytes (16.56%) less transfer data**. Embedded image pixel count falls from 247,496,704 to 68,190,208 (**72.45% fewer pixels**). This pixel total is not a GPU-memory measurement; texture count and geometry cost do not decrease.

Before writing the variant, the script verified identical node, mesh, material, skin, accessor and animation definitions and identical SHA-256 hashes for all nine non-image buffer views. All 67 images decode and fit the 1K limit. Babylon/Chrome then loaded both assets with the same 52 mesh nodes, one skeleton, 22 materials, three animation clips and exact clip ranges; the measured posed bounds matched. The NASA/astronaut identity, rig, geometry and animation data are preserved.

Inspected matching front/back captures and a selected walking pose at 1100×850: face, helmet, suit folds, backpack silhouette, `CARGO` lettering, straps and visible wear remain legible. The full-frame RGB RMSE of the back-view comparison is 0.420 on a 0–255 scale; it is supporting image-difference evidence, not a universal visual-equivalence guarantee or a full motion/contact evaluation. The texture variant is intended for `balanced`; `high` can retain the original. No mid-session model replacement or new decoder/runtime dependency is needed.

Raw captures and browser data are outside the repository at `/Users/andres/.codex/visualizations/2026/10/25/01a17564-d9d3-7d12-be89-2e3bb9913e12/field-models/`: `workshop-instancing.png`, `avatar-original.png`, `avatar-balanced.png` and `model-qa.json`.

The same directory contains `station-assembly.png`, `station-mass.png`, `station-calibration.png`, `station-signal.png`, `station-weather.png`, `station-recovery.png` and `station-visual-qa.json`. These six inspected Chrome views show the isolated kit under neutral directional/environment lighting. Their measured counters were respectively 9, 12, 14, 6, 10 and 7 draw calls, including one ground mesh. This confirms hardware batching in that fixture; it does not measure the integrated game, promise a frame rate or certify the production field's budget.

## Historical follow-up assessment (superseded for the player avatar)

1. **Avatar:** this audit's proposed LOD work applied to the Mercenary model is no longer relevant: it contradicted Mission 01's 1920s character brief. The procedural period engineer is now active and carries the existing walk/run, idle, attention, breathing and blink behavior.
2. **NASA vehicle:** reduce material/submesh fragmentation, atlas compatible panels while retaining the NASA artwork, and author a distant LOD. It has substantially fewer triangles than the avatar but many more material regions.
3. **Workshop geometry LOD:** real instancing and smaller shadow lists are now implemented. Next, simplify the 10,946-triangle stool and 14,228-triangle toolbox when they are distant, and keep navigation proxies independent of visual detail. Preserve the measured placement logic.
4. **Shelter geometry:** its standing-seam roof still has 64 separately created raised ribs. The new shadow policy removes their shadow submissions; merging or instancing their static visible geometry remains a separate future optimization.
5. **Functional identity:** the new scale, assembly frame and channel panel provide distinct silhouettes. Keep improving the existing recorder and analysis desk by connecting their physical needles/cards to results before adding arbitrary decoration.
6. **Historical coherence:** the field furniture and crew support the 1926 setting; the retained astronaut and NASA shuttle deliberately remain visually anachronistic. A future historically appropriate replacement requires its own explicit art decision and provenance review, rather than being assumed in this pass.

The roadmap's <150 visible-zone draw-call target remains a measurement/optimization goal. The earlier recorded 1,597 counter includes shadow passes and must not be presented as a directly normalized before/after against a different camera or shadow configuration.

## Verification performed

- `npm --prefix frontend run typecheck` passed after the concurrent integration changes settled.
- Babylon 7.54.3 NullEngine checks passed for exact out-of-order assembly/calibration identities, individual mass-pan blocks/torque, clean signal path, four-card recovery order, out-of-order route identity, balance convergence, inactive animation freeze, finite world matrices, a nonempty active-mesh render, reset and idempotent disposal.
- Three create/use/dispose cycles each returned to zero owned meshes, materials and geometries. One cached Babylon BRDF texture remained stable across cycles. The kit created 243 mesh entries, four geometry resources, fourteen material batches, eight materials and no module-owned textures in each cycle.
- NullEngine checks passed the shadow policy's world-bound scaling, complete kit ancestry exclusion, large-roof preservation and microdetail/tool exclusion.
- The chamfer geometry's normals are finite and point outward; four shared geometry resources and clean disposal were rechecked after authoring it.
- Chrome checks passed shared workshop geometry/materials, nested-parent placement, loader disposal and original/balanced avatar structure/posed bounds. No page errors occurred in that pass.
- Six isolated kit station views rendered with no console/page errors and were visually inspected for missing faces, component identity, readable dials, pan placement and records.
- `git diff --check` was clean for the module.

NullEngine covers geometry and ownership. The Chrome fixtures cover isolated kit/asset views; integrated collision clearance and production performance still require the full game. The lead owns integrated desktop/mobile captures, frame diagnostics, real-input progression and publication verification.
