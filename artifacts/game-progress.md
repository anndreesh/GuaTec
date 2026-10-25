# Mission 01 engineering upgrade

Intent: extend the existing Babylon.js/TypeScript game, preserving 1926 Auburn narrative, imported assets, all mission objectives, analysis, camera modes, guest auth and API contracts. No engine migration or new runtime dependencies.

Design brief: fictional field engineer learns through inspecting, connecting, tuning and diagnosing. Repeated loop: walk to active station, read crew briefing, solve short engineering abstraction, validate, save checkpoint, reach next station. Wrong inputs provide clues and free retry; cancellation never grants credit. Engineering design/risk choices keep their existing consequences.

Core loop: player solves instrument tasks to unlock the historical demonstration; ordered prerequisites prevent shortcuts; successful validation persists progress. Radio/propulsion/electronics panels are explicitly fictional educational simulations, not historical equipment claims or operating instructions.

Level plan: preserve outdoor project desk → director → three team members → prototype → engineering bench → test bench → prototype diagnosis → launch field → observation → analysis. All stages and optional records retained. No extra buildings or modern spaceport.

Implementation ownership: lead state, integration, HUD, audio, QA, release; visual worker Babylon modules; task worker reusable EngineeringMinigames UI/CSS.

Audit: existing task modals only pause narrative boolean, not world input; dialogue actions often grant objectives before choice acknowledgement; prior checklist grants progress through five simple toggles. Existing detailed GLBs and PBR textures must remain. Installed skills requested by user all present; adapted engine-independent principles to Babylon.js. Tripo/Gemini/ElevenLabs credentials missing after reviewed profile probe, use existing licensed assets.

Verification contract: strict progression/save migration, controls suspension, five tasks, HUD/minimap, profiles, compiled-game progression/error/retry/persistence checks and primary-production publication. Deployment limited to gua-tec; do not change gua-tec-n78y.

Completed: five validated task components, translated ES/EN/FR copy, strict centralized progression and legacy migration; modal/camera suspension, cancellation/focus handling, serialized saves; compact objective/minimap HUD; graphics/terrain/crew/instruments/quality profiles. State suite 20 passing, NullEngine ownership pass, real-input full mission and compiled preview input/layout pass. Temporary local QA exposure removed from main.ts and confirmed absent from built assets.

Graphics commit 59be4fe and gameplay/HUD commit 296991a published to main; both primary Vercel statuses succeeded and public bundles changed. Final capture review also fixed prompt-entry centering, measured at x=600 on a 1200px viewport. Compiled-game guest progression passes through final report; unpaused walk/start/stop/run frame captures were inspected without gross rig collapse or frozen locomotion. Final host verification records belong in the private Cambios.md log after publication. See final-evidence.md for measured limits; no AAA certification claimed.

Public compiled-game harness completed at fbea8e2 with all eleven objectives, five validated tasks and report, zero page/console errors. Follow-up launch visibility pass removes inherited modal blur/tint, frames vehicle center and restores cinematic camera collisions after flight; compiled browser fixture verified three camera keys and normal-control restoration.
