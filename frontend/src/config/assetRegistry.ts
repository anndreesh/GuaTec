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
    usage: "Terrain, soil variation, paths, trees, fence and atmospheric set dressing.",
  },
  {
    id: "procedural-1926-experimental-rocket",
    source: "generated-in-project",
    license: "project-generated",
    usage: "Historically inspired, non-instructional visual prototype.",
  },
  {
    id: "polyhaven-wooden-crate-02",
    source: "https://polyhaven.com/a/wooden_crate_02",
    license: "CC0 1.0",
    usage: "Weathered storage crate near the field store; bundled at 1K glTF with PBR maps.",
  },
  {
    id: "polyhaven-wooden-bucket-02",
    source: "https://polyhaven.com/a/wooden_bucket_02",
    license: "CC0 1.0",
    usage: "Worn wood and metal field prop by the laboratory; bundled at 1K glTF.",
  },
  {
    id: "polyhaven-trowel-01",
    source: "https://polyhaven.com/a/trowel_01",
    license: "CC0 1.0",
    usage: "Photogrammetry hand tool in the workshop; bundled at 1K glTF.",
  },
  {
    id: "polyhaven-pbr-grounds",
    source: "https://polyhaven.com/",
    license: "CC0 1.0",
    usage: "Farm Soil, Muddy Tracks and Grass Ground 1K albedo, normal and ARM maps for the outdoor terrain.",
  },
  {
    id: "polyhaven-suburban-field-01-hdri",
    source: "https://polyhaven.com/a/suburban_field_01",
    license: "CC0 1.0",
    usage: "Bundled 1K HDR panorama for image-based outdoor lighting and reflections.",
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
