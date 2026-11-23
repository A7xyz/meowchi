import { getCatalogItem, ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import {
  CatBehaviorState,
  CatRuntimeState,
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
  playerFocusPoint: Vec2;
  activeToyTarget: { type: string; x: number; y: number; z: number } | null;
  soundEventPos: Vec2 | null;
  rng?: () => number;
}

export interface AIStepResult {
  cat: CatRuntimeState;
  roomEvent?: 'knocked_mug' | 'consumed_food' | 'consumed_water';
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

/**
 * Utility-based FSM driven by the 8 continuous personality traits, internal
 * hunger/hydration/energy/stress cues (no UI hunger bar!), emotion, and bond.
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
} {
  const rand = ctx.rng ?? Math.random;
  const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
  const bond = getBondCapabilities(cat.bondLevel);
  const tr = cat.traits;
  const bed = findFurnitureByCategory(ctx.furniture, ['bed']);
  const isKitten = cat.ageDays < 60;

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

  // Active interactive toy tracking (crouch & wiggle before pouncing!)
  if (ctx.activeToyTarget && metrics.canUseToys && cat.needs.energy > 18 && cat.needs.stress < 55) {
    const playChance = clamp(0.35 + (tr.playfulness / 100) * 0.6 - (tr.fearfulness / 100) * 0.25, 0.2, 0.96);
    if (rand() < playChance) {
      const dist = Math.hypot(
        ctx.activeToyTarget.x - cat.position.x,
        ctx.activeToyTarget.z - cat.position.z
      );
      if (dist > 0.7 && dist < 1.8 && cat.behavior !== 'pounce_crouch' && rand() < 0.4) {
        return {
          behavior: 'pounce_crouch',
          duration: 1.8,
          targetPosition: { x: ctx.activeToyTarget.x, z: ctx.activeToyTarget.z },
          targetFurnitureId: null,
          vocalCue: 'play_chirp'
        };
      }
      return {
        behavior: 'play',
        duration: 4.5,
        targetPosition: { x: ctx.activeToyTarget.x, z: ctx.activeToyTarget.z },
        targetFurnitureId: null
      };
    }
  }

  // Startle / react to sudden floor sound
  if (ctx.soundEventPos) {
    if (tr.fearfulness >= 65 && cat.needs.stress > 30) {
      const box = findFurnitureByCatalogId(ctx.furniture, 'cardboard_box');
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
  };
  const candidates: Candidate[] = [];

  // 1. Sleep & Yawn when tired
  const sleepWeight =
    (cat.needs.energy < 30 ? 96 : cat.needs.energy < 55 ? 36 : 10) *
    (1.35 - tr.playfulness / 200);
  const sleepSpot: Vec2 | null =
    bond.sleepsNearby && rand() < 0.42
      ? {
          x: clamp(ctx.playerFocusPoint.x + (rand() - 0.5) * 0.6, -ROOM_HALF_WIDTH + 0.5, ROOM_HALF_WIDTH - 0.5),
          z: clamp(ctx.playerFocusPoint.z + (rand() - 0.5) * 0.6, -ROOM_HALF_DEPTH + 0.5, ROOM_HALF_DEPTH - 0.5)
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

  // 2. Natural hunger communication (approach food bowl, sniff, meow for attention if empty, eat if filled)
  const foodBowl = findFurnitureByCategory(ctx.furniture, ['food_bowl']);
  if (foodBowl && cat.needs.hunger < 62) {
    const bowlPt = getInteractionPointForFurniture(foodBowl, cat.position);
    if (ctx.room.foodBowlLevel > 10 && metrics.canEatWetFood) {
      candidates.push({
        behavior: 'eat',
        weight: cat.needs.hunger < 35 ? 92 : 44,
        duration: 5.0,
        targetPosition: bowlPt,
        targetFurnitureId: foodBowl.instanceId,
        vocalCue: 'eat'
      });
    } else {
      // Natural behavioral cue when hungry & bowl is empty: walks to bowl, sniffs & softly meows!
      candidates.push({
        behavior: 'explore',
        weight: cat.needs.hunger < 32 ? 82 : 38,
        duration: 4.8,
        targetPosition: bowlPt,
        targetFurnitureId: foodBowl.instanceId,
        vocalCue: isKitten ? 'kitten_mew' : 'soft_meow'
      });
    }
  }

  // 3. Independent water drinking when thirsty
  const waterBowl = findFurnitureByCategory(ctx.furniture, ['water_bowl']);
  if (waterBowl && ctx.room.waterBowlLevel > 10 && cat.needs.thirst < 66) {
    candidates.push({
      behavior: 'drink',
      weight: cat.needs.thirst < 36 ? 84 : 34,
      duration: 4.2,
      targetPosition: getInteractionPointForFurniture(waterBowl, cat.position),
      targetFurnitureId: waterBowl.instanceId,
      vocalCue: 'drink'
    });
  }

  // 4. Explore & sniff furniture (driven by curiosity trait)
  const randomSpot: Vec2 = {
    x: (rand() * 2 - 1) * (ROOM_HALF_WIDTH - 0.65),
    z: (rand() * 2 - 1) * (ROOM_HALF_DEPTH - 0.65)
  };
  candidates.push({
    behavior: 'explore',
    weight: (12 + tr.curiosity * 0.45) * (cat.needs.energy > 25 ? 1 : 0.25),
    duration: 5.2 + rand() * 3.2,
    targetPosition: randomSpot,
    targetFurnitureId: null
  });

  // 5. Walk casually
  candidates.push({
    behavior: 'walk',
    weight: 20 * (cat.needs.energy > 20 ? 1 : 0.3),
    duration: 4.5 + rand() * 3,
    targetPosition: {
      x: (rand() * 2 - 1) * (ROOM_HALF_WIDTH - 0.7),
      z: (rand() * 2 - 1) * (ROOM_HALF_DEPTH - 0.7)
    },
    targetFurnitureId: null
  });

  // 6. Run / zoomies & playful pounce crouch (stage 3+ & playfulness trait)
  if (metrics.canRun && cat.needs.energy > 45 && cat.weight.condition !== 'overweight') {
    candidates.push({
      behavior: rand() < 0.35 ? 'pounce_crouch' : 'run',
      weight: 6 + tr.playfulness * 0.38,
      duration: 3.0 + rand() * 2,
      targetPosition: {
        x: (rand() * 2 - 1) * (ROOM_HALF_WIDTH - 0.75),
        z: (rand() * 2 - 1) * (ROOM_HALF_DEPTH - 0.75)
      },
      targetFurnitureId: null,
      vocalCue: rand() < 0.35 ? 'play_chirp' : undefined
    });
  }

  // 7. Observe sunlit window
  candidates.push({
    behavior: 'observe',
    weight: 10 + tr.curiosity * 0.3 + tr.independence * 0.16,
    duration: 5.5 + rand() * 3.5,
    targetPosition: { x: 0.9, z: -ROOM_HALF_DEPTH + 0.55 },
    targetFurnitureId: null,
    vocalCue: rand() < 0.2 ? 'trill_chirp' : undefined
  });

  // 8. Groom self
  candidates.push({
    behavior: 'groom',
    weight: (cat.needs.hygiene < 60 ? 30 : 14) + tr.independence * 0.2,
    duration: 4.8 + rand() * 2.5,
    targetPosition: null,
    targetFurnitureId: null
  });

  // 9. Knead plush bed / rug & Affectionate Approach / Head Bunt
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

  const approachWeight =
    tr.affection * 0.28 +
    tr.sociability * 0.24 -
    tr.fearfulness * 0.2 +
    (bond.voluntarilyApproaches ? 14 : 0) +
    (bond.followsPlayer ? 12 : 0) +
    (bond.requestsAffection ? 16 : 0);
  if (approachWeight > 4 && cat.needs.stress < 45) {
    candidates.push({
      behavior: rand() < 0.35 && bond.greetsPlayer ? 'head_bunt' : 'approach_player',
      weight: approachWeight,
      duration: 4.8,
      targetPosition: {
        x: clamp(ctx.playerFocusPoint.x, -ROOM_HALF_WIDTH + 0.5, ROOM_HALF_WIDTH - 0.5),
        z: clamp(ctx.playerFocusPoint.z + 0.35, -ROOM_HALF_DEPTH + 0.5, ROOM_HALF_DEPTH - 0.5)
      },
      targetFurnitureId: null,
      vocalCue: rand() < 0.45 ? (isKitten ? 'kitten_mew' : 'greeting_meow') : undefined
    });
  }

  // 10. Sit & Stretch
  candidates.push({
    behavior: 'sit',
    weight: 16,
    duration: 4.0 + rand() * 3.0,
    targetPosition: null,
    targetFurnitureId: null
  });
  candidates.push({
    behavior: 'stretch',
    weight: 11,
    duration: 3.0,
    targetPosition: null,
    targetFurnitureId: null
  });

  // 11. Hide in cardboard box (fearful, stressed, or low trust)
  const box = findFurnitureByCatalogId(ctx.furniture, 'cardboard_box');
  if (box) {
    candidates.push({
      behavior: 'hide',
      weight: tr.fearfulness * 0.42 + cat.needs.stress * 0.55 + (tr.trust < 30 ? 18 : 4),
      duration: 6.0 + rand() * 4,
      targetPosition: { x: box.x, z: box.z },
      targetFurnitureId: box.instanceId
    });
  }

  // 12. Play / Scratching Post
  const scratcher = findFurnitureByCategory(ctx.furniture, ['scratching_post', 'cat_tower']);
  if (metrics.canUseToys && cat.needs.energy > 30) {
    candidates.push({
      behavior: 'play',
      weight: 8 + tr.playfulness * 0.36,
      duration: 5.0,
      targetPosition: scratcher
        ? getInteractionPointForFurniture(scratcher, cat.position)
        : randomSpot,
      targetFurnitureId: scratcher?.instanceId ?? null
    });
  }

  // 13. Jump onto sofa or coffee table (stage 3+, curious/playful cats may nudge mug!)
  if (metrics.canJump && cat.needs.energy > 36 && cat.behavior !== 'sleep') {
    const table = findFurnitureByCategory(ctx.furniture, ['table']);
    const sofa = findFurnitureByCategory(ctx.furniture, ['sofa']);
    const prefersTable = tr.curiosity >= 65 && tr.independence >= 55 && table && !ctx.room.tableMugKnocked;
    const jumpTarget = prefersTable ? table : sofa ?? table;
    if (jumpTarget) {
      candidates.push({
        behavior: 'jump',
        weight: (prefersTable ? 28 : 14) + tr.curiosity * 0.16,
        duration: 4.5,
        targetPosition: { x: jumpTarget.x, z: jumpTarget.z },
        targetFurnitureId: jumpTarget.instanceId
      });
    }
  }

  const adjusted = candidates.map((c) => ({
    ...c,
    weight: c.behavior === cat.behavior && c.behavior !== 'sleep' ? c.weight * 0.24 : c.weight
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
        vocalCue: c.vocalCue
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
 * Steps cat AI, smooth locomotion, surface elevation, jumping, and emotion evaluation.
 */
export function stepCatAI(
  cat: CatRuntimeState,
  ctx: AIContext,
  dtSeconds: number
): AIStepResult {
  const dt = clamp(dtSeconds, 0, 0.1);
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

  let roomEvent: AIStepResult['roomEvent'];
  let vocalCue: CatVocalCue | undefined;

  // Live override: follow active toy smoothly (unless stressed or exhausted)
  if (ctx.activeToyTarget && metrics.canUseToys && next.needs.energy > 16 && next.needs.stress < 55) {
    if (next.behavior !== 'play' && next.behavior !== 'pounce_crouch') {
      next.behavior = 'play';
      next.behaviorTimer = 3.5;
    }
    next.targetPosition = { x: ctx.activeToyTarget.x, z: ctx.activeToyTarget.z };
    next.targetFurnitureId = null;
  }

  // Choose next state when timer expires
  if (next.behaviorTimer <= 0) {
    const decision = chooseNextBehavior(next, ctx);
    next.behavior = decision.behavior;
    next.behaviorTimer = decision.duration;
    next.targetPosition = decision.targetPosition;
    next.targetFurnitureId = decision.targetFurnitureId;
    next.isPurring =
      (decision.behavior === 'sleep' || decision.behavior === 'knead') &&
      next.traits.trust >= 35;

    if (decision.vocalCue && next.vocalizationCooldown <= 0) {
      vocalCue = decision.vocalCue;
      next.vocalizationCooldown = 5.5 + (ctx.rng ? ctx.rng() : Math.random()) * 4.5;
      next.mouthOpenAmount = decision.vocalCue === 'sleepy_sigh' ? 0.65 : 0.45;
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

  // Yawn keeps mouth gently open during animation
  if (next.behavior === 'yawn') {
    next.mouthOpenAmount = Math.max(next.mouthOpenAmount, 0.72);
  } else if (next.behavior === 'hiss_defend') {
    next.mouthOpenAmount = Math.max(next.mouthOpenAmount, 0.8);
  }

  // Surface elevation (bed cushion, cardboard box interior, rug, or floor)
  const perchedFurniture = next.targetFurnitureId
    ? ctx.furniture.find((f) => f.instanceId === next.targetFurnitureId)
    : undefined;
  const perchedCatalog = perchedFurniture ? getCatalogItem(perchedFurniture.catalogId) : undefined;
  const shouldBeElevated =
    next.behavior === 'jump' && perchedCatalog?.jumpableHeight !== undefined;

  let surfaceY = 0;
  for (const f of ctx.furniture) {
    const item = getCatalogItem(f.catalogId);
    if (!item) continue;
    const dist = Math.hypot(next.position.x - f.x, next.position.z - f.z);
    if (item.category === 'bed' && dist < 0.34) {
      surfaceY = Math.max(surfaceY, 0.095);
    } else if (f.catalogId === 'cardboard_box' && dist < 0.25) {
      surfaceY = Math.max(surfaceY, 0.025);
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
      'explore',
      'play',
      'approach_player',
      'head_bunt',
      'knead',
      'eat',
      'drink',
      'sleep',
      'hide',
      'observe',
      'jump'
    ].includes(next.behavior);

  // Overweight cats move slightly slower and more deliberately
  const weightSpeedFactor =
    next.weight.condition === 'overweight' ? 0.78 : next.weight.condition === 'lean' ? 1.08 : 1.0;

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

    // Jump arc onto furniture
    if (next.behavior === 'jump' && metrics.canJump && dist < 1.1) {
      next.jumpProgress = clamp(next.jumpProgress + dt * 1.65, 0, 1);
      const t = next.jumpProgress;
      const moveFactor = Math.min(1, dt * 3.5);
      next.position.x += dx * moveFactor;
      next.position.z += dz * moveFactor;
      const arc = Math.sin(t * Math.PI) * 0.34;
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
      next.velocity = { x: 0, z: 0 };
      next.emotion = evaluateCatEmotion(next);
      return { cat: next, roomEvent, vocalCue };
    }

    const arrivalRadius = next.behavior === 'play' ? 0.24 : 0.14;
    if (dist > arrivalRadius) {
      let speedFactor = 0.55;
      if (next.behavior === 'run') speedFactor = 1.0;
      else if (next.behavior === 'play') speedFactor = metrics.canRun ? 0.92 : 0.72;
      else if (next.behavior === 'approach_player' || next.behavior === 'head_bunt') speedFactor = 0.62;
      else if (next.behavior === 'explore') speedFactor = 0.5;

      const targetSpeed = metrics.maxMoveSpeed * speedFactor * weightSpeedFactor;
      const desiredVx = (dx / dist) * targetSpeed;
      const desiredVz = (dz / dist) * targetSpeed;

      const accel = 5.5 * dt;
      next.velocity.x += (desiredVx - next.velocity.x) * clamp(accel, 0, 1);
      next.velocity.z += (desiredVz - next.velocity.z) * clamp(accel, 0, 1);

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

      next.position.x = resolved.x;
      next.position.z = resolved.z;

      const speed = Math.hypot(next.velocity.x, next.velocity.z);
      if (speed > 0.03) {
        const targetYaw = Math.atan2(next.velocity.x, next.velocity.z);
        next.rotationY = lerpAngle(next.rotationY, targetYaw, dt * 6.5);
      }
    } else {
      next.velocity.x *= Math.max(0, 1 - dt * 10);
      next.velocity.z *= Math.max(0, 1 - dt * 10);

      if (next.behavior === 'eat' && ctx.room.foodBowlLevel > 0) {
        roomEvent = 'consumed_food';
      } else if (next.behavior === 'drink' && ctx.room.waterBowlLevel > 0) {
        roomEvent = 'consumed_water';
      } else if (next.behavior === 'observe') {
        next.rotationY = lerpAngle(next.rotationY, Math.PI, dt * 4);
      } else if (next.behavior === 'approach_player' || next.behavior === 'head_bunt') {
        const pdx = ctx.playerFocusPoint.x - next.position.x;
        const pdz = ctx.playerFocusPoint.z - next.position.z;
        if (Math.hypot(pdx, pdz) > 0.05) {
          next.rotationY = lerpAngle(next.rotationY, Math.atan2(pdx, pdz), dt * 4);
        }
      }
    }
  } else {
    next.velocity.x *= Math.max(0, 1 - dt * 9);
    next.velocity.z *= Math.max(0, 1 - dt * 9);

    if (
      (next.behavior === 'react_to_sound' || next.behavior === 'pounce_crouch') &&
      next.targetPosition
    ) {
      const sdx = next.targetPosition.x - next.position.x;
      const sdz = next.targetPosition.z - next.position.z;
      next.rotationY = lerpAngle(next.rotationY, Math.atan2(sdx, sdz), dt * 8);
    }
  }

  next.emotion = evaluateCatEmotion(next);
  return { cat: next, roomEvent, vocalCue };
}
