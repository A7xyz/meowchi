import { PersonalityTraits } from '../types/game';
import { clamp } from './growth';

function randRange(min: number, max: number, rng: () => number): number {
  return Math.round(min + rng() * (max - min));
}

/**
 * Generates a unique randomized 8-trait personality using weighted archetypes
 * so every newly adopted kitten feels genuinely distinct from day one.
 */
export function generateRandomPersonality(rng: () => number = Math.random): PersonalityTraits {
  const roll = rng();

  // Archetype A: Warm, affectionate & playful sweetheart (~28%)
  if (roll < 0.28) {
    return {
      aggression: randRange(6, 24, rng),
      affection: randRange(68, 92, rng),
      independence: randRange(20, 45, rng),
      fearfulness: randRange(12, 34, rng),
      playfulness: randRange(62, 88, rng),
      curiosity: randRange(50, 78, rng),
      sociability: randRange(65, 90, rng),
      trust: randRange(38, 60, rng)
    };
  }

  // Archetype B: Shy, cautious & observant (~22%)
  if (roll < 0.5) {
    return {
      aggression: randRange(18, 42, rng),
      affection: randRange(30, 56, rng),
      independence: randRange(55, 82, rng),
      fearfulness: randRange(62, 88, rng),
      playfulness: randRange(32, 60, rng),
      curiosity: randRange(42, 70, rng),
      sociability: randRange(18, 42, rng),
      trust: randRange(14, 34, rng)
    };
  }

  // Archetype C: Spirited, defensive & fiercely independent (~20%)
  if (roll < 0.7) {
    return {
      aggression: randRange(54, 80, rng),
      affection: randRange(18, 42, rng),
      independence: randRange(68, 92, rng),
      fearfulness: randRange(32, 58, rng),
      playfulness: randRange(45, 76, rng),
      curiosity: randRange(48, 76, rng),
      sociability: randRange(22, 46, rng),
      trust: randRange(16, 36, rng)
    };
  }

  // Archetype D: Curious, mischievous & independent explorer (~30%)
  return {
    aggression: randRange(16, 38, rng),
    affection: randRange(42, 68, rng),
    independence: randRange(58, 84, rng),
    fearfulness: randRange(14, 38, rng),
    playfulness: randRange(70, 94, rng),
    curiosity: randRange(74, 96, rng),
    sociability: randRange(46, 72, rng),
    trust: randRange(30, 52, rng)
  };
}

export type CarePersonalityEvent =
  | 'gentle_pet'
  | 'regular_feed'
  | 'play_session'
  | 'respect_space'
  | 'peaceful_sleep'
  | 'disturb_sleep'
  | 'unwanted_touch'
  | 'loud_startle';

/**
 * Gradually evolves personality traits based on how the player raises the kitten.
 * Early temperament remains noticeable; defensive reactions reflect stress/fear,
 * never malice, and can always heal gently through calm care.
 */
export function evolvePersonality(
  traits: PersonalityTraits,
  event: CarePersonalityEvent
): PersonalityTraits {
  const next = { ...traits };

  switch (event) {
    case 'gentle_pet':
      next.affection += 1.2;
      next.trust += 1.6;
      next.sociability += 0.9;
      next.fearfulness -= 0.9;
      next.aggression -= 0.7;
      break;
    case 'regular_feed':
      next.trust += 1.8;
      next.affection += 0.8;
      next.fearfulness -= 0.8;
      next.sociability += 0.6;
      break;
    case 'play_session':
      next.playfulness += 1.1;
      next.curiosity += 0.7;
      next.trust += 1.0;
      next.aggression -= 0.6;
      break;
    case 'respect_space':
      next.trust += 2.2;
      next.fearfulness -= 2.0;
      next.aggression -= 1.8;
      next.sociability += 0.8;
      break;
    case 'peaceful_sleep':
      next.fearfulness -= 0.5;
      next.aggression -= 0.5;
      next.trust += 0.4;
      break;
    case 'disturb_sleep':
      next.aggression += 2.2;
      next.fearfulness += 1.2;
      next.trust -= 1.4;
      next.independence += 0.8;
      break;
    case 'unwanted_touch':
      next.aggression += 2.8;
      next.fearfulness += 1.8;
      next.trust -= 1.8;
      next.affection -= 0.6;
      break;
    case 'loud_startle':
      next.fearfulness += 2.0;
      next.trust -= 0.6;
      break;
  }

  (Object.keys(next) as (keyof PersonalityTraits)[]).forEach((k) => {
    next[k] = Number(clamp(next[k], 4, 98).toFixed(1));
  });

  return next;
}

export function getDominantPersonalitySummary(
  traits: PersonalityTraits,
  lang: 'th' | 'en'
): string {
  if (traits.fearfulness >= 62 && traits.trust < 48) {
    return lang === 'th' ? 'ขี้อายและระแวดระวัง (ต้องค่อยๆ สร้างความไว้ใจ)' : 'Cautious & Shy (builds trust gently)';
  }
  if (traits.aggression >= 58 && traits.independence >= 60) {
    return lang === 'th' ? 'รักอิสระและหวงพื้นที่ส่วนตัว' : 'Spirited & Protective of Space';
  }
  if (traits.affection >= 68 && traits.sociability >= 60) {
    return lang === 'th' ? 'ขี้อ้อนและรักการอยู่ใกล้ชิด' : 'Warm, Social & Affectionate';
  }
  if (traits.curiosity >= 70 && traits.playfulness >= 68) {
    return lang === 'th' ? 'ขี้เล่นและนักสำรวจจอมซน' : 'Curious, Agile Explorer';
  }
  if (traits.independence >= 68) {
    return lang === 'th' ? 'สงบ รักอิสระ และช่างสังเกต' : 'Calm, Independent Observer';
  }
  return lang === 'th' ? 'อ่อนโยน สมดุล และปรับตัวเก่ง' : 'Gentle, Balanced Companion';
}
