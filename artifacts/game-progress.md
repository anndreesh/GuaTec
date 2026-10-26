# Apollo 11 reconstruction · 2026-10-26

Intent: replace the existing 1926 Mission 01 with a complete, outdoor Kennedy Space Center Apollo 11 experience on July16,1969. Preserve existing authentication, guest flow, mission slug and Flask progress API; the old Babylon mission remains source-only, inactive. New mission uses a lazy Three.js renderer in the existing Vite/TypeScript SPA (the original application did not use React).

Design brief: a fictional NASA support technician observes, identifies, records and verifies information, building toward witnessing the Saturn V launch. Daniel Carter is a fictional radio supervisor. Historical astronauts have no invented speech. Wrong answers provide a clue and free retry; only verified active actions advance. No interior gameplay or launch controls.

Core-loop contract: navigate to the sole active exterior station, identify its historical context, validate a support record, save the checkpoint and unlock the next location. State and interaction proximity both gate progress. Success changes persistent state; cancellation and incorrect answers award no credit. Restart affects only Mission01.

Level plan: orientation(-35,130),recognition(-70,165),documentation(-100,220),radio(70,235),retrospective crew(0,150),observation staging(0,355),then transfer to physical remote launch observation(0,5600). Hero rocket110.6m; route geography compressed; distant observing lens and5.6km sound delay. Crew cinematic24s then4s black elision; launch60s after ten-second countdown. Epilogue mentions July20 separately.

Art direction: bright coastal Florida morning, white/black Saturn V and red lattice tower, authored procedural industrial infrastructure, exterior VAB without modern facade murals, scrub/palms/marsh/Atlantic horizon. User-supplied Mercenary astronaut CC-BY4.0 optimized from500MB to4.9MB with meshopt and three preserved clips; three cinematic clones. Requested Sketchfab LEGO rocket is Standard/non-downloadable10.3Mfaces, so educational official Viewer API stays separate from original launch-world rocket.

Implemented: FSM and nine focused tests; strict action prerequisites, corrupt/legacy-save rejection; bounded input/collisions, world and crew animation, cinematics, HUD/minimap, modular dialogue queue, local plus serialized backend save, original synthesized ambience/music/launch audio, low/medium/high quality, legal educational viewer.

Current verification: state and legacy tests pass; typecheck/production build pass. Compiled guest browser playthrough and visual/performance evidence in progress; review caught duplicate M handling, focused-button controls, stale local/cloud save ordering and engine audio tail, now repaired. Next: real-input end-to-end browser pass, all quality profiles, save/reentry/restart, historical/asset docs, focused commit, production push/status and private Cambios.md entry.

Final local verification:40 frontend tests and7 isolated backend endpoint tests pass. Compiled Chrome guest playthrough covers eight checkpoints via real held input, wrong answer rejection, partial save/menu reentry, complete recovery, reset and solid station collision; zero console/network errors. Separate cinematic fixture completes full36s intro,24s crew plus4s blackout, confirms audioContext running, restricted boundary z100.001 and solid building wall z211.666. Responsive390x844 test confirms pause/language controls do not overlap; map,zoom,quality,mute work. Hardware ANGLE Metal AppleM5: active profiles ~60FPS,113calls/198988triangles low;221calls/361096triangles medium/high atDPR1. Postlaunch259calls; crew fixture374calls/924710triangles, documented budget tradeoff. Captures/video and reports are in artifacts/apollo11. Remaining:commit,publish,production check,private Cambios.md record.

Public verification update:main reconstruction and minimap-heading fix deployed successfully. Full public guest playthrough completed8/8,partial/full recovery andreset; it exposed an intermittent pendingAudioContext.resume rejection on navigation. Audio teardown now consumes pending transition promises and intentional closure. Four new unit regressions pass(44frontend total),and8compiled real UI enter/pause/resume/exit/reentry cycles have zero console/network errors. Final audio fix will be deployed as its own focused commit and verified publicly.


# Interactive fieldwork upgrade · 2026-10-26

User request: play production in Safari as a guest, find and repair issues, replace dialogue-button progression with real minigames, improve world models/dialogue/HUD, add voice if possible and verify translations. The existing mission is the starting point; keep licensed Mercenary, original Saturn V, chronology, exterior-only gameplay and saves.

Safari baseline: new guest SafariApollo7264, production loaded and intro started. Current tasks are answer buttons; all Apollo UI remains Spanish across language changes; oversized central modal and silent narration reduce immersion. Splash still incorrectly claims only Mars exploration. External Tripo/Gemini/ElevenLabs credentials confirmed missing; use original authored prop models and native browser speech synthesis with explicit status/fallback.

Design brief: support technician performs hands-on field measurements. The repeated loop is move → manipulate an instrument → stabilize/verify → receive a voiced result → saved next objective. Real signal/focus/records manipulation replaces trivia answers. Incorrect settings show recoverable instrument feedback; closing never earns credit. The map and field lamps keep the next action readable.

Core-loop contract: adjust aim and focus, match documentary cards and reproduce a radio pulse pattern under visible lock/sequence conditions; successful physical validation grants the corresponding existing FSM checks atomically, while mismatch resets only the current attempt. Drafts persist per user/checkpoint and survive language changes and reload. Preserve prior earned checkpoints.

Level plan: orientation scoped Saturn capture/map/physicalarrival; complex three optical observations; documentation slot-matching; radio frequency/gain lock+timed pulses; historical crew retrospective; camera aim/focus/recording; transfer to safe launch and epilogue. All remain educational support abstractions.

Ownership: lead Safari play, root integration, HUD/dialogue presentation, draft save, QA/publication/private memory. Instrument worker new rules/panels only; voice worker locale/voice/dialogue only; visual worker world/props only. New props: detailed receiver/CRT, optical camera, document equipment, period van/service kit and soft smoke. Target no regression in scale, collider paths or performance.
