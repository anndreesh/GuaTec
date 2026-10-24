/**
 * Asset provenance for Mission 1. External assets are bundled locally so the
 * running scene never contacts an asset CDN.
 *
 * NASA's official 3D catalogue is retained as the approved reference source
 * for a future historically appropriate asset review.
 */
export const MISSION_1_ASSET_REGISTRY = [
  {
    id: "procedural-auburn-field",
    source: "generated-in-project",
    license: "project-generated",
    usage: "Open test field with generated rolling relief, deterministic soil color noise, short boardwalks, and restrained atmospheric effects.",
  },
  {
    id: "polyhaven-pbr-grounds",
    source: "https://polyhaven.com/",
    license: "CC0 1.0",
    usage: "Farm Soil normal and ARM maps, plus Muddy Tracks and Grass Ground albedo, normal and ARM maps for terrain details.",
  },
  {
    id: "polyhaven-workshop-glbs",
    source: "https://polyhaven.com/models/",
    license: "CC0 1.0",
    usage: "Nine locally bundled 1K PBR models: Wooden Table 03, Painted Wooden Table, Metal Office Desk, Wooden Stool 01, Metal Toolbox, Adjustable Wrench, Vintage Oil Lamp, Portable Welding Cart and Worn Metal Rack. Per-model sources, sizes and SHA-256 hashes: /assets/workshop/sources.json. Rebuild: tools/download_workshop_assets.py.",
  },
  {
    id: "nasa-3d-resources-repository",
    source: "https://github.com/nasa/NASA-3D-Resources",
    license: "NASA repository usage guidelines apply",
    usage: "Official free models/textures repository reviewed as an approved future source.",
  },
] as const;
