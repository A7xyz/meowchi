import { getBreedDefinition } from '../config/breeds';
import { getFoodItem } from '../config/catalog';
import { CatBreed, CatGrowthMetrics, FoodItemId, LifeStage } from '../types/game';

/**
 * Configurable game-time progression:
 * At 1x speed, 1 in-game day passes every 480 real seconds (8 minutes).
 */
export const REAL_SECONDS_PER_GAME_DAY_AT_1X = 480;

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
 * Five realistic life stages by in-game age in days:
 * Stage 1: Newborn       0 - 14 days   (0-2 weeks)
 * Stage 2: Baby Kitten  15 - 56 days   (3-8 weeks)
 * Stage 3: Young Kitten 57 - 180 days  (2-6 months)
 * Stage 4: Adolescent  181 - 365 days  (6-12 months)
 * Stage 5: Adult       366+ days       (12+ months)
 */
export function getLifeStageForAge(ageDays: number): LifeStage {
  const d = Math.max(0, ageDays);
  if (d < 15) return 'newborn';
  if (d < 57) return 'baby_kitten';
  if (d < 181) return 'young_kitten';
  if (d < 366) return 'adolescent';
  return 'adult';
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
  else stageProgress = 1;

  const growthCurve =
    0.58 * smoothstep(0, 180, d) +
    0.34 * smoothstep(90, 365, d) +
    0.08 * smoothstep(300, 450, d);
  const overallGrowth = clamp(growthCurve, 0, 1);

  // Naturally adorable rounded kitten proportions morphing smoothly to breed adult frame
  const bodyScale = lerp(0.36, morph.adultScale, overallGrowth);
  const headRatio = lerp(1.34, 1.0, smoothstep(0, 240, d));
  const legRatio = lerp(0.64, 1.0, smoothstep(10, 220, d));
  const tailRatio = lerp(0.56, 1.0, smoothstep(7, 200, d));
  const earRatio = lerp(0.68, 1.0, smoothstep(0, 140, d));

  // Realistic newborn eye opening: closed days 0-7, gradually opening days 8-14
  const eyeOpenness = smoothstep(7.5, 14.5, d);

  // Breed-calibrated ideal weight curve
  const adultIdealMid = (morph.adultWeightMinKg + morph.adultWeightMaxKg) * 0.5;
  const idealWeightKg = Number(
    lerp(0.11, adultIdealMid, overallGrowth).toFixed(2)
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
    maxMoveSpeed = lerp(0.65, 1.25, (d - 57) / 124);
  } else if (d >= 181) {
    maxMoveSpeed = lerp(1.18, 1.36, smoothstep(181, 366, d));
  }

  return {
    stage,
    stageProgress,
    overallGrowth,
    bodyScale,
    headRatio,
    legRatio,
    tailRatio,
    earRatio,
    eyeOpenness,
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

export function advanceAgeDays(currentAgeDays: number, dtSeconds: number, timeScale: number): number {
  const daysDelta = (dtSeconds * timeScale) / REAL_SECONDS_PER_GAME_DAY_AT_1X;
  return currentAgeDays + Math.max(0, daysDelta);
}
