import * as THREE from 'three';
import { ROOM_HALF_DEPTH, ROOM_HALF_WIDTH, ROOM_HEIGHT } from '../config/catalog';
import { clamp, lerp } from '../simulation/growth';

/**
 * Smooth mobile-first orbital camera controller with touch drag rotation,
 * pinch-to-zoom, wheel zoom, follow-cat tracking, and interior wall clamping.
 */
export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly target = new THREE.Vector3(-0.8, 0.25, 0.2);
  private desiredTarget = new THREE.Vector3(-0.8, 0.25, 0.2);

  private yaw = -0.52;
  private desiredYaw = -0.52;
  private pitch = 0.44;
  private desiredPitch = 0.44;
  private distance = 2.05;
  private desiredDistance = 2.05;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.08, 30);
    this.update(1);
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public orbitBy(deltaX: number, deltaY: number): void {
    this.desiredYaw -= deltaX * 0.0068;
    this.desiredPitch = clamp(this.desiredPitch + deltaY * 0.0052, 0.14, 1.18);
  }

  public zoomBy(delta: number): void {
    this.desiredDistance = clamp(this.desiredDistance + delta, 0.95, 4.35);
  }

  public focusOn(x: number, y: number, z: number, closeDistance?: number): void {
    this.desiredTarget.set(
      clamp(x, -ROOM_HALF_WIDTH + 0.4, ROOM_HALF_WIDTH - 0.4),
      clamp(y, 0.14, 1.3),
      clamp(z, -ROOM_HALF_DEPTH + 0.4, ROOM_HALF_DEPTH - 0.4)
    );
    if (closeDistance !== undefined) {
      this.desiredDistance = clamp(closeDistance, 1.05, 3.8);
    }
  }

  public update(dt: number, followTarget?: THREE.Vector3 | null): void {
    if (followTarget) {
      this.desiredTarget.set(
        clamp(followTarget.x, -ROOM_HALF_WIDTH + 0.45, ROOM_HALF_WIDTH - 0.45),
        clamp(followTarget.y + 0.18, 0.16, 1.35),
        clamp(followTarget.z, -ROOM_HALF_DEPTH + 0.45, ROOM_HALF_DEPTH - 0.45)
      );
    }

    const smooth = Math.min(1, dt * 7.5);
    this.yaw = lerp(this.yaw, this.desiredYaw, smooth);
    this.pitch = lerp(this.pitch, this.desiredPitch, smooth);
    this.distance = lerp(this.distance, this.desiredDistance, smooth);
    this.target.lerp(this.desiredTarget, Math.min(1, dt * 5.2));

    const horiz = Math.cos(this.pitch) * this.distance;
    const rawX = this.target.x + Math.sin(this.yaw) * horiz;
    const rawY = this.target.y + Math.sin(this.pitch) * this.distance;
    const rawZ = this.target.z + Math.cos(this.yaw) * horiz;

    // Clamp camera smoothly inside room walls and ceiling so it never clips outside
    const margin = 0.24;
    const clampedX = clamp(rawX, -ROOM_HALF_WIDTH + margin, ROOM_HALF_WIDTH - margin);
    const clampedY = clamp(rawY, 0.22, ROOM_HEIGHT - 0.22);
    const clampedZ = clamp(rawZ, -ROOM_HALF_DEPTH + margin, ROOM_HALF_DEPTH - margin);

    this.camera.position.set(clampedX, clampedY, clampedZ);
    this.camera.lookAt(this.target);
  }
}
