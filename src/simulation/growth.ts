import { getBreedDefinition } from '../config/breeds';
import { getFoodItem } from '../config/catalog';
import { ECONOMY_CONFIG } from '../config/economy';
import { CatBreed, CatGrowthMetrics, FoodItemId, LifeStage } from '../types/game';

/**
 * Real-time game progression:
 * 1 real day (86,400 seconds) = 1 in-game cat day at default 1.0 scale.
 * Growth is strictly derived from elapsed UTC time, never frame rate or manual clicks.
 */
export const REAL_SECONDS_PER_GAME_DAY_AT_1X = ECONOMY_CONFIG.REAL_SECONDS_PER_GAME_DAY;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Six realistic feline life stages by in-game age in days:
 * Stage 1: Newborn       0 - 14 days      (0-2 weeks)
 * Stage 2: Baby Kitten  15 - 56 days      (3-8 weeks)
 * Stage 3: Young Kitten 57 - 180 days     (2-6 months)
 * Stage 4: Adolescent  181 - 365 days     (6-12 months)
 * Stage 5: Adult       366 - 2555 days    (1-7 years)
 * Stage 6: Senior      2556+ days         (7+ years)
 */
export function getLifeStageForAge(ageDays: number): LifeStage {
  const d = Math.max(0, ageDays);
  if (d < 15) return 'newborn';
  if (d < 57) return 'baby_kitten';
  if (d < 181) return 'young_kitten';
  if (d < 366) return 'adolescent';
  if (d < 2556) return 'adult';
  return 'senior';
}

export function computeGrowthMetrics(
  breedOrAge: CatBreed | number,
  maybeAgeDays?: number
): CatGrowthMetrics {
  const breed: CatBreed = typeof breedOrAge === 'string' ? breedOrAge : 'siamese';
  const d = Math.max(0, typeof breedOrAge === 'number' ? breedOrAge : (maybeAgeDays ?? 0));
  const stage = getLifeStageForAge(d);
  const breedDef = getBreedDefinition(breed);
  const morph = breedDef.morphology;

  let stageProgress = 0;
  if (stage === 'newborn') stageProgress = clamp(d / 15, 0, 1);
  else if (stage === 'baby_kitten') stageProgress = clamp((d - 15) / 42, 0, 1);
  else if (stage === 'young_kitten') stageProgress = clamp((d - 57) / 124, 0, 1);
  else if (stage === 'adolescent') stageProgress = clamp((d - 181) / 185, 0, 1);
  else if (stage === 'adult') stageProgress = clamp((d - 366) / (2556 - 366), 0, 1);
  else stageProgress = clamp((d - 2556) / 1825, 0, 1);

  const growthCurve =
    0.56 * smoothstep(0, 180, d) +
    0.34 * smoothstep(90, 365, d) +
    0.1 * smoothstep(300, 480, d);
  const overallGrowth = clamp(growthCurve, 0, 1);
  const seniorProgress = smoothstep(2300, 3200, d);

  // Non-uniform realistic anatomical proportions across all 6 life stages
  const bodyScale = lerp(0.35, morph.adultScale, overallGrowth) * lerp(1.0, 0.98, seniorProgress);
  const heightRatio = lerp(0.68, 1.0, smoothstep(8, 280, d)) * lerp(1.0, 0.95, seniorProgress);

  // Kittens have shorter compact torsos; adolescents stretch slightly lanky before filling out in adulthood
  const adolescentLankiness = smoothstep(140, 250, d) * (1 - smoothstep(270, 420, d));
  const bodyLengthRatio =
    lerp(0.76, 1.0, smoothstep(5, 240, d)) + adolescentLankiness * 0.07 - seniorProgress * 0.02;

  // Large adorable kitten head-to-body ratio morphing gradually to sleek adult proportions
  const headRatio = lerp(1.36, 1.0, smoothstep(0, 260, d));
  const legRatio =
    lerp(0.62, 1.0, smoothstep(10, 230, d)) + adolescentLankiness * 0.06 - seniorProgress * 0.04;
  // Slightly oversized chunky paws on young kittens that become sleeker in adulthood
  const pawScale = lerp(1.24, 1.0, smoothstep(15, 270, d));
  const tailRatio = lerp(0.54, 1.0, smoothstep(7, 210, d));
  const earRatio = lerp(0.66, 1.0, smoothstep(0, 150, d));

  // Coat transitions from soft newborn down to mature adult coat & gentle senior silvering
  const coatMaturity = smoothstep(14, 340, d);
  const coatSilvering = smoothstep(2200, 3650, d);

  // Realistic newborn eye opening: closed days 0-7, gradually opening days 8-14
  const eyeOpenness = smoothstep(7.5, 14.5, d);

  // Natural life-stage activity level and animation speed
  let activityLevel = 0.28;
  let animSpeedFactor = 0.72;
  if (stage === 'baby_kitten') {
    activityLevel = lerp(0.62, 1.05, stageProgress);
    animSpeedFactor = lerp(0.86, 1.04, stageProgress);
  } else if (stage === 'young_kitten') {
    activityLevel = lerp(1.15, 1.35, Math.sin(stageProgress * Math.PI));
    animSpeedFactor = 1.15;
  } else if (stage === 'adolescent') {
    activityLevel = lerp(1.24, 1.05, stageProgress);
    animSpeedFactor = 1.08;
  } else if (stage === 'adult') {
    activityLevel = lerp(1.0, 0.82, stageProgress);
    animSpeedFactor = lerp(1.0, 0.92, stageProgress);
  } else if (stage === 'senior') {
    activityLevel = lerp(0.72, 0.48, stageProgress);
    animSpeedFactor = lerp(0.86, 0.72, stageProgress);
  }

  // Breed-calibrated ideal weight curve (slightly leaner in very old senior years)
  const adultIdealMid = (morph.adultWeightMinKg + morph.adultWeightMaxKg) * 0.5;
  const idealWeightKg = Number(
    (lerp(0.11, adultIdealMid, overallGrowth) * lerp(1.0, 0.94, seniorProgress)).toFixed(2)
  );

  const canWalk = d >= 15;
  const canRun = d >= 57;
  const canJump = d >= 57;
  const canEatWetFood = d >= 21;
  const canEatDryFood = d >= 49;
  const canUseToys = d >= 18;

  let maxMoveSpeed = 0.08;
  if (d >= 15 && d < 57) {
    maxMoveSpeed = lerp(0.28, 0.58, (d - 15) / 42);
  } else if (d >= 57 && d < 181) {
    maxMoveSpeed = lerp(0.65, 1.28, (d - 57) / 124);
  } else if (d >= 181 && d < 2556) {
    maxMoveSpeed = lerp(1.18, 1.38, smoothstep(181, 366, d));
  } else if (d >= 2556) {
    maxMoveSpeed = lerp(1.08, 0.78, seniorProgress);
  }

  return {
    stage,
    stageProgress,
    overallGrowth,
    bodyScale,
    heightRatio,
    bodyLengthRatio,
    headRatio,
    legRatio,
    pawScale,
    tailRatio,
    earRatio,
    eyeOpenness,
    coatMaturity,
    coatSilvering,
    activityLevel,
    animSpeedFactor,
    idealWeightKg,
    canWalk,
    canRun,
    canJump,
    canEatWetFood,
    canEatDryFood,
    canUseToys,
    maxMoveSpeed
  };
}

export function isFoodSafeForAge(
  foodId: FoodItemId,
  ageDays: number
): {
  allowed: boolean;
  reasonTh?: string;
  reasonEn?: string;
} {
  const item = getFoodItem(foodId);
  if (ageDays < item.minAgeDays) {
    if (ageDays < 15) {
      return {
        allowed: false,
        reasonTh: 'ลูกแมวแรกเกิดยังทานอาหารนี้ไม่ได้ กรุณาป้อนนมแพะสำหรับลูกแมวเท่านั้น',
        reasonEn: 'Newborn kittens can only drink warm Kitten Milk Formula right now.'
      };
    }
    return {
      allowed: false,
      reasonTh: `อาหารนี้เหมาะสำหรับแมวอายุ ${item.minAgeDays} วันขึ้นไป ลองเลือกสูตรสำหรับลูกแมวแทนนะ`,
      reasonEn: `This food is suitable for ages ${item.minAgeDays}+ days. Please choose a kitten-safe option.`
    };
  }
  return { allowed: true };
}

/**
 * Frame-rate independent age advancement from real elapsed UTC timestamps.
 * Never duplicates growth across page reloads because lastSyncAtUtc strictly moves forward.
 */
export function advanceAgeFromUtc(
  currentAgeDays: number,
  lastSyncAtUtc: number,
  nowUtc: number,
  timeScale: number = ECONOMY_CONFIG.GAME_TIME_SCALE
): { ageDays: number; lastGrowthSyncAtUtc: number; deltaDays: number } {
  const safeLast = Number.isFinite(lastSyncAtUtc) ? lastSyncAtUtc : nowUtc;
  const elapsedSeconds = Math.max(0, (nowUtc - safeLast) / 1000);
  if (elapsedSeconds <= 0) {
    return {
      ageDays: currentAgeDays,
      lastGrowthSyncAtUtc: Math.max(safeLast, nowUtc),
      deltaDays: 0
    };
  }

  const deltaDays = (elapsedSeconds * Math.max(0, timeScale)) / REAL_SECONDS_PER_GAME_DAY_AT_1X;
  return {
    ageDays: currentAgeDays + deltaDays,
    lastGrowthSyncAtUtc: nowUtc,
    deltaDays
  };
}

export function advanceAgeDays(
  currentAgeDays: number,
  dtSeconds: number,
  timeScale: number = ECONOMY_CONFIG.GAME_TIME_SCALE
): number {
  const daysDelta = (dtSeconds * Math.max(0, timeScale)) / REAL_SECONDS_PER_GAME_DAY_AT_1X;
  return currentAgeDays + Math.max(0, daysDelta);
}
