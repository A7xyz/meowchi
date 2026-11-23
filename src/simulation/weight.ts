import { getBreedDefinition } from '../config/breeds';
import { BodyCondition, CatBreed, CatRuntimeState, CatWeightState } from '../types/game';
import { clamp, computeGrowthMetrics } from './growth';

export function createInitialWeightState(
  breed: CatBreed,
  ageDays: number,
  rng: () => number = Math.random
): CatWeightState {
  const metrics = computeGrowthMetrics(breed, ageDays);
  const metabolism = Number((0.9 + rng() * 0.2).toFixed(2));
  return {
    currentWeightKg: metrics.idealWeightKg,
    bodyFatIndex: 0,
    condition: 'healthy',
    metabolism,
    calorieBuffer: 0
  };
}

/**
 * 5-tier realistic feline body condition classification:
 * Underweight / Lean / Healthy / Slightly Overweight / Obese
 */
export function classifyBodyCondition(bodyFatIndex: number): BodyCondition {
  if (bodyFatIndex <= -0.38) return 'underweight';
  if (bodyFatIndex <= -0.14) return 'lean';
  if (bodyFatIndex >= 0.56) return 'obese';
  if (bodyFatIndex >= 0.28) return 'overweight';
  return 'healthy';
}

/**
 * Updates realistic cat weight and body condition gradually over time.
 * Influenced by: food consumption, age, breed, physical activity, metabolism, health, life stage.
 * Separates natural kitten skeletal growth from fat gain/loss — never changes shape instantly.
 */
export function stepWeightSimulation(
  cat: CatRuntimeState,
  dtSeconds: number,
  timeScale: number
): CatWeightState {
  const breed = cat.identity.breed;
  const metrics = computeGrowthMetrics(breed, cat.ageDays);
  const breedDef = getBreedDefinition(breed);
  const w = { ...cat.weight };

  const gameHours = (dtSeconds * Math.min(timeScale, 12)) / 20;
  const isKitten = cat.ageDays < 181;
  const isSenior = cat.lifeStage === 'senior';

  // Activity burn rate based on physical movement & play state
  let activityBurn = 1.0;
  if (
    cat.behavior === 'run' ||
    cat.behavior === 'zoomies' ||
    cat.behavior === 'play' ||
    cat.behavior === 'pounce_crouch' ||
    cat.behavior === 'chase_imaginary'
  ) {
    activityBurn = 2.45;
  } else if (
    cat.behavior === 'walk' ||
    cat.behavior === 'explore' ||
    cat.behavior === 'jump' ||
    cat.behavior === 'approach_player'
  ) {
    activityBurn = 1.45;
  } else if (cat.behavior === 'sleep') {
    activityBurn = 0.62;
  }

  // Breed metabolic baseline (athletic breeds like Bengal/Siamese burn slightly faster than plush breeds)
  const breedMetabolicMod =
    breed === 'bengal' || breed === 'siamese'
      ? 1.12
      : breed === 'persian' || breed === 'british_shorthair' || breed === 'ragdoll'
        ? 0.9
        : 1.0;

  // Life-stage metabolism: kittens burn & grow fast, seniors have gentler metabolism
  const stageMetabolicMod = isKitten ? 1.18 : isSenior ? 0.82 : 1.0;

  // Slowly digest calories from buffer into gradual fat index change (eating once never makes cat fat!)
  const digestRate = Math.min(Math.abs(w.calorieBuffer), gameHours * 4.5);
  const signedDigest = w.calorieBuffer >= 0 ? digestRate : -digestRate;
  w.calorieBuffer -= signedDigest;

  // Poor health or prolonged low hunger gradually causes weight loss
  const healthLossBoost = cat.needs.health < 40 ? 0.0045 : 0;
  const hungryFactor = cat.needs.hunger < 25 ? 0.0072 : cat.needs.hunger < 40 ? 0.0038 : 0.0018;
  const burnDelta =
    activityBurn *
    w.metabolism *
    breedMetabolicMod *
    stageMetabolicMod *
    gameHours *
    (hungryFactor + healthLossBoost);

  // Kittens channel most calories into healthy skeletal growth rather than excess fat
  const gainScale = isKitten ? 0.003 : isSenior ? 0.0076 : 0.0066;
  const fatChange = signedDigest * gainScale - burnDelta;

  w.bodyFatIndex = Number(clamp(w.bodyFatIndex + fatChange, -0.78, 0.95).toFixed(4));
  w.condition = classifyBodyCondition(w.bodyFatIndex);

  // Compute physical weight in kg from breed-calibrated ideal weight + bodyFatIndex
  const spreadRatio =
    (breedDef.morphology.adultWeightMaxKg - breedDef.morphology.adultWeightMinKg) /
    Math.max(1, breedDef.morphology.adultWeightMinKg);
  const fatMultiplier = 1 + w.bodyFatIndex * Math.max(0.28, Math.min(0.45, spreadRatio * 0.72));
  w.currentWeightKg = Number(Math.max(0.09, metrics.idealWeightKg * fatMultiplier).toFixed(2));

  return w;
}

/**
 * Adds meal calories into the gradual digestion buffer (no instant weight jumps!).
 */
export function addMealCalories(weight: CatWeightState, calories: number): CatWeightState {
  return {
    ...weight,
    calorieBuffer: clamp(weight.calorieBuffer + calories, -40, 140)
  };
}
