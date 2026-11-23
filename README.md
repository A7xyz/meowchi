# My Little Cat — น้องแมวตัวน้อย

A cozy, realistic-inspired 3D mobile cat life simulator built with **TypeScript, Vite, Three.js, React, and Zustand**. Designed in **9:16 portrait orientation** with **Thai** as the primary language and full **English** localization support.

Adopt a newborn kitten and gradually raise it through five life stages—from a tiny sleeping newborn with closed eyes to a unique, independent adult cat living in a warm sunlit room.

---

## Key Features Implemented

- **5 Gradual Life Stages**: Newborn (0–2 wks), Baby Kitten (3–8 wks), Young Kitten (2–6 mos), Adolescent (6–12 mos), and Adult Cat (12+ mos) with continuous anatomical morphing, eye opening, weight gain, and age-appropriate behavior/food restrictions.
- **Unique Cat Identity & 7 Personalities**: `Playful`, `Sleepy`, `Affectionate`, `Shy`, `Curious`, `Independent`, and `Mischievous`—each directly shaping AI behavior weights (including mischievous cats knocking mugs off the coffee table!).
- **16-State Autonomous Cat AI**: `idle`, `walk`, `run`, `sit`, `sleep`, `stretch`, `groom`, `eat`, `drink`, `explore`, `play`, `approach_player`, `hide`, `observe`, `jump`, and `react_to_sound` with smooth turning, animation blending, and furniture collision avoidance.
- **Interactive Care System**: Age-safe feeding (kitten formula, wet kitten food, adult kibble, treats), water bowl refilling, direct touch petting (with synthesized purring), brushing, tucking into bed, litter box cleaning, and room tidying—with mood-based refusals and gentle offline decay.
- **Emotional Bond System (1–100)**: Unlocks visible behavioral milestones (recognizing the player, voluntary approach, greeting, following camera focus, sleeping nearby, requesting affection).
- **Interactive 3D Toys**: Drag-controlled **Feather Wand**, physics-rolled **Ball**, skittering **Toy Mouse**, **Scratching Post**, and **Cardboard Box**.
- **Home Decoration & Shop**: Move, rotate, and buy furniture/toys with Coins, complete with live green/red collision validation and persistent layout saving.
- **Mobile-First Camera & Photo Mode**: Touch drag orbit, pinch-to-zoom, tap-to-focus, Follow Cat mode, room wall clamping, and real WebGL snapshot capture to the in-game Photo Album.
- **Reliable Auto-Save**: Versioned IndexedDB persistence with automatic `localStorage` fallback and corruption recovery.

---

## Asset & Platform Transparency

- **3D Models & Audio**: This prototype uses a structured **procedural Three.js articulated cat rig**, procedural Canvas PBR fur & room textures, and Web Audio API synthesized feline/room sound effects. **These are temporary placeholders, not final photorealistic 3D assets.** See [ASSETS_MANIFEST.md](./ASSETS_MANIFEST.md) for full replacement specifications and budgets.
- **Mobile Packaging**: This build is a mobile-touch-ready PWA web application tested in desktop/mobile browsers. Native Android/iOS wrapper builds (Capacitor) are planned for Phase 7 and are not claimed as built yet.

---

## Quick Start

### Prerequisites
- Node.js 20+ and npm

### Install & Run
```bash
npm install
npm run dev
```
*(On Windows PowerShell with restricted script execution policy, use `npm.cmd install` and `npm.cmd run dev`.)*

### Run Automated Tests & Build
```bash
npm run test
npm run build
```

See [TESTING.md](./TESTING.md), [ROADMAP.md](./ROADMAP.md), and [AGENTS.md](./AGENTS.md) for more details.
