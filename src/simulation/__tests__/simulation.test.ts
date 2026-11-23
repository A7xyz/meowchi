import { describe, expect, it } from 'vitest';
import {
  BREED_DEFINITIONS,
  getCompatibleEyeColors,
  getCompatiblePatterns
} from '../../config/breeds';
import {
  FURNITURE_CATALOG,
  INITIAL_PLACED_FURNITURE,
  ROOM_HALF_DEPTH,
  ROOM_HALF_WIDTH
} from '../../config/catalog';
import { ECONOMY_CONFIG, evaluateMinigameReward } from '../../config/economy';
import {
  createDefaultHumanAppearance,
  HUMAN_BOTTOM_STYLES,
  HUMAN_HAIR_STYLES,
  HUMAN_TOP_STYLES
} from '../../config/human';
import { createInitialSaveData, validateAndMigrateSave } from '../../persistence/saveManager';
import { countClaimableQuests, useGameStore } from '../../store/useGameStore';
import { addBondPoints, getBondCapabilities } from '../bond';
import { chooseNextBehavior, stepCatAI } from '../catAI';
import { resolveCatCollision, validateFurniturePlacement } from '../collision';
import {
  applyIdempotentCoinReward,
  buildDailyTaskClaimId,
  getUtcDayNumber
} from '../economy';
import { evaluateCatEmotion } from '../emotions';
import {
  consumePlayerEnergyForMinigame,
  createInitialPlayerEnergy,
  reconcilePlayerEnergy
} from '../energy';
import {
  createInitialEquipmentState,
  dispenseFromAutoFeeder,
  loadAutoFeederFromInventory,
  stepEquipmentSimulation
} from '../equipment';
import {
  advanceAgeFromUtc,
  computeGrowthMetrics,
  getLifeStageForAge,
  isFoodSafeForAge
} from '../growth';
import {
  computeActionInteractionSpots,
  createInitialHumanState,
  stepHumanNavigation
} from '../humanNav';
import {
  applyOfflineElapsed,
  performBrushAction,
  performFeedAction,
  performPetAction,
  performPickupAction,
  performRespectSpaceAction,
  performSleepAction,
  tickNeeds
} from '../needs';
import { evolvePersonality, generateRandomPersonality } from '../personality';
import {
  applyOfflineSurvival,
  createInitialSurvivalState,
  createMemorialEntry,
  evaluateWelfareWarnings,
  stepSurvivalLive
} from '../survival';
import { addMealCalories, classifyBodyCondition, stepWeightSimulation } from '../weight';

describe('10 Breeds & Coat/Eye Genetics Compatibility', () => {
  it('provides all 10 distinct breeds with healthy biological ranges', () => {
    expect(BREED_DEFINITIONS.length).toBe(10);
    const ids = BREED_DEFINITIONS.map((b) => b.id);
    expect(ids).toContain('persian');
    expect(ids).toContain('maine_coon');
    expect(ids).toContain('scottish_straight');
    expect(ids).toContain('thai_mixed');
  });

  it('enforces realistic feline coat & eye genetics', () => {
    expect(getCompatibleEyeColors('siamese', 'cream', 'colorpoint')).toEqual(['blue']);
    expect(getCompatibleEyeColors('ragdoll', 'white', 'colorpoint')).toEqual(['blue']);

    const malePatterns = getCompatiblePatterns('thai_mixed', 'male');
    expect(malePatterns).not.toContain('calico');
    expect(malePatterns).not.toContain('tortoiseshell');
    expect(getCompatiblePatterns('thai_mixed', 'female')).toContain('calico');
  });
});

describe('Natural Real-Time Growth (1 Real Day = 1 Cat Day) & No Manual Skip', () => {
  it('maps ages accurately across all five life stages', () => {
    expect(getLifeStageForAge(0)).toBe('newborn');
    expect(getLifeStageForAge(14)).toBe('newborn');
    expect(getLifeStageForAge(15)).toBe('baby_kitten');
    expect(getLifeStageForAge(56)).toBe('baby_kitten');
    expect(getLifeStageForAge(57)).toBe('young_kitten');
    expect(getLifeStageForAge(180)).toBe('young_kitten');
    expect(getLifeStageForAge(181)).toBe('adolescent');
    expect(getLifeStageForAge(365)).toBe('adolescent');
    expect(getLifeStageForAge(366)).toBe('adult');
  });

  it('advances cat age at 1 real day = 1 cat day without duplication on repeated reloads', () => {
    const startUtc = 1_700_000_000_000;
    const after24h = startUtc + 86_400_000;

    const first = advanceAgeFromUtc(2, startUtc, after24h);
    expect(first.ageDays).toBeCloseTo(3, 5);
    expect(first.lastGrowthSyncAtUtc).toBe(after24h);

    // Simulating repeated browser refreshes at the same timestamp yields 0 duplicated growth
    const reload1 = advanceAgeFromUtc(first.ageDays, first.lastGrowthSyncAtUtc, after24h);
    const reload2 = advanceAgeFromUtc(reload1.ageDays, reload1.lastGrowthSyncAtUtc, after24h);
    expect(reload2.ageDays).toBeCloseTo(3, 5);
    expect(reload2.deltaDays).toBe(0);

    // Ensure manual skipAgeDays action does not exist on the store
    expect((useGameStore.getState() as unknown as Record<string, unknown>).skipAgeDays).toBeUndefined();
  });

  it('grows continuously per breed, opens newborn eyes, and restricts newborn solid food', () => {
    const day2 = computeGrowthMetrics('maine_coon', 2);
    const day11 = computeGrowthMetrics('maine_coon', 11);
    const adultMaine = computeGrowthMetrics('maine_coon', 400);
    const adultMunchkin = computeGrowthMetrics('munchkin', 400);

    expect(day2.eyeOpenness).toBe(0);
    expect(day11.eyeOpenness).toBeGreaterThan(0.1);
    expect(adultMaine.eyeOpenness).toBe(1);
    expect(adultMaine.coatMaturity).toBeGreaterThan(day2.coatMaturity);
    expect(adultMaine.idealWeightKg).toBeGreaterThan(adultMunchkin.idealWeightKg);

    expect(isFoodSafeForAge('kitten_milk', 3).allowed).toBe(true);
    expect(isFoodSafeForAge('kitten_wet', 3).allowed).toBe(false);
    expect(isFoodSafeForAge('adult_dry', 3).allowed).toBe(false);
    expect(isFoodSafeForAge('adult_dry', 100).allowed).toBe(true);
  });
});

describe('Anti-Exploit Coin Rules & Idempotent Transactions (Tests 1, 2, 8)', () => {
  it('TEST 1: tapping "Give Personal Space" 100 times generates strictly 0 Coins', () => {
    const fresh = createInitialSaveData('siamese', { hasAdoptedInitialCat: true });
    useGameStore.setState({
      ...fresh,
      hydrated: true,
      coins: 100,
      activeCareAction: null,
      actionCooldowns: {}
    });

    for (let i = 0; i < 100; i++) {
      useGameStore.getState().respectCatSpace(true);
    }

    expect(useGameStore.getState().coins).toBe(100);
    expect(performRespectSpaceAction(fresh.cat, fresh.room).coinsEarned).toBe(0);
  });

  it('TEST 2: rapid feeding & petting taps do not duplicate item consumption or overlap active animations', () => {
    const fresh = createInitialSaveData('siamese', { hasAdoptedInitialCat: true });
    fresh.cat.ageDays = 40;
    fresh.cat.lifeStage = 'baby_kitten';
    fresh.cat.needs.hunger = 40;
    fresh.foodInventory.kitten_wet = 5;
    // Mark one-time achievements already unlocked so we strictly verify 0 Coins from care action itself
    fresh.achievements = fresh.achievements.map((a) => ({ ...a, unlocked: true }));

    useGameStore.setState({
      ...fresh,
      hydrated: true,
      coins: 120,
      activeCareAction: null,
      actionCooldowns: {}
    });

    // Rapidly tap feed 5 times while hand animation is active
    const first = useGameStore.getState().feedCat('kitten_wet');
    const second = useGameStore.getState().feedCat('kitten_wet');
    const third = useGameStore.getState().petCat();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(false);
    expect(useGameStore.getState().activeCareAction?.type).toBe('feed');

    // Commit at contact moment -> consumes exactly 1 serving and awards 0 Coins
    useGameStore.getState().commitActiveCareAction();
    useGameStore.getState().commitActiveCareAction(); // Duplicate commit is no-op
    expect(useGameStore.getState().foodInventory.kitten_wet).toBe(4);
    expect(useGameStore.getState().coins).toBe(120);

    useGameStore.getState().finishActiveCareAction();
    expect(useGameStore.getState().activeCareAction).toBeNull();
  });

  it('enforces idempotent daily task rewards (claimable only once per UTC reset day)', () => {
    const nowUtc = 1_700_000_000_000;
    const utcDay = getUtcDayNumber(nowUtc);
    const claimId = buildDailyTaskClaimId(utcDay, 'daily_feed');

    const first = applyIdempotentCoinReward(100, [], claimId, 30);
    expect(first.applied).toBe(true);
    expect(first.coins).toBe(130);

    const dup = applyIdempotentCoinReward(first.coins, first.claimedRewardIds, claimId, 30);
    expect(dup.applied).toBe(false);
    expect(dup.coins).toBe(130);
  });
});

describe('Human Player Energy System & 60s Minigames (Tests 3, 4, 5, 6, 7, 8)', () => {
  it('TESTS 3, 4, 5: deducts 5 energy per minigame start (20 -> 15 -> 10) and refuses below 5', () => {
    const t0 = 1_700_000_000_000;
    const fresh = createInitialSaveData('siamese', { hasAdoptedInitialCat: true, nowUtc: t0 });
    useGameStore.setState({
      ...fresh,
      hydrated: true,
      coins: 100,
      activeMinigameSession: null,
      playerEnergy: createInitialPlayerEnergy(t0)
    });

    // Start minigame #1 at 20 energy -> 15
    const mg1 = useGameStore.getState().startMinigame('fishing', t0 + 1000);
    expect(mg1.started).toBe(true);
    expect(useGameStore.getState().playerEnergy.current).toBe(15);

    // Concurrent minigame refused
    expect(useGameStore.getState().startMinigame('matching', t0 + 2000).started).toBe(false);
    expect(useGameStore.getState().playerEnergy.current).toBe(15);

    // Complete minigame #1 -> earns balanced coins (15..45), duplicate claim rejected
    const comp1 = useGameStore.getState().completeMinigame(mg1.sessionId!, 220, t0 + 61_000);
    expect(comp1.claimed).toBe(true);
    expect(comp1.coinsEarned).toBe(35);
    expect(useGameStore.getState().coins).toBe(135);

    const dupClaim = useGameStore.getState().completeMinigame(mg1.sessionId!, 999, t0 + 62_000);
    expect(dupClaim.claimed).toBe(false);
    expect(useGameStore.getState().coins).toBe(135);

    // Start minigame #2 -> decreases to 10; canceling yields 0 Coins
    const mg2 = useGameStore.getState().startMinigame('delivery', t0 + 63_000);
    expect(mg2.started).toBe(true);
    expect(useGameStore.getState().playerEnergy.current).toBe(10);
    useGameStore.getState().cancelMinigame();
    expect(useGameStore.getState().coins).toBe(135);

    // Set energy to 4 -> refuses to start
    useGameStore.setState({
      playerEnergy: { current: 4, max: 20, lastRegenAtUtc: t0 + 63_000, lastSeenUtc: t0 + 63_000 }
    });
    const mgLow = useGameStore.getState().startMinigame('toy_challenge', t0 + 64_000);
    expect(mgLow.started).toBe(false);
    expect(useGameStore.getState().playerEnergy.current).toBe(4);
  });

  it('TESTS 6, 7, 8: regenerates +1 energy per 20m, caps at 20 after 24h, and never duplicates on refresh', () => {
    const t0 = 1_700_000_000_000;
    const empty = { current: 0, max: 20, lastRegenAtUtc: t0, lastSeenUtc: t0 };

    // +20 minutes -> exactly 1 energy
    const after20m = reconcilePlayerEnergy(empty, t0 + 20 * 60 * 1000);
    expect(after20m.energy.current).toBe(1);
    expect(after20m.gained).toBe(1);

    // +100 minutes -> exactly 5 energy
    const after100m = reconcilePlayerEnergy(empty, t0 + 100 * 60 * 1000);
    expect(after100m.energy.current).toBe(5);

    // +400 minutes -> exactly 20 energy
    const after400m = reconcilePlayerEnergy(empty, t0 + 400 * 60 * 1000);
    expect(after400m.energy.current).toBe(20);

    // +24 hours -> capped at 20 energy (never exceeds 20)
    const after24h = reconcilePlayerEnergy(empty, t0 + 24 * 3600 * 1000);
    expect(after24h.energy.current).toBe(20);

    // Repeated browser refresh at same time -> 0 extra energy
    const refresh1 = reconcilePlayerEnergy(after20m.energy, t0 + 20 * 60 * 1000);
    const refresh2 = reconcilePlayerEnergy(refresh1.energy, t0 + 20 * 60 * 1000);
    expect(refresh2.energy.current).toBe(1);
    expect(refresh2.gained).toBe(0);

    // Minigame reward tiers strictly capped at 45 Coins
    expect(evaluateMinigameReward('fishing', 10).coins).toBe(15);
    expect(evaluateMinigameReward('fishing', 100).coins).toBe(25);
    expect(evaluateMinigameReward('fishing', 200).coins).toBe(35);
    expect(evaluateMinigameReward('fishing', 9999).coins).toBe(45);

    // Direct energy consumption check
    const consumed = consumePlayerEnergyForMinigame(createInitialPlayerEnergy(t0), t0);
    expect(consumed.success).toBe(true);
    expect(consumed.energy.current).toBe(15);
  });
});

describe('Advanced Automatic Cat Shop Equipment (Tests 9, 10)', () => {
  it('TESTS 9 & 10: buys Automatic Food Feeder once (650c) and deducts real food inventory without creating free food', () => {
    const feederItem = FURNITURE_CATALOG.find((f) => f.id === 'auto_food_feeder');
    expect(feederItem?.priceCoins).toBe(ECONOMY_CONFIG.PRICES.auto_food_feeder);
    expect(feederItem?.priceCoins).toBe(650);

    const fresh = createInitialSaveData('siamese', { hasAdoptedInitialCat: true });
    fresh.coins = 1000;
    fresh.foodInventory.adult_dry = 5;
    useGameStore.setState({
      ...fresh,
      hydrated: true,
      activeCareAction: null
    });

    // Buy Automatic Feeder -> deducts 650 once, owned count becomes 1
    const bought1 = useGameStore.getState().buyFurniture('auto_food_feeder');
    expect(bought1).toBe(true);
    expect(useGameStore.getState().coins).toBe(350);
    expect(useGameStore.getState().ownedFurniture.auto_food_feeder).toBe(1);

    // Attempt duplicate buy -> blocked
    const bought2 = useGameStore.getState().buyFurniture('auto_food_feeder');
    expect(bought2).toBe(false);
    expect(useGameStore.getState().coins).toBe(350);

    // Load Automatic Feeder strictly from player's foodInventory
    const loaded = loadAutoFeederFromInventory(
      createInitialEquipmentState(),
      { ...fresh.foodInventory, adult_dry: 5 },
      'adult_dry',
      2
    );
    expect(loaded.success).toBe(true);
    expect(loaded.foodInventory.adult_dry).toBe(3);
    expect(loaded.equipment.autoFeeder.storedServings).toBe(2);

    // Dispense uses stored servings (never free!)
    const disp = dispenseFromAutoFeeder(loaded.equipment, 120);
    expect(disp.dispensed).toBe(true);
    expect(disp.equipment.autoFeeder.storedServings).toBe(1);
    expect(disp.equipment.autoFeeder.bowlServingsLevel).toBeGreaterThan(0);

    // Empty hopper cannot dispense free food
    const emptyHopper = {
      ...disp.equipment,
      autoFeeder: { ...disp.equipment.autoFeeder, storedServings: 0, bowlServingsLevel: 0 }
    };
    expect(dispenseFromAutoFeeder(emptyHopper, 120).dispensed).toBe(false);
  });

  it('enforces Automatic Litter Box safety: never operates while cat is inside or for young kittens', () => {
    const save = createInitialSaveData('ragdoll', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 200;
    save.cat.lifeStage = 'adolescent';
    const autoLitter = {
      instanceId: 'f_auto_litter_1',
      catalogId: 'auto_litter_box',
      x: -1.6,
      z: -1.4,
      rotationY: 0
    };
    const placed = [...save.placedFurniture, autoLitter];
    const equip = createInitialEquipmentState();
    equip.autoLitterBox.needsCleaning = true;
    equip.autoLitterBox.pendingCleanDelaySec = 0;

    // Place cat INSIDE the automatic litter box -> must NOT clean!
    save.cat.position = { x: autoLitter.x, y: 0.07, z: autoLitter.z };
    const whileInside = stepEquipmentSimulation(equip, save.cat, save.room, placed, 0.1);
    expect(whileInside.equipment.autoLitterBox.catInside).toBe(true);
    expect(whileInside.equipment.autoLitterBox.isCleaning).toBe(false);

    // Move adult cat safely away -> starts cleaning after delay
    save.cat.position = { x: 1.0, y: 0, z: 1.0 };
    const ready = { ...whileInside.equipment, autoLitterBox: { ...whileInside.equipment.autoLitterBox, pendingCleanDelaySec: 0 } };
    const afterExit = stepEquipmentSimulation(ready, save.cat, save.room, placed, 0.1);
    expect(afterExit.equipment.autoLitterBox.isCleaning).toBe(true);

    // Young kitten (< 57 days) -> kitten safety lock keeps auto-cleaning disabled
    save.cat.ageDays = 30;
    const kittenCheck = stepEquipmentSimulation(ready, save.cat, save.room, placed, 0.1);
    expect(kittenCheck.equipment.autoLitterBox.kittenSafeLock).toBe(true);
    expect(kittenCheck.equipment.autoLitterBox.isCleaning).toBe(false);
  });
});

describe('Playful AI, Defensive Hissing, Rare Biting & Visible Hand Actions (Tests 11–16)', () => {
  it('TEST 11: high-playfulness cats trigger zoomies, rolling, pouncing, box ambush & navigate smoothly in bounds', () => {
    const save = createInitialSaveData('bengal', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 140;
    save.cat.lifeStage = 'young_kitten';
    save.cat.behavior = 'idle';
    save.cat.needs.energy = 85;
    save.cat.needs.stress = 5;
    save.cat.traits.playfulness = 95;
    save.cat.traits.curiosity = 88;

    const chosenBehaviors = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const rVal = (i * 0.024 + 0.01) % 0.99;
      const decision = chooseNextBehavior(save.cat, {
        furniture: save.placedFurniture,
        room: save.room,
        equipment: save.equipment,
        playerFocusPoint: { x: 0, z: 0 },
        activeToyTarget: null,
        soundEventPos: null,
        rng: () => rVal
      });
      chosenBehaviors.add(decision.behavior);
    }

    const playfulActions = ['zoomies', 'roll_play', 'box_ambush', 'chase_imaginary', 'pounce_crouch', 'play', 'jump_prep'];
    const hits = playfulActions.filter((b) => chosenBehaviors.has(b));
    expect(hits.length).toBeGreaterThanOrEqual(3);

    // Step zoomies navigation smoothly inside room without clipping or teleporting
    save.cat.behavior = 'zoomies';
    save.cat.behaviorTimer = 5;
    save.cat.zoomieWaypointsRemaining = 2;
    save.cat.position = { x: 0, y: 0, z: 0.2 };
    save.cat.targetPosition = { x: 1.6, z: 1.1 };

    let cur = save.cat;
    for (let i = 0; i < 40; i++) {
      const prevPos = { ...cur.position };
      cur = stepCatAI(
        cur,
        {
          furniture: save.placedFurniture,
          room: save.room,
          equipment: save.equipment,
          playerFocusPoint: { x: 0, z: 0 },
          activeToyTarget: null,
          soundEventPos: null
        },
        0.05
      ).cat;
      expect(Math.hypot(cur.position.x - prevPos.x, cur.position.z - prevPos.z)).toBeLessThan(0.25);
      expect(Math.abs(cur.position.x)).toBeLessThanOrEqual(ROOM_HALF_WIDTH);
      expect(Math.abs(cur.position.z)).toBeLessThanOrEqual(ROOM_HALF_DEPTH);
    }
  });

  it('TESTS 12 & 13: escalates logically from defensive hiss warning to rare defensive bite with trust/stress update and 0 Coins', () => {
    const nowUtc = 1_700_000_000_000;
    const save = createInitialSaveData('bengal', { hasAdoptedInitialCat: true, nowUtc });
    save.cat.ageDays = 120;
    save.cat.lifeStage = 'young_kitten';
    save.cat.behavior = 'sleep';
    save.cat.needs.energy = 35;
    save.cat.traits.aggression = 65;
    save.cat.traits.trust = 40;

    // 1st violation: disturbing sleep -> realistic defensive hiss warning (NOT immediate bite)
    const warn = performPetAction(save.cat, save.room, nowUtc);
    expect(warn.success).toBe(false);
    expect(warn.triggeredBite).toBeFalsy();
    expect(warn.cat.behavior).toBe('hiss_defend');
    expect(warn.vocalCue).toBe('hiss');
    expect(evaluateCatEmotion(warn.cat)).toBe('defensive_angry');

    // 2nd violation while cat is actively hissing -> triggers rare defensive bite!
    const bite = performPetAction(warn.cat, warn.room, nowUtc + 1000);
    expect(bite.success).toBe(false);
    expect(bite.triggeredBite).toBe(true);
    expect(bite.cat.behavior).toBe('bite_defend');
    expect(bite.coinsEarned).toBe(0);
    expect(bite.xpEarned).toBe(0);
    expect(bite.cat.traits.trust).toBeLessThan(warn.cat.traits.trust);
    expect(bite.cat.needs.stress).toBeGreaterThan(warn.cat.needs.stress);
    expect(bite.cat.calmDownUntilUtc).toBeGreaterThan(nowUtc);

    // Store bite feedback triggers screen-edge sequence counter
    useGameStore.setState({
      ...save,
      cat: warn.cat,
      hydrated: true,
      activeCareAction: null,
      actionCooldowns: {},
      biteFeedback: { seq: 0, triggeredAtMs: 0 }
    });
    useGameStore.getState().petCat(true);
    expect(useGameStore.getState().biteFeedback.seq).toBe(1);

    // Giving personal space calms stress & resets warnings with 0 Coins
    const calmed = performRespectSpaceAction(bite.cat, bite.room);
    expect(calmed.coinsEarned).toBe(0);
    expect(calmed.cat.needs.stress).toBeLessThan(bite.cat.needs.stress);
    expect(calmed.cat.ignoredWarningsCount).toBe(0);
  });

  it('TESTS 14, 15, 16: petting, feeding, and grooming trigger visible hand care actions cleanly', () => {
    const save = createInitialSaveData('persian', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 90;
    save.cat.lifeStage = 'young_kitten';
    save.cat.behavior = 'sit';
    save.cat.needs.hunger = 50;
    save.cat.needs.stress = 5;
    save.cat.traits.aggression = 15;
    save.cat.traits.fearfulness = 15;
    save.foodInventory.kitten_wet = 3;

    useGameStore.setState({ ...save, hydrated: true, activeCareAction: null, actionCooldowns: {} });

    expect(useGameStore.getState().petCat()).toBe(true);
    expect(useGameStore.getState().activeCareAction?.type).toBe('pet');
    useGameStore.getState().commitActiveCareAction();
    useGameStore.getState().finishActiveCareAction();

    useGameStore.setState({ actionCooldowns: {} });
    expect(useGameStore.getState().feedCat('kitten_wet')).toBe(true);
    expect(useGameStore.getState().activeCareAction?.type).toBe('feed');
    useGameStore.getState().commitActiveCareAction();
    useGameStore.getState().finishActiveCareAction();

    useGameStore.setState({ actionCooldowns: {} });
    expect(useGameStore.getState().brushCat()).toBe(true);
    expect(useGameStore.getState().activeCareAction?.type).toBe('brush');
    useGameStore.getState().commitActiveCareAction();
    useGameStore.getState().finishActiveCareAction();

    // Grooming simulation check
    const brushed = performBrushAction(save.cat, save.room);
    expect(brushed.success).toBe(true);
    expect(brushed.coinsEarned).toBe(0);
  });
});

describe('Save Migration V1/V2/V3 -> V4, Weight, Bond & Collision (Test 17)', () => {
  it('TEST 17: migrates legacy V1, V2, and V3 saves to V4 preserving cat identity, coins, and progress', () => {
    const legacyV1 = {
      version: 1,
      savedAt: 1_700_000_000_000,
      coins: 420,
      cat: {
        identity: {
          id: 'cat_old',
          name: 'มะลิ',
          sex: 'female',
          breed: 'wichienmaat',
          furColor: '#efe2ce',
          furSecondary: '#4a372a',
          eyeColor: '#5ea6d8',
          furPattern: 'pointed',
          adoptedAt: 1000
        },
        ageDays: 45,
        bondLevel: 12,
        needs: { hunger: 80, thirst: 80, energy: 80, happiness: 80, hygiene: 80, health: 95 }
      }
    };

    const migratedV1 = validateAndMigrateSave(legacyV1, 1_700_000_000_000);
    expect(migratedV1).not.toBeNull();
    expect(migratedV1?.version).toBe(4);
    expect(migratedV1?.coins).toBe(420);
    expect(migratedV1?.cat.identity.name).toBe('มะลิ');
    expect(migratedV1?.cat.identity.breed).toBe('siamese');
    expect(migratedV1?.cat.identity.furPattern).toBe('colorpoint');
    expect(migratedV1?.cat.bondLevel).toBe(12);
    expect(migratedV1?.playerEnergy.current).toBe(20);
    expect(migratedV1?.equipment.autoFeeder.storedServings).toBe(0);
    expect(migratedV1?.humanAppearance).toBeDefined();
    expect(migratedV1?.survival.isAlive).toBe(true);

    const legacyV3 = {
      ...migratedV1,
      version: 3,
      coins: 777
    };
    const migratedV3 = validateAndMigrateSave(legacyV3, 1_700_000_000_000);
    expect(migratedV3?.version).toBe(4);
    expect(migratedV3?.coins).toBe(777);

    expect(validateAndMigrateSave(null)).toBeNull();
    expect(validateAndMigrateSave({ version: 99 })).toBeNull();
  });

  it('preserves gradual weight simulation, bond unlocks, offline caps, and collision rules', () => {
    const save = createInitialSaveData('british_shorthair', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 400;
    save.cat.lifeStage = 'adult';
    const beforeWeight = save.cat.weight.bodyFatIndex;

    const buffered = addMealCalories(save.cat.weight, 80);
    expect(buffered.bodyFatIndex).toBe(beforeWeight);

    let current = { ...save.cat, weight: buffered, behavior: 'idle' as const };
    for (let i = 0; i < 15; i++) {
      current = { ...current, weight: stepWeightSimulation(current, 4, 6) };
    }
    expect(current.weight.bodyFatIndex).toBeGreaterThan(beforeWeight + 0.15);
    expect(classifyBodyCondition(0.45)).toBe('overweight');

    expect(addBondPoints(1, 90, 25).bondLevel).toBe(2);
    expect(getBondCapabilities(90).requestsAffection).toBe(true);

    const offline = applyOfflineElapsed(save.cat, save.room, 48 * 3600);
    expect(offline.cat.needs.hunger).toBeGreaterThanOrEqual(30);
    expect(offline.cat.needs.happiness).toBeGreaterThanOrEqual(48);

    save.cat.needs.energy = 40;
    const slept = performSleepAction(save.cat, save.room);
    const ticked = tickNeeds(slept.cat, slept.room, 60, 1, true);
    expect(ticked.needs.energy).toBeGreaterThan(slept.cat.needs.energy);

    expect(
      validateFurniturePlacement(
        { instanceId: 't1', catalogId: 'auto_food_feeder', x: 5.0, z: 0, rotationY: 0 },
        INITIAL_PLACED_FURNITURE
      ).valid
    ).toBe(false);
    expect(
      Math.abs(resolveCatCollision({ x: 0, z: -1.85 }, 0.2, INITIAL_PLACED_FURNITURE).z - -1.85)
    ).toBeGreaterThan(0.2);

    const pA = generateRandomPersonality(() => 0.1);
    const pB = generateRandomPersonality(() => 0.4);
    expect(evolvePersonality(pB, 'respect_space').trust).toBeGreaterThan(pB.trust);
    expect(pA.affection).toBeGreaterThan(pB.affection);

    const fed = performFeedAction(save.cat, save.room, 'adult_dry');
    expect(fed.success).toBe(true);
    expect(fed.coinsEarned).toBe(0);
  });
});

describe('Major Update: 6-Stage Growth, 5-Tier Weight, Survival, Quests, Auto-Close Menus & Human Avatar', () => {
  it('supports all 6 life stages including Senior with non-uniform anatomical proportions', () => {
    expect(getLifeStageForAge(0)).toBe('newborn');
    expect(getLifeStageForAge(20)).toBe('baby_kitten');
    expect(getLifeStageForAge(90)).toBe('young_kitten');
    expect(getLifeStageForAge(240)).toBe('adolescent');
    expect(getLifeStageForAge(500)).toBe('adult');
    expect(getLifeStageForAge(2600)).toBe('senior');

    const kitten = computeGrowthMetrics('siamese', 30);
    const adult = computeGrowthMetrics('siamese', 500);
    const senior = computeGrowthMetrics('siamese', 3000);

    // Not uniform scale: head ratio shrinks, legs elongate, body length grows, senior slows gently
    expect(kitten.headRatio).toBeGreaterThan(adult.headRatio);
    expect(kitten.legRatio).toBeLessThan(adult.legRatio);
    expect(kitten.bodyLengthRatio).toBeLessThan(adult.bodyLengthRatio);
    expect(kitten.pawScale).toBeGreaterThan(adult.pawScale);
    expect(senior.activityLevel).toBeLessThan(adult.activityLevel);
    expect(senior.animSpeedFactor).toBeLessThan(adult.animSpeedFactor);
    expect(senior.coatSilvering).toBeGreaterThan(0);
  });

  it('classifies all 5 dynamic weight body conditions including Obese & Underweight', () => {
    expect(classifyBodyCondition(-0.45)).toBe('underweight');
    expect(classifyBodyCondition(-0.2)).toBe('lean');
    expect(classifyBodyCondition(0.0)).toBe('healthy');
    expect(classifyBodyCondition(0.35)).toBe('overweight');
    expect(classifyBodyCondition(0.65)).toBe('obese');
  });

  it('shows welfare warnings before death, respects offline grace period, and disables death in Casual Mode', () => {
    const t0 = 1_700_000_000_000;
    const save = createInitialSaveData('persian', { hasAdoptedInitialCat: true, hasCreatedHuman: true, nowUtc: t0 });
    save.cat.ageDays = 400;
    save.cat.lifeStage = 'adult';
    save.room.foodBowlLevel = 0;
    save.room.waterBowlLevel = 0;

    // 1. Closing the app for 8 hours (within 24h offline grace period) NEVER kills the cat
    const shortOffline = applyOfflineSurvival(
      save.cat,
      createInitialSurvivalState(t0, 24),
      save.room,
      8 * 3600,
      'standard',
      24,
      t0 + 8 * 3600 * 1000
    );
    expect(shortOffline.survival.isAlive).toBe(true);
    expect(shortOffline.justDied).toBe(false);

    // 2. Low thirst/hunger generates clear human-readable welfare warnings (no numeric hunger bar)
    const thirstyCat = { ...save.cat, needs: { ...save.cat.needs, thirst: 20, hunger: 18 } };
    const warnings = evaluateWelfareWarnings(thirstyCat, save.survival, save.room);
    expect(warnings.some((w) => w.type === 'water')).toBe(true);
    expect(warnings.some((w) => w.type === 'food')).toBe(true);

    // 3. Casual Mode strictly disables death even after extreme neglect
    const casualExtreme = applyOfflineSurvival(
      thirstyCat,
      createInitialSurvivalState(t0, 12),
      save.room,
      200 * 3600,
      'casual',
      12,
      t0 + 200 * 3600 * 1000
    );
    expect(casualExtreme.survival.isAlive).toBe(true);
    expect(casualExtreme.justDied).toBe(false);
    expect(casualExtreme.cat.needs.health).toBeGreaterThanOrEqual(30);

    // 4. Standard Mode: sustained critical neglect eventually causes death & creates memorial record
    const criticalCat = { ...thirstyCat, needs: { ...thirstyCat.needs, health: 4, thirst: 0, hunger: 0 } };
    const criticalSurv = {
      ...createInitialSurvivalState(t0, 12),
      dehydrationHours: 30,
      malnutritionHours: 30,
      criticalHealthHours: 35.9
    };
    const fatalStep = stepSurvivalLive(criticalCat, criticalSurv, save.room, 7200, 'standard', t0 + 7200_000);
    expect(fatalStep.justDied).toBe(true);
    expect(fatalStep.survival.isAlive).toBe(false);

    const memorial = createMemorialEntry(fatalStep.cat, fatalStep.survival, [], t0 + 7200_000);
    expect(memorial.catName).toBe(save.cat.identity.name);
    expect(memorial.daysTogether).toBeGreaterThanOrEqual(1);
  });

  it('auto-closes all menus on cat actions, never auto-reopens them, and navigates human without teleporting', () => {
    const save = createInitialSaveData('ragdoll', { hasAdoptedInitialCat: true, hasCreatedHuman: true });
    save.cat.ageDays = 180;
    save.cat.lifeStage = 'young_kitten';
    save.cat.behavior = 'sit';
    save.cat.needs.stress = 5;
    save.cat.traits.aggression = 10;
    save.cat.traits.fearfulness = 10;
    save.foodInventory.kitten_wet = 3;

    useGameStore.setState({
      ...save,
      hydrated: true,
      drawerOpen: true,
      showEquipmentModal: true,
      activeCareAction: null,
      actionCooldowns: {}
    });

    // Selecting pet auto-closes drawer and overlapping modals immediately!
    const started = useGameStore.getState().petCat();
    expect(started).toBe(true);
    expect(useGameStore.getState().drawerOpen).toBe(false);
    expect(useGameStore.getState().showEquipmentModal).toBe(false);
    expect(useGameStore.getState().activeCareAction?.phase).toBe('approaching');

    // Finish action -> menus stay closed (player reopens manually)
    useGameStore.getState().commitActiveCareAction();
    useGameStore.getState().finishActiveCareAction();
    expect(useGameStore.getState().drawerOpen).toBe(false);
    expect(useGameStore.getState().human.animState).toBe('idle');

    // Human navigation moves smoothly step-by-step around furniture without teleporting
    let human = createInitialHumanState();
    const spots = computeActionInteractionSpots('pet', save.cat, save.placedFurniture, {
      x: human.position.x,
      z: human.position.z
    });
    let arrived = false;
    for (let i = 0; i < 160; i++) {
      const prev = { ...human.position };
      const res = stepHumanNavigation(human, spots.targetPoint, spots.alignTarget, save.placedFurniture, 0.05);
      human = res.human;
      expect(Math.hypot(human.position.x - prev.x, human.position.z - prev.z)).toBeLessThan(0.18);
      if (res.arrived && res.aligned) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);

    // Pick Up Cat action works with 0 Coins generated
    const pickupRes = performPickupAction(save.cat, save.room);
    expect(pickupRes.success).toBe(true);
    expect(pickupRes.coinsEarned).toBe(0);
  });

  it('shows red quest notification dot count when completed, claims once, and prevents duplicate rewards', () => {
    const t0 = 1_700_000_000_000;
    const save = createInitialSaveData('siamese', { hasAdoptedInitialCat: true, hasCreatedHuman: true, nowUtc: t0 });
    save.dailyTasks = save.dailyTasks.map((t) =>
      t.id === 'daily_feed' ? { ...t, progress: t.target, claimed: false } : t
    );

    useGameStore.setState({
      ...save,
      hydrated: true,
      coins: 100,
      claimedRewardIds: []
    });

    expect(countClaimableQuests(useGameStore.getState().dailyTasks)).toBe(1);

    const firstClaim = useGameStore.getState().claimDailyTask('daily_feed', t0);
    expect(firstClaim).toBe(true);
    expect(useGameStore.getState().coins).toBeGreaterThan(100);
    expect(countClaimableQuests(useGameStore.getState().dailyTasks)).toBe(0);

    // Repeated tap / refresh duplicate claim attempt yields false and zero extra coins
    const coinsAfter = useGameStore.getState().coins;
    const dupClaim = useGameStore.getState().claimDailyTask('daily_feed', t0);
    expect(dupClaim).toBe(false);
    expect(useGameStore.getState().coins).toBe(coinsAfter);
  });

  it('supports full human character customization across genders, hairstyles, face & cross-gender outfits', () => {
    expect(HUMAN_HAIR_STYLES.length).toBeGreaterThanOrEqual(9);
    expect(HUMAN_TOP_STYLES.length).toBeGreaterThanOrEqual(5);
    expect(HUMAN_BOTTOM_STYLES.length).toBeGreaterThanOrEqual(5);

    const maleCustom = {
      ...createDefaultHumanAppearance('male'),
      name: 'Alex',
      hairStyle: 'ponytail' as const,
      hairColor: 'red' as const,
      eyeShape: 'almond' as const,
      eyeColor: 'green' as const,
      mouthShape: 'smile' as const,
      topStyle: 'hoodie' as const,
      bottomStyle: 'skirt' as const, // Cross-gender compatible clothing!
      footwearStyle: 'sneakers' as const
    };

    const save = createInitialSaveData('bengal', {
      hasAdoptedInitialCat: true,
      hasCreatedHuman: true,
      customHumanAppearance: maleCustom
    });
    useGameStore.setState({ ...save, hydrated: true });
    useGameStore.getState().saveHumanAppearance(maleCustom);
    expect(useGameStore.getState().humanAppearance.name).toBe('Alex');
    expect(useGameStore.getState().humanAppearance.bottomStyle).toBe('skirt');
    expect(useGameStore.getState().hasCreatedHuman).toBe(true);
  });
});
