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
    id: "procedural-1926-experimental-rocket",
    source: "generated-in-project",
    license: "project-generated",
    usage: "Historically inspired, non-instructional visual prototype.",
  },
  {
    id: "polyhaven-pbr-grounds",
    source: "https://polyhaven.com/",
    license: "CC0 1.0",
    usage: "Farm Soil normal and ARM maps, plus Muddy Tracks and Grass Ground albedo, normal and ARM maps for terrain details.",
  },
  {
    id: "nasa-3d-reference-catalogue",
    source: "https://science.nasa.gov/3d-resources/",
    license: "NASA catalogue terms apply to any future downloaded asset",
    usage: "Official catalogue reviewed; no Auburn-1926-compatible model was found, so no anachronistic NASA vehicle was downloaded.",
  },
  {
    id: "nasa-3d-resources-repository",
    source: "https://github.com/nasa/NASA-3D-Resources",
    license: "NASA repository usage guidelines apply",
    usage: "Official free models/textures repository reviewed as an approved future source.",
  },
] as const;
