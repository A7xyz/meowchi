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

export function classifyBodyCondition(bodyFatIndex: number): BodyCondition {
  if (bodyFatIndex <= -0.38) return 'underweight';
  if (bodyFatIndex <= -0.14) return 'lean';
  if (bodyFatIndex >= 0.32) return 'overweight';
  return 'healthy';
}

/**
 * Updates realistic cat weight and body condition gradually over time.
 * Separates kitten skeletal growth from adult fat gain/loss, never changing
 * body shape instantaneously on a single meal.
 */
export function stepWeightSimulation(
  cat: CatRuntimeState,
  dtSeconds: number,
  timeScale: number
): CatWeightState {
  const breed = cat.identity.breed;
  const metrics = computeGrowthMetrics(breed, cat.ageDays);
  const w = { ...cat.weight };

  const gameHours = (dtSeconds * Math.min(timeScale, 12)) / 20; // gentle progression rate
  const isKitten = cat.ageDays < 181;

  // Activity burn rate based on current movement & play state
  let activityBurn = 1.0;
  if (cat.behavior === 'run' || cat.behavior === 'play' || cat.behavior === 'pounce_crouch') {
    activityBurn = 2.4;
  } else if (cat.behavior === 'walk' || cat.behavior === 'explore' || cat.behavior === 'jump') {
    activityBurn = 1.45;
  } else if (cat.behavior === 'sleep') {
    activityBurn = 0.65;
  }

  // Slowly digest calories from buffer into gradual fat index change
  const digestRate = Math.min(Math.abs(w.calorieBuffer), gameHours * 4.5);
  const signedDigest = w.calorieBuffer >= 0 ? digestRate : -digestRate;
  w.calorieBuffer -= signedDigest;

  // Basal metabolic burn gently trims fat index when active or hungry
  const burnDelta =
    activityBurn * w.metabolism * gameHours * (cat.needs.hunger < 30 ? 0.0065 : 0.0018);

  // Kittens channel most calories into healthy skeletal growth rather than excess fat
  const gainScale = isKitten ? 0.0032 : 0.0068;
  const fatChange = signedDigest * gainScale - burnDelta;

  w.bodyFatIndex = Number(clamp(w.bodyFatIndex + fatChange, -0.75, 0.85).toFixed(4));
  w.condition = classifyBodyCondition(w.bodyFatIndex);

  // Compute physical weight in kg from breed-calibrated ideal weight + bodyFatIndex
  const breedDef = getBreedDefinition(breed);
  const spreadRatio =
    (breedDef.morphology.adultWeightMaxKg - breedDef.morphology.adultWeightMinKg) /
    Math.max(1, breedDef.morphology.adultWeightMinKg);
  const fatMultiplier = 1 + w.bodyFatIndex * Math.max(0.24, Math.min(0.36, spreadRatio * 0.65));
  w.currentWeightKg = Number(Math.max(0.09, metrics.idealWeightKg * fatMultiplier).toFixed(2));

  return w;
}

/**
 * Adds meal calories into the gradual digestion buffer (no instant weight jumps!).
 */
export function addMealCalories(weight: CatWeightState, calories: number): CatWeightState {
  return {
    ...weight,
    calorieBuffer: clamp(weight.calorieBuffer + calories, -40, 120)
  };
}
