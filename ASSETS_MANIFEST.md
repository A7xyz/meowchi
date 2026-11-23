# Asset Manifest — Meowchi (My Little Cat)

## Transparency Notice
This build uses **procedural Three.js anatomy with alpha-feathered fur cards, a procedural articulated first-person 3D human hand & tool rig, procedural HTML5 Canvas coat & skin textures, and an asset-first audio engine with Web Audio API fallback synthesis**. No copyrighted or unlicensed third-party models, textures, or audio recordings are bundled.

**Important:** Synthesized fallback audio is **NOT** real cat audio recordings, and procedural geometry is **NOT** a photorealistic scanned rig. `SoundManager` automatically loads natural licensed real cat recordings when placed under `public/audio/cat/` (with stereo spatial panning, pitch variation, and cooldowns) and transparently falls back to synthesis when files are not yet supplied.

## Required Real Cat Audio Recordings (`public/audio/cat/`)

Place licensed / CC0 real feline recordings at these exact paths to replace the synthesis fallback automatically without code changes:

| Cue ID | Expected File Path | Emotion / Context |
| :--- | :--- | :--- |
| `happy_meow` | `public/audio/cat/happy_meow.ogg` | Happy relaxed meow |
| `soft_meow` | `public/audio/cat/soft_meow.ogg` | Soft affectionate meow |
| `kitten_mew` | `public/audio/cat/kitten_mew.ogg` | High delicate newborn/kitten mew |
| `attention_meow` | `public/audio/cat/attention_meow.ogg` | Attention-seeking meow (empty bowl) |
| `greeting_meow` | `public/audio/cat/greeting_meow.ogg` | Friendly greeting meow |
| `purr` | `public/audio/cat/purr.ogg` | Natural continuous cat purring |
| `trill_chirp` | `public/audio/cat/chirp.ogg` | Affectionate trill / bird-watching chirp |
| `play_chirp` | `public/audio/cat/play_vocalization.ogg` | Short playful chirp / zoomie vocalization |
| `hiss` | `public/audio/cat/hiss.ogg` | Realistic defensive cat hiss |
| `low_growl` | `public/audio/cat/growl.ogg` | Low warning growl |
| `distress` | `public/audio/cat/distress_meow.ogg` | Fearful / distressed meow |
| `bite_snap` | `public/audio/cat/defensive_snap.ogg` | Sharp defensive hiss-snap |
| `drink` | `public/audio/cat/water_lapping.ogg` | Realistic cat water-drinking lapping |
| `eat` | `public/audio/cat/eating_kibble.ogg` | Cat eating kibble / soft food |

## 3D Model & Rig Replacement Hooks

| Asset ID | Current Implementation | Target Production Asset | Mobile Budget | Replacement Hook |
| :--- | :--- | :--- | :--- | :--- |
| `cat_rig_fluffy` | Procedural breed-morphed articulated mesh + layered alpha fur cards (`src/engine/CatRig.ts`) | Rigged anatomically realistic feline `.glb` with breed/age/weight blendshapes & facial bones | 14k–22k tris, 1x 2048px PBR | `src/engine/CatRig.ts` |
| `player_human_hand` | Articulated procedural 3D hand + skin texture + care props (`src/engine/HumanHandRig.ts`) | Skinned PBR first-person human hand `.glb` with finger bone rig & care prop sockets | 4k–8k tris, 1x 1024px PBR | `src/engine/HumanHandRig.ts` |
| `auto_cat_equipment` | Animated procedural 3D meshes for Water Fountain, Auto Feeder, Auto Litter Box, Smart Bed & Auto Toy (`src/engine/RoomBuilder.ts`) | Optimized PBR `.glb` appliances with animated drum/water/arm bones | 6k–10k tris combined | `src/engine/RoomBuilder.ts` |
| `room_living_shell` | Procedural sunlit room + window + furniture (`src/engine/RoomBuilder.ts`) | Baked-lightmap cozy interior `.glb` + PBR furniture set | 10k–15k tris total | `src/engine/RoomBuilder.ts` |
| `toys_interactive` | Procedural feather wand, yarn ball, toy mouse (`src/engine/ToyController.ts`) | Optimized low-poly PBR `.glb` toys | < 1.5k tris total | `src/engine/ToyController.ts` |
