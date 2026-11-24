import {
  ActiveCareAction,
  CatRuntimeState,
  HumanGender,
  HumanRuntimeState
} from '../types/game';

export type CatSpriteAction =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'land'
  | 'turn'
  | 'sit'
  | 'lie_down'
  | 'sleep'
  | 'happy'
  | 'affectionate'
  | 'curious'
  | 'fearful'
  | 'defensive'
  | 'hiss'
  | 'growl'
  | 'bite'
  | 'pounce'
  | 'eat'
  | 'drink'
  | 'groom'
  | 'pet_accept'
  | 'brush_react'
  | 'picked_up'
  | 'carried'
  | 'litter'
  | 'zoomies'
  | 'chase_toy'
  | 'knead'
  | 'stretch'
  | 'yawn'
  | 'head_rub'
  | 'tail_swish';

export type HumanSpriteAction =
  | 'idle'
  | 'walk'
  | 'run'
  | 'turn'
  | 'sit'
  | 'kneel'
  | 'bend'
  | 'pet_cat'
  | 'brush_cat'
  | 'pour_food'
  | 'refill_water'
  | 'hold_cat'
  | 'put_cat_down'
  | 'play_toy'
  | 'clean_litter'
  | 'use_equipment'
  | 'react_bite';

export interface SpriteAnimDef {
  frameCount: number;
  fps: number;
  loop: boolean;
  priority: 'boot' | 'lazy';
}

export const CAT_SPRITE_ACTIONS: Record<CatSpriteAction, SpriteAnimDef> = {
  idle: { frameCount: 8, fps: 7, loop: true, priority: 'boot' },
  walk: { frameCount: 8, fps: 10, loop: true, priority: 'boot' },
  run: { frameCount: 10, fps: 14, loop: true, priority: 'lazy' },
  jump: { frameCount: 10, fps: 12, loop: false, priority: 'lazy' },
  land: { frameCount: 6, fps: 12, loop: false, priority: 'lazy' },
  turn: { frameCount: 6, fps: 12, loop: false, priority: 'lazy' },
  sit: { frameCount: 6, fps: 8, loop: false, priority: 'boot' },
  lie_down: { frameCount: 8, fps: 8, loop: false, priority: 'lazy' },
  sleep: { frameCount: 8, fps: 5, loop: true, priority: 'boot' },
  happy: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  affectionate: { frameCount: 8, fps: 8, loop: true, priority: 'lazy' },
  curious: { frameCount: 8, fps: 8, loop: true, priority: 'lazy' },
  fearful: { frameCount: 8, fps: 10, loop: true, priority: 'lazy' },
  defensive: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  hiss: { frameCount: 8, fps: 10, loop: false, priority: 'lazy' },
  growl: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  bite: { frameCount: 8, fps: 13, loop: false, priority: 'lazy' },
  pounce: { frameCount: 10, fps: 12, loop: false, priority: 'lazy' },
  eat: { frameCount: 10, fps: 10, loop: true, priority: 'lazy' },
  drink: { frameCount: 10, fps: 11, loop: true, priority: 'lazy' },
  groom: { frameCount: 10, fps: 9, loop: true, priority: 'lazy' },
  pet_accept: { frameCount: 8, fps: 8, loop: true, priority: 'boot' },
  brush_react: { frameCount: 8, fps: 8, loop: true, priority: 'lazy' },
  picked_up: { frameCount: 10, fps: 10, loop: false, priority: 'lazy' },
  carried: { frameCount: 8, fps: 7, loop: true, priority: 'lazy' },
  litter: { frameCount: 8, fps: 8, loop: true, priority: 'lazy' },
  zoomies: { frameCount: 12, fps: 16, loop: true, priority: 'lazy' },
  chase_toy: { frameCount: 10, fps: 13, loop: true, priority: 'lazy' },
  knead: { frameCount: 10, fps: 9, loop: true, priority: 'lazy' },
  stretch: { frameCount: 8, fps: 7, loop: false, priority: 'lazy' },
  yawn: { frameCount: 8, fps: 7, loop: false, priority: 'lazy' },
  head_rub: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  tail_swish: { frameCount: 8, fps: 10, loop: true, priority: 'lazy' }
};

export const HUMAN_SPRITE_ACTIONS: Record<HumanSpriteAction, SpriteAnimDef> = {
  idle: { frameCount: 8, fps: 7, loop: true, priority: 'boot' },
  walk: { frameCount: 8, fps: 11, loop: true, priority: 'boot' },
  run: { frameCount: 8, fps: 14, loop: true, priority: 'lazy' },
  turn: { frameCount: 6, fps: 12, loop: false, priority: 'lazy' },
  sit: { frameCount: 6, fps: 8, loop: false, priority: 'lazy' },
  kneel: { frameCount: 8, fps: 10, loop: false, priority: 'lazy' },
  bend: { frameCount: 8, fps: 10, loop: false, priority: 'lazy' },
  pet_cat: { frameCount: 8, fps: 9, loop: true, priority: 'boot' },
  brush_cat: { frameCount: 8, fps: 10, loop: true, priority: 'lazy' },
  pour_food: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  refill_water: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  hold_cat: { frameCount: 8, fps: 8, loop: true, priority: 'lazy' },
  put_cat_down: { frameCount: 8, fps: 10, loop: false, priority: 'lazy' },
  play_toy: { frameCount: 8, fps: 11, loop: true, priority: 'lazy' },
  clean_litter: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  use_equipment: { frameCount: 8, fps: 9, loop: true, priority: 'lazy' },
  react_bite: { frameCount: 8, fps: 12, loop: false, priority: 'lazy' }
};

export const PROP_ATLAS_MAP: Record<string, { atlas: 'props_care' | 'props_living' | 'props_equipment'; frame: string }> = {
  bed_plush: { atlas: 'props_care', frame: 'bed_plush' },
  bed_woven: { atlas: 'props_care', frame: 'bed_woven' },
  food_bowl_ceramic: { atlas: 'props_care', frame: 'food_bowl_empty' },
  food_bowl_full: { atlas: 'props_care', frame: 'food_bowl_full' },
  water_bowl_ceramic: { atlas: 'props_care', frame: 'water_bowl_ceramic' },
  litter_box_cozy: { atlas: 'props_care', frame: 'litter_box_cozy' },
  scratching_post_sisal: { atlas: 'props_care', frame: 'scratching_post_sisal' },
  cardboard_box: { atlas: 'props_care', frame: 'cardboard_box' },
  sofa_linen: { atlas: 'props_living', frame: 'sofa_linen' },
  table_oak: { atlas: 'props_living', frame: 'table_oak' },
  cat_tower_oak: { atlas: 'props_living', frame: 'cat_tower_oak' },
  floor_lamp_warm: { atlas: 'props_living', frame: 'floor_lamp_warm' },
  rug_linen: { atlas: 'props_living', frame: 'rug_linen' },
  rug_terracotta: { atlas: 'props_living', frame: 'rug_terracotta' },
  toy_ball: { atlas: 'props_living', frame: 'toy_ball' },
  toy_mouse: { atlas: 'props_living', frame: 'toy_mouse' },
  auto_water_fountain: { atlas: 'props_equipment', frame: 'auto_water_fountain' },
  auto_food_feeder: { atlas: 'props_equipment', frame: 'auto_food_feeder' },
  auto_litter_box: { atlas: 'props_equipment', frame: 'auto_litter_box' },
  smart_cat_bed: { atlas: 'props_equipment', frame: 'smart_cat_bed' },
  auto_cat_toy: { atlas: 'props_equipment', frame: 'auto_cat_toy' },
  toy_feather_wand: { atlas: 'props_equipment', frame: 'toy_feather_wand' }
};

export function getCatAtlasKey(action: CatSpriteAction): string {
  return `cat_${action}`;
}

export function getHumanAtlasKey(gender: HumanGender, action: HumanSpriteAction): string {
  return `human_${gender}_${action}`;
}

/**
 * Deterministic animation state machine mapping headless simulation CatRuntimeState,
 * HumanRuntimeState & ActiveCareAction into the exact 2D sprite animation key!
 */
export function resolveCatSpriteAction(
  cat: CatRuntimeState,
  human: HumanRuntimeState,
  activeAction: ActiveCareAction | null
): CatSpriteAction {
  // 1. Synchronized pickup & carry poses take priority
  if (human.carryingCat) {
    if (human.animState === 'pickup_cat') return 'picked_up';
    return 'carried';
  }

  // 2. Active synchronized human-to-cat care reactions
  if (activeAction && (activeAction.phase === 'performing' || activeAction.phase === 'finishing')) {
    if (activeAction.bitten) return 'bite';
    if (activeAction.type === 'pet') {
      if (cat.emotion === 'defensive_angry') return 'hiss';
      if (cat.emotion === 'fearful') return 'fearful';
      return 'pet_accept';
    }
    if (activeAction.type === 'brush') {
      if (cat.emotion === 'defensive_angry') return 'defensive';
      return 'brush_react';
    }
    if (activeAction.type === 'pickup' && activeAction.phase === 'performing') {
      return 'picked_up';
    }
    if (activeAction.type === 'play_toy') {
      return 'chase_toy';
    }
  }

  // 3. Direct behavior-to-animation mapping
  switch (cat.behavior) {
    case 'walk':
    case 'approach_player':
    case 'explore':
      return 'walk';
    case 'run':
      return 'run';
    case 'zoomies':
      return 'zoomies';
    case 'jump_prep':
    case 'pounce_crouch':
      return 'pounce';
    case 'jump':
      return 'jump';
    case 'jump_land':
      return 'land';
    case 'sit':
      return 'sit';
    case 'sleep':
      return 'sleep';
    case 'eat':
      return 'eat';
    case 'drink':
      return 'drink';
    case 'groom':
      return 'groom';
    case 'use_litter':
      return 'litter';
    case 'stretch':
      return 'stretch';
    case 'yawn':
      return 'yawn';
    case 'knead':
      return 'knead';
    case 'head_bunt':
      return 'head_rub';
    case 'hiss_defend':
      return 'hiss';
    case 'bite_defend':
      return 'bite';
    case 'play':
    case 'chase_imaginary':
    case 'box_ambush':
      return 'chase_toy';
    case 'roll_play':
      return 'happy';
    case 'hide':
      return 'fearful';
    case 'observe':
    case 'react_to_sound':
      return 'curious';
    case 'idle':
    default: {
      if (cat.emotion === 'defensive_angry') return 'defensive';
      if (cat.emotion === 'fearful') return 'fearful';
      if (cat.emotion === 'affectionate') return 'affectionate';
      if (cat.emotion === 'playful') return 'tail_swish';
      if (cat.emotion === 'curious') return 'curious';
      if (cat.emotion === 'sleepy') return 'lie_down';
      if (cat.isPurring) return 'happy';
      return 'idle';
    }
  }
}

/**
 * Deterministic animation state machine mapping headless HumanRuntimeState & ActiveCareAction
 * into the exact 2D Chibi Human sprite animation key!
 */
export function resolveHumanSpriteAction(
  human: HumanRuntimeState,
  activeAction: ActiveCareAction | null
): HumanSpriteAction {
  const speed = Math.hypot(human.velocity.x, human.velocity.z);
  switch (human.animState) {
    case 'walk':
      return speed > 1.85 ? 'run' : 'walk';
    case 'turn':
      return 'turn';
    case 'kneel_pet':
      return 'pet_cat';
    case 'brush':
      return 'brush_cat';
    case 'pour_food':
    case 'bottle_feed':
      return 'pour_food';
    case 'pour_water':
      return 'refill_water';
    case 'pickup_cat':
      return 'bend';
    case 'carry_cat':
      return 'hold_cat';
    case 'putdown_cat':
      return 'put_cat_down';
    case 'play_toy':
      return 'play_toy';
    case 'clean_litter':
      return 'clean_litter';
    case 'clean_room':
      return 'bend';
    case 'tuck_sleep':
      return 'kneel';
    case 'flinch':
      return 'react_bite';
    case 'step_back':
      return 'walk';
    case 'idle':
    default:
      if (
        activeAction &&
        activeAction.phase === 'performing' &&
        (activeAction.type === 'refill_fountain' ||
          activeAction.type === 'clean_fountain' ||
          activeAction.type === 'empty_auto_litter')
      ) {
        return 'use_equipment';
      }
      return 'idle';
  }
}
