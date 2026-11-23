import * as THREE from 'three';
import { validateFurniturePlacement } from '../simulation/collision';
import { useGameStore } from '../store/useGameStore';
import { QualityPreset, Vec2 } from '../types/game';
import { CameraController } from './CameraController';
import { CatRig } from './CatRig';
import { HumanHandRig } from './HumanHandRig';
import { ParticleOverlay } from './ParticleOverlay';
import { RoomBuilder } from './RoomBuilder';
import { ToyController } from './ToyController';

/**
 * Main Three.js real-time engine coordinating rendering, cozy daylight lighting,
 * mobile touch/pointer raycasting, interactive toys, first-person 3D human hand,
 * automatic cat equipment animations, decoration drag, and photo capture.
 */
export class GameEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly cameraCtrl: CameraController;
  private readonly roomBuilder: RoomBuilder;
  private readonly catRig: CatRig;
  private readonly humanHandRig: HumanHandRig;
  private readonly toyCtrl: ToyController;
  private readonly particles: ParticleOverlay;
  private readonly sunLight: THREE.DirectionalLight;

  private readonly raycaster = new THREE.Raycaster();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
    this.scene.fog = new THREE.Fog('#efe4d6', 7.5, 16);

    // Warm cozy sunlit lighting rig
    const hemi = new THREE.HemisphereLight('#fff7eb', '#d1b598', 1.15);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight('#fff0d4', 1.75);
    this.sunLight.position.set(2.8, 4.4, -3.4); // Streaming from the sunlit window
    this.sunLight.castShadow = true;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 14;
    this.sunLight.shadow.camera.left = -4;
    this.sunLight.shadow.camera.right = 4;
    this.sunLight.shadow.camera.top = 4;
    this.sunLight.shadow.camera.bottom = -4;
    this.sunLight.shadow.bias = -0.0008;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight('#e8eef7', 0.45);
    fillLight.position.set(-3.0, 2.6, 3.2);
    this.scene.add(fillLight);

    this.cameraCtrl = new CameraController(width / height);
    this.roomBuilder = new RoomBuilder();
    this.scene.add(this.roomBuilder.roomGroup);

    const initialCat = useGameStore.getState().cat;
    this.catRig = new CatRig(initialCat.identity);
    this.scene.add(this.catRig.root);

    this.humanHandRig = new HumanHandRig();
    this.scene.add(this.humanHandRig.root);

    this.toyCtrl = new ToyController();
    this.scene.add(this.toyCtrl.root);

    this.particles = new ParticleOverlay();
    this.scene.add(this.particles.root);

    this.cameraCtrl.focusOn(initialCat.position.x, 0.2, initialCat.position.z, 1.95);
    this.applyQuality(useGameStore.getState().settings.quality);

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
        // Check if dragging the currently selected furniture
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

    // Placement ghost preview while placing a newly chosen furniture item
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

    // 3. Tap on Cat -> focus & pet gently!
    const catHits = this.raycaster.intersectObjects(this.catRig.root.children, true);
    if (catHits.length > 0) {
      const pos = state.cat.position;
      this.cameraCtrl.focusOn(pos.x, pos.y + 0.16, pos.z, 1.55);
      state.petCat();
      return;
    }

    // 4. Tap on Furniture -> focus + helpful contextual interaction
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
      this.cameraCtrl.focusOn(hitPt.x, 0.25, hitPt.z);
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
    const pos = useGameStore.getState().cat.position;
    this.cameraCtrl.focusOn(pos.x, pos.y + 0.16, pos.z, 1.65);
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

      // Synchronize active visible-hand interaction commit/finish with animation clock
      if (state.activeCareAction) {
        const elapsedActionMs = Date.now() - state.activeCareAction.startedAtMs;
        if (!state.activeCareAction.committed && elapsedActionMs >= state.activeCareAction.contactAtMs) {
          state.commitActiveCareAction();
        }
        if (elapsedActionMs >= state.activeCareAction.durationMs) {
          state.finishActiveCareAction();
        }
      }

      // Sync active toy state changes
      if (this.lastToyState !== state.activeToy) {
        this.lastToyState = state.activeToy;
        this.toyCtrl.setActiveToy(state.activeToy, state.cat.position);
      }

      // Step 3D toy physics & get target for cat AI
      const toyTarget = this.toyCtrl.update(dt, state.cat.position, () => {
        useGameStore.getState().recordToyPlayReward();
      });

      // Step headless simulation
      const soundCue = this.pendingSoundPos;
      this.pendingSoundPos = null;
      state.stepSimulation(
        dt,
        { x: this.cameraCtrl.target.x, z: this.cameraCtrl.target.z },
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

      // Update CatRig look-at target (toy > camera if bonded)
      let lookTarget: THREE.Vector3 | null = null;
      if (toyTarget) {
        lookTarget = new THREE.Vector3(toyTarget.x, toyTarget.y, toyTarget.z);
      } else if (latest.cat.bondLevel >= 5 || latest.cat.behavior === 'approach_player') {
        lookTarget = this.cameraCtrl.camera.position;
      }
      this.catRig.update(latest.cat, dt, lookTarget);

      // Update Camera
      const followVec =
        latest.settings.followCat && !latest.decorateMode
          ? new THREE.Vector3(latest.cat.position.x, latest.cat.position.y, latest.cat.position.z)
          : null;
      this.cameraCtrl.update(dt, followVec);

      // Update Visible First-Person 3D Human Hand & Care Tools
      this.humanHandRig.update(
        dt,
        this.cameraCtrl.camera,
        latest.cat,
        latest.placedFurniture,
        latest.activeCareAction,
        toyTarget
      );

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
