import * as THREE from 'three';
import { ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import { clamp } from '../simulation/growth';
import { ToyType, Vec3 } from '../types/game';

/**
 * Interactive 3D toys controller:
 * - Feather Wand: tracks player drag with swinging feather physics
 * - Yarn Ball: rolls with friction, spin, and wall bounces; cat can bat it!
 * - Wind-Up Mouse: autonomously darts around the floor for stalking & pouncing
 */
export class ToyController {
  public readonly root = new THREE.Group();

  private activeToy: ToyType | null = null;

  // Feather wand
  private readonly wandGroup = new THREE.Group();
  private readonly featherTip = new THREE.Group();
  private wandTarget = new THREE.Vector3(0, 0.35, 0.4);
  private featherPos = new THREE.Vector3(0, 0.25, 0.4);
  private featherVel = new THREE.Vector3();

  // Rolling ball
  private readonly ballMesh: THREE.Mesh;
  private ballPos = new THREE.Vector3(0.4, 0.065, 0.5);
  private ballVel = new THREE.Vector3(0, 0, 0);

  // Wind-up toy mouse
  private readonly mouseGroup = new THREE.Group();
  private mousePos = new THREE.Vector3(-0.3, 0.04, 0.6);
  private mouseVel = new THREE.Vector3(0.6, 0, 0.4);
  private mouseTurnTimer = 1.2;

  constructor() {
    this.root.name = 'interactive_toys';

    // 1. Feather Wand mesh
    const rodMat = new THREE.MeshStandardMaterial({ color: '#8f6b47', roughness: 0.6 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.62, 8), rodMat);
    rod.position.set(0, 0.32, 0);
    rod.rotation.z = 0.25;
    this.wandGroup.add(rod);

    const featherColors = ['#d97757', '#f1c27d', '#88a88c'];
    featherColors.forEach((hex, idx) => {
      const fGeo = new THREE.ConeGeometry(0.024, 0.12, 6);
      fGeo.scale(1, 1, 0.32);
      const fMesh = new THREE.Mesh(
        fGeo,
        new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 })
      );
      fMesh.position.set((idx - 1) * 0.02, -0.05, 0);
      fMesh.rotation.z = (idx - 1) * 0.28 + Math.PI;
      fMesh.castShadow = true;
      this.featherTip.add(fMesh);
    });
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#e2b955', metalness: 0.7, roughness: 0.25 })
    );
    this.featherTip.add(bell);
    this.wandGroup.visible = false;
    this.featherTip.visible = false;
    this.root.add(this.wandGroup);
    this.root.add(this.featherTip);

    // 2. Yarn Ball mesh
    const ballCanvas = document.createElement('canvas');
    ballCanvas.width = 128;
    ballCanvas.height = 128;
    const bctx = ballCanvas.getContext('2d')!;
    bctx.fillStyle = '#cf7157';
    bctx.fillRect(0, 0, 128, 128);
    bctx.strokeStyle = '#f2dec8';
    bctx.lineWidth = 6;
    for (let i = -128; i < 256; i += 20) {
      bctx.beginPath();
      bctx.moveTo(i, 0);
      bctx.lineTo(i + 128, 128);
      bctx.stroke();
    }
    const ballTex = new THREE.CanvasTexture(ballCanvas);
    ballTex.colorSpace = THREE.SRGBColorSpace;
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 16),
      new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.9 })
    );
    this.ballMesh.castShadow = true;
    this.ballMesh.visible = false;
    this.root.add(this.ballMesh);

    // 3. Wind-up Mouse mesh
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#9c968e', roughness: 0.92 });
    const earMat = new THREE.MeshStandardMaterial({ color: '#dfb2ae', roughness: 0.85 });
    const mBody = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), bodyMat);
    mBody.scale.set(0.85, 0.72, 1.4);
    mBody.castShadow = true;
    this.mouseGroup.add(mBody);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), earMat);
      ear.position.set(side * 0.024, 0.025, 0.025);
      this.mouseGroup.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.09, 6), earMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0, -0.09);
    this.mouseGroup.add(tail);
    this.mouseGroup.visible = false;
    this.root.add(this.mouseGroup);
  }

  public setActiveToy(toy: ToyType | null, catPos: Vec3): void {
    this.activeToy = toy;
    this.wandGroup.visible = toy === 'feather_wand';
    this.featherTip.visible = toy === 'feather_wand';
    this.ballMesh.visible = toy === 'ball';
    this.mouseGroup.visible = toy === 'toy_mouse';

    if (toy === 'feather_wand') {
      this.wandTarget.set(
        clamp(catPos.x + 0.4, -ROOM_HALF_WIDTH + 0.5, ROOM_HALF_WIDTH - 0.5),
        0.38,
        clamp(catPos.z + 0.4, -ROOM_HALF_DEPTH + 0.5, ROOM_HALF_DEPTH - 0.5)
      );
      this.featherPos.copy(this.wandTarget).setY(0.24);
    } else if (toy === 'ball') {
      this.ballPos.set(
        clamp(catPos.x + 0.55, -ROOM_HALF_WIDTH + 0.4, ROOM_HALF_WIDTH - 0.4),
        0.065,
        clamp(catPos.z + 0.45, -ROOM_HALF_DEPTH + 0.4, ROOM_HALF_DEPTH - 0.4)
      );
      this.ballVel.set((Math.random() - 0.5) * 1.4, 0, (Math.random() - 0.5) * 1.4);
    } else if (toy === 'toy_mouse') {
      this.mousePos.set(
        clamp(catPos.x - 0.5, -ROOM_HALF_WIDTH + 0.5, ROOM_HALF_WIDTH - 0.5),
        0.04,
        clamp(catPos.z + 0.5, -ROOM_HALF_DEPTH + 0.5, ROOM_HALF_DEPTH - 0.5)
      );
    }
  }

  public moveFeatherTo(worldPoint: THREE.Vector3): void {
    this.wandTarget.set(
      clamp(worldPoint.x, -ROOM_HALF_WIDTH + 0.35, ROOM_HALF_WIDTH - 0.35),
      0.42,
      clamp(worldPoint.z, -ROOM_HALF_DEPTH + 0.35, ROOM_HALF_DEPTH - 0.35)
    );
  }

  public rollBallToward(targetWorld: THREE.Vector3): void {
    const dir = new THREE.Vector3(
      targetWorld.x - this.ballPos.x,
      0,
      targetWorld.z - this.ballPos.z
    );
    const len = dir.length();
    if (len < 0.05) {
      dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    } else {
      dir.divideScalar(len);
    }
    const speed = clamp(1.3 + len * 0.9, 1.4, 3.2);
    this.ballVel.set(dir.x * speed, 0, dir.z * speed);
  }

  public update(
    dt: number,
    catPos: Vec3,
    onCatCaughtToy: () => void
  ): { type: string; x: number; y: number; z: number } | null {
    if (!this.activeToy) return null;

    if (this.activeToy === 'feather_wand') {
      // Spring-damped swinging feather below wand tip
      const targetTip = this.wandTarget.clone().add(new THREE.Vector3(0, -0.22, 0));
      const force = targetTip.sub(this.featherPos).multiplyScalar(28);
      this.featherVel.add(force.multiplyScalar(dt));
      this.featherVel.multiplyScalar(Math.pow(0.08, dt));
      this.featherPos.add(this.featherVel.clone().multiplyScalar(dt));
      this.featherPos.y = Math.max(0.12, this.featherPos.y);

      this.wandGroup.position.copy(this.wandTarget).add(new THREE.Vector3(0.12, 0.25, 0.12));
      this.featherTip.position.copy(this.featherPos);
      this.featherTip.rotation.z = clamp(-this.featherVel.x * 0.6, -0.7, 0.7);
      this.featherTip.rotation.x = clamp(this.featherVel.z * 0.6, -0.7, 0.7);

      const dist = Math.hypot(catPos.x - this.featherPos.x, catPos.z - this.featherPos.z);
      if (dist < 0.36) {
        onCatCaughtToy();
      }

      return {
        type: 'feather_wand',
        x: this.featherPos.x,
        y: this.featherPos.y,
        z: this.featherPos.z
      };
    }

    if (this.activeToy === 'ball') {
      this.ballPos.x += this.ballVel.x * dt;
      this.ballPos.z += this.ballVel.z * dt;

      // Room wall bounce
      const boundX = ROOM_HALF_WIDTH - 0.25;
      const boundZ = ROOM_HALF_DEPTH - 0.25;
      if (this.ballPos.x < -boundX || this.ballPos.x > boundX) {
        this.ballPos.x = clamp(this.ballPos.x, -boundX, boundX);
        this.ballVel.x *= -0.78;
      }
      if (this.ballPos.z < -boundZ || this.ballPos.z > boundZ) {
        this.ballPos.z = clamp(this.ballPos.z, -boundZ, boundZ);
        this.ballVel.z *= -0.78;
      }

      // Natural carpet/wood rolling friction
      const friction = Math.pow(0.45, dt);
      this.ballVel.multiplyScalar(friction);

      // Realistic rolling rotation
      this.ballMesh.position.copy(this.ballPos);
      this.ballMesh.rotation.z -= (this.ballVel.x * dt) / 0.065;
      this.ballMesh.rotation.x += (this.ballVel.z * dt) / 0.065;

      // Cat bats the ball when close!
      const dist = Math.hypot(catPos.x - this.ballPos.x, catPos.z - this.ballPos.z);
      if (dist < 0.32 && this.ballVel.length() < 1.2) {
        const angle = Math.atan2(this.ballPos.z - catPos.z, this.ballPos.x - catPos.x) + (Math.random() - 0.5) * 0.8;
        this.ballVel.set(Math.cos(angle) * 1.9, 0, Math.sin(angle) * 1.9);
        onCatCaughtToy();
      }

      return {
        type: 'ball',
        x: this.ballPos.x,
        y: this.ballPos.y,
        z: this.ballPos.z
      };
    }

    if (this.activeToy === 'toy_mouse') {
      this.mouseTurnTimer -= dt;
      if (this.mouseTurnTimer <= 0) {
        this.mouseTurnTimer = 0.8 + Math.random() * 1.4;
        const a = Math.random() * Math.PI * 2;
        const spd = 0.65 + Math.random() * 0.55;
        this.mouseVel.set(Math.cos(a) * spd, 0, Math.sin(a) * spd);
      }

      this.mousePos.x += this.mouseVel.x * dt;
      this.mousePos.z += this.mouseVel.z * dt;

      const boundX = ROOM_HALF_WIDTH - 0.45;
      const boundZ = ROOM_HALF_DEPTH - 0.45;
      if (this.mousePos.x < -boundX || this.mousePos.x > boundX) {
        this.mousePos.x = clamp(this.mousePos.x, -boundX, boundX);
        this.mouseVel.x *= -1;
      }
      if (this.mousePos.z < -boundZ || this.mousePos.z > boundZ) {
        this.mousePos.z = clamp(this.mousePos.z, -boundZ, boundZ);
        this.mouseVel.z *= -1;
      }

      this.mouseGroup.position.copy(this.mousePos);
      this.mouseGroup.rotation.y = Math.atan2(this.mouseVel.x, this.mouseVel.z);

      const dist = Math.hypot(catPos.x - this.mousePos.x, catPos.z - this.mousePos.z);
      if (dist < 0.34) {
        const escapeAngle = Math.atan2(this.mousePos.z - catPos.z, this.mousePos.x - catPos.x);
        this.mouseVel.set(Math.cos(escapeAngle) * 1.35, 0, Math.sin(escapeAngle) * 1.35);
        onCatCaughtToy();
      }

      return {
        type: 'toy_mouse',
        x: this.mousePos.x,
        y: this.mousePos.y,
        z: this.mousePos.z
      };
    }

    return null;
  }
}
