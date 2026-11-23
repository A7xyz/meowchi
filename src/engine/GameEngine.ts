import * as THREE from 'three';
import { validateFurniturePlacement } from '../simulation/collision';
import { useGameStore } from '../store/useGameStore';
import { QualityPreset, Vec2 } from '../types/game';
import { CameraController } from './CameraController';
import { CatRig } from './CatRig';
import { HumanCharacterRig } from './HumanCharacterRig';
import { ParticleOverlay } from './ParticleOverlay';
import { RoomBuilder } from './RoomBuilder';
import { ToyController } from './ToyController';

/**
 * Main Three.js real-time engine coordinating rendering, cozy daylight lighting,
 * mobile touch/pointer raycasting, interactive toys, full 3D human character rig,
 * automatic cat equipment animations, decoration drag, third-person camera framing,
 * and photo capture.
 */
export class GameEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly cameraCtrl: CameraController;
  private readonly roomBuilder: RoomBuilder;
  private readonly catRig: CatRig;
  private readonly humanRig: HumanCharacterRig;
  private readonly toyCtrl: ToyController;
  private readonly particles: ParticleOverlay;
  private readonly sunLight: THREE.DirectionalLight;

  private readonly raycaster = new THREE.Raycaster();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly tmpHandPos = new THREE.Vector3();
  private readonly tmpCarryPos = new THREE.Vector3();
  private readonly tmpHumanPos = new THREE.Vector3();
  private readonly tmpCatPos = new THREE.Vector3();

  private rafId: number | null = null;
  private lastFrameMs = performance.now();
  private elapsedClockSec = 0;
  private lastParticleSeq = 0;
  private lastToyState: string | null = null;
  private pendingSoundPos: Vec2 | null = null;
  private appliedQuality: QualityPreset | null = null;

  // Pointer & Multi-Touch state
  private activePointers = new Map<number, { x: number; y: number }>();
  private pointerDownPos: { x: number; y: number; time: number } | null = null;
  private lastPinchDist = 0;
  private isDraggingFurniture = false;
  private isDraggingFeather = false;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true, // Needed for clean WebGL Photo Mode snapshots
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#efe4d6');
    this.scene.fog = new THREE.Fog('#efe4d6', 8.5, 18);

    // Warm cozy sunlit lighting rig
    const hemi = new THREE.HemisphereLight('#fff7eb', '#d1b598', 1.18);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight('#fff0d4', 1.75);
    this.sunLight.position.set(2.8, 4.4, -3.4);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 14;
    this.sunLight.shadow.camera.left = -4;
    this.sunLight.shadow.camera.right = 4;
    this.sunLight.shadow.camera.top = 4;
    this.sunLight.shadow.camera.bottom = -4;
    this.sunLight.shadow.bias = -0.0008;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight('#e8eef7', 0.48);
    fillLight.position.set(-3.0, 2.6, 3.2);
    this.scene.add(fillLight);

    // Warm golden backlight rim enhancing volumetric cat fur halo & silky Chibi hair sheen
    const furRimLight = new THREE.DirectionalLight('#ffe4bc', 0.55);
    furRimLight.position.set(-1.6, 2.2, -3.2);
    this.scene.add(furRimLight);

    this.cameraCtrl = new CameraController(width / height);
    this.roomBuilder = new RoomBuilder();
    this.scene.add(this.roomBuilder.roomGroup);

    const initState = useGameStore.getState();
    this.catRig = new CatRig(initState.cat.identity);
    this.scene.add(this.catRig.root);

    this.humanRig = new HumanCharacterRig(initState.humanAppearance);
    this.scene.add(this.humanRig.root);

    this.toyCtrl = new ToyController();
    this.scene.add(this.toyCtrl.root);

    this.particles = new ParticleOverlay();
    this.scene.add(this.particles.root);

    this.cameraCtrl.focusOn(
      (initState.cat.position.x + initState.human.position.x) * 0.5,
      0.38,
      (initState.cat.position.z + initState.human.position.z) * 0.5,
      2.18
    );
    this.applyQuality(initState.settings.quality);

    this.bindEvents();
    this.start();
  }

  private applyQuality(quality: QualityPreset): void {
    if (this.appliedQuality === quality) return;
    this.appliedQuality = quality;
    const dpr = window.devicePixelRatio || 1;
    if (quality === 'low') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.0));
      this.sunLight.shadow.mapSize.set(512, 512);
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.sunLight.shadow.mapSize.set(1024, 1024);
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2.0));
      this.sunLight.shadow.mapSize.set(2048, 2048);
    }
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  private getNDC(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  private raycastFloor(clientX: number, clientY: number): THREE.Vector3 | null {
    const ndc = this.getNDC(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.cameraCtrl.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.floorPlane, out);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1) {
      this.pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };
      const state = useGameStore.getState();

      if (state.activeToy === 'feather_wand') {
        this.isDraggingFeather = true;
        const pt = this.raycastFloor(e.clientX, e.clientY);
        if (pt) this.toyCtrl.moveFeatherTo(pt);
      } else if (state.decorateMode && state.selectedFurnitureInstanceId) {
        const ndc = this.getNDC(e.clientX, e.clientY);
        this.raycaster.setFromCamera(ndc, this.cameraCtrl.camera);
        const hits = this.raycaster.intersectObjects(this.roomBuilder.furnitureRoot.children, true);
        if (
          hits.length > 0 &&
          hits[0].object.userData.furnitureInstanceId === state.selectedFurnitureInstanceId
        ) {
          this.isDraggingFurniture = true;
        }
      }
    } else if (this.activePointers.size === 2) {
      this.isDraggingFeather = false;
      this.isDraggingFurniture = false;
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const prev = this.activePointers.get(e.pointerId);
    if (!prev) return;

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const state = useGameStore.getState();

    // Two-finger pinch-to-zoom
    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const delta = (this.lastPinchDist - dist) * 0.009;
      this.cameraCtrl.zoomBy(delta);
      this.lastPinchDist = dist;
      return;
    }

    if (state.decorateMode && state.placingCatalogId) {
      const pt = this.raycastFloor(e.clientX, e.clientY);
      if (pt) {
        const check = validateFurniturePlacement(
          {
            instanceId: '__preview__',
            catalogId: state.placingCatalogId,
            x: pt.x,
            z: pt.z,
            rotationY: 0
          },
          state.placedFurniture
        );
        this.roomBuilder.updatePlacementPreview(state.placingCatalogId, pt.x, pt.z, check.valid);
      }
    }

    if (this.isDraggingFeather && state.activeToy === 'feather_wand') {
      const pt = this.raycastFloor(e.clientX, e.clientY);
      if (pt) this.toyCtrl.moveFeatherTo(pt);
      return;
    }

    if (this.isDraggingFurniture && state.decorateMode && state.selectedFurnitureInstanceId) {
      const pt = this.raycastFloor(e.clientX, e.clientY);
      if (pt) {
        const target = state.placedFurniture.find(
          (f) => f.instanceId === state.selectedFurnitureInstanceId
        );
        if (target) {
          const check = validateFurniturePlacement(
            { ...target, x: pt.x, z: pt.z },
            state.placedFurniture
          );
          this.roomBuilder.updatePlacementPreview(target.catalogId, pt.x, pt.z, check.valid);
          if (check.valid) {
            state.moveFurniture(target.instanceId, pt.x, pt.z);
          }
        }
      }
      return;
    }

    // Standard touch/mouse camera orbit
    this.cameraCtrl.orbitBy(dx, dy);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    const wasTap =
      this.pointerDownPos !== null &&
      performance.now() - this.pointerDownPos.time < 320 &&
      Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) < 12;

    if (this.isDraggingFurniture) {
      this.isDraggingFurniture = false;
      this.roomBuilder.updatePlacementPreview(null, 0, 0, true);
    }
    this.isDraggingFeather = false;

    if (wasTap && this.activePointers.size === 0) {
      this.handleTap(e.clientX, e.clientY);
    }

    if (this.activePointers.size === 0) {
      this.pointerDownPos = null;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cameraCtrl.zoomBy(e.deltaY * 0.0022);
  };

  private handleTap(clientX: number, clientY: number): void {
    const state = useGameStore.getState();
    const ndc = this.getNDC(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.cameraCtrl.camera);

    // 1. Decorate mode tap handling
    if (state.decorateMode) {
      if (state.placingCatalogId) {
        const pt = this.raycastFloor(clientX, clientY);
        if (pt) {
          const placed = state.placeNewFurniture(state.placingCatalogId, pt.x, pt.z);
          if (placed) {
            this.roomBuilder.updatePlacementPreview(null, 0, 0, true);
          } else {
            const lang = state.settings.language;
            state.showToast(
              lang === 'th'
                ? 'วางตรงนี้ไม่ได้เพราะทับเฟอร์นิเจอร์หรือติดผนัง'
                : 'Cannot place here—collides with furniture or wall.',
              'warn'
            );
          }
        }
        return;
      }

      const furnHits = this.raycaster.intersectObjects(
        this.roomBuilder.furnitureRoot.children,
        true
      );
      if (furnHits.length > 0) {
        const id = furnHits[0].object.userData.furnitureInstanceId as string | undefined;
        if (id) {
          state.selectFurniture(id);
          return;
        }
      }
      state.selectFurniture(null);
      return;
    }

    // 2. Ball toy tap-to-roll
    if (state.activeToy === 'ball') {
      const pt = this.raycastFloor(clientX, clientY);
      if (pt) {
        this.toyCtrl.rollBallToward(pt);
        return;
      }
    }

    // 3. Tap on Cat -> human walks over and pets gently!
    const catHits = this.raycaster.intersectObjects(this.catRig.root.children, true);
    if (catHits.length > 0) {
      state.petCat();
      return;
    }

    // 4. Tap on Furniture -> contextual human interaction
    const furnHits = this.raycaster.intersectObjects(
      this.roomBuilder.furnitureRoot.children,
      true
    );
    if (furnHits.length > 0) {
      const catalogId = furnHits[0].object.userData.furnitureCatalogId as string | undefined;
      const hitPt = furnHits[0].point;
      if (catalogId === 'food_bowl_ceramic') {
        state.feedCat(state.cat.lifeStage === 'newborn' ? 'kitten_milk' : 'kitten_wet');
        return;
      }
      if (catalogId === 'auto_food_feeder') {
        state.setShowEquipmentModal(true);
        return;
      }
      if (catalogId === 'water_bowl_ceramic') {
        state.giveWater();
        return;
      }
      if (catalogId === 'auto_water_fountain') {
        state.refillWaterFountain();
        return;
      }
      if (catalogId === 'litter_box_cozy') {
        state.cleanLitterBox();
        return;
      }
      if (catalogId === 'auto_litter_box') {
        state.setShowEquipmentModal(true);
        return;
      }
      if (catalogId === 'auto_cat_toy') {
        state.toggleAutoCatToy();
        return;
      }
      if (catalogId === 'bed_plush' || catalogId === 'bed_woven' || catalogId === 'smart_cat_bed') {
        state.tuckCatToSleep();
        return;
      }
      if (catalogId === 'table_oak' && state.room.tableMugKnocked) {
        state.cleanLivingArea();
        return;
      }
      if (catalogId === 'scratching_post_sisal' || catalogId === 'cat_tower_oak') {
        state.activateToy('scratching_post');
        return;
      }
      if (catalogId === 'cardboard_box') {
        state.activateToy('cardboard_box');
        return;
      }
      this.cameraCtrl.focusOn(hitPt.x, 0.35, hitPt.z);
      return;
    }

    // 5. Tap on floor -> soft tap sound cue (curious cat turns ears to listen!)
    const floorPt = this.raycastFloor(clientX, clientY);
    if (floorPt) {
      this.pendingSoundPos = { x: floorPt.x, z: floorPt.z };
    }
  }

  private onResize = (): void => {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.cameraCtrl.setAspect(w / h);
    this.renderer.setSize(w, h);
  };

  private bindEvents(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
  }

  public focusOnCat(): void {
    const st = useGameStore.getState();
    this.cameraCtrl.focusOn(st.cat.position.x, st.cat.position.y + 0.32, st.cat.position.z, 2.2);
  }

  public capturePhotoDataUrl(): string {
    this.renderer.render(this.scene, this.cameraCtrl.camera);
    return this.renderer.domElement.toDataURL('image/jpeg', 0.86);
  }

  private start(): void {
    const tick = (nowMs: number) => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameMs) / 1000));
      this.lastFrameMs = nowMs;
      this.elapsedClockSec += dt;

      const state = useGameStore.getState();
      this.applyQuality(state.settings.quality);

      // Sync active toy state changes
      if (this.lastToyState !== state.activeToy) {
        this.lastToyState = state.activeToy;
        this.toyCtrl.setActiveToy(state.activeToy, state.cat.position);
      }

      // Compute human right hand position so Feather Wand attaches directly to the 3D human's hand!
      const handWorld =
        state.activeToy === 'feather_wand'
          ? this.humanRig.getRightHandWorldPosition(this.tmpHandPos)
          : null;

      // Step 3D toy physics & get target for cat AI
      const toyTarget = this.toyCtrl.update(
        dt,
        state.cat.position,
        () => {
          useGameStore.getState().recordToyPlayReward();
        },
        handWorld
      );

      // Step headless simulation (includes human navigation, centralized action controller, cat AI, growth, survival)
      const soundCue = this.pendingSoundPos;
      this.pendingSoundPos = null;
      state.stepSimulation(
        dt,
        { x: state.human.position.x, z: state.human.position.z },
        toyTarget,
        soundCue
      );

      const latest = useGameStore.getState();

      // Sync 3D furniture & live room/equipment state
      this.roomBuilder.syncFurniture(
        latest.placedFurniture,
        latest.room,
        latest.selectedFurnitureInstanceId,
        latest.decorateMode,
        latest.equipment,
        this.elapsedClockSec
      );

      if (!latest.decorateMode) {
        this.roomBuilder.updatePlacementPreview(null, 0, 0, true);
      }

      // Trigger particle burst on care/play/sleep cues
      if (latest.particleCue.seq !== this.lastParticleSeq) {
        this.lastParticleSeq = latest.particleCue.seq;
        this.particles.burst(
          latest.particleCue.type,
          latest.cat.position.x,
          latest.cat.position.y + 0.16,
          latest.cat.position.z
        );
      }
      this.particles.update(dt);

      // Update Full 3D Human Character Rig FIRST so carry cradle & hand anchors are fresh!
      this.humanRig.root.visible = latest.hasCreatedHuman || latest.hasAdoptedInitialCat;
      this.humanRig.update(
        dt,
        latest.humanAppearance,
        latest.human,
        latest.cat,
        latest.placedFurniture,
        latest.activeCareAction,
        toyTarget
      );

      // Update CatRig (supports smooth cradling in human arms during pickup!)
      this.catRig.root.visible = latest.survival.isAlive;
      let lookTarget: THREE.Vector3 | null = null;
      if (toyTarget) {
        lookTarget = new THREE.Vector3(toyTarget.x, toyTarget.y, toyTarget.z);
      } else if (
        latest.activeCareAction !== null ||
        latest.cat.bondLevel >= 5 ||
        latest.cat.behavior === 'approach_player' ||
        latest.cat.behavior === 'head_bunt'
      ) {
        lookTarget = new THREE.Vector3(
          latest.human.position.x,
          latest.human.position.y + 0.68,
          latest.human.position.z
        );
      }

      const carriedOverride = latest.human.carryingCat
        ? {
            pos: this.humanRig.getCarryWorldPosition(this.tmpCarryPos),
            yaw: latest.human.rotationY + Math.PI * 0.5
          }
        : null;
      this.catRig.update(latest.cat, dt, lookTarget, carriedOverride);

      // Update Third-Person Camera (smoothly frames BOTH human & cat during interactions!)
      this.tmpHumanPos.set(
        latest.human.position.x,
        latest.human.position.y,
        latest.human.position.z
      );
      this.tmpCatPos.set(latest.cat.position.x, latest.cat.position.y, latest.cat.position.z);

      if (latest.activeCareAction && !latest.decorateMode) {
        this.cameraCtrl.frameInteraction(
          this.tmpHumanPos,
          this.tmpCatPos,
          latest.activeCareAction.type
        );
        this.cameraCtrl.update(dt, null);
      } else {
        this.cameraCtrl.endInteractionFraming();
        const followCatVec =
          latest.settings.followCat && !latest.decorateMode ? this.tmpCatPos : null;
        const secondaryHumanVec =
          latest.settings.followCat && !latest.decorateMode ? this.tmpHumanPos : null;
        this.cameraCtrl.update(dt, followCatVec, secondaryHumanVec);
      }

      this.renderer.render(this.scene, this.cameraCtrl.camera);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (el.parentElement) el.parentElement.removeChild(el);
  }
}
