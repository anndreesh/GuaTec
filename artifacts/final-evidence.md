# Mission 01 verification — 2026-10-25

## Scope and preserved behavior

Extended the existing TypeScript/Babylon.js game. No React/Three.js migration, added runtime library, new external asset download or replacement of detailed imported hero models. Retained all eleven objectives, optional historical records, engineering design/budget choices, mechanical diagnosis/risk decision, launch delay cost, launch cameras, three analysis tasks, reports, campaign unlocks and guest/API flows.

Five reusable validated tasks now drive progression: fictional pressure/thermal balance, four-circuit pointer/keyboard routing, dual-axis antenna calibration, comparative electronic diagnosis/replacement, ordered launch relays with cancellable hold. The antenna/electronics are labeled interpretive educational simulations. Each supports error feedback, retry, audio events and disposal. Completed results are saved, canceled drafts earn no credit, and completed legacy saves migrate without losing checkpoints. Mandatory dialogue acknowledgment now precedes its corresponding objective credit. Accepted autosaves serialize and drain before completing/resetting a mission.

World changes: authored copper/porcelain training instruments, moving antenna/relays, state lamps and dials; proportional articulated period crew with shared materials; linear PBR data maps; ACES; soft particles/contact shadows; quality profiles; reduced ground topology. Terrain changes reserve 192×192 cells for the playable field and 64×64 distant cells, reducing base ground triangles from 524,288 to 81,920. The coarse skirt is kept below the playable terrain to prevent intersections.

## Commands actually run

- `npm --prefix frontend test`: 20 passing state/engineering validation tests, including wrong inputs, prerequisite order, current save validation and legacy migration.
- `node frontend/tests/mission01-character.test.mjs`: NullEngine geometry/animation/ownership checks pass. Four crew members use 80 merged meshes, 10 materials, five wool textures. Joint boot movement is measured; translated roots remain correct; all vertices finite. Three recreate/dispose cycles return to zero meshes/materials and one stable cached BRDF texture. This is not GPU leak proof.
- `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `git diff --check`: pass. Vite's existing >500 kB chunk warning remains.
- Chrome real-input progression exercised project/director/team/prototype/design, all five tasks, structural trace, mechanical diagnosis, launch briefing/countdown/flight, all three analysis tasks and final report. Wrong circuits/antenna/propulsion/diagnosis/relay order and short authorization hold are rejected. Cancellation earns no task credit. Pointer drag and keyboard circuit completion both work. No console/page errors in the passing run.
- Reloaded the saved flight checkpoint: five tasks and all earned objectives restored. Final analysis reached 100% and produced the existing report flow.
- Compiled Vite production preview: fresh guest → opening/tutorial → real WASD → collision with project table → jump/orbit → ES/EN/FR task copy → portrait/landscape → sound mute. WASD moved ~1.995 m; table collision stopped the player at z = −2.03 m, outside its expanded footprint. No console/page errors. No horizontal overflow at 390×844. Verified 844×390 landscape separately.
- Eight task open/close cycles leave scene material/texture counts unchanged (153 / 197).

## Performance measurement and limits

Chrome headless, Apple M5, 16 GB, 1440×900, DPR 1, warmed production preview at project table. 120 requestAnimationFrame samples per quality profile. Balanced: ~60 FPS, median 16.7 ms, p95 16.7 ms. High: ~60 FPS, median 16.7 ms, p95 16.7 ms. This is a small measured sample, not a universal performance guarantee. At DPR 1 the profile comparison primarily changes shadows, not pixel density.

Representative frame: 1,597 draw calls including shadow passes, 286 active meshes, 734,621 active vertices, 153 scene materials, 197 scene textures. These are Babylon counters; vertices are not triangles and texture count is not GPU byte usage. Draw-call/texture totals exceed the skill's advisory desktop/mobile budgets. Existing imported avatar (~77 MB / 538,589 vertices) and shuttle (~18 MB), their materials and shadows remain major costs; preserving these detailed assets was intentional. No broad mobile FPS or GPU-memory claim is made. No new postprocessing dependency/pipeline was added.

## Evidence

Captures/JSON are outside the repository at `/Users/andres/.codex/visualizations/2026/10/25/01a1742f-bc67-7af3-b94c-2b4fcd12a665/`:

- `circuits-validated.png`, `antenna-validated.png`, `diagnosis-validated.png`, `launch-validated.png`, `launch-flight.png`, `mission-report.png`.
- `local-qa-results.json`: restored checkpoint, resource counters, analysis/report pass.
- `release-world-desktop.png`, `release-world-landscape.png`, `release-circuits-mobile.png`, `release-jump.png`, `release-qa-results.json`: compiled-build input/layout/profile verification.
- `final-progression/`: passing reusable compiled-game harness output through the report.
- `motion/walk-*.png`, `motion/stopped.png`, `motion/run-*.png`: unpaused real-input locomotion sequence; inspected for moving limbs, start/stop transitions and gross rig collapse. No exact foot-slip measurement or cross-device animation guarantee.
- `interaction-prompt-centered.png`: prompt animation retains horizontal centering; measured center x=600 at viewport width1200.

Screenshots are verification captures, not deterministic pixel-diff baselines: weather/crew/particles remain variable. The browser harness asserts progression and input behavior; the state and NullEngine suites protect correctness/resource lifetime. Earlier `*-failure.png` files record failures found and fixed during implementation, not passing evidence.

## Visual rubric and sourcing

Read all user-named installed skills plus director gameplay/UI/release references, adapting their engine-independent principles to Babylon. Inspected the packaged visual anchors. No comparable pre-change capture was taken, so before scores are unavailable. Conservative after assessment (0–3): art direction 2; hero/player 2; physical station constraints 2; interactables 2.5; world 2; materials 2; lighting 2; motion/VFX 2; HUD 2.5; performance evidence 2 (average 2.1). This does not certify AAA/showcase quality. The sparse historical field, retained anachronistic astronaut/shuttle and expensive source assets remain the main limits; no premium-score inflation or invented before/after FPS comparison is used.

Reviewed credential probe reports Tripo/Gemini/ElevenLabs keys missing. Existing locally bundled licensed workshop/PBR assets were reused; new apparatus and clothing geometry are project-authored. No generated asset task IDs exist and no paid job was submitted. Original asset provenance stays in `assetRegistry.ts` and `public/assets/workshop/sources.json`.

## Publication

Publish focused commits to the existing `anndreesh/GuaTec/main` production pipeline and verify the `Vercel – gua-tec` status and `https://gua-tec.vercel.app` asset/guest behavior. The graphics commit is `59be4fee09aaf5d98f302b8ccfeead05970646c3`; its main Vercel check succeeded and the public bundle contains the new training apparatus, tailored crew and input APIs. Do not change the unrelated `gua-tec-n78y` project; its preexisting backend check failure is separate. Final deployment results and commit identifiers are recorded after commit in the private `/Users/andres/.codex/Cambios.md` file.
