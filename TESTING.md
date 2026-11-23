# Testing Guide — My Little Cat

## 1. Automated Unit & Simulation Tests
Run all Vitest tests (covers life stages, continuous growth, age-appropriate feeding rules, personality-driven AI decisions, bond level unlocks, collision validation, and save migration/recovery):

```bash
npm run test
```
*(On Windows PowerShell with restricted script policy, run `npm.cmd run test`.)*

## 2. Type Check & Production Build
Verify zero TypeScript errors and clean Vite bundle:

```bash
npm run build
```

## 3. Running Locally for Interactive Testing
```bash
npm run dev
```
Open the reported `http://localhost:5173` URL in Chrome, Edge, or a mobile device on the same LAN.

## 4. Manual Gameplay Verification Checklist
1. **Initial Launch (Newborn Stage)**:
   - Confirm newborn kitten spawns in the cozy sunlit room with closed eyes and small proportions.
   - Open **Care (ดูแล)** and verify adult dry food is blocked with an age-appropriate explanation, while **Kitten Formula (นมแพะลูกแมว)** feeds the kitten and increases hunger + bond.
2. **Camera & Touch Controls**:
   - Drag on canvas to orbit around the room; scroll/pinch to zoom; confirm camera cannot clip outside walls or below floor.
   - Tap the kitten to pet/focus; toggle **Follow Cat (ตามน้องแมว)** in Home tab.
3. **Growth & Life Stages**:
   - Open **Settings (ตั้งค่า)** and use **+7 วัน / +30 วัน** or increase simulation speed (`20x`) to observe gradual body growth, eye opening (around day 10–14), and stage transitions from Newborn → Baby Kitten → Young Kitten → Adolescent → Adult.
4. **Autonomous AI & Personalities**:
   - Observe the kitten transitioning smoothly between states (Sleeping, Walking, Exploring, Grooming, Eating, Drinking, Playing, Approaching Player) without teleporting or clipping through furniture.
5. **Interactive Toys**:
   - Open **Toys (ของเล่น)** → **Feather Wand**: drag across the 3D scene and watch the cat track & chase the feather.
   - Open **Ball**: tap/swipe on the floor to roll the ball and watch the cat chase it (stage 2+ with enough energy).
6. **Decoration Mode & Shop**:
   - Buy an item in **Shop (ร้านค้า)** with earned Coins, enter **Decorate Mode (ตกแต่งห้อง)** from Home, drag/rotate furniture with live green/red collision validation, and save.
7. **Photo Mode**:
   - Tap the camera icon, snap a photo, and inspect it in the **Photo Album (อัลบั้มภาพ)**.
8. **Save & Load Persistence**:
   - Feed/rename/move furniture, wait 2 seconds (or trigger auto-save), reload the page (`F5`), and verify cat identity, age, needs, bond, coins, furniture layout, and photos persist cleanly.
