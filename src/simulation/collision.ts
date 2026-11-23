import { getCatalogItem, ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import { PlacedFurniture, Vec2 } from '../types/game';
import { clamp } from './growth';

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  walkable: boolean;
  wallMounted: boolean;
  instanceId: string;
  catalogId: string;
  category: string;
}

/**
 * Computes conservative axis-aligned bounding box for rotated furniture.
 */
export function getFurnitureAABB(placed: PlacedFurniture): AABB | null {
  const item = getCatalogItem(placed.catalogId);
  if (!item) return null;

  const c = Math.abs(Math.cos(placed.rotationY));
  const s = Math.abs(Math.sin(placed.rotationY));
  const halfW = (item.width * c + item.depth * s) * 0.5;
  const halfD = (item.width * s + item.depth * c) * 0.5;

  return {
    minX: placed.x - halfW,
    maxX: placed.x + halfW,
    minZ: placed.z - halfD,
    maxZ: placed.z + halfD,
    height: item.height,
    walkable: item.walkable,
    wallMounted: Boolean(item.wallMounted),
    instanceId: placed.instanceId,
    catalogId: placed.catalogId,
    category: item.category
  };
}

export function aabbOverlap(a: AABB, b: AABB, margin = 0.04): boolean {
  return (
    a.minX < b.maxX - margin &&
    a.maxX > b.minX + margin &&
    a.minZ < b.maxZ - margin &&
    a.maxZ > b.minZ + margin
  );
}

/**
 * Validates whether a furniture item can be placed at (x, z, rotationY) without
 * leaving room boundaries or colliding with other non-walkable furniture.
 */
export function validateFurniturePlacement(
  candidate: PlacedFurniture,
  allFurniture: PlacedFurniture[]
): { valid: boolean; reason?: 'out_of_bounds' | 'overlap' } {
  const box = getFurnitureAABB(candidate);
  if (!box) return { valid: false, reason: 'out_of_bounds' };

  const wallMargin = 0.08;
  if (
    box.minX < -ROOM_HALF_WIDTH + wallMargin ||
    box.maxX > ROOM_HALF_WIDTH - wallMargin ||
    box.minZ < -ROOM_HALF_DEPTH + wallMargin ||
    box.maxZ > ROOM_HALF_DEPTH - wallMargin
  ) {
    return { valid: false, reason: 'out_of_bounds' };
  }

  // Rugs and wall decorations can overlap floor furniture
  if (box.walkable || box.wallMounted) {
    return { valid: true };
  }

  for (const other of allFurniture) {
    if (other.instanceId === candidate.instanceId) continue;
    const otherBox = getFurnitureAABB(other);
    if (!otherBox || otherBox.walkable || otherBox.wallMounted) continue;
    if (aabbOverlap(box, otherBox, 0.02)) {
      return { valid: false, reason: 'overlap' };
    }
  }

  return { valid: true };
}

/**
 * Clamps a position inside the playable floor area and pushes it smoothly
 * outside solid furniture obstacles so the cat never clips into geometry.
 */
export function resolveCatCollision(
  pos: Vec2,
  catRadius: number,
  furniture: PlacedFurniture[],
  ignoreInstanceId?: string | null
): Vec2 {
  let x = clamp(pos.x, -ROOM_HALF_WIDTH + catRadius + 0.12, ROOM_HALF_WIDTH - catRadius - 0.12);
  let z = clamp(pos.z, -ROOM_HALF_DEPTH + catRadius + 0.12, ROOM_HALF_DEPTH - catRadius - 0.12);

  for (const f of furniture) {
    if (ignoreInstanceId && f.instanceId === ignoreInstanceId) continue;
    const box = getFurnitureAABB(f);
    if (!box || box.walkable || box.wallMounted) continue;

    const closestX = clamp(x, box.minX, box.maxX);
    const closestZ = clamp(z, box.minZ, box.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < catRadius * catRadius) {
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = catRadius - dist;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      } else {
        // Inside AABB: push out along nearest edge
        const left = Math.abs(x - box.minX);
        const right = Math.abs(box.maxX - x);
        const top = Math.abs(z - box.minZ);
        const bottom = Math.abs(box.maxZ - z);
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = box.minX - catRadius;
        else if (m === right) x = box.maxX + catRadius;
        else if (m === top) z = box.minZ - catRadius;
        else z = box.maxZ + catRadius;
      }
    }
  }

  return {
    x: clamp(x, -ROOM_HALF_WIDTH + catRadius + 0.1, ROOM_HALF_WIDTH - catRadius - 0.1),
    z: clamp(z, -ROOM_HALF_DEPTH + catRadius + 0.1, ROOM_HALF_DEPTH - catRadius - 0.1)
  };
}

/**
 * Returns a comfortable interaction point next to a furniture piece (or center for beds/boxes).
 */
export function getInteractionPointForFurniture(
  placed: PlacedFurniture,
  fromPos?: Vec2
): Vec2 {
  const item = getCatalogItem(placed.catalogId);
  if (!item) return { x: placed.x, z: placed.z };

  if (item.category === 'bed' || placed.catalogId === 'cardboard_box' || item.walkable) {
    return { x: placed.x, z: placed.z };
  }

  const offset = Math.max(item.width, item.depth) * 0.5 + 0.28;
  let dirX = 0;
  let dirZ = 1;
  if (fromPos) {
    const dx = fromPos.x - placed.x;
    const dz = fromPos.z - placed.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.01) {
      dirX = dx / len;
      dirZ = dz / len;
    }
  }

  return {
    x: clamp(placed.x + dirX * offset, -ROOM_HALF_WIDTH + 0.35, ROOM_HALF_WIDTH - 0.35),
    z: clamp(placed.z + dirZ * offset, -ROOM_HALF_DEPTH + 0.35, ROOM_HALF_DEPTH - 0.35)
  };
}
