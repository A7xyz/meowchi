import * as THREE from 'three';
import { ROOM_HALF_DEPTH, ROOM_HALF_WIDTH, ROOM_HEIGHT } from '../config/catalog';
import { clamp, lerp } from '../simulation/growth';
import { CareActionType } from '../types/game';

/**
 * Smooth third-person mobile portrait camera controller supporting BOTH
 * the full 3D human character and the cat.
 *
 * Features:
 * - Portrait 9:16 mobile framing keeping both characters clearly visible
 * - Automatic interaction framing for petting, brushing, feeding, watering, playing, pickup
 * - Touch drag orbit, pinch-to-zoom, wheel zoom, smooth tracking
 * - Interior room wall & ceiling collision clamping
 */
export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly target = new THREE.Vector3(-0.35, 0.38, 0.35);
  private desiredTarget = new THREE.Vector3(-0.35, 0.38, 0.35);

  private yaw = -0.42;
  private desiredYaw = -0.42;
  private pitch = 0.32;
  private desiredPitch = 0.32;
  private distance = 2.18;
  private desiredDistance = 2.18;
  private savedPreInteractionDistance: number | null = null;
  private wasInInteraction = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.08, 30);
    this.update(1);
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public orbitBy(deltaX: number, deltaY: number): void {
    this.desiredYaw -= deltaX * 0.0068;
    this.desiredPitch = clamp(this.desiredPitch + deltaY * 0.0052, 0.12, 1.12);
  }

  public zoomBy(delta: number): void {
    this.desiredDistance = clamp(this.desiredDistance + delta, 1.35, 4.45);
  }

  public focusOn(x: number, y: number, z: number, closeDistance?: number): void {
    this.desiredTarget.set(
      clamp(x, -ROOM_HALF_WIDTH + 0.45, ROOM_HALF_WIDTH - 0.45),
      clamp(y, 0.18, 1.45),
      clamp(z, -ROOM_HALF_DEPTH + 0.45, ROOM_HALF_DEPTH - 0.45)
    );
    if (closeDistance !== undefined) {
      this.desiredDistance = clamp(closeDistance, 1.35, 4.1);
    }
  }

  /**
   * Automatically frames BOTH the human character and cat cleanly in portrait view
   * during active interactions (petting, grooming, feeding, watering, playing, pickup).
   */
  public frameInteraction(
    humanPos: THREE.Vector3,
    catPos: THREE.Vector3,
    actionType: CareActionType
  ): void {
    if (!this.wasInInteraction) {
      this.savedPreInteractionDistance = this.desiredDistance;
      this.wasInInteraction = true;
    }

    const midX = lerp(humanPos.x, catPos.x, 0.48);
    const midZ = lerp(humanPos.z, catPos.z, 0.48);
    const separation = Math.hypot(humanPos.x - catPos.x, humanPos.z - catPos.z);

    let targetY = 0.38;
    let dist = 1.92 + Math.min(0.75, separation * 0.42);

    if (actionType === 'pet' || actionType === 'brush') {
      targetY = 0.34;
      dist = clamp(1.68 + separation * 0.32, 1.62, 2.25);
    } else if (actionType === 'pickup') {
      targetY = 0.48;
      dist = 1.9;
    } else if (actionType === 'feed' || actionType === 'water' || actionType === 'refill_fountain') {
      targetY = 0.38;
      dist = clamp(1.85 + separation * 0.28, 1.75, 2.45);
    } else if (actionType === 'play_toy') {
      targetY = 0.44;
      dist = clamp(2.15 + separation * 0.38, 2.0, 2.8);
    }

    this.desiredTarget.set(
      clamp(midX, -ROOM_HALF_WIDTH + 0.45, ROOM_HALF_WIDTH - 0.45),
      targetY,
      clamp(midZ, -ROOM_HALF_DEPTH + 0.45, ROOM_HALF_DEPTH - 0.45)
    );
    this.desiredDistance = clamp(dist, 1.55, 2.95);
    this.desiredPitch = lerp(this.desiredPitch, 0.28, 0.06);
  }

  public endInteractionFraming(): void {
    if (this.wasInInteraction) {
      this.wasInInteraction = false;
      if (this.savedPreInteractionDistance !== null) {
        this.desiredDistance = clamp(this.savedPreInteractionDistance, 1.8, 3.6);
        this.savedPreInteractionDistance = null;
      }
    }
  }

  public update(
    dt: number,
    followTarget?: THREE.Vector3 | null,
    secondaryTarget?: THREE.Vector3 | null
  ): void {
    if (followTarget && !this.wasInInteraction) {
      if (secondaryTarget) {
        // Gentle weighted framing between cat and human so both stay present in the living world
        const tx = lerp(followTarget.x, secondaryTarget.x, 0.28);
        const tz = lerp(followTarget.z, secondaryTarget.z, 0.28);
        this.desiredTarget.set(
          clamp(tx, -ROOM_HALF_WIDTH + 0.45, ROOM_HALF_WIDTH - 0.45),
          clamp(followTarget.y + 0.42, 0.32, 1.35),
          clamp(tz, -ROOM_HALF_DEPTH + 0.45, ROOM_HALF_DEPTH - 0.45)
        );
      } else {
        this.desiredTarget.set(
          clamp(followTarget.x, -ROOM_HALF_WIDTH + 0.45, ROOM_HALF_WIDTH - 0.45),
          clamp(followTarget.y + 0.32, 0.22, 1.35),
          clamp(followTarget.z, -ROOM_HALF_DEPTH + 0.45, ROOM_HALF_DEPTH - 0.45)
        );
      }
    }

    const smooth = Math.min(1, dt * 6.5);
    this.yaw = lerp(this.yaw, this.desiredYaw, smooth);
    this.pitch = lerp(this.pitch, this.desiredPitch, smooth);
    this.distance = lerp(this.distance, this.desiredDistance, smooth);
    this.target.lerp(this.desiredTarget, Math.min(1, dt * 4.8));

    const horiz = Math.cos(this.pitch) * this.distance;
    const rawX = this.target.x + Math.sin(this.yaw) * horiz;
    const rawY = this.target.y + Math.sin(this.pitch) * this.distance;
    const rawZ = this.target.z + Math.cos(this.yaw) * horiz;

    // Clamp camera smoothly inside room walls & ceiling (collision-safe!)
    const margin = 0.26;
    const clampedX = clamp(rawX, -ROOM_HALF_WIDTH + margin, ROOM_HALF_WIDTH - margin);
    const clampedY = clamp(rawY, 0.28, ROOM_HEIGHT - 0.24);
    const clampedZ = clamp(rawZ, -ROOM_HALF_DEPTH + margin, ROOM_HALF_DEPTH - margin);

    this.camera.position.set(clampedX, clampedY, clampedZ);
    this.camera.lookAt(this.target);
  }
}
