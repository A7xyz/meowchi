import { ECONOMY_CONFIG } from '../config/economy';
import {
  CatMemorialEntry,
  CatRuntimeState,
  CatSurvivalState,
  CatWelfareWarning,
  PhotoEntry,
  RoomStatus,
  SurvivalMode
} from '../types/game';
import { clamp } from './growth';

export function createInitialSurvivalState(
  nowUtc: number = Date.now(),
  offlineGraceHours: number = ECONOMY_CONFIG.SURVIVAL.DEFAULT_OFFLINE_GRACE_HOURS
): CatSurvivalState {
  return {
    isAlive: true,
    dehydrationHours: 0,
    malnutritionHours: 0,
    criticalHealthHours: 0,
    lastCareAtUtc: nowUtc,
    offlineGraceHours,
    warnings: []
  };
}

/**
 * Evaluates natural, non-numerical welfare warnings from internal needs & survival clocks.
 * Never exposes numeric hunger/fullness bars — only clear, caring human-readable cues.
 */
export function evaluateWelfareWarnings(
  cat: CatRuntimeState,
  survival: CatSurvivalState,
  room?: RoomStatus
): CatWelfareWarning[] {
  if (!survival.isAlive) return [];

  const warnings: CatWelfareWarning[] = [];
  const { hunger, thirst, health, stress, happiness } = cat.needs;
  const cfg = ECONOMY_CONFIG.SURVIVAL;
  const isNewborn = cat.lifeStage === 'newborn';

  // 1. Critical health warning (highest priority, always shown before death is ever possible)
  if (health <= cfg.CRITICAL_HEALTH_THRESHOLD + 8 || survival.criticalHealthHours > 0) {
    warnings.push({
      id: 'warn_critical_health',
      severity: 'critical',
      type: 'health',
      messageTh: `สุขภาพของ ${cat.identity.name} อยู่ในภาวะวิกฤต! รีบให้น้ำ อาหาร และดูแลอย่างเร่งด่วน`,
      messageEn: `${cat.identity.name} is critically weak! Please provide fresh water, food, and gentle care right away.`
    });
  }

  // 2. Hydration / Water warnings
  if (thirst <= cfg.ESCALATING_THIRST || survival.dehydrationHours >= 12) {
    warnings.push({
      id: 'warn_water_urgent',
      severity: 'escalating',
      type: 'water',
      messageTh: `${cat.identity.name} กระหายน้ำมากและกำลังขาดน้ำ กรุณาเติมน้ำสะอาดทันที`,
      messageEn: `${cat.identity.name} is becoming dehydrated and urgently needs fresh water.`
    });
  } else if (thirst <= cfg.MILD_WARNING_THIRST || (room && room.waterBowlLevel < 15 && thirst < 55)) {
    warnings.push({
      id: 'warn_water_mild',
      severity: 'mild',
      type: 'water',
      messageTh: 'น้องแมวต้องการน้ำสะอาด',
      messageEn: 'Your cat needs fresh water.'
    });
  }

  // 3. Nutrition / Food warnings (age-appropriate for newborns!)
  if (hunger <= cfg.ESCALATING_HUNGER || survival.malnutritionHours >= 14) {
    warnings.push({
      id: 'warn_food_urgent',
      severity: 'escalating',
      type: 'food',
      messageTh: isNewborn
        ? `ลูกแมวแรกเกิด ${cat.identity.name} หิวมากแล้ว กรุณาป้อนนมแพะสำหรับลูกแมว`
        : `${cat.identity.name} ไม่ได้กินอาหารมานานและเริ่มอ่อนแรง กรุณาให้อาหาร`,
      messageEn: isNewborn
        ? `Newborn ${cat.identity.name} urgently needs warm Kitten Milk Formula.`
        : `${cat.identity.name} has not eaten for a long time and is growing weak.`
    });
  } else if (hunger <= cfg.MILD_WARNING_HUNGER) {
    warnings.push({
      id: 'warn_food_mild',
      severity: 'mild',
      type: 'food',
      messageTh: isNewborn
        ? 'ลูกแมวแรกเกิดร้องหานมแพะอุ่นๆ แล้ว'
        : 'น้องแมวไม่ได้กินอาหารมานานแล้ว',
      messageEn: isNewborn
        ? 'Your newborn kitten needs warm kitten milk.'
        : 'Your cat has not eaten for a long time.'
    });
  }

  // 4. Emotional / Attention / Stress warning
  if (stress >= 72 || happiness <= 26) {
    warnings.push({
      id: 'warn_attention',
      severity: stress >= 85 ? 'escalating' : 'mild',
      type: 'attention',
      messageTh: 'น้องแมวต้องการความเอาใจใส่และการดูแล',
      messageEn: 'Your cat needs attention.'
    });
  }

  return warnings;
}

/**
 * Steps live survival timers and health deterioration during active play.
 * - Balanced: never kills quickly; requires sustained dehydration/malnutrition & critical health.
 * - Casual Mode: strictly disables death and keeps health floored safely.
 */
export function stepSurvivalLive(
  cat: CatRuntimeState,
  survival: CatSurvivalState,
  room: RoomStatus,
  dtSeconds: number,
  survivalMode: SurvivalMode,
  nowUtc: number = Date.now()
): { cat: CatRuntimeState; survival: CatSurvivalState; justDied: boolean } {
  if (!survival.isAlive) {
    return { cat, survival, justDied: false };
  }

  const dtHours = Math.max(0, dtSeconds) / 3600;
  const nextSurvival: CatSurvivalState = { ...survival };
  const nextNeeds = { ...cat.needs };
  const cfg = ECONOMY_CONFIG.SURVIVAL;
  const isNewborn = cat.lifeStage === 'newborn';

  // Track prolonged dehydration & malnutrition
  if (nextNeeds.thirst <= cfg.ESCALATING_THIRST) {
    nextSurvival.dehydrationHours += dtHours * (isNewborn ? 1.3 : 1.0);
  } else if (nextNeeds.thirst >= 55) {
    nextSurvival.dehydrationHours = Math.max(0, nextSurvival.dehydrationHours - dtHours * 6);
  }

  if (nextNeeds.hunger <= cfg.ESCALATING_HUNGER) {
    nextSurvival.malnutritionHours += dtHours * (isNewborn ? 1.35 : 1.0);
  } else if (nextNeeds.hunger >= 55) {
    nextSurvival.malnutritionHours = Math.max(0, nextSurvival.malnutritionHours - dtHours * 5);
  }

  // Health impact from prolonged severe lack of food/water
  if (nextSurvival.dehydrationHours > 2 || nextSurvival.malnutritionHours > 3) {
    const drainPerHour =
      (nextSurvival.dehydrationHours > 2 ? 2.4 : 0) +
      (nextSurvival.malnutritionHours > 3 ? 1.8 : 0);
    const minHealth = survivalMode === 'casual' ? 30 : 0;
    nextNeeds.health = clamp(nextNeeds.health - drainPerHour * dtHours, minHealth, 100);
  } else if (nextNeeds.thirst >= 45 && nextNeeds.hunger >= 45 && nextNeeds.hygiene >= 35) {
    nextNeeds.health = clamp(nextNeeds.health + 4.5 * dtHours, 0, 100);
  }

  // Critical health countdown (only advances once warnings exist and health is critical)
  if (survivalMode === 'standard' && nextNeeds.health <= cfg.CRITICAL_HEALTH_THRESHOLD) {
    nextSurvival.criticalHealthHours += dtHours;
  } else {
    nextSurvival.criticalHealthHours = Math.max(0, nextSurvival.criticalHealthHours - dtHours * 4);
  }

  const deathThreshold = isNewborn
    ? cfg.NEWBORN_CRITICAL_HOURS_BEFORE_DEATH
    : cfg.CRITICAL_HOURS_BEFORE_DEATH;

  let justDied = false;
  if (
    survivalMode === 'standard' &&
    nextNeeds.health <= 5 &&
    nextSurvival.criticalHealthHours >= deathThreshold
  ) {
    nextSurvival.isAlive = false;
    nextSurvival.passedAtUtc = nowUtc;
    nextSurvival.causeOfDeath =
      nextSurvival.dehydrationHours >= nextSurvival.malnutritionHours
        ? 'dehydration'
        : nextSurvival.malnutritionHours > 0
          ? 'malnutrition'
          : 'neglect';
    nextSurvival.warnings = [];
    justDied = true;
  }

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: nextNeeds
  };
  if (!justDied) {
    nextSurvival.warnings = evaluateWelfareWarnings(nextCat, nextSurvival, room);
  }

  return { cat: nextCat, survival: nextSurvival, justDied };
}

/**
 * Applies fair offline survival progression with a configurable grace period.
 * - Closing the app for a few hours (or within offlineGraceHours, default 24h) NEVER kills the cat!
 * - Even after prolonged multi-day offline neglect in Standard Mode, first drops into
 *   critical warning state before death unless sustained far beyond the grace + critical window.
 */
export function applyOfflineSurvival(
  cat: CatRuntimeState,
  survival: CatSurvivalState,
  room: RoomStatus,
  elapsedSeconds: number,
  survivalMode: SurvivalMode,
  offlineGraceHours: number = ECONOMY_CONFIG.SURVIVAL.DEFAULT_OFFLINE_GRACE_HOURS,
  nowUtc: number = Date.now()
): { cat: CatRuntimeState; survival: CatSurvivalState; justDied: boolean } {
  if (!survival.isAlive) {
    return { cat, survival, justDied: false };
  }

  const elapsedHours = Math.max(0, elapsedSeconds / 3600);
  const grace = Math.max(6, offlineGraceHours);
  const nextSurvival: CatSurvivalState = {
    ...survival,
    offlineGraceHours: grace
  };
  const nextNeeds = { ...cat.needs };
  const nextWeight = { ...cat.weight };

  // Within the grace period: cat never enters fatal decline!
  if (elapsedHours <= grace) {
    nextSurvival.warnings = evaluateWelfareWarnings(cat, nextSurvival, room);
    return { cat, survival: nextSurvival, justDied: false };
  }

  const neglectHours = elapsedHours - grace;
  const isNewborn = cat.lifeStage === 'newborn';

  // Gradually decrease needs beyond grace period if bowls are empty
  const hasFood = room.foodBowlLevel > 12;
  const hasWater = room.waterBowlLevel > 12;

  if (!hasWater) {
    nextNeeds.thirst = clamp(nextNeeds.thirst - neglectHours * 2.1, survivalMode === 'casual' ? 20 : 0, 100);
    if (nextNeeds.thirst <= ECONOMY_CONFIG.SURVIVAL.ESCALATING_THIRST) {
      nextSurvival.dehydrationHours += neglectHours * (isNewborn ? 1.25 : 1.0);
    }
  }
  if (!hasFood) {
    nextNeeds.hunger = clamp(nextNeeds.hunger - neglectHours * 1.8, survivalMode === 'casual' ? 20 : 0, 100);
    if (nextNeeds.hunger <= ECONOMY_CONFIG.SURVIVAL.ESCALATING_HUNGER) {
      nextSurvival.malnutritionHours += neglectHours * (isNewborn ? 1.3 : 1.0);
      // Visible deterioration of body condition under prolonged malnutrition
      nextWeight.bodyFatIndex = Number(
        clamp(nextWeight.bodyFatIndex - neglectHours * 0.008, -0.75, 0.85).toFixed(4)
      );
      if (nextWeight.bodyFatIndex <= -0.38) {
        nextWeight.condition = 'underweight';
      }
    }
  }

  const severeHours = Math.max(0, Math.max(nextSurvival.dehydrationHours, nextSurvival.malnutritionHours) - 6);
  const healthFloor = survivalMode === 'casual' ? 30 : 0;
  if (severeHours > 0) {
    nextNeeds.health = clamp(nextNeeds.health - severeHours * 1.6, healthFloor, 100);
  }

  const cfg = ECONOMY_CONFIG.SURVIVAL;
  const deathThreshold = isNewborn
    ? cfg.NEWBORN_CRITICAL_HOURS_BEFORE_DEATH
    : cfg.CRITICAL_HOURS_BEFORE_DEATH;

  if (survivalMode === 'standard' && nextNeeds.health <= cfg.CRITICAL_HEALTH_THRESHOLD) {
    nextSurvival.criticalHealthHours += Math.max(0, severeHours - 10);
  }

  let justDied = false;
  if (
    survivalMode === 'standard' &&
    nextNeeds.health <= 5 &&
    nextSurvival.criticalHealthHours >= deathThreshold
  ) {
    nextSurvival.isAlive = false;
    nextSurvival.passedAtUtc = nowUtc;
    nextSurvival.causeOfDeath =
      nextSurvival.dehydrationHours >= nextSurvival.malnutritionHours
        ? 'dehydration'
        : 'malnutrition';
    nextSurvival.warnings = [];
    justDied = true;
  }

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: nextNeeds,
    weight: nextWeight
  };
  if (!justDied) {
    nextSurvival.warnings = evaluateWelfareWarnings(nextCat, nextSurvival, room);
  }

  return { cat: nextCat, survival: nextSurvival, justDied };
}

/**
 * Resets survival neglect timers cleanly when the player feeds, hydrates, or cares for the cat.
 */
export function recordSurvivalCare(
  survival: CatSurvivalState,
  careType: 'food' | 'water' | 'general',
  nowUtc: number = Date.now()
): CatSurvivalState {
  if (!survival.isAlive) return survival;
  return {
    ...survival,
    lastCareAtUtc: nowUtc,
    dehydrationHours: careType === 'water' ? 0 : survival.dehydrationHours,
    malnutritionHours: careType === 'food' ? 0 : survival.malnutritionHours,
    criticalHealthHours:
      careType === 'food' || careType === 'water'
        ? Math.max(0, survival.criticalHealthHours * 0.35)
        : Math.max(0, survival.criticalHealthHours * 0.7)
  };
}

/**
 * Builds a respectful memorial record preserving memories of a beloved cat in the album.
 */
export function createMemorialEntry(
  cat: CatRuntimeState,
  survival: CatSurvivalState,
  photos: PhotoEntry[],
  nowUtc: number = Date.now()
): CatMemorialEntry {
  const passedAt = survival.passedAtUtc ?? nowUtc;
  const daysTogether = Math.max(1, Math.floor((passedAt - cat.identity.adoptedAt) / 86_400_000) + 1);
  const matchingPhoto = photos.find((p) => p.catName === cat.identity.name) ?? photos[0];

  return {
    id: `mem_${cat.identity.id}_${passedAt}`,
    catName: cat.identity.name,
    breed: cat.identity.breed,
    ageDays: Math.floor(cat.ageDays),
    adoptedAt: cat.identity.adoptedAt,
    passedAt,
    daysTogether,
    photoDataUrl: matchingPhoto?.dataUrl,
    bondLevel: cat.bondLevel,
    epitaphTh: `อยู่ในความทรงจำอันแสนอบอุ่นตลอดไป — ขอบคุณที่มอบความรักและความสุขให้กันตลอดมา`,
    epitaphEn: `Forever cherished in warm memory — thank you for every purr, nap, and gentle moment together.`
  };
}
