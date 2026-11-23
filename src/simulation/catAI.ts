import { getCatalogItem, ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import {
  CatBehaviorState,
  CatRuntimeState,
  EquipmentStateMap,
  PlacedFurniture,
  RoomStatus,
  Vec2
} from '../types/game';
import { getBondCapabilities } from './bond';
import { getInteractionPointForFurniture, resolveCatCollision } from './collision';
import { evaluateCatEmotion } from './emotions';
import { clamp, computeGrowthMetrics } from './growth';
import { CatVocalCue } from './needs';

export interface AIContext {
  furniture: PlacedFurniture[];
  room: RoomStatus;
  equipment?: EquipmentStateMap;
  playerFocusPoint: Vec2;
  humanPosition?: Vec2;
  humanIsApproaching?: boolean;
  catIsCarried?: boolean;
  activeToyTarget: { type: string; x: number; y: number; z: number } | null;
  soundEventPos: Vec2 | null;
  rng?: () => number;
}

export interface AIStepResult {
  cat: CatRuntimeState;
  roomEvent?:
    | 'knocked_mug'
    | 'consumed_food'
    | 'consumed_feeder_food'
    | 'consumed_water'
    | 'consumed_fountain_water'
    | 'used_auto_litter'
    | 'used_manual_litter';
  vocalCue?: CatVocalCue;
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function lerpAngle(current: number, target: number, alpha: number): number {
  const diff = normalizeAngle(target - current);
  return normalizeAngle(current + diff * clamp(alpha, 0, 1));
}

function findFurnitureByCategory(
  furniture: PlacedFurniture[],
  categories: string[]
): PlacedFurniture | undefined {
  return furniture.find((f) => {
    const item = getCatalogItem(f.catalogId);
    return item ? categories.includes(item.category) : false;
  });
}

function findFurnitureByCatalogId(
  furniture: PlacedFurniture[],
  catalogId: string
): PlacedFurniture | undefined {
  return furniture.find((f) => f.catalogId === catalogId);
}

function randomRoomPoint(rand: () => number, margin = 0.72): Vec2 {
  return {
    x: (rand() * 2 - 1) * (ROOM_HALF_WIDTH - margin),
    z: (rand() * 2 - 1) * (ROOM_HALF_DEPTH - margin)
  };
}

/**
 * Utility-based FSM driven by the 8 continuous personality traits, age stage,
 * internal needs, automatic room equipment, toys, and recent interactions.
 * Playful cats display noticeably richer bursts of energy (zoomies, pouncing,
 * rolling, box ambushes, chasing imaginary targets, and agile furniture jumps).
 */
export function chooseNextBehavior(
  cat: CatRuntimeState,
  ctx: AIContext
): {
  behavior: CatBehaviorState;
  duration: number;
  targetPosition: Vec2 | null;
  targetFurnitureId: string | null;
  vocalCue?: CatVocalCue;
  zoomieWaypoints?: number;
} {
  const rand = ctx.rng ?? Math.random;
  const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
  const bond = getBondCapabilities(cat.bondLevel);
  const tr = cat.traits;
  const isKitten = cat.ageDays < 60;

  // Prefer Smart Cat Bed when placed!
  const smartBed = findFurnitureByCatalogId(ctx.furniture, 'smart_cat_bed');
  const bed = smartBed ?? findFurnitureByCategory(ctx.furniture, ['bed']);
  const box = findFurnitureByCatalogId(ctx.furniture, 'cardboard_box');

  // Guard: never jump straight from sleeping! Always stretch or yawn first.
  if (cat.behavior === 'sleep' && cat.needs.energy > 65) {
    return {
      behavior: rand() < 0.55 ? 'stretch' : 'yawn',
      duration: 3.0,
      targetPosition: null,
      targetFurnitureId: cat.targetFurnitureId,
      vocalCue: 'sleepy_sigh'
    };
  }

  // Post-bite defensive retreat: step back to cardboard box or quiet corner
  if (cat.behavior === 'bite_defend' && metrics.canWalk) {
    return {
      behavior: 'hide',
      duration: 6.5,
      targetPosition: box ? { x: box.x, z: box.z } : randomRoomPoint(rand, 0.8),
      targetFurnitureId: box?.instanceId ?? null,
      vocalCue: 'low_growl'
    };
  }

  // STAGE 1: Newborn kitten (0-14 days) — nested, eyes closed, soft mews when hungry
  if (!metrics.canWalk) {
    const bedPos = bed ? { x: bed.x, z: bed.z } : { x: cat.position.x, z: cat.position.z };
    const r = rand();
    if (cat.needs.hunger < 45 && r < 0.45) {
      return {
        behavior: 'idle',
        duration: 4.0,
        targetPosition: bedPos,
        targetFurnitureId: bed?.instanceId ?? null,
        vocalCue: 'kitten_mew'
      };
    }
    if (cat.needs.energy < 80 || r < 0.65) {
      return {
        behavior: 'sleep',
        duration: 8 + rand() * 7,
        targetPosition: bedPos,
        targetFurnitureId: bed?.instanceId ?? null
      };
    }
    if (r < 0.85) {
      return {
        behavior: 'stretch',
        duration: 3.2,
        targetPosition: null,
        targetFurnitureId: bed?.instanceId ?? null
      };
    }
    return {
      behavior: 'yawn',
      duration: 2.8,
      targetPosition: null,
      targetFurnitureId: bed?.instanceId ?? null,
      vocalCue: 'sleepy_sigh'
    };
  }

  // Weak / unwell survival warning behavior: reduced activity, reduced toy interest, sleeps more
  const isWeakOrUnwell = cat.needs.health < 45 || cat.needs.thirst < 22 || cat.needs.hunger < 22;

  // Active interactive toy tracking (crouch & wiggle before pouncing!)
  if (
    ctx.activeToyTarget &&
    metrics.canUseToys &&
    cat.needs.energy > 18 &&
    cat.needs.stress < 55 &&
    (!isWeakOrUnwell || rand() < 0.22)
  ) {
    const playChance = clamp(
      0.38 + (tr.playfulness / 100) * 0.58 - (tr.fearfulness / 100) * 0.22,
      0.2,
      0.96
    );
    if (rand() < playChance) {
      const dist = Math.hypot(
        ctx.activeToyTarget.x - cat.position.x,
        ctx.activeToyTarget.z - cat.position.z
      );
      if (dist > 0.65 && dist < 1.9 && cat.behavior !== 'pounce_crouch' && rand() < 0.45) {
        return {
          behavior: 'pounce_crouch',
          duration: 1.6,
          targetPosition: { x: ctx.activeToyTarget.x, z: ctx.activeToyTarget.z },
          targetFurnitureId: null,
          vocalCue: 'play_chirp'
        };
      }
      return {
        behavior: 'play',
        duration: 4.2,
        targetPosition: { x: ctx.activeToyTarget.x, z: ctx.activeToyTarget.z },
        targetFurnitureId: null
      };
    }
  }

  // Autonomous Automatic Cat Toy chase!
  const autoToyFurn = findFurnitureByCatalogId(ctx.furniture, 'auto_cat_toy');
  if (
    autoToyFurn &&
    ctx.equipment?.autoCatToy.enabled &&
    metrics.canUseToys &&
    cat.needs.energy > 22 &&
    cat.needs.stress < 50 &&
    rand() < clamp(0.35 + (tr.playfulness / 100) * 0.5, 0.3, 0.88)
  ) {
    const toySpot = getInteractionPointForFurniture(autoToyFurn, cat.position);
    return {
      behavior: rand() < 0.35 ? 'pounce_crouch' : 'play',
      duration: 4.0,
      targetPosition: toySpot,
      targetFurnitureId: autoToyFurn.instanceId,
      vocalCue: 'play_chirp'
    };
  }

  // Startle / react to sudden floor sound
  if (ctx.soundEventPos) {
    if (tr.fearfulness >= 65 && cat.needs.stress > 30) {
      return {
        behavior: 'hide',
        duration: 5.5,
        targetPosition: box ? { x: box.x, z: box.z } : null,
        targetFurnitureId: box?.instanceId ?? null,
        vocalCue: 'distress'
      };
    }
    return {
      behavior: 'react_to_sound',
      duration: 2.6,
      targetPosition: ctx.soundEventPos,
      targetFurnitureId: null
    };
  }

  type Candidate = {
    behavior: CatBehaviorState;
    weight: number;
    duration: number;
    targetPosition: Vec2 | null;
    targetFurnitureId: string | null;
    vocalCue?: CatVocalCue;
    zoomieWaypoints?: number;
  };
  const candidates: Candidate[] = [];

  // 1. Sleep & Yawn when tired, senior, or feeling weak (strongly prefers Smart Cat Bed if available)
  const humanAnchor = ctx.humanPosition ?? ctx.playerFocusPoint;
  const weakSleepBonus = isWeakOrUnwell ? 1.85 : 1.0;
  const seniorSleepBonus = cat.lifeStage === 'senior' ? 1.45 : 1.0;
  const sleepWeight =
    (cat.needs.energy < 30 ? 96 : cat.needs.energy < 55 ? 36 : 10) *
    (1.32 - tr.playfulness / 210) *
    (smartBed ? 1.15 : 1.0) *
    weakSleepBonus *
    seniorSleepBonus;
  const sleepSpot: Vec2 | null =
    smartBed
      ? { x: smartBed.x, z: smartBed.z }
      : bond.sleepsNearby && rand() < 0.42
        ? {
            x: clamp(
              humanAnchor.x + (rand() - 0.5) * 0.65,
              -ROOM_HALF_WIDTH + 0.5,
              ROOM_HALF_WIDTH - 0.5
            ),
            z: clamp(
              humanAnchor.z + (rand() - 0.5) * 0.65,
              -ROOM_HALF_DEPTH + 0.5,
              ROOM_HALF_DEPTH - 0.5
            )
          }
        : bed
          ? { x: bed.x, z: bed.z }
          : null;
  candidates.push({
    behavior: cat.needs.energy < 42 && rand() < 0.25 ? 'yawn' : 'sleep',
    weight: sleepWeight,
    duration: 9 + rand() * 7,
    targetPosition: sleepSpot,
    targetFurnitureId: bed?.instanceId ?? null,
    vocalCue: rand() < 0.25 ? 'sleepy_sigh' : undefined
  });

  // 2. Natural hunger: Automatic Food Feeder OR Ceramic Food Bowl
  const autoFeeder = findFurnitureByCatalogId(ctx.furniture, 'auto_food_feeder');
  const foodBowl = findFurnitureByCatalogId(ctx.furniture, 'food_bowl_ceramic');
  const feederHasFood = (ctx.equipment?.autoFeeder.bowlServingsLevel ?? 0) > 8;
  const bowlHasFood = ctx.room.foodBowlLevel > 10;

  if (cat.needs.hunger < 66) {
    if (autoFeeder && feederHasFood && metrics.canEatWetFood) {
      candidates.push({
        behavior: 'eat',
        weight: cat.needs.hunger < 38 ? 96 : 54,
        duration: 5.0,
        targetPosition: getInteractionPointForFurniture(autoFeeder, cat.position),
        targetFurnitureId: autoFeeder.instanceId,
        vocalCue: 'eat'
      });
    } else if (foodBowl && bowlHasFood && metrics.canEatWetFood) {
      candidates.push({
        behavior: 'eat',
        weight: cat.needs.hunger < 35 ? 92 : 44,
        duration: 5.0,
        targetPosition: getInteractionPointForFurniture(foodBowl, cat.position),
        targetFurnitureId: foodBowl.instanceId,
        vocalCue: 'eat'
      });
    } else if (foodBowl || autoFeeder) {
      const targetFoodSpot = autoFeeder ?? foodBowl!;
      candidates.push({
        behavior: 'explore',
        weight: cat.needs.hunger < 32 ? 82 : 36,
        duration: 4.5,
        targetPosition: getInteractionPointForFurniture(targetFoodSpot, cat.position),
        targetFurnitureId: targetFoodSpot.instanceId,
        vocalCue: isKitten ? 'kitten_mew' : 'attention_meow'
      });
    }
  }

  // 3. Independent water drinking: prefers flowing Cat Water Fountain, falls back to Water Bowl
  const waterFountain = findFurnitureByCatalogId(ctx.furniture, 'auto_water_fountain');
  const waterBowl = findFurnitureByCatalogId(ctx.furniture, 'water_bowl_ceramic');
  const fountainReady =
    waterFountain &&
    (ctx.equipment?.waterFountain.isFlowing ?? false) &&
    (ctx.equipment?.waterFountain.waterLevel ?? 0) > 8;

  if (cat.needs.thirst < 70) {
    if (fountainReady && waterFountain) {
      candidates.push({
        behavior: 'drink',
        weight: cat.needs.thirst < 40 ? 92 : 48,
        duration: 4.5,
        targetPosition: getInteractionPointForFurniture(waterFountain, cat.position),
        targetFurnitureId: waterFountain.instanceId,
        vocalCue: 'drink'
      });
    } else if (waterBowl && ctx.room.waterBowlLevel > 10) {
      candidates.push({
        behavior: 'drink',
        weight: cat.needs.thirst < 36 ? 84 : 34,
        duration: 4.2,
        targetPosition: getInteractionPointForFurniture(waterBowl, cat.position),
        targetFurnitureId: waterBowl.instanceId,
        vocalCue: 'drink'
      });
    } else if (waterBowl || waterFountain) {
      // Survival warning cue: thirsty cat visits empty water bowl & meows softly for water!
      const emptyWaterSpot = waterFountain ?? waterBowl!;
      candidates.push({
        behavior: 'explore',
        weight: cat.needs.thirst < 35 ? 88 : 42,
        duration: 4.5,
        targetPosition: getInteractionPointForFurniture(emptyWaterSpot, cat.position),
        targetFurnitureId: emptyWaterSpot.instanceId,
        vocalCue: cat.needs.thirst < 25 ? 'distress' : 'attention_meow'
      });
    }
  }

  // 4. Autonomous Litter Box visit (enters, uses, exits before automatic cleaning starts!)
  const autoLitter = findFurnitureByCatalogId(ctx.furniture, 'auto_litter_box');
  const manualLitter = findFurnitureByCatalogId(ctx.furniture, 'litter_box_cozy');
  const litterTarget =
    autoLitter && !(ctx.equipment?.autoLitterBox.isCleaning ?? false)
      ? autoLitter
      : manualLitter;
  if (litterTarget && cat.needs.hunger > 45 && rand() < 0.25) {
    candidates.push({
      behavior: 'use_litter',
      weight: cat.needs.hygiene < 75 ? 24 : 10,
      duration: 4.6,
      targetPosition: { x: litterTarget.x, z: litterTarget.z },
      targetFurnitureId: litterTarget.instanceId
    });
  }

  // 5. Explore & sniff furniture (driven by curiosity trait)
  candidates.push({
    behavior: 'explore',
    weight: (12 + tr.curiosity * 0.44) * (cat.needs.energy > 25 ? 1 : 0.25),
    duration: 5.0 + rand() * 3.0,
    targetPosition: randomRoomPoint(rand, 0.68),
    targetFurnitureId: null
  });

  // 6. Walk casually
  candidates.push({
    behavior: 'walk',
    weight: 18 * (cat.needs.energy > 20 ? 1 : 0.3),
    duration: 4.2 + rand() * 3,
    targetPosition: randomRoomPoint(rand, 0.7),
    targetFurnitureId: null
  });

  // 7. REALISTIC PLAYFUL CAT BEHAVIORS (scaled by personality, life-stage activityLevel & health!)
  const playfulBoost =
    (tr.playfulness >= 65 ? 1.55 : tr.playfulness >= 45 ? 1.0 : 0.45) *
    (isWeakOrUnwell ? 0.25 : 1.0);
  const agePlayFactor = metrics.activityLevel;

  if (cat.needs.energy > 38 && cat.needs.stress < 45 && !isWeakOrUnwell) {
    // 7a. Zoomies (sudden burst of multi-waypoint sprinting around the room!)
    if (metrics.canRun && cat.weight.condition !== 'overweight' && cat.weight.condition !== 'obese') {
      candidates.push({
        behavior: 'zoomies',
        weight: (4 + tr.playfulness * 0.52) * playfulBoost * agePlayFactor,
        duration: 5.5 + rand() * 2.5,
        targetPosition: randomRoomPoint(rand, 0.8),
        targetFurnitureId: null,
        vocalCue: 'play_chirp',
        zoomieWaypoints: 3 + Math.floor(rand() * 3)
      });
    }

    // 7b. Chasing an imaginary target ("greebles") with sudden turns
    if (metrics.canRun) {
      candidates.push({
        behavior: 'chase_imaginary',
        weight: (3 + tr.playfulness * 0.42 + tr.curiosity * 0.14) * playfulBoost * agePlayFactor,
        duration: 4.2 + rand() * 2.0,
        targetPosition: randomRoomPoint(rand, 0.75),
        targetFurnitureId: null,
        vocalCue: rand() < 0.45 ? 'play_chirp' : undefined
      });
    }

    // 7c. Playful rolling on the floor
    candidates.push({
      behavior: 'roll_play',
      weight: (4 + tr.playfulness * 0.34 + tr.affection * 0.15) * playfulBoost,
      duration: 3.8 + rand() * 1.8,
      targetPosition: null,
      targetFurnitureId: null,
      vocalCue: rand() < 0.4 ? 'trill_chirp' : undefined
    });

    // 7d. Playing with cardboard box — hiding inside and suddenly ambushing/pouncing out!
    if (box && metrics.canUseToys) {
      candidates.push({
        behavior: 'box_ambush',
        weight: (5 + tr.playfulness * 0.38 + tr.curiosity * 0.2) * playfulBoost,
        duration: 4.8 + rand() * 1.5,
        targetPosition: { x: box.x, z: box.z },
        targetFurnitureId: box.instanceId,
        vocalCue: rand() < 0.4 ? 'play_chirp' : undefined
      });
    }

    // 7e. Wiggling crouch preparing to pounce
    if (metrics.canRun && cat.weight.condition !== 'overweight' && cat.weight.condition !== 'obese') {
      candidates.push({
        behavior: 'pounce_crouch',
        weight: (4 + tr.playfulness * 0.36) * playfulBoost,
        duration: 2.2 + rand() * 1.0,
        targetPosition: randomRoomPoint(rand, 0.8),
        targetFurnitureId: null,
        vocalCue: 'play_chirp'
      });
    }
  }

  // 8. Observe sunlit window
  candidates.push({
    behavior: 'observe',
    weight: 10 + tr.curiosity * 0.3 + tr.independence * 0.16,
    duration: 5.5 + rand() * 3.5,
    targetPosition: { x: 0.9, z: -ROOM_HALF_DEPTH + 0.55 },
    targetFurnitureId: null,
    vocalCue: rand() < 0.2 ? 'trill_chirp' : undefined
  });

  // 9. Groom self
  candidates.push({
    behavior: 'groom',
    weight: (cat.needs.hygiene < 60 ? 30 : 14) + tr.independence * 0.2,
    duration: 4.8 + rand() * 2.5,
    targetPosition: null,
    targetFurnitureId: null
  });

  // 10. Knead plush bed / rug & Affectionate Approach / Head Bunt
  if (tr.affection >= 48 && cat.needs.stress < 35) {
    candidates.push({
      behavior: 'knead',
      weight: 8 + tr.affection * 0.28,
      duration: 4.6,
      targetPosition: bed ? { x: bed.x, z: bed.z } : null,
      targetFurnitureId: bed?.instanceId ?? null,
      vocalCue: 'purr'
    });
  }

  const distToHuman = Math.hypot(
    humanAnchor.x - cat.position.x,
    humanAnchor.z - cat.position.z
  );

  // Human-to-Cat Relationship AI:
  // - Affectionate cat: approaches human, rubs legs (head_bunt), follows human
  // - Playful cat: circles / runs playfully around human
  // - Shy cat: watches cautiously from a distance or hides if approached closely
  // - Defensive cat: shows warning or retreats when stressed & human is near
  const approachWeight =
    tr.affection * 0.3 +
    tr.sociability * 0.26 -
    tr.fearfulness * 0.22 +
    (bond.voluntarilyApproaches ? 14 : 0) +
    (bond.followsPlayer ? 12 : 0) +
    (bond.requestsAffection ? 16 : 0) +
    (ctx.humanIsApproaching && tr.affection >= 55 ? 24 : 0);
  if (approachWeight > 4 && cat.needs.stress < 45) {
    const wantsLegRub = (rand() < 0.42 && (bond.greetsPlayer || tr.affection >= 62));
    candidates.push({
      behavior: wantsLegRub ? 'head_bunt' : 'approach_player',
      weight: approachWeight,
      duration: 4.8,
      targetPosition: {
        x: clamp(humanAnchor.x + (rand() - 0.5) * 0.28, -ROOM_HALF_WIDTH + 0.45, ROOM_HALF_WIDTH - 0.45),
        z: clamp(humanAnchor.z + 0.34, -ROOM_HALF_DEPTH + 0.45, ROOM_HALF_DEPTH - 0.45)
      },
      targetFurnitureId: null,
      vocalCue: rand() < 0.48 ? (isKitten ? 'kitten_mew' : 'happy_meow') : undefined
    });
  }

  // Playful cat runs playfully around the human character
  if (tr.playfulness >= 58 && cat.needs.energy > 35 && cat.needs.stress < 40 && !isWeakOrUnwell && metrics.canRun) {
    const orbitAngle = Math.atan2(cat.position.x - humanAnchor.x, cat.position.z - humanAnchor.z) + (rand() < 0.5 ? 1.3 : -1.3);
    candidates.push({
      behavior: 'run',
      weight: 12 + tr.playfulness * 0.24,
      duration: 3.4,
      targetPosition: {
        x: clamp(humanAnchor.x + Math.sin(orbitAngle) * 0.85, -ROOM_HALF_WIDTH + 0.5, ROOM_HALF_WIDTH - 0.5),
        z: clamp(humanAnchor.z + Math.cos(orbitAngle) * 0.85, -ROOM_HALF_DEPTH + 0.5, ROOM_HALF_DEPTH - 0.5)
      },
      targetFurnitureId: null,
      vocalCue: rand() < 0.35 ? 'play_chirp' : undefined
    });
  }

  // Shy cat watches the human cautiously from a distance or hides if approached too closely
  if (tr.fearfulness >= 55 && tr.trust < 55 && distToHuman < 1.35) {
    const retreatYaw = Math.atan2(cat.position.x - humanAnchor.x, cat.position.z - humanAnchor.z);
    const hideSpot =
      box && ctx.humanIsApproaching
        ? { x: box.x, z: box.z }
        : {
            x: clamp(cat.position.x + Math.sin(retreatYaw) * 0.9, -ROOM_HALF_WIDTH + 0.5, ROOM_HALF_WIDTH - 0.5),
            z: clamp(cat.position.z + Math.cos(retreatYaw) * 0.9, -ROOM_HALF_DEPTH + 0.5, ROOM_HALF_DEPTH - 0.5)
          };
    candidates.push({
      behavior: ctx.humanIsApproaching ? 'hide' : 'observe',
      weight: 22 + tr.fearfulness * 0.45 + (ctx.humanIsApproaching ? 25 : 0),
      duration: 4.5,
      targetPosition: hideSpot,
      targetFurnitureId: box && ctx.humanIsApproaching ? box.instanceId : null
    });
  }

  // Defensive cat warns when overstimulated and human is close
  if (tr.aggression >= 58 && cat.needs.stress >= 42 && distToHuman < 1.15) {
    candidates.push({
      behavior: 'hiss_defend',
      weight: 20 + tr.aggression * 0.35 + cat.needs.stress * 0.3,
      duration: 3.0,
      targetPosition: null,
      targetFurnitureId: null,
      vocalCue: 'hiss'
    });
  }

  // 11. Sit & Stretch (calm cats lean more into relaxed stillness)
  const calmFactor = 1.45 - tr.playfulness / 130;
  candidates.push({
    behavior: 'sit',
    weight: 14 * calmFactor,
    duration: 4.0 + rand() * 3.0,
    targetPosition: null,
    targetFurnitureId: null
  });
  candidates.push({
    behavior: 'stretch',
    weight: 10 * calmFactor,
    duration: 3.0,
    targetPosition: null,
    targetFurnitureId: null
  });

  // 12. Hide in cardboard box (fearful, stressed, or low trust)
  if (box) {
    candidates.push({
      behavior: 'hide',
      weight: tr.fearfulness * 0.44 + cat.needs.stress * 0.58 + (tr.trust < 30 ? 18 : 3),
      duration: 6.0 + rand() * 4,
      targetPosition: { x: box.x, z: box.z },
      targetFurnitureId: box.instanceId
    });
  }

  // 13. Play / Scratching Post
  const scratcher = findFurnitureByCategory(ctx.furniture, ['scratching_post', 'cat_tower']);
  if (metrics.canUseToys && cat.needs.energy > 30) {
    candidates.push({
      behavior: 'play',
      weight: (7 + tr.playfulness * 0.32) * playfulBoost,
      duration: 4.8,
      targetPosition: scratcher
        ? getInteractionPointForFurniture(scratcher, cat.position)
        : randomRoomPoint(rand, 0.72),
      targetFurnitureId: scratcher?.instanceId ?? null
    });
  }

  // 14. Jump onto safe furniture (starts with realistic jump_prep -> jump -> jump_land!)
  if (metrics.canJump && cat.needs.energy > 36 && cat.behavior !== 'sleep') {
    const table = findFurnitureByCategory(ctx.furniture, ['table']);
    const sofa = findFurnitureByCategory(ctx.furniture, ['sofa']);
    const tower = findFurnitureByCategory(ctx.furniture, ['cat_tower']);
    const prefersTable =
      tr.curiosity >= 65 && tr.independence >= 55 && table && !ctx.room.tableMugKnocked;
    const jumpTarget = prefersTable
      ? table
      : tower && rand() < 0.5
        ? tower
        : sofa ?? table;
    if (jumpTarget) {
      candidates.push({
        behavior: 'jump_prep',
        weight: ((prefersTable ? 24 : 14) + tr.curiosity * 0.16 + tr.playfulness * 0.22) * playfulBoost,
        duration: 4.8,
        targetPosition: { x: jumpTarget.x, z: jumpTarget.z },
        targetFurnitureId: jumpTarget.instanceId
      });
    }
  }

  // Strongly down-weight repeating the exact same behavior so cats feel natural & varied
  const adjusted = candidates.map((c) => ({
    ...c,
    weight: c.behavior === cat.behavior && c.behavior !== 'sleep' ? c.weight * 0.18 : c.weight
  }));

  const totalWeight = adjusted.reduce((sum, c) => sum + Math.max(0.1, c.weight), 0);
  let pick = rand() * totalWeight;
  for (const c of adjusted) {
    pick -= Math.max(0.1, c.weight);
    if (pick <= 0) {
      return {
        behavior: c.behavior,
        duration: c.duration,
        targetPosition: c.targetPosition,
        targetFurnitureId: c.targetFurnitureId,
        vocalCue: c.vocalCue,
        zoomieWaypoints: c.zoomieWaypoints
      };
    }
  }

  return {
    behavior: 'idle',
    duration: 4,
    targetPosition: null,
    targetFurnitureId: null
  };
}

/**
 * Steps cat AI, physically smooth locomotion (acceleration, deceleration, turn-rate clamp,
 * furniture obstacle avoidance), multi-phase jump arc (prep -> jump -> land),
 * playful zoomies/ambushes, defensive backing-up, and emotion evaluation.
 */
export function stepCatAI(
  cat: CatRuntimeState,
  ctx: AIContext,
  dtSeconds: number
): AIStepResult {
  const dt = clamp(dtSeconds, 0, 0.1);
  const rand = ctx.rng ?? Math.random;
  const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
  let next: CatRuntimeState = {
    ...cat,
    lifeStage: metrics.stage,
    position: { ...cat.position },
    velocity: { ...cat.velocity },
    behaviorTimer: Math.max(0, cat.behaviorTimer - dt),
    moodRefusalCooldown: Math.max(0, cat.moodRefusalCooldown - dt),
    vocalizationCooldown: Math.max(0, cat.vocalizationCooldown - dt),
    recentTouchDecayTimer: Math.max(0, cat.recentTouchDecayTimer - dt),
    mouthOpenAmount: Math.max(0, cat.mouthOpenAmount - dt * 1.8)
  };

  if (next.recentTouchDecayTimer <= 0 && next.recentTouchCount > 0) {
    next.recentTouchCount = Math.max(0, next.recentTouchCount - 1);
    next.recentTouchDecayTimer = 8;
  }

  // If cat is currently being carried in the human's arms, keep still and cozy!
  if (ctx.catIsCarried) {
    next.velocity = { x: 0, z: 0 };
    next.behavior = 'sit';
    next.isPurring = next.needs.stress < 45;
    next.emotion = evaluateCatEmotion(next);
    return { cat: next };
  }

  let roomEvent: AIStepResult['roomEvent'];
  let vocalCue: CatVocalCue | undefined;

  // Live override: follow active player toy smoothly (unless stressed or exhausted)
  if (
    ctx.activeToyTarget &&
    metrics.canUseToys &&
    next.needs.energy > 16 &&
    next.needs.stress < 55 &&
    next.behavior !== 'hiss_defend' &&
    next.behavior !== 'bite_defend'
  ) {
    if (next.behavior !== 'play' && next.behavior !== 'pounce_crouch') {
      next.behavior = 'play';
      next.behaviorTimer = 3.5;
    }
    next.targetPosition = { x: ctx.activeToyTarget.x, z: ctx.activeToyTarget.z };
    next.targetFurnitureId = null;
  }

  // Complete litter box visit cleanly before exiting so automatic litter box can start cleaning!
  if (next.behavior === 'use_litter' && next.behaviorTimer <= 0.12) {
    const usedFurn = next.targetFurnitureId
      ? ctx.furniture.find((f) => f.instanceId === next.targetFurnitureId)
      : undefined;
    if (usedFurn) {
      roomEvent =
        usedFurn.catalogId === 'auto_litter_box' ? 'used_auto_litter' : 'used_manual_litter';
      // Walk out of litter box immediately after using!
      next.behavior = 'walk';
      next.behaviorTimer = 3.2;
      next.targetPosition = getInteractionPointForFurniture(usedFurn, { x: 0, z: 0 });
      next.targetFurnitureId = null;
    }
  }

  // Transition jump_prep -> jump -> jump_land smoothly
  if (next.behavior === 'jump_prep') {
    const targetPos = next.targetPosition;
    const dist = targetPos
      ? Math.hypot(targetPos.x - next.position.x, targetPos.z - next.position.z)
      : 0;
    if (dist <= 1.05) {
      next.jumpPrepTimer = Math.max(0, next.jumpPrepTimer - dt);
      next.velocity.x *= Math.max(0, 1 - dt * 10);
      next.velocity.z *= Math.max(0, 1 - dt * 10);
      if (targetPos) {
        next.rotationY = lerpAngle(
          next.rotationY,
          Math.atan2(targetPos.x - next.position.x, targetPos.z - next.position.z),
          dt * 7
        );
      }
      if (next.jumpPrepTimer <= 0) {
        const targetItem = next.targetFurnitureId
          ? ctx.furniture.find((f) => f.instanceId === next.targetFurnitureId)
          : undefined;
        const catalog = targetItem ? getCatalogItem(targetItem.catalogId) : undefined;
        next.behavior = 'jump';
        next.behaviorTimer = 2.6;
        next.jumpProgress = 0;
        next.jumpStartY = next.position.y;
        next.jumpTargetY = catalog?.jumpableHeight ?? 0.42;
      }
      next.emotion = evaluateCatEmotion(next);
      return { cat: next, vocalCue };
    }
  }

  if (next.behavior === 'jump_land') {
    next.jumpLandTimer = Math.max(0, next.jumpLandTimer - dt);
    next.velocity.x *= Math.max(0, 1 - dt * 12);
    next.velocity.z *= Math.max(0, 1 - dt * 12);
    if (next.jumpLandTimer <= 0) {
      next.behavior = 'sit';
      next.behaviorTimer = 3.0;
    }
    next.emotion = evaluateCatEmotion(next);
    return { cat: next, vocalCue };
  }

  // Box ambush pop-out! After hiding briefly in box, spring out playfully!
  if (next.behavior === 'box_ambush' && next.behaviorTimer <= 1.2 && next.targetFurnitureId) {
    const ambushSpot = randomRoomPoint(rand, 0.85);
    next.behavior = 'run';
    next.behaviorTimer = 2.4;
    next.targetPosition = ambushSpot;
    next.targetFurnitureId = null;
    if (next.vocalizationCooldown <= 0) {
      vocalCue = 'play_chirp';
      next.vocalizationCooldown = 5.0;
    }
  }

  // Choose next state when timer expires
  if (next.behaviorTimer <= 0) {
    const decision = chooseNextBehavior(next, ctx);
    next.behavior = decision.behavior;
    next.behaviorTimer = decision.duration;
    next.targetPosition = decision.targetPosition;
    next.targetFurnitureId = decision.targetFurnitureId;
    next.zoomieWaypointsRemaining = decision.zoomieWaypoints ?? 0;
    next.isPurring =
      (decision.behavior === 'sleep' || decision.behavior === 'knead') &&
      next.traits.trust >= 35;

    if (decision.behavior === 'jump_prep') {
      next.jumpPrepTimer = 0.65;
    }

    if (decision.vocalCue && next.vocalizationCooldown <= 0) {
      vocalCue = decision.vocalCue;
      next.vocalizationCooldown = 6.0 + rand() * 5.0;
      next.mouthOpenAmount = decision.vocalCue === 'sleepy_sigh' ? 0.65 : 0.48;
    }

    if (decision.behavior === 'jump' && metrics.canJump) {
      const targetItem = decision.targetFurnitureId
        ? ctx.furniture.find((f) => f.instanceId === decision.targetFurnitureId)
        : undefined;
      const catalog = targetItem ? getCatalogItem(targetItem.catalogId) : undefined;
      next.jumpProgress = 0;
      next.jumpStartY = next.position.y;
      next.jumpTargetY = catalog?.jumpableHeight ?? 0.42;
    }
  }

  // Mouth sync for expressive states
  if (next.behavior === 'yawn') {
    next.mouthOpenAmount = Math.max(next.mouthOpenAmount, 0.72);
  } else if (next.behavior === 'hiss_defend') {
    next.mouthOpenAmount = Math.max(next.mouthOpenAmount, 0.86);
  } else if (next.behavior === 'bite_defend') {
    next.mouthOpenAmount = Math.max(next.mouthOpenAmount, 1.0);
  }

  // Defensive backing away step when hissing (realistic feline posture retreat)
  if (next.behavior === 'hiss_defend' && metrics.canWalk && next.behaviorTimer > 2.5) {
    const backX = -Math.sin(next.rotationY) * 0.24;
    const backZ = -Math.cos(next.rotationY) * 0.24;
    const resolved = resolveCatCollision(
      { x: next.position.x + backX * dt, z: next.position.z + backZ * dt },
      0.16 * metrics.bodyScale + 0.08,
      ctx.furniture,
      null
    );
    next.position.x = resolved.x;
    next.position.z = resolved.z;
    next.velocity = { x: backX * 0.4, z: backZ * 0.4 };
  }

  // Surface elevation (bed cushion, smart bed, box interior, rug, or floor)
  const perchedFurniture = next.targetFurnitureId
    ? ctx.furniture.find((f) => f.instanceId === next.targetFurnitureId)
    : undefined;
  const perchedCatalog = perchedFurniture ? getCatalogItem(perchedFurniture.catalogId) : undefined;
  const shouldBeElevated =
    (next.behavior === 'jump' || next.behavior === 'jump_land') &&
    perchedCatalog?.jumpableHeight !== undefined;

  let surfaceY = 0;
  for (const f of ctx.furniture) {
    const item = getCatalogItem(f.catalogId);
    if (!item) continue;
    const dist = Math.hypot(next.position.x - f.x, next.position.z - f.z);
    if (f.catalogId === 'smart_cat_bed' && dist < 0.38) {
      surfaceY = Math.max(surfaceY, 0.13);
    } else if (item.category === 'bed' && dist < 0.34) {
      surfaceY = Math.max(surfaceY, 0.095);
    } else if (f.catalogId === 'cardboard_box' && dist < 0.25) {
      surfaceY = Math.max(surfaceY, 0.025);
    } else if (item.category === 'litter_box' && dist < 0.32 && next.behavior === 'use_litter') {
      surfaceY = Math.max(surfaceY, 0.07);
    } else if (item.category === 'carpet' && dist < Math.max(item.width, item.depth) * 0.48) {
      surfaceY = Math.max(surfaceY, 0.016);
    }
  }

  if (!shouldBeElevated) {
    next.position.y += (surfaceY - next.position.y) * Math.min(1, dt * 8);
  }

  const isMovingState =
    next.targetPosition !== null &&
    [
      'walk',
      'run',
      'zoomies',
      'chase_imaginary',
      'explore',
      'play',
      'approach_player',
      'head_bunt',
      'knead',
      'eat',
      'drink',
      'use_litter',
      'sleep',
      'hide',
      'box_ambush',
      'observe',
      'jump_prep',
      'jump'
    ].includes(next.behavior);

  const weightSpeedFactor =
    next.weight.condition === 'obese'
      ? 0.64
      : next.weight.condition === 'overweight'
        ? 0.78
        : next.weight.condition === 'underweight'
          ? 0.84
          : next.weight.condition === 'lean'
            ? 1.08
            : 1.0;
  const healthSpeedFactor = next.needs.health < 45 ? 0.72 : 1.0;

  if (isMovingState && next.targetPosition) {
    const dx = next.targetPosition.x - next.position.x;
    const dz = next.targetPosition.z - next.position.z;
    const dist = Math.hypot(dx, dz);

    if (!metrics.canWalk) {
      if (dist > 0.05) {
        const crawlSpeed = 0.08;
        next.position.x += (dx / dist) * Math.min(dist, crawlSpeed * dt);
        next.position.z += (dz / dist) * Math.min(dist, crawlSpeed * dt);
        next.rotationY = lerpAngle(next.rotationY, Math.atan2(dx, dz), dt * 2.5);
      }
      next.velocity = { x: 0, z: 0 };
      next.emotion = evaluateCatEmotion(next);
      return { cat: next, vocalCue };
    }

    // Parabolic Jump Arc -> smooth Landing recovery
    if (next.behavior === 'jump' && metrics.canJump) {
      next.jumpProgress = clamp(next.jumpProgress + dt * 1.75, 0, 1);
      const t = next.jumpProgress;
      const moveFactor = Math.min(1, dt * 3.8);
      next.position.x += dx * moveFactor;
      next.position.z += dz * moveFactor;
      const arc = Math.sin(t * Math.PI) * 0.36;
      next.position.y = next.jumpStartY + (next.jumpTargetY - next.jumpStartY) * t + arc;
      next.rotationY = lerpAngle(next.rotationY, Math.atan2(dx, dz), dt * 6);

      if (
        t >= 0.92 &&
        perchedCatalog?.category === 'table' &&
        !ctx.room.tableMugKnocked &&
        (next.traits.curiosity >= 60 || next.traits.playfulness >= 65)
      ) {
        roomEvent = 'knocked_mug';
      }

      if (t >= 1) {
        next.behavior = 'jump_land';
        next.jumpLandTimer = 0.45;
        next.position.y = next.jumpTargetY;
      }

      next.velocity = { x: 0, z: 0 };
      next.emotion = evaluateCatEmotion(next);
      return { cat: next, roomEvent, vocalCue };
    }

    const arrivalRadius =
      next.behavior === 'play' || next.behavior === 'zoomies' || next.behavior === 'chase_imaginary'
        ? 0.28
        : 0.14;

    if (dist > arrivalRadius) {
      let speedFactor = 0.55;
      if (next.behavior === 'zoomies') speedFactor = 1.22;
      else if (next.behavior === 'run' || next.behavior === 'chase_imaginary') speedFactor = 1.02;
      else if (next.behavior === 'play') speedFactor = metrics.canRun ? 0.92 : 0.72;
      else if (next.behavior === 'approach_player' || next.behavior === 'head_bunt')
        speedFactor = 0.62;
      else if (next.behavior === 'explore') speedFactor = 0.5;

      // Smooth deceleration as cat approaches its arrival radius (no sliding!)
      const brakingFactor = clamp(dist / 0.55, 0.28, 1.0);
      const targetSpeed =
        metrics.maxMoveSpeed * speedFactor * weightSpeedFactor * healthSpeedFactor * brakingFactor;
      const desiredVx = (dx / dist) * targetSpeed;
      const desiredVz = (dz / dist) * targetSpeed;

      // Realistic acceleration/deceleration curve
      const accelRate = next.behavior === 'zoomies' ? 7.5 : 5.2;
      next.velocity.x += (desiredVx - next.velocity.x) * clamp(accelRate * dt, 0, 1);
      next.velocity.z += (desiredVz - next.velocity.z) * clamp(accelRate * dt, 0, 1);

      const candidatePos = {
        x: next.position.x + next.velocity.x * dt,
        z: next.position.z + next.velocity.z * dt
      };

      const catRadius = 0.16 * metrics.bodyScale + 0.08;
      const resolved = resolveCatCollision(
        candidatePos,
        catRadius,
        ctx.furniture,
        next.targetFurnitureId
      );

      // If blocked by furniture while zooming/running, pick a fresh unobstructed waypoint smoothly
      const movedDist = Math.hypot(resolved.x - next.position.x, resolved.z - next.position.z);
      if (
        (next.behavior === 'zoomies' || next.behavior === 'chase_imaginary') &&
        movedDist < 0.002 &&
        dt > 0.01
      ) {
        next.targetPosition = randomRoomPoint(rand, 0.78);
      }

      next.position.x = resolved.x;
      next.position.z = resolved.z;

      const speed = Math.hypot(next.velocity.x, next.velocity.z);
      if (speed > 0.04) {
        const targetYaw = Math.atan2(next.velocity.x, next.velocity.z);
        // Clamp turning angular velocity so the cat never randomly spins in place
        const maxTurnStep = (next.behavior === 'zoomies' ? 7.5 : 5.2) * dt;
        const diff = normalizeAngle(targetYaw - next.rotationY);
        next.rotationY = normalizeAngle(
          next.rotationY + clamp(diff, -maxTurnStep, maxTurnStep)
        );
      }
    } else {
      // Arrived at waypoint: smooth stop OR chain next playful waypoint!
      if (next.behavior === 'zoomies' && next.zoomieWaypointsRemaining > 0) {
        next.zoomieWaypointsRemaining -= 1;
        next.targetPosition = randomRoomPoint(rand, 0.78);
      } else if (next.behavior === 'chase_imaginary' && next.behaviorTimer > 1.2) {
        // Sudden playful change of direction chasing an imaginary target!
        next.targetPosition = randomRoomPoint(rand, 0.78);
      } else {
        next.velocity.x *= Math.max(0, 1 - dt * 11);
        next.velocity.z *= Math.max(0, 1 - dt * 11);
        if (Math.hypot(next.velocity.x, next.velocity.z) < 0.01) {
          next.velocity.x = 0;
          next.velocity.z = 0;
        }
      }

      const targetItem = next.targetFurnitureId
        ? ctx.furniture.find((f) => f.instanceId === next.targetFurnitureId)
        : undefined;

      if (next.behavior === 'eat') {
        if (
          targetItem?.catalogId === 'auto_food_feeder' &&
          (ctx.equipment?.autoFeeder.bowlServingsLevel ?? 0) > 0
        ) {
          roomEvent = 'consumed_feeder_food';
        } else if (ctx.room.foodBowlLevel > 0) {
          roomEvent = 'consumed_food';
        }
      } else if (next.behavior === 'drink') {
        if (
          targetItem?.catalogId === 'auto_water_fountain' &&
          (ctx.equipment?.waterFountain.waterLevel ?? 0) > 0
        ) {
          roomEvent = 'consumed_fountain_water';
        } else if (ctx.room.waterBowlLevel > 0) {
          roomEvent = 'consumed_water';
        }
      } else if (next.behavior === 'observe') {
        next.rotationY = lerpAngle(next.rotationY, Math.PI, dt * 4);
      } else if (next.behavior === 'approach_player' || next.behavior === 'head_bunt') {
        const facePt = ctx.humanPosition ?? ctx.playerFocusPoint;
        const pdx = facePt.x - next.position.x;
        const pdz = facePt.z - next.position.z;
        if (Math.hypot(pdx, pdz) > 0.05) {
          next.rotationY = lerpAngle(next.rotationY, Math.atan2(pdx, pdz), dt * 4);
        }
      }
    }
  } else if (next.behavior !== 'hiss_defend') {
    next.velocity.x *= Math.max(0, 1 - dt * 10);
    next.velocity.z *= Math.max(0, 1 - dt * 10);
    if (Math.hypot(next.velocity.x, next.velocity.z) < 0.01) {
      next.velocity.x = 0;
      next.velocity.z = 0;
    }

    if (
      (next.behavior === 'react_to_sound' || next.behavior === 'pounce_crouch') &&
      next.targetPosition
    ) {
      const sdx = next.targetPosition.x - next.position.x;
      const sdz = next.targetPosition.z - next.position.z;
      next.rotationY = lerpAngle(next.rotationY, Math.atan2(sdx, sdz), dt * 7);
    }
  }

  next.emotion = evaluateCatEmotion(next);
  return { cat: next, roomEvent, vocalCue };
}
