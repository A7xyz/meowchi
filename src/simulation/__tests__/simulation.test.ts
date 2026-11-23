import { describe, expect, it } from 'vitest';
import {
  BREED_DEFINITIONS,
  getCompatibleEyeColors,
  getCompatiblePatterns
} from '../../config/breeds';
import { INITIAL_PLACED_FURNITURE, ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../../config/catalog';
import { createInitialSaveData, validateAndMigrateSave } from '../../persistence/saveManager';
import { addBondPoints, getBondCapabilities } from '../bond';
import { chooseNextBehavior, stepCatAI } from '../catAI';
import { resolveCatCollision, validateFurniturePlacement } from '../collision';
import { evaluateCatEmotion } from '../emotions';
import { computeGrowthMetrics, getLifeStageForAge, isFoodSafeForAge } from '../growth';
import {
  applyOfflineElapsed,
  performFeedAction,
  performPetAction,
  performRespectSpaceAction,
  performSleepAction,
  tickNeeds
} from '../needs';
import { evolvePersonality, generateRandomPersonality } from '../personality';
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
    // Colorpoint cats express sapphire blue eyes
    expect(getCompatibleEyeColors('siamese', 'cream', 'colorpoint')).toEqual(['blue']);
    expect(getCompatibleEyeColors('ragdoll', 'white', 'colorpoint')).toEqual(['blue']);

    // Calico & tortoiseshell excluded for male cats (XX-linked coat pattern)
    const malePatterns = getCompatiblePatterns('thai_mixed', 'male');
    expect(malePatterns).not.toContain('calico');
    expect(malePatterns).not.toContain('tortoiseshell');
    expect(getCompatiblePatterns('thai_mixed', 'female')).toContain('calico');
  });
});

describe('Cat Life Stages, Continuous Growth & Food Age Rules', () => {
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

  it('grows continuously per breed and opens newborn eyes realistically', () => {
    const day2 = computeGrowthMetrics('maine_coon', 2);
    const day11 = computeGrowthMetrics('maine_coon', 11);
    const adultMaine = computeGrowthMetrics('maine_coon', 400);
    const adultMunchkin = computeGrowthMetrics('munchkin', 400);

    expect(day2.eyeOpenness).toBe(0);
    expect(day11.eyeOpenness).toBeGreaterThan(0.1);
    expect(adultMaine.eyeOpenness).toBe(1);
    expect(adultMaine.idealWeightKg).toBeGreaterThan(adultMunchkin.idealWeightKg);
    expect(day2.canWalk).toBe(false);
    expect(adultMaine.canJump).toBe(true);
  });

  it('prevents newborn kittens from consuming solid foods', () => {
    expect(isFoodSafeForAge('kitten_milk', 3).allowed).toBe(true);
    expect(isFoodSafeForAge('kitten_wet', 3).allowed).toBe(false);
    expect(isFoodSafeForAge('adult_dry', 3).allowed).toBe(false);
    expect(isFoodSafeForAge('cat_treat', 3).allowed).toBe(false);

    expect(isFoodSafeForAge('kitten_wet', 28).allowed).toBe(true);
    expect(isFoodSafeForAge('adult_dry', 28).allowed).toBe(false);
    expect(isFoodSafeForAge('adult_dry', 100).allowed).toBe(true);
  });
});

describe('8-Trait Randomized Personality, Emotions & Care Development', () => {
  it('generates distinct randomized personalities and evolves gradually through care', () => {
    const pA = generateRandomPersonality(() => 0.1); // Affectionate archetype
    const pB = generateRandomPersonality(() => 0.4); // Shy archetype
    const pC = generateRandomPersonality(() => 0.6); // Defensive/independent archetype

    expect(pA.affection).toBeGreaterThan(pC.affection);
    expect(pB.fearfulness).toBeGreaterThan(pA.fearfulness);
    expect(pC.aggression).toBeGreaterThan(pA.aggression);

    // Gentle care raises trust & lowers fear; disturbing sleep temporarily increases defensiveness
    const afterCalm = evolvePersonality(pB, 'respect_space');
    expect(afterCalm.trust).toBeGreaterThan(pB.trust);
    expect(afterCalm.fearfulness).toBeLessThan(pB.fearfulness);

    const afterDisturb = evolvePersonality(pA, 'disturb_sleep');
    expect(afterDisturb.aggression).toBeGreaterThan(pA.aggression);
  });

  it('triggers realistic defensive/fearful emotions when overstimulated or sleep-disturbed and calms with quiet space', () => {
    const save = createInitialSaveData('bengal', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 90;
    save.cat.lifeStage = 'young_kitten';
    save.cat.behavior = 'sleep';
    save.cat.needs.energy = 40;
    save.cat.traits.aggression = 60;

    // Disturbing sleep triggers defensive hiss reaction
    const disturb = performPetAction(save.cat, save.room);
    expect(disturb.success).toBe(false);
    expect(disturb.cat.behavior).toBe('hiss_defend');
    expect(evaluateCatEmotion(disturb.cat)).toBe('defensive_angry');

    // Respecting space calms stress & restores trust
    const calmed = performRespectSpaceAction(disturb.cat, disturb.room);
    expect(calmed.success).toBe(true);
    expect(calmed.cat.needs.stress).toBeLessThan(disturb.cat.needs.stress);
    expect(calmed.cat.traits.trust).toBeGreaterThan(disturb.cat.traits.trust);
  });
});

describe('Dynamic Realistic Weight & Body Condition System', () => {
  it('changes body condition gradually over time rather than instantly on a single meal', () => {
    const save = createInitialSaveData('british_shorthair', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 400;
    save.cat.lifeStage = 'adult';
    const beforeWeight = save.cat.weight.bodyFatIndex;

    // Adding calories buffers them first (no instant jump)
    const buffered = addMealCalories(save.cat.weight, 80);
    expect(buffered.bodyFatIndex).toBe(beforeWeight);

    // Stepping simulation gradually digests surplus calories into fuller body condition
    let current = { ...save.cat, weight: buffered, behavior: 'idle' as const };
    for (let i = 0; i < 15; i++) {
      current = { ...current, weight: stepWeightSimulation(current, 4, 6) };
    }
    expect(current.weight.bodyFatIndex).toBeGreaterThan(beforeWeight + 0.15);
    expect(classifyBodyCondition(0.45)).toBe('overweight');
    expect(classifyBodyCondition(-0.45)).toBe('underweight');
    expect(classifyBodyCondition(0.0)).toBe('healthy');
  });
});

describe('Care Economy, Offline Fairness, AI & Persistence', () => {
  it('handles age-safe feeding, sleep recovery, and capped offline decay fairly', () => {
    const save = createInitialSaveData('persian', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 3;
    save.cat.needs.hunger = 50;

    expect(performFeedAction(save.cat, save.room, 'adult_dry').success).toBe(false);
    const fed = performFeedAction(save.cat, save.room, 'kitten_milk');
    expect(fed.success).toBe(true);
    expect(fed.cat.needs.hunger).toBeGreaterThan(70);

    save.cat.needs.energy = 40;
    const slept = performSleepAction(save.cat, save.room);
    const ticked = tickNeeds(slept.cat, slept.room, 60, 1);
    expect(ticked.needs.energy).toBeGreaterThan(slept.cat.needs.energy);

    const offline = applyOfflineElapsed(save.cat, save.room, 48 * 3600);
    expect(offline.cat.needs.hunger).toBeGreaterThanOrEqual(30);
    expect(offline.cat.needs.happiness).toBeGreaterThanOrEqual(48);
  });

  it('tracks bond unlocks and moves autonomously inside room bounds without clipping', () => {
    expect(addBondPoints(1, 90, 25).bondLevel).toBe(2);
    expect(getBondCapabilities(90).requestsAffection).toBe(true);

    const save = createInitialSaveData('siamese', { hasAdoptedInitialCat: true });
    save.cat.ageDays = 4;
    const nb = chooseNextBehavior(save.cat, {
      furniture: save.placedFurniture,
      room: save.room,
      playerFocusPoint: { x: 0, z: 0 },
      activeToyTarget: null,
      soundEventPos: null,
      rng: () => 0.3
    });
    expect(['sleep', 'idle', 'stretch', 'yawn']).toContain(nb.behavior);

    save.cat.ageDays = 100;
    save.cat.lifeStage = 'young_kitten';
    save.cat.behavior = 'walk';
    save.cat.behaviorTimer = 5;
    save.cat.position = { x: 0, y: 0, z: 0.2 };
    save.cat.targetPosition = { x: 1.5, z: 0.8 };

    let cur = save.cat;
    for (let i = 0; i < 60; i++) {
      cur = stepCatAI(
        cur,
        {
          furniture: save.placedFurniture,
          room: save.room,
          playerFocusPoint: { x: 0, z: 0 },
          activeToyTarget: null,
          soundEventPos: null
        },
        0.05
      ).cat;
      expect(Math.abs(cur.position.x)).toBeLessThanOrEqual(ROOM_HALF_WIDTH);
      expect(Math.abs(cur.position.z)).toBeLessThanOrEqual(ROOM_HALF_DEPTH);
    }
    expect(cur.position.x).toBeGreaterThan(0.5);

    expect(
      validateFurniturePlacement(
        { instanceId: 't1', catalogId: 'bed_woven', x: 5.0, z: 0, rotationY: 0 },
        INITIAL_PLACED_FURNITURE
      ).valid
    ).toBe(false);
    expect(
      Math.abs(resolveCatCollision({ x: 0, z: -1.85 }, 0.2, INITIAL_PLACED_FURNITURE).z - -1.85)
    ).toBeGreaterThan(0.2);
  });

  it('migrates legacy v1 saves cleanly to SaveDataV2 and rejects invalid payloads', () => {
    const legacyV1 = {
      version: 1,
      savedAt: Date.now(),
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
        needs: { hunger: 80, thirst: 80, energy: 80, happiness: 80, hygiene: 80, health: 95 }
      }
    };

    const migrated = validateAndMigrateSave(legacyV1);
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(2);
    expect(migrated?.cat.identity.breed).toBe('siamese');
    expect(migrated?.cat.identity.furPattern).toBe('colorpoint');
    expect(migrated?.foodInventory.kitten_milk).toBeGreaterThan(0);

    expect(validateAndMigrateSave(null)).toBeNull();
    expect(validateAndMigrateSave({ version: 99 })).toBeNull();
  });
});
