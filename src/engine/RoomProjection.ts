import { ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import { Vec2 } from '../types/game';
import { clamp } from '../simulation/growth';

/**
 * Logical portrait 9:16 coordinate system for the Phaser 3 2D stage.
 * Aligns cleanly with cozy_living_room_bg.png:
 * - Back wall + sunlit window: y = 0 .. 540
 * - Playable honey-oak hardwood floor: y = 548 .. 1076 (leaves room for bottom mobile HUD!)
 */
export const STAGE_WIDTH = 720;
export const STAGE_HEIGHT = 1280;

const FLOOR_TOP_Y = 556;
const FLOOR_BOTTOM_Y = 1072;
const FLOOR_CENTER_X = STAGE_WIDTH * 0.5;
const FLOOR_TOP_HALF_W = 286;
const FLOOR_BOTTOM_HALF_W = 342;
const PIXELS_PER_METER_Y = 148;

export interface ProjectedPoint {
  x: number;
  y: number;
  groundY: number;
  depthScale: number;
}

/**
 * Projects simulation room coordinates (x in [-2.8, 2.8], z in [-2.6, 2.6], y >= 0)
 * onto the 720x1280 2D portrait stage with subtle cozy 3/4 perspective depth scaling.
 */
export function worldToScreen(wx: number, wz: number, wy = 0): ProjectedPoint {
  const tz = clamp((wz + ROOM_HALF_DEPTH) / (ROOM_HALF_DEPTH * 2), 0, 1);
  const nx = clamp(wx / ROOM_HALF_WIDTH, -1.08, 1.08);
  const halfW = FLOOR_TOP_HALF_W + (FLOOR_BOTTOM_HALF_W - FLOOR_TOP_HALF_W) * tz;
  const groundY = FLOOR_TOP_Y + (FLOOR_BOTTOM_Y - FLOOR_TOP_Y) * tz;
  const depthScale = 0.82 + tz * 0.3;
  const x = FLOOR_CENTER_X + nx * halfW;
  const y = groundY - wy * PIXELS_PER_METER_Y * depthScale;
  return { x, y, groundY, depthScale };
}

/**
 * Inverse projection from 720x1280 portrait stage coordinates to simulation floor (x, z).
 */
export function screenToWorld(sx: number, sy: number): Vec2 {
  const tz = clamp((sy - FLOOR_TOP_Y) / (FLOOR_BOTTOM_Y - FLOOR_TOP_Y), 0, 1);
  const halfW = FLOOR_TOP_HALF_W + (FLOOR_BOTTOM_HALF_W - FLOOR_TOP_HALF_W) * tz;
  const nx = clamp((sx - FLOOR_CENTER_X) / halfW, -1, 1);
  return {
    x: clamp(nx * ROOM_HALF_WIDTH, -ROOM_HALF_WIDTH + 0.12, ROOM_HALF_WIDTH - 0.12),
    z: clamp(tz * (ROOM_HALF_DEPTH * 2) - ROOM_HALF_DEPTH, -ROOM_HALF_DEPTH + 0.12, ROOM_HALF_DEPTH - 0.12)
  };
}

/**
 * Computes consistent 2D painter's algorithm depth for proper foreground/background occlusion.
 */
export function computeDepth(groundY: number, layerBias = 0): number {
  return 100 + Math.round(groundY) + layerBias;
}
