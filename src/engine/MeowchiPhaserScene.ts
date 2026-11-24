import Phaser from 'phaser';
import { getBreedDefinition } from '../config/breeds';
import { getCatalogItem, ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import { validateFurniturePlacement } from '../simulation/collision';
import { clamp, computeGrowthMetrics } from '../simulation/growth';
import { useGameStore } from '../store/useGameStore';
import {
  CatIdentity,
  HumanAppearance,
  HumanGender,
  LifeStage,
  PlacedFurniture,
  ToyType,
  Vec2,
  Vec3
} from '../types/game';
import {
  computeDepth,
  screenToWorld,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  worldToScreen
} from './RoomProjection';
import {
  createCustomizedCatCanvas,
  createCustomizedHumanCanvas,
  getCatCoatSignature,
  getHumanAppearanceSignature
} from './SpriteCustomizer';
import {
  CAT_SPRITE_ACTIONS,
  CatSpriteAction,
  getCatAtlasKey,
  getHumanAtlasKey,
  HUMAN_SPRITE_ACTIONS,
  HumanSpriteAction,
  PROP_ATLAS_MAP,
  resolveCatSpriteAction,
  resolveHumanSpriteAction
} from './SpriteManifest';

interface FurnitureVisual {
  instanceId: string;
  catalogId: string;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  fxOverlay?: Phaser.GameObjects.Graphics;
}

interface Particle2D {
  node: Phaser.GameObjects.Text | Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/**
 * Main Phaser 3 2D Portrait Scene for Meowchi.
 * Renders sunlit 2D living room, 22 AI furniture/equipment/toy sprites, fully animated
 * semi-realistic fluffy cat (33 sprite actions), fully animated Chibi human (17 actions
 * male/female), synchronized care interactions, interactive 2D toys, depth sorting,
 * lazy atlas loading, dynamic coat/outfit customization, and mobile touch controls.
 */
export class MeowchiPhaserScene extends Phaser.Scene {
  private bgImage!: Phaser.GameObjects.Image;
  private catSprite!: Phaser.GameObjects.Sprite;
  private catShadow!: Phaser.GameObjects.Ellipse;
  private catAccessoryGfx!: Phaser.GameObjects.Graphics;
  private humanSprite!: Phaser.GameObjects.Sprite;
  private humanShadow!: Phaser.GameObjects.Ellipse;
  private statusFxGfx!: Phaser.GameObjects.Graphics;
  private dustGfx!: Phaser.GameObjects.Graphics;

  // Interactive 2D Toys
  private toyWandGfx!: Phaser.GameObjects.Graphics;
  private toyFeatherSprite!: Phaser.GameObjects.Image;
  private toyBallSprite!: Phaser.GameObjects.Image;
  private toyMouseSprite!: Phaser.GameObjects.Image;
  private wandTarget: Vec3 = { x: 0, y: 0.35, z: 0.45 };
  private featherPos: Vec3 = { x: 0, y: 0.25, z: 0.45 };
  private featherVel: Vec3 = { x: 0, y: 0, z: 0 };
  private ballPos: Vec3 = { x: 0.45, y: 0.06, z: 0.55 };
  private ballVel: Vec2 = { x: 0, z: 0 };
  private mousePos: Vec3 = { x: -0.35, y: 0.04, z: 0.65 };
  private mouseVel: Vec2 = { x: 0.55, z: 0.38 };
  private playRewardCooldown = 0;
  private lastToyState: ToyType | null = null;

  // Furniture map & decorate placement preview
  private furnitureMap = new Map<string, FurnitureVisual>();
  private previewSprite: Phaser.GameObjects.Image | null = null;

  // Lazy-loading & custom texture cache
  private loadedAtlases = new Set<string>();
  private loadingAtlases = new Set<string>();
  private customTextureLru: string[] = [];
  private activeCatAnimKey = '';
  private activeHumanAnimKey = '';
  private lastCatCoatSig = '';
  private lastHumanAppSig = '';
  private lastLoadedGender: HumanGender = 'female';
  private pendingSoundPos: Vec2 | null = null;

  // Particles & ambient motes
  private particles: Particle2D[] = [];
  private lastParticleSeq = 0;
  private dustMotes: { x: number; y: number; r: number; phase: number; speed: number }[] = [];
  private elapsedSec = 0;

  // Touch & drag state
  private pointerDownPos: { x: number; y: number; time: number } | null = null;
  private isDraggingFeather = false;
  private isDraggingFurniture = false;
  private cameraTargetZoom = 1.0;
  private cameraTargetScrollX = 0;
  private cameraTargetScrollY = 0;

  constructor() {
    super({ key: 'MeowchiScene' });
  }

  preload(): void {
    const base = './sprites/';
    this.load.image('room_bg', `${base}room/cozy_living_room_bg.png`);

    // Prop Atlases (22 final AI sprites)
    this.load.atlas('props_care', `${base}props/props_care.png`, `${base}props/props_care.json`);
    this.load.atlas('props_living', `${base}props/props_living.png`, `${base}props/props_living.json`);
    this.load.atlas(
      'props_equipment',
      `${base}props/props_equipment.png`,
      `${base}props/props_equipment.json`
    );

    // Boot-priority Cat animations (remaining 28 lazy-loaded on demand!)
    (Object.keys(CAT_SPRITE_ACTIONS) as CatSpriteAction[]).forEach((action) => {
      if (CAT_SPRITE_ACTIONS[action].priority === 'boot') {
        const key = getCatAtlasKey(action);
        this.load.atlas(key, `${base}cat/${action}.png`, `${base}cat/${action}.json`);
        this.loadingAtlases.add(key);
      }
    });

    // Boot-priority Human animations for active gender ONLY
    const initGender = useGameStore.getState().humanAppearance.gender;
    this.lastLoadedGender = initGender;
    (Object.keys(HUMAN_SPRITE_ACTIONS) as HumanSpriteAction[]).forEach((action) => {
      if (HUMAN_SPRITE_ACTIONS[action].priority === 'boot') {
        const key = getHumanAtlasKey(initGender, action);
        this.load.atlas(
          key,
          `${base}human/${initGender}/${action}.png`,
          `${base}human/${initGender}/${action}.json`
        );
        this.loadingAtlases.add(key);
      }
    });

    this.load.on('filecomplete-atlasjson', (key: string) => {
      this.loadedAtlases.add(key);
      this.loadingAtlases.delete(key);
      this.registerBaseAnimationIfNeeded(key);
    });
  }

  create(): void {
    // Mark preloaded atlases ready
    ['props_care', 'props_living', 'props_equipment'].forEach((k) => this.loadedAtlases.add(k));
    this.textures.getTextureKeys().forEach((k) => {
      if (k.startsWith('cat_') || k.startsWith('human_')) {
        this.loadedAtlases.add(k);
        this.loadingAtlases.delete(k);
        this.registerBaseAnimationIfNeeded(k);
      }
    });

    // 1. Cozy Sunlit 9:16 Living Room Background
    this.bgImage = this.add.image(STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 'room_bg');
    this.bgImage.setDisplaySize(STAGE_WIDTH, STAGE_HEIGHT);
    this.bgImage.setDepth(0);

    // Warm sunlit floating dust motes
    this.dustGfx = this.add.graphics().setDepth(920);
    for (let i = 0; i < 18; i++) {
      this.dustMotes.push({
        x: 220 + Math.random() * 440,
        y: 180 + Math.random() * 680,
        r: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.5
      });
    }

    // 2. Ground shadows & Character Sprites
    this.humanShadow = this.add.ellipse(360, 780, 96, 30, 0x3b2a1c, 0.24).setDepth(50);
    this.humanSprite = this.add.sprite(360, 780, getHumanAtlasKey(this.lastLoadedGender, 'idle'));
    this.humanSprite.setOrigin(0.5, 0.94);

    this.catShadow = this.add.ellipse(320, 820, 82, 26, 0x3b2a1c, 0.24).setDepth(50);
    this.catSprite = this.add.sprite(320, 820, getCatAtlasKey('idle'));
    this.catSprite.setOrigin(0.5, 0.9);
    this.catAccessoryGfx = this.add.graphics().setDepth(900);

    // 3. Interactive 2D Toys
    this.toyWandGfx = this.add.graphics().setDepth(960);
    this.toyFeatherSprite = this.add
      .image(360, 760, 'props_equipment', 'toy_feather_wand')
      .setScale(0.32)
      .setVisible(false)
      .setDepth(965);
    this.toyBallSprite = this.add
      .image(360, 760, 'props_living', 'toy_ball')
      .setScale(0.24)
      .setVisible(false)
      .setDepth(800);
    this.toyMouseSprite = this.add
      .image(360, 760, 'props_living', 'toy_mouse')
      .setScale(0.24)
      .setVisible(false)
      .setDepth(800);

    this.statusFxGfx = this.add.graphics().setDepth(940);

    // 4. Touch & Pointer Interaction Bindings
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);

    // Start playing boot idle animations right away
    const initState = useGameStore.getState();
    this.playCatAction('idle', initState.cat.identity, initState.cat.lifeStage);
    this.playHumanAction('idle', initState.humanAppearance);

    // Background lazy-prefetch of common gameplay actions after initial render
    this.time.delayedCall(600, () => {
      (['run', 'jump', 'land', 'eat', 'drink', 'groom', 'happy', 'curious', 'pounce', 'play_toy'] as const).forEach(
        (act) => {
          if (act === 'play_toy') {
            this.requestHumanAtlas(useGameStore.getState().humanAppearance.gender, 'play_toy');
          } else {
            this.requestCatAtlas(act);
          }
        }
      );
      const g = useGameStore.getState().humanAppearance.gender;
      (['pour_food', 'refill_water', 'brush_cat', 'hold_cat', 'put_cat_down', 'clean_litter'] as HumanSpriteAction[]).forEach(
        (a) => this.requestHumanAtlas(g, a)
      );
    });
  }

  private registerBaseAnimationIfNeeded(atlasKey: string): void {
    if (this.anims.exists(atlasKey)) return;
    const tex = this.textures.get(atlasKey);
    if (!tex || tex.key === '__MISSING') return;
    const frameNames = tex.getFrameNames().sort();
    if (frameNames.length === 0) return;

    let fps = 9;
    let repeat = -1;
    if (atlasKey.startsWith('cat_')) {
      const action = atlasKey.slice(4) as CatSpriteAction;
      const def = CAT_SPRITE_ACTIONS[action];
      if (def) {
        fps = def.fps;
        repeat = def.loop ? -1 : 0;
      }
    } else if (atlasKey.startsWith('human_')) {
      const parts = atlasKey.split('_');
      const action = parts.slice(2).join('_') as HumanSpriteAction;
      const def = HUMAN_SPRITE_ACTIONS[action];
      if (def) {
        fps = def.fps;
        repeat = def.loop ? -1 : 0;
      }
    }

    this.anims.create({
      key: atlasKey,
      frames: frameNames.map((frame) => ({ key: atlasKey, frame })),
      frameRate: fps,
      repeat
    });
  }

  private requestCatAtlas(action: CatSpriteAction): void {
    const key = getCatAtlasKey(action);
    if (this.loadedAtlases.has(key) || this.loadingAtlases.has(key)) return;
    this.loadingAtlases.add(key);
    this.load.atlas(key, `./sprites/cat/${action}.png`, `./sprites/cat/${action}.json`);
    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  private requestHumanAtlas(gender: HumanGender, action: HumanSpriteAction): void {
    const key = getHumanAtlasKey(gender, action);
    if (this.loadedAtlases.has(key) || this.loadingAtlases.has(key)) return;
    this.loadingAtlases.add(key);
    this.load.atlas(
      key,
      `./sprites/human/${gender}/${action}.png`,
      `./sprites/human/${gender}/${action}.json`
    );
    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  /**
   * Builds or retrieves a cached dynamically recolored Phaser CanvasTexture + Animation
   * so any cat breed/coat/pattern or human skin/hair/outfit color animates seamlessly!
   */
  private ensureCustomizedAnim(
    baseKey: string,
    customKey: string,
    buildCanvas: (img: HTMLImageElement) => HTMLCanvasElement,
    fps: number,
    loop: boolean
  ): string {
    if (this.anims.exists(customKey) && this.textures.exists(customKey)) {
      return customKey;
    }
    const baseTex = this.textures.get(baseKey);
    if (!baseTex || baseTex.key === '__MISSING') return baseKey;
    const srcImg = baseTex.getSourceImage() as HTMLImageElement | null;
    if (!srcImg || !srcImg.width) return baseKey;

    if (!this.textures.exists(customKey)) {
      const customCanvas = buildCanvas(srcImg);
      const canvasTex = this.textures.addCanvas(customKey, customCanvas);
      if (!canvasTex) return baseKey;

      const frameNames = baseTex.getFrameNames().sort();
      for (const fn of frameNames) {
        const f = baseTex.get(fn);
        canvasTex.add(fn, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
      }

      // Evict oldest customized texture if mobile LRU cache exceeds 24 entries
      this.customTextureLru.push(customKey);
      while (this.customTextureLru.length > 24) {
        const evict = this.customTextureLru.shift();
        if (evict && evict !== this.activeCatAnimKey && evict !== this.activeHumanAnimKey) {
          if (this.anims.exists(evict)) this.anims.remove(evict);
          if (this.textures.exists(evict)) this.textures.remove(evict);
        }
      }
    }

    if (!this.anims.exists(customKey)) {
      const frameNames = baseTex.getFrameNames().sort();
      this.anims.create({
        key: customKey,
        frames: frameNames.map((frame) => ({ key: customKey, frame })),
        frameRate: fps,
        repeat: loop ? -1 : 0
      });
    }

    return customKey;
  }

  private playCatAction(
    action: CatSpriteAction,
    identity: CatIdentity,
    stage: LifeStage
  ): void {
    const baseKey = getCatAtlasKey(action);
    let resolvedAction = action;
    let resolvedBaseKey = baseKey;

    if (!this.loadedAtlases.has(baseKey)) {
      this.requestCatAtlas(action);
      // Graceful boot-tier fallback while lazy-loading (usually <30ms)
      resolvedAction = action === 'run' || action === 'zoomies' || action === 'chase_toy' ? 'walk' : 'idle';
      resolvedBaseKey = getCatAtlasKey(resolvedAction);
      if (!this.loadedAtlases.has(resolvedBaseKey)) return;
    }

    const coatSig = getCatCoatSignature(identity, stage);
    const needsCustom = !(
      identity.furColorId === 'cream' &&
      (identity.furPattern === 'bicolor' || identity.furPattern === 'solid') &&
      identity.eyeColorId === 'amber' &&
      stage !== 'senior'
    );

    const def = CAT_SPRITE_ACTIONS[resolvedAction];
    const animKey = needsCustom
      ? this.ensureCustomizedAnim(
          resolvedBaseKey,
          `${resolvedBaseKey}__${coatSig}`,
          (img) => createCustomizedCatCanvas(img, identity, stage),
          def.fps,
          def.loop
        )
      : resolvedBaseKey;

    if (this.activeCatAnimKey !== animKey || !this.catSprite.anims.isPlaying) {
      this.activeCatAnimKey = animKey;
      this.catSprite.play(animKey, true);
    }
  }

  private playHumanAction(action: HumanSpriteAction, appearance: HumanAppearance): void {
    const gender = appearance.gender;
    if (gender !== this.lastLoadedGender) {
      this.lastLoadedGender = gender;
      (['idle', 'walk', 'pet_cat'] as HumanSpriteAction[]).forEach((a) =>
        this.requestHumanAtlas(gender, a)
      );
    }

    let resolvedAction = action;
    let resolvedBaseKey = getHumanAtlasKey(gender, action);

    if (!this.loadedAtlases.has(resolvedBaseKey)) {
      this.requestHumanAtlas(gender, action);
      resolvedAction = action === 'run' ? 'walk' : 'idle';
      resolvedBaseKey = getHumanAtlasKey(gender, resolvedAction);
      if (!this.loadedAtlases.has(resolvedBaseKey)) {
        // Fallback to previously loaded gender idle while new gender boot sheet loads
        const prevKey = getHumanAtlasKey(gender === 'female' ? 'male' : 'female', 'idle');
        if (this.loadedAtlases.has(prevKey)) {
          resolvedBaseKey = prevKey;
        } else {
          return;
        }
      }
    }

    const appSig = getHumanAppearanceSignature(appearance);
    const def = HUMAN_SPRITE_ACTIONS[resolvedAction];
    const animKey = this.ensureCustomizedAnim(
      resolvedBaseKey,
      `${resolvedBaseKey}__${appSig}`,
      (img) => createCustomizedHumanCanvas(img, appearance),
      def.fps,
      def.loop
    );

    if (this.activeHumanAnimKey !== animKey || !this.humanSprite.anims.isPlaying) {
      this.activeHumanAnimKey = animKey;
      this.humanSprite.play(animKey, true);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.pointerDownPos = { x: pointer.worldX, y: pointer.worldY, time: performance.now() };
    const state = useGameStore.getState();

    if (state.activeToy === 'feather_wand') {
      this.isDraggingFeather = true;
      const wp = screenToWorld(pointer.worldX, pointer.worldY);
      this.wandTarget = { x: wp.x, y: 0.36, z: wp.z };
      return;
    }

    if (state.decorateMode && state.selectedFurnitureInstanceId) {
      const fv = this.furnitureMap.get(state.selectedFurnitureInstanceId);
      if (fv && fv.sprite.getBounds().contains(pointer.worldX, pointer.worldY)) {
        this.isDraggingFurniture = true;
      }
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const state = useGameStore.getState();

    if (state.decorateMode && state.placingCatalogId) {
      const wp = screenToWorld(pointer.worldX, pointer.worldY);
      const check = validateFurniturePlacement(
        {
          instanceId: '__preview__',
          catalogId: state.placingCatalogId,
          x: wp.x,
          z: wp.z,
          rotationY: 0
        },
        state.placedFurniture
      );
      this.updatePlacementPreview(state.placingCatalogId, wp.x, wp.z, check.valid);
      return;
    }

    if (this.isDraggingFeather && state.activeToy === 'feather_wand') {
      const wp = screenToWorld(pointer.worldX, pointer.worldY);
      this.wandTarget = { x: wp.x, y: 0.36, z: wp.z };
      return;
    }

    if (this.isDraggingFurniture && state.decorateMode && state.selectedFurnitureInstanceId) {
      const wp = screenToWorld(pointer.worldX, pointer.worldY);
      const target = state.placedFurniture.find(
        (f) => f.instanceId === state.selectedFurnitureInstanceId
      );
      if (target) {
        const check = validateFurniturePlacement(
          { ...target, x: wp.x, z: wp.z },
          state.placedFurniture
        );
        this.updatePlacementPreview(target.catalogId, wp.x, wp.z, check.valid);
        if (check.valid) {
          state.moveFurniture(target.instanceId, wp.x, wp.z);
        }
      }
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const wasTap =
      this.pointerDownPos !== null &&
      performance.now() - this.pointerDownPos.time < 340 &&
      Math.hypot(pointer.worldX - this.pointerDownPos.x, pointer.worldY - this.pointerDownPos.y) < 18;

    if (this.isDraggingFurniture) {
      this.isDraggingFurniture = false;
      this.updatePlacementPreview(null, 0, 0, true);
    }
    this.isDraggingFeather = false;
    this.pointerDownPos = null;

    if (wasTap) {
      this.handleTap(pointer.worldX, pointer.worldY);
    }
  }

  private handleTap(sx: number, sy: number): void {
    const state = useGameStore.getState();
    const wp = screenToWorld(sx, sy);

    // 1. Decorate Mode placement & selection
    if (state.decorateMode) {
      if (state.placingCatalogId) {
        const placed = state.placeNewFurniture(state.placingCatalogId, wp.x, wp.z);
        if (placed) {
          this.updatePlacementPreview(null, 0, 0, true);
        } else {
          const lang = state.settings.language;
          state.showToast(
            lang === 'th'
              ? 'วางตรงนี้ไม่ได้เพราะทับเฟอร์นิเจอร์หรือติดผนัง'
              : 'Cannot place here—collides with furniture or wall.',
            'warn'
          );
        }
        return;
      }

      const hitFurn = this.pickFurnitureAt(sx, sy);
      state.selectFurniture(hitFurn ? hitFurn.instanceId : null);
      return;
    }

    // 2. Ball toy tap-to-roll
    if (state.activeToy === 'ball') {
      const dx = wp.x - this.ballPos.x;
      const dz = wp.z - this.ballPos.z;
      const len = Math.max(0.05, Math.hypot(dx, dz));
      const speed = clamp(len * 2.2, 1.3, 3.2);
      this.ballVel = { x: (dx / len) * speed, z: (dz / len) * speed };
      return;
    }

    // 3. Tap on Cat -> human walks over and pets!
    if (this.catSprite.visible && this.catSprite.getBounds().contains(sx, sy)) {
      state.petCat();
      return;
    }

    // 4. Tap on Furniture / Automatic Equipment -> contextual human interaction!
    const hitFurn = this.pickFurnitureAt(sx, sy);
    if (hitFurn) {
      const cid = hitFurn.catalogId;
      if (cid === 'food_bowl_ceramic') {
        state.feedCat(state.cat.lifeStage === 'newborn' ? 'kitten_milk' : 'kitten_wet');
        return;
      }
      if (cid === 'auto_food_feeder' || cid === 'auto_litter_box') {
        state.setShowEquipmentModal(true);
        return;
      }
      if (cid === 'water_bowl_ceramic') {
        state.giveWater();
        return;
      }
      if (cid === 'auto_water_fountain') {
        state.refillWaterFountain();
        return;
      }
      if (cid === 'litter_box_cozy') {
        state.cleanLitterBox();
        return;
      }
      if (cid === 'auto_cat_toy') {
        state.toggleAutoCatToy();
        return;
      }
      if (cid === 'bed_plush' || cid === 'bed_woven' || cid === 'smart_cat_bed') {
        state.tuckCatToSleep();
        return;
      }
      if (cid === 'table_oak' && state.room.tableMugKnocked) {
        state.cleanLivingArea();
        return;
      }
      if (cid === 'scratching_post_sisal' || cid === 'cat_tower_oak') {
        state.activateToy('scratching_post');
        return;
      }
      if (cid === 'cardboard_box') {
        state.activateToy('cardboard_box');
        return;
      }
    }

    // 5. Tap on Floor -> gentle sound cue so curious cat looks & trots over!
    this.pendingSoundPos = wp;
  }

  private pickFurnitureAt(sx: number, sy: number): FurnitureVisual | null {
    // Pick front-most (highest depth) non-rug furniture first
    const candidates = Array.from(this.furnitureMap.values())
      .filter((fv) => {
        const item = getCatalogItem(fv.catalogId);
        return !item?.walkable && fv.sprite.getBounds().contains(sx, sy);
      })
      .sort((a, b) => b.sprite.depth - a.sprite.depth);
    return candidates[0] ?? null;
  }

  private updatePlacementPreview(catalogId: string | null, wx: number, wz: number, valid: boolean): void {
    if (!catalogId) {
      if (this.previewSprite) {
        this.previewSprite.destroy();
        this.previewSprite = null;
      }
      return;
    }
    const prop = PROP_ATLAS_MAP[catalogId];
    if (!prop) return;
    const pt = worldToScreen(wx, wz, 0);
    if (!this.previewSprite) {
      this.previewSprite = this.add.image(pt.x, pt.y, prop.atlas, prop.frame);
      this.previewSprite.setOrigin(0.5, 0.88);
    } else {
      this.previewSprite.setTexture(prop.atlas, prop.frame);
      this.previewSprite.setPosition(pt.x, pt.y);
    }
    this.previewSprite.setScale(this.getFurnitureDisplayScale(catalogId) * pt.depthScale);
    this.previewSprite.setAlpha(0.68);
    this.previewSprite.setTint(valid ? 0x8ef5a8 : 0xff7b7b);
    this.previewSprite.setDepth(950);
  }

  private getFurnitureDisplayScale(catalogId: string): number {
    switch (catalogId) {
      case 'rug_linen':
      case 'rug_terracotta':
        return 1.25;
      case 'sofa_linen':
        return 1.08;
      case 'cat_tower_oak':
        return 0.96;
      case 'floor_lamp_warm':
        return 0.88;
      case 'table_oak':
        return 0.72;
      case 'auto_litter_box':
        return 0.62;
      case 'scratching_post_sisal':
        return 0.66;
      case 'bed_plush':
      case 'bed_woven':
      case 'smart_cat_bed':
        return 0.56;
      case 'litter_box_cozy':
      case 'cardboard_box':
        return 0.54;
      case 'auto_food_feeder':
        return 0.52;
      case 'auto_water_fountain':
      case 'auto_cat_toy':
        return 0.42;
      case 'food_bowl_ceramic':
      case 'water_bowl_ceramic':
        return 0.34;
      default:
        return 0.5;
    }
  }

  private syncFurniture(placed: PlacedFurniture[]): void {
    const state = useGameStore.getState();
    const keepIds = new Set(placed.map((p) => p.instanceId));

    // Remove deleted items
    for (const [id, fv] of this.furnitureMap.entries()) {
      if (!keepIds.has(id)) {
        fv.sprite.destroy();
        fv.shadow.destroy();
        fv.fxOverlay?.destroy();
        this.furnitureMap.delete(id);
      }
    }

    for (const f of placed) {
      const propInfo = PROP_ATLAS_MAP[f.catalogId];
      if (!propInfo) continue; // wall art already painted cleanly on living room wall

      const item = getCatalogItem(f.catalogId);
      const pt = worldToScreen(f.x, f.z, 0);
      const isRug = Boolean(item?.walkable);
      const scale = this.getFurnitureDisplayScale(f.catalogId) * pt.depthScale;

      // Dynamic empty vs full ceramic food bowl swap!
      const frame =
        f.catalogId === 'food_bowl_ceramic' && state.room.foodBowlLevel > 5
          ? 'food_bowl_full'
          : propInfo.frame;

      let fv = this.furnitureMap.get(f.instanceId);
      if (!fv) {
        const shadow = this.add.ellipse(
          pt.x,
          pt.groundY - 4,
          120 * scale,
          34 * scale,
          0x3b2a1c,
          isRug ? 0 : 0.2
        );
        const sprite = this.add.image(pt.x, pt.groundY, propInfo.atlas, frame);
        sprite.setOrigin(0.5, 0.88);
        fv = { instanceId: f.instanceId, catalogId: f.catalogId, sprite, shadow };
        this.furnitureMap.set(f.instanceId, fv);
      }

      if (fv.sprite.frame.name !== frame) {
        fv.sprite.setTexture(propInfo.atlas, frame);
      }
      fv.sprite.setPosition(pt.x, pt.groundY);
      fv.sprite.setScale(scale);
      fv.shadow.setPosition(pt.x, pt.groundY - 4);
      fv.shadow.setSize(128 * scale, 36 * scale);
      fv.shadow.setVisible(!isRug);

      const depth = isRug ? 20 : computeDepth(pt.groundY, 0);
      fv.sprite.setDepth(depth);
      fv.shadow.setDepth(depth - 2);

      // Selection highlight in decorate mode
      if (state.decorateMode && state.selectedFurnitureInstanceId === f.instanceId) {
        fv.sprite.setTint(0xffe7b8);
      } else {
        fv.sprite.clearTint();
      }
    }
  }

  private drawLiveEquipmentFx(): void {
    const state = useGameStore.getState();
    this.statusFxGfx.clear();

    for (const f of state.placedFurniture) {
      const pt = worldToScreen(f.x, f.z, 0);
      // 1. Auto Water Fountain sparkling droplets
      if (f.catalogId === 'auto_water_fountain' && state.equipment.waterFountain.isFlowing) {
        const pulse = Math.sin(this.elapsedSec * 7) * 4;
        this.statusFxGfx.fillStyle(0xbde9ff, 0.78);
        this.statusFxGfx.fillCircle(pt.x - 4, pt.groundY - 58 + pulse, 3.2);
        this.statusFxGfx.fillCircle(pt.x + 5, pt.groundY - 52 - pulse * 0.7, 2.6);
      }
      // 2. Smart Heated Cat Bed warm amber glow
      if (f.catalogId === 'smart_cat_bed') {
        const glow = 0.14 + Math.sin(this.elapsedSec * 2.4) * 0.06;
        this.statusFxGfx.fillStyle(0xffbe66, glow);
        this.statusFxGfx.fillEllipse(pt.x, pt.groundY - 34, 86 * pt.depthScale, 46 * pt.depthScale);
      }
      // 3. Auto Litter Box cleaning cycle indicator
      if (f.catalogId === 'auto_litter_box' && state.equipment.autoLitterBox.isCleaning) {
        const prog = state.equipment.autoLitterBox.cleaningProgress;
        this.statusFxGfx.lineStyle(4, 0x6d9575, 0.9);
        this.statusFxGfx.beginPath();
        this.statusFxGfx.arc(
          pt.x,
          pt.groundY - 54,
          18,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * prog
        );
        this.statusFxGfx.strokePath();
      }
      // 4. Auto Cat Toy spinning feather motion arc
      if (f.catalogId === 'auto_cat_toy' && state.equipment.autoCatToy.enabled) {
        const ang = state.equipment.autoCatToy.armAngle;
        const fx = pt.x + Math.cos(ang) * 32 * pt.depthScale;
        const fy = pt.groundY - 52 + Math.sin(ang) * 14 * pt.depthScale;
        this.statusFxGfx.lineStyle(2, 0xd98c64, 0.85);
        this.statusFxGfx.lineBetween(pt.x, pt.groundY - 26, fx, fy);
        this.statusFxGfx.fillStyle(0xe57f5d, 0.95);
        this.statusFxGfx.fillCircle(fx, fy, 6.5);
      }
      // 5. Knocked coffee mug indicator on Oak Coffee Table
      if (f.catalogId === 'table_oak' && state.room.tableMugKnocked) {
        this.statusFxGfx.fillStyle(0xd96b52, 0.85);
        this.statusFxGfx.fillCircle(pt.x + 36, pt.groundY - 4, 8);
      }
      // 6. Dirty litter box scent puff cue
      if (f.catalogId === 'litter_box_cozy' && state.room.litterCleanliness < 40) {
        const rise = (this.elapsedSec * 18) % 24;
        this.statusFxGfx.fillStyle(0xa89b84, 0.42 * (1 - rise / 24));
        this.statusFxGfx.fillCircle(pt.x - 10, pt.groundY - 38 - rise, 5);
        this.statusFxGfx.fillCircle(pt.x + 12, pt.groundY - 32 - ((rise + 10) % 24), 4.5);
      }
    }
  }

  private updateToys(
    dt: number,
    activeToy: ToyType | null,
    catPos: Vec3,
    humanScreenPos: { x: number; y: number; facingRight: boolean }
  ): { type: string; x: number; y: number; z: number } | null {
    if (this.lastToyState !== activeToy) {
      this.lastToyState = activeToy;
      this.toyFeatherSprite.setVisible(activeToy === 'feather_wand');
      this.toyBallSprite.setVisible(activeToy === 'ball');
      this.toyMouseSprite.setVisible(activeToy === 'toy_mouse');
      if (activeToy === 'feather_wand') {
        this.wandTarget = { x: catPos.x + 0.35, y: 0.36, z: catPos.z + 0.35 };
        this.featherPos = { x: this.wandTarget.x, y: 0.24, z: this.wandTarget.z };
      } else if (activeToy === 'ball') {
        this.ballPos = {
          x: clamp(catPos.x + 0.55, -2.0, 2.0),
          y: 0.06,
          z: clamp(catPos.z + 0.45, -1.8, 1.8)
        };
        this.ballVel = { x: -1.1, z: 0.5 };
      } else if (activeToy === 'toy_mouse') {
        this.mousePos = {
          x: clamp(catPos.x - 0.65, -2.0, 2.0),
          y: 0.04,
          z: clamp(catPos.z + 0.5, -1.8, 1.8)
        };
      }
    }

    this.toyWandGfx.clear();
    this.playRewardCooldown = Math.max(0, this.playRewardCooldown - dt);

    if (activeToy === 'feather_wand') {
      const targetTipY = 0.22 + Math.sin(this.elapsedSec * 4.5) * 0.08;
      this.featherVel.x += (this.wandTarget.x - this.featherPos.x) * 14 * dt;
      this.featherVel.y += (targetTipY - this.featherPos.y) * 14 * dt;
      this.featherVel.z += (this.wandTarget.z - this.featherPos.z) * 14 * dt;
      const damp = Math.exp(-5.5 * dt);
      this.featherVel.x *= damp;
      this.featherVel.y *= damp;
      this.featherVel.z *= damp;
      this.featherPos.x += this.featherVel.x * dt;
      this.featherPos.y = Math.max(0.08, this.featherPos.y + this.featherVel.y * dt);
      this.featherPos.z += this.featherVel.z * dt;

      const tipPt = worldToScreen(this.featherPos.x, this.featherPos.z, this.featherPos.y);
      const handX = humanScreenPos.x + (humanScreenPos.facingRight ? 26 : -26);
      const handY = humanScreenPos.y - 76;
      const rodTipX = Phaser.Math.Linear(handX, tipPt.x, 0.62);
      const rodTipY = Math.min(handY - 46, tipPt.y - 52);

      // Draw physical wand rod from Chibi human's hand + curved string to feather!
      this.toyWandGfx.lineStyle(4, 0x9b724a, 1);
      this.toyWandGfx.lineBetween(handX, handY, rodTipX, rodTipY);
      this.toyWandGfx.lineStyle(1.8, 0xe8dfd0, 0.92);
      this.toyWandGfx.lineBetween(rodTipX, rodTipY, tipPt.x, tipPt.y);

      this.toyFeatherSprite.setPosition(tipPt.x, tipPt.y);
      this.toyFeatherSprite.setScale(0.28 * tipPt.depthScale);
      this.toyFeatherSprite.setRotation(Math.sin(this.elapsedSec * 7) * 0.28);
      this.toyFeatherSprite.setDepth(computeDepth(tipPt.groundY, 35));

      const d = Math.hypot(catPos.x - this.featherPos.x, catPos.z - this.featherPos.z);
      if (d < 0.42 && this.playRewardCooldown <= 0) {
        this.playRewardCooldown = 2.4;
        useGameStore.getState().recordToyPlayReward();
      }
      return { type: 'feather_wand', ...this.featherPos };
    }

    if (activeToy === 'ball') {
      this.ballPos.x += this.ballVel.x * dt;
      this.ballPos.z += this.ballVel.z * dt;
      const drag = Math.exp(-1.55 * dt);
      this.ballVel.x *= drag;
      this.ballVel.z *= drag;
      const maxX = ROOM_HALF_WIDTH - 0.25;
      const maxZ = ROOM_HALF_DEPTH - 0.25;
      if (this.ballPos.x < -maxX || this.ballPos.x > maxX) {
        this.ballPos.x = clamp(this.ballPos.x, -maxX, maxX);
        this.ballVel.x *= -0.75;
      }
      if (this.ballPos.z < -maxZ || this.ballPos.z > maxZ) {
        this.ballPos.z = clamp(this.ballPos.z, -maxZ, maxZ);
        this.ballVel.z *= -0.75;
      }
      const d = Math.hypot(catPos.x - this.ballPos.x, catPos.z - this.ballPos.z);
      if (d < 0.34) {
        const bx = this.ballPos.x - catPos.x;
        const bz = this.ballPos.z - catPos.z;
        const l = Math.max(0.05, Math.hypot(bx, bz));
        this.ballVel.x = (bx / l) * 2.1 + (Math.random() - 0.5) * 0.6;
        this.ballVel.z = (bz / l) * 2.1 + (Math.random() - 0.5) * 0.6;
        if (this.playRewardCooldown <= 0) {
          this.playRewardCooldown = 2.5;
          useGameStore.getState().recordToyPlayReward();
        }
      }
      const pt = worldToScreen(this.ballPos.x, this.ballPos.z, this.ballPos.y);
      this.toyBallSprite.setPosition(pt.x, pt.y);
      this.toyBallSprite.setScale(0.22 * pt.depthScale);
      this.toyBallSprite.rotation += Math.hypot(this.ballVel.x, this.ballVel.z) * dt * 4;
      this.toyBallSprite.setDepth(computeDepth(pt.groundY, 8));
      return { type: 'ball', ...this.ballPos };
    }

    if (activeToy === 'toy_mouse') {
      if (Math.random() < dt * 1.4) {
        const ang = Math.atan2(this.mouseVel.z, this.mouseVel.x) + (Math.random() - 0.5) * 1.4;
        const spd = 0.85 + Math.random() * 0.6;
        this.mouseVel = { x: Math.cos(ang) * spd, z: Math.sin(ang) * spd };
      }
      this.mousePos.x += this.mouseVel.x * dt;
      this.mousePos.z += this.mouseVel.z * dt;
      const maxX = ROOM_HALF_WIDTH - 0.35;
      const maxZ = ROOM_HALF_DEPTH - 0.35;
      if (this.mousePos.x < -maxX || this.mousePos.x > maxX) {
        this.mousePos.x = clamp(this.mousePos.x, -maxX, maxX);
        this.mouseVel.x *= -1;
      }
      if (this.mousePos.z < -maxZ || this.mousePos.z > maxZ) {
        this.mousePos.z = clamp(this.mousePos.z, -maxZ, maxZ);
        this.mouseVel.z *= -1;
      }
      const d = Math.hypot(catPos.x - this.mousePos.x, catPos.z - this.mousePos.z);
      if (d < 0.36 && this.playRewardCooldown <= 0) {
        this.playRewardCooldown = 2.6;
        useGameStore.getState().recordToyPlayReward();
        this.mouseVel.x *= -1.1;
        this.mouseVel.z *= -1.1;
      }
      const pt = worldToScreen(this.mousePos.x, this.mousePos.z, this.mousePos.y);
      this.toyMouseSprite.setPosition(pt.x, pt.y);
      this.toyMouseSprite.setScale(0.22 * pt.depthScale);
      this.toyMouseSprite.setFlipX(this.mouseVel.x < 0);
      this.toyMouseSprite.setDepth(computeDepth(pt.groundY, 6));
      return { type: 'toy_mouse', ...this.mousePos };
    }

    return null;
  }

  private spawnParticles(type: string, x: number, y: number): void {
    const symbols: Record<string, { char: string; color: string }> = {
      hearts: { char: '♥', color: '#df6b77' },
      sparkles: { char: '✦', color: '#e5b34c' },
      sleep: { char: 'Z', color: '#7898b8' },
      water: { char: '💧', color: '#6cb2d8' },
      warning: { char: '!', color: '#d9534f' }
    };
    const cfg = symbols[type] ?? symbols.sparkles;
    const count = type === 'sleep' ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const txt = this.add
        .text(x + (Math.random() - 0.5) * 44, y - 34 + (Math.random() - 0.5) * 16, cfg.char, {
          fontSize: `${18 + Math.round(Math.random() * 10)}px`,
          color: cfg.color,
          fontStyle: 'bold',
          stroke: '#ffffff',
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(980);
      this.particles.push({
        node: txt,
        vx: (Math.random() - 0.5) * 34,
        vy: -(36 + Math.random() * 32),
        life: 0,
        maxLife: 1.0 + Math.random() * 0.45
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.node.x += p.vx * dt;
      p.node.y += p.vy * dt;
      const ratio = p.life / p.maxLife;
      p.node.setAlpha(Math.max(0, 1 - ratio * ratio));
      p.node.setScale(0.85 + Math.sin(Math.min(1, ratio) * Math.PI) * 0.3);
      if (p.life >= p.maxLife) {
        p.node.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  private drawCatAccessory(x: number, y: number, scale: number, facingRight: boolean): void {
    this.catAccessoryGfx.clear();
    const acc = useGameStore.getState().cat.identity.equippedAccessory;
    if (acc === 'none' || !this.catSprite.visible) return;
    const dir = facingRight ? 1 : -1;
    const neckX = x + dir * 24 * scale;
    const neckY = y - 58 * scale;

    if (acc === 'ribbon_coral') {
      this.catAccessoryGfx.fillStyle(0xd4745e, 0.96);
      this.catAccessoryGfx.fillRoundedRect(neckX - 11 * scale, neckY - 3 * scale, 22 * scale, 6 * scale, 3);
      this.catAccessoryGfx.fillCircle(neckX + dir * 4 * scale, neckY + 3 * scale, 4.5 * scale);
    } else if (acc === 'bell_collar_gold') {
      this.catAccessoryGfx.fillStyle(0xb38152, 0.96);
      this.catAccessoryGfx.fillRoundedRect(neckX - 11 * scale, neckY - 3 * scale, 22 * scale, 5.5 * scale, 3);
      this.catAccessoryGfx.fillStyle(0xf1c24b, 1);
      this.catAccessoryGfx.fillCircle(neckX + dir * 5 * scale, neckY + 4.5 * scale, 4.5 * scale);
    } else if (acc === 'linen_bandana') {
      this.catAccessoryGfx.fillStyle(0xe6d8c3, 0.96);
      this.catAccessoryGfx.fillTriangle(
        neckX - 12 * scale,
        neckY - 2 * scale,
        neckX + 12 * scale,
        neckY - 2 * scale,
        neckX + dir * 4 * scale,
        neckY + 14 * scale
      );
    } else if (acc === 'sage_bow') {
      this.catAccessoryGfx.fillStyle(0x6c9175, 0.96);
      this.catAccessoryGfx.fillEllipse(neckX - 5 * scale, neckY, 9 * scale, 6 * scale);
      this.catAccessoryGfx.fillEllipse(neckX + 5 * scale, neckY, 9 * scale, 6 * scale);
      this.catAccessoryGfx.fillCircle(neckX, neckY, 3 * scale);
    }
    this.catAccessoryGfx.setDepth(this.catSprite.depth + 2);
  }

  public focusOnCat(): void {
    const st = useGameStore.getState();
    const pt = worldToScreen(st.cat.position.x, st.cat.position.z, st.cat.position.y);
    this.cameraTargetZoom = 1.16;
    this.cameraTargetScrollX = (pt.x - STAGE_WIDTH * 0.5) * 0.35;
    this.cameraTargetScrollY = (pt.y - STAGE_HEIGHT * 0.55) * 0.25;
    this.time.delayedCall(1800, () => {
      this.cameraTargetZoom = 1.0;
      this.cameraTargetScrollX = 0;
      this.cameraTargetScrollY = 0;
    });
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, Math.max(0.001, deltaMs / 1000));
    this.elapsedSec += dt;

    const state = useGameStore.getState();

    // Step 2D interactive toys & get target for cat AI
    const humanProjPre = worldToScreen(state.human.position.x, state.human.position.z, 0);
    const humanFacingRightPre = Math.sin(state.human.rotationY) >= -0.05;
    const toyTarget = this.updateToys(dt, state.activeToy, state.cat.position, {
      x: humanProjPre.x,
      y: humanProjPre.groundY,
      facingRight: humanFacingRightPre
    });

    // Step headless simulation (cat AI, human nav, care sync, needs, growth, survival, equipment)
    const soundCue = this.pendingSoundPos;
    this.pendingSoundPos = null;
    state.stepSimulation(
      dt,
      { x: state.human.position.x, z: state.human.position.z },
      toyTarget,
      soundCue
    );

    const latest = useGameStore.getState();

    // Sync 2D furniture & live equipment indicators
    this.syncFurniture(latest.placedFurniture);
    this.drawLiveEquipmentFx();
    if (!latest.decorateMode && this.previewSprite) {
      this.updatePlacementPreview(null, 0, 0, true);
    }

    // Update Chibi Human Sprite
    const showHuman = latest.hasCreatedHuman || latest.hasAdoptedInitialCat;
    this.humanSprite.setVisible(showHuman);
    this.humanShadow.setVisible(showHuman);

    const hProj = worldToScreen(latest.human.position.x, latest.human.position.z, latest.human.position.y);
    const hScale = 0.88 * hProj.depthScale;
    const hFacingRight = Math.sin(latest.human.rotationY) >= -0.05;

    this.humanSprite.setPosition(hProj.x, hProj.y);
    this.humanSprite.setScale(hScale);
    this.humanSprite.setFlipX(!hFacingRight);
    this.humanSprite.setDepth(computeDepth(hProj.groundY, 12));
    this.humanShadow.setPosition(hProj.x, hProj.groundY - 4);
    this.humanShadow.setSize(96 * hProj.depthScale, 28 * hProj.depthScale);
    this.humanShadow.setDepth(computeDepth(hProj.groundY, 8));

    const humanAction = resolveHumanSpriteAction(latest.human, latest.activeCareAction);
    const appSig = getHumanAppearanceSignature(latest.humanAppearance);
    if (appSig !== this.lastHumanAppSig) {
      this.lastHumanAppSig = appSig;
      this.activeHumanAnimKey = '';
    }
    this.playHumanAction(humanAction, latest.humanAppearance);

    // Update Semi-Realistic Fluffy Cat Sprite (supports cradling in human arms during pickup!)
    this.catSprite.setVisible(latest.survival.isAlive);
    this.catShadow.setVisible(latest.survival.isAlive && !latest.human.carryingCat);

    const growth = computeGrowthMetrics(latest.cat.identity.breed, latest.cat.ageDays);
    const breedMorph = getBreedDefinition(latest.cat.identity.breed).morphology;
    const weightWidthFactor = 1 + clamp(latest.cat.weight.bodyFatIndex * 0.14, -0.1, 0.16);
    const baseCatScale = clamp(growth.bodyScale * breedMorph.adultScale, 0.54, 1.18) * 0.82;

    let catScreenX = 0;
    let catScreenY = 0;
    let catDepth = 200;
    let catFacingRight = Math.sin(latest.cat.rotationY) >= -0.05;

    if (latest.human.carryingCat) {
      // Physically cradled right in front of the Chibi human's chest!
      catScreenX = hProj.x + (hFacingRight ? 18 : -18) * hProj.depthScale;
      catScreenY = hProj.y - 54 * hProj.depthScale;
      catDepth = this.humanSprite.depth + 4;
      catFacingRight = hFacingRight;
    } else {
      const cProj = worldToScreen(latest.cat.position.x, latest.cat.position.z, latest.cat.position.y);
      catScreenX = cProj.x;
      catScreenY = cProj.y;
      catDepth = computeDepth(cProj.groundY, 14);
      const scaleWithDepth = baseCatScale * cProj.depthScale;

      this.catShadow.setPosition(cProj.x, cProj.groundY - 4);
      this.catShadow.setSize(
        118 * scaleWithDepth * weightWidthFactor,
        32 * scaleWithDepth
      );
      this.catShadow.setAlpha(clamp(0.24 - latest.cat.position.y * 0.18, 0.08, 0.24));
      this.catShadow.setDepth(computeDepth(cProj.groundY, 10));
    }

    const finalDepthScale = latest.human.carryingCat
      ? hProj.depthScale
      : worldToScreen(latest.cat.position.x, latest.cat.position.z, 0).depthScale;
    const finalScaleX = baseCatScale * finalDepthScale * weightWidthFactor * (breedMorph.torsoLength > 1.05 ? 1.04 : 1.0);
    const finalScaleY = baseCatScale * finalDepthScale * (breedMorph.legLength < 0.72 ? 0.88 : 1.0);

    this.catSprite.setPosition(catScreenX, catScreenY);
    this.catSprite.setScale(finalScaleX, finalScaleY);
    this.catSprite.setFlipX(!catFacingRight);
    this.catSprite.setDepth(catDepth);

    const catAction = resolveCatSpriteAction(latest.cat, latest.human, latest.activeCareAction);
    const coatSig = getCatCoatSignature(latest.cat.identity, latest.cat.lifeStage);
    if (coatSig !== this.lastCatCoatSig) {
      this.lastCatCoatSig = coatSig;
      this.activeCatAnimKey = '';
    }
    this.playCatAction(catAction, latest.cat.identity, latest.cat.lifeStage);
    this.drawCatAccessory(catScreenX, catScreenY, finalScaleX, catFacingRight);

    // Particle burst triggers
    if (latest.particleCue.seq !== this.lastParticleSeq) {
      this.lastParticleSeq = latest.particleCue.seq;
      this.spawnParticles(latest.particleCue.type, catScreenX, catScreenY - 30);
    }
    this.updateParticles(dt);

    // Gentle sunlit window dust motes
    this.dustGfx.clear();
    for (const m of this.dustMotes) {
      const mx = m.x + Math.sin(this.elapsedSec * m.speed + m.phase) * 14;
      const my = m.y + Math.cos(this.elapsedSec * m.speed * 0.7 + m.phase) * 10;
      const alpha = 0.14 + 0.14 * Math.sin(this.elapsedSec * 1.4 + m.phase);
      this.dustGfx.fillStyle(0xfff6dc, alpha);
      this.dustGfx.fillCircle(mx, my, m.r);
    }

    // Smooth subtle camera framing during synchronized human-cat care actions!
    const cam = this.cameras.main;
    if (latest.activeCareAction && !latest.decorateMode) {
      const midX = (hProj.x + catScreenX) * 0.5;
      const midY = (hProj.y + catScreenY) * 0.5 - 40;
      this.cameraTargetZoom = 1.12;
      this.cameraTargetScrollX = clamp((midX - STAGE_WIDTH * 0.5) * 0.36, -65, 65);
      this.cameraTargetScrollY = clamp((midY - STAGE_HEIGHT * 0.54) * 0.28, -60, 60);
    } else if (this.cameraTargetZoom === 1.12) {
      this.cameraTargetZoom = 1.0;
      this.cameraTargetScrollX = 0;
      this.cameraTargetScrollY = 0;
    }

    cam.setZoom(Phaser.Math.Linear(cam.zoom, this.cameraTargetZoom, clamp(dt * 4.5, 0, 1)));
    cam.scrollX = Phaser.Math.Linear(cam.scrollX, this.cameraTargetScrollX, clamp(dt * 4.5, 0, 1));
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, this.cameraTargetScrollY, clamp(dt * 4.5, 0, 1));
  }
}
