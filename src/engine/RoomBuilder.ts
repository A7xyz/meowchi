import * as THREE from 'three';
import { getCatalogItem, ROOM_HALF_DEPTH, ROOM_HALF_WIDTH, ROOM_HEIGHT } from '../config/catalog';
import { EquipmentStateMap, PlacedFurniture, RoomStatus } from '../types/game';
import { createSisalTexture, createWoodFloorTexture, createWovenFabricTexture } from './textures';

interface DynamicFurnitureRefs {
  group: THREE.Group;
  catalogId: string;
  foodFillMesh?: THREE.Mesh;
  waterFillMesh?: THREE.Mesh;
  litterSandMat?: THREE.MeshStandardMaterial;
  tableMugGroup?: THREE.Group;
  selectionRing?: THREE.Mesh;
  // Automatic Cat-Care Equipment dynamic 3D parts
  fountainStreamMesh?: THREE.Mesh;
  fountainPoolMesh?: THREE.Mesh;
  feederHopperFill?: THREE.Mesh;
  feederTrayFill?: THREE.Mesh;
  feederDispenseDrop?: THREE.Mesh;
  autoLitterDrum?: THREE.Group;
  autoLitterLedMat?: THREE.MeshStandardMaterial;
  smartBedGlowMat?: THREE.MeshStandardMaterial;
  autoToyArmPivot?: THREE.Group;
}

/**
 * Builds the cozy sunlit living room shell and manages dynamic interactive furniture
 * meshes, status visuals (food/water/litter/knocked mug), and decoration previews.
 */
export class RoomBuilder {
  public readonly roomGroup = new THREE.Group();
  public readonly furnitureRoot = new THREE.Group();
  public readonly floorMesh: THREE.Mesh;

  private readonly furnitureMap = new Map<string, DynamicFurnitureRefs>();
  private previewGroup: THREE.Group | null = null;
  private previewMatValid = new THREE.MeshBasicMaterial({
    color: '#4ea86a',
    transparent: true,
    opacity: 0.42
  });
  private previewMatInvalid = new THREE.MeshBasicMaterial({
    color: '#d9534f',
    transparent: true,
    opacity: 0.48
  });

  constructor() {
    this.roomGroup.name = 'living_room';
    this.roomGroup.add(this.furnitureRoot);

    const w = ROOM_HALF_WIDTH * 2;
    const d = ROOM_HALF_DEPTH * 2;
    const h = ROOM_HEIGHT;

    // 1. Warm honey-oak wooden floor
    const woodTex = createWoodFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.72,
      metalness: 0.04
    });
    this.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.floorMesh.userData = { interactable: 'floor' };
    this.roomGroup.add(this.floorMesh);

    // Soft warm sunbeam decal cast across floor from window
    const sunbeamGeo = new THREE.PlaneGeometry(2.1, 1.9);
    const sunbeamMat = new THREE.MeshBasicMaterial({
      color: '#fff4d6',
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    });
    const sunbeam = new THREE.Mesh(sunbeamGeo, sunbeamMat);
    sunbeam.rotation.x = -Math.PI / 2;
    sunbeam.position.set(0.65, 0.004, -0.45);
    this.roomGroup.add(sunbeam);

    // 2. Cozy warm plaster walls (back, left, right, subtle front wall clipped by camera)
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#f4ece1',
      roughness: 0.92
    });
    const sideWallMat = new THREE.MeshStandardMaterial({
      color: '#ede3d5',
      roughness: 0.92
    });
    const baseboardMat = new THREE.MeshStandardMaterial({
      color: '#e5d9c8',
      roughness: 0.65
    });

    // Back wall (-Z)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    backWall.position.set(0, h / 2, -ROOM_HALF_DEPTH);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);

    // Left wall (-X)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(d, h), sideWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-ROOM_HALF_WIDTH, h / 2, 0);
    leftWall.receiveShadow = true;
    this.roomGroup.add(leftWall);

    // Right wall (+X)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(d, h), sideWallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(ROOM_HALF_WIDTH, h / 2, 0);
    rightWall.receiveShadow = true;
    this.roomGroup.add(rightWall);

    // Front wall (+Z) facing inward so 360-degree camera orbit still looks enclosed
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sideWallMat);
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, h / 2, ROOM_HALF_DEPTH);
    this.roomGroup.add(frontWall);

    // Wooden baseboards along perimeter
    const addBaseboard = (bw: number, bd: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.12, bd), baseboardMat);
      m.position.set(x, 0.06, z);
      m.receiveShadow = true;
      this.roomGroup.add(m);
    };
    addBaseboard(w, 0.04, 0, -ROOM_HALF_DEPTH + 0.02);
    addBaseboard(w, 0.04, 0, ROOM_HALF_DEPTH - 0.02);
    addBaseboard(0.04, d, -ROOM_HALF_WIDTH + 0.02, 0);
    addBaseboard(0.04, d, ROOM_HALF_WIDTH - 0.02, 0);

    // 3. Large Sunlit Living Room Window on Back-Right Wall
    this.buildSunlitWindow();
  }

  private buildSunlitWindow(): void {
    const winGroup = new THREE.Group();
    winGroup.position.set(1.15, 1.48, -ROOM_HALF_DEPTH + 0.02);

    // Warm morning sky plane + subtle foliage outside
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 256;
    skyCanvas.height = 256;
    const ctx = skyCanvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#a8d1f0');
    grad.addColorStop(0.65, '#f7e9cf');
    grad.addColorStop(1, '#dce7cb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Soft garden foliage silhouettes
    ctx.fillStyle = '#86a777';
    ctx.beginPath();
    ctx.arc(48, 225, 62, 0, Math.PI * 2);
    ctx.arc(135, 240, 56, 0, Math.PI * 2);
    ctx.arc(215, 220, 68, 0, Math.PI * 2);
    ctx.fill();

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 1.42),
      new THREE.MeshBasicMaterial({ map: skyTex })
    );
    winGroup.add(glass);

    // Wooden window frame & mullions
    const frameMat = new THREE.MeshStandardMaterial({ color: '#fbf7f1', roughness: 0.5 });
    const addBar = (bw: number, bh: number, bd: number, x: number, y: number, z = 0.025) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), frameMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      winGroup.add(m);
    };
    addBar(1.86, 0.08, 0.09, 0, 0.74);
    addBar(1.94, 0.09, 0.16, 0, -0.74, 0.05); // Deep sunny window sill
    addBar(0.08, 1.52, 0.09, -0.89, 0);
    addBar(0.08, 1.52, 0.09, 0.89, 0);
    addBar(0.04, 1.44, 0.05, 0, 0);
    addBar(1.74, 0.04, 0.05, 0, 0.12);

    // Sheer warm linen side curtains
    const curtainMat = new THREE.MeshStandardMaterial({
      color: '#faf5ec',
      roughness: 0.9,
      transparent: true,
      opacity: 0.9
    });
    const leftCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.05, 0.07), curtainMat);
    leftCurtain.position.set(-1.02, -0.18, 0.06);
    winGroup.add(leftCurtain);

    const rightCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.05, 0.07), curtainMat);
    rightCurtain.position.set(1.02, -0.18, 0.06);
    winGroup.add(rightCurtain);

    this.roomGroup.add(winGroup);
  }

  private createFurnitureMesh(placed: PlacedFurniture): DynamicFurnitureRefs {
    const item = getCatalogItem(placed.catalogId);
    const group = new THREE.Group();
    group.name = `furniture_${placed.instanceId}`;

    const refs: DynamicFurnitureRefs = {
      group,
      catalogId: placed.catalogId
    };

    const accent = item?.accentColor ?? '#c9b39c';

    switch (placed.catalogId) {
      case 'bed_plush':
      case 'bed_woven': {
        const isWoven = placed.catalogId === 'bed_woven';
        const rimMat = new THREE.MeshStandardMaterial({
          color: isWoven ? '#b6895a' : '#d8c5b0',
          roughness: 0.88
        });
        const cushionMat = new THREE.MeshStandardMaterial({
          map: createWovenFabricTexture(isWoven ? '#f1e7d8' : '#efe5d8'),
          roughness: 0.95
        });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.37, 0.07, 24), rimMat);
        base.position.y = 0.035;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.072, 12, 26), rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.1;
        rim.castShadow = true;
        group.add(rim);

        const pillow = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.065, 22), cushionMat);
        pillow.position.y = 0.06;
        pillow.receiveShadow = true;
        group.add(pillow);
        break;
      }

      case 'food_bowl_ceramic': {
        const ceramicMat = new THREE.MeshStandardMaterial({
          color: accent,
          roughness: 0.28,
          metalness: 0.05
        });
        const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.16, 0.075, 22), ceramicMat);
        outer.position.y = 0.038;
        outer.castShadow = true;
        outer.receiveShadow = true;
        group.add(outer);

        const inner = new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.12, 0.06, 20),
          new THREE.MeshStandardMaterial({ color: '#f5efe7', roughness: 0.25 })
        );
        inner.position.y = 0.05;
        group.add(inner);

        const foodMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.115, 16, 10),
          new THREE.MeshStandardMaterial({ color: '#8f603a', roughness: 0.9 })
        );
        foodMesh.scale.set(1, 0.32, 1);
        foodMesh.position.y = 0.065;
        group.add(foodMesh);
        refs.foodFillMesh = foodMesh;
        break;
      }

      case 'water_bowl_ceramic': {
        const ceramicMat = new THREE.MeshStandardMaterial({
          color: accent,
          roughness: 0.24,
          metalness: 0.05
        });
        const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.16, 0.075, 22), ceramicMat);
        outer.position.y = 0.038;
        outer.castShadow = true;
        outer.receiveShadow = true;
        group.add(outer);

        const waterMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.122, 0.015, 20),
          new THREE.MeshStandardMaterial({
            color: '#9fd8ec',
            roughness: 0.08,
            metalness: 0.12,
            transparent: true,
            opacity: 0.85
          })
        );
        waterMesh.position.y = 0.068;
        group.add(waterMesh);
        refs.waterFillMesh = waterMesh;
        break;
      }

      case 'litter_box_cozy': {
        const trayMat = new THREE.MeshStandardMaterial({ color: '#cbc4b8', roughness: 0.65 });
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.44), trayMat);
        bottom.position.y = 0.02;
        bottom.castShadow = true;
        bottom.receiveShadow = true;
        group.add(bottom);

        const wallFront = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.03), trayMat);
        wallFront.position.set(0, 0.07, 0.205);
        group.add(wallFront);
        const wallBack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.03), trayMat);
        wallBack.position.set(0, 0.11, -0.205);
        wallBack.castShadow = true;
        group.add(wallBack);
        const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.44), trayMat);
        wallL.position.set(-0.275, 0.1, 0);
        wallL.castShadow = true;
        group.add(wallL);
        const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.44), trayMat);
        wallR.position.set(0.275, 0.1, 0);
        wallR.castShadow = true;
        group.add(wallR);

        const sandMat = new THREE.MeshStandardMaterial({ color: '#ded4c2', roughness: 0.96 });
        const sand = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.05, 0.37), sandMat);
        sand.position.y = 0.055;
        sand.receiveShadow = true;
        group.add(sand);
        refs.litterSandMat = sandMat;
        break;
      }

      case 'scratching_post_sisal': {
        const woodMat = new THREE.MeshStandardMaterial({ color: '#c49d72', roughness: 0.72 });
        const sisalMat = new THREE.MeshStandardMaterial({
          map: createSisalTexture(),
          roughness: 0.95
        });

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), woodMat);
        base.position.y = 0.025;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.82, 16), sisalMat);
        post.position.y = 0.44;
        post.castShadow = true;
        group.add(post);

        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), woodMat);
        top.position.y = 0.87;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);
        break;
      }

      case 'cat_tower_oak': {
        const woodMat = new THREE.MeshStandardMaterial({ color: '#b99166', roughness: 0.72 });
        const plushMat = new THREE.MeshStandardMaterial({ color: '#f0e6d8', roughness: 0.92 });
        const sisalMat = new THREE.MeshStandardMaterial({ map: createSisalTexture(), roughness: 0.95 });

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.66), woodMat);
        base.position.y = 0.025;
        base.castShadow = true;
        group.add(base);

        const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.68, 14), sisalMat);
        post1.position.set(-0.2, 0.38, 0);
        post1.castShadow = true;
        group.add(post1);

        const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.28, 14), sisalMat);
        post2.position.set(0.2, 0.68, -0.1);
        post2.castShadow = true;
        group.add(post2);

        const midShelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.42), plushMat);
        midShelf.position.set(-0.18, 0.72, 0);
        midShelf.castShadow = true;
        midShelf.receiveShadow = true;
        group.add(midShelf);

        const topPerch = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 20), plushMat);
        topPerch.position.set(0.2, 1.33, -0.1);
        topPerch.castShadow = true;
        topPerch.receiveShadow = true;
        group.add(topPerch);
        break;
      }

      case 'cardboard_box': {
        const boxMat = new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.9 });
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.42), boxMat);
        bottom.position.y = 0.01;
        bottom.receiveShadow = true;
        group.add(bottom);

        const sideF = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.02), boxMat);
        sideF.position.set(0, 0.13, 0.2);
        sideF.castShadow = true;
        group.add(sideF);
        const sideB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.02), boxMat);
        sideB.position.set(0, 0.14, -0.2);
        sideB.castShadow = true;
        group.add(sideB);
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.42), boxMat);
        sideL.position.set(-0.24, 0.14, 0);
        sideL.castShadow = true;
        group.add(sideL);
        const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.42), boxMat);
        sideR.position.set(0.24, 0.14, 0);
        sideR.castShadow = true;
        group.add(sideR);

        // Open folded flaps
        const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.4), boxMat);
        flapL.position.set(-0.3, 0.29, 0);
        flapL.rotation.z = 0.35;
        group.add(flapL);
        const flapR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.4), boxMat);
        flapR.position.set(0.3, 0.29, 0);
        flapR.rotation.z = -0.35;
        group.add(flapR);
        break;
      }

      case 'rug_linen':
      case 'rug_terracotta': {
        const w = item?.width ?? 2.1;
        const d = item?.depth ?? 1.5;
        const rugMat = new THREE.MeshStandardMaterial({
          map: createWovenFabricTexture(accent),
          roughness: 0.96
        });
        const rug = new THREE.Mesh(new THREE.BoxGeometry(w, 0.016, d), rugMat);
        rug.position.y = 0.008;
        rug.receiveShadow = true;
        group.add(rug);
        break;
      }

      case 'sofa_linen': {
        const fabricMat = new THREE.MeshStandardMaterial({
          map: createWovenFabricTexture('#d9cbb9'),
          roughness: 0.92
        });
        const legMat = new THREE.MeshStandardMaterial({ color: '#7c5a3c', roughness: 0.7 });
        const pillowMat = new THREE.MeshStandardMaterial({ color: '#c88d6e', roughness: 0.88 });

        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.24, 0.78), fabricMat);
        seat.position.y = 0.28;
        seat.castShadow = true;
        seat.receiveShadow = true;
        group.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.44, 0.18), fabricMat);
        back.position.set(0, 0.56, -0.32);
        back.castShadow = true;
        back.receiveShadow = true;
        group.add(back);

        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.82), fabricMat);
        armL.position.set(-0.84, 0.41, 0);
        armL.castShadow = true;
        group.add(armL);

        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.82), fabricMat);
        armR.position.set(0.84, 0.41, 0);
        armR.castShadow = true;
        group.add(armR);

        // Wooden legs
        for (const [lx, lz] of [
          [-0.78, -0.3],
          [0.78, -0.3],
          [-0.78, 0.3],
          [0.78, 0.3]
        ]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.16, 10), legMat);
          leg.position.set(lx, 0.08, lz);
          leg.castShadow = true;
          group.add(leg);
        }

        // Cozy accent throw pillow
        const throwPillow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.12), pillowMat);
        throwPillow.position.set(-0.58, 0.52, -0.15);
        throwPillow.rotation.set(-0.18, 0.28, 0.08);
        throwPillow.castShadow = true;
        group.add(throwPillow);
        break;
      }

      case 'table_oak': {
        const woodMat = new THREE.MeshStandardMaterial({ color: '#b48a5f', roughness: 0.65 });
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.05, 0.52), woodMat);
        top.position.y = 0.4;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);

        for (const [lx, lz] of [
          [-0.38, -0.19],
          [0.38, -0.19],
          [-0.38, 0.19],
          [0.38, 0.19]
        ]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.38, 10), woodMat);
          leg.position.set(lx, 0.19, lz);
          leg.castShadow = true;
          group.add(leg);
        }

        // Lightweight ceramic mug (knockable by mischievous cats!)
        const mugGroup = new THREE.Group();
        const mugMat = new THREE.MeshStandardMaterial({ color: '#e6ded2', roughness: 0.28 });
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.095, 16), mugMat);
        cup.position.y = 0.048;
        cup.castShadow = true;
        mugGroup.add(cup);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 14), mugMat);
        handle.position.set(0.045, 0.05, 0);
        mugGroup.add(handle);
        mugGroup.position.set(0.24, 0.425, 0.08);
        group.add(mugGroup);
        refs.tableMugGroup = mugGroup;
        break;
      }

      case 'floor_lamp_warm': {
        const woodMat = new THREE.MeshStandardMaterial({ color: '#8f6a47', roughness: 0.65 });
        const shadeMat = new THREE.MeshStandardMaterial({
          color: '#f9ebd2',
          emissive: '#f4cc8a',
          emissiveIntensity: 0.45,
          roughness: 0.85
        });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 18), woodMat);
        base.position.y = 0.015;
        base.castShadow = true;
        group.add(base);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.32, 12), woodMat);
        pole.position.y = 0.67;
        pole.castShadow = true;
        group.add(pole);

        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.21, 0.28, 20), shadeMat);
        shade.position.y = 1.38;
        shade.castShadow = true;
        group.add(shade);

        const bulb = new THREE.PointLight('#ffdca8', 0.85, 4.2, 2);
        bulb.position.set(0, 1.32, 0);
        group.add(bulb);
        break;
      }

      case 'wall_art_botanical': {
        const frameMat = new THREE.MeshStandardMaterial({ color: '#a8825b', roughness: 0.7 });
        const artMat = new THREE.MeshStandardMaterial({ color: '#e9e4d7', roughness: 0.85 });
        const leafMat = new THREE.MeshStandardMaterial({ color: '#789272', roughness: 0.85 });

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.52, 0.04), frameMat);
        frame.position.y = 1.38;
        group.add(frame);

        const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.44, 0.046), artMat);
        canvas.position.y = 1.38;
        group.add(canvas);

        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), leafMat);
        leaf.scale.set(0.8, 1.35, 0.2);
        leaf.position.set(0, 1.38, 0.025);
        group.add(leaf);
        break;
      }

      // ITEM 1: CAT WATER FOUNTAIN (animated flowing stream + water level)
      case 'auto_water_fountain': {
        const bodyMat = new THREE.MeshStandardMaterial({ color: '#f3eee6', roughness: 0.25 });
        const steelMat = new THREE.MeshStandardMaterial({ color: '#cfd6dc', metalness: 0.5, roughness: 0.25 });
        const waterMat = new THREE.MeshStandardMaterial({
          color: '#8fd4ec',
          transparent: true,
          opacity: 0.84,
          roughness: 0.08,
          metalness: 0.1
        });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.14, 24), bodyMat);
        base.position.y = 0.07;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.16, 0.018, 22), waterMat);
        pool.position.y = 0.142;
        group.add(pool);
        refs.fountainPoolMesh = pool;

        const spoutStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.11, 14), steelMat);
        spoutStem.position.set(0, 0.19, -0.04);
        group.add(spoutStem);

        const spoutNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12), steelMat);
        spoutNozzle.rotation.x = Math.PI / 2.3;
        spoutNozzle.position.set(0, 0.24, -0.01);
        group.add(spoutNozzle);

        const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.11, 12), waterMat);
        stream.position.set(0, 0.19, 0.025);
        group.add(stream);
        refs.fountainStreamMesh = stream;
        break;
      }

      // ITEM 2: AUTOMATIC FOOD FEEDER (transparent hopper + chute + tray)
      case 'auto_food_feeder': {
        const shellMat = new THREE.MeshStandardMaterial({ color: '#f1ebe2', roughness: 0.35 });
        const glassMat = new THREE.MeshStandardMaterial({
          color: '#eef5f8',
          transparent: true,
          opacity: 0.38,
          roughness: 0.12
        });
        const kibbleMat = new THREE.MeshStandardMaterial({ color: '#7d5232', roughness: 0.9 });
        const steelMat = new THREE.MeshStandardMaterial({ color: '#cfd6dc', metalness: 0.55, roughness: 0.25 });

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.3), shellMat);
        base.position.set(0, 0.09, -0.06);
        base.castShadow = true;
        group.add(base);

        const hopperGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 18), glassMat);
        hopperGlass.position.set(0, 0.34, -0.06);
        group.add(hopperGlass);

        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.035, 18), shellMat);
        lid.position.set(0, 0.51, -0.06);
        lid.castShadow = true;
        group.add(lid);

        const hopperFill = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.28, 16), kibbleMat);
        hopperFill.position.set(0, 0.32, -0.06);
        group.add(hopperFill);
        refs.feederHopperFill = hopperFill;

        const trayOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.055, 20), steelMat);
        trayOuter.position.set(0, 0.028, 0.14);
        trayOuter.castShadow = true;
        group.add(trayOuter);

        const trayFill = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), kibbleMat);
        trayFill.scale.set(1, 0.28, 1);
        trayFill.position.set(0, 0.048, 0.14);
        group.add(trayFill);
        refs.feederTrayFill = trayFill;

        const drop = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), kibbleMat);
        drop.position.set(0, 0.12, 0.12);
        drop.visible = false;
        group.add(drop);
        refs.feederDispenseDrop = drop;
        break;
      }

      // ITEM 3: AUTOMATIC LITTER BOX (modern dome + rotating inner cleaning drum + safety LED)
      case 'auto_litter_box': {
        const bodyMat = new THREE.MeshStandardMaterial({ color: '#ece7df', roughness: 0.4 });
        const trimMat = new THREE.MeshStandardMaterial({ color: '#b5aa9d', roughness: 0.55 });
        const sandMat = new THREE.MeshStandardMaterial({ color: '#dcd2c0', roughness: 0.95 });

        const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.54), trimMat);
        drawer.position.y = 0.07;
        drawer.castShadow = true;
        drawer.receiveShadow = true;
        group.add(drawer);

        const drumPivot = new THREE.Group();
        drumPivot.position.set(0, 0.36, 0);
        const drumShell = new THREE.Mesh(
          new THREE.SphereGeometry(0.29, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.72),
          bodyMat
        );
        drumShell.rotation.x = -Math.PI / 2.2;
        drumShell.castShadow = true;
        drumPivot.add(drumShell);

        const innerSand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.05, 18), sandMat);
        innerSand.position.y = -0.14;
        drumPivot.add(innerSand);
        group.add(drumPivot);
        refs.autoLitterDrum = drumPivot;
        refs.litterSandMat = sandMat;

        const ledMat = new THREE.MeshStandardMaterial({
          color: '#5cc47a',
          emissive: '#4cb86b',
          emissiveIntensity: 0.9
        });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), ledMat);
        led.position.set(0.22, 0.12, 0.27);
        group.add(led);
        refs.autoLitterLedMat = ledMat;
        break;
      }

      // ITEM 4: SMART CAT BED (heated ergonomic shell + soft LED warmth halo)
      case 'smart_cat_bed': {
        const shellMat = new THREE.MeshStandardMaterial({ color: '#dfd1c0', roughness: 0.65 });
        const plushMat = new THREE.MeshStandardMaterial({
          map: createWovenFabricTexture('#f6efe5'),
          roughness: 0.96
        });
        const glowMat = new THREE.MeshStandardMaterial({
          color: '#f2b86d',
          emissive: '#f2a54b',
          emissiveIntensity: 0.55
        });

        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.36, 0.14, 26), shellMat);
        pod.position.y = 0.07;
        pod.castShadow = true;
        pod.receiveShadow = true;
        group.add(pod);

        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.08, 24), plushMat);
        cushion.position.y = 0.11;
        cushion.receiveShadow = true;
        group.add(cushion);

        const rimBack = new THREE.Mesh(
          new THREE.TorusGeometry(0.34, 0.07, 12, 26, Math.PI * 1.4),
          shellMat
        );
        rimBack.rotation.x = Math.PI / 2;
        rimBack.rotation.z = Math.PI * 0.8;
        rimBack.position.y = 0.18;
        rimBack.castShadow = true;
        group.add(rimBack);

        const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.012, 8, 28), glowMat);
        glowRing.rotation.x = Math.PI / 2;
        glowRing.position.y = 0.03;
        group.add(glowRing);
        refs.smartBedGlowMat = glowMat;
        break;
      }

      // ITEM 5: AUTOMATIC CAT TOY (motorized spinning feather teaser!)
      case 'auto_cat_toy': {
        const baseMat = new THREE.MeshStandardMaterial({ color: '#e59a72', roughness: 0.45 });
        const rodMat = new THREE.MeshStandardMaterial({ color: '#d9d3ca', metalness: 0.4, roughness: 0.35 });
        const featherMat = new THREE.MeshStandardMaterial({ color: '#f2c16b', roughness: 0.8 });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.12, 20), baseMat);
        base.position.y = 0.06;
        base.castShadow = true;
        group.add(base);

        const armPivot = new THREE.Group();
        armPivot.position.set(0, 0.13, 0);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.34, 8), rodMat);
        rod.position.set(0.11, 0.12, 0);
        rod.rotation.z = -0.72;
        armPivot.add(rod);

        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 6), featherMat);
        feather.position.set(0.24, 0.21, 0);
        feather.rotation.z = Math.PI;
        armPivot.add(feather);

        group.add(armPivot);
        refs.autoToyArmPivot = armPivot;
        break;
      }

      default: {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(item?.width ?? 0.5, item?.height ?? 0.4, item?.depth ?? 0.5),
          new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 })
        );
        box.position.y = (item?.height ?? 0.4) / 2;
        box.castShadow = true;
        group.add(box);
      }
    }

    // Subtle selection highlight ring for Decoration Mode
    const ringRadius = Math.max(item?.width ?? 0.5, item?.depth ?? 0.5) * 0.58;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius - 0.03, ringRadius + 0.03, 32),
      new THREE.MeshBasicMaterial({
        color: '#d97a4a',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.022;
    ring.visible = false;
    group.add(ring);
    refs.selectionRing = ring;

    // Tag all meshes for click/tap raycasting
    group.traverse((obj) => {
      obj.userData.interactable = 'furniture';
      obj.userData.furnitureInstanceId = placed.instanceId;
      obj.userData.furnitureCatalogId = placed.catalogId;
    });

    return refs;
  }

  public syncFurniture(
    placedList: PlacedFurniture[],
    roomStatus: RoomStatus,
    selectedInstanceId: string | null,
    decorateMode: boolean,
    equipment?: EquipmentStateMap,
    clockSec = 0
  ): void {
    const activeIds = new Set(placedList.map((f) => f.instanceId));

    // Remove deleted furniture
    for (const [id, ref] of this.furnitureMap.entries()) {
      if (!activeIds.has(id)) {
        this.furnitureRoot.remove(ref.group);
        this.furnitureMap.delete(id);
      }
    }

    // Add or update existing furniture
    for (const placed of placedList) {
      let ref = this.furnitureMap.get(placed.instanceId);
      if (!ref || ref.catalogId !== placed.catalogId) {
        if (ref) this.furnitureRoot.remove(ref.group);
        ref = this.createFurnitureMesh(placed);
        this.furnitureRoot.add(ref.group);
        this.furnitureMap.set(placed.instanceId, ref);
      }

      ref.group.position.set(placed.x, 0, placed.z);
      ref.group.rotation.y = placed.rotationY;

      if (ref.selectionRing) {
        ref.selectionRing.visible = decorateMode && selectedInstanceId === placed.instanceId;
      }

      // Live status visuals
      if (ref.foodFillMesh) {
        const ratio = Math.max(0, Math.min(1, roomStatus.foodBowlLevel / 100));
        ref.foodFillMesh.visible = ratio > 0.04;
        ref.foodFillMesh.scale.set(0.6 + ratio * 0.4, 0.1 + ratio * 0.25, 0.6 + ratio * 0.4);
      }
      if (ref.waterFillMesh) {
        const ratio = Math.max(0, Math.min(1, roomStatus.waterBowlLevel / 100));
        ref.waterFillMesh.visible = ratio > 0.04;
        ref.waterFillMesh.position.y = 0.032 + ratio * 0.036;
      }
      if (ref.litterSandMat) {
        const cleanVal =
          placed.catalogId === 'auto_litter_box' && equipment
            ? equipment.autoLitterBox.litterCleanliness
            : roomStatus.litterCleanliness;
        const clean = cleanVal / 100;
        ref.litterSandMat.color.setRGB(
          0.74 + clean * 0.13,
          0.68 + clean * 0.15,
          0.56 + clean * 0.2
        );
      }
      if (ref.tableMugGroup) {
        if (roomStatus.tableMugKnocked) {
          ref.tableMugGroup.position.set(0.62, 0.042, 0.22);
          ref.tableMugGroup.rotation.set(0, 0.4, Math.PI / 2);
        } else {
          ref.tableMugGroup.position.set(0.24, 0.425, 0.08);
          ref.tableMugGroup.rotation.set(0, 0, 0);
        }
      }

      // Automatic Equipment live animations!
      if (equipment) {
        if (ref.fountainStreamMesh && ref.fountainPoolMesh) {
          const wf = equipment.waterFountain;
          ref.fountainStreamMesh.visible = wf.isFlowing && wf.waterLevel > 5;
          if (ref.fountainStreamMesh.visible) {
            const pulse = 0.88 + Math.sin(clockSec * 18) * 0.14;
            ref.fountainStreamMesh.scale.set(pulse, 1, pulse);
          }
          const levelRatio = Math.max(0, Math.min(1, wf.waterLevel / 100));
          ref.fountainPoolMesh.visible = levelRatio > 0.03;
          ref.fountainPoolMesh.position.y = 0.095 + levelRatio * 0.048;
        }

        if (ref.feederHopperFill && ref.feederTrayFill && ref.feederDispenseDrop) {
          const af = equipment.autoFeeder;
          const hopRatio = Math.max(0, Math.min(1, af.storedServings / Math.max(1, af.maxStorage)));
          ref.feederHopperFill.visible = hopRatio > 0.01;
          ref.feederHopperFill.scale.y = Math.max(0.08, hopRatio);
          ref.feederHopperFill.position.y = 0.18 + hopRatio * 0.14;

          const trayRatio = Math.max(0, Math.min(1, af.bowlServingsLevel / 100));
          ref.feederTrayFill.visible = trayRatio > 0.04;
          ref.feederTrayFill.scale.set(0.6 + trayRatio * 0.4, 0.15 + trayRatio * 0.22, 0.6 + trayRatio * 0.4);

          ref.feederDispenseDrop.visible = af.dispensingAnimTimer > 0;
          if (ref.feederDispenseDrop.visible) {
            const fall = (clockSec * 4) % 1;
            ref.feederDispenseDrop.position.y = 0.16 - fall * 0.11;
          }
        }

        if (ref.autoLitterDrum && ref.autoLitterLedMat) {
          const al = equipment.autoLitterBox;
          // Smooth rotating cleaning drum ONLY when safe & cat is not inside
          ref.autoLitterDrum.rotation.z = al.isCleaning
            ? Math.sin(al.cleaningProgress * Math.PI) * 1.45
            : 0;
          if (al.wasteLevel >= 90) {
            ref.autoLitterLedMat.color.set('#d9534f');
            ref.autoLitterLedMat.emissive.set('#c93d39');
          } else if (al.isCleaning) {
            ref.autoLitterLedMat.color.set('#5fa8d3');
            ref.autoLitterLedMat.emissive.set('#3d8cb8');
          } else if (al.kittenSafeLock || al.catInside) {
            ref.autoLitterLedMat.color.set('#e5b44e');
            ref.autoLitterLedMat.emissive.set('#d99f2b');
          } else {
            ref.autoLitterLedMat.color.set('#5cc47a');
            ref.autoLitterLedMat.emissive.set('#4cb86b');
          }
        }

        if (ref.smartBedGlowMat) {
          const sb = equipment.smartCatBed;
          ref.smartBedGlowMat.emissiveIntensity =
            0.25 + sb.warmthLevel * 0.22 + (sb.occupied ? Math.sin(clockSec * 2.4) * 0.12 : 0);
        }

        if (ref.autoToyArmPivot) {
          const at = equipment.autoCatToy;
          ref.autoToyArmPivot.rotation.y = at.armAngle;
          ref.autoToyArmPivot.rotation.z = at.enabled ? Math.sin(clockSec * 9) * 0.1 : 0;
        }
      }
    }
  }

  public updatePlacementPreview(
    catalogId: string | null,
    x: number,
    z: number,
    valid: boolean
  ): void {
    if (!catalogId) {
      if (this.previewGroup) {
        this.roomGroup.remove(this.previewGroup);
        this.previewGroup = null;
      }
      return;
    }

    const item = getCatalogItem(catalogId);
    if (!item) return;

    if (!this.previewGroup || this.previewGroup.userData.catalogId !== catalogId) {
      if (this.previewGroup) this.roomGroup.remove(this.previewGroup);
      const g = new THREE.Group();
      g.userData.catalogId = catalogId;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(item.width, Math.max(0.08, item.height), item.depth),
        this.previewMatValid
      );
      mesh.position.y = Math.max(0.04, item.height / 2);
      g.add(mesh);
      this.previewGroup = g;
      this.roomGroup.add(g);
    }

    this.previewGroup.position.set(x, 0, z);
    const boxMesh = this.previewGroup.children[0] as THREE.Mesh;
    boxMesh.material = valid ? this.previewMatValid : this.previewMatInvalid;
  }
}
