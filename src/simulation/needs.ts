import { getFoodItem } from '../config/catalog';
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
  | 'soft_meow'
  | 'greeting_meow'
  | 'kitten_mew'
  | 'purr'
  | 'trill_chirp'
  | 'hiss'
  | 'low_growl'
  | 'distress'
  | 'play_chirp'
  | 'sleepy_sigh'
  | 'eat'
  | 'drink'
  | 'clean';

export interface CareActionResult {
  success: boolean;
  refused?: boolean;
  messageTh: string;
  messageEn: string;
  cat: CatRuntimeState;
  room: RoomStatus;
  coinsEarned: number;
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
  timeScale: number
): { needs: CatNeeds; room: RoomStatus } {
  const effectiveMinutes = (dtSeconds * Math.min(timeScale, 8)) / 60;
  const n = { ...cat.needs };
  const r = { ...room };

  const isSleeping = cat.behavior === 'sleep';
  const isPlaying =
    cat.behavior === 'play' || cat.behavior === 'run' || cat.behavior === 'pounce_crouch';
  const isHiding = cat.behavior === 'hide';
  const isNewborn = cat.lifeStage === 'newborn';

  // Internal satiety & hydration decay gently (no harsh sudden penalties)
  n.hunger = clamp(n.hunger - (isNewborn ? 1.35 : 0.95) * effectiveMinutes, 5, 100);
  n.thirst = clamp(n.thirst - (isNewborn ? 0.85 : 1.05) * effectiveMinutes, 10, 100);

  if (isSleeping) {
    n.energy = clamp(n.energy + 6.8 * effectiveMinutes, 0, 100);
    n.stress = clamp(n.stress - 5.5 * effectiveMinutes, 0, 100);
  } else if (isPlaying) {
    n.energy = clamp(n.energy - 3.0 * effectiveMinutes, 0, 100);
    n.stress = clamp(n.stress - 2.4 * effectiveMinutes, 0, 100);
  } else if (isHiding) {
    // Safe hiding spot calms a fearful/stressed cat naturally
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

  // Peaceful room comforts the cat; messy litter slowly adds mild discomfort
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

  // Health stays strong with reasonable care; weight extremes gently nudge health
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

  const offlineAgeGain = Math.min(0.5, cappedHours * 0.08);
  const updated: CatRuntimeState = {
    ...cat,
    ageDays: cat.ageDays + offlineAgeGain,
    needs: n
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

  // Natural feline satiety cue: when already satisfied, the cat sniffs and walks away
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

  // Extra calories when already quite full contribute more noticeably to gradual weight gain
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
    mouthOpenAmount: 0.45
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: `${cat.identity.name} กิน${item.nameTh}อย่างเอร็ดอร่อย`,
    messageEn: `${cat.identity.name} happily enjoys ${item.nameEn}.`,
    cat: nextCat,
    room: nextRoom,
    coinsEarned: 6,
    xpEarned: 12,
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

  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 8);
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
    coinsEarned: 4,
    xpEarned: 6,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'drink'
  };
}

/**
 * Realistic feline petting handler:
 * - Respects sleep (disturbing sleep increases stress & defensiveness!)
 * - Detects overstimulation (repeated touches on defensive/independent/fearful cats)
 * - Rewards gentle petting with purring, kneading, head-bunting, and slow growth in trust & affection.
 */
export function performPetAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  const { traits, needs } = cat;
  const isKitten = cat.ageDays < 60;

  // 1. Disturbing deep sleep (especially for independent/defensive/exhausted cats)
  if (cat.behavior === 'sleep' && needs.energy < 65 && cat.lifeStage !== 'newborn') {
    const nextTraits = evolvePersonality(traits, 'disturb_sleep');
    const nextStress = clamp(needs.stress + 22, 0, 100);
    const isDefensive = nextTraits.aggression >= 45 || nextStress >= 55;
    const nextCat: CatRuntimeState = {
      ...cat,
      needs: { ...needs, stress: nextStress, happiness: clamp(needs.happiness - 6, 0, 100) },
      traits: nextTraits,
      behavior: isDefensive ? 'hiss_defend' : 'yawn',
      behaviorTimer: 3.4,
      isPurring: false,
      mouthOpenAmount: isDefensive ? 0.8 : 0.65,
      recentTouchCount: cat.recentTouchCount + 1,
      recentTouchDecayTimer: 12
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);

    return {
      success: false,
      refused: true,
      messageTh: isDefensive
        ? `${cat.identity.name} สะดุ้งตื่นและหูลู่ขู่เบาๆ เพราะถูกรบกวนเวลานอน ลองปล่อยให้พักเงียบๆ นะ`
        : `${cat.identity.name} งัวเงียหาวแล้วขยับหนีเล็กน้อยเพราะยังง่วงอยู่`,
      messageEn: isDefensive
        ? `${cat.identity.name} flattens their ears and hisses softly—they were startled from sleep. Give them quiet rest.`
        : `${cat.identity.name} yawns sleepily and shifts away to rest.`,
      cat: nextCat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: isDefensive ? 'hiss' : 'sleepy_sigh'
    };
  }

  // 2. Fearful / low-trust avoidance or overstimulation defensive swat/hiss
  const overstimulated =
    cat.recentTouchCount >= 3 && (traits.independence >= 55 || traits.aggression >= 48);
  const fearfulAvoid = traits.fearfulness >= 62 && traits.trust < 38 && cat.moodRefusalCooldown <= 0;
  const defensiveBoundary =
    traits.aggression >= 62 && traits.affection < 45 && needs.stress >= 35;

  if (overstimulated || fearfulAvoid || defensiveBoundary) {
    const nextTraits = evolvePersonality(traits, 'unwanted_touch');
    const isDefensive = overstimulated || defensiveBoundary;
    const nextCat: CatRuntimeState = {
      ...cat,
      needs: {
        ...needs,
        stress: clamp(needs.stress + (isDefensive ? 26 : 16), 0, 100)
      },
      traits: nextTraits,
      behavior: isDefensive
        ? 'hiss_defend'
        : cat.lifeStage === 'newborn'
          ? 'idle'
          : 'hide',
      behaviorTimer: 4.0,
      isPurring: false,
      mouthOpenAmount: isDefensive ? 0.85 : 0.25,
      recentTouchCount: cat.recentTouchCount + 1,
      recentTouchDecayTimer: 14,
      moodRefusalCooldown: 8
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);

    return {
      success: false,
      refused: true,
      messageTh: isDefensive
        ? `${cat.identity.name} หางสะบัดและขู่ฟ่อเตือนเบาๆ (รู้สึกถูกรบกวนมากเกินไป ลองกด "ให้พื้นที่สงบ" เพื่อปลอบนะ)`
        : `${cat.identity.name} หูลู่เล็กน้อยแล้วถอยไปหลบในมุมปลอดภัย ลองให้พื้นที่สงบหรือวางอาหารให้ค่อยๆ ไว้ใจนะ`,
      messageEn: isDefensive
        ? `${cat.identity.name} swishes their tail and hisses defensively—overstimulated! Use "Give Quiet Space" to help them relax.`
        : `${cat.identity.name} ducks cautiously into a safe spot. Respecting their space builds trust.`,
      cat: nextCat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: isDefensive ? (traits.aggression >= 65 ? 'low_growl' : 'hiss') : 'distress'
    };
  }

  // 3. Positive gentle petting -> affectionate expressions (head bunt / knead / purr)
  const nextTraits = evolvePersonality(traits, 'gentle_pet');
  const bondGain = nextTraits.affection >= 65 ? 18 : 13;
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, bondGain);

  const nextNeeds: CatNeeds = {
    ...needs,
    happiness: clamp(needs.happiness + 14, 0, 100),
    stress: clamp(needs.stress - 10, 0, 100)
  };

  let nextBehavior = cat.behavior;
  if (cat.lifeStage !== 'newborn' && cat.behavior !== 'sleep') {
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
    coinsEarned: 5,
    xpEarned: 10,
    bondLeveledUp: bond.leveledUp,
    vocalCue: isKitten && Math.random() < 0.35 ? 'kitten_mew' : nextBehavior === 'head_bunt' ? 'trill_chirp' : 'purr'
  };
}

/**
 * Positive care action for fearful, stressed, or defensive cats:
 * Respecting their personal space visibly calms stress, lowers fear/aggression, and builds trust.
 */
export function performRespectSpaceAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  const nextTraits = evolvePersonality(cat.traits, 'respect_space');
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 12);
  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      stress: clamp(cat.needs.stress - 35, 0, 100),
      happiness: clamp(cat.needs.happiness + 10, 0, 100)
    },
    traits: nextTraits,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    behavior: cat.behavior === 'hiss_defend' ? 'sit' : cat.behavior,
    behaviorTimer: 4.0,
    recentTouchCount: 0,
    moodRefusalCooldown: 0,
    isPurring: nextTraits.trust >= 35
  };
  nextCat.emotion = evaluateCatEmotion(nextCat);

  return {
    success: true,
    messageTh: `คุณถอยออกมาให้พื้นที่เงียบสงบ ${cat.identity.name} หูผ่อนคลายและกะพริบตาช้าๆ ด้วยความไว้ใจ`,
    messageEn: `You calmly give ${cat.identity.name} quiet space. Their ears relax and they slow-blink with growing trust.`,
    cat: nextCat,
    room,
    coinsEarned: 5,
    xpEarned: 10,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'purr'
  };
}

export function performBrushAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  if (cat.needs.stress >= 60 && cat.traits.aggression >= 50) {
    return {
      success: false,
      refused: true,
      messageTh: `${cat.identity.name} ยังรู้สึกเครียดอยู่ ยังไม่ยอมให้แปรงขนตอนนี้ ลองให้พื้นที่สงบก่อนนะ`,
      messageEn: `${cat.identity.name} feels tense and avoids the brush right now. Give them quiet space first.`,
      cat,
      room,
      coinsEarned: 0,
      xpEarned: 0,
      bondLeveledUp: false,
      vocalCue: 'low_growl'
    };
  }

  const nextTraits = evolvePersonality(cat.traits, 'gentle_pet');
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 14);
  const isNewborn = cat.lifeStage === 'newborn';

  const nextCat: CatRuntimeState = {
    ...cat,
    needs: {
      ...cat.needs,
      hygiene: clamp(cat.needs.hygiene + 34, 0, 100),
      happiness: clamp(cat.needs.happiness + 12, 0, 100),
      stress: clamp(cat.needs.stress - 12, 0, 100)
    },
    traits: nextTraits,
    bondLevel: bond.bondLevel,
    bondXp: bond.bondXp,
    isPurring: true,
    behavior: isNewborn ? cat.behavior : 'groom',
    behaviorTimer: isNewborn ? cat.behaviorTimer : 4.2
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
    coinsEarned: 8,
    xpEarned: 12,
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
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 10);
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
    coinsEarned: 5,
    xpEarned: 8,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'sleepy_sigh'
  };
}

export function performCleanLitterAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 8);
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
    coinsEarned: 10,
    xpEarned: 10,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'clean'
  };
}

export function performCleanRoomAction(cat: CatRuntimeState, room: RoomStatus): CareActionResult {
  const wasKnocked = room.tableMugKnocked;
  const bond = addBondPoints(cat.bondLevel, cat.bondXp, 8);
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
    coinsEarned: 10,
    xpEarned: 10,
    bondLeveledUp: bond.leveledUp,
    vocalCue: 'clean'
  };
}
