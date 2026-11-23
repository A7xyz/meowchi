import { getCatalogItem, ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import {
  CareActionType,
  CatRuntimeState,
  FoodItemId,
  HumanRuntimeState,
  PlacedFurniture,
  Vec2
} from '../types/game';
import { lerpAngle, normalizeAngle } from './catAI';
import { getFurnitureAABB, resolveCatCollision } from './collision';
import { clamp } from './growth';

export const HUMAN_COLLISION_RADIUS = 0.24;
export const HUMAN_WALK_SPEED = 1.48;

export function createInitialHumanState(): HumanRuntimeState {
  return {
    position: { x: 0.72, y: 0, z: 1.08 },
    rotationY: -2.45,
    velocity: { x: 0, z: 0 },
    targetPosition: null,
    facingTarget: null,
    animState: 'idle',
    carryingCat: false,
    navStuckTimer: 0
  };
}

/**
 * Checks whether a candidate standing spot for the human is free of solid furniture AABBs.
 */
export function isSpotWalkableForHuman(
  spot: Vec2,
  furniture: PlacedFurniture[],
  radius: number = HUMAN_COLLISION_RADIUS
): boolean {
  if (
    spot.x < -ROOM_HALF_WIDTH + radius + 0.1 ||
    spot.x > ROOM_HALF_WIDTH - radius - 0.1 ||
    spot.z < -ROOM_HALF_DEPTH + radius + 0.1 ||
    spot.z > ROOM_HALF_DEPTH - radius - 0.1
  ) {
    return false;
  }

  for (const f of furniture) {
    const box = getFurnitureAABB(f);
    if (!box || box.walkable || box.wallMounted) continue;
    const closestX = clamp(spot.x, box.minX, box.maxX);
    const closestZ = clamp(spot.z, box.minZ, box.maxZ);
    const distSq = (spot.x - closestX) ** 2 + (spot.z - closestZ) ** 2;
    if (distSq < (radius * 0.88) ** 2) {
      return false;
    }
  }
  return true;
}

/**
 * Finds the best unobstructed standing spot around a world anchor point (cat or furniture)
 * closest to the human's current position. Handles inaccessible furniture gracefully.
 */
export function findBestApproachSpot(
  anchor: Vec2,
  humanPos: Vec2,
  desiredDist: number,
  furniture: PlacedFurniture[]
): Vec2 {
  const baseAngle = Math.atan2(humanPos.x - anchor.x, humanPos.z - anchor.z);
  const angleOffsets = [
    0,
    0.45,
    -0.45,
    0.9,
    -0.9,
    1.35,
    -1.35,
    1.8,
    -1.8,
    2.35,
    -2.35,
    Math.PI
  ];

  for (const scale of [1.0, 1.25, 1.55]) {
    const r = desiredDist * scale;
    for (const off of angleOffsets) {
      const a = baseAngle + off;
      const cand: Vec2 = {
        x: clamp(anchor.x + Math.sin(a) * r, -ROOM_HALF_WIDTH + 0.36, ROOM_HALF_WIDTH - 0.36),
        z: clamp(anchor.z + Math.cos(a) * r, -ROOM_HALF_DEPTH + 0.36, ROOM_HALF_DEPTH - 0.36)
      };
      if (isSpotWalkableForHuman(cand, furniture)) {
        return cand;
      }
    }
  }

  // Fallback: push smoothly out of any furniture collisions
  return resolveCatCollision(
    {
      x: anchor.x + Math.sin(baseAngle) * desiredDist,
      z: anchor.z + Math.cos(baseAngle) * desiredDist
    },
    HUMAN_COLLISION_RADIUS,
    furniture
  );
}

/**
 * Calculates the target standing location and look-at alignment point for any human-to-cat interaction.
 */
export function computeActionInteractionSpots(
  type: CareActionType,
  cat: CatRuntimeState,
  furniture: PlacedFurniture[],
  humanPos: Vec2,
  options?: { foodId?: FoodItemId; targetInstanceId?: string }
): { targetPoint: Vec2; alignTarget: Vec2 } {
  const catPt: Vec2 = { x: cat.position.x, z: cat.position.z };

  // Give Personal Space: human calmly backs away from the cat!
  if (type === 'respect_space') {
    const dx = humanPos.x - catPt.x;
    const dz = humanPos.z - catPt.z;
    const len = Math.hypot(dx, dz);
    const dirX = len > 0.05 ? dx / len : 0.7;
    const dirZ = len > 0.05 ? dz / len : 0.7;
    const desiredBackDist = Math.max(1.35, Math.min(2.1, len + 0.65));
    const backSpot = resolveCatCollision(
      {
        x: clamp(catPt.x + dirX * desiredBackDist, -ROOM_HALF_WIDTH + 0.4, ROOM_HALF_WIDTH - 0.4),
        z: clamp(catPt.z + dirZ * desiredBackDist, -ROOM_HALF_DEPTH + 0.4, ROOM_HALF_DEPTH - 0.4)
      },
      HUMAN_COLLISION_RADIUS,
      furniture
    );
    return { targetPoint: backSpot, alignTarget: catPt };
  }

  // Direct Cat Interactions (Pet, Brush, Pickup, Newborn Bottle Feed)
  if (
    type === 'pet' ||
    type === 'brush' ||
    type === 'pickup' ||
    (type === 'feed' && options?.foodId === 'kitten_milk')
  ) {
    const dist = type === 'pickup' ? 0.48 : 0.56;
    return {
      targetPoint: findBestApproachSpot(catPt, humanPos, dist, furniture),
      alignTarget: catPt
    };
  }

  // Play with Cat: stand at a lively comfortable distance so wand/toy swings naturally
  if (type === 'play_toy') {
    return {
      targetPoint: findBestApproachSpot(catPt, humanPos, 0.96, furniture),
      alignTarget: catPt
    };
  }

  // Furniture-Anchored Interactions (Feeding station, Water bowl/fountain, Litter box, Bed, Table)
  if (options?.targetInstanceId) {
    const furn = furniture.find((f) => f.instanceId === options.targetInstanceId);
    if (furn) {
      const item = getCatalogItem(furn.catalogId);
      const furnRadius = item ? Math.max(item.width, item.depth) * 0.5 : 0.25;
      const anchor: Vec2 = { x: furn.x, z: furn.z };
      return {
        targetPoint: findBestApproachSpot(anchor, humanPos, furnRadius + 0.44, furniture),
        alignTarget: anchor
      };
    }
  }

  if (type === 'sleep') {
    const bed =
      furniture.find((f) => f.catalogId === 'smart_cat_bed') ??
      furniture.find((f) => getCatalogItem(f.catalogId)?.category === 'bed');
    if (bed) {
      const anchor = { x: bed.x, z: bed.z };
      return {
        targetPoint: findBestApproachSpot(anchor, humanPos, 0.68, furniture),
        alignTarget: anchor
      };
    }
  }

  if (type === 'clean_room') {
    const table = furniture.find((f) => getCatalogItem(f.catalogId)?.category === 'table');
    if (table) {
      const anchor = { x: table.x, z: table.z };
      return {
        targetPoint: findBestApproachSpot(anchor, humanPos, 0.72, furniture),
        alignTarget: anchor
      };
    }
  }

  return {
    targetPoint: findBestApproachSpot(catPt, humanPos, 0.62, furniture),
    alignTarget: catPt
  };
}

/**
 * Steps smooth third-person human movement with furniture obstacle avoidance,
 * natural turning, collision resolution, and anti-stuck recovery.
 * Guarantees the human NEVER teleports and NEVER clips through walls or furniture.
 */
export function stepHumanNavigation(
  human: HumanRuntimeState,
  targetPoint: Vec2,
  alignTarget: Vec2,
  furniture: PlacedFurniture[],
  dtSeconds: number
): {
  human: HumanRuntimeState;
  arrived: boolean;
  aligned: boolean;
  recoveredFromStuck: boolean;
} {
  const dt = clamp(dtSeconds, 0, 0.1);
  const next: HumanRuntimeState = {
    ...human,
    position: { ...human.position },
    velocity: { ...human.velocity },
    targetPosition: targetPoint,
    facingTarget: alignTarget
  };

  const dx = targetPoint.x - next.position.x;
  const dz = targetPoint.z - next.position.z;
  const dist = Math.hypot(dx, dz);

  const arrivalThreshold = 0.16;
  if (dist > arrivalThreshold) {
    // Obstacle-avoiding steering: test direct direction, then progressively angled detours
    const directYaw = Math.atan2(dx, dz);
    const probeDist = Math.min(0.42, dist);
    const steerCandidates = [0, 0.55, -0.55, 1.05, -1.05, 1.55, -1.55];
    let chosenYaw = directYaw;

    for (const offset of steerCandidates) {
      const testYaw = directYaw + offset;
      const probe: Vec2 = {
        x: next.position.x + Math.sin(testYaw) * probeDist,
        z: next.position.z + Math.cos(testYaw) * probeDist
      };
      if (isSpotWalkableForHuman(probe, furniture, HUMAN_COLLISION_RADIUS * 0.92)) {
        chosenYaw = testYaw;
        break;
      }
    }

    const brake = clamp(dist / 0.45, 0.35, 1.0);
    const speed = HUMAN_WALK_SPEED * brake;
    const desiredVx = Math.sin(chosenYaw) * speed;
    const desiredVz = Math.cos(chosenYaw) * speed;

    next.velocity.x += (desiredVx - next.velocity.x) * clamp(dt * 8.5, 0, 1);
    next.velocity.z += (desiredVz - next.velocity.z) * clamp(dt * 8.5, 0, 1);

    const candPos: Vec2 = {
      x: next.position.x + next.velocity.x * dt,
      z: next.position.z + next.velocity.z * dt
    };
    const resolved = resolveCatCollision(candPos, HUMAN_COLLISION_RADIUS, furniture);
    const moved = Math.hypot(resolved.x - next.position.x, resolved.z - next.position.z);

    next.position.x = resolved.x;
    next.position.z = resolved.z;
    next.position.y = 0;

    if (Math.hypot(next.velocity.x, next.velocity.z) > 0.05) {
      const moveYaw = Math.atan2(next.velocity.x, next.velocity.z);
      next.rotationY = lerpAngle(next.rotationY, moveYaw, dt * 8.5);
    }

    next.animState = 'walk';

    // Anti-stuck detection: if furniture blocks last inches, recover cleanly instead of freezing
    if (moved < 0.0025 && dt > 0.005) {
      next.navStuckTimer += dt;
    } else {
      next.navStuckTimer = Math.max(0, next.navStuckTimer - dt * 2);
    }

    if (next.navStuckTimer >= 1.35) {
      next.velocity = { x: 0, z: 0 };
      next.navStuckTimer = 0;
      const faceYaw = Math.atan2(alignTarget.x - next.position.x, alignTarget.z - next.position.z);
      next.rotationY = lerpAngle(next.rotationY, faceYaw, 0.5);
      return { human: next, arrived: true, aligned: true, recoveredFromStuck: true };
    }

    return { human: next, arrived: false, aligned: false, recoveredFromStuck: false };
  }

  // Arrived at target spot -> smoothly decelerate and turn to face alignTarget
  next.velocity.x *= Math.max(0, 1 - dt * 14);
  next.velocity.z *= Math.max(0, 1 - dt * 14);
  if (Math.hypot(next.velocity.x, next.velocity.z) < 0.015) {
    next.velocity = { x: 0, z: 0 };
  }
  next.navStuckTimer = 0;

  const fdx = alignTarget.x - next.position.x;
  const fdz = alignTarget.z - next.position.z;
  const faceDist = Math.hypot(fdx, fdz);
  if (faceDist > 0.05) {
    const desiredFaceYaw = Math.atan2(fdx, fdz);
    const angleDiff = Math.abs(normalizeAngle(desiredFaceYaw - next.rotationY));
    next.rotationY = lerpAngle(next.rotationY, desiredFaceYaw, dt * 9.5);
    const aligned = angleDiff < 0.24;
    if (!aligned) {
      next.animState = 'turn';
    }
    return { human: next, arrived: true, aligned, recoveredFromStuck: false };
  }

  return { human: next, arrived: true, aligned: true, recoveredFromStuck: false };
}
