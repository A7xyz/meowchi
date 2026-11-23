import * as THREE from 'three';
import { clamp, computeGrowthMetrics } from '../simulation/growth';
import { ActiveCareAction, CatRuntimeState, PlacedFurniture } from '../types/game';
import { createHumanSkinTexture } from './textures';

interface FingerRig {
  base: THREE.Group;
  mid: THREE.Group;
}

/**
 * Visible First-Person 3D Human Hand & Care Tool Rig.
 *
 * Anatomically articulated procedural hand with forearm sleeve, sculpted palm,
 * 2-segment thumb, 4 multi-jointed fingers with fingernails, and physical care props:
 * - Petting: open hand entering from portrait edge, stroking head/back, smooth exit (or rapid flinch on bite!)
 * - Feeding: food scoop / kitten milk bottle tilting to pour visible 3D kibble or milk drops into bowl
 * - Brushing: wooden grooming brush gliding along the cat's fur surface
 * - Watering / Refilling Fountain: glass water carafe pouring an animated water stream into bowl/fountain
 * - Cleaning Litter: slotted litter scoop dipping & lifting clumps cleanly
 * - Feather Wand: hand visibly grips the wand handle while player drags across portrait view
 * - Give Personal Space: gentle open-palm withdrawal back out of view
 */
export class HumanHandRig {
  public readonly root = new THREE.Group();
  private readonly armPivot = new THREE.Group();
  private readonly wristPivot = new THREE.Group();
  private readonly fingers: FingerRig[] = [];
  private readonly thumbBase = new THREE.Group();
  private readonly thumbTip = new THREE.Group();

  // Held care props
  private readonly propBrush = new THREE.Group();
  private readonly propWaterPitcher = new THREE.Group();
  private readonly waterStreamMesh: THREE.Mesh;
  private readonly propFoodContainer = new THREE.Group();
  private readonly propMilkBottle = new THREE.Group();
  private readonly foodParticles: THREE.Mesh[] = [];
  private readonly propLitterScoop = new THREE.Group();
  private readonly propScoopClump: THREE.Mesh;

  private clock = 0;
  private wasVisible = false;
  private currentPos = new THREE.Vector3(0, -1, 0);

  constructor() {
    this.root.name = 'player_human_hand';
    this.root.visible = false;
    this.root.add(this.armPivot);

    const skinTex = createHumanSkinTexture();
    const skinMat = new THREE.MeshStandardMaterial({
      map: skinTex,
      roughness: 0.62,
      metalness: 0.02
    });
    const nailMat = new THREE.MeshStandardMaterial({
      color: '#f2d3c4',
      roughness: 0.35
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: '#e8dccb',
      roughness: 0.92
    });

    // Forearm & cozy knit sleeve (enters cleanly from portrait bottom-right edge)
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.056, 0.36, 14), sleeveMat);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, 0, 0.27);
    sleeve.castShadow = true;
    this.armPivot.add(sleeve);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.14, 14), skinMat);
    forearm.rotation.x = Math.PI / 2;
    forearm.position.set(0, 0, 0.08);
    forearm.castShadow = true;
    this.armPivot.add(forearm);

    this.wristPivot.position.set(0, 0, 0.01);
    this.armPivot.add(this.wristPivot);

    // Sculpted palm (anatomical rounded trapezium profile)
    const palmGeo = new THREE.BoxGeometry(0.088, 0.028, 0.098);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0, 0, -0.048);
    palm.castShadow = true;
    this.wristPivot.add(palm);

    const palmPad = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), skinMat);
    palmPad.scale.set(1.06, 0.42, 1.15);
    palmPad.position.set(0, -0.004, -0.05);
    this.wristPivot.add(palmPad);

    // 4 Articulated Fingers (Index, Middle, Ring, Pinky)
    const fingerSpecs = [
      { x: -0.032, len1: 0.044, len2: 0.034, r: 0.0095 },
      { x: -0.011, len1: 0.049, len2: 0.037, r: 0.0098 },
      { x: 0.011, len1: 0.046, len2: 0.035, r: 0.0094 },
      { x: 0.031, len1: 0.038, len2: 0.029, r: 0.0082 }
    ];

    for (const f of fingerSpecs) {
      const base = new THREE.Group();
      base.position.set(f.x, 0.002, -0.095);
      this.wristPivot.add(base);

      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(f.r, f.len1 * 0.65, 6, 10), skinMat);
      seg1.rotation.x = Math.PI / 2;
      seg1.position.set(0, 0, -f.len1 * 0.5);
      seg1.castShadow = true;
      base.add(seg1);

      const mid = new THREE.Group();
      mid.position.set(0, 0, -f.len1);
      base.add(mid);

      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(f.r * 0.88, f.len2 * 0.65, 6, 10), skinMat);
      seg2.rotation.x = Math.PI / 2;
      seg2.position.set(0, 0, -f.len2 * 0.5);
      seg2.castShadow = true;
      mid.add(seg2);

      const nail = new THREE.Mesh(new THREE.BoxGeometry(f.r * 1.2, 0.003, 0.012), nailMat);
      nail.position.set(0, f.r * 0.78, -f.len2 * 0.85);
      mid.add(nail);

      this.fingers.push({ base, mid });
    }

    // Articulated Opposable Thumb
    this.thumbBase.position.set(-0.046, -0.004, -0.038);
    this.thumbBase.rotation.y = 0.62;
    this.wristPivot.add(this.thumbBase);

    const tSeg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.028, 6, 10), skinMat);
    tSeg1.rotation.x = Math.PI / 2;
    tSeg1.position.set(0, 0, -0.022);
    this.thumbBase.add(tSeg1);

    this.thumbTip.position.set(0, 0, -0.042);
    this.thumbBase.add(this.thumbTip);
    const tSeg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.022, 6, 10), skinMat);
    tSeg2.rotation.x = Math.PI / 2;
    tSeg2.position.set(0, 0, -0.016);
    this.thumbTip.add(tSeg2);

    // --- HELD PROPS ---

    // 1. Grooming Brush
    const woodMat = new THREE.MeshStandardMaterial({ color: '#b9885b', roughness: 0.62 });
    const padMat = new THREE.MeshStandardMaterial({ color: '#4c4642', roughness: 0.9 });
    const bristleMat = new THREE.MeshStandardMaterial({ color: '#dfd6cb', roughness: 0.7 });
    const brushHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.14, 10), woodMat);
    brushHandle.rotation.x = Math.PI / 2;
    brushHandle.position.set(0, -0.028, -0.06);
    this.propBrush.add(brushHandle);
    const brushHead = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 10), woodMat);
    brushHead.scale.set(1.15, 0.4, 1.35);
    brushHead.position.set(0, -0.028, -0.155);
    this.propBrush.add(brushHead);
    const brushPad = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.014, 14), padMat);
    brushPad.position.set(0, -0.044, -0.155);
    this.propBrush.add(brushPad);
    for (let bx = -2; bx <= 2; bx++) {
      for (let bz = -2; bz <= 2; bz++) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.022, 5), bristleMat);
        pin.position.set(bx * 0.014, -0.056, -0.155 + bz * 0.014);
        this.propBrush.add(pin);
      }
    }
    this.propBrush.visible = false;
    this.wristPivot.add(this.propBrush);

    // 2. Water Pitcher + Animated Pouring Stream
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#dff2fa',
      roughness: 0.14,
      metalness: 0.08,
      transparent: true,
      opacity: 0.72
    });
    const pitcherBody = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.056, 0.15, 16), glassMat);
    pitcherBody.position.set(-0.01, -0.02, -0.11);
    this.propWaterPitcher.add(pitcherBody);
    const pitcherWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.1, 14),
      new THREE.MeshStandardMaterial({
        color: '#8bd0ec',
        transparent: true,
        opacity: 0.75,
        roughness: 0.1
      })
    );
    pitcherWater.position.set(-0.01, -0.04, -0.11);
    this.propWaterPitcher.add(pitcherWater);

    this.waterStreamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.014, 0.34, 10),
      new THREE.MeshStandardMaterial({
        color: '#a3dff5',
        transparent: true,
        opacity: 0.78,
        roughness: 0.08
      })
    );
    this.waterStreamMesh.position.set(-0.01, -0.22, -0.16);
    this.waterStreamMesh.visible = false;
    this.propWaterPitcher.add(this.waterStreamMesh);
    this.propWaterPitcher.visible = false;
    this.wristPivot.add(this.propWaterPitcher);

    // 3. Food Scoop / Container + Pouring Kibble Particles
    const scoopMat = new THREE.MeshStandardMaterial({ color: '#d87e58', roughness: 0.45 });
    const scoopCup = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.095, 14), scoopMat);
    scoopCup.position.set(0, -0.02, -0.12);
    this.propFoodContainer.add(scoopCup);

    const kibbleMat = new THREE.MeshStandardMaterial({ color: '#7d5232', roughness: 0.85 });
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), kibbleMat);
      p.visible = false;
      this.propFoodContainer.add(p);
      this.foodParticles.push(p);
    }
    this.propFoodContainer.visible = false;
    this.wristPivot.add(this.propFoodContainer);

    // 4. Kitten Milk Bottle (for newborn feeding!)
    const bottleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.028, 0.11, 14),
      new THREE.MeshStandardMaterial({ color: '#fff9ef', roughness: 0.3 })
    );
    bottleBody.rotation.x = Math.PI / 2;
    bottleBody.position.set(0, -0.022, -0.12);
    this.propMilkBottle.add(bottleBody);
    const nipple = new THREE.Mesh(
      new THREE.ConeGeometry(0.012, 0.034, 10),
      new THREE.MeshStandardMaterial({ color: '#f2c4a8', roughness: 0.4 })
    );
    nipple.rotation.x = -Math.PI / 2;
    nipple.position.set(0, -0.022, -0.19);
    this.propMilkBottle.add(nipple);
    this.propMilkBottle.visible = false;
    this.wristPivot.add(this.propMilkBottle);

    // 5. Litter Scoop
    const scoopGrayMat = new THREE.MeshStandardMaterial({ color: '#8f9aa3', roughness: 0.5 });
    const lHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.16, 10), scoopGrayMat);
    lHandle.rotation.x = Math.PI / 2;
    lHandle.position.set(0, -0.024, -0.09);
    this.propLitterScoop.add(lHandle);
    const lBasket = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.105), scoopGrayMat);
    lBasket.position.set(0, -0.028, -0.2);
    this.propLitterScoop.add(lBasket);
    this.propScoopClump = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#a89a84', roughness: 0.95 })
    );
    this.propScoopClump.position.set(0, -0.01, -0.2);
    this.propLitterScoop.add(this.propScoopClump);
    this.propLitterScoop.visible = false;
    this.wristPivot.add(this.propLitterScoop);
  }

  private hideAllProps(): void {
    this.propBrush.visible = false;
    this.propWaterPitcher.visible = false;
    this.waterStreamMesh.visible = false;
    this.propFoodContainer.visible = false;
    this.propMilkBottle.visible = false;
    this.propLitterScoop.visible = false;
    for (const p of this.foodParticles) p.visible = false;
  }

  private setFingerCurl(curlBase: number, curlTip: number, spread = 0.04): void {
    this.fingers.forEach((f, idx) => {
      f.base.rotation.x = curlBase;
      f.base.rotation.y = (idx - 1.5) * spread;
      f.mid.rotation.x = curlTip;
    });
    this.thumbBase.rotation.z = -curlBase * 0.45;
    this.thumbTip.rotation.x = curlTip * 0.6;
  }

  /**
   * Computes a camera-relative entry/exit anchor inside the mobile portrait edge
   * so the hand naturally reaches into frame from the player's side and exits cleanly.
   */
  private getScreenEdgeAnchor(camera: THREE.PerspectiveCamera, targetWorld: THREE.Vector3): THREE.Vector3 {
    const camPos = camera.position.clone();
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const camDown = new THREE.Vector3(0, -1, 0).applyQuaternion(camera.quaternion);
    const dir = targetWorld.clone().sub(camPos).normalize();
    return camPos
      .addScaledVector(dir, 0.55)
      .addScaledVector(camRight, 0.26)
      .addScaledVector(camDown, 0.22);
  }

  /**
   * Updates visible human hand animation every frame:
   * - Synchronizes with ActiveCareAction (start -> approach -> contact -> reaction -> exit)
   * - Also holds active feather wand smoothly while playing!
   */
  public update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    cat: CatRuntimeState,
    placedFurniture: PlacedFurniture[],
    activeCareAction: ActiveCareAction | null,
    activeToyTarget: { type: string; x: number; y: number; z: number } | null
  ): void {
    this.clock += dt;

    // MODE A: Player holding active Feather Wand while playing
    if (!activeCareAction && activeToyTarget && activeToyTarget.type === 'feather_wand') {
      this.root.visible = true;
      this.hideAllProps();
      this.setFingerCurl(-0.95, -0.85, 0.02);

      // Grip the wand rod handle positioned cleanly above & toward camera from feather tip
      const handleWorld = new THREE.Vector3(
        activeToyTarget.x + 0.14,
        Math.max(0.42, activeToyTarget.y + 0.42),
        activeToyTarget.z + 0.18
      );
      if (!this.wasVisible) {
        this.currentPos.copy(handleWorld);
      } else {
        this.currentPos.lerp(handleWorld, Math.min(1, dt * 14));
      }
      this.wasVisible = true;

      this.root.position.copy(this.currentPos);
      this.root.lookAt(activeToyTarget.x, activeToyTarget.y, activeToyTarget.z);
      this.wristPivot.rotation.set(0.2, 0, -0.15);
      return;
    }

    if (!activeCareAction) {
      this.root.visible = false;
      this.wasVisible = false;
      this.hideAllProps();
      return;
    }

    this.root.visible = true;
    this.hideAllProps();

    const nowMs = Date.now();
    const progress = clamp((nowMs - activeCareAction.startedAtMs) / activeCareAction.durationMs, 0, 1);
    const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
    const catHeadHeight = Math.max(0.18, 0.28 * metrics.bodyScale + 0.14);

    // Determine target world contact point for this specific interaction
    let targetWorld = new THREE.Vector3(
      cat.position.x,
      cat.position.y + catHeadHeight,
      cat.position.z
    );

    if (activeCareAction.targetInstanceId) {
      const furn = placedFurniture.find((f) => f.instanceId === activeCareAction.targetInstanceId);
      if (furn) {
        const yOff =
          furn.catalogId === 'auto_water_fountain'
            ? 0.44
            : furn.catalogId === 'auto_litter_box'
              ? 0.34
              : 0.34;
        targetWorld.set(furn.x, yOff, furn.z);
      }
    }

    // For newborn milk feeding, bring bottle gently to kitten's mouth instead of floor bowl
    if (activeCareAction.type === 'feed' && activeCareAction.foodId === 'kitten_milk') {
      targetWorld.set(cat.position.x, cat.position.y + 0.18, cat.position.z + 0.08);
    }

    const edgeAnchor = this.getScreenEdgeAnchor(camera, targetWorld);

    // 3-phase smooth curve: enter (0..0.28) -> interact (0.28..0.78) -> exit (0.78..1.0)
    let reachT = 0;
    if (activeCareAction.type === 'respect_space') {
      // Gentle open-palm withdrawal back out of frame!
      reachT = Math.max(0, 1 - progress * 1.45) * 0.55;
    } else if (activeCareAction.bitten && progress >= 0.42) {
      // Rapid human hand flinch back on rare defensive cat bite!
      const flinchT = clamp((progress - 0.42) / 0.22, 0, 1);
      reachT = 1 - flinchT;
    } else if (progress < 0.28) {
      const u = progress / 0.28;
      reachT = u * u * (3 - 2 * u);
    } else if (progress < 0.78) {
      reachT = 1;
    } else {
      const u = (progress - 0.78) / 0.22;
      reachT = 1 - u * u * (3 - 2 * u);
    }

    const pos = edgeAnchor.clone().lerp(targetWorld, reachT);
    let wristPitch = 0;
    let wristRoll = 0;
    let wristYaw = 0;
    const isInteracting = progress >= 0.26 && progress <= 0.78 && !activeCareAction.bitten;

    // Action-specific articulated poses & visible physical effects
    switch (activeCareAction.type) {
      case 'pet': {
        this.setFingerCurl(-0.28, -0.22, 0.05);
        pos.y += 0.06; // Stay smoothly on top of fur — never clip into skull!
        if (isInteracting) {
          const stroke = Math.sin(((progress - 0.26) / 0.52) * Math.PI * 4);
          pos.z += stroke * 0.075;
          pos.y += Math.abs(stroke) * 0.015;
          wristPitch = -0.18 + stroke * 0.16;
          this.setFingerCurl(-0.38 - Math.max(0, stroke) * 0.18, -0.25, 0.04);
        }
        if (activeCareAction.bitten) {
          // Shocked recoil curl
          this.setFingerCurl(-0.75, -0.8, 0.12);
          pos.y += 0.12;
          wristPitch = 0.55;
        }
        break;
      }

      case 'brush': {
        this.propBrush.visible = true;
        this.setFingerCurl(-0.85, -0.8, 0.02);
        pos.y += 0.09;
        if (isInteracting) {
          const sweep = Math.sin(((progress - 0.26) / 0.52) * Math.PI * 5);
          pos.z += sweep * 0.11;
          pos.x += Math.cos(sweep) * 0.025;
          wristPitch = -0.12;
          wristRoll = sweep * 0.15;
        }
        if (activeCareAction.bitten) {
          pos.y += 0.14;
          wristPitch = 0.6;
        }
        break;
      }

      case 'feed': {
        const isMilk = activeCareAction.foodId === 'kitten_milk';
        this.setFingerCurl(-0.85, -0.82, 0.02);
        if (isMilk) {
          this.propMilkBottle.visible = true;
          pos.y += 0.08;
          wristPitch = isInteracting ? -0.45 : -0.15;
        } else {
          this.propFoodContainer.visible = true;
          pos.y += 0.12;
          const tilt = isInteracting ? 0.95 : 0.1;
          wristRoll = tilt;
          // Animate visible 3D kibble falling from tilted food scoop into bowl!
          if (isInteracting) {
            this.foodParticles.forEach((p, idx) => {
              p.visible = true;
              const cycle = (this.clock * 2.8 + idx * 0.17) % 1;
              p.position.set(
                (idx % 3 - 1) * 0.018,
                -0.06 - cycle * 0.28,
                -0.15 + Math.sin(idx * 2.1) * 0.018
              );
            });
          }
        }
        break;
      }

      case 'water':
      case 'refill_fountain': {
        this.propWaterPitcher.visible = true;
        this.setFingerCurl(-0.88, -0.82, 0.02);
        pos.y += 0.14;
        wristPitch = isInteracting ? -0.58 : -0.1;
        this.waterStreamMesh.visible = isInteracting;
        if (isInteracting) {
          const shimmer = 0.9 + Math.sin(this.clock * 26) * 0.12;
          this.waterStreamMesh.scale.set(shimmer, 1, shimmer);
        }
        break;
      }

      case 'clean_litter':
      case 'empty_auto_litter':
      case 'clean_fountain':
      case 'clean_room': {
        this.propLitterScoop.visible =
          activeCareAction.type === 'clean_litter' || activeCareAction.type === 'empty_auto_litter';
        this.setFingerCurl(-0.82, -0.78, 0.02);
        if (isInteracting) {
          const scoopPhase = (progress - 0.26) / 0.52;
          const dip = Math.sin(scoopPhase * Math.PI);
          pos.y -= dip * 0.11;
          pos.z -= dip * 0.06;
          wristPitch = -0.35 + dip * 0.55;
          this.propScoopClump.visible = scoopPhase > 0.45;
        } else {
          this.propScoopClump.visible = false;
        }
        break;
      }

      case 'respect_space': {
        // Open calming hand stepping gracefully backward
        this.setFingerCurl(-0.08, -0.05, 0.09);
        wristPitch = 0.65;
        break;
      }

      case 'sleep': {
        this.setFingerCurl(-0.22, -0.16, 0.05);
        pos.y += 0.08;
        if (isInteracting) {
          pos.y -= Math.sin(((progress - 0.26) / 0.52) * Math.PI * 2) * 0.02;
        }
        break;
      }
    }

    this.root.position.copy(pos);
    // Orient hand naturally from camera perspective toward target
    const lookTarget = targetWorld.clone();
    lookTarget.y = pos.y - 0.08;
    this.root.lookAt(lookTarget);
    this.wristPivot.rotation.set(wristPitch, wristYaw, wristRoll);
    this.wasVisible = true;
  }
}
