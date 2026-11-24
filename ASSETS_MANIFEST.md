# Asset Manifest — Meowchi (2D Sprite Edition)

## Transparency & Provenance Notice

Meowchi has been converted from 3D Three.js to a **Phaser 3 2D Sprite-Based Portrait (9:16) Cat Simulation Game**.

This manifest documents **exact provenance** for every visual and audio asset in the project without fabricating completed final art where image-generation quota limits were reached.

### Image Generation Status
During sprite generation in this session, direct AI image generation (`gemini-3.1-flash-image`) produced the room background, all 22 furniture/equipment/toy sprites across 3 atlases, the flagship semi-realistic fluffy kitten master & 4 multi-frame kitten locomotion sheets (31 unique AI-painted poses), and both Male & Female Chibi master character illustrations before returning `429 RESOURCE_EXHAUSTED / QUOTA_EXHAUSTED` (quota reset ~4h55m).

To ensure **every required action is genuinely animated with multi-frame transparent PNG sprite sheets + Phaser 3 JSON atlases** (with zero emojis, zero geometric placeholders, and zero static-image translation fakes), the remaining action sheets were generated via our seamless continuous 2D mesh-skinning pipeline (`scripts/build_all_sprites.mjs`) directly from the final AI character masters and clearly flagged as `interim_articulated_from_ai_master` in `public/sprites/manifest.json`.

---

## 1. Final AI-Generated 2D Assets (`status: "final_ai_generated"`)

| Asset Path | Description | Format / Size | Status |
| :--- | :--- | :--- | :--- |
| `public/sprites/room/cozy_living_room_bg.png` | Sunlit Scandinavian-Japanese 9:16 portrait living room interior | PNG 720×1280 | **Final AI** |
| `public/sprites/props/props_care.png` + `.json` | 8 care props: plush bed, rattan basket, empty & full ceramic food bowl, water bowl, litter box, sisal scratching post, cardboard box | PNG Atlas 1024×512 (8 frames) | **Final AI** |
| `public/sprites/props/props_living.png` + `.json` | 8 living & toy props: linen sofa, oak coffee table + mug, 2-tier oak cat tower, tripod floor lamp, cream rug, terracotta rug, yarn ball, wind-up mouse | PNG Atlas 1024×512 (8 frames) | **Final AI** |
| `public/sprites/props/props_equipment.png` + `.json` | 6 automatic equipment & toy props: water fountain, auto feeder, auto litter box, smart heated bed, auto spinning cat toy, wooden feather wand | PNG Atlas 768×512 (6 frames) | **Final AI** |
| `public/sprites/cat/master_portrait.png` | High-detail semi-realistic fluffy cream-white kitten master portrait | Transparent PNG 384×384 | **Final AI** |
| `public/sprites/cat/walk.png` + `.json` | Fluffy kitten 4-beat walking cycle | Transparent PNG Atlas (8 frames) | **Final AI** |
| `public/sprites/cat/run.png` + `.json` | Fluffy kitten galloping/running cycle | Transparent PNG Atlas (10 frames) | **Final AI** |
| `public/sprites/cat/jump.png` + `.json` | Fluffy kitten crouch-launch-leap-descend cycle | Transparent PNG Atlas (10 frames) | **Final AI** |
| `public/sprites/cat/zoomies.png` + `.json` | Fluffy kitten high-energy zoomies cycle | Transparent PNG Atlas (12 frames) | **Final AI** |
| `public/sprites/human/female/master_portrait.png` | Painterly 2D Chibi female owner master character | Transparent PNG 384×384 | **Final AI** |
| `public/sprites/human/male/master_portrait.png` | Painterly 2D Chibi male owner master character | Transparent PNG 384×384 | **Final AI** |

---

## 2. Interim Articulated Sprite Sheets (`status: "interim_articulated_from_ai_master"`)

Derived from the final AI-generated character masters via `scripts/build_all_sprites.mjs`. All sheets pass automated QA (`transparentCorners=true`, `emptyFrames=0`, `clippedFrames=0`, `avgInterFrameDiff > 0`). Replacing any sheet with a freshly AI-generated sprite sheet requires **zero code changes** — drop the new PNG/JSON into the same path (or update `RAW_SOURCES` in `scripts/build_all_sprites.mjs`). Exact replacement AI prompts are stored per action inside `public/sprites/manifest.json`.

### Cat Actions (29 Interim Sheets + 4 Direct AI Sheets = 33 Total)
- **Movement:** `idle` (8f), `land` (6f), `turn` (6f), `sit` (6f), `lie_down` (8f), `sleep` (8f) *(plus final AI `walk` 8f, `run` 10f, `jump` 10f)*
- **Emotions:** `happy` (8f), `affectionate` (8f), `curious` (8f), `fearful` (8f), `defensive` (8f), `hiss` (8f), `growl` (8f), `bite` (8f), `pounce` (10f)
- **Care:** `eat` (10f), `drink` (10f), `groom` (10f), `pet_accept` (8f), `brush_react` (8f), `picked_up` (10f), `carried` (8f), `litter` (8f)
- **Special:** `chase_toy` (10f), `knead` (10f), `stretch` (8f), `yawn` (8f), `head_rub` (8f), `tail_swish` (8f) *(plus final AI `zoomies` 12f)*

### Multi-Breed & Coat Customization
- Runtime luminance-preserving 2D canvas recoloring (`src/engine/SpriteCustomizer.ts`) + breed morphology scaling + age growth scaling (`newborn` → `senior`) renders all **10 cat breeds**, **7 fur colors**, **7 fur patterns**, **6 eye colors**, and **4 accessories** on top of the flagship fluffy kitten sprite library.
- **Missing dedicated per-breed source sheets:** Dedicated hand-generated AI base sprite sheets for each of the other 9 individual breed silhouettes (Persian, British Shorthair, Maine Coon, Ragdoll, Siamese, American Shorthair, Bengal, Munchkin, Thai Mixed) and dedicated growth-stage source sheets (newborn vs. senior) remain pending image-generation quota reset.

### Chibi Human Actions (17 Female + 17 Male = 34 Interim Sheets)
- **Female (`public/sprites/human/female/*.png`):** `idle` (8f), `walk` (8f), `run` (8f), `turn` (6f), `sit` (6f), `kneel` (8f), `bend` (8f), `pet_cat` (8f), `brush_cat` (8f), `pour_food` (8f), `refill_water` (8f), `hold_cat` (8f), `put_cat_down` (8f), `play_toy` (8f), `clean_litter` (8f), `use_equipment` (8f), `react_bite` (8f)
- **Male (`public/sprites/human/male/*.png`):** identical 17 action sheets derived from `human_male_ref`
- **Customization:** Zone-aware luminance-preserving runtime recoloring in `src/engine/SpriteCustomizer.ts` seamlessly applies skin tones, hair colors, top colors, bottom colors, and footwear colors across every animation frame without seams. Dedicated per-hairstyle silhouette sprite layers (10 hairstyles) and per-garment silhouette layers (skirt/pleated skirt/shorts/hoodie/sweater) remain pending image-generation quota reset.

---

## 3. Audio Assets (`public/audio/cat/`)

`SoundManager` (`src/audio/SoundManager.ts`) preserves its asset-first audio pipeline with Web Audio API fallback synthesis. Place licensed / CC0 real feline `.ogg` recordings under `public/audio/cat/` to replace synthesized cues automatically.
