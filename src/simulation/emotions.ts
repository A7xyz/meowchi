import { CatEmotion, CatRuntimeState } from '../types/game';

/**
 * Evaluates the cat's current realistic feline emotion state from internal
 * physiology, stress, personality traits, and current behavior.
 */
export function evaluateCatEmotion(cat: CatRuntimeState): CatEmotion {
  const { needs, traits, behavior, isPurring } = cat;

  // 1. Defensive / Angry (overstimulated, startled, or stressed defensive cat)
  if (
    behavior === 'hiss_defend' ||
    (needs.stress >= 68 && traits.aggression >= 42) ||
    (needs.stress >= 78)
  ) {
    return 'defensive_angry';
  }

  // 2. Fearful (hiding, startled, or high stress in a cautious cat)
  if (
    behavior === 'hide' ||
    (needs.stress >= 48 && traits.fearfulness >= 48) ||
    (behavior === 'react_to_sound' && traits.fearfulness >= 55)
  ) {
    return 'fearful';
  }

  // 3. Sleepy
  if (behavior === 'sleep' || behavior === 'yawn' || needs.energy <= 28) {
    return 'sleepy';
  }

  // 4. Playful
  if (
    behavior === 'play' ||
    behavior === 'pounce_crouch' ||
    behavior === 'run' ||
    (behavior === 'jump' && traits.playfulness >= 50)
  ) {
    return 'playful';
  }

  // 5. Affectionate
  if (
    behavior === 'knead' ||
    behavior === 'head_bunt' ||
    behavior === 'approach_player' ||
    (isPurring && traits.affection >= 48 && needs.stress < 25)
  ) {
    return 'affectionate';
  }

  // 6. Curious
  if (
    behavior === 'explore' ||
    behavior === 'observe' ||
    behavior === 'react_to_sound' ||
    (traits.curiosity >= 68 && needs.energy > 45 && behavior === 'walk')
  ) {
    return 'curious';
  }

  // 7. Default calm baseline
  return 'happy_relaxed';
}
