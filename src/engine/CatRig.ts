import * as THREE from 'three';
import { getBreedDefinition } from '../config/breeds';
import { ACCESSORY_CATALOG } from '../config/catalog';
import { clamp, computeGrowthMetrics, lerp } from '../simulation/growth';
import { AccessoryId, CatIdentity, CatRuntimeState } from '../types/game';
import { createFurCardAlphaTexture, createFurTexture } from './textures';

/**
 * Enhanced Fluffy Articulated 3D Cat Rig (Procedural Fur-Card Architecture).
 *
 * Features:
 * - 10 breed-distinct morphologies (head roundness, muzzle, ear size/tufts, leg length, fluffiness)
 * - Layered soft fur tufts & alpha fur cards on cheeks, chest ruff, belly, ears & plush tail
 * - Dynamic body condition visual morphing (underweight / lean / healthy / overweight)
 * - 7 realistic feline emotions expressed through eyes, dilated/slit pupils, slow-blinking eyelids,
 *   ear rotation/flattening ("airplane ears"), whisker spread, animated jaw/mouth (meow/hiss/yawn),
 *   head tilting, head bunting, paw kneading, pounce hindquarters wiggle, and expressive tail!
 * - Wearable 3D neck accessories (ribbon, bell collar, bandana, bow)
 *
 * NOTE: Uses procedural geometry & canvas fur cards for mobile browser performance without
 * copyrighted third-party assets. Ready to swap with a rigged `.glb` feline asset (see ASSETS_MANIFEST.md).
 */
export class CatRig {
  public readonly root = new THREE.Group();
  private readonly bodyPivot = new THREE.Group();
  private readonly torsoGroup = new THREE.Group();
  private readonly torsoMesh: THREE.Mesh;
  private readonly bellyFurMesh: THREE.Mesh;
  private readonly chestRuffGroup = new THREE.Group();
  private readonly neckPivot = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly skullMesh: THREE.Mesh;
  private readonly muzzleGroup = new THREE.Group();
  private readonly lowerJawPivot = new THREE.Group();
  private readonly cheekFluffGroup = new THREE.Group();
  private readonly whiskerLeftPivot = new THREE.Group();
  private readonly whiskerRightPivot = new THREE.Group();

  private readonly earLeftPivot = new THREE.Group();
  private readonly earRightPivot = new THREE.Group();
  private readonly earTuftLeft: THREE.Mesh;
  private readonly earTuftRight: THREE.Mesh;
  private readonly leftEyelid: THREE.Mesh;
  private readonly rightEyelid: THREE.Mesh;
  private readonly leftPupil: THREE.Mesh;
  private readonly rightPupil: THREE.Mesh;

  private readonly accessoryGroup = new THREE.Group();
  private readonly furTufts: THREE.Mesh[] = [];

  private readonly legs: {
    pivot: THREE.Group;
    lower: THREE.Group;
    isFront: boolean;
    isLeft: boolean;
  }[] = [];

  private readonly tailSegments: THREE.Group[] = [];
  private readonly tailFluffMeshes: THREE.Mesh[] = [];

  private furMat: THREE.MeshStandardMaterial;
  private pointMat: THREE.MeshStandardMaterial;
  private bellyMat: THREE.MeshStandardMaterial;
  private furCardMat: THREE.MeshStandardMaterial;
  private irisMat: THREE.MeshStandardMaterial;
  private currentAppearanceKey = '';
  private currentAccessory: AccessoryId = 'none';

  private walkCycle = 0;
  private animClock = 0;
  private blinkTimer = 3.4;
  private blinkAmount = 0;
  private sleepBlend = 0;
  private sitBlend = 0;
  private stretchBlend = 0;
  private crouchBlend = 0;

  constructor(identity: CatIdentity) {
    this.root.name = 'cat_root';
    this.root.userData = { interactable: 'cat' };

    const furTex = createFurTexture(identity.furColor, identity.furSecondary, identity.furPattern);
    const furCardAlpha = createFurCardAlphaTexture();

    this.furMat = new THREE.MeshStandardMaterial({
      map: furTex,
      roughness: 0.9,
      metalness: 0.01
    });
    this.pointMat = new THREE.MeshStandardMaterial({
      color: identity.furPattern === 'colorpoint' ? identity.furSecondary : identity.furColor,
      roughness: 0.9,
      metalness: 0.01
    });
    this.bellyMat = new THREE.MeshStandardMaterial({
      color: this.computeSoftBellyHex(identity),
      roughness: 0.94,
      metalness: 0.0
    });
    this.furCardMat = new THREE.MeshStandardMaterial({
      color: identity.furColor,
      alphaMap: furCardAlpha,
      transparent: true,
      alphaTest: 0.14,
      side: THREE.DoubleSide,
      roughness: 0.95,
      depthWrite: false
    });
    this.irisMat = new THREE.MeshStandardMaterial({
      color: identity.eyeColor,
      roughness: 0.14,
      metalness: 0.08
    });

    const pinkSkinMat = new THREE.MeshStandardMaterial({ color: '#dfa4a0', roughness: 0.72 });
    const noseMat = new THREE.MeshStandardMaterial({
      color: identity.furPattern === 'colorpoint' || identity.furColorId === 'black' ? '#463434' : '#dc8e8d',
      roughness: 0.42
    });
    const innerMouthMat = new THREE.MeshStandardMaterial({ color: '#c46c72', roughness: 0.65 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#101014', roughness: 0.06 });
    const whiskerMat = new THREE.MeshBasicMaterial({ color: '#f6f2eb' });

    // Body pivot
    this.bodyPivot.position.set(0, 0.24, 0);
    this.root.add(this.bodyPivot);
    this.bodyPivot.add(this.torsoGroup);

    // Sculpted feline torso + chest + haunches + soft belly pouch
    const torsoGeo = new THREE.CapsuleGeometry(0.095, 0.24, 12, 20);
    torsoGeo.rotateX(Math.PI / 2);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.furMat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoGroup.add(this.torsoMesh);

    const chestMesh = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 14), this.furMat);
    chestMesh.scale.set(0.98, 1.0, 1.08);
    chestMesh.position.set(0, 0.012, 0.125);
    chestMesh.castShadow = true;
    this.torsoGroup.add(chestMesh);

    const rumpMesh = new THREE.Mesh(new THREE.SphereGeometry(0.099, 16, 14), this.furMat);
    rumpMesh.scale.set(1.0, 1.02, 1.06);
    rumpMesh.position.set(0, 0.01, -0.135);
    rumpMesh.castShadow = true;
    this.torsoGroup.add(rumpMesh);

    // Soft belly fur volume (expands gently when overweight, tucks when lean!)
    const bellyGeo = new THREE.SphereGeometry(0.088, 16, 12);
    bellyGeo.scale(0.92, 0.72, 1.48);
    this.bellyFurMesh = new THREE.Mesh(bellyGeo, this.bellyMat);
    this.bellyFurMesh.position.set(0, -0.042, 0.0);
    this.torsoGroup.add(this.bellyFurMesh);

    // Fluffy chest ruff & dorsal fur cards (scaled by breed furFluffiness!)
    this.chestRuffGroup.position.set(0, 0.015, 0.185);
    this.torsoGroup.add(this.chestRuffGroup);
    const ruffOffsets = [
      [0, -0.025, 0.035, 0.14],
      [-0.045, -0.015, 0.02, 0.12],
      [0.045, -0.015, 0.02, 0.12],
      [0, 0.02, 0.025, 0.12]
    ];
    for (const [rx, ry, rz, sz] of ruffOffsets) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), this.furCardMat);
      card.position.set(rx, ry, rz);
      card.rotation.y = rx * 4;
      this.chestRuffGroup.add(card);
      this.furTufts.push(card);
    }

    // Layered soft back & flank fur cards for authentic fluffy silhouette
    for (let i = 0; i < 8; i++) {
      const zPos = -0.15 + (i / 7) * 0.29;
      for (const side of [-1, 1] as const) {
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), this.furCardMat);
        card.position.set(side * 0.088, 0.015 + (i % 2) * 0.025, zPos);
        card.rotation.y = side * Math.PI * 0.44;
        card.rotation.z = side * 0.2;
        this.torsoGroup.add(card);
        this.furTufts.push(card);
      }
    }

    // Neck & Accessory Mount
    this.neckPivot.position.set(0, 0.072, 0.185);
    this.bodyPivot.add(this.neckPivot);

    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.075, 0.095, 14),
      this.furMat
    );
    neckMesh.position.set(0, 0.032, 0.018);
    neckMesh.rotation.x = 0.42;
    neckMesh.castShadow = true;
    this.neckPivot.add(neckMesh);

    this.accessoryGroup.position.set(0, 0.025, 0.022);
    this.accessoryGroup.rotation.x = 0.42;
    this.neckPivot.add(this.accessoryGroup);

    // Head Group
    this.headGroup.position.set(0, 0.092, 0.052);
    this.neckPivot.add(this.headGroup);

    const skullGeo = new THREE.SphereGeometry(0.09, 20, 18);
    skullGeo.scale(1.08, 0.96, 1.02);
    this.skullMesh = new THREE.Mesh(skullGeo, this.furMat);
    this.skullMesh.castShadow = true;
    this.headGroup.add(this.skullMesh);

    // Fluffy soft cheek tufts (makes kittens & plush breeds extra adorable!)
    this.headGroup.add(this.cheekFluffGroup);
    for (const side of [-1, 1] as const) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), this.furMat);
      cheek.position.set(side * 0.062, -0.022, 0.024);
      cheek.scale.set(1.05, 0.85, 0.9);
      this.cheekFluffGroup.add(cheek);

      const cheekCard = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.085), this.furCardMat);
      cheekCard.position.set(side * 0.088, -0.022, 0.025);
      cheekCard.rotation.y = side * 0.32;
      this.cheekFluffGroup.add(cheekCard);
      this.furTufts.push(cheekCard);
    }

    // Muzzle + Whisker Pads + Nose + Animated Mouth/Jaw
    this.muzzleGroup.position.set(0, -0.018, 0.068);
    this.headGroup.add(this.muzzleGroup);

    for (const side of [-1, 1] as const) {
      const pad = new THREE.Mesh(
        new THREE.SphereGeometry(0.027, 12, 10),
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      pad.position.set(side * 0.021, -0.006, 0.016);
      pad.scale.set(1.05, 0.88, 0.95);
      this.muzzleGroup.add(pad);
    }

    const noseGeo = new THREE.ConeGeometry(0.015, 0.014, 3);
    noseGeo.rotateX(Math.PI * 0.56);
    const noseMesh = new THREE.Mesh(noseGeo, noseMat);
    noseMesh.position.set(0, 0.006, 0.04);
    this.muzzleGroup.add(noseMesh);

    // Inner mouth + animated lower jaw (opens smoothly for meow, hiss, yawn!)
    const mouthCavity = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), innerMouthMat);
    mouthCavity.position.set(0, -0.015, 0.018);
    mouthCavity.scale.set(1.0, 0.72, 0.8);
    this.muzzleGroup.add(mouthCavity);

    this.lowerJawPivot.position.set(0, -0.022, 0.008);
    this.muzzleGroup.add(this.lowerJawPivot);
    const chinMesh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), this.furMat);
    chinMesh.position.set(0, -0.006, 0.018);
    chinMesh.scale.set(1.05, 0.75, 1.0);
    this.lowerJawPivot.add(chinMesh);

    // Detailed glossy feline eyes + vertical slit pupils + double specular glints + eyelids
    const buildEye = (side: -1 | 1) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.039, 0.016, 0.072);
      eyeGroup.rotation.y = side * 0.2;

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0205, 16, 14), this.irisMat);
      iris.scale.set(1.04, 0.98, 0.65);
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 10), pupilMat);
      pupil.scale.set(0.42, 0.95, 0.46);
      pupil.position.set(0, 0, 0.0095);
      eyeGroup.add(pupil);

      const glint1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.0042, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      glint1.position.set(0.006, 0.006, 0.0145);
      eyeGroup.add(glint1);

      const glint2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.0022, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      glint2.position.set(-0.005, -0.004, 0.014);
      eyeGroup.add(glint2);

      const lidGeo = new THREE.SphereGeometry(0.023, 14, 12);
      lidGeo.scale(1.08, 1.04, 0.72);
      const lid = new THREE.Mesh(
        lidGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      lid.position.set(0, 0, 0.0012);
      eyeGroup.add(lid);

      this.headGroup.add(eyeGroup);
      return { lid, pupil };
    };

    const leftEye = buildEye(-1);
    const rightEye = buildEye(1);
    this.leftEyelid = leftEye.lid;
    this.rightEyelid = rightEye.lid;
    this.leftPupil = leftEye.pupil;
    this.rightPupil = rightEye.pupil;

    // Articulated Expressive Ears + Optional Lynx Ear Tufts (Maine Coon / Persian / Ragdoll)
    const buildEar = (side: -1 | 1, pivot: THREE.Group) => {
      pivot.position.set(side * 0.056, 0.068, 0.002);
      pivot.rotation.z = -side * 0.22;
      pivot.rotation.y = side * 0.18;

      const outerGeo = new THREE.ConeGeometry(0.038, 0.082, 5);
      outerGeo.scale(1.0, 1.0, 0.68);
      const outer = new THREE.Mesh(
        outerGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      outer.position.set(0, 0.034, 0);
      outer.castShadow = true;
      pivot.add(outer);

      const innerGeo = new THREE.ConeGeometry(0.024, 0.056, 5);
      innerGeo.scale(1.0, 1.0, 0.45);
      const inner = new THREE.Mesh(innerGeo, pinkSkinMat);
      inner.position.set(0, 0.03, 0.009);
      pivot.add(inner);

      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.01, 0.026, 4),
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      tuft.position.set(0, 0.08, 0);
      pivot.add(tuft);

      this.headGroup.add(pivot);
      return tuft;
    };
    this.earTuftLeft = buildEar(-1, this.earLeftPivot);
    this.earTuftRight = buildEar(1, this.earRightPivot);

    // Expressive Whiskers (pivot outward when relaxed/curious, pull back when fearful/defensive!)
    const buildWhiskers = (side: -1 | 1, pivot: THREE.Group) => {
      pivot.position.set(side * 0.044, -0.022, 0.082);
      for (let i = 0; i < 4; i++) {
        const wGeo = new THREE.CylinderGeometry(0.0009, 0.00035, 0.095, 4);
        wGeo.rotateZ(Math.PI / 2);
        const w = new THREE.Mesh(wGeo, whiskerMat);
        w.position.set(side * 0.04, (i - 1.5) * 0.007, 0);
        w.rotation.y = -side * (0.16 + i * 0.08);
        w.rotation.z = side * (i - 1.5) * 0.08;
        pivot.add(w);
      }
      this.headGroup.add(pivot);
    };
    buildWhiskers(-1, this.whiskerLeftPivot);
    buildWhiskers(1, this.whiskerRightPivot);

    // Four Articulated Soft-Pawed Legs
    const legSpecs = [
      { x: -0.062, z: 0.138, isFront: true, isLeft: true },
      { x: 0.062, z: 0.138, isFront: true, isLeft: false },
      { x: -0.065, z: -0.142, isFront: false, isLeft: true },
      { x: 0.065, z: -0.142, isFront: false, isLeft: false }
    ];

    for (const spec of legSpecs) {
      const pivot = new THREE.Group();
      pivot.position.set(spec.x, -0.024, spec.z);
      this.bodyPivot.add(pivot);

      const upperMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.088, 6, 10), this.furMat);
      upperMesh.position.set(0, -0.052, 0);
      upperMesh.castShadow = true;
      pivot.add(upperMesh);

      const lower = new THREE.Group();
      lower.position.set(0, -0.106, 0);
      pivot.add(lower);

      const lowerMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.025, 0.082, 6, 10),
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      lowerMesh.position.set(0, -0.046, 0.006);
      lowerMesh.castShadow = true;
      lower.add(lowerMesh);

      const pawGeo = new THREE.SphereGeometry(0.031, 12, 10);
      pawGeo.scale(1.05, 0.65, 1.3);
      const pawMat =
        identity.furPattern === 'bicolor'
          ? new THREE.MeshStandardMaterial({ color: '#f6f2eb', roughness: 0.88 })
          : identity.furPattern === 'colorpoint'
            ? this.pointMat
            : this.furMat;
      const pawMesh = new THREE.Mesh(pawGeo, pawMat);
      pawMesh.position.set(0, -0.092, 0.018);
      pawMesh.castShadow = true;
      lower.add(pawMesh);

      this.legs.push({ pivot, lower, isFront: spec.isFront, isLeft: spec.isLeft });
    }

    // 4-Segment Fluffy Articulated Tail with soft fur plumes
    let parentObj: THREE.Object3D = this.bodyPivot;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      if (i === 0) seg.position.set(0, 0.045, -0.205);
      else seg.position.set(0, 0, -0.082);

      const radiusTop = 0.026 - i * 0.003;
      const radiusBot = 0.022 - i * 0.0025;
      const segGeo = new THREE.CylinderGeometry(radiusBot, radiusTop, 0.092, 12);
      segGeo.rotateX(Math.PI / 2);
      const segMesh = new THREE.Mesh(
        segGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      segMesh.position.set(0, 0, -0.042);
      segMesh.castShadow = true;
      seg.add(segMesh);

      // Soft fur plume card along tail segment
      const fluffCard = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.088), this.furCardMat);
      fluffCard.position.set(0, 0, -0.044);
      fluffCard.rotation.y = Math.PI / 2;
      seg.add(fluffCard);
      this.tailFluffMeshes.push(fluffCard);

      parentObj.add(seg);
      this.tailSegments.push(seg);
      parentObj = seg;
    }

    this.root.traverse((obj) => {
      obj.userData.interactable = 'cat';
    });

    this.applyAppearance(identity);
    this.syncAccessory(identity.equippedAccessory);
  }

  private computeSoftBellyHex(identity: CatIdentity): string {
    if (identity.furPattern === 'bicolor' || identity.furPattern === 'calico') return '#f7f3ed';
    return identity.furColor;
  }

  private makeAppearanceKey(id: CatIdentity): string {
    return `${id.breed}_${id.furColor}_${id.furSecondary}_${id.furPattern}_${id.eyeColor}`;
  }

  public applyAppearance(identity: CatIdentity): void {
    const key = this.makeAppearanceKey(identity);
    if (key === this.currentAppearanceKey) return;
    this.currentAppearanceKey = key;

    this.furMat.map = createFurTexture(identity.furColor, identity.furSecondary, identity.furPattern);
    this.furMat.needsUpdate = true;
    this.pointMat.color.set(
      identity.furPattern === 'colorpoint' ? identity.furSecondary : identity.furColor
    );
    this.bellyMat.color.set(this.computeSoftBellyHex(identity));
    this.furCardMat.color.set(identity.furColor);
    this.irisMat.color.set(identity.eyeColor);

    // Apply breed-specific ear tufts
    const morph = getBreedDefinition(identity.breed).morphology;
    this.earTuftLeft.visible = morph.earTuft;
    this.earTuftRight.visible = morph.earTuft;
  }

  public syncAccessory(accessoryId: AccessoryId): void {
    if (this.currentAccessory === accessoryId) return;
    this.currentAccessory = accessoryId;

    while (this.accessoryGroup.children.length > 0) {
      this.accessoryGroup.remove(this.accessoryGroup.children[0]);
    }
    if (accessoryId === 'none') return;

    const item = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
    const mat = new THREE.MeshStandardMaterial({
      color: item?.colorHex ?? '#d4745e',
      roughness: 0.65
    });

    // Soft collar band around neck
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.011, 10, 22), mat);
    band.rotation.x = Math.PI / 2;
    this.accessoryGroup.add(band);

    if (accessoryId === 'bell_collar_gold') {
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#e5bd56', metalness: 0.72, roughness: 0.25 })
      );
      bell.position.set(0, -0.016, 0.074);
      this.accessoryGroup.add(bell);
    } else if (accessoryId === 'linen_bandana') {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.072, 3), mat);
      tri.rotation.x = Math.PI;
      tri.scale.set(1.0, 1.0, 0.28);
      tri.position.set(0, -0.042, 0.064);
      this.accessoryGroup.add(tri);
    } else {
      // Bow or ribbon knot at front throat
      for (const side of [-1, 1] as const) {
        const loop = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mat);
        loop.scale.set(1.25, 0.7, 0.55);
        loop.position.set(side * 0.02, -0.008, 0.074);
        this.accessoryGroup.add(loop);
      }
    }
  }

  /**
   * Renders a cute, gentle breathing preview pose (used on the 3D Customization screen!).
   */
  public updatePreview(identity: CatIdentity, dt: number, ageDays = 28): void {
    this.applyAppearance(identity);
    this.syncAccessory(identity.equippedAccessory);

    const morph = getBreedDefinition(identity.breed).morphology;
    const metrics = computeGrowthMetrics(identity.breed, ageDays);
    this.animClock += dt;

    // Normalize preview scale so all breeds fill the 3D card nicely
    const previewScale = 1.18 * (0.75 + morph.adultScale * 0.25);
    this.root.scale.setScalar(previewScale);

    // Apply breed anatomy & kitten roundness
    this.torsoGroup.scale.set(morph.torsoWidth, 1.0, morph.torsoLength);
    this.headGroup.scale.set(
      metrics.headRatio * morph.headWidth,
      metrics.headRatio * morph.headRoundness,
      metrics.headRatio
    );
    this.muzzleGroup.scale.set(1, 1, morph.muzzleLength);
    this.earLeftPivot.scale.setScalar(metrics.earRatio * morph.earSize);
    this.earRightPivot.scale.setScalar(metrics.earRatio * morph.earSize);
    this.cheekFluffGroup.scale.setScalar(0.65 + morph.furFluffiness * 0.65);
    for (const card of this.furTufts) {
      card.visible = morph.furFluffiness > 0.35;
      card.scale.setScalar(0.55 + morph.furFluffiness * 0.75);
    }
    for (const seg of this.tailFluffMeshes) {
      seg.visible = morph.tailPlushness > 0.95;
      seg.scale.setScalar(morph.tailPlushness * 0.95);
    }
    for (const leg of this.legs) {
      leg.pivot.scale.set(1, metrics.legRatio * morph.legLength, 1);
      leg.pivot.rotation.x = !leg.isFront ? 0.88 : 0.18;
      leg.lower.rotation.x = !leg.isFront ? -1.15 : 0;
    }

    const standH = 0.068 + 0.155 * metrics.legRatio * morph.legLength;
    this.bodyPivot.position.y = standH * 0.86;
    this.bodyPivot.rotation.set(-0.3, 0, 0);

    // Gentle curious head tilt & slow blink
    this.neckPivot.rotation.y = Math.sin(this.animClock * 1.1) * 0.18;
    this.neckPivot.rotation.z = Math.sin(this.animClock * 0.7) * 0.1;
    this.neckPivot.rotation.x = 0.12;

    this.leftEyelid.visible = false;
    this.rightEyelid.visible = false;
    this.leftPupil.scale.x = 0.65;
    this.rightPupil.scale.x = 0.65;

    for (let i = 0; i < this.tailSegments.length; i++) {
      this.tailSegments[i].rotation.y = Math.sin(this.animClock * 2.2 - i * 0.6) * 0.18;
      this.tailSegments[i].rotation.x = i === 0 ? 0.35 : 0.15;
    }
  }

  /**
   * Main gameplay update: drives breed morphology, gradual growth, body condition fat morphing,
   * fur fluffiness, 7 feline emotions, and all 21 expressive behaviors!
   */
  public update(
    state: CatRuntimeState,
    dt: number,
    lookAtWorld?: THREE.Vector3 | null
  ): void {
    this.applyAppearance(state.identity);
    this.syncAccessory(state.identity.equippedAccessory);

    const morph = getBreedDefinition(state.identity.breed).morphology;
    const metrics = computeGrowthMetrics(state.identity.breed, state.ageDays);
    const emotion = state.emotion;

    this.animClock += dt;

    // 1. World position & facing
    this.root.position.set(state.position.x, state.position.y, state.position.z);
    this.root.rotation.y = state.rotationY;

    // 2. Continuous Growth + Breed Morphology + Dynamic Weight/Body Condition Morphing!
    const fat = clamp(state.weight.bodyFatIndex, -0.75, 0.85);
    const widthWeightFactor = 1 + fat * 0.28;   // Lean slims waist; overweight widens torso gradually
    const bellyScaleY = 0.72 + Math.max(0, fat) * 0.55 - Math.max(0, -fat) * 0.28;

    this.root.scale.setScalar(metrics.bodyScale);
    this.torsoGroup.scale.set(
      morph.torsoWidth * widthWeightFactor,
      1 + Math.max(0, fat) * 0.14,
      morph.torsoLength
    );
    this.bellyFurMesh.scale.set(0.92 * widthWeightFactor, bellyScaleY, 1.48);
    this.bellyFurMesh.position.y = -0.042 - Math.max(0, fat) * 0.018;

    this.headGroup.scale.set(
      metrics.headRatio * morph.headWidth,
      metrics.headRatio * morph.headRoundness,
      metrics.headRatio
    );
    this.muzzleGroup.scale.set(1, 1, morph.muzzleLength);
    this.earLeftPivot.scale.setScalar(metrics.earRatio * morph.earSize);
    this.earRightPivot.scale.setScalar(metrics.earRatio * morph.earSize);

    // Fluffiness & natural fur micro-movement
    const fluffFactor = morph.furFluffiness;
    this.cheekFluffGroup.scale.setScalar(0.65 + fluffFactor * 0.65);
    const puffUp = emotion === 'defensive_angry' ? 1.24 : 1.0; // Piloerection when hissing!
    for (let i = 0; i < this.furTufts.length; i++) {
      const card = this.furTufts[i];
      card.visible = fluffFactor > 0.34 || emotion === 'defensive_angry';
      const sway = Math.sin(this.animClock * 3.2 + i) * 0.04;
      card.scale.setScalar((0.5 + fluffFactor * 0.72) * puffUp);
      card.rotation.x = sway;
    }
    for (const seg of this.tailFluffMeshes) {
      seg.visible = morph.tailPlushness > 0.92 || emotion === 'defensive_angry';
      seg.scale.setScalar(morph.tailPlushness * (emotion === 'defensive_angry' ? 1.32 : 0.96));
    }

    for (const leg of this.legs) {
      leg.pivot.scale.set(1, metrics.legRatio * morph.legLength, 1);
    }
    this.tailSegments[0].scale.set(
      morph.tailPlushness * 0.92,
      morph.tailPlushness * 0.92,
      metrics.tailRatio
    );

    // 3. Smooth Posture Blending (Sleep, Sit, Stretch, Crouch/Pounce/Fear)
    const targetSleep = state.behavior === 'sleep' ? 1 : 0;
    const targetSit =
      state.behavior === 'sit' ||
      state.behavior === 'groom' ||
      state.behavior === 'observe' ||
      state.behavior === 'yawn'
        ? 1
        : 0;
    const targetStretch = state.behavior === 'stretch' ? 1 : 0;
    const targetCrouch =
      state.behavior === 'pounce_crouch' ||
      state.behavior === 'hide' ||
      emotion === 'fearful'
        ? 1
        : 0;

    const blendRate = Math.min(1, dt * 5.2);
    this.sleepBlend = lerp(this.sleepBlend, targetSleep, blendRate);
    this.sitBlend = lerp(this.sitBlend, targetSit, blendRate);
    this.stretchBlend = lerp(this.stretchBlend, targetStretch, blendRate);
    this.crouchBlend = lerp(this.crouchBlend, targetCrouch, blendRate);

    // 4. Breathing & Purring micro-vibration
    const breathRate = state.behavior === 'sleep' ? 2.0 : emotion === 'fearful' ? 5.2 : 3.3;
    const breath = Math.sin(this.animClock * breathRate) * 0.018;
    const purrVib = state.isPurring ? Math.sin(this.animClock * 38) * 0.0024 : 0;
    this.torsoMesh.scale.set(1 + breath, 1 + breath * 0.9, 1);

    // 5. Elevation, Pitch & Expressive Spine Posture
    const standingHeight = 0.068 + 0.172 * metrics.legRatio * morph.legLength;
    const sleepHeight = 0.092;
    const sitHeight = standingHeight * 0.86;
    const crouchHeight = standingHeight * 0.66;

    let baseHeight = standingHeight;
    baseHeight = lerp(baseHeight, sitHeight, this.sitBlend);
    baseHeight = lerp(baseHeight, crouchHeight, this.crouchBlend);
    baseHeight = lerp(baseHeight, sleepHeight, this.sleepBlend);

    const speed = Math.hypot(state.velocity.x, state.velocity.z);
    const normalizedSpeed = Math.min(1.4, speed / Math.max(0.2, metrics.maxMoveSpeed));
    this.walkCycle += dt * (speed * 11.5);

    const walkBob = speed > 0.04 ? Math.abs(Math.sin(this.walkCycle)) * 0.012 : 0;
    this.bodyPivot.position.y = baseHeight + walkBob + purrVib;

    let bodyPitch = 0;
    let bodyRoll = this.sleepBlend * 0.24;
    if (this.sitBlend > 0.01) bodyPitch -= 0.34 * this.sitBlend;
    if (this.stretchBlend > 0.01) bodyPitch += 0.28 * this.stretchBlend;
    if (state.behavior === 'eat' || state.behavior === 'drink') bodyPitch += 0.24;
    if (state.behavior === 'pounce_crouch') {
      bodyPitch += 0.18;
      // Iconic adorable feline pounce hindquarters wiggle!
      bodyRoll += Math.sin(this.animClock * 16) * 0.14;
    }
    if (state.behavior === 'hiss_defend') {
      // Defensive arched-back posture
      bodyPitch -= 0.12;
      this.torsoMesh.scale.y += 0.12;
    }
    this.bodyPivot.rotation.set(bodyPitch, 0, bodyRoll);

    // 6. Articulated Legs (Walking, Sitting, Kneading, Defensive Swat, Sleeping)
    for (const leg of this.legs) {
      const phaseOffset =
        (leg.isFront ? 0 : Math.PI) + (leg.isLeft ? 0 : Math.PI * 0.85);
      const strideAmp = speed > 0.03 ? 0.52 * Math.min(1, normalizedSpeed + 0.25) : 0;
      let upperRot = Math.sin(this.walkCycle + phaseOffset) * strideAmp;
      let lowerRot = Math.max(0, -Math.cos(this.walkCycle + phaseOffset)) * strideAmp * 0.7;

      if (this.sleepBlend > 0.01) {
        upperRot = lerp(upperRot, leg.isFront ? -1.15 : 1.15, this.sleepBlend);
        lowerRot = lerp(lowerRot, leg.isFront ? 1.45 : -1.25, this.sleepBlend);
      }
      if (this.sitBlend > 0.01) {
        if (!leg.isFront) {
          upperRot = lerp(upperRot, 0.94, this.sitBlend);
          lowerRot = lerp(lowerRot, -1.22, this.sitBlend);
        } else {
          upperRot = lerp(upperRot, 0.22, this.sitBlend);
        }
      }
      if (this.crouchBlend > 0.01) {
        upperRot = lerp(upperRot, leg.isFront ? -0.58 : 0.65, this.crouchBlend);
        lowerRot = lerp(lowerRot, leg.isFront ? 0.95 : -0.95, this.crouchBlend);
      }
      if (this.stretchBlend > 0.01 && leg.isFront) {
        upperRot = lerp(upperRot, -0.82, this.stretchBlend);
      }

      // Affectionate paw kneading ("making biscuits")!
      if (state.behavior === 'knead' && leg.isFront) {
        const kPhase = this.animClock * 4.2 + (leg.isLeft ? 0 : Math.PI);
        upperRot = -0.35 + Math.sin(kPhase) * 0.32;
        lowerRot = 0.35 - Math.sin(kPhase) * 0.24;
      }

      // Defensive warning paw swat (single front right paw)
      if (state.behavior === 'hiss_defend' && leg.isFront && !leg.isLeft) {
        const swat = Math.max(0, Math.sin(this.animClock * 6.5));
        upperRot = -0.95 * swat;
        lowerRot = 0.35 * swat;
      }

      leg.pivot.rotation.x = upperRot;
      leg.lower.rotation.x = lowerRot;
    }

    // 7. Expressive Head, Neck Tilt, Head Bunt, Sniffing & Animated Mouth
    let targetHeadYaw = 0;
    let targetHeadPitch = 0;
    let targetHeadRoll = 0;

    if (state.behavior === 'sleep') {
      targetHeadPitch = 0.34;
      targetHeadYaw = 0.52;
    } else if (state.behavior === 'eat' || state.behavior === 'drink') {
      targetHeadPitch = 0.64 + Math.sin(this.animClock * 7.5) * 0.14;
    } else if (state.behavior === 'groom') {
      targetHeadPitch = 0.46 + Math.sin(this.animClock * 7.2) * 0.18;
      targetHeadYaw = 0.45;
    } else if (state.behavior === 'yawn') {
      targetHeadPitch = -0.28;
    } else if (state.behavior === 'head_bunt') {
      // Affectionate gentle cheek & forehead rub
      targetHeadPitch = 0.22;
      targetHeadYaw = Math.sin(this.animClock * 4.5) * 0.32;
      targetHeadRoll = Math.sin(this.animClock * 4.5) * 0.24;
    } else if (state.behavior === 'hiss_defend') {
      targetHeadPitch = -0.08;
      targetHeadYaw = Math.sin(this.animClock * 3) * 0.12;
    } else if (lookAtWorld && metrics.eyeOpenness > 0.25) {
      const localTarget = this.root.worldToLocal(lookAtWorld.clone());
      targetHeadYaw = clamp(Math.atan2(localTarget.x, localTarget.z), -0.72, 0.72);
      targetHeadPitch = clamp(-localTarget.y * 0.35, -0.38, 0.42);
      // Curious inquisitive head tilt!
      if (emotion === 'curious' || state.behavior === 'react_to_sound') {
        targetHeadRoll = Math.sin(this.animClock * 1.4) * 0.24;
      }
    }

    this.neckPivot.rotation.y = lerp(this.neckPivot.rotation.y, targetHeadYaw, Math.min(1, dt * 6));
    this.neckPivot.rotation.x = lerp(this.neckPivot.rotation.x, targetHeadPitch, Math.min(1, dt * 6));
    this.neckPivot.rotation.z = lerp(this.neckPivot.rotation.z, targetHeadRoll, Math.min(1, dt * 5));

    // Animated jaw opening for meow, yawn, and hiss
    const jawAngle = clamp(state.mouthOpenAmount, 0, 1) * 0.58;
    this.lowerJawPivot.rotation.x = lerp(this.lowerJawPivot.rotation.x, jawAngle, Math.min(1, dt * 12));

    // 8. Eyes: Newborn Closed -> Slow Affectionate Blinks -> Dilated Pupils (Play/Fear)
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = emotion === 'affectionate' || emotion === 'sleepy' ? 2.2 + Math.random() * 2.5 : 3.2 + Math.random() * 4.0;
      this.blinkAmount = 1;
    }
    const blinkSpeed =
      emotion === 'affectionate' || emotion === 'happy_relaxed' || emotion === 'sleepy'
        ? 2.6 // Loving feline slow-blink!
        : 6.8;
    this.blinkAmount = Math.max(0, this.blinkAmount - dt * blinkSpeed);

    const sleepyDroop = emotion === 'sleepy' ? 0.35 : 0;
    const awakeOpen =
      metrics.eyeOpenness * (1 - this.sleepBlend) * (1 - this.blinkAmount) * (1 - sleepyDroop);
    const lidClosed = clamp(1 - awakeOpen, 0, 1);

    this.leftEyelid.visible = lidClosed > 0.08;
    this.rightEyelid.visible = lidClosed > 0.08;
    this.leftEyelid.scale.y = 0.1 + lidClosed * 0.98;
    this.rightEyelid.scale.y = 0.1 + lidClosed * 0.98;

    const targetPupilWidth =
      emotion === 'fearful' || emotion === 'playful' || state.behavior === 'pounce_crouch'
        ? 0.94 // Wide dilated pupils!
        : emotion === 'defensive_angry'
          ? 0.72
          : emotion === 'curious'
            ? 0.62
            : 0.4; // Calm sunlit vertical slit
    this.leftPupil.scale.x = lerp(this.leftPupil.scale.x, targetPupilWidth, dt * 5);
    this.rightPupil.scale.x = lerp(this.rightPupil.scale.x, targetPupilWidth, dt * 5);

    // 9. Expressive Ears & Whiskers by Emotion
    let earPitch = 0;
    let earRoll = 0.22; // normal upright angle
    let whiskerYaw = 0;

    if (emotion === 'defensive_angry') {
      // Flattened back "airplane ears" + pulled-back whiskers
      earPitch = -0.68;
      earRoll = 0.88;
      whiskerYaw = -0.35;
    } else if (emotion === 'fearful') {
      // Ears angled sideways & back
      earPitch = -0.35;
      earRoll = 0.72;
      whiskerYaw = -0.28;
    } else if (emotion === 'curious' || emotion === 'playful') {
      // Perked forward & alert whiskers
      earPitch = 0.24;
      earRoll = 0.14;
      whiskerYaw = 0.22;
    } else if (emotion === 'affectionate' || emotion === 'happy_relaxed') {
      earPitch = 0.05;
      earRoll = 0.25;
      whiskerYaw = 0.05;
    }

    this.earLeftPivot.rotation.x = lerp(this.earLeftPivot.rotation.x, earPitch, dt * 7);
    this.earRightPivot.rotation.x = lerp(this.earRightPivot.rotation.x, earPitch, dt * 7);
    this.earLeftPivot.rotation.z = lerp(this.earLeftPivot.rotation.z, earRoll, dt * 7);
    this.earRightPivot.rotation.z = lerp(this.earRightPivot.rotation.z, -earRoll, dt * 7);

    this.whiskerLeftPivot.rotation.y = lerp(this.whiskerLeftPivot.rotation.y, -whiskerYaw, dt * 6);
    this.whiskerRightPivot.rotation.y = lerp(this.whiskerRightPivot.rotation.y, whiskerYaw, dt * 6);

    // 10. Multi-Segment Expressive Tail (swishing angry, upright affectionate, tucked fearful)
    let tailFreq = 2.2;
    let tailAmp = 0.14;
    let tailLift = 0.24;

    if (emotion === 'defensive_angry') {
      tailFreq = 9.5; // Sharp agitated swishing!
      tailAmp = 0.42;
      tailLift = 0.12;
    } else if (emotion === 'fearful') {
      tailFreq = 1.4;
      tailAmp = 0.06;
      tailLift = -0.45; // Tucked low
    } else if (emotion === 'playful') {
      tailFreq = 6.2;
      tailAmp = 0.26;
      tailLift = 0.3;
    } else if (emotion === 'affectionate') {
      tailFreq = 2.6;
      tailAmp = 0.14;
      tailLift = 0.56; // Proud question-mark greeting tail!
    } else if (emotion === 'sleepy') {
      tailFreq = 0.8;
      tailAmp = 0.04;
      tailLift = -0.18;
    }

    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];
      const wave = Math.sin(this.animClock * tailFreq - i * 0.65) * tailAmp;
      seg.rotation.y = this.sleepBlend > 0.5 ? 0.38 + wave : wave;
      seg.rotation.x = i === 0 ? tailLift : tailLift * 0.34;
    }
  }
}
