import { getFoodItem } from '../config/catalog';
import { ECONOMY_CONFIG } from '../config/economy';
import {
  CatNeeds,
  CatRuntimeState,
  FoodItemId,
  RoomStatus
} from '../types/game';
import { addBondPoints } from './bond';
import { evaluateCatEmotion } from './emotions';
import { clamp, isFoodSafeForAge } from './growth';
import { evolvePersonality } from './personality';
import { addMealCalories } from './weight';

export type CatVocalCue =
  | 'happy_meow'
  | 'soft_meow'
  | 'greeting_meow'
  | 'attention_meow'
  | 'kitten_mew'
  | 'purr'
  | 'trill_chirp'
  | 'hiss'
  | 'low_growl'
  | 'distress'
  | 'play_chirp'
  | 'bite_snap'
  | 'sleepy_sigh'
  | 'eat'
  | 'drink'
  | 'clean'
  | 'feeder_dispense'
  | 'litter_motor';

export interface CareActionResult {
  success: boolean;
  refused?: boolean;
  triggeredBite?: boolean;
  messageTh: string;
  messageEn: string;
  cat: CatRuntimeState;
  room: RoomStatus;
  coinsEarned: 0; // Care actions NEVER directly generate Coins!
  xpEarned: number;
  bondLeveledUp: boolean;
  vocalCue?: CatVocalCue;
}

/**
 * Internal physiological & stress tick.
 * Hunger & satiety remain strictly internal (no UI hunger bar);
 * cats communicate hunger naturally via bowl visits, sniffing, and posture.
 */
export function tickNeeds(
  cat: CatRuntimeState,
  room: RoomStatus,
  dtSeconds: number,
  timeScale = 1,
  onSmartBed = false
): { needs: CatNeeds; room: RoomStatus } {
  const effectiveMinutes = (dtSeconds * Math.min(Math.max(0.1, timeScale), 4)) / 60;
  const n = { ...cat.needs };
  const r = { ...room };

  const isSleeping = cat.behavior === 'sleep';
  const isPlaying =
    cat.behavior === 'play' ||
    cat.behavior === 'run' ||
    cat.behavior === 'zoomies' ||
    cat.behavior === 'chase_imaginary' ||
    cat.behavior === 'roll_play' ||
    cat.behavior === 'pounce_crouch';
  const isHiding = cat.behavior === 'hide' || cat.behavior === 'box_ambush';
  const isNewborn = cat.lifeStage === 'newborn';

  // Age-appropriate metabolic hunger & thirst curves
  const hungerDecay =
    isNewborn ? 1.4 : cat.lifeStage === 'young_kitten' ? 1.1 : 0.92;
  const thirstDecay = isNewborn ? 0.85 : 1.02;

  n.hunger = clamp(n.hunger - hungerDecay * effectiveMinutes, 5, 100);
  n.thirst = clamp(n.thirst - thirstDecay * effectiveMinutes, 10, 100);

  if (isSleeping) {
    const bedBonus = onSmartBed ? 1.35 : 1.0;
    n.energy = clamp(n.energy + 6.8 * bedBonus * effectiveMinutes, 0, 100);
    n.stress = clamp(n.stress - 5.5 * bedBonus * effectiveMinutes, 0, 100);
    if (onSmartBed) {
      n.happiness = clamp(n.happiness + 0.8 * effectiveMinutes, 0, 100);
    }
  } else if (isPlaying) {
    n.energy = clamp(n.energy - 3.2 * effectiveMinutes, 0, 100);
    n.stress = clamp(n.stress - 2.6 * effectiveMinutes, 0, 100);
    n.happiness = clamp(n.happiness + 1.2 * effectiveMinutes, 0, 100);
  } else if (isHiding) {
    n.energy = clamp(n.energy + 1.5 * effectiveMinutes, 0, 100);
    n.stress = clamp(n.stress - 4.8 * effectiveMinutes, 0, 100);
  } else {
    n.energy = clamp(n.energy - 0.8 * effectiveMinutes, 0, 100);
    n.stress = clamp(n.stress - 1.8 * effectiveMinutes, 0, 100);
  }

  const litterPenalty = r.litterCleanliness < 35 ? 1.1 : 0.32;
  n.hygiene = clamp(n.hygiene - litterPenalty * effectiveMinutes, 10, 100);
  r.litterCleanliness = clamp(
    r.litterCleanliness - (isNewborn ? 0.22 : 0.62) * effectiveMinutes,
    0,
    100
  );

  if (r.litterCleanliness < 25) {
    n.stress = clamp(n.stress + 0.8 * effectiveMinutes, 0, 100);
  }

  const comfortAvg = (n.hunger + n.thirst + n.energy + n.hygiene) / 4;
  if (comfortAvg > 60 && n.stress < 30 && r.roomCleanliness > 50) {
    n.happiness = clamp(n.happiness + 0.45 * effectiveMinutes, 0, 100);
  } else if (comfortAvg < 32 || n.stress > 65) {
    n.happiness = clamp(n.happiness - 1.0 * effectiveMinutes, 10, 100);
  } else {
    n.happiness = clamp(n.happiness - 0.18 * effectiveMinutes, 15, 100);
  }

  const weightPenalty =
    cat.weight.condition === 'overweight' || cat.weight.condition === 'underweight' ? 0.2 : 0;
  if (n.hunger > 22 && n.thirst > 22 && n.hygiene > 25) {
    n.health = clamp(n.health + (0.45 - weightPenalty) * effectiveMinutes, 25, 100);
  } else {
    n.health = clamp(n.health - 0.3 * effectiveMinutes, 25, 100);
  }

  return { needs: n, room: r };
}

/**
 * Fair capped offline elapsed simulation — never harms or permanently punishes the cat.
 * NOTE: Age progression is handled strictly by `advanceAgeFromUtc` to prevent duplication.
 */
export function applyOfflineElapsed(
  cat: CatRuntimeState,
  room: RoomStatus,
  elapsedSeconds: number
): { cat: CatRuntimeState; room: RoomStatus } {
  const cappedHours = clamp(elapsedSeconds / 3600, 0, 12);
  if (cappedHours < 0.02) return { cat, room };

  const n = { ...cat.needs };
  n.hunger = clamp(Math.max(30, n.hunger - cappedHours * 5.8), 30, 100);
  n.thirst = clamp(Math.max(34, n.thirst - cappedHours * 5.5), 34, 100);
  n.energy = clamp(n.energy + cappedHours * 14, 40, 100);
  n.hygiene = clamp(Math.max(42, n.hygiene - cappedHours * 3.2), 42, 100);
  n.happiness = clamp(Math.max(48, n.happiness - cappedHours * 2.2), 48, 100);
  n.stress = clamp(n.stress - cappedHours * 15, 0, 100);

  const r = {
    ...room,
    litterCleanliness: clamp(Math.max(38, room.litterCleanliness - cappedHours * 4.2), 38, 100)
  };

  const updated: CatRuntimeState = {
    ...cat,
    needs: n,
    recentTouchCount: 0,
    ignoredWarningsCount: Math.max(0, cat.ignoredWarningsCount - Math.floor(cappedHours * 2))
  };
  updated.emotion = evaluateCatEmotion(updated);

  return { cat: updated, room: r };
}

export function performFeedAction(
  cat: CatRuntimeState,
  room: RoomStatus,
  foodId: FoodItemId
): CareActionResult {
  const safety = isFoodSafeForAge(foodId, cat.ageDays);
  if (!safety.allowed) {
    return {
      success: false,
      refused: true,
      messageTh: safety.reasonTh ?? 'อาหารนี้ไม่เหมาะกับช่วงวัยของน้องแมว',
      messageEn: safety.reasonEn ?? 'This food is not suitable for your cat’s life stage.',
      cat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: cat.ageDays < 60 ? 'kitten_mew' : 'soft_meow'
    };
  }

  const item = getFoodItem(foodId);

  if (cat.needs.hunger >= 92 && foodId !== 'cat_treat') {
    const nextCat: CatRuntimeState = {
      ...cat,
      behavior: cat.lifeStage === 'newborn' ? 'idle' : 'walk',
      behaviorTimer: 3.0
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);
    return {
      success: false,
      refused: true,
      messageTh: `${cat.identity.name} ดมชามเบาๆ แล้วเดินหันหลังไปอย่างสงบ (ดูเหมือนจะอิ่มแล้ว)`,
      messageEn: `${cat.identity.name} sniffs the bowl and calmly walks away—they seem satisfied right now.`,
      cat: nextCat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: 'soft_meow'
    };
  }

  const nextNeeds: CatNeeds = {
    ...cat.needs,
    hunger: clamp(cat.needs.hunger + item.satietyGain, 0, 100),
    thirst: clamp(cat.needs.thirst + item.hydrationGain, 0, 100),
    happiness: clamp(cat.needs.happiness + item.happinessGain, 0, 100),
    health: clamp(cat.needs.health + 2, 0, 100),
    stress: clamp(cat.needs.stress - 8, 0, 100)
  };

  const surplusMultiplier = cat.needs.hunger > 75 ? 1.45 : 1.0;
  const nextWeight = addMealCalories(cat.weight, item.calories * surplusMultiplier);
  const nextTraits = evolvePersonality(cat.traits, 'regular_feed');
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, item.bondGain);

  const nextRoom: RoomStatus = {
    ...room,
    foodBowlLevel: foodId === 'kitten_milk' ? room.foodBowlLevel : 100,
    foodBowlItemId: foodId
  };

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: nextNeeds,
    traits: nextTraits,
    weight: nextWeight,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    behavior: 'eat',
    behaviorTimer: 4.5,
    isPurring: foodId === 'kitten_milk' || foodId === 'premium_wet' || foodId === 'cat_treat',
    mouthOpenAmount: 0.45,
    ignoredWarningsCount: Math.max(0, cat.ignoredWarningsCount - 1)
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: `${cat.identity.name} กิน${item.nameTh}อย่างเอร็ดอร่อย`,
    messageEn: `${cat.identity.name} happily enjoys ${item.nameEn}.`,
    cat: nextCat,
    room: nextRoom,
    coinsEarned: 0,
    xpEarned: 10,
    bondLeveledUp: bond.leveledUp,
    vocalCue: cat.ageDays < 45 ? 'kitten_mew' : 'eat'
  };
}

export function performWaterAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  const isNewborn = cat.lifeStage === 'newborn';
  const nextRoom: RoomStatus = {
    ...room,
    waterBowlLevel: 100
  };

  const nextNeeds: CatNeeds = {
    ...cat.needs,
    thirst: clamp(cat.needs.thirst + (isNewborn ? 18 : 38), 0, 100),
    health: clamp(cat.needs.health + 2, 0, 100)
  };

  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 6);
  const nextCat: CatRuntimeState = {
    ...cat,
    needs: nextNeeds,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    behavior: isNewborn ? cat.behavior : 'drink',
    behaviorTimer: isNewborn ? cat.behaviorTimer : 3.5
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: isNewborn
      ? `เติมน้ำสะอาดเตรียมไว้ให้ฟรี และดูแลความชุ่มชื้นให้ ${cat.identity.name}`
      : `เติมน้ำสะอาดเต็มชามฟรี! ${cat.identity.name} เดินมาดื่มน้ำอย่างสดชื่น`,
    messageEn: isNewborn
      ? `Refilled fresh water for free and kept newborn ${cat.identity.name} comfortable.`
      : `Refilled fresh water for free! ${cat.identity.name} enjoys a cool drink.`,
    cat: nextCat,
    room: nextRoom,
    coinsEarned: 0,
    xpEarned: 4,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'drink'
  };
}

/**
 * Evaluates whether repeated ignored warnings should escalate into a rare defensive bite.
 * Biting ONLY happens from behavioral & emotional boundary violations, never randomly.
 */
function buildDefensiveBiteResult(
  cat: CatRuntimeState,
  room: RoomStatus,
  nowUtc: number
): CareActionResult {
  const nextTraits = evolvePersonality(cat.traits, 'unwanted_touch');
  nextTraits.trust = clamp(Number((nextTraits.trust - 2.5).toFixed(1)), 4, 98);

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      stress: clamp(cat.needs.stress + 28, 0, 100),
      happiness: clamp(cat.needs.happiness - 12, 0, 100)
    },
    traits: nextTraits,
    behavior: 'bite_defend',
    behaviorTimer: 2.2,
    isPurring: false,
    mouthOpenAmount: 1.0,
    recentTouchCount: cat.recentTouchCount + 1,
    recentTouchDecayTimer: 18,
    ignoredWarningsCount: 0,
    calmDownUntilUtc: nowUtc + ECONOMY_CONFIG.POST_BITE_CALM_DOWN_MS,
    lastBiteAtUtc: nowUtc,
    moodRefusalCooldown: 12
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: false,
    refused: true,
    triggeredBite: true,
    messageTh: `โอ๊ย! ${cat.identity.name} งับมือเบาๆ เพื่อป้องกันตัวเพราะคุณไม่ฟังสัญญาณเตือน ลองกด "ให้พื้นที่สงบ" เพื่อให้น้องคลายเครียดนะ`,
    messageEn: `Ouch! ${cat.identity.name} nipped defensively after repeated ignored warnings. Give them quiet space to calm down.`,
    cat: nextCat,
    room,
    coinsEarned: 0,
    xpEarned: 0,
    bondLeveledUp: false,
    vocalCue: 'bite_snap'
  };
}

/**
 * Realistic feline petting handler with defensive warning escalation & rare defensive biting:
 * - Zero Coins generated (anti-exploit).
 * - Respects sleep, hiding, low trust, and overstimulation boundaries.
 * - Escalates logically: warning hiss/growl/swat -> rare bite ONLY if boundaries keep being ignored.
 */
export function performPetAction(
  cat: CatRuntimeState,
  room: RoomStatus,
  nowUtc: number = Date.now()
): CareActionResult {
  const { traits, needs } = cat;
  const isKitten = cat.ageDays < 60;
  const isNewborn = cat.lifeStage === 'newborn';

  // 0. If cat is ALREADY actively hissing/defensive or in post-bite calm-down & player insists on touching
  if (
    !isNewborn &&
    (cat.behavior === 'hiss_defend' ||
      (nowUtc < cat.calmDownUntilUtc && needs.stress >= 45) ||
      (cat.ignoredWarningsCount >= 2 && (needs.stress >= 50 || traits.aggression >= 45 || traits.trust < 35)))
  ) {
    return buildDefensiveBiteResult(cat, room, nowUtc);
  }

  // 1. Disturbing cat while hiding in cardboard box / safe corner
  if (!isNewborn && cat.behavior === 'hide' && (traits.fearfulness >= 45 || needs.stress >= 30 || traits.trust < 45)) {
    const nextWarnings = cat.ignoredWarningsCount + 1;
    if (nextWarnings >= 3) {
      return buildDefensiveBiteResult(cat, room, nowUtc);
    }
    const nextTraits = evolvePersonality(traits, 'unwanted_touch');
    const nextCat: CatRuntimeState = {
      ...cat,
      needs: { ...needs, stress: clamp(needs.stress + 20, 0, 100) },
      traits: nextTraits,
      behavior: 'hiss_defend',
      behaviorTimer: 3.6,
      isPurring: false,
      mouthOpenAmount: 0.85,
      recentTouchCount: cat.recentTouchCount + 1,
      recentTouchDecayTimer: 14,
      ignoredWarningsCount: nextWarnings,
      moodRefusalCooldown: 8
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);

    return {
      success: false,
      refused: true,
      messageTh: `${cat.identity.name} กำลังหลบพักและขู่ฟ่อเตือนเมื่อถูกรบกวน ลองกด "ให้พื้นที่สงบ" เพื่อให้น้องอุ่นใจนะ`,
      messageEn: `${cat.identity.name} was hiding and hisses defensively when disturbed. Try "Give Personal Space" first.`,
      cat: nextCat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: 'hiss'
    };
  }

  // 2. Disturbing deep sleep
  if (cat.behavior === 'sleep' && needs.energy < 65 && !isNewborn) {
    const nextTraits = evolvePersonality(traits, 'disturb_sleep');
    const nextStress = clamp(needs.stress + 22, 0, 100);
    const isDefensive = nextTraits.aggression >= 42 || nextStress >= 52;
    const nextWarnings = isDefensive ? cat.ignoredWarningsCount + 1 : cat.ignoredWarningsCount;
    const nextCat: CatRuntimeState = {
      ...cat,
      needs: { ...needs, stress: nextStress, happiness: clamp(needs.happiness - 6, 0, 100) },
      traits: nextTraits,
      behavior: isDefensive ? 'hiss_defend' : 'yawn',
      behaviorTimer: 3.4,
      isPurring: false,
      mouthOpenAmount: isDefensive ? 0.85 : 0.65,
      recentTouchCount: cat.recentTouchCount + 1,
      recentTouchDecayTimer: 12,
      ignoredWarningsCount: nextWarnings
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);

    return {
      success: false,
      refused: true,
      messageTh: isDefensive
        ? `${cat.identity.name} สะดุ้งตื่นและหูลู่ขู่ฟ่อเพราะถูกรบกวนเวลานอน ลองปล่อยให้พักเงียบๆ นะ`
        : `${cat.identity.name} งัวเงียหาวแล้วขยับหนีเล็กน้อยเพราะยังง่วงอยู่`,
      messageEn: isDefensive
        ? `${cat.identity.name} flattens their ears and hisses—startled from sleep. Give them quiet space.`
        : `${cat.identity.name} yawns sleepily and shifts away to rest.`,
      cat: nextCat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: isDefensive ? 'hiss' : 'sleepy_sigh'
    };
  }

  // 3. Overstimulation / low-trust fear / defensive boundary warning
  const overstimulated =
    cat.recentTouchCount >= 3 && (traits.independence >= 50 || traits.aggression >= 45 || needs.stress >= 38);
  const fearfulAvoid = traits.fearfulness >= 62 && traits.trust < 38 && cat.moodRefusalCooldown <= 0;
  const defensiveBoundary =
    traits.aggression >= 58 && traits.affection < 48 && needs.stress >= 32;

  if (!isNewborn && (overstimulated || fearfulAvoid || defensiveBoundary)) {
    const nextWarnings = cat.ignoredWarningsCount + 1;
    if (nextWarnings >= 3 && (overstimulated || defensiveBoundary)) {
      return buildDefensiveBiteResult(cat, room, nowUtc);
    }

    const nextTraits = evolvePersonality(traits, 'unwanted_touch');
    const isDefensive = overstimulated || defensiveBoundary;
    const nextCat: CatRuntimeState = {
      ...cat,
      needs: {
        ...needs,
        stress: clamp(needs.stress + (isDefensive ? 24 : 16), 0, 100)
      },
      traits: nextTraits,
      behavior: isDefensive ? 'hiss_defend' : 'hide',
      behaviorTimer: 4.0,
      isPurring: false,
      mouthOpenAmount: isDefensive ? 0.85 : 0.25,
      recentTouchCount: cat.recentTouchCount + 1,
      recentTouchDecayTimer: 14,
      ignoredWarningsCount: nextWarnings,
      moodRefusalCooldown: 8
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);

    return {
      success: false,
      refused: true,
      messageTh: isDefensive
        ? `${cat.identity.name} หูลู่ หางสะบัด และขู่ฟ่อเตือน (ถูกรบกวนมากเกินไป กด "ให้พื้นที่สงบ" เพื่อปลอบนะ)`
        : `${cat.identity.name} หูลู่เล็กน้อยแล้วถอยไปหลบในมุมปลอดภัย ลองให้พื้นที่สงบเพื่อค่อยๆ สร้างความไว้ใจนะ`,
      messageEn: isDefensive
        ? `${cat.identity.name} flattens their ears, swishes their tail, and hisses! Use "Give Personal Space" so they can relax.`
        : `${cat.identity.name} retreats cautiously to a safe spot. Giving space builds trust.`,
      cat: nextCat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: isDefensive ? (traits.aggression >= 65 ? 'low_growl' : 'hiss') : 'distress'
    };
  }

  // 4. Positive gentle petting -> affectionate expressions (NO Coins!)
  const nextTraits = evolvePersonality(traits, 'gentle_pet');
  const bondGain = nextTraits.affection >= 65 ? 16 : 11;
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, bondGain);

  const nextNeeds: CatNeeds = {
    ...needs,
    happiness: clamp(needs.happiness + 12, 0, 100),
    stress: clamp(needs.stress - 10, 0, 100)
  };

  let nextBehavior = cat.behavior;
  if (!isNewborn && cat.behavior !== 'sleep') {
    if (nextTraits.affection >= 60 && cat.bondLevel >= 5) {
      nextBehavior = Math.random() < 0.5 ? 'head_bunt' : 'knead';
    } else {
      nextBehavior = 'sit';
    }
  }

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: nextNeeds,
    traits: nextTraits,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    isPurring: true,
    behavior: nextBehavior,
    behaviorTimer: Math.max(cat.behaviorTimer, 3.8),
    recentTouchCount: cat.recentTouchCount + 1,
    recentTouchDecayTimer: 10,
    ignoredWarningsCount: 0,
    mouthOpenAmount: 0.25
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  const msgTh =
    nextBehavior === 'head_bunt'
      ? `${cat.identity.name} เอาหัวมาถูมือคุณเบาๆ พร้อมส่งเสียงครางอย่างมีความสุข`
      : nextBehavior === 'knead'
        ? `${cat.identity.name} กะพริบตาช้าๆ และนวดอุ้งเท้าอย่างผ่อนคลาย`
        : `${cat.identity.name} ครางเบาๆ อย่างอุ่นใจเวลาคุณลูบขนฟูๆ`;

  const msgEn =
    nextBehavior === 'head_bunt'
      ? `${cat.identity.name} gently head-bunts your hand and purrs warmly!`
      : nextBehavior === 'knead'
        ? `${cat.identity.name} slow-blinks and kneads softly with their paws.`
        : `${cat.identity.name} purrs softly as you gently pet their fluffy coat.`;

  return {
    success: true,
    messageTh: msgTh,
    messageEn: msgEn,
    cat: nextCat,
    room,
    coinsEarned: 0,
    xpEarned: 6,
    bondLeveledUp: bond.leveledUp,
    vocalCue:
      isKitten && Math.random() < 0.35
        ? 'kitten_mew'
        : nextBehavior === 'head_bunt'
          ? 'trill_chirp'
          : 'purr'
  };
}

/**
 * Give Personal Space ("ให้พื้นที่สงบ"):
 * - MUST NEVER generate Coins (0 Coins, 0 XP).
 * - Gradually reduces stress, lowers defensiveness/fear, resets warnings, and builds trust.
 */
export function performRespectSpaceAction(
  cat: CatRuntimeState,
  room: RoomStatus
): CareActionResult {
  const nextTraits = evolvePersonality(cat.traits, 'respect_space');
  const wasTense =
    cat.needs.stress > 15 ||
    cat.behavior === 'hiss_defend' ||
    cat.behavior === 'bite_defend' ||
    cat.behavior === 'hide' ||
    cat.ignoredWarningsCount > 0;
  const bond = wasTense
    ? addBondPoints(cat.bondLevel, cat.bondXp, 8)
    : { bondLevel: cat.bondLevel, bondXp: cat.bondXp, leveledUp: false };

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      stress: clamp(cat.needs.stress - 28, 0, 100),
      happiness: clamp(cat.needs.happiness + (wasTense ? 8 : 2), 0, 100)
    },
    traits: nextTraits,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    behavior:
      cat.behavior === 'hiss_defend' || cat.behavior === 'bite_defend' ? 'sit' : cat.behavior,
    behaviorTimer: 4.0,
    recentTouchCount: 0,
    ignoredWarningsCount: 0,
    moodRefusalCooldown: 0,
    calmDownUntilUtc: 0,
    isPurring: nextTraits.trust >= 35 && cat.needs.stress < 45
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: `คุณถอยมือออกมาให้พื้นที่เงียบสงบ ${cat.identity.name} หูผ่อนคลายและค่อยๆ สงบลง`,
    messageEn: `You withdraw your hand and give ${cat.identity.name} quiet space. Their ears relax as stress fades.`,
    cat: nextCat,
    room,
    coinsEarned: 0,
    xpEarned: 0,
    bondLeveledUp: bond.leveledUp,
    vocalCue: wasTense ? 'soft_meow' : 'purr'
  };
}

export function performBrushAction(
  cat: CatRuntimeState,
  room: RoomStatus,
  nowUtc: number = Date.now()
): CareActionResult {
  const isNewborn = cat.lifeStage === 'newborn';

  if (
    !isNewborn &&
    (cat.behavior === 'hiss_defend' ||
      (cat.ignoredWarningsCount >= 2 && cat.needs.stress >= 55))
  ) {
    return buildDefensiveBiteResult(cat, room, nowUtc);
  }

  if (cat.needs.stress >= 58 && (cat.traits.aggression >= 48 || cat.traits.independence >= 65)) {
    const nextCat: CatRuntimeState = {
      ...cat,
      needs: { ...cat.needs, stress: clamp(cat.needs.stress + 12, 0, 100) },
      behavior: 'hiss_defend',
      behaviorTimer: 3.4,
      ignoredWarningsCount: cat.ignoredWarningsCount + 1,
      mouthOpenAmount: 0.78
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);
    return {
      success: false,
      refused: true,
      messageTh: `${cat.identity.name} ยังรู้สึกเครียดอยู่และขู่เตือน ไม่ยอมให้แปรงขนตอนนี้ ลองให้พื้นที่สงบก่อนนะ`,
      messageEn: `${cat.identity.name} feels tense and warns away the brush. Give them quiet space first.`,
      cat: nextCat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: 'low_growl'
    };
  }

  const nextTraits = evolvePersonality(cat.traits, 'gentle_pet');
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 12);

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      hygiene: clamp(cat.needs.hygiene + 34, 0, 100),
      happiness: clamp(cat.needs.happiness + 10, 0, 100),
      stress: clamp(cat.needs.stress - 12, 0, 100)
    },
    traits: nextTraits,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    isPurring: true,
    behavior: isNewborn ? cat.behavior : 'groom',
    behaviorTimer: isNewborn ? cat.behaviorTimer : 4.2,
    ignoredWarningsCount: 0
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: isNewborn
      ? `ใช้ผ้าอุ่นนุ่มๆ เช็ดขนให้ ${cat.identity.name} อย่างเบามือ`
      : `แปรงขนนุ่มฟูให้ ${cat.identity.name} จนฟูเงางามน่ากอด`,
    messageEn: isNewborn
      ? `Gently wiped newborn ${cat.identity.name} with a warm soft cloth.`
      : `Brushed ${cat.identity.name}’s fluffy coat until silky and soft.`,
    cat: nextCat,
    room,
    coinsEarned: 0,
    xpEarned: 8,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'purr'
  };
}

export function performSleepAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  if (cat.needs.energy > 92 && cat.lifeStage !== 'newborn') {
    return {
      success: false,
      refused: true,
      messageTh: `${cat.identity.name} ยังตื่นตัวเต็มที่ ยังไม่อยากงีบตอนนี้`,
      messageEn: `${cat.identity.name} is wide awake and full of energy right now.`,
      cat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: 'trill_chirp'
    };
  }

  const nextTraits = evolvePersonality(cat.traits, 'peaceful_sleep');
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 8);
  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      energy: clamp(cat.needs.energy + 16, 0, 100),
      stress: clamp(cat.needs.stress - 18, 0, 100),
      happiness: clamp(cat.needs.happiness + 6, 0, 100)
    },
    traits: nextTraits,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    behavior: 'sleep',
    behaviorTimer: 12.0,
    isPurring: true
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: `พา ${cat.identity.name} เข้านอนบนเบาะนุ่มอย่างสงบสุข`,
    messageEn: `Let ${cat.identity.name} curl up peacefully on their cozy bed.`,
    cat: nextCat,
    room,
    coinsEarned: 0,
    xpEarned: 5,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'sleepy_sigh'
  };
}

export function performCleanLitterAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 6);
  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      hygiene: clamp(cat.needs.hygiene + 10, 0, 100),
      stress: clamp(cat.needs.stress - 8, 0, 100)
    },
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: 'ตักทรายและดูแลกระบะทรายจนสะอาดหอมแล้ว',
    messageEn: 'Scooped and refreshed the litter box until spotless.',
    cat: nextCat,
    room: { ...room, litterCleanliness: 100 },
    coinsEarned: 0,
    xpEarned: 6,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'clean'
  };
}

export function performCleanRoomAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  const wasKnocked = room.tableMugKnocked;
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 6);
  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      happiness: clamp(cat.needs.happiness + 5, 0, 100),
      stress: clamp(cat.needs.stress - 6, 0, 100)
    },
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: wasKnocked
      ? 'เก็บแก้วที่น้องแมวแอบปัดตกและจัดห้องให้สงบเรียบร้อยแล้ว'
      : 'จัดระเบียบบ้านให้น่าอยู่และเงียบสงบแล้ว',
    messageEn: wasKnocked
      ? 'Picked up the knocked-over mug and tidied the cozy room!'
      : 'Tidied the home so it feels calm and cozy.',
    cat: nextCat,
    room: { ...room, roomCleanliness: 100, tableMugKnocked: false },
    coinsEarned: 0,
    xpEarned: 6,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'clean'
  };
}
