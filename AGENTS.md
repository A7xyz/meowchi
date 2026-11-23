# AGENTS.md — My Little Cat Development Guide

## Project Purpose
**My Little Cat** is a realistic 3D mobile-first cat life simulator built with TypeScript, Vite, Three.js, React, and Zustand. Primary language is Thai (`th`) with English (`en`) localization. Portrait 9:16 mobile layout.

## Architecture Overview
- `src/types/` — Core TypeScript domain types (`cat`, `furniture`, `save`, `game`, `i18n`).
- `src/config/` — Static catalogs, life-stage rules, personality modifiers, furniture/shop catalog, daily tasks, achievements.
- `src/i18n/` — Thai (`th`) and English (`en`) translation dictionaries and helper hook.
- `src/simulation/` — Pure TypeScript simulation logic (headless, unit-testable with Vitest):
  - `growth.ts` — Continuous age progression, 5 life stages, anatomical proportions, age-appropriate constraints.
  - `needs.ts` — Gradual need decay, offline catch-up capping, care interaction resolvers, refusal logic.
  - `bond.ts` — Bond level (1–100) progression & behavioral unlock queries.
  - `catAI.ts` — 16-state FSM + utility-scored personality/need/stage behavior selector & smooth navigation/obstacle avoidance.
  - `collision.ts` — Room bounds, furniture AABB collision validation, and cat steering avoidance.
- `src/persistence/` — Versioned save/load engine using IndexedDB with `localStorage` fallback, schema migration, and error recovery.
- `src/audio/` — Procedural Web Audio API sound synthesizer (gentle purring, soft meow, water lapping, crunch, bell, shutter click) — zero external audio dependencies.
- `src/engine/` — Real-time Three.js 3D engine:
  - `textures.ts` — Procedural fur canvas textures (solid, tabby, tuxedo, calico, pointed) and realistic interior surface textures (oak wood floor, woven rug, warm plaster, fabric).
  - `CatRig.ts` — Articulated procedural 3D cat mesh with continuous growth morphing, blinking eyelids, expressive ears, multi-segment legs, and animated tail. Clearly marked as a structured placeholder rig ready to swap with a rigged `.glb` cat model.
  - `RoomBuilder.ts` — Warm sunlit living room + interactive 3D furniture meshes + placement preview mesh + knockable table mug.
  - `ToyController.ts` — Live 3D feather wand tracking, physics-rolled ball with wall/furniture bounce, skittering toy mouse, scratching post & box cues.
  - `CameraController.ts` — Mobile touch-first orbit, pinch-to-zoom, tap-to-focus, follow-cat mode, room-bound clamping, and canvas photo capture.
  - `GameEngine.ts` — Main RAF game loop coordinating simulation ticks, 3D rendering, raycast touch interactions, particle cues (hearts, zzz, sparkles), and quality settings.
- `src/store/` — Zustand game state store connecting simulation, persistence, and React UI.
- `src/components/` — Cozy mobile 9:16 UI components (TopBar, BottomNav, HomePanel, CatPanel, CarePanel, ToysPanel, ShopPanel, DecorateBar, PhotoModeOverlay, SettingsModal, AdoptModal, ToastBanner).

## Coding & Contribution Rules
1. Keep `src/simulation/` strictly free of Three.js/DOM imports so every core gameplay rule is unit-tested in Node via Vitest.
2. Never add instant model swaps for growth; interpolate proportions continuously from `ageDays`.
3. Enforce life-stage realism (e.g., newborns cannot eat adult dry food, walk far, or jump).
4. Never claim placeholder procedural geometry is a photorealistic rigged 3D mesh; document asset replacements in `ASSETS_MANIFEST.md`.
5. Maintain mobile performance budgets (adjustable quality presets: `low`, `medium`, `high`).
6. Run `npm.cmd run test` and `npm.cmd run build` after changes.
