import * as THREE from 'three';
import { getEyeColorHex, getHairColorHex, getSkinToneHex } from '../config/human';
import { clamp, computeGrowthMetrics, lerp } from '../simulation/growth';
import {
  ActiveCareAction,
  CatRuntimeState,
  HumanAppearance,
  HumanRuntimeState,
  PlacedFurniture
} from '../types/game';

/**
 * Full-Body Articulated 3D Playable Human Character Rig.
 *
 * Replaces the obsolete floating-hand system with a complete, physically grounded
 * third-person humanoid character with skeletal pivots (pelvis, spine, chest, neck, head,
 * shoulders, elbows, hands, hips, knees, feet), customizable appearance (gender/body
 * presentation, 7 skin tones, 10 hairstyles, 9 hair colors, 5 eye shapes + size + 6 colors,
 * 5 mouth shapes + lip colors, 5 tops, 6 bottoms, 4 footwear styles + custom outfit colors),
 * and synchronized full-body interaction animations with attached hand props.
 *
 * NOTE: Built with clean procedural Three.js skeletal hierarchy for mobile WebGL performance
 * without unlicensed third-party models; documented in ASSETS_MANIFEST.md for optional `.glb` swap.
 */
export class HumanCharacterRig {
  public readonly root = new THREE.Group();

  // Skeletal hierarchy
  private readonly pelvisPivot = new THREE.Group();
  private readonly spinePivot = new THREE.Group();
  private readonly chestPivot = new THREE.Group();
  private readonly neckPivot = new THREE.Group();
  private readonly headGroup = new THREE.Group();

  private readonly leftShoulder = new THREE.Group();
  private readonly leftElbow = new THREE.Group();
  private readonly leftHand = new THREE.Group();

  private readonly rightShoulder = new THREE.Group();
  private readonly rightElbow = new THREE.Group();
  private readonly rightHand = new THREE.Group();

  private readonly leftHip = new THREE.Group();
  private readonly leftKnee = new THREE.Group();
  private readonly leftFoot = new THREE.Group();

  private readonly rightHip = new THREE.Group();
  private readonly rightKnee = new THREE.Group();
  private readonly rightFoot = new THREE.Group();

  // Dynamic visual sub-groups rebuilt on customization change
  private readonly hairGroup = new THREE.Group();
  private readonly faceGroup = new THREE.Group();
  private readonly topMeshGroup = new THREE.Group();
  private readonly leftUpperSleeveGroup = new THREE.Group();
  private readonly leftLowerSleeveGroup = new THREE.Group();
  private readonly rightUpperSleeveGroup = new THREE.Group();
  private readonly rightLowerSleeveGroup = new THREE.Group();
  private readonly bottomPelvisGroup = new THREE.Group();
  private readonly leftThighClothGroup = new THREE.Group();
  private readonly leftShinClothGroup = new THREE.Group();
  private readonly rightThighClothGroup = new THREE.Group();
  private readonly rightShinClothGroup = new THREE.Group();
  private readonly leftShoeGroup = new THREE.Group();
  private readonly rightShoeGroup = new THREE.Group();

  // Facial animation refs
  private leftEyelid: THREE.Mesh | null = null;
  private rightEyelid: THREE.Mesh | null = null;

  // Carry cradle anchor in chest space
  private readonly carryAnchor = new THREE.Object3D();

  // Attached right-hand care props
  private readonly propSocket = new THREE.Group();
  private readonly propBrush = new THREE.Group();
  private readonly propWaterPitcher = new THREE.Group();
  private readonly waterStreamMesh: THREE.Mesh;
  private readonly propFoodContainer = new THREE.Group();
  private readonly propMilkBottle = new THREE.Group();
  private readonly foodParticles: THREE.Mesh[] = [];
  private readonly propLitterScoop = new THREE.Group();
  private readonly propScoopClump: THREE.Mesh;

  // Shared materials updated dynamically
  private readonly skinMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.02 });
  private readonly hairMat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.05 });
  private readonly topMat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.02 });
  private readonly bottomMat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.02 });
  private readonly shoeMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 });
  private readonly soleMat = new THREE.MeshStandardMaterial({ color: '#ece7df', roughness: 0.85 });

  // Base body meshes whose proportions adapt subtly to gender presentation
  private readonly torsoCore: THREE.Mesh;
  private readonly pelvisMesh: THREE.Mesh;

  private appearanceKey = '';
  private clock = 0;
  private walkCycle = 0;
  private blinkTimer = 3.2;
  private blinkAmount = 0;

  // Smooth posture blends
  private crouchBlend = 0;
  private bendBlend = 0;

  constructor(initialAppearance: HumanAppearance) {
    this.root.name = 'human_character_root';

    // Pelvis sits at standing hip height (~0.88m)
    this.pelvisPivot.position.set(0, 0.88, 0);
    this.root.add(this.pelvisPivot);

    this.pelvisMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.115, 0.08, 8, 14),
      this.bottomMat
    );
    this.pelvisMesh.rotation.z = Math.PI / 2;
    this.pelvisMesh.scale.set(0.85, 1.0, 0.78);
    this.pelvisMesh.castShadow = true;
    this.pelvisPivot.add(this.pelvisMesh);
    this.pelvisPivot.add(this.bottomPelvisGroup);

    // Spine -> Chest -> Neck -> Head
    this.spinePivot.position.set(0, 0.05, 0);
    this.pelvisPivot.add(this.spinePivot);

    this.chestPivot.position.set(0, 0.24, 0);
    this.spinePivot.add(this.chestPivot);

    this.torsoCore = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.125, 0.24, 10, 16),
      this.topMat
    );
    this.torsoCore.position.set(0, 0.04, 0);
    this.torsoCore.scale.set(1.12, 1.0, 0.76);
    this.torsoCore.castShadow = true;
    this.torsoCore.receiveShadow = true;
    this.chestPivot.add(this.torsoCore);
    this.chestPivot.add(this.topMeshGroup);

    // Carry anchor in front of chest for cradling the cat smoothly
    this.carryAnchor.position.set(0, -0.02, 0.27);
    this.chestPivot.add(this.carryAnchor);

    // Neck & Head
    this.neckPivot.position.set(0, 0.245, 0.005);
    this.chestPivot.add(this.neckPivot);

    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.052, 0.09, 12),
      this.skinMat
    );
    neckMesh.position.set(0, 0.04, 0);
    neckMesh.castShadow = true;
    this.neckPivot.add(neckMesh);

    this.headGroup.position.set(0, 0.165, 0.008);
    this.neckPivot.add(this.headGroup);

    // Sculpted human head + jawline + ears + nose
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.106, 20, 18), this.skinMat);
    cranium.scale.set(0.92, 1.08, 0.96);
    cranium.castShadow = true;
    this.headGroup.add(cranium);

    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), this.skinMat);
    chin.position.set(0, -0.055, 0.026);
    chin.scale.set(0.92, 0.85, 0.88);
    this.headGroup.add(chin);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.032, 6), this.skinMat);
    nose.position.set(0, -0.008, 0.102);
    nose.rotation.x = Math.PI * 0.42;
    this.headGroup.add(nose);

    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), this.skinMat);
      ear.scale.set(0.45, 1.15, 0.72);
      ear.position.set(side * 0.098, -0.004, -0.005);
      this.headGroup.add(ear);
    }

    this.headGroup.add(this.faceGroup);
    this.headGroup.add(this.hairGroup);

    // Arms (Left & Right)
    this.buildArm(
      -1,
      this.leftShoulder,
      this.leftElbow,
      this.leftHand,
      this.leftUpperSleeveGroup,
      this.leftLowerSleeveGroup
    );
    this.buildArm(
      1,
      this.rightShoulder,
      this.rightElbow,
      this.rightHand,
      this.rightUpperSleeveGroup,
      this.rightLowerSleeveGroup
    );

    // Attach prop socket to right hand
    this.propSocket.position.set(0, -0.065, 0.035);
    this.rightHand.add(this.propSocket);

    // Legs (Left & Right)
    this.buildLeg(
      -1,
      this.leftHip,
      this.leftKnee,
      this.leftFoot,
      this.leftThighClothGroup,
      this.leftShinClothGroup,
      this.leftShoeGroup
    );
    this.buildLeg(
      1,
      this.rightHip,
      this.rightKnee,
      this.rightFoot,
      this.rightThighClothGroup,
      this.rightShinClothGroup,
      this.rightShoeGroup
    );

    // Build attached physical care props inside right hand socket
    const propsBuilt = this.buildCareProps();
    this.waterStreamMesh = propsBuilt.waterStream;
    this.propScoopClump = propsBuilt.scoopClump;

    this.applyAppearance(initialAppearance);
  }

  private buildArm(
    side: -1 | 1,
    shoulder: THREE.Group,
    elbow: THREE.Group,
    hand: THREE.Group,
    upperSleeve: THREE.Group,
    lowerSleeve: THREE.Group
  ): void {
    shoulder.position.set(side * 0.178, 0.185, 0);
    this.chestPivot.add(shoulder);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, 0.19, 8, 12),
      this.skinMat
    );
    upperArm.position.set(0, -0.125, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);
    shoulder.add(upperSleeve);

    elbow.position.set(0, -0.255, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.032, 0.18, 8, 12),
      this.skinMat
    );
    forearm.position.set(0, -0.115, 0);
    forearm.castShadow = true;
    elbow.add(forearm);
    elbow.add(lowerSleeve);

    hand.position.set(0, -0.235, 0);
    elbow.add(hand);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.068, 0.028), this.skinMat);
    palm.position.set(0, -0.032, 0.004);
    palm.castShadow = true;
    hand.add(palm);

    const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.032, 6, 8), this.skinMat);
    fingers.position.set(0, -0.072, 0.01);
    fingers.scale.set(1.1, 1.0, 0.55);
    hand.add(fingers);
  }

  private buildLeg(
    side: -1 | 1,
    hip: THREE.Group,
    knee: THREE.Group,
    foot: THREE.Group,
    thighCloth: THREE.Group,
    shinCloth: THREE.Group,
    shoeGroup: THREE.Group
  ): void {
    hip.position.set(side * 0.088, -0.02, 0);
    this.pelvisPivot.add(hip);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.056, 0.31, 8, 12),
      this.skinMat
    );
    thigh.position.set(0, -0.205, 0);
    thigh.castShadow = true;
    hip.add(thigh);
    hip.add(thighCloth);

    knee.position.set(0, -0.415, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.043, 0.31, 8, 12),
      this.skinMat
    );
    shin.position.set(0, -0.2, 0);
    shin.castShadow = true;
    knee.add(shin);
    knee.add(shinCloth);

    foot.position.set(0, -0.405, 0.02);
    knee.add(foot);
    foot.add(shoeGroup);
  }

  private buildCareProps(): { waterStream: THREE.Mesh; scoopClump: THREE.Mesh } {
    // 1. Grooming Brush
    const woodMat = new THREE.MeshStandardMaterial({ color: '#b9885b', roughness: 0.6 });
    const padMat = new THREE.MeshStandardMaterial({ color: '#4c4642', roughness: 0.9 });
    const bristleMat = new THREE.MeshStandardMaterial({ color: '#e4dcd1', roughness: 0.7 });
    const bHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.13, 10), woodMat);
    bHandle.rotation.x = Math.PI / 2;
    bHandle.position.set(0, 0, 0.04);
    this.propBrush.add(bHandle);
    const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), woodMat);
    bHead.scale.set(1.1, 0.38, 1.35);
    bHead.position.set(0, 0, 0.125);
    this.propBrush.add(bHead);
    const bPad = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.014, 12), padMat);
    bPad.position.set(0, -0.016, 0.125);
    this.propBrush.add(bPad);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.018, 4), bristleMat);
        pin.position.set(i * 0.018, -0.028, 0.125 + j * 0.02);
        this.propBrush.add(pin);
      }
    }
    this.propBrush.visible = false;
    this.propSocket.add(this.propBrush);

    // 2. Water Pitcher + Animated Pour Stream
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#dff2fa',
      roughness: 0.14,
      metalness: 0.08,
      transparent: true,
      opacity: 0.76
    });
    const pitcher = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.058, 0.16, 14), glassMat);
    pitcher.position.set(0, 0.01, 0.07);
    this.propWaterPitcher.add(pitcher);
    const pitcherWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.052, 0.11, 12),
      new THREE.MeshStandardMaterial({
        color: '#82cceb',
        transparent: true,
        opacity: 0.78,
        roughness: 0.1
      })
    );
    pitcherWater.position.set(0, -0.015, 0.07);
    this.propWaterPitcher.add(pitcherWater);
    const waterStream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.015, 0.36, 8),
      new THREE.MeshStandardMaterial({
        color: '#a3dff5',
        transparent: true,
        opacity: 0.8,
        roughness: 0.08
      })
    );
    waterStream.position.set(0, -0.18, 0.14);
    waterStream.visible = false;
    this.propWaterPitcher.add(waterStream);
    this.propWaterPitcher.visible = false;
    this.propSocket.add(this.propWaterPitcher);

    // 3. Food Scoop Container + Pouring Kibble
    const scoopMat = new THREE.MeshStandardMaterial({ color: '#d87e58', roughness: 0.45 });
    const foodCup = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.04, 0.11, 14), scoopMat);
    foodCup.position.set(0, 0, 0.07);
    this.propFoodContainer.add(foodCup);
    const kibbleMat = new THREE.MeshStandardMaterial({ color: '#7d5232', roughness: 0.85 });
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), kibbleMat);
      p.visible = false;
      this.propFoodContainer.add(p);
      this.foodParticles.push(p);
    }
    this.propFoodContainer.visible = false;
    this.propSocket.add(this.propFoodContainer);

    // 4. Kitten Milk Bottle
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.028, 0.11, 12),
      new THREE.MeshStandardMaterial({ color: '#fff9ef', roughness: 0.3 })
    );
    bottle.rotation.x = Math.PI / 2;
    bottle.position.set(0, 0, 0.07);
    this.propMilkBottle.add(bottle);
    const nipple = new THREE.Mesh(
      new THREE.ConeGeometry(0.012, 0.032, 10),
      new THREE.MeshStandardMaterial({ color: '#f2c4a8', roughness: 0.4 })
    );
    nipple.rotation.x = Math.PI / 2;
    nipple.position.set(0, 0, 0.14);
    this.propMilkBottle.add(nipple);
    this.propMilkBottle.visible = false;
    this.propSocket.add(this.propMilkBottle);

    // 5. Litter Scoop
    const scoopGray = new THREE.MeshStandardMaterial({ color: '#8f9aa3', roughness: 0.5 });
    const lHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.18, 8), scoopGray);
    lHandle.rotation.x = Math.PI / 2;
    lHandle.position.set(0, 0, 0.06);
    this.propLitterScoop.add(lHandle);
    const lBasket = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.11), scoopGray);
    lBasket.position.set(0, -0.008, 0.18);
    this.propLitterScoop.add(lBasket);
    const scoopClump = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#a89a84', roughness: 0.95 })
    );
    scoopClump.position.set(0, 0.012, 0.18);
    this.propLitterScoop.add(scoopClump);
    this.propLitterScoop.visible = false;
    this.propSocket.add(this.propLitterScoop);

    return { waterStream, scoopClump };
  }

  private clearGroup(g: THREE.Group): void {
    while (g.children.length > 0) {
      g.remove(g.children[0]);
    }
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

  public applyAppearance(app: HumanAppearance): void {
    const key = JSON.stringify(app);
    if (key === this.appearanceKey) return;
    this.appearanceKey = key;

    const skinHex = getSkinToneHex(app.skinTone);
    const hairHex = getHairColorHex(app.hairColor);
    const eyeHex = getEyeColorHex(app.eyeColor);

    this.skinMat.color.set(skinHex);
    this.hairMat.color.set(hairHex);
    this.topMat.color.set(app.topColor);
    this.bottomMat.color.set(app.bottomColor);
    this.shoeMat.color.set(app.footwearColor);

    // Body presentation proportions (male vs female, compatible with ALL clothing!)
    const isMale = app.gender === 'male';
    this.root.scale.setScalar(isMale ? 1.03 : 0.97);
    this.torsoCore.scale.set(isMale ? 1.2 : 1.04, 1.0, isMale ? 0.8 : 0.74);
    this.pelvisMesh.scale.set(isMale ? 0.84 : 0.94, 1.0, isMale ? 0.78 : 0.84);
    this.leftShoulder.position.x = isMale ? -0.19 : -0.165;
    this.rightShoulder.position.x = isMale ? 0.19 : 0.165;

    this.rebuildFace(app, eyeHex);
    this.rebuildHair(app);
    this.rebuildTop(app);
    this.rebuildBottom(app);
    this.rebuildFootwear(app);
  }

  private rebuildFace(app: HumanAppearance, eyeHex: string): void {
    this.clearGroup(this.faceGroup);
    const scleraMat = new THREE.MeshStandardMaterial({ color: '#faf8f5', roughness: 0.25 });
    const irisMat = new THREE.MeshStandardMaterial({ color: eyeHex, roughness: 0.16, metalness: 0.08 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#111116', roughness: 0.05 });
    const browMat = new THREE.MeshStandardMaterial({ color: getHairColorHex(app.hairColor), roughness: 0.8 });
    const lipMat = new THREE.MeshStandardMaterial({ color: app.lipColor, roughness: 0.45 });

    const sz = clamp(app.eyeSize, 0.85, 1.18);
    let sx = 1.0 * sz;
    let sy = 1.0 * sz;
    let tilt = 0;
    if (app.eyeShape === 'almond') {
      sx = 1.15 * sz;
      sy = 0.84 * sz;
    } else if (app.eyeShape === 'round') {
      sx = 1.02 * sz;
      sy = 1.08 * sz;
    } else if (app.eyeShape === 'hooded') {
      sx = 1.08 * sz;
      sy = 0.76 * sz;
    } else if (app.eyeShape === 'upturned') {
      sx = 1.12 * sz;
      sy = 0.86 * sz;
      tilt = 0.18;
    } else if (app.eyeShape === 'wide') {
      sx = 1.14 * sz;
      sy = 1.12 * sz;
    }

    const buildEye = (side: -1 | 1) => {
      const g = new THREE.Group();
      g.position.set(side * 0.036, 0.012, 0.09);
      g.rotation.y = side * 0.16;
      g.rotation.z = side * tilt;

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), scleraMat);
      sclera.scale.set(sx, sy, 0.45);
      g.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0102, 12, 10), irisMat);
      iris.scale.set(0.95 * sz, 0.95 * sz, 0.45);
      iris.position.set(0, 0, 0.0052);
      g.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 8, 8), pupilMat);
      pupil.position.set(0, 0, 0.0085);
      g.add(pupil);

      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.0024, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      glint.position.set(0.003, 0.003, 0.0105);
      g.add(glint);

      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 10, 8), this.skinMat);
      lid.scale.set(sx * 1.05, sy * 1.05, 0.54);
      lid.position.set(0, 0, 0.0012);
      lid.visible = false;
      g.add(lid);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.006, 0.007), browMat);
      brow.position.set(0, 0.022, 0.004);
      brow.rotation.z = side * -0.08;
      g.add(brow);

      this.faceGroup.add(g);
      return lid;
    };

    this.leftEyelid = buildEye(-1);
    this.rightEyelid = buildEye(1);

    // Mouth shapes
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.044, 0.092);
    if (app.mouthShape === 'smile') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0048, 8, 14, Math.PI), lipMat);
      m.rotation.z = Math.PI;
      m.position.y = 0.008;
      mouthGroup.add(m);
    } else if (app.mouthShape === 'full') {
      const upper = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), lipMat);
      upper.scale.set(1.65, 0.56, 0.55);
      upper.position.y = 0.004;
      const lower = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), lipMat);
      lower.scale.set(1.5, 0.65, 0.55);
      lower.position.y = -0.005;
      mouthGroup.add(upper, lower);
    } else if (app.mouthShape === 'thin') {
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.0036, 0.026, 6, 8), lipMat);
      bar.rotation.z = Math.PI / 2;
      mouthGroup.add(bar);
    } else if (app.mouthShape === 'gentle') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0042, 8, 12, Math.PI * 0.78), lipMat);
      m.rotation.z = Math.PI * 1.11;
      m.position.y = 0.006;
      mouthGroup.add(m);
    } else {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.024, 6, 10), lipMat);
      m.rotation.z = Math.PI / 2;
      mouthGroup.add(m);
    }
    this.faceGroup.add(mouthGroup);
  }

  private rebuildHair(app: HumanAppearance): void {
    this.clearGroup(this.hairGroup);

    // Base scalp cap shared across hairstyles
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.112, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      this.hairMat
    );
    cap.scale.set(0.95, 1.08, 0.99);
    cap.position.set(0, 0.008, -0.005);
    cap.castShadow = true;
    this.hairGroup.add(cap);

    const style = app.hairStyle;
    if (style === 'buzz') {
      cap.scale.set(0.93, 1.05, 0.96);
      return;
    }

    // Back crown cover
    const backCrown = new THREE.Mesh(new THREE.SphereGeometry(0.108, 16, 12), this.hairMat);
    backCrown.scale.set(0.95, 1.02, 0.85);
    backCrown.position.set(0, -0.008, -0.025);
    this.hairGroup.add(backCrown);

    if (style === 'short' || style === 'side_part') {
      const topSweep = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 10), this.hairMat);
      topSweep.scale.set(1.15, 0.55, 1.12);
      topSweep.position.set(style === 'side_part' ? 0.02 : 0, 0.095, 0.015);
      topSweep.rotation.z = style === 'side_part' ? -0.18 : 0;
      this.hairGroup.add(topSweep);
      if (style === 'side_part') {
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.036, 0.045), this.hairMat);
        fringe.position.set(0.025, 0.072, 0.078);
        fringe.rotation.z = -0.22;
        this.hairGroup.add(fringe);
      }
    } else if (style === 'bob') {
      for (const side of [-1, 1] as const) {
        const panel = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.13, 8, 10), this.hairMat);
        panel.position.set(side * 0.088, -0.035, 0.01);
        panel.rotation.z = side * 0.08;
        this.hairGroup.add(panel);
      }
      const backBob = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.108, 0.16, 14), this.hairMat);
      backBob.position.set(0, -0.045, -0.035);
      this.hairGroup.add(backBob);
    } else if (style === 'medium' || style === 'long' || style === 'wavy') {
      const len = style === 'medium' ? 0.24 : 0.4;
      const backCurtain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.102, style === 'wavy' ? 0.132 : 0.118, len, 14),
        this.hairMat
      );
      backCurtain.scale.set(1.02, 1, 0.65);
      backCurtain.position.set(0, -len * 0.42 - 0.01, -0.048);
      backCurtain.castShadow = true;
      this.hairGroup.add(backCurtain);

      for (const side of [-1, 1] as const) {
        const lock = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.036, len * 0.62, 8, 10),
          this.hairMat
        );
        lock.position.set(side * 0.095, -len * 0.26, 0.015);
        if (style === 'wavy') {
          lock.rotation.z = side * 0.14;
          const wave = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), this.hairMat);
          wave.position.set(side * 0.105, -len * 0.56, 0.005);
          this.hairGroup.add(wave);
        }
        this.hairGroup.add(lock);
      }
    } else if (style === 'ponytail') {
      const tie = new THREE.Mesh(
        new THREE.TorusGeometry(0.028, 0.008, 8, 12),
        new THREE.MeshStandardMaterial({ color: app.topColor, roughness: 0.7 })
      );
      tie.position.set(0, 0.04, -0.108);
      this.hairGroup.add(tie);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.24, 8, 12), this.hairMat);
      tail.position.set(0, -0.08, -0.135);
      tail.rotation.x = 0.28;
      tail.castShadow = true;
      this.hairGroup.add(tail);
    } else if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), this.hairMat);
      bun.position.set(0, 0.125, -0.035);
      bun.castShadow = true;
      this.hairGroup.add(bun);
    } else if (style === 'curly') {
      const curlOffsets = [
        [0, 0.105, 0.02],
        [-0.075, 0.08, 0.02],
        [0.075, 0.08, 0.02],
        [-0.1, 0.02, -0.01],
        [0.1, 0.02, -0.01],
        [-0.095, -0.045, -0.02],
        [0.095, -0.045, -0.02],
        [0, 0.06, -0.085],
        [-0.065, -0.01, -0.085],
        [0.065, -0.01, -0.085]
      ];
      for (const [cx, cy, cz] of curlOffsets) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), this.hairMat);
        puff.position.set(cx, cy, cz);
        puff.castShadow = true;
        this.hairGroup.add(puff);
      }
    }
  }

  private rebuildTop(app: HumanAppearance): void {
    this.clearGroup(this.topMeshGroup);
    this.clearGroup(this.leftUpperSleeveGroup);
    this.clearGroup(this.leftLowerSleeveGroup);
    this.clearGroup(this.rightUpperSleeveGroup);
    this.clearGroup(this.rightLowerSleeveGroup);

    const style = app.topStyle;
    const isShortSleeve = style === 'tshirt';
    const sleeveRadiusUpper = style === 'hoodie' || style === 'sweater' ? 0.048 : 0.044;
    const sleeveRadiusLower = style === 'hoodie' || style === 'sweater' ? 0.041 : 0.037;

    // Upper sleeves
    for (const grp of [this.leftUpperSleeveGroup, this.rightUpperSleeveGroup]) {
      const s = new THREE.Mesh(
        new THREE.CapsuleGeometry(sleeveRadiusUpper, isShortSleeve ? 0.09 : 0.19, 8, 12),
        this.topMat
      );
      s.position.set(0, isShortSleeve ? -0.065 : -0.125, 0);
      s.castShadow = true;
      grp.add(s);
    }

    // Lower sleeves for long-sleeve tops
    if (!isShortSleeve) {
      for (const grp of [this.leftLowerSleeveGroup, this.rightLowerSleeveGroup]) {
        const s = new THREE.Mesh(
          new THREE.CapsuleGeometry(sleeveRadiusLower, 0.16, 8, 12),
          this.topMat
        );
        s.position.set(0, -0.105, 0);
        s.castShadow = true;
        grp.add(s);
      }
    }

    // Style-specific details on torso
    if (style === 'hoodie') {
      const hood = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.036, 10, 16), this.topMat);
      hood.rotation.x = Math.PI * 0.45;
      hood.position.set(0, 0.21, -0.045);
      this.topMeshGroup.add(hood);

      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.025), this.topMat);
      pocket.position.set(0, -0.07, 0.096);
      this.topMeshGroup.add(pocket);
    } else if (style === 'casual_shirt') {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.068, 0.015, 8, 14),
        this.topMat
      );
      collar.rotation.x = Math.PI * 0.48;
      collar.position.set(0, 0.22, 0.01);
      this.topMeshGroup.add(collar);
      const btnMat = new THREE.MeshStandardMaterial({ color: '#f3eee7', roughness: 0.4 });
      for (let i = 0; i < 4; i++) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), btnMat);
        btn.position.set(0, 0.13 - i * 0.06, 0.102);
        this.topMeshGroup.add(btn);
      }
    } else if (style === 'sweater') {
      const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.128, 0.055, 16), this.topMat);
      hem.scale.set(1.06, 1, 0.78);
      hem.position.set(0, -0.13, 0);
      this.topMeshGroup.add(hem);
    }
  }

  private rebuildBottom(app: HumanAppearance): void {
    this.clearGroup(this.bottomPelvisGroup);
    this.clearGroup(this.leftThighClothGroup);
    this.clearGroup(this.leftShinClothGroup);
    this.clearGroup(this.rightThighClothGroup);
    this.clearGroup(this.rightShinClothGroup);

    const style = app.bottomStyle;
    if (style === 'skirt' || style === 'pleated_skirt') {
      const skirtLen = style === 'pleated_skirt' ? 0.34 : 0.3;
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.132, style === 'pleated_skirt' ? 0.215 : 0.178, skirtLen, style === 'pleated_skirt' ? 14 : 18),
        this.bottomMat
      );
      skirt.scale.set(1.04, 1, 0.84);
      skirt.position.set(0, -skirtLen * 0.44, 0);
      skirt.castShadow = true;
      this.bottomPelvisGroup.add(skirt);
      return;
    }

    const isShorts = style === 'shorts';
    const thighRadius = style === 'casual_pants' || style === 'long_pants' ? 0.066 : 0.062;
    const shinRadius = style === 'jeans' ? 0.049 : 0.055;

    for (const grp of [this.leftThighClothGroup, this.rightThighClothGroup]) {
      const t = new THREE.Mesh(
        new THREE.CapsuleGeometry(thighRadius, isShorts ? 0.16 : 0.32, 8, 12),
        this.bottomMat
      );
      t.position.set(0, isShorts ? -0.12 : -0.205, 0);
      t.castShadow = true;
      grp.add(t);
    }

    if (!isShorts) {
      for (const grp of [this.leftShinClothGroup, this.rightShinClothGroup]) {
        const s = new THREE.Mesh(
          new THREE.CapsuleGeometry(shinRadius, 0.3, 8, 12),
          this.bottomMat
        );
        s.position.set(0, -0.195, 0);
        s.castShadow = true;
        grp.add(s);
      }
    }
  }

  private rebuildFootwear(app: HumanAppearance): void {
    this.clearGroup(this.leftShoeGroup);
    this.clearGroup(this.rightShoeGroup);

    const style = app.footwearStyle;
    for (const grp of [this.leftShoeGroup, this.rightShoeGroup]) {
      if (style === 'sandals') {
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.02, 0.2), this.soleMat);
        sole.position.set(0, -0.028, 0.035);
        grp.add(sole);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.032, 0.17), this.skinMat);
        foot.position.set(0, -0.008, 0.035);
        grp.add(foot);
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.022, 0.045), this.shoeMat);
        strap.position.set(0, 0.004, 0.065);
        grp.add(strap);
      } else if (style === 'slippers') {
        const base = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.11, 6, 10), this.shoeMat);
        base.rotation.x = Math.PI / 2;
        base.scale.set(1.05, 0.72, 1.0);
        base.position.set(0, -0.015, 0.035);
        base.castShadow = true;
        grp.add(base);
      } else {
        // Sneakers or Casual Shoes
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.024, 0.215), this.soleMat);
        sole.position.set(0, -0.028, 0.04);
        grp.add(sole);
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.056, 0.195), this.shoeMat);
        upper.position.set(0, 0.004, 0.038);
        upper.castShadow = true;
        grp.add(upper);
      }
    }
  }

  /**
   * Returns world coordinates of the human's right hand grip point (used to attach toys cleanly).
   */
  public getRightHandWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.propSocket.getWorldPosition(target);
  }

  /**
   * Returns world coordinates of the chest cradle anchor (used when carrying the cat).
   */
  public getCarryWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.carryAnchor.getWorldPosition(target);
  }

  /**
   * Live 3D preview idle pose used inside the Human Character Creator & Wardrobe screen.
   */
  public updatePreview(appearance: HumanAppearance, dt: number): void {
    this.applyAppearance(appearance);
    this.hideAllProps();
    this.clock += dt;

    this.root.position.set(0, 0, 0);
    this.pelvisPivot.position.set(0, 0.88, 0);
    this.pelvisPivot.rotation.set(0, 0, 0);
    this.spinePivot.rotation.set(0, 0, 0);
    this.chestPivot.rotation.set(0, Math.sin(this.clock * 0.9) * 0.04, 0);
    this.neckPivot.rotation.set(0.02, Math.sin(this.clock * 0.7) * 0.09, 0);

    const breathe = Math.sin(this.clock * 2.2) * 0.015;
    this.leftShoulder.rotation.set(0.04 + breathe, 0, 0.09);
    this.rightShoulder.rotation.set(0.04 + breathe, 0, -0.09);
    this.leftElbow.rotation.set(-0.14, 0, 0);
    this.rightElbow.rotation.set(-0.14, 0, 0);
    this.leftHand.rotation.set(0, 0, 0);
    this.rightHand.rotation.set(0, 0, 0);

    this.leftHip.rotation.set(0, 0, 0.03);
    this.rightHip.rotation.set(0, 0, -0.03);
    this.leftKnee.rotation.set(0, 0, 0);
    this.rightKnee.rotation.set(0, 0, 0);
    this.leftFoot.rotation.set(0, 0, 0);
    this.rightFoot.rotation.set(0, 0, 0);

    this.updateBlinking(dt);
  }

  private updateBlinking(dt: number): void {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.8 + Math.random() * 3.4;
      this.blinkAmount = 1;
    }
    this.blinkAmount = Math.max(0, this.blinkAmount - dt * 7.5);
    const closed = this.blinkAmount > 0.35;
    if (this.leftEyelid) this.leftEyelid.visible = closed;
    if (this.rightEyelid) this.rightEyelid.visible = closed;
  }

  /**
   * Main third-person gameplay animation update driven by HumanRuntimeState,
   * active care action phase/progress, cat state, and active interactive toy.
   */
  public update(
    dt: number,
    appearance: HumanAppearance,
    human: HumanRuntimeState,
    cat: CatRuntimeState,
    _placedFurniture: PlacedFurniture[],
    activeCareAction: ActiveCareAction | null,
    activeToyTarget: { type: string; x: number; y: number; z: number } | null
  ): void {
    this.applyAppearance(appearance);
    this.clock += dt;
    this.hideAllProps();
    this.updateBlinking(dt);

    // Position & facing in room
    this.root.position.set(human.position.x, human.position.y, human.position.z);
    this.root.rotation.y = human.rotationY;

    const speed = Math.hypot(human.velocity.x, human.velocity.z);
    const isWalking = speed > 0.05 || human.animState === 'walk';
    if (isWalking) {
      this.walkCycle += dt * Math.max(3.5, speed * 5.6);
    }

    // Determine performing progress (0..1) inside the active action's performing phase
    let perfT = 0;
    const isPerforming = activeCareAction?.phase === 'performing';
    if (activeCareAction && isPerforming) {
      perfT = clamp((Date.now() - activeCareAction.phaseStartedAtMs) / activeCareAction.durationMs, 0, 1);
    }

    // Target pose parameters
    let targetCrouch = 0;
    let targetBend = 0;
    let lShoulderX = 0.04;
    let lShoulderZ = 0.08;
    let lElbowX = -0.14;
    let rShoulderX = 0.04;
    let rShoulderZ = -0.08;
    let rElbowX = -0.14;
    let rHandX = 0;
    let rHandZ = 0;

    // 1. Walking locomotion cycle
    if (isWalking) {
      const swing = Math.sin(this.walkCycle);
      lShoulderX = -swing * 0.44;
      rShoulderX = swing * 0.44;
      lElbowX = -0.22 - Math.max(0, -swing) * 0.25;
      rElbowX = -0.22 - Math.max(0, swing) * 0.25;
    }

    // 2. Active interactive toy (holding Feather Wand in right hand while cat plays!)
    if (!isPerforming && activeToyTarget && activeToyTarget.type === 'feather_wand') {
      const localToy = this.root.worldToLocal(
        new THREE.Vector3(activeToyTarget.x, activeToyTarget.y, activeToyTarget.z)
      );
      const sway = Math.sin(this.clock * 4.5) * 0.12;
      rShoulderX = clamp(-0.95 + localToy.y * 0.4, -1.35, -0.55);
      rShoulderZ = clamp(-localToy.x * 0.35 - 0.12 + sway, -0.65, 0.25);
      rElbowX = -0.45;
      targetBend = 0.14;
    }

    // 3. Synchronized Full-Body Interaction Animations!
    if (activeCareAction && isPerforming) {
      const type = activeCareAction.type;
      const midPhase = perfT >= 0.15 && perfT <= 0.85;
      const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
      const catLowFactor = clamp(1.05 - metrics.bodyScale * 0.25, 0.72, 1.05);

      switch (type) {
        case 'pet': {
          targetCrouch = 0.82 * catLowFactor;
          targetBend = 0.45;
          if (activeCareAction.bitten && perfT >= 0.38) {
            // Sharp natural human recoil on rare defensive nip
            rShoulderX = -0.35;
            rElbowX = -1.25;
            targetCrouch = 0.35;
            targetBend = 0.1;
          } else {
            const stroke = midPhase ? Math.sin(((perfT - 0.15) / 0.7) * Math.PI * 5) : 0;
            rShoulderX = -1.08 + stroke * 0.14;
            rShoulderZ = -0.14 + stroke * 0.08;
            rElbowX = -0.32 + stroke * 0.12;
            rHandX = 0.35;
            lShoulderX = -0.45;
            lElbowX = -0.45;
          }
          break;
        }

        case 'brush': {
          this.propBrush.visible = true;
          targetCrouch = 0.82 * catLowFactor;
          targetBend = 0.48;
          if (activeCareAction.bitten && perfT >= 0.38) {
            rShoulderX = -0.3;
            rElbowX = -1.2;
            targetCrouch = 0.3;
          } else {
            const sweep = midPhase ? Math.sin(((perfT - 0.15) / 0.7) * Math.PI * 6) : 0;
            rShoulderX = -1.04 + sweep * 0.18;
            rShoulderZ = -0.1 + Math.cos(sweep) * 0.1;
            rElbowX = -0.36;
            rHandZ = sweep * 0.22;
            lShoulderX = -0.5;
            lElbowX = -0.4;
          }
          break;
        }

        case 'feed': {
          const isMilk = activeCareAction.foodId === 'kitten_milk';
          if (isMilk) {
            this.propMilkBottle.visible = true;
            targetCrouch = 0.92;
            targetBend = 0.5;
            rShoulderX = -1.02;
            rElbowX = -0.46;
            rHandX = midPhase ? 0.42 : 0.15;
            lShoulderX = -0.78;
            lElbowX = -0.65;
          } else {
            this.propFoodContainer.visible = true;
            targetCrouch = 0.45;
            targetBend = 0.62;
            rShoulderX = -0.92;
            rElbowX = -0.35;
            rHandZ = midPhase ? 1.05 : 0.15;
            if (midPhase) {
              this.foodParticles.forEach((p, idx) => {
                p.visible = true;
                const cycle = (this.clock * 2.9 + idx * 0.19) % 1;
                p.position.set(
                  ((idx % 3) - 1) * 0.02,
                  -0.06 - cycle * 0.34,
                  0.1 + Math.sin(idx * 1.9) * 0.02
                );
              });
            }
          }
          break;
        }

        case 'water':
        case 'refill_fountain': {
          this.propWaterPitcher.visible = true;
          targetCrouch = 0.42;
          targetBend = 0.56;
          rShoulderX = -0.88;
          rElbowX = -0.38;
          rHandX = midPhase ? 0.62 : 0.1;
          this.waterStreamMesh.visible = midPhase;
          if (midPhase) {
            const shimmer = 0.9 + Math.sin(this.clock * 24) * 0.12;
            this.waterStreamMesh.scale.set(shimmer, 1, shimmer);
          }
          break;
        }

        case 'pickup': {
          // 0..0.28 bend & reach -> 0.28..0.72 stand cradling cat -> 0.72..1.0 bend & gently set down!
          if (perfT < 0.28) {
            const u = perfT / 0.28;
            targetCrouch = 0.85 * u;
            targetBend = 0.52 * u;
            lShoulderX = -1.05 * u;
            rShoulderX = -1.05 * u;
            lElbowX = -0.45 * u;
            rElbowX = -0.45 * u;
          } else if (perfT < 0.72) {
            targetCrouch = 0.06;
            targetBend = 0.06;
            const sway = Math.sin(((perfT - 0.28) / 0.44) * Math.PI * 2) * 0.06;
            lShoulderX = -0.68;
            rShoulderX = -0.68;
            lShoulderZ = -0.18 + sway;
            rShoulderZ = 0.18 + sway;
            lElbowX = -1.12;
            rElbowX = -1.12;
          } else {
            const u = 1 - (perfT - 0.72) / 0.28;
            targetCrouch = 0.82 * Math.sin((1 - u) * Math.PI);
            targetBend = 0.48 * Math.sin((1 - u) * Math.PI);
            lShoulderX = -0.95 * u;
            rShoulderX = -0.95 * u;
            lElbowX = -0.55 * u;
            rElbowX = -0.55 * u;
          }
          break;
        }

        case 'clean_litter':
        case 'empty_auto_litter':
        case 'clean_fountain':
        case 'clean_room': {
          this.propLitterScoop.visible = type === 'clean_litter' || type === 'empty_auto_litter';
          targetCrouch = 0.55;
          targetBend = 0.58;
          const scoopPhase = midPhase ? (perfT - 0.15) / 0.7 : 0;
          const dip = Math.sin(scoopPhase * Math.PI);
          rShoulderX = -0.82 - dip * 0.28;
          rElbowX = -0.35 + dip * 0.18;
          rHandX = -0.2 + dip * 0.55;
          this.propScoopClump.visible = scoopPhase > 0.45;
          break;
        }

        case 'respect_space': {
          // Gentle calming open-palms gesture while standing back
          targetCrouch = 0;
          targetBend = -0.04;
          lShoulderX = -0.52;
          rShoulderX = -0.52;
          lShoulderZ = 0.2;
          rShoulderZ = -0.2;
          lElbowX = -0.68;
          rElbowX = -0.68;
          break;
        }

        case 'sleep': {
          targetCrouch = 0.68;
          targetBend = 0.42;
          rShoulderX = -0.9;
          rElbowX = -0.35;
          lShoulderX = -0.45;
          break;
        }

        case 'play_toy': {
          targetBend = 0.18;
          const wave = Math.sin(this.clock * 6.5);
          rShoulderX = -1.05 + wave * 0.24;
          rShoulderZ = -0.2 + Math.cos(this.clock * 4.5) * 0.28;
          rElbowX = -0.38;
          break;
        }
      }
    }

    // Smooth blend crouch & spine bend (zero animation snapping!)
    const blend = Math.min(1, dt * 7.5);
    this.crouchBlend = lerp(this.crouchBlend, targetCrouch, blend);
    this.bendBlend = lerp(this.bendBlend, targetBend, blend);

    // Apply pelvis height & kneeling/walking leg articulation
    const walkBob = isWalking ? Math.abs(Math.sin(this.walkCycle)) * 0.028 : 0;
    const kneelDrop = this.crouchBlend * 0.34;
    this.pelvisPivot.position.y = 0.88 - kneelDrop + walkBob;
    this.spinePivot.rotation.x = this.bendBlend;

    // Legs: smoothly transition between standing, walking stride, and natural kneel/squat
    const legSwing = isWalking ? Math.sin(this.walkCycle) * 0.52 : 0;
    const leftHipTarget = lerp(legSwing, -1.08, this.crouchBlend);
    const rightHipTarget = lerp(-legSwing, -0.82, this.crouchBlend);
    const leftKneeTarget = lerp(Math.max(0, -Math.cos(this.walkCycle)) * (isWalking ? 0.55 : 0), 1.72, this.crouchBlend);
    const rightKneeTarget = lerp(Math.max(0, Math.cos(this.walkCycle)) * (isWalking ? 0.55 : 0), 1.48, this.crouchBlend);

    this.leftHip.rotation.x = lerp(this.leftHip.rotation.x, leftHipTarget, blend);
    this.rightHip.rotation.x = lerp(this.rightHip.rotation.x, rightHipTarget, blend);
    this.leftKnee.rotation.x = lerp(this.leftKnee.rotation.x, leftKneeTarget, blend);
    this.rightKnee.rotation.x = lerp(this.rightKnee.rotation.x, rightKneeTarget, blend);
    this.leftFoot.rotation.x = lerp(this.leftFoot.rotation.x, -this.crouchBlend * 0.55, blend);
    this.rightFoot.rotation.x = lerp(this.rightFoot.rotation.x, -this.crouchBlend * 0.55, blend);

    // Arms & Hands
    this.leftShoulder.rotation.x = lerp(this.leftShoulder.rotation.x, lShoulderX, blend);
    this.leftShoulder.rotation.z = lerp(this.leftShoulder.rotation.z, lShoulderZ, blend);
    this.leftElbow.rotation.x = lerp(this.leftElbow.rotation.x, lElbowX, blend);

    this.rightShoulder.rotation.x = lerp(this.rightShoulder.rotation.x, rShoulderX, blend);
    this.rightShoulder.rotation.z = lerp(this.rightShoulder.rotation.z, rShoulderZ, blend);
    this.rightElbow.rotation.x = lerp(this.rightElbow.rotation.x, rElbowX, blend);
    this.rightHand.rotation.x = lerp(this.rightHand.rotation.x, rHandX, blend);
    this.rightHand.rotation.z = lerp(this.rightHand.rotation.z, rHandZ, blend);

    // Gentle head look-at toward the cat so the human feels truly alive and attentive
    const catLocal = this.root.worldToLocal(
      new THREE.Vector3(cat.position.x, cat.position.y + 0.2, cat.position.z)
    );
    const headYaw = clamp(Math.atan2(catLocal.x, catLocal.z), -0.65, 0.65);
    const headPitch = clamp(0.18 + this.crouchBlend * 0.14 - this.bendBlend * 0.35, -0.25, 0.45);
    this.neckPivot.rotation.y = lerp(this.neckPivot.rotation.y, headYaw, Math.min(1, dt * 5));
    this.neckPivot.rotation.x = lerp(this.neckPivot.rotation.x, headPitch, Math.min(1, dt * 5));
  }
}
