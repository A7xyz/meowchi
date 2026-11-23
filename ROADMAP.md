# Development Roadmap — My Little Cat

## Phase 1 — Project Foundation (Completed in Prototype)
- Vite + TypeScript + React + Three.js + Zustand + Vitest setup
- PWA manifest & mobile 9:16 touch viewport configuration
- Thai (`th`) & English (`en`) localization framework
- Core domain models & modular architecture

## Phase 2 — Playable Cat & 3D Room (Completed in Prototype)
- Warm sunlit 3D living room (floor, walls, sunlit window, sofa, coffee table, rug, cat bed, food & water bowls, litter box, scratching post, cardboard box, floor lamp, wall frame)
- Articulated procedural 3D cat rig (placeholder pending rigged `.glb` asset) with continuous morphing proportions
- Touch-first orbit, pinch-to-zoom, tap-to-focus, follow-cat mode, and wall-clamped camera

## Phase 3 — Cat Needs & Care System (Completed in Prototype)
- Hunger, Thirst, Energy, Happiness, Hygiene, Health, Trust
- Age-appropriate care enforcement (kitten formula for newborns, wet/dry food for older stages)
- Interactive petting, brushing, feeding, watering, sleeping, litter cleaning, room cleaning
- Fair offline decay cap (no harsh penalties)

## Phase 4 — Autonomous Cat AI & Personality (Completed in Prototype)
- 16-state FSM (`idle`, `walk`, `run`, `sit`, `sleep`, `stretch`, `groom`, `eat`, `drink`, `explore`, `play`, `approach_player`, `hide`, `observe`, `jump`, `react_to_sound`)
- 7 behavior-driving personalities (`playful`, `sleepy`, `affectionate`, `shy`, `curious`, `independent`, `mischievous`)
- Smooth steering, furniture collision avoidance, mischievous cup knocking

## Phase 5 — Gradual Growth & 5 Life Stages (Completed in Prototype)
- Newborn (0–14 days), Baby Kitten (15–56 days), Young Kitten (57–180 days), Adolescent (181–365 days), Adult (366+ days)
- Continuous size, proportion, eye-opening, and weight progression
- Configurable simulation time scale (`1x`, `5x`, `20x`, plus test time-skip controls)

## Phase 6 — Bond, Toys, Decoration, Economy & Photo Mode (Completed in Prototype)
- Bond level (1–100) with visible behavioral unlocks
- Interactive toys: drag feather wand, swipe/roll physics ball, wind-up mouse, scratching post, cardboard box
- Furniture decoration mode with inventory, placement preview, rotation, collision validation, and persistence
- Coins/Gems economy, daily tasks, achievements, photo album with real WebGL snapshots
- Versioned IndexedDB + localStorage auto-save

## Phase 7 — Future Production & Native Mobile Milestones (Planned)
- [ ] Replace procedural `CatRig.ts` placeholder with licensed rigged PBR `.glb` feline model + skeletal animation clips (blend trees) + fur shell/alpha cards
- [ ] Replace procedural furniture with optimized low-poly PBR `.glb` interior assets and baked lightmaps
- [ ] Wrap PWA with Capacitor for native Android & iOS builds (haptics, native camera roll save, notifications)
- [ ] Expand to additional rooms (Bedroom, Sunlit Balcony, Garden Patio)
- [ ] Add recorded natural feline audio samples (purrs, chirps, trills)
- [ ] Cloud save sync & optional multi-cat household support
