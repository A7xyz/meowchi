import * as THREE from 'three';
import { getBreedDefinition } from '../config/breeds';
import { ACCESSORY_CATALOG } from '../config/catalog';
import { clamp, computeGrowthMetrics, lerp } from '../simulation/growth';
import { AccessoryId, CatIdentity, CatRuntimeState } from '../types/game';
import {
  createCatNoseTexture,
  createFelineIrisTexture,
  createFurBumpTexture,
  createFurCardAlphaTexture,
  createFurShellAlphaTexture,
  createFurTexture
} from './textures';

const FUR_SHELL_LAYERS = 5;

/**
 * Inflates a geometry outward along vertex normals to create seamless volumetric fur shells.
 * Slight downward gravity comb biases fur naturally along the feline coat direction.
 */
function createOffsetShellGeometry(
  source: THREE.BufferGeometry,
  offset: number,
  combGravity = 0.0025
): THREE.BufferGeometry {
  const geo = source.clone();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    pos.setXYZ(
      i,
      pos.getX(i) + nx * offset,
      pos.getY(i) + ny * offset - combGravity,
      pos.getZ(i) + nz * offset
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a single seamless sculpted feline torso geometry (chest -> ribcage -> waist -> rump)
 * aligned along the Z axis so there are ZERO hard seams between chest, belly, and hindquarters.
 */
function createSculptedFelineTorsoGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -0.228),
    new THREE.Vector2(0.062, -0.212),
    new THREE.Vector2(0.095, -0.172),
    new THREE.Vector2(0.104, -0.115),
    new THREE.Vector2(0.098, -0.03),
    new THREE.Vector2(0.102, 0.065),
    new THREE.Vector2(0.106, 0.145),
    new THREE.Vector2(0.088, 0.198),
    new THREE.Vector2(0.052, 0.224),
    new THREE.Vector2(0.001, 0.232)
  ];
  const geo = new THREE.LatheGeometry(pts, 26);
  geo.rotateX(Math.PI / 2);
  // Subtle natural feline ribcage ovality (slightly taller than wide)
  geo.scale(0.95, 1.04, 1.0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a realistic sculpted feline skull (broad soft cheekbones, gentle brow, tapered bridge)
 * instead of a cartoonish ball.
 */
function createSculptedFelineSkullGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.092, 26, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const nx = x / 0.092;
    const ny = y / 0.092;
    const nz = z / 0.092;

    // Broad soft feline cheekbones on lower-mid sides
    const cheek = Math.exp(-Math.pow((ny + 0.18) / 0.42, 2)) * Math.abs(nx);
    x *= 1.07 + cheek * 0.12;
    // Slight feline forehead slope and skull depth
    y *= 0.94;
    z *= 1.04 + Math.max(0, nz) * (ny < 0.1 ? 0.08 : -0.03);

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Highly Realistic, Ultra-Fluffy Articulated 3D Cat Rig.
 *
 * Visual Architecture:
 * - Multi-layer Volumetric Fur Shells (5 concentric micro-offset fine-strand shells with
 *   root-to-tip ambient occlusion + directional hair bump map) over seamless sculpted feline
 *   torso, neck, skull, legs, and tail — eliminating plastic sheen, polygon edges, and seams!
 * - Dense feathered fine-strand fur cards layered on cheeks, chest mane, flanks, belly, ear
 *   furnishings, and plush bottle-brush tail
 * - Realistic feline face: detailed radial fibrous iris textures, clearcoat glossy cornea domes
 *   with realistic reflections, dynamic vertical-slit pupil dilation, dark waterline rims,
 *   textured pebbled nose leather with nostrils, velvet whisker pads, 16 curved whiskers
 *   (cheeks + brow vibrissae), and cupped pink inner ears with fine wisps!
 * - Supports 10 breeds, 6 life stages (Newborn -> Senior), 5 dynamic body conditions
 *   (Underweight -> Obese), 7 emotions, and all feline behaviors.
 */
export class CatRig {
  public readonly root = new THREE.Group();
  private readonly bodyPivot = new THREE.Group();
  private readonly torsoGroup = new THREE.Group();
  private readonly torsoCoreGroup = new THREE.Group();
  private readonly bellyFurGroup = new THREE.Group();
  private readonly chestRuffGroup = new THREE.Group();
  private readonly neckPivot = new THREE.Group();
  private readonly headGroup = new THREE.Group();
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
  private readonly furShellMeshes: { mesh: THREE.Mesh; layerNorm: number }[] = [];

  private readonly legs: {
    pivot: THREE.Group;
    lower: THREE.Group;
    paw: THREE.Group;
    isFront: boolean;
    isLeft: boolean;
  }[] = [];

  private readonly tailSegments: THREE.Group[] = [];
  private readonly tailFluffMeshes: THREE.Mesh[] = [];

  // Realistic non-plastic fur & facial materials
  private furMat: THREE.MeshStandardMaterial;
  private furShellMats: THREE.MeshStandardMaterial[] = [];
  private pointMat: THREE.MeshStandardMaterial;
  private bellyMat: THREE.MeshStandardMaterial;
  private furCardMat: THREE.MeshStandardMaterial;
  private irisMat: THREE.MeshStandardMaterial;
  private noseMat: THREE.MeshStandardMaterial;
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
    const furBump = createFurBumpTexture();
    const furCardAlpha = createFurCardAlphaTexture();

    // Base velvety feline undercoat material (high roughness + micro-strand bump -> ZERO plastic look!)
    this.furMat = new THREE.MeshStandardMaterial({
      map: furTex,
      bumpMap: furBump,
      bumpScale: 0.008,
      roughness: 0.94,
      metalness: 0.0
    });

    // 5 Volumetric Fur Shell materials (root-to-tip ambient occlusion + progressive wispy alpha tips!)
    for (let layer = 0; layer < FUR_SHELL_LAYERS; layer++) {
      const layerNorm = (layer + 1) / FUR_SHELL_LAYERS;
      const aoBrightness = lerp(0.84, 1.04, layerNorm); // Subtle root darkening & luminous sunlit tips!
      const shellMat = new THREE.MeshStandardMaterial({
        map: furTex,
        color: new THREE.Color(aoBrightness, aoBrightness, aoBrightness),
        alphaMap: createFurShellAlphaTexture(layer, FUR_SHELL_LAYERS),
        transparent: true,
        alphaTest: 0.14 + layerNorm * 0.12,
        roughness: 0.96,
        metalness: 0.0,
        side: THREE.FrontSide
      });
      this.furShellMats.push(shellMat);
    }

    this.pointMat = new THREE.MeshStandardMaterial({
      color: identity.furPattern === 'colorpoint' ? identity.furSecondary : identity.furColor,
      bumpMap: furBump,
      bumpScale: 0.006,
      roughness: 0.94,
      metalness: 0.0
    });
    this.bellyMat = new THREE.MeshStandardMaterial({
      color: this.computeSoftBellyHex(identity),
      bumpMap: furBump,
      bumpScale: 0.007,
      roughness: 0.96,
      metalness: 0.0
    });
    this.furCardMat = new THREE.MeshStandardMaterial({
      color: identity.furColor,
      alphaMap: furCardAlpha,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
      roughness: 0.97,
      depthWrite: false
    });
    this.irisMat = new THREE.MeshStandardMaterial({
      map: createFelineIrisTexture(identity.eyeColor),
      roughness: 0.18,
      metalness: 0.04
    });

    const pinkSkinMat = new THREE.MeshStandardMaterial({ color: '#e2a9a4', roughness: 0.78 });
    const earWispMat = new THREE.MeshStandardMaterial({
      color: '#f8f4ee',
      alphaMap: furCardAlpha,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
      roughness: 0.96,
      depthWrite: false
    });
    const noseHex =
      identity.furPattern === 'colorpoint' || identity.furColorId === 'black' ? '#493736' : '#df9190';
    this.noseMat = new THREE.MeshStandardMaterial({
      map: createCatNoseTexture(noseHex),
      roughness: 0.44,
      metalness: 0.02
    });
    const innerMouthMat = new THREE.MeshStandardMaterial({ color: '#c46c72', roughness: 0.65 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.05 });
    const waterlineMat = new THREE.MeshStandardMaterial({ color: '#261e1c', roughness: 0.4 });
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.2,
      roughness: 0.03,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    });
    const whiskerMat = new THREE.MeshStandardMaterial({
      color: '#f9f6f0',
      roughness: 0.4,
      transparent: true,
      opacity: 0.88
    });

    // Body pivot
    this.bodyPivot.position.set(0, 0.24, 0);
    this.root.add(this.bodyPivot);
    this.bodyPivot.add(this.torsoGroup);
    this.torsoGroup.add(this.torsoCoreGroup);

    // 1. Seamless Sculpted Feline Torso + Volumetric Fur Shell Stack!
    const torsoGeo = createSculptedFelineTorsoGeometry();
    this.addFurredMesh(this.torsoCoreGroup, torsoGeo, this.furMat, 0.017, true);

    // Soft plush belly pouch with fur shells (expands when overweight/obese, tucks when lean!)
    const bellyGeo = new THREE.SphereGeometry(0.088, 18, 14);
    bellyGeo.scale(0.92, 0.72, 1.5);
    this.bellyFurGroup.position.set(0, -0.044, 0.0);
    this.torsoGroup.add(this.bellyFurGroup);
    this.addFurredMesh(this.bellyFurGroup, bellyGeo, this.bellyMat, 0.014, false);

    // Lush layered chest mane / ruff cards
    this.chestRuffGroup.position.set(0, 0.012, 0.185);
    this.torsoGroup.add(this.chestRuffGroup);
    const ruffSpecs: [number, number, number, number, number][] = [
      [0, -0.024, 0.036, 0.155, 0],
      [-0.048, -0.014, 0.024, 0.135, -0.35],
      [0.048, -0.014, 0.024, 0.135, 0.35],
      [0, 0.022, 0.028, 0.135, 0],
      [-0.032, -0.045, 0.015, 0.12, -0.25],
      [0.032, -0.045, 0.015, 0.12, 0.25]
    ];
    for (const [rx, ry, rz, sz, ryRot] of ruffSpecs) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), this.furCardMat);
      card.position.set(rx, ry, rz);
      card.rotation.y = ryRot;
      this.chestRuffGroup.add(card);
      this.furTufts.push(card);
    }

    // Layered dorsal, shoulder & flank fine-strand fur cards for soft organic fluffy halo
    for (let i = 0; i < 10; i++) {
      const zPos = -0.17 + (i / 9) * 0.34;
      for (const side of [-1, 1] as const) {
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.125, 0.125), this.furCardMat);
        card.position.set(side * 0.092, 0.012 + (i % 2) * 0.024, zPos);
        card.rotation.y = side * Math.PI * 0.44;
        card.rotation.z = side * 0.22;
        this.torsoGroup.add(card);
        this.furTufts.push(card);
      }
      // Subtle soft ridge fur along spine
      if (i % 2 === 0) {
        const backCard = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), this.furCardMat);
        backCard.position.set(0, 0.095, zPos);
        backCard.rotation.x = -0.25;
        this.torsoGroup.add(backCard);
        this.furTufts.push(backCard);
      }
    }

    // 2. Seamless Furred Neck & Accessory Mount
    this.neckPivot.position.set(0, 0.068, 0.182);
    this.bodyPivot.add(this.neckPivot);

    const neckGeo = new THREE.CylinderGeometry(0.062, 0.084, 0.11, 16);
    neckGeo.rotateX(0.42);
    neckGeo.translate(0, 0.03, 0.016);
    this.addFurredMesh(this.neckPivot, neckGeo, this.furMat, 0.013, true);

    this.accessoryGroup.position.set(0, 0.025, 0.022);
    this.accessoryGroup.rotation.x = 0.42;
    this.neckPivot.add(this.accessoryGroup);

    // 3. Sculpted Realistic Feline Head + Volumetric Facial Fur Shells
    this.headGroup.position.set(0, 0.094, 0.052);
    this.neckPivot.add(this.headGroup);

    const skullGeo = createSculptedFelineSkullGeometry();
    this.addFurredMesh(this.headGroup, skullGeo, this.furMat, 0.013, true);

    // Fluffy volumetric cheeks + multi-layered feathery cheek ruffs
    this.headGroup.add(this.cheekFluffGroup);
    for (const side of [-1, 1] as const) {
      const cheekGeo = new THREE.SphereGeometry(0.048, 14, 12);
      cheekGeo.scale(1.08, 0.86, 0.92);
      cheekGeo.translate(side * 0.062, -0.022, 0.024);
      this.addFurredMesh(this.cheekFluffGroup, cheekGeo, this.furMat, 0.011, false);

      const cheekCard1 = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.098), this.furCardMat);
      cheekCard1.position.set(side * 0.092, -0.02, 0.026);
      cheekCard1.rotation.y = side * 0.34;
      this.cheekFluffGroup.add(cheekCard1);
      this.furTufts.push(cheekCard1);

      const cheekCard2 = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.09), this.furCardMat);
      cheekCard2.position.set(side * 0.082, -0.036, 0.042);
      cheekCard2.rotation.y = side * 0.48;
      this.cheekFluffGroup.add(cheekCard2);
      this.furTufts.push(cheekCard2);
    }

    // 4. Realistic Feline Muzzle, Whisker Pads, Pebbled Nose Leather, Nostrils & Small Mouth
    this.muzzleGroup.position.set(0, -0.018, 0.068);
    this.headGroup.add(this.muzzleGroup);

    // Soft nasal bridge blending smoothly into forehead
    const bridge = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.021, 0.032, 6, 10),
      identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
    );
    bridge.rotation.x = Math.PI * 0.42;
    bridge.position.set(0, 0.016, 0.016);
    this.muzzleGroup.add(bridge);

    // Soft velvety whisker pads (fine facial fur)
    for (const side of [-1, 1] as const) {
      const padGeo = new THREE.SphereGeometry(0.026, 14, 12);
      padGeo.scale(1.06, 0.86, 0.96);
      padGeo.translate(side * 0.02, -0.007, 0.018);
      this.addFurredMesh(
        this.muzzleGroup,
        padGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat,
        0.005,
        false
      );
    }

    // Detailed triangular-heart feline nose leather (rhinarium) + tiny nostrils + philtrum
    const noseGeo = new THREE.SphereGeometry(0.0135, 14, 10);
    noseGeo.scale(1.18, 0.78, 0.65);
    const noseMesh = new THREE.Mesh(noseGeo, this.noseMat);
    noseMesh.position.set(0, 0.007, 0.042);
    this.muzzleGroup.add(noseMesh);

    for (const side of [-1, 1] as const) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 6, 6), waterlineMat);
      nostril.scale.set(1.2, 0.7, 0.6);
      nostril.position.set(side * 0.0052, 0.005, 0.049);
      this.muzzleGroup.add(nostril);
    }

    // Delicate vertical philtrum + subtle feline "ω" mouth line
    const philtrum = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012, 0.004), waterlineMat);
    philtrum.position.set(0, -0.003, 0.044);
    this.muzzleGroup.add(philtrum);

    const mouthCavity = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), innerMouthMat);
    mouthCavity.position.set(0, -0.016, 0.018);
    mouthCavity.scale.set(0.95, 0.68, 0.78);
    this.muzzleGroup.add(mouthCavity);

    this.lowerJawPivot.position.set(0, -0.022, 0.008);
    this.muzzleGroup.add(this.lowerJawPivot);
    const chinMesh = new THREE.Mesh(new THREE.SphereGeometry(0.023, 12, 10), this.furMat);
    chinMesh.position.set(0, -0.006, 0.018);
    chinMesh.scale.set(1.02, 0.72, 0.98);
    this.lowerJawPivot.add(chinMesh);

    // 5. Realistic Feline Eyes (Fibrous Iris, Dynamic Vertical-Slit Pupil, Clearcoat Cornea & Eyelids!)
    const buildRealisticFelineEye = (side: -1 | 1) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.04, 0.016, 0.072);
      eyeGroup.rotation.y = side * 0.22;

      // Subtle dark feline waterline rim
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0212, 0.0022, 8, 20), waterlineMat);
      rim.scale.set(1.08, 0.98, 0.6);
      rim.position.set(0, 0, 0.004);
      eyeGroup.add(rim);

      // Detailed textured fibrous feline iris
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0205, 18, 16), this.irisMat);
      iris.scale.set(1.06, 0.98, 0.62);
      eyeGroup.add(iris);

      // Dynamic vertical-slit feline pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0128, 14, 12), pupilMat);
      pupil.scale.set(0.38, 0.94, 0.45);
      pupil.position.set(0, 0, 0.0092);
      eyeGroup.add(pupil);

      // Glossy clearcoat cornea dome for realistic wet reflection
      const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.0214, 16, 14), corneaMat);
      cornea.scale.set(1.06, 0.98, 0.68);
      cornea.position.set(0, 0, 0.0015);
      eyeGroup.add(cornea);

      // Realistic soft window specular catchlights
      const glint1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.004, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      glint1.scale.set(1.2, 0.85, 0.5);
      glint1.position.set(0.0062, 0.0065, 0.0155);
      eyeGroup.add(glint1);

      const glint2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.002, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      glint2.position.set(-0.0055, -0.0042, 0.0148);
      eyeGroup.add(glint2);

      // Furred realistic blinking eyelid
      const lidGeo = new THREE.SphereGeometry(0.0232, 16, 12);
      lidGeo.scale(1.1, 1.04, 0.74);
      const lid = new THREE.Mesh(
        lidGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      lid.position.set(0, 0, 0.0015);
      eyeGroup.add(lid);

      this.headGroup.add(eyeGroup);
      return { lid, pupil };
    };

    const leftEye = buildRealisticFelineEye(-1);
    const rightEye = buildRealisticFelineEye(1);
    this.leftEyelid = leftEye.lid;
    this.rightEyelid = rightEye.lid;
    this.leftPupil = leftEye.pupil;
    this.rightPupil = rightEye.pupil;

    // 6. Detailed Cupped Feline Ears + Warm Pink Interior + Wispy Ear Furnishings + Lynx Tufts
    const buildDetailedEar = (side: -1 | 1, pivot: THREE.Group) => {
      pivot.position.set(side * 0.056, 0.068, 0.002);
      pivot.rotation.z = -side * 0.22;
      pivot.rotation.y = side * 0.18;

      const outerGeo = new THREE.ConeGeometry(0.039, 0.086, 10);
      outerGeo.scale(1.02, 1.0, 0.68);
      outerGeo.translate(0, 0.036, 0);
      this.addFurredMesh(
        pivot,
        outerGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat,
        0.006,
        true
      );

      // Detailed cupped warm pink ear interior
      const innerGeo = new THREE.ConeGeometry(0.025, 0.06, 8);
      innerGeo.scale(1.0, 1.0, 0.42);
      const inner = new THREE.Mesh(innerGeo, pinkSkinMat);
      inner.position.set(0, 0.031, 0.01);
      pivot.add(inner);

      // Fine wispy inner ear furnishings (hair tufts growing gently across ear opening!)
      const earWisp = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.052), earWispMat);
      earWisp.position.set(-side * 0.005, 0.026, 0.018);
      earWisp.rotation.z = side * 0.3;
      pivot.add(earWisp);

      // Breed-specific lynx ear tip tuft (Maine Coon, Persian, Ragdoll)
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.01, 0.028, 5),
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat
      );
      tuft.position.set(0, 0.084, 0);
      pivot.add(tuft);

      this.headGroup.add(pivot);
      return tuft;
    };
    this.earTuftLeft = buildDetailedEar(-1, this.earLeftPivot);
    this.earTuftRight = buildDetailedEar(1, this.earRightPivot);

    // 7. 16 Individual Curved Fine Whiskers (5 cheek whiskers + 3 delicate brow vibrissae per side!)
    const buildWhiskers = (side: -1 | 1, pivot: THREE.Group) => {
      pivot.position.set(side * 0.042, -0.022, 0.084);
      for (let i = 0; i < 5; i++) {
        const len = 0.088 + (i % 3) * 0.016;
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, (i - 2) * 0.0055, 0),
          new THREE.Vector3(side * len * 0.55, (i - 2) * 0.008 + 0.003, 0.006),
          new THREE.Vector3(side * len, (i - 2) * 0.012 - 0.008, -0.012)
        );
        const wGeo = new THREE.TubeGeometry(curve, 6, 0.00075, 4, false);
        const w = new THREE.Mesh(wGeo, whiskerMat);
        pivot.add(w);
      }
      // Subtle superciliary brow whiskers above each eye
      for (let b = 0; b < 3; b++) {
        const bCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-side * 0.006, 0.062 + b * 0.004, -0.006),
          new THREE.Vector3(side * 0.018, 0.082 + b * 0.004, 0.004),
          new THREE.Vector3(side * 0.044, 0.092 + b * 0.003, -0.004)
        );
        const bw = new THREE.Mesh(new THREE.TubeGeometry(bCurve, 5, 0.0006, 4, false), whiskerMat);
        pivot.add(bw);
      }
      this.headGroup.add(pivot);
    };
    buildWhiskers(-1, this.whiskerLeftPivot);
    buildWhiskers(1, this.whiskerRightPivot);

    // 8. Four Seamless Furred Legs + Soft Rounded Toed Paws
    const legSpecs = [
      { x: -0.06, z: 0.135, isFront: true, isLeft: true },
      { x: 0.06, z: 0.135, isFront: true, isLeft: false },
      { x: -0.064, z: -0.14, isFront: false, isLeft: true },
      { x: 0.064, z: -0.14, isFront: false, isLeft: false }
    ];

    for (const spec of legSpecs) {
      const pivot = new THREE.Group();
      pivot.position.set(spec.x, -0.02, spec.z);
      this.bodyPivot.add(pivot);

      // Seamless upper leg with shoulder/haunch cap & volumetric fur shells
      const upperGeo = new THREE.CapsuleGeometry(0.034, 0.09, 8, 12);
      upperGeo.translate(0, -0.05, 0);
      this.addFurredMesh(pivot, upperGeo, this.furMat, 0.01, true);

      const lower = new THREE.Group();
      lower.position.set(0, -0.104, 0);
      pivot.add(lower);

      const lowerGeo = new THREE.CapsuleGeometry(0.026, 0.082, 8, 12);
      lowerGeo.translate(0, -0.045, 0.005);
      this.addFurredMesh(
        lower,
        lowerGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat,
        0.008,
        true
      );

      // Soft multi-toed feline paw
      const pawGroup = new THREE.Group();
      pawGroup.position.set(0, -0.092, 0.018);
      lower.add(pawGroup);

      const pawMat =
        identity.furPattern === 'bicolor'
          ? new THREE.MeshStandardMaterial({ color: '#f7f3ec', roughness: 0.92 })
          : identity.furPattern === 'colorpoint'
            ? this.pointMat
            : this.furMat;

      const pawBase = new THREE.Mesh(new THREE.SphereGeometry(0.029, 12, 10), pawMat);
      pawBase.scale.set(1.06, 0.66, 1.24);
      pawBase.castShadow = true;
      pawGroup.add(pawBase);

      // 3 subtle soft front toe cushions
      for (const tx of [-0.014, 0, 0.014]) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), pawMat);
        toe.position.set(tx, -0.004, 0.024);
        pawGroup.add(toe);
      }

      this.legs.push({ pivot, lower, paw: pawGroup, isFront: spec.isFront, isLeft: spec.isLeft });
    }

    // 9. 4-Segment Luxuriously Fluffy Articulated Tail (Volumetric Fur Shells + Crossed Feathered Plumes!)
    let parentObj: THREE.Object3D = this.bodyPivot;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      if (i === 0) seg.position.set(0, 0.045, -0.2);
      else seg.position.set(0, 0, -0.082);

      const radiusTop = 0.028 - i * 0.003;
      const radiusBot = 0.024 - i * 0.0025;
      const segGeo = new THREE.CylinderGeometry(radiusBot, radiusTop, 0.096, 12);
      segGeo.rotateX(Math.PI / 2);
      segGeo.translate(0, 0, -0.042);

      this.addFurredMesh(
        seg,
        segGeo,
        identity.furPattern === 'colorpoint' ? this.pointMat : this.furMat,
        0.014,
        true
      );

      // Crossed feathered fur plume cards so the tail looks thick & ultra-fluffy from ALL angles!
      for (const rotY of [Math.PI * 0.5, 0]) {
        const fluffCard = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.105), this.furCardMat);
        fluffCard.position.set(0, 0, -0.044);
        fluffCard.rotation.y = rotY;
        if (rotY === 0) fluffCard.rotation.x = Math.PI * 0.5;
        seg.add(fluffCard);
        this.tailFluffMeshes.push(fluffCard);
      }

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

  /**
   * Adds the seamless base mesh plus concentric micro-offset volumetric fur shells
   * that create real 3D hair thickness and eliminate sharp polygon outlines.
   */
  private addFurredMesh(
    parent: THREE.Group,
    baseGeo: THREE.BufferGeometry,
    baseMat: THREE.Material,
    maxFurThickness: number,
    castShadow: boolean
  ): void {
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.castShadow = castShadow;
    baseMesh.receiveShadow = true;
    parent.add(baseMesh);

    for (let layer = 0; layer < FUR_SHELL_LAYERS; layer++) {
      const layerNorm = (layer + 1) / FUR_SHELL_LAYERS;
      const shellGeo = createOffsetShellGeometry(
        baseGeo,
        maxFurThickness * layerNorm,
        0.0022 * layerNorm
      );
      const shellMesh = new THREE.Mesh(shellGeo, this.furShellMats[layer]);
      shellMesh.receiveShadow = true;
      parent.add(shellMesh);
      this.furShellMeshes.push({ mesh: shellMesh, layerNorm });
    }
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

    const furTex = createFurTexture(identity.furColor, identity.furSecondary, identity.furPattern);
    this.furMat.map = furTex;
    this.furMat.needsUpdate = true;

    for (const sm of this.furShellMats) {
      sm.map = furTex;
      sm.needsUpdate = true;
    }

    this.pointMat.color.set(
      identity.furPattern === 'colorpoint' ? identity.furSecondary : identity.furColor
    );
    this.bellyMat.color.set(this.computeSoftBellyHex(identity));
    this.furCardMat.color.set(identity.furColor);

    this.irisMat.map = createFelineIrisTexture(identity.eyeColor);
    this.irisMat.needsUpdate = true;

    const noseHex =
      identity.furPattern === 'colorpoint' || identity.furColorId === 'black' ? '#493736' : '#df9190';
    this.noseMat.map = createCatNoseTexture(noseHex);
    this.noseMat.needsUpdate = true;

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

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.011, 10, 22), mat);
    band.rotation.x = Math.PI / 2;
    this.accessoryGroup.add(band);

    if (accessoryId === 'bell_collar_gold') {
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#e5bd56', metalness: 0.72, roughness: 0.25 })
      );
      bell.position.set(0, -0.016, 0.078);
      this.accessoryGroup.add(bell);
    } else if (accessoryId === 'linen_bandana') {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.072, 3), mat);
      tri.rotation.x = Math.PI;
      tri.scale.set(1.0, 1.0, 0.28);
      tri.position.set(0, -0.042, 0.068);
      this.accessoryGroup.add(tri);
    } else {
      for (const side of [-1, 1] as const) {
        const loop = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mat);
        loop.scale.set(1.25, 0.7, 0.55);
        loop.position.set(side * 0.02, -0.008, 0.078);
        this.accessoryGroup.add(loop);
      }
    }
  }

  public updatePreview(identity: CatIdentity, dt: number, ageDays = 28): void {
    this.applyAppearance(identity);
    this.syncAccessory(identity.equippedAccessory);

    const morph = getBreedDefinition(identity.breed).morphology;
    const metrics = computeGrowthMetrics(identity.breed, ageDays);
    this.animClock += dt;

    const previewScale = 1.18 * (0.75 + morph.adultScale * 0.25);
    this.root.scale.setScalar(previewScale);

    this.torsoGroup.scale.set(morph.torsoWidth, 1.0, morph.torsoLength);
    this.headGroup.scale.set(
      metrics.headRatio * morph.headWidth,
      metrics.headRatio * morph.headRoundness,
      metrics.headRatio
    );
    this.muzzleGroup.scale.set(1, 1, morph.muzzleLength);
    this.earLeftPivot.scale.setScalar(metrics.earRatio * morph.earSize);
    this.earRightPivot.scale.setScalar(metrics.earRatio * morph.earSize);
    this.cheekFluffGroup.scale.setScalar(0.75 + morph.furFluffiness * 0.55);

    const shellScale = 1.0 + (morph.furFluffiness - 0.55) * 0.05;
    for (const s of this.furShellMeshes) {
      s.mesh.scale.setScalar(1 + (shellScale - 1) * s.layerNorm);
    }
    for (const card of this.furTufts) {
      card.visible = morph.furFluffiness > 0.28;
      card.scale.setScalar(0.62 + morph.furFluffiness * 0.72);
    }
    for (const seg of this.tailFluffMeshes) {
      seg.visible = morph.tailPlushness > 0.72;
      seg.scale.setScalar(morph.tailPlushness * 0.98);
    }
    for (const leg of this.legs) {
      leg.pivot.scale.set(1, metrics.legRatio * morph.legLength, 1);
      leg.pivot.rotation.x = !leg.isFront ? 0.88 : 0.18;
      leg.lower.rotation.x = !leg.isFront ? -1.15 : 0;
    }

    const standH = 0.068 + 0.155 * metrics.legRatio * morph.legLength;
    this.bodyPivot.position.y = standH * 0.86;
    this.bodyPivot.rotation.set(-0.3, 0, 0);

    this.neckPivot.rotation.y = Math.sin(this.animClock * 1.1) * 0.18;
    this.neckPivot.rotation.z = Math.sin(this.animClock * 0.7) * 0.1;
    this.neckPivot.rotation.x = 0.12;

    this.leftEyelid.visible = false;
    this.rightEyelid.visible = false;
    this.leftPupil.scale.x = 0.62;
    this.rightPupil.scale.x = 0.62;

    for (let i = 0; i < this.tailSegments.length; i++) {
      this.tailSegments[i].rotation.y = Math.sin(this.animClock * 2.2 - i * 0.6) * 0.18;
      this.tailSegments[i].rotation.x = i === 0 ? 0.35 : 0.15;
    }
  }

  public update(
    state: CatRuntimeState,
    dt: number,
    lookAtWorld?: THREE.Vector3 | null,
    carriedOverride?: { pos: THREE.Vector3; yaw: number } | null
  ): void {
    this.applyAppearance(state.identity);
    this.syncAccessory(state.identity.equippedAccessory);

    const morph = getBreedDefinition(state.identity.breed).morphology;
    const metrics = computeGrowthMetrics(state.identity.breed, state.ageDays);
    const emotion = state.emotion;

    this.animClock += dt * metrics.animSpeedFactor;

    // 1. World position & facing (supports smooth cradling in Chibi arms!)
    if (carriedOverride) {
      this.root.position.copy(carriedOverride.pos);
      this.root.rotation.y = carriedOverride.yaw;
    } else {
      this.root.position.set(state.position.x, state.position.y, state.position.z);
      this.root.rotation.y = state.rotationY;
    }

    // 2. Continuous 6-Stage Growth + Breed Morphology + 5-Tier Dynamic Weight Morphing
    const fat = clamp(state.weight.bodyFatIndex, -0.78, 0.95);
    const obeseExtra = Math.max(0, fat - 0.45) * 0.42;
    const widthWeightFactor = 1 + fat * 0.34 + obeseExtra;
    const bellyScaleY =
      0.74 + Math.max(0, fat) * 0.62 + obeseExtra * 0.65 - Math.max(0, -fat) * 0.32;
    const bellyScaleX = 0.94 * widthWeightFactor + obeseExtra * 0.28;

    this.root.scale.set(
      metrics.bodyScale,
      metrics.bodyScale * metrics.heightRatio,
      metrics.bodyScale
    );
    this.torsoGroup.scale.set(
      morph.torsoWidth * widthWeightFactor,
      1 + Math.max(0, fat) * 0.18 + obeseExtra * 0.25,
      morph.torsoLength * metrics.bodyLengthRatio
    );
    this.bellyFurGroup.scale.set(bellyScaleX, bellyScaleY, 1.0 + Math.max(0, fat) * 0.14);
    this.bellyFurGroup.position.y = -0.044 - Math.max(0, fat) * 0.022 - obeseExtra * 0.015;

    this.headGroup.scale.set(
      metrics.headRatio * morph.headWidth,
      metrics.headRatio * morph.headRoundness,
      metrics.headRatio
    );
    this.muzzleGroup.scale.set(1, 1, morph.muzzleLength);
    this.earLeftPivot.scale.setScalar(metrics.earRatio * morph.earSize);
    this.earRightPivot.scale.setScalar(metrics.earRatio * morph.earSize);

    // Volumetric Fur Fluffiness + Piloerection (puffs up realistically when defensive/hissing!)
    const fluffFactor = morph.furFluffiness * (0.74 + metrics.coatMaturity * 0.26);
    const puffUp = emotion === 'defensive_angry' ? 1.28 : 1.0;
    const shellExpand = 1.0 + ((fluffFactor - 0.5) * 0.055 + (puffUp - 1) * 0.08);
    for (const s of this.furShellMeshes) {
      s.mesh.scale.setScalar(1.0 + (shellExpand - 1.0) * s.layerNorm);
    }

    this.cheekFluffGroup.scale.setScalar(0.75 + fluffFactor * 0.55);
    for (let i = 0; i < this.furTufts.length; i++) {
      const card = this.furTufts[i];
      card.visible = fluffFactor > 0.26 || emotion === 'defensive_angry';
      const sway = Math.sin(this.animClock * 3.0 + i) * 0.035;
      card.scale.setScalar((0.58 + fluffFactor * 0.72) * puffUp);
      card.rotation.x = sway;
    }
    for (const seg of this.tailFluffMeshes) {
      seg.visible = morph.tailPlushness > 0.7 || emotion === 'defensive_angry';
      seg.scale.setScalar(morph.tailPlushness * (emotion === 'defensive_angry' ? 1.38 : 0.98));
    }

    for (const leg of this.legs) {
      leg.pivot.scale.set(1, metrics.legRatio * morph.legLength, 1);
      leg.paw.scale.setScalar(metrics.pawScale);
    }
    this.tailSegments[0].scale.set(
      morph.tailPlushness * 0.94,
      morph.tailPlushness * 0.94,
      metrics.tailRatio
    );

    // 3. Smooth Posture Blending
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
      state.behavior === 'jump_prep' ||
      state.behavior === 'jump_land' ||
      state.behavior === 'hide' ||
      state.behavior === 'box_ambush' ||
      emotion === 'fearful'
        ? 1
        : 0;

    const blendRate = Math.min(1, dt * 5.2);
    this.sleepBlend = lerp(this.sleepBlend, targetSleep, blendRate);
    this.sitBlend = lerp(this.sitBlend, targetSit, blendRate);
    this.stretchBlend = lerp(this.stretchBlend, targetStretch, blendRate);
    this.crouchBlend = lerp(this.crouchBlend, targetCrouch, blendRate);

    // 4. Natural Feline Breathing & Purr Micro-Vibration
    const breathRate = state.behavior === 'sleep' ? 2.0 : emotion === 'fearful' ? 5.2 : 3.3;
    const breath = Math.sin(this.animClock * breathRate) * 0.018;
    const purrVib = state.isPurring ? Math.sin(this.animClock * 38) * 0.0022 : 0;
    this.torsoCoreGroup.scale.set(1 + breath, 1 + breath * 0.9, 1);

    // 5. Spine Elevation & Expressive Feline Posture
    const standingHeight = 0.068 + 0.172 * metrics.legRatio * morph.legLength;
    const sleepHeight = 0.092;
    const sitHeight = standingHeight * 0.86;
    const crouchHeight = standingHeight * 0.66;

    let baseHeight = standingHeight;
    baseHeight = lerp(baseHeight, sitHeight, this.sitBlend);
    baseHeight = lerp(baseHeight, crouchHeight, this.crouchBlend);
    baseHeight = lerp(baseHeight, sleepHeight, this.sleepBlend);
    if (state.behavior === 'roll_play') {
      baseHeight = sleepHeight + 0.025;
    }

    const speed = Math.hypot(state.velocity.x, state.velocity.z);
    const normalizedSpeed = Math.min(1.4, speed / Math.max(0.2, metrics.maxMoveSpeed));
    this.walkCycle += dt * (speed * (state.behavior === 'zoomies' ? 13.5 : 11.5));

    const walkBob = speed > 0.04 ? Math.abs(Math.sin(this.walkCycle)) * 0.014 : 0;
    this.bodyPivot.position.y = baseHeight + walkBob + purrVib;

    let bodyPitch = 0;
    let bodyRoll = this.sleepBlend * 0.24;
    if (this.sitBlend > 0.01) bodyPitch -= 0.34 * this.sitBlend;
    if (this.stretchBlend > 0.01) bodyPitch += 0.28 * this.stretchBlend;
    if (state.behavior === 'eat' || state.behavior === 'drink') bodyPitch += 0.24;
    if (state.behavior === 'pounce_crouch' || state.behavior === 'jump_prep') {
      bodyPitch += 0.2;
      bodyRoll += Math.sin(this.animClock * 17) * 0.15;
    }
    if (state.behavior === 'jump') {
      bodyPitch += state.jumpProgress < 0.5 ? -0.36 : 0.28;
    }
    if (state.behavior === 'roll_play') {
      bodyRoll = Math.sin(this.animClock * 2.6) * 1.45;
    }
    if (state.behavior === 'hiss_defend') {
      bodyPitch -= 0.15;
      this.torsoCoreGroup.scale.y += 0.15;
    }
    if (state.behavior === 'bite_defend') {
      const lunge = Math.sin(Math.min(1, (2.2 - state.behaviorTimer) * 3.5) * Math.PI);
      bodyPitch += 0.18 * lunge;
      this.bodyPivot.position.z = lunge * 0.08;
      this.torsoCoreGroup.scale.y += 0.14;
    } else {
      this.bodyPivot.position.z = lerp(this.bodyPivot.position.z, 0, Math.min(1, dt * 8));
    }
    this.bodyPivot.rotation.set(bodyPitch, 0, bodyRoll);

    // 6. Articulated Legs
    for (const leg of this.legs) {
      const phaseOffset = (leg.isFront ? 0 : Math.PI) + (leg.isLeft ? 0 : Math.PI * 0.85);
      const strideAmp = speed > 0.03 ? 0.54 * Math.min(1.15, normalizedSpeed + 0.25) : 0;
      let upperRot = Math.sin(this.walkCycle + phaseOffset) * strideAmp;
      let lowerRot = Math.max(0, -Math.cos(this.walkCycle + phaseOffset)) * strideAmp * 0.72;

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
      if (state.behavior === 'jump') {
        upperRot = leg.isFront ? -0.85 : 0.92;
        lowerRot = leg.isFront ? 0.4 : -0.45;
      }
      if (state.behavior === 'roll_play' && leg.isFront) {
        const bat = Math.sin(this.animClock * 7.5 + (leg.isLeft ? 0 : Math.PI));
        upperRot = -0.65 + bat * 0.42;
        lowerRot = 0.55 - bat * 0.3;
      }
      if (state.behavior === 'use_litter' && leg.isFront && leg.isLeft) {
        const dig = Math.sin(this.animClock * 8.0);
        upperRot = -0.4 + dig * 0.45;
        lowerRot = 0.35;
      }
      if (state.behavior === 'knead' && leg.isFront) {
        const kPhase = this.animClock * 4.2 + (leg.isLeft ? 0 : Math.PI);
        upperRot = -0.35 + Math.sin(kPhase) * 0.32;
        lowerRot = 0.35 - Math.sin(kPhase) * 0.24;
      }
      if ((state.behavior === 'hiss_defend' || state.behavior === 'bite_defend') && leg.isFront && !leg.isLeft) {
        const swat = Math.max(0, Math.sin(this.animClock * 7.5));
        upperRot = -1.05 * swat;
        lowerRot = 0.38 * swat;
      }

      leg.pivot.rotation.x = upperRot;
      leg.lower.rotation.x = lowerRot;
    }

    // 7. Authentic Feline Head Movement, Sniffing & Jaw Articulation
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
      targetHeadPitch = 0.2;
      targetHeadYaw = Math.sin(this.animClock * 4.5) * 0.32;
      targetHeadRoll = Math.sin(this.animClock * 4.5) * 0.24;
    } else if (state.behavior === 'hiss_defend') {
      targetHeadPitch = -0.08;
      targetHeadYaw = Math.sin(this.animClock * 3) * 0.12;
    } else if (lookAtWorld && metrics.eyeOpenness > 0.25) {
      const localTarget = this.root.worldToLocal(lookAtWorld.clone());
      targetHeadYaw = clamp(Math.atan2(localTarget.x, localTarget.z), -0.72, 0.72);
      targetHeadPitch = clamp(-localTarget.y * 0.35, -0.38, 0.42);
      if (emotion === 'curious' || state.behavior === 'react_to_sound') {
        targetHeadRoll = Math.sin(this.animClock * 1.4) * 0.24;
      }
    }

    this.neckPivot.rotation.y = lerp(this.neckPivot.rotation.y, targetHeadYaw, Math.min(1, dt * 6));
    this.neckPivot.rotation.x = lerp(this.neckPivot.rotation.x, targetHeadPitch, Math.min(1, dt * 6));
    this.neckPivot.rotation.z = lerp(this.neckPivot.rotation.z, targetHeadRoll, Math.min(1, dt * 5));

    const jawAngle = clamp(state.mouthOpenAmount, 0, 1) * 0.55;
    this.lowerJawPivot.rotation.x = lerp(this.lowerJawPivot.rotation.x, jawAngle, Math.min(1, dt * 12));

    // 8. Realistic Feline Eyes (Slow Blinking & Natural Pupil Dilation)
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer =
        emotion === 'affectionate' || emotion === 'sleepy'
          ? 2.2 + Math.random() * 2.5
          : 3.2 + Math.random() * 4.0;
      this.blinkAmount = 1;
    }
    const blinkSpeed =
      emotion === 'affectionate' || emotion === 'happy_relaxed' || emotion === 'sleepy' ? 2.5 : 6.8;
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
        ? 0.95
        : emotion === 'defensive_angry'
          ? 0.72
          : emotion === 'curious'
            ? 0.62
            : 0.36;
    this.leftPupil.scale.x = lerp(this.leftPupil.scale.x, targetPupilWidth, dt * 5);
    this.rightPupil.scale.x = lerp(this.rightPupil.scale.x, targetPupilWidth, dt * 5);

    // 9. Natural Feline Ear & Whisker Body Language
    let earPitch = 0;
    let earRoll = 0.22;
    let whiskerYaw = 0;

    if (emotion === 'defensive_angry') {
      earPitch = -0.68;
      earRoll = 0.88;
      whiskerYaw = -0.35;
    } else if (emotion === 'fearful') {
      earPitch = -0.35;
      earRoll = 0.72;
      whiskerYaw = -0.28;
    } else if (emotion === 'curious' || emotion === 'playful') {
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

    // 10. Multi-Segment Expressive Fluffy Tail
    let tailFreq = 2.2;
    let tailAmp = 0.14;
    let tailLift = 0.24;

    if (emotion === 'defensive_angry') {
      tailFreq = 9.5;
      tailAmp = 0.42;
      tailLift = 0.12;
    } else if (emotion === 'fearful') {
      tailFreq = 1.4;
      tailAmp = 0.06;
      tailLift = -0.45;
    } else if (emotion === 'playful') {
      tailFreq = 6.2;
      tailAmp = 0.26;
      tailLift = 0.3;
    } else if (emotion === 'affectionate') {
      tailFreq = 2.6;
      tailAmp = 0.14;
      tailLift = 0.56;
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
