# Asset Manifest — Meowchi (My Little Cat)

## Transparency Notice
This release uses **procedural Three.js anatomy with alpha-feathered fur cards, procedural HTML5 Canvas coat textures (7 patterns × 7 colors), and context-aware Web Audio API feline vocalization synthesis**. No copyrighted third-party models, textures, or audio files are bundled.

**Temporary procedural geometry and synthesized audio are NOT final photorealistic rigged models or natural feline recordings.** Every system is architected so licensed production assets can drop in cleanly without rewriting gameplay logic.

## Current Procedural Placeholders & Target Production Replacements

| Asset ID | Current Implementation | Target Production Asset | Mobile Budget | Replacement Hook |
| :--- | :--- | :--- | :--- | :--- |
| `cat_rig_fluffy` | Procedural breed-morphed articulated mesh + layered alpha fur cards (`src/engine/CatRig.ts`) + procedural coat maps (`src/engine/textures.ts`) | Rigged anatomically realistic feline `.glb` with breed/age/weight blendshapes, eyelid/jaw/ear facial bones & optimized fur shell/alpha cards | 14k–22k tris, 1x 2048px albedo/normal/roughness | `src/engine/CatRig.ts` |
| `cat_audio_vocals` | Web Audio API context-aware synthesis (`src/audio/SoundManager.ts` — 10 vocalization states with pitch/volume/timing variation & cooldowns) | Licensed/CC0 natural feline audio recordings (soft meow, greeting meow, kitten mew, purr loop, trill/chirp, hiss, low growl, sleepy sigh) `.ogg`/`.mp3` | < 2.5 MB compressed | `src/audio/SoundManager.ts` |
| `room_living_shell` | Procedural sunlit room + window + furniture (`src/engine/RoomBuilder.ts`) | Baked-lightmap cozy interior `.glb` + PBR furniture set | 10k–15k tris total | `src/engine/RoomBuilder.ts` |
| `toys_interactive` | Procedural feather wand, yarn ball, toy mouse (`src/engine/ToyController.ts`) | Optimized low-poly PBR `.glb` toys | < 1.5k tris total | `src/engine/ToyController.ts` |
