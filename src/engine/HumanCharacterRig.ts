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
import {
  createChibiEyeTexture,
  createChibiHairTexture,
  createChibiOutfitTexture,
  createChibiSkinTexture
} from './textures';

/**
 * Creates a single continuous, seamless sculpted Chibi head geometry:
 * - Full soft cranium, rounded chubby lower cheeks, gentle chin taper
 * - Oriented so UV u = 0.5 faces exact +Z (front face) for seamless cheek blush mapping
 * - Zero separate chin/jaw pieces -> completely seam-free!
 */
function createSculptedChibiHeadGeometry(isMale: boolean): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.185, 36, 28);
  // Rotate so Three.js sphere seam (u=0/1) sits cleanly at the back (-Z) and u=0.5 is exact front (+Z)
  geo.rotateY(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = x / 0.185;
    const ny = y / 0.185;
    const nz = z / 0.185;

    // Soft chubby lower cheeks (adorable Chibi fullness)
    const cheekBand = Math.exp(-Math.pow((ny + 0.24) / 0.34, 2));
    const cheekSide = Math.abs(nx);
    const cheekPuff = cheekBand * cheekSide * (isMale ? 0.06 : 0.085);
    x *= 1.0 + cheekPuff;
    z *= 1.0 + cheekBand * Math.max(0, nz) * 0.035;

    // Gentle soft forehead curve and cute rounded chin taper
    if (ny < -0.58) {
      const chinT = clamp((-ny - 0.58) / 0.42, 0, 1);
      x *= 1.0 - chinT * (isMale ? 0.09 : 0.13);
      z *= 1.0 - chinT * 0.08;
      y += chinT * 0.012;
    }

    // Subtle overall cute ovality (slightly wider than deep)
    x *= 1.03;
    y *= 0.96;
    z *= 0.98;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a single continuous, seamless Chibi torso-to-hip LatheGeometry
 * flowing smoothly from upper shoulder collar down to rounded hips (no waist split!).
 */
function createSeamlessChibiTorsoGeometry(isMale: boolean, radiusOffset = 0): THREE.BufferGeometry {
  const hipW = isMale ? 0.102 : 0.112;
  const waistW = isMale ? 0.094 : 0.092;
  const chestW = isMale ? 0.108 : 0.102;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -0.065),
    new THREE.Vector2(hipW * 0.72 + radiusOffset, -0.055),
    new THREE.Vector2(hipW + radiusOffset, -0.025),
    new THREE.Vector2(hipW * 1.02 + radiusOffset, 0.02),
    new THREE.Vector2(waistW + radiusOffset, 0.085),
    new THREE.Vector2(chestW + radiusOffset, 0.165),
    new THREE.Vector2(chestW * 0.88 + radiusOffset, 0.215),
    new THREE.Vector2(0.058 + radiusOffset * 0.5, 0.242),
    new THREE.Vector2(0.001, 0.248)
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  // Subtle front-to-back anatomical flattening
  geo.scale(1.06, 1.0, 0.86);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Seamless tapered Chibi neck flowing continuously from inside the head base
 * into the upper torso so no neck gap or hard cylinder rim can ever appear.
 */
function createSeamlessChibiNeckGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.088, -0.03),
    new THREE.Vector2(0.072, 0.0),
    new THREE.Vector2(0.055, 0.028),
    new THREE.Vector2(0.052, 0.058),
    new THREE.Vector2(0.062, 0.088)
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Seamless Chibi limb segment with tangent-matched hemispherical caps at BOTH ends
 * so joint rotation never exposes a gap, seam, or pinched edge!
 */
function createSeamlessLimbGeometry(
  topRadius: number,
  botRadius: number,
  length: number
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const capSteps = 6;
  // Bottom rounded cap (centered at y = -length)
  for (let i = 0; i <= capSteps; i++) {
    const a = -Math.PI * 0.5 + (i / capSteps) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * botRadius), -length + Math.sin(a) * botRadius));
  }
  // Smooth midpoint taper
  pts.push(new THREE.Vector2(lerp(botRadius, topRadius, 0.5), -length * 0.5));
  // Top rounded cap (centered at y = 0)
  for (let i = 0; i <= capSteps; i++) {
    const a = (i / capSteps) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * topRadius), Math.sin(a) * topRadius));
  }
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Cute, High-Quality 3D Chibi Human Character Rig (1:2.65 head-to-body ratio).
 *
 * Design highlights:
 * - Oversized single-mesh sculpted Chibi head with soft rounded cheeks & warm rosy blush
 * - Large glossy Chibi eyes with multi-layered iris texture, double catchlights & soft lashes
 * - Zero visible body seams: seamless neck-to-torso blend, tangent-matched spherical sockets at
 *   shoulders/elbows/wrists/hips/knees/ankles, identical soft matte skin material across all parts
 * - Snug, non-floating layered hairstyles (10 styles x 9 colors) with silky brushed strand texture
 * - Cozy fitted clothing (5 tops, 6 cross-gender bottoms, 4 footwear) with zero clipping
 * - Retargeted Chibi-proportioned animations for walking, kneeling, petting, brushing, feeding,
 *   pouring water, playing with toys, cleaning, and cradling the realistic fluffy cat!
 */
export class HumanCharacterRig {
  public readonly root = new THREE.Group();

  // Skeletal hierarchy (standing total height ~0.98m; pelvis at y = 0.36m)
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

  // Dynamic customizable sub-groups
  private readonly headMeshHolder = new THREE.Group();
  private readonly hairGroup = new THREE.Group();
  private readonly faceGroup = new THREE.Group();
  private readonly torsoMeshHolder = new THREE.Group();
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

  // Blinking eyelids
  private leftEyelid: THREE.Mesh | null = null;
  private rightEyelid: THREE.Mesh | null = null;

  // Carry cradle anchor in front of Chibi chest
  private readonly carryAnchor = new THREE.Object3D();

  // Attached right-hand care props (retargeted for cute Chibi hands!)
  private readonly propSocket = new THREE.Group();
  private readonly propBrush = new THREE.Group();
  private readonly propWaterPitcher = new THREE.Group();
  private readonly waterStreamMesh: THREE.Mesh;
  private readonly propFoodContainer = new THREE.Group();
  private readonly propMilkBottle = new THREE.Group();
  private readonly foodParticles: THREE.Mesh[] = [];
  private readonly propLitterScoop = new THREE.Group();
  private readonly propScoopClump: THREE.Mesh;

  // Consistent seamless materials (exact matching skin roughness & sheen across face and body!)
  private readonly faceSkinMat = new THREE.MeshStandardMaterial({
    roughness: 0.72,
    metalness: 0.01
  });
  private readonly bodySkinMat = new THREE.MeshStandardMaterial({
    roughness: 0.72,
    metalness: 0.01
  });
  private readonly hairMat = new THREE.MeshStandardMaterial({
    roughness: 0.56,
    metalness: 0.06
  });
  private readonly topMat = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.01
  });
  private readonly bottomMat = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.01
  });
  private readonly shoeMat = new THREE.MeshStandardMaterial({
    roughness: 0.68,
    metalness: 0.04
  });
  private readonly sockMat = new THREE.MeshStandardMaterial({
    color: '#f8f4ee',
    roughness: 0.92
  });
  private readonly soleMat = new THREE.MeshStandardMaterial({
    color: '#efeae2',
    roughness: 0.84
  });

  private appearanceKey = '';
  private clock = 0;
  private walkCycle = 0;
  private blinkTimer = 3.0;
  private blinkAmount = 0;
  private crouchBlend = 0;
  private bendBlend = 0;

  constructor(initialAppearance: HumanAppearance) {
    this.root.name = 'human_character_chibi_root';

    // Pelvis at cute Chibi hip height (y = 0.36m)
    this.pelvisPivot.position.set(0, 0.36, 0);
    this.root.add(this.pelvisPivot);

    // Spine -> Chest -> Seamless Neck -> Oversized Chibi Head
    this.spinePivot.position.set(0, 0.02, 0);
    this.pelvisPivot.add(this.spinePivot);

    this.chestPivot.position.set(0, 0.0, 0);
    this.spinePivot.add(this.chestPivot);

    this.chestPivot.add(this.torsoMeshHolder);
    this.chestPivot.add(this.topMeshGroup);
    this.pelvisPivot.add(this.bottomPelvisGroup);

    // Carry cradle anchor in front of Chibi torso
    this.carryAnchor.position.set(0, 0.12, 0.23);
    this.chestPivot.add(this.carryAnchor);

    // Seamless flared neck nestled deeply between chest & head
    this.neckPivot.position.set(0, 0.228, 0.0);
    this.chestPivot.add(this.neckPivot);

    const neckMesh = new THREE.Mesh(createSeamlessChibiNeckGeometry(), this.bodySkinMat);
    neckMesh.castShadow = true;
    this.neckPivot.add(neckMesh);

    // Oversized Chibi Head centered directly on top of seamless neck
    this.headGroup.position.set(0, 0.215, 0.004);
    this.neckPivot.add(this.headGroup);
    this.headGroup.add(this.headMeshHolder);

    // Cute rounded Chibi ears nestled seamlessly into the side of the head
    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 12), this.bodySkinMat);
      ear.scale.set(0.55, 1.05, 0.78);
      ear.position.set(side * 0.184, -0.015, -0.005);
      this.headGroup.add(ear);
    }

    // Soft button nose seamlessly blended onto face center
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), this.bodySkinMat);
    nose.scale.set(1.0, 0.78, 0.82);
    nose.position.set(0, -0.022, 0.181);
    this.headGroup.add(nose);

    this.headGroup.add(this.faceGroup);
    this.headGroup.add(this.hairGroup);

    // Short, seamless Chibi arms
    this.buildChibiArm(
      -1,
      this.leftShoulder,
      this.leftElbow,
      this.leftHand,
      this.leftUpperSleeveGroup,
      this.leftLowerSleeveGroup
    );
    this.buildChibiArm(
      1,
      this.rightShoulder,
      this.rightElbow,
      this.rightHand,
      this.rightUpperSleeveGroup,
      this.rightLowerSleeveGroup
    );

    // Prop attachment socket cleanly centered inside Chibi's right hand grip
    this.propSocket.position.set(0, -0.042, 0.028);
    this.rightHand.add(this.propSocket);

    // Short, seamless Chibi legs
    this.buildChibiLeg(
      -1,
      this.leftHip,
      this.leftKnee,
      this.leftFoot,
      this.leftThighClothGroup,
      this.leftShinClothGroup,
      this.leftShoeGroup
    );
    this.buildChibiLeg(
      1,
      this.rightHip,
      this.rightKnee,
      this.rightFoot,
      this.rightThighClothGroup,
      this.rightShinClothGroup,
      this.rightShoeGroup
    );

    const propsBuilt = this.buildCareProps();
    this.waterStreamMesh = propsBuilt.waterStream;
    this.propScoopClump = propsBuilt.scoopClump;

    this.applyAppearance(initialAppearance);
  }

  private buildChibiArm(
    side: -1 | 1,
    shoulder: THREE.Group,
    elbow: THREE.Group,
    hand: THREE.Group,
    upperSleeve: THREE.Group,
    lowerSleeve: THREE.Group
  ): void {
    // Nested smoothly into torso shoulder socket (zero disconnected gap!)
    shoulder.position.set(side * 0.106, 0.195, 0.0);
    this.chestPivot.add(shoulder);

    const upperArm = new THREE.Mesh(
      createSeamlessLimbGeometry(0.036, 0.032, 0.115),
      this.bodySkinMat
    );
    upperArm.castShadow = true;
    shoulder.add(upperArm);
    shoulder.add(upperSleeve);

    // Elbow pivot exactly at bottom sphere center of upperArm -> tangent seamless joint!
    elbow.position.set(0, -0.115, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      createSeamlessLimbGeometry(0.032, 0.027, 0.105),
      this.bodySkinMat
    );
    forearm.castShadow = true;
    elbow.add(forearm);
    elbow.add(lowerSleeve);

    // Wrist pivot at exact bottom sphere center of forearm -> zero wrist seam!
    hand.position.set(0, -0.105, 0);
    elbow.add(hand);

    // Adorable plump rounded Chibi hand with soft thumb
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), this.bodySkinMat);
    palm.scale.set(0.95, 1.12, 0.78);
    palm.position.set(0, -0.024, 0.004);
    palm.castShadow = true;
    hand.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.016, 6, 8), this.bodySkinMat);
    thumb.position.set(-side * 0.024, -0.016, 0.016);
    thumb.rotation.z = side * 0.55;
    thumb.rotation.x = 0.35;
    hand.add(thumb);
  }

  private buildChibiLeg(
    side: -1 | 1,
    hip: THREE.Group,
    knee: THREE.Group,
    foot: THREE.Group,
    thighCloth: THREE.Group,
    shinCloth: THREE.Group,
    shoeGroup: THREE.Group
  ): void {
    // Nested seamlessly inside rounded Chibi pelvis!
    hip.position.set(side * 0.06, -0.012, 0);
    this.pelvisPivot.add(hip);

    const thigh = new THREE.Mesh(
      createSeamlessLimbGeometry(0.052, 0.045, 0.155),
      this.bodySkinMat
    );
    thigh.castShadow = true;
    hip.add(thigh);
    hip.add(thighCloth);

    // Knee pivot at exact bottom sphere center of thigh -> tangent seamless bend!
    knee.position.set(0, -0.155, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(
      createSeamlessLimbGeometry(0.045, 0.036, 0.155),
      this.bodySkinMat
    );
    shin.castShadow = true;
    knee.add(shin);
    knee.add(shinCloth);

    // Cozy seamless ribbed sock cuff above ankle (matches reference aesthetic & hides ankle transition!)
    const sockLower = new THREE.Mesh(
      createSeamlessLimbGeometry(0.04, 0.038, 0.068),
      this.sockMat
    );
    sockLower.position.set(0, -0.088, 0);
    knee.add(sockLower);

    // Ankle pivot at exact bottom sphere center of shin
    foot.position.set(0, -0.155, 0.016);
    knee.add(foot);
    foot.add(shoeGroup);
  }

  private buildCareProps(): { waterStream: THREE.Mesh; scoopClump: THREE.Mesh } {
    // 1. Cozy Wooden Grooming Brush (scaled proportionally for Chibi hands)
    const woodMat = new THREE.MeshStandardMaterial({ color: '#c49060', roughness: 0.55 });
    const padMat = new THREE.MeshStandardMaterial({ color: '#4c4642', roughness: 0.9 });
    const bristleMat = new THREE.MeshStandardMaterial({ color: '#ebe4db', roughness: 0.7 });
    const bHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.11, 10), woodMat);
    bHandle.rotation.x = Math.PI / 2;
    bHandle.position.set(0, 0, 0.03);
    this.propBrush.add(bHandle);
    const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), woodMat);
    bHead.scale.set(1.12, 0.38, 1.32);
    bHead.position.set(0, 0, 0.105);
    this.propBrush.add(bHead);
    const bPad = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 12), padMat);
    bPad.position.set(0, -0.014, 0.105);
    this.propBrush.add(bPad);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.016, 4), bristleMat);
        pin.position.set(i * 0.016, -0.025, 0.105 + j * 0.018);
        this.propBrush.add(pin);
      }
    }
    this.propBrush.visible = false;
    this.propSocket.add(this.propBrush);

    // 2. Cute Glass Water Pitcher + Animated Pouring Stream
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#e1f4fc',
      roughness: 0.14,
      metalness: 0.06,
      transparent: true,
      opacity: 0.78
    });
    const pitcher = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.135, 14), glassMat);
    pitcher.position.set(0, 0.01, 0.06);
    this.propWaterPitcher.add(pitcher);
    const pitcherWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.09, 12),
      new THREE.MeshStandardMaterial({
        color: '#84d0ee',
        transparent: true,
        opacity: 0.8,
        roughness: 0.1
      })
    );
    pitcherWater.position.set(0, -0.01, 0.06);
    this.propWaterPitcher.add(pitcherWater);
    const waterStream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.013, 0.28, 8),
      new THREE.MeshStandardMaterial({
        color: '#a3dff5',
        transparent: true,
        opacity: 0.82,
        roughness: 0.08
      })
    );
    waterStream.position.set(0, -0.15, 0.12);
    waterStream.visible = false;
    this.propWaterPitcher.add(waterStream);
    this.propWaterPitcher.visible = false;
    this.propSocket.add(this.propWaterPitcher);

    // 3. Cute Food Scoop + Pouring Kibble
    const scoopMat = new THREE.MeshStandardMaterial({ color: '#d87e58', roughness: 0.45 });
    const foodCup = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.035, 0.095, 14), scoopMat);
    foodCup.position.set(0, 0, 0.06);
    this.propFoodContainer.add(foodCup);
    const kibbleMat = new THREE.MeshStandardMaterial({ color: '#7d5232', roughness: 0.85 });
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), kibbleMat);
      p.visible = false;
      this.propFoodContainer.add(p);
      this.foodParticles.push(p);
    }
    this.propFoodContainer.visible = false;
    this.propSocket.add(this.propFoodContainer);

    // 4. Kitten Milk Bottle
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: '#fff9ef', roughness: 0.3 })
    );
    bottle.rotation.x = Math.PI / 2;
    bottle.position.set(0, 0, 0.06);
    this.propMilkBottle.add(bottle);
    const nipple = new THREE.Mesh(
      new THREE.ConeGeometry(0.011, 0.028, 10),
      new THREE.MeshStandardMaterial({ color: '#f2c4a8', roughness: 0.4 })
    );
    nipple.rotation.x = Math.PI / 2;
    nipple.position.set(0, 0, 0.12);
    this.propMilkBottle.add(nipple);
    this.propMilkBottle.visible = false;
    this.propSocket.add(this.propMilkBottle);

    // 5. Litter Scoop
    const scoopGray = new THREE.MeshStandardMaterial({ color: '#8f9aa3', roughness: 0.5 });
    const lHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.15, 8), scoopGray);
    lHandle.rotation.x = Math.PI / 2;
    lHandle.position.set(0, 0, 0.05);
    this.propLitterScoop.add(lHandle);
    const lBasket = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.02, 0.095), scoopGray);
    lBasket.position.set(0, -0.006, 0.15);
    this.propLitterScoop.add(lBasket);
    const scoopClump = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#a89a84', roughness: 0.95 })
    );
    scoopClump.position.set(0, 0.012, 0.15);
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
    const isMale = app.gender === 'male';

    // Exact matching soft skin material across head, neck, arms, hands, and legs (ZERO tone seams!)
    this.faceSkinMat.map = createChibiSkinTexture(skinHex, true);
    this.faceSkinMat.color.set('#ffffff');
    this.faceSkinMat.needsUpdate = true;

    this.bodySkinMat.map = createChibiSkinTexture(skinHex, false);
    this.bodySkinMat.color.set('#ffffff');
    this.bodySkinMat.needsUpdate = true;

    this.hairMat.map = createChibiHairTexture(hairHex);
    this.hairMat.color.set('#ffffff');
    this.hairMat.needsUpdate = true;

    const topVariant = app.topStyle === 'sweater' || app.topStyle === 'hoodie' ? 'knit' : 'cotton';
    this.topMat.map = createChibiOutfitTexture(app.topColor, topVariant);
    this.topMat.color.set('#ffffff');
    this.topMat.needsUpdate = true;

    const botVariant = app.bottomStyle === 'pleated_skirt' ? 'plaid' : 'cotton';
    this.bottomMat.map = createChibiOutfitTexture(app.bottomColor, botVariant);
    this.bottomMat.color.set('#ffffff');
    this.bottomMat.needsUpdate = true;

    this.shoeMat.color.set(app.footwearColor);

    // Subtle adorable Chibi male/female proportions (~1:2.65 head-to-body ratio)
    this.root.scale.setScalar(isMale ? 1.03 : 0.98);
    this.leftShoulder.position.x = isMale ? -0.112 : -0.104;
    this.rightShoulder.position.x = isMale ? 0.112 : 0.104;

    // Single seamless sculpted Chibi head mesh
    this.clearGroup(this.headMeshHolder);
    const headMesh = new THREE.Mesh(createSculptedChibiHeadGeometry(isMale), this.faceSkinMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headMeshHolder.add(headMesh);

    // Single seamless sculpted Chibi torso-to-hip mesh
    this.clearGroup(this.torsoMeshHolder);
    const torsoMesh = new THREE.Mesh(createSeamlessChibiTorsoGeometry(isMale, 0), this.topMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoMeshHolder.add(torsoMesh);

    this.rebuildChibiFace(app, eyeHex);
    this.rebuildChibiHair(app);
    this.rebuildChibiTop(app, isMale);
    this.rebuildChibiBottom(app, isMale);
    this.rebuildChibiFootwear(app);
  }

  private rebuildChibiFace(app: HumanAppearance, eyeHex: string): void {
    this.clearGroup(this.faceGroup);

    const eyeTex = createChibiEyeTexture(eyeHex);
    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.12,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.06
    });
    const lashMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(getHairColorHex(app.hairColor)).multiplyScalar(0.45),
      roughness: 0.6
    });
    const browMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(getHairColorHex(app.hairColor)).multiplyScalar(0.65),
      roughness: 0.72
    });
    const lipMat = new THREE.MeshStandardMaterial({
      color: app.lipColor,
      roughness: 0.42
    });
    const innerMouthMat = new THREE.MeshStandardMaterial({
      color: '#d9767a',
      roughness: 0.5
    });

    const sz = clamp(app.eyeSize, 0.85, 1.18);
    let sx = 1.05 * sz;
    let sy = 1.08 * sz;
    let tilt = 0.04;
    if (app.eyeShape === 'almond') {
      sx = 1.16 * sz;
      sy = 0.94 * sz;
    } else if (app.eyeShape === 'round') {
      sx = 1.06 * sz;
      sy = 1.14 * sz;
    } else if (app.eyeShape === 'hooded') {
      sx = 1.1 * sz;
      sy = 0.86 * sz;
    } else if (app.eyeShape === 'upturned') {
      sx = 1.12 * sz;
      sy = 0.98 * sz;
      tilt = 0.16;
    } else if (app.eyeShape === 'wide') {
      sx = 1.18 * sz;
      sy = 1.18 * sz;
    }

    const buildChibiEye = (side: -1 | 1) => {
      const g = new THREE.Group();
      // Placed snugly on the curved front Chibi face contour!
      g.position.set(side * 0.064, -0.008, 0.156);
      g.rotation.y = side * 0.25;
      g.rotation.z = side * tilt;

      // Large glossy curved Chibi eye dome
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 16), eyeMat);
      dome.scale.set(sx, sy, 0.42);
      g.add(dome);

      // Soft curved dark upper eyelash arch framing the eye
      const lash = new THREE.Mesh(
        new THREE.TorusGeometry(0.036, 0.0046, 8, 18, Math.PI * 0.82),
        lashMat
      );
      lash.scale.set(sx * 1.04, sy * 1.02, 0.5);
      lash.rotation.z = Math.PI * 0.09;
      lash.position.set(0, 0.004, 0.011);
      g.add(lash);

      // Smooth skin-colored curved eyelid dome for natural blinking
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.039, 14, 10), this.bodySkinMat);
      lid.scale.set(sx * 1.06, sy * 1.06, 0.48);
      lid.position.set(0, 0.002, 0.003);
      lid.visible = false;
      g.add(lid);

      // Delicate arched Chibi eyebrow above bangs edge
      const brow = new THREE.Mesh(
        new THREE.TorusGeometry(0.026, 0.0036, 6, 12, Math.PI * 0.65),
        browMat
      );
      brow.rotation.z = Math.PI * 0.18 - side * 0.08;
      brow.position.set(0, 0.044 * sy, 0.008);
      g.add(brow);

      this.faceGroup.add(g);
      return lid;
    };

    this.leftEyelid = buildChibiEye(-1);
    this.rightEyelid = buildChibiEye(1);

    // Cute small Chibi mouth tucked neatly beneath the button nose
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.068, 0.168);
    if (app.mouthShape === 'smile') {
      // Sweet open cheerful Chibi D-smile (matching the cozy reference!)
      const smileBg = new THREE.Mesh(
        new THREE.CircleGeometry(0.019, 14, Math.PI, Math.PI),
        innerMouthMat
      );
      smileBg.scale.set(1.15, 0.9, 1);
      mouthGroup.add(smileBg);
      const smileRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.02, 0.0036, 8, 14, Math.PI),
        lipMat
      );
      smileRim.rotation.z = Math.PI;
      mouthGroup.add(smileRim);
    } else if (app.mouthShape === 'full') {
      const upper = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), lipMat);
      upper.scale.set(1.5, 0.55, 0.5);
      upper.position.y = 0.004;
      const lower = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), lipMat);
      lower.scale.set(1.38, 0.65, 0.5);
      lower.position.y = -0.004;
      mouthGroup.add(upper, lower);
    } else if (app.mouthShape === 'thin') {
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, 0.022, 6, 8), lipMat);
      bar.rotation.z = Math.PI / 2;
      mouthGroup.add(bar);
    } else if (app.mouthShape === 'gentle') {
      // Adorable tiny "w" cat-lover smile!
      for (const side of [-1, 1] as const) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(0.01, 0.003, 6, 10, Math.PI),
          lipMat
        );
        arc.rotation.z = Math.PI;
        arc.position.set(side * 0.0095, 0.002, 0);
        mouthGroup.add(arc);
      }
    } else {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(0.016, 0.0035, 8, 12, Math.PI * 0.78),
        lipMat
      );
      m.rotation.z = Math.PI * 1.11;
      m.position.y = 0.006;
      mouthGroup.add(m);
    }
    this.faceGroup.add(mouthGroup);
  }

  private rebuildChibiHair(app: HumanAppearance): void {
    this.clearGroup(this.hairGroup);
    const style = app.hairStyle;

    // 1. Snug inner scalp cap fitted tightly to the sculpted head contour (ZERO floating hair!)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.194, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.62),
      this.hairMat
    );
    cap.scale.set(1.04, 0.99, 1.01);
    cap.position.set(0, 0.008, -0.006);
    cap.castShadow = true;
    this.hairGroup.add(cap);

    if (style === 'buzz') {
      cap.scale.set(1.015, 0.96, 0.98);
      return;
    }

    // Back crown fullness hugging the back of the head seamlessly
    const backShell = new THREE.Mesh(new THREE.SphereGeometry(0.194, 24, 18), this.hairMat);
    backShell.scale.set(1.04, 0.98, 0.92);
    backShell.position.set(0, -0.006, -0.028);
    backShell.castShadow = true;
    this.hairGroup.add(backShell);

    // 2. Soft layered Chibi forehead bangs (frames the big glossy eyes warmly!)
    const bangSpecs =
      style === 'side_part'
        ? [
            { x: -0.08, y: 0.095, z: 0.165, rx: 0.25, rz: 0.34, r: 0.036, len: 0.09 },
            { x: -0.01, y: 0.105, z: 0.174, rx: 0.28, rz: -0.22, r: 0.04, len: 0.1 },
            { x: 0.075, y: 0.095, z: 0.166, rx: 0.24, rz: -0.36, r: 0.038, len: 0.1 }
          ]
        : [
            { x: -0.105, y: 0.088, z: 0.15, rx: 0.22, rz: 0.32, r: 0.035, len: 0.1 },
            { x: -0.048, y: 0.098, z: 0.17, rx: 0.26, rz: 0.12, r: 0.034, len: 0.092 },
            { x: 0.004, y: 0.102, z: 0.175, rx: 0.28, rz: -0.02, r: 0.034, len: 0.088 },
            { x: 0.056, y: 0.096, z: 0.168, rx: 0.25, rz: -0.16, r: 0.034, len: 0.094 },
            { x: 0.108, y: 0.086, z: 0.148, rx: 0.22, rz: -0.34, r: 0.035, len: 0.1 }
          ];

    for (const b of bangSpecs) {
      const lock = new THREE.Mesh(
        new THREE.CapsuleGeometry(b.r, b.len, 8, 12),
        this.hairMat
      );
      lock.scale.set(1.0, 1.0, 0.52);
      lock.position.set(b.x, b.y, b.z);
      lock.rotation.set(b.rx, 0, b.rz);
      lock.castShadow = true;
      this.hairGroup.add(lock);
    }

    // Soft sideburn locks framing the chubby cheeks cleanly
    const sideLen =
      style === 'long' || style === 'wavy'
        ? 0.28
        : style === 'medium'
          ? 0.2
          : style === 'bob'
            ? 0.15
            : 0.095;
    for (const side of [-1, 1] as const) {
      const sideLock = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.042, sideLen, 8, 12),
        this.hairMat
      );
      sideLock.scale.set(0.85, 1.0, 0.78);
      sideLock.position.set(side * 0.168, -sideLen * 0.28, 0.062);
      sideLock.rotation.z = side * 0.1;
      sideLock.castShadow = true;
      this.hairGroup.add(sideLock);
    }

    // 3. Style-specific silhouettes
    if (style === 'short' || style === 'side_part') {
      const crownVolume = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), this.hairMat);
      crownVolume.scale.set(1.18, 0.65, 1.1);
      crownVolume.position.set(style === 'side_part' ? 0.015 : 0, 0.148, 0.0);
      this.hairGroup.add(crownVolume);
    } else if (style === 'bob') {
      const bobCurtain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.175, 0.205, 0.2, 22),
        this.hairMat
      );
      bobCurtain.scale.set(1.04, 1.0, 0.84);
      bobCurtain.position.set(0, -0.078, -0.032);
      bobCurtain.castShadow = true;
      this.hairGroup.add(bobCurtain);
    } else if (style === 'medium' || style === 'long' || style === 'wavy') {
      const len = style === 'medium' ? 0.25 : 0.38;
      const backFlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.176, style === 'wavy' ? 0.235 : 0.215, len, 22),
        this.hairMat
      );
      backFlow.scale.set(1.06, 1.0, 0.72);
      backFlow.position.set(0, -len * 0.44 - 0.03, -0.068);
      backFlow.castShadow = true;
      this.hairGroup.add(backFlow);

      if (style === 'wavy') {
        for (const side of [-1, 1] as const) {
          for (let w = 0; w < 3; w++) {
            const curl = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), this.hairMat);
            curl.position.set(side * (0.17 + w * 0.012), -0.08 - w * 0.095, -0.04 - w * 0.02);
            curl.castShadow = true;
            this.hairGroup.add(curl);
          }
        }
      }
    } else if (style === 'ponytail') {
      const ribbonMat = new THREE.MeshStandardMaterial({ color: app.topColor, roughness: 0.68 });
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.01, 8, 14), ribbonMat);
      tie.position.set(0, 0.04, -0.195);
      this.hairGroup.add(tie);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.24, 10, 14), this.hairMat);
      tail.position.set(0, -0.085, -0.225);
      tail.rotation.x = 0.28;
      tail.castShadow = true;
      this.hairGroup.add(tail);
    } else if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 14), this.hairMat);
      bun.position.set(0, 0.205, -0.03);
      bun.castShadow = true;
      this.hairGroup.add(bun);
    } else if (style === 'curly') {
      const puffs = [
        [0, 0.165, 0.02],
        [-0.125, 0.125, 0.01],
        [0.125, 0.125, 0.01],
        [-0.175, 0.03, -0.02],
        [0.175, 0.03, -0.02],
        [-0.168, -0.065, -0.025],
        [0.168, -0.065, -0.025],
        [0, 0.09, -0.15],
        [-0.11, -0.01, -0.14],
        [0.11, -0.01, -0.14],
        [0, -0.09, -0.14]
      ];
      for (const [cx, cy, cz] of puffs) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.074, 12, 10), this.hairMat);
        puff.position.set(cx, cy, cz);
        puff.castShadow = true;
        this.hairGroup.add(puff);
      }
    }
  }

  private rebuildChibiTop(app: HumanAppearance, isMale: boolean): void {
    this.clearGroup(this.topMeshGroup);
    this.clearGroup(this.leftUpperSleeveGroup);
    this.clearGroup(this.leftLowerSleeveGroup);
    this.clearGroup(this.rightUpperSleeveGroup);
    this.clearGroup(this.rightLowerSleeveGroup);

    const style = app.topStyle;
    const isShortSleeve = style === 'tshirt';
    const rUp = style === 'hoodie' || style === 'sweater' ? 0.044 : 0.041;
    const rLow = style === 'hoodie' || style === 'sweater' ? 0.038 : 0.035;

    // Fitted seamless collar hugging the neck smoothly (hides neck-to-chest transition completely!)
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.062, 0.015, 10, 20),
      this.topMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.228, 0);
    this.topMeshGroup.add(collar);

    // Upper sleeves with soft puffed shoulder cap overlapping torso seamlessly!
    for (const grp of [this.leftUpperSleeveGroup, this.rightUpperSleeveGroup]) {
      const sleeve = new THREE.Mesh(
        createSeamlessLimbGeometry(rUp * 1.06, rUp * 0.96, isShortSleeve ? 0.072 : 0.115),
        this.topMat
      );
      sleeve.castShadow = true;
      grp.add(sleeve);
    }

    // Long sleeves with cute ribbed wrist cuff (zero wrist gap!)
    if (!isShortSleeve) {
      for (const grp of [this.leftLowerSleeveGroup, this.rightLowerSleeveGroup]) {
        const lSleeve = new THREE.Mesh(
          createSeamlessLimbGeometry(rLow * 1.04, rLow * 0.92, 0.092),
          this.topMat
        );
        lSleeve.castShadow = true;
        grp.add(lSleeve);

        const cuff = new THREE.Mesh(
          new THREE.TorusGeometry(rLow * 0.88, 0.01, 8, 16),
          this.topMat
        );
        cuff.rotation.x = Math.PI / 2;
        cuff.position.set(0, -0.092, 0);
        grp.add(cuff);
      }
    }

    if (style === 'hoodie') {
      const hood = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.032, 10, 18), this.topMat);
      hood.rotation.x = Math.PI * 0.42;
      hood.position.set(0, 0.215, -0.04);
      this.topMeshGroup.add(hood);

      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.062, 0.022), this.topMat);
      pocket.position.set(0, 0.055, 0.088);
      this.topMeshGroup.add(pocket);
    } else if (style === 'casual_shirt') {
      const btnMat = new THREE.MeshStandardMaterial({ color: '#f6f2ec', roughness: 0.4 });
      for (let i = 0; i < 3; i++) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), btnMat);
        btn.position.set(0, 0.165 - i * 0.048, 0.095);
        this.topMeshGroup.add(btn);
      }
    } else if (style === 'sweater') {
      const hem = new THREE.Mesh(
        new THREE.TorusGeometry(isMale ? 0.102 : 0.106, 0.016, 10, 20),
        this.topMat
      );
      hem.rotation.x = Math.PI / 2;
      hem.scale.set(1.06, 0.86, 1.0);
      hem.position.set(0, 0.025, 0);
      this.topMeshGroup.add(hem);
    }
  }

  private rebuildChibiBottom(app: HumanAppearance, isMale: boolean): void {
    this.clearGroup(this.bottomPelvisGroup);
    this.clearGroup(this.leftThighClothGroup);
    this.clearGroup(this.leftShinClothGroup);
    this.clearGroup(this.rightThighClothGroup);
    this.clearGroup(this.rightShinClothGroup);

    const style = app.bottomStyle;

    // Fitted seamless pelvis/waistband wrap bridging top & bottom without gap!
    const waistBand = new THREE.Mesh(
      new THREE.CylinderGeometry(isMale ? 0.106 : 0.112, isMale ? 0.112 : 0.12, 0.088, 22),
      this.bottomMat
    );
    waistBand.scale.set(1.06, 1.0, 0.88);
    waistBand.position.set(0, 0.015, 0);
    waistBand.castShadow = true;
    this.bottomPelvisGroup.add(waistBand);

    if (style === 'skirt' || style === 'pleated_skirt') {
      const len = style === 'pleated_skirt' ? 0.165 : 0.145;
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(
          isMale ? 0.105 : 0.108,
          style === 'pleated_skirt' ? 0.185 : 0.155,
          len,
          style === 'pleated_skirt' ? 16 : 22
        ),
        this.bottomMat
      );
      skirt.scale.set(1.05, 1.0, 0.88);
      skirt.position.set(0, -len * 0.36, 0);
      skirt.castShadow = true;
      this.bottomPelvisGroup.add(skirt);
      return;
    }

    const isShorts = style === 'shorts';
    const rThigh = style === 'casual_pants' || style === 'long_pants' ? 0.06 : 0.058;
    const rShin = style === 'jeans' ? 0.047 : 0.052;

    for (const grp of [this.leftThighClothGroup, this.rightThighClothGroup]) {
      const t = new THREE.Mesh(
        createSeamlessLimbGeometry(rThigh, rThigh * 0.9, isShorts ? 0.09 : 0.155),
        this.bottomMat
      );
      t.castShadow = true;
      grp.add(t);
    }

    if (!isShorts) {
      for (const grp of [this.leftShinClothGroup, this.rightShinClothGroup]) {
        const s = new THREE.Mesh(
          createSeamlessLimbGeometry(rShin * 1.04, rShin * 0.9, 0.135),
          this.bottomMat
        );
        s.castShadow = true;
        grp.add(s);
      }
    }
  }

  private rebuildChibiFootwear(app: HumanAppearance): void {
    this.clearGroup(this.leftShoeGroup);
    this.clearGroup(this.rightShoeGroup);

    const style = app.footwearStyle;
    for (const grp of [this.leftShoeGroup, this.rightShoeGroup]) {
      if (style === 'sandals') {
        const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.065, 6, 10), this.soleMat);
        sole.rotation.x = Math.PI / 2;
        sole.scale.set(1.12, 0.42, 1.0);
        sole.position.set(0, -0.024, 0.02);
        grp.add(sole);
        const footSkin = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.033, 0.05, 6, 10),
          this.bodySkinMat
        );
        footSkin.rotation.x = Math.PI / 2;
        footSkin.scale.set(1.0, 0.65, 1.0);
        footSkin.position.set(0, -0.008, 0.018);
        grp.add(footSkin);
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.018, 0.032), this.shoeMat);
        strap.position.set(0, 0.004, 0.032);
        grp.add(strap);
      } else if (style === 'slippers') {
        const slip = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.065, 8, 12), this.shoeMat);
        slip.rotation.x = Math.PI / 2;
        slip.scale.set(1.12, 0.72, 1.0);
        slip.position.set(0, -0.012, 0.02);
        slip.castShadow = true;
        grp.add(slip);
      } else {
        // Chunky adorable rounded Chibi sneakers / casual shoes
        const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.072, 8, 12), this.soleMat);
        sole.rotation.x = Math.PI / 2;
        sole.scale.set(1.14, 0.48, 1.0);
        sole.position.set(0, -0.024, 0.022);
        grp.add(sole);

        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.041, 0.062, 8, 12), this.shoeMat);
        upper.rotation.x = Math.PI / 2;
        upper.scale.set(1.08, 0.78, 1.0);
        upper.position.set(0, -0.004, 0.02);
        upper.castShadow = true;
        grp.add(upper);
      }
    }
  }

  public getRightHandWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.propSocket.getWorldPosition(target);
  }

  public getCarryWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.carryAnchor.getWorldPosition(target);
  }

  /**
   * Live 3D Chibi preview pose for the Human Character Creator & Wardrobe.
   */
  public updatePreview(appearance: HumanAppearance, dt: number): void {
    this.applyAppearance(appearance);
    this.hideAllProps();
    this.clock += dt;

    this.root.position.set(0, 0, 0);
    this.pelvisPivot.position.set(0, 0.36, 0);
    this.pelvisPivot.rotation.set(0, 0, 0);
    this.spinePivot.rotation.set(0, 0, 0);
    this.chestPivot.rotation.set(0, Math.sin(this.clock * 1.1) * 0.04, 0);
    this.neckPivot.rotation.set(0.02, Math.sin(this.clock * 0.85) * 0.1, Math.sin(this.clock * 0.6) * 0.04);

    const breathe = Math.sin(this.clock * 2.4) * 0.02;
    this.leftShoulder.rotation.set(0.08 + breathe, 0, 0.16);
    this.rightShoulder.rotation.set(0.08 + breathe, 0, -0.16);
    this.leftElbow.rotation.set(-0.22, 0, 0);
    this.rightElbow.rotation.set(-0.22, 0, 0);
    this.leftHand.rotation.set(0, 0, 0);
    this.rightHand.rotation.set(0, 0, 0);

    this.leftHip.rotation.set(0, 0, 0.04);
    this.rightHip.rotation.set(0, 0, -0.04);
    this.leftKnee.rotation.set(0, 0, 0);
    this.rightKnee.rotation.set(0, 0, 0);
    this.leftFoot.rotation.set(0, 0, 0);
    this.rightFoot.rotation.set(0, 0, 0);

    this.updateBlinking(dt);
  }

  private updateBlinking(dt: number): void {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 3.2;
      this.blinkAmount = 1;
    }
    this.blinkAmount = Math.max(0, this.blinkAmount - dt * 8.0);
    const closed = this.blinkAmount > 0.35;
    if (this.leftEyelid) this.leftEyelid.visible = closed;
    if (this.rightEyelid) this.rightEyelid.visible = closed;
  }

  /**
   * Retargeted Chibi-Proportioned Third-Person Animation Update:
   * Smooth walking, kneeling, petting, brushing, pouring food, bottle feeding,
   * pouring water, playing with toys, cleaning equipment, and carrying the cat
   * with zero mesh separation or clipping!
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

    this.root.position.set(human.position.x, human.position.y, human.position.z);
    this.root.rotation.y = human.rotationY;

    const speed = Math.hypot(human.velocity.x, human.velocity.z);
    const isWalking = speed > 0.05 || human.animState === 'walk';
    if (isWalking) {
      // Cute brisk Chibi footsteps matching shorter legs!
      this.walkCycle += dt * Math.max(4.8, speed * 7.4);
    }

    let perfT = 0;
    const isPerforming = activeCareAction?.phase === 'performing';
    if (activeCareAction && isPerforming) {
      perfT = clamp((Date.now() - activeCareAction.phaseStartedAtMs) / activeCareAction.durationMs, 0, 1);
    }

    let targetCrouch = 0;
    let targetBend = 0;
    let lShoulderX = 0.06;
    let lShoulderZ = 0.14;
    let lElbowX = -0.18;
    let rShoulderX = 0.06;
    let rShoulderZ = -0.14;
    let rElbowX = -0.18;
    let rHandX = 0;
    let rHandZ = 0;

    if (isWalking) {
      const swing = Math.sin(this.walkCycle);
      lShoulderX = -swing * 0.52;
      rShoulderX = swing * 0.52;
      lElbowX = -0.26 - Math.max(0, -swing) * 0.22;
      rElbowX = -0.26 - Math.max(0, swing) * 0.22;
    }

    // Active feather wand play: Chibi holds wand playfully with right arm!
    if (!isPerforming && activeToyTarget && activeToyTarget.type === 'feather_wand') {
      const localToy = this.root.worldToLocal(
        new THREE.Vector3(activeToyTarget.x, activeToyTarget.y, activeToyTarget.z)
      );
      const sway = Math.sin(this.clock * 4.8) * 0.14;
      rShoulderX = clamp(-1.05 + localToy.y * 0.45, -1.4, -0.58);
      rShoulderZ = clamp(-localToy.x * 0.35 - 0.14 + sway, -0.68, 0.22);
      rElbowX = -0.35;
      targetBend = 0.12;
    }

    if (activeCareAction && isPerforming) {
      const type = activeCareAction.type;
      const midPhase = perfT >= 0.15 && perfT <= 0.85;
      const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
      const catLowFactor = clamp(1.04 - metrics.bodyScale * 0.2, 0.78, 1.04);

      switch (type) {
        case 'pet': {
          // Kneel warmly beside the cat (just like the reference scene!)
          targetCrouch = 0.82 * catLowFactor;
          targetBend = 0.34;
          if (activeCareAction.bitten && perfT >= 0.38) {
            rShoulderX = -0.3;
            rElbowX = -1.2;
            targetCrouch = 0.28;
            targetBend = 0.05;
          } else {
            const stroke = midPhase ? Math.sin(((perfT - 0.15) / 0.7) * Math.PI * 5) : 0;
            rShoulderX = -1.16 + stroke * 0.16;
            rShoulderZ = -0.18 + stroke * 0.1;
            rElbowX = -0.26 + stroke * 0.12;
            rHandX = 0.32;
            lShoulderX = -0.62;
            lElbowX = -0.35;
          }
          break;
        }

        case 'brush': {
          this.propBrush.visible = true;
          targetCrouch = 0.82 * catLowFactor;
          targetBend = 0.36;
          if (activeCareAction.bitten && perfT >= 0.38) {
            rShoulderX = -0.25;
            rElbowX = -1.15;
            targetCrouch = 0.25;
          } else {
            const sweep = midPhase ? Math.sin(((perfT - 0.15) / 0.7) * Math.PI * 6) : 0;
            rShoulderX = -1.12 + sweep * 0.2;
            rShoulderZ = -0.14 + Math.cos(sweep) * 0.12;
            rElbowX = -0.3;
            rHandZ = sweep * 0.25;
            lShoulderX = -0.58;
            lElbowX = -0.35;
          }
          break;
        }

        case 'feed': {
          const isMilk = activeCareAction.foodId === 'kitten_milk';
          if (isMilk) {
            this.propMilkBottle.visible = true;
            targetCrouch = 0.88;
            targetBend = 0.38;
            rShoulderX = -1.1;
            rElbowX = -0.38;
            rHandX = midPhase ? 0.42 : 0.15;
            lShoulderX = -0.82;
            lElbowX = -0.55;
          } else {
            this.propFoodContainer.visible = true;
            targetCrouch = 0.56;
            targetBend = 0.44;
            rShoulderX = -1.04;
            rElbowX = -0.28;
            rHandZ = midPhase ? 1.05 : 0.15;
            if (midPhase) {
              this.foodParticles.forEach((p, idx) => {
                p.visible = true;
                const cycle = (this.clock * 2.9 + idx * 0.19) % 1;
                p.position.set(
                  ((idx % 3) - 1) * 0.018,
                  -0.05 - cycle * 0.26,
                  0.09 + Math.sin(idx * 1.9) * 0.018
                );
              });
            }
          }
          break;
        }

        case 'water':
        case 'refill_fountain': {
          this.propWaterPitcher.visible = true;
          targetCrouch = 0.52;
          targetBend = 0.42;
          rShoulderX = -0.98;
          rElbowX = -0.32;
          rHandX = midPhase ? 0.6 : 0.1;
          this.waterStreamMesh.visible = midPhase;
          if (midPhase) {
            const shimmer = 0.9 + Math.sin(this.clock * 24) * 0.12;
            this.waterStreamMesh.scale.set(shimmer, 1, shimmer);
          }
          break;
        }

        case 'pickup': {
          if (perfT < 0.28) {
            const u = perfT / 0.28;
            targetCrouch = 0.84 * u;
            targetBend = 0.4 * u;
            lShoulderX = -1.12 * u;
            rShoulderX = -1.12 * u;
            lElbowX = -0.35 * u;
            rElbowX = -0.35 * u;
          } else if (perfT < 0.72) {
            targetCrouch = 0.04;
            targetBend = 0.04;
            const sway = Math.sin(((perfT - 0.28) / 0.44) * Math.PI * 2) * 0.07;
            lShoulderX = -0.78;
            rShoulderX = -0.78;
            lShoulderZ = -0.22 + sway;
            rShoulderZ = 0.22 + sway;
            lElbowX = -1.02;
            rElbowX = -1.02;
          } else {
            const u = 1 - (perfT - 0.72) / 0.28;
            targetCrouch = 0.8 * Math.sin((1 - u) * Math.PI);
            targetBend = 0.38 * Math.sin((1 - u) * Math.PI);
            lShoulderX = -1.02 * u;
            rShoulderX = -1.02 * u;
            lElbowX = -0.45 * u;
            rElbowX = -0.45 * u;
          }
          break;
        }

        case 'clean_litter':
        case 'empty_auto_litter':
        case 'clean_fountain':
        case 'clean_room': {
          this.propLitterScoop.visible = type === 'clean_litter' || type === 'empty_auto_litter';
          targetCrouch = 0.62;
          targetBend = 0.42;
          const scoopPhase = midPhase ? (perfT - 0.15) / 0.7 : 0;
          const dip = Math.sin(scoopPhase * Math.PI);
          rShoulderX = -0.92 - dip * 0.28;
          rElbowX = -0.28 + dip * 0.16;
          rHandX = -0.2 + dip * 0.52;
          this.propScoopClump.visible = scoopPhase > 0.45;
          break;
        }

        case 'respect_space': {
          targetCrouch = 0;
          targetBend = -0.04;
          lShoulderX = -0.58;
          rShoulderX = -0.58;
          lShoulderZ = 0.28;
          rShoulderZ = -0.28;
          lElbowX = -0.62;
          rElbowX = -0.62;
          break;
        }

        case 'sleep': {
          targetCrouch = 0.72;
          targetBend = 0.34;
          rShoulderX = -0.98;
          rElbowX = -0.32;
          lShoulderX = -0.52;
          break;
        }

        case 'play_toy': {
          targetBend = 0.14;
          const wave = Math.sin(this.clock * 6.5);
          rShoulderX = -1.12 + wave * 0.26;
          rShoulderZ = -0.22 + Math.cos(this.clock * 4.5) * 0.3;
          rElbowX = -0.32;
          break;
        }
      }
    }

    const blend = Math.min(1, dt * 8.0);
    this.crouchBlend = lerp(this.crouchBlend, targetCrouch, blend);
    this.bendBlend = lerp(this.bendBlend, targetBend, blend);

    // Chibi-tuned pelvis bob & cozy kneeling height (knees tuck neatly without clipping floor!)
    const walkBob = isWalking ? Math.abs(Math.sin(this.walkCycle)) * 0.022 : 0;
    const kneelDrop = this.crouchBlend * 0.155;
    this.pelvisPivot.position.y = 0.36 - kneelDrop + walkBob;
    this.spinePivot.rotation.x = this.bendBlend;

    // Seamless short Chibi leg stride & cute kneeling pose
    const legSwing = isWalking ? Math.sin(this.walkCycle) * 0.56 : 0;
    const leftHipTarget = lerp(legSwing, -1.02, this.crouchBlend);
    const rightHipTarget = lerp(-legSwing, -0.82, this.crouchBlend);
    const leftKneeTarget = lerp(Math.max(0, -Math.cos(this.walkCycle)) * (isWalking ? 0.55 : 0), 1.65, this.crouchBlend);
    const rightKneeTarget = lerp(Math.max(0, Math.cos(this.walkCycle)) * (isWalking ? 0.55 : 0), 1.45, this.crouchBlend);

    this.leftHip.rotation.x = lerp(this.leftHip.rotation.x, leftHipTarget, blend);
    this.rightHip.rotation.x = lerp(this.rightHip.rotation.x, rightHipTarget, blend);
    this.leftKnee.rotation.x = lerp(this.leftKnee.rotation.x, leftKneeTarget, blend);
    this.rightKnee.rotation.x = lerp(this.rightKnee.rotation.x, rightKneeTarget, blend);
    this.leftFoot.rotation.x = lerp(this.leftFoot.rotation.x, -this.crouchBlend * 0.45, blend);
    this.rightFoot.rotation.x = lerp(this.rightFoot.rotation.x, -this.crouchBlend * 0.45, blend);

    // Seamless Chibi arms & hands
    this.leftShoulder.rotation.x = lerp(this.leftShoulder.rotation.x, lShoulderX, blend);
    this.leftShoulder.rotation.z = lerp(this.leftShoulder.rotation.z, lShoulderZ, blend);
    this.leftElbow.rotation.x = lerp(this.leftElbow.rotation.x, lElbowX, blend);

    this.rightShoulder.rotation.x = lerp(this.rightShoulder.rotation.x, rShoulderX, blend);
    this.rightShoulder.rotation.z = lerp(this.rightShoulder.rotation.z, rShoulderZ, blend);
    this.rightElbow.rotation.x = lerp(this.rightElbow.rotation.x, rElbowX, blend);
    this.rightHand.rotation.x = lerp(this.rightHand.rotation.x, rHandX, blend);
    this.rightHand.rotation.z = lerp(this.rightHand.rotation.z, rHandZ, blend);

    // Expressive gentle Chibi head tilt & gaze toward the cat!
    const catLocal = this.root.worldToLocal(
      new THREE.Vector3(cat.position.x, cat.position.y + 0.16, cat.position.z)
    );
    const headYaw = clamp(Math.atan2(catLocal.x, catLocal.z), -0.65, 0.65);
    const headPitch = clamp(0.14 + this.crouchBlend * 0.1 - this.bendBlend * 0.42, -0.22, 0.36);
    const cuteTilt = isPerforming ? Math.sin(this.clock * 2.1) * 0.08 : Math.sin(this.clock * 0.9) * 0.03;
    this.neckPivot.rotation.y = lerp(this.neckPivot.rotation.y, headYaw, Math.min(1, dt * 5.5));
    this.neckPivot.rotation.x = lerp(this.neckPivot.rotation.x, headPitch, Math.min(1, dt * 5.5));
    this.neckPivot.rotation.z = lerp(this.neckPivot.rotation.z, cuteTilt, Math.min(1, dt * 4.0));
  }
}
