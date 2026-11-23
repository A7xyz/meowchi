import { create } from 'zustand';
import { soundManager } from '../audio/SoundManager';
import {
  EYE_COLOR_PALETTE,
  getBreedDefinition,
  resolveCoatHexColors
} from '../config/breeds';
import {
  ACCESSORY_CATALOG,
  createDefaultDailyTasks,
  FOOD_CATALOG,
  FURNITURE_CATALOG,
  getCatalogItem,
  TOY_CATALOG
} from '../config/catalog';
import { ECONOMY_CONFIG, evaluateMinigameReward } from '../config/economy';
import {
  clearSavedGame,
  createInitialSaveData,
  loadGameData,
  saveGameData
} from '../persistence/saveManager';
import { addBondPoints } from '../simulation/bond';
import { stepCatAI } from '../simulation/catAI';
import {
  getInteractionPointForFurniture,
  validateFurniturePlacement
} from '../simulation/collision';
import {
  applyIdempotentCoinReward,
  applyIdempotentPurchase,
  buildAchievementClaimId,
  buildDailyTaskClaimId,
  buildMinigameClaimId,
  getUtcDayNumber,
  isActionOnCooldown,
  setActionCooldown
} from '../simulation/economy';
import { evaluateCatEmotion } from '../simulation/emotions';
import {
  consumePlayerEnergyForMinigame,
  formatCountdownMmSs,
  reconcilePlayerEnergy
} from '../simulation/energy';
import {
  applyOfflineEquipmentSimulation,
  dispenseFromAutoFeeder,
  hasPlacedEquipment,
  loadAutoFeederFromInventory,
  stepEquipmentSimulation
} from '../simulation/equipment';
import {
  advanceAgeFromUtc,
  clamp,
  computeGrowthMetrics,
  getLifeStageForAge
} from '../simulation/growth';
import {
  applyOfflineElapsed,
  performBrushAction,
  performCleanLitterAction,
  performCleanRoomAction,
  performFeedAction,
  performPetAction,
  performRespectSpaceAction,
  performSleepAction,
  performWaterAction,
  tickNeeds
} from '../simulation/needs';
import { evolvePersonality, generateRandomPersonality } from '../simulation/personality';
import { createInitialWeightState, stepWeightSimulation } from '../simulation/weight';
import {
  AccessoryId,
  ActiveCareAction,
  ActiveTab,
  CatBreed,
  CatIdentity,
  CatSex,
  EyeColorId,
  FoodItemId,
  FurColorId,
  FurPattern,
  GameSettings,
  MinigameId,
  MinigameResultEntry,
  MinigameSession,
  PhotoEntry,
  PlacedFurniture,
  SaveDataV3,
  ToyType,
  Vec2
} from '../types/game';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'warm' | 'info' | 'warn' | 'celebrate';
}

export interface GameStore extends SaveDataV3 {
  hydrated: boolean;
  activeTab: ActiveTab;
  drawerOpen: boolean;
  activeToy: ToyType | null;
  activeMinigameSession: MinigameSession | null;
  activeCareAction: ActiveCareAction | null;
  decorateMode: boolean;
  selectedFurnitureInstanceId: string | null;
  placingCatalogId: string | null;
  photoMode: boolean;
  showSettings: boolean;
  showProfileModal: boolean;
  showAdoptFlow: boolean;
  showAlbumModal: boolean;
  showTasksModal: boolean;
  showEquipmentModal: boolean;
  toast: ToastMessage | null;
  lastSavedAt: number;
  particleCue: { type: 'heart' | 'zzz' | 'sparkle' | 'music'; seq: number };
  biteFeedback: { seq: number; triggeredAtMs: number };

  // Lifecycle
  hydrateFromStorage: () => Promise<void>;
  persistNow: () => Promise<void>;
  resetGame: () => Promise<void>;
  syncRealTimeClocks: (nowUtc?: number) => void;

  // Simulation tick
  stepSimulation: (
    dtSeconds: number,
    playerFocusPoint: Vec2,
    activeToyTarget: { type: string; x: number; y: number; z: number } | null,
    soundEventPos: Vec2 | null
  ) => void;

  // UI Navigation
  setActiveTab: (tab: ActiveTab) => void;
  setDrawerOpen: (open: boolean) => void;
  setPhotoMode: (enabled: boolean) => void;
  setShowSettings: (open: boolean) => void;
  setShowProfileModal: (open: boolean) => void;
  setShowAdoptFlow: (open: boolean) => void;
  setShowAlbumModal: (open: boolean) => void;
  setShowTasksModal: (open: boolean) => void;
  setShowEquipmentModal: (open: boolean) => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;

  // Care Actions (synchronized with visible 3D human hand animation; ZERO Coins generated!)
  feedCat: (foodId: FoodItemId, immediate?: boolean) => boolean;
  giveWater: (immediate?: boolean) => boolean;
  petCat: (immediate?: boolean) => boolean;
  respectCatSpace: (immediate?: boolean) => boolean;
  brushCat: (immediate?: boolean) => boolean;
  tuckCatToSleep: (immediate?: boolean) => boolean;
  cleanLitterBox: (immediate?: boolean) => boolean;
  cleanLivingArea: (immediate?: boolean) => boolean;
  commitActiveCareAction: () => void;
  finishActiveCareAction: () => void;

  // Advanced Automatic Equipment Controls
  refillWaterFountain: (immediate?: boolean) => boolean;
  cleanWaterFountain: (immediate?: boolean) => boolean;
  loadAutoFeeder: (foodId: FoodItemId, servings?: number) => boolean;
  updateAutoFeederSettings: (patch: { scheduleHours?: 4 | 6 | 8; portionSize?: 1 | 2 }) => void;
  dispenseAutoFeederNow: () => boolean;
  emptyAutoLitterWaste: (immediate?: boolean) => boolean;
  setSmartBedWarmth: (warmthLevel: number) => void;
  toggleAutoCatToy: () => boolean;

  // Toys & 60s Energy-Gated Minigames
  activateToy: (toy: ToyType | null) => void;
  recordToyPlayReward: () => void;
  startMinigame: (id: MinigameId, nowUtc?: number) => { started: boolean; sessionId?: string };
  cancelMinigame: () => void;
  completeMinigame: (
    sessionId: string,
    score: number,
    nowUtc?: number
  ) => { claimed: boolean; coinsEarned: number; tier?: MinigameResultEntry['tier'] };

  // Shop, Inventory & Decoration
  buyFood: (foodId: FoodItemId) => boolean;
  buyAccessory: (accessoryId: Exclude<AccessoryId, 'none'>) => boolean;
  equipAccessory: (accessoryId: AccessoryId) => void;
  setDecorateMode: (enabled: boolean) => void;
  selectFurniture: (instanceId: string | null) => void;
  startPlacingFurniture: (catalogId: string | null) => void;
  moveFurniture: (instanceId: string, x: number, z: number) => boolean;
  rotateFurniture: (instanceId: string, deltaRad?: number) => boolean;
  placeNewFurniture: (catalogId: string, x: number, z: number) => boolean;
  removePlacedFurniture: (instanceId: string) => void;
  buyFurniture: (catalogId: string) => boolean;
  buyToy: (toyId: ToyType) => boolean;

  // Progression, Photos, Settings & Adoption (NO manual age/day skip!)
  claimDailyTask: (taskId: string, nowUtc?: number) => boolean;
  savePhoto: (dataUrl: string) => void;
  deletePhoto: (photoId: string) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  renameCat: (newName: string) => void;
  adoptCustomizedKitten: (params: {
    name: string;
    sex: CatSex;
    breed: CatBreed;
    furColorId: FurColorId;
    furPattern: FurPattern;
    eyeColorId: EyeColorId;
  }) => void;
}

let toastCounter = 1;
let actionCounter = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let careCommitTimer: ReturnType<typeof setTimeout> | null = null;
let careFinishTimer: ReturnType<typeof setTimeout> | null = null;
let lastToyRewardTime = 0;
let lastPurchaseMs = 0;
let lastMinigameStartMs = 0;

function extractSavePayload(state: GameStore): SaveDataV3 {
  return {
    version: 3,
    savedAt: Date.now(),
    lastGrowthSyncAtUtc: state.lastGrowthSyncAtUtc,
    hasAdoptedInitialCat: state.hasAdoptedInitialCat,
    cat: state.cat,
    room: state.room,
    equipment: state.equipment,
    coins: state.coins,
    gems: state.gems,
    playerEnergy: state.playerEnergy,
    claimedRewardIds: state.claimedRewardIds,
    actionCooldowns: state.actionCooldowns,
    minigameHistory: state.minigameHistory,
    foodInventory: state.foodInventory,
    ownedAccessories: state.ownedAccessories,
    ownedFurniture: state.ownedFurniture,
    ownedToys: state.ownedToys,
    placedFurniture: state.placedFurniture,
    dailyTasks: state.dailyTasks,
    lastDailyResetDay: state.lastDailyResetDay,
    achievements: state.achievements,
    photos: state.photos,
    settings: state.settings,
    stats: state.stats
  };
}

function scheduleAutoSave(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  immediate = false
): void {
  if (saveTimer) clearTimeout(saveTimer);
  const run = async () => {
    const ok = await saveGameData(extractSavePayload(get()));
    if (ok) {
      set({ lastSavedAt: Date.now() });
    }
  };
  if (immediate) {
    void run();
  } else {
    saveTimer = setTimeout(run, 800);
  }
}

function addXpAndCheckLevel(
  level: number,
  xp: number,
  gain: number
): { level: number; xp: number; leveledUp: boolean } {
  let lvl = level;
  let totalXp = xp + Math.max(0, gain);
  let leveledUp = false;
  while (totalXp >= lvl * 100) {
    totalXp -= lvl * 100;
    lvl += 1;
    leveledUp = true;
  }
  return { level: lvl, xp: totalXp, leveledUp };
}

function incrementDailyTask(
  tasks: SaveDataV3['dailyTasks'],
  type: SaveDataV3['dailyTasks'][number]['type']
): SaveDataV3['dailyTasks'] {
  return tasks.map((t) =>
    t.type === type && !t.claimed ? { ...t, progress: Math.min(t.target, t.progress + 1) } : t
  );
}

function evaluateAchievements(state: SaveDataV3): {
  achievements: SaveDataV3['achievements'];
  coins: number;
  claimedRewardIds: string[];
  newlyUnlockedTh: string[];
  newlyUnlockedEn: string[];
} {
  let coins = state.coins;
  let claimedRewardIds = state.claimedRewardIds;
  const newlyUnlockedTh: string[] = [];
  const newlyUnlockedEn: string[] = [];

  const achievements = state.achievements.map((a) => {
    if (a.unlocked) return a;
    let shouldUnlock = false;
    if (a.id === 'ach_first_feed' && state.stats.totalFeeds >= 1) shouldUnlock = true;
    if (a.id === 'ach_eyes_open' && state.cat.ageDays >= 15) shouldUnlock = true;
    if (a.id === 'ach_bond_25' && state.cat.bondLevel >= 25) shouldUnlock = true;
    if (a.id === 'ach_photographer' && state.stats.totalPhotos >= 1) shouldUnlock = true;
    if (a.id === 'ach_grown_up' && state.cat.ageDays >= 366) shouldUnlock = true;

    if (shouldUnlock) {
      const claimRes = applyIdempotentCoinReward(
        coins,
        claimedRewardIds,
        buildAchievementClaimId(a.id),
        a.rewardCoins
      );
      coins = claimRes.coins;
      claimedRewardIds = claimRes.claimedRewardIds;
      newlyUnlockedTh.push(a.titleTh);
      newlyUnlockedEn.push(a.titleEn);
      return { ...a, unlocked: true, unlockedAt: Date.now() };
    }
    return a;
  });

  return { achievements, coins, claimedRewardIds, newlyUnlockedTh, newlyUnlockedEn };
}

function canPurchaseNow(): boolean {
  const now = Date.now();
  if (now - lastPurchaseMs < ECONOMY_CONFIG.PURCHASE_DEBOUNCE_MS) return false;
  lastPurchaseMs = now;
  return true;
}

function clearCareTimers(): void {
  if (careCommitTimer) {
    clearTimeout(careCommitTimer);
    careCommitTimer = null;
  }
  if (careFinishTimer) {
    clearTimeout(careFinishTimer);
    careFinishTimer = null;
  }
}

const initial = createInitialSaveData('siamese', { hasAdoptedInitialCat: false });

export const useGameStore = create<GameStore>((set, get) => {
  const beginCareAction = (
    type: ActiveCareAction['type'],
    options: {
      durationMs?: number;
      contactAtMs?: number;
      foodId?: FoodItemId;
      targetInstanceId?: string;
      immediate?: boolean;
      cooldownKey?: string;
    } = {}
  ): boolean => {
    const state = get();
    const nowUtc = Date.now();

    // Never allow overlapping care actions while an animation is in flight
    if (state.activeCareAction !== null) {
      return false;
    }

    // Cooldown protection (cannot be bypassed by rapid clicking)
    const cooldownKey = options.cooldownKey ?? type;
    const cd = isActionOnCooldown(state.actionCooldowns, cooldownKey, nowUtc);
    if (cd.onCooldown && !options.immediate) {
      return false;
    }

    const durationMs = options.durationMs ?? 1550;
    const contactAtMs = options.contactAtMs ?? Math.round(durationMs * 0.48);

    const action: ActiveCareAction = {
      id: `care_${nowUtc}_${actionCounter++}`,
      type,
      startedAtMs: nowUtc,
      durationMs,
      contactAtMs,
      committed: false,
      foodId: options.foodId,
      targetInstanceId: options.targetInstanceId
    };

    const nextCooldowns = setActionCooldown(state.actionCooldowns, cooldownKey, nowUtc);
    set({ activeCareAction: action, actionCooldowns: nextCooldowns });

    if (options.immediate) {
      get().commitActiveCareAction();
      get().finishActiveCareAction();
      return true;
    }

    // Safe fallback timers guarantee completion even if 3D engine is hidden/tabbed
    clearCareTimers();
    careCommitTimer = setTimeout(() => {
      if (get().activeCareAction?.id === action.id) {
        get().commitActiveCareAction();
      }
    }, contactAtMs);
    careFinishTimer = setTimeout(() => {
      if (get().activeCareAction?.id === action.id) {
        get().finishActiveCareAction();
      }
    }, durationMs);

    return true;
  };

  return {
    ...initial,
    hydrated: false,
    activeTab: 'care',
    drawerOpen: false,
    activeToy: null,
    activeMinigameSession: null,
    activeCareAction: null,
    decorateMode: false,
    selectedFurnitureInstanceId: null,
    placingCatalogId: null,
    photoMode: false,
    showSettings: false,
    showProfileModal: false,
    showAdoptFlow: false,
    showAlbumModal: false,
    showTasksModal: false,
    showEquipmentModal: false,
    toast: null,
    lastSavedAt: Date.now(),
    particleCue: { type: 'heart', seq: 0 },
    biteFeedback: { seq: 0, triggeredAtMs: 0 },

    showToast: (text, tone = 'warm') => {
      const id = ++toastCounter;
      set({ toast: { id, text, tone } });
      setTimeout(() => {
        if (get().toast?.id === id) {
          set({ toast: null });
        }
      }, 3800);
    },

    syncRealTimeClocks: (nowUtc = Date.now()) => {
      const state = get();
      const energySync = reconcilePlayerEnergy(state.playerEnergy, nowUtc);
      const ageSync = advanceAgeFromUtc(
        state.cat.ageDays,
        state.lastGrowthSyncAtUtc,
        nowUtc,
        ECONOMY_CONFIG.GAME_TIME_SCALE
      );
      const nextStage = getLifeStageForAge(ageSync.ageDays);
      const today = getUtcDayNumber(nowUtc);
      const needsDailyReset = state.lastDailyResetDay < today;

      if (
        energySync.gained > 0 ||
        ageSync.deltaDays > 0 ||
        needsDailyReset ||
        energySync.energy.lastSeenUtc !== state.playerEnergy.lastSeenUtc
      ) {
        set({
          playerEnergy: energySync.energy,
          lastGrowthSyncAtUtc: ageSync.lastGrowthSyncAtUtc,
          cat: {
            ...state.cat,
            ageDays: ageSync.ageDays,
            lifeStage: nextStage
          },
          dailyTasks: needsDailyReset ? createDefaultDailyTasks() : state.dailyTasks,
          lastDailyResetDay: needsDailyReset ? today : state.lastDailyResetDay
        });
      }
    },

    hydrateFromStorage: async () => {
      const nowUtc = Date.now();
      const loaded = await loadGameData(nowUtc);
      if (!loaded) {
        set({ hydrated: true, showAdoptFlow: true, hasAdoptedInitialCat: false });
        soundManager.setEnabled(get().settings.soundEnabled);
        return;
      }

      // Compute exact non-duplicable real elapsed time since last save
      const elapsedSeconds = Math.max(0, (nowUtc - loaded.savedAt) / 1000);
      const ageSync = advanceAgeFromUtc(
        loaded.cat.ageDays,
        loaded.lastGrowthSyncAtUtc,
        nowUtc,
        ECONOMY_CONFIG.GAME_TIME_SCALE
      );

      let cat = {
        ...loaded.cat,
        ageDays: ageSync.ageDays,
        lifeStage: getLifeStageForAge(ageSync.ageDays)
      };
      let room = loaded.room;
      let equipment = loaded.equipment;

      const offlineNeeds = applyOfflineElapsed(cat, room, elapsedSeconds);
      cat = offlineNeeds.cat;
      room = offlineNeeds.room;

      const offlineEquip = applyOfflineEquipmentSimulation(
        equipment,
        cat,
        room,
        loaded.placedFurniture,
        elapsedSeconds,
        nowUtc
      );
      equipment = offlineEquip.equipment;
      cat = offlineEquip.cat;
      room = offlineEquip.room;
      cat.lifeStage = getLifeStageForAge(cat.ageDays);
      cat.emotion = evaluateCatEmotion(cat);

      const energySync = reconcilePlayerEnergy(loaded.playerEnergy, nowUtc);
      const today = getUtcDayNumber(nowUtc);
      const dailyTasks =
        loaded.lastDailyResetDay < today ? createDefaultDailyTasks() : loaded.dailyTasks;

      soundManager.setEnabled(loaded.settings.soundEnabled);

      set({
        ...loaded,
        cat,
        room,
        equipment,
        playerEnergy: energySync.energy,
        lastGrowthSyncAtUtc: ageSync.lastGrowthSyncAtUtc,
        dailyTasks,
        lastDailyResetDay: today,
        hydrated: true,
        showAdoptFlow: !loaded.hasAdoptedInitialCat,
        lastSavedAt: nowUtc
      });

      // Immediately persist updated UTC sync timestamps so refreshing never duplicates growth or energy!
      scheduleAutoSave(get, set, true);

      if (elapsedSeconds > 180 && loaded.hasAdoptedInitialCat) {
        const lang = loaded.settings.language;
        get().showToast(
          lang === 'th'
            ? `ยินดีต้อนรับกลับบ้าน! ${cat.identity.name} รอคุณอยู่`
            : `Welcome back! ${cat.identity.name} missed you.`,
          'warm'
        );
      }
    },

    persistNow: async () => {
      const ok = await saveGameData(extractSavePayload(get()));
      if (ok) {
        set({ lastSavedAt: Date.now() });
        const lang = get().settings.language;
        get().showToast(
          lang === 'th' ? 'บันทึกข้อมูลเกมเรียบร้อยแล้ว' : 'Game saved safely!',
          'info'
        );
      }
    },

    resetGame: async () => {
      clearCareTimers();
      await clearSavedGame();
      const fresh = createInitialSaveData('siamese', { hasAdoptedInitialCat: false });
      set({
        ...fresh,
        activeTab: 'care',
        drawerOpen: false,
        activeToy: null,
        activeMinigameSession: null,
        activeCareAction: null,
        decorateMode: false,
        selectedFurnitureInstanceId: null,
        placingCatalogId: null,
        showSettings: false,
        showProfileModal: false,
        showEquipmentModal: false,
        showAdoptFlow: true
      });
      soundManager.setEnabled(fresh.settings.soundEnabled);
    },

    stepSimulation: (dtSeconds, playerFocusPoint, activeToyTarget, soundEventPos) => {
      const state = get();
      if (!state.hydrated || !state.hasAdoptedInitialCat || state.activeMinigameSession) return;

      const nowUtc = Date.now();
      const prevStage = state.cat.lifeStage;

      // Frame-rate independent real-time growth & UTC player energy reconciliation
      const ageSync = advanceAgeFromUtc(
        state.cat.ageDays,
        state.lastGrowthSyncAtUtc,
        nowUtc,
        ECONOMY_CONFIG.GAME_TIME_SCALE
      );
      const nextStage = getLifeStageForAge(ageSync.ageDays);
      const energySync = reconcilePlayerEnergy(state.playerEnergy, nowUtc);

      const onSmartBed = state.equipment.smartCatBed.occupied;
      const { needs, room } = tickNeeds(
        state.cat,
        state.room,
        dtSeconds,
        ECONOMY_CONFIG.GAME_TIME_SCALE,
        onSmartBed
      );
      const nextWeight = stepWeightSimulation(
        state.cat,
        dtSeconds,
        ECONOMY_CONFIG.GAME_TIME_SCALE
      );

      const catWithUpdates = {
        ...state.cat,
        ageDays: ageSync.ageDays,
        lifeStage: nextStage,
        needs,
        weight: nextWeight
      };

      const aiRes = stepCatAI(
        catWithUpdates,
        {
          furniture: state.placedFurniture,
          room,
          equipment: state.equipment,
          playerFocusPoint,
          activeToyTarget,
          soundEventPos
        },
        dtSeconds
      );

      const panX = clamp(aiRes.cat.position.x / 2.8, -0.85, 0.85);
      if (aiRes.vocalCue) {
        soundManager.playVocalCue(aiRes.vocalCue, aiRes.cat.ageDays, false, panX);
      }

      let nextRoom = room;
      let nextEquip = state.equipment;
      let nextStats = state.stats;

      if (aiRes.roomEvent === 'consumed_food') {
        nextRoom = {
          ...nextRoom,
          foodBowlLevel: clamp(nextRoom.foodBowlLevel - dtSeconds * 6, 0, 100)
        };
        aiRes.cat.needs.hunger = clamp(aiRes.cat.needs.hunger + dtSeconds * 7, 0, 100);
      } else if (aiRes.roomEvent === 'consumed_feeder_food') {
        nextEquip = {
          ...nextEquip,
          autoFeeder: {
            ...nextEquip.autoFeeder,
            bowlServingsLevel: clamp(
              nextEquip.autoFeeder.bowlServingsLevel - dtSeconds * 6.5,
              0,
              100
            )
          }
        };
        aiRes.cat.needs.hunger = clamp(aiRes.cat.needs.hunger + dtSeconds * 7.5, 0, 100);
      } else if (aiRes.roomEvent === 'consumed_water') {
        nextRoom = {
          ...nextRoom,
          waterBowlLevel: clamp(nextRoom.waterBowlLevel - dtSeconds * 7, 0, 100)
        };
        aiRes.cat.needs.thirst = clamp(aiRes.cat.needs.thirst + dtSeconds * 8, 0, 100);
      } else if (aiRes.roomEvent === 'consumed_fountain_water') {
        nextEquip = {
          ...nextEquip,
          waterFountain: {
            ...nextEquip.waterFountain,
            waterLevel: clamp(nextEquip.waterFountain.waterLevel - dtSeconds * 4.5, 0, 100)
          }
        };
        aiRes.cat.needs.thirst = clamp(aiRes.cat.needs.thirst + dtSeconds * 10, 0, 100);
      } else if (aiRes.roomEvent === 'used_auto_litter') {
        nextEquip = {
          ...nextEquip,
          autoLitterBox: {
            ...nextEquip.autoLitterBox,
            needsCleaning: true,
            litterCleanliness: clamp(nextEquip.autoLitterBox.litterCleanliness - 22, 10, 100),
            pendingCleanDelaySec: ECONOMY_CONFIG.EQUIPMENT.AUTO_LITTER_CLEAN_DELAY_SEC
          }
        };
      } else if (aiRes.roomEvent === 'used_manual_litter') {
        nextRoom = {
          ...nextRoom,
          litterCleanliness: clamp(nextRoom.litterCleanliness - 22, 0, 100)
        };
      } else if (aiRes.roomEvent === 'knocked_mug' && !nextRoom.tableMugKnocked) {
        nextRoom = {
          ...nextRoom,
          tableMugKnocked: true,
          roomCleanliness: clamp(nextRoom.roomCleanliness - 18, 20, 100)
        };
        nextStats = { ...nextStats, knocksCaused: nextStats.knocksCaused + 1 };
        soundManager.playKnock();
        const lang = state.settings.language;
        state.showToast(
          lang === 'th'
            ? `อุ๊ย! ${aiRes.cat.identity.name} แอบปัดแก้วบนโต๊ะตกลงพื้น!`
            : `Oops! Curious ${aiRes.cat.identity.name} nudged the mug off the table!`,
          'warn'
        );
      }

      // Step independent automatic equipment simulation
      const equipStep = stepEquipmentSimulation(
        nextEquip,
        aiRes.cat,
        nextRoom,
        state.placedFurniture,
        dtSeconds,
        nowUtc
      );
      nextEquip = equipStep.equipment;
      nextRoom = equipStep.room;

      for (const ev of equipStep.events) {
        if (ev === 'feeder_dispensed') {
          soundManager.playVocalCue('feeder_dispense', aiRes.cat.ageDays, true, 0);
        } else if (ev === 'litter_clean_started') {
          soundManager.playVocalCue('litter_motor', aiRes.cat.ageDays, true, 0);
        }
      }

      const updatedPayload: SaveDataV3 = {
        ...extractSavePayload(state),
        cat: aiRes.cat,
        room: nextRoom,
        equipment: nextEquip,
        stats: nextStats,
        playerEnergy: energySync.energy,
        lastGrowthSyncAtUtc: ageSync.lastGrowthSyncAtUtc
      };
      const ach = evaluateAchievements(updatedPayload);

      const today = getUtcDayNumber(nowUtc);
      const resetDaily = state.lastDailyResetDay < today;

      set({
        cat: aiRes.cat,
        room: nextRoom,
        equipment: nextEquip,
        stats: nextStats,
        playerEnergy: energySync.energy,
        lastGrowthSyncAtUtc: ageSync.lastGrowthSyncAtUtc,
        achievements: ach.achievements,
        coins: ach.coins,
        claimedRewardIds: ach.claimedRewardIds,
        dailyTasks: resetDaily ? createDefaultDailyTasks() : state.dailyTasks,
        lastDailyResetDay: resetDaily ? today : state.lastDailyResetDay
      });

      if (prevStage !== nextStage) {
        soundManager.playSoftChime(780);
        const lang = state.settings.language;
        state.showToast(
          lang === 'th'
            ? `🎉 ${aiRes.cat.identity.name} เติบโตเข้าสู่ช่วงวัยใหม่แล้ว!`
            : `🎉 ${aiRes.cat.identity.name} grew into a new life stage!`,
          'celebrate'
        );
        scheduleAutoSave(get, set, true);
      }

      if (ach.newlyUnlockedTh.length > 0) {
        const lang = state.settings.language;
        state.showToast(
          lang === 'th'
            ? `🏆 ปลดล็อกความสำเร็จ: ${ach.newlyUnlockedTh[0]}`
            : `🏆 Achievement unlocked: ${ach.newlyUnlockedEn[0]}`,
          'celebrate'
        );
        scheduleAutoSave(get, set, true);
      }
    },

    setActiveTab: (tab) => {
      const prev = get().activeTab;
      const wasOpen = get().drawerOpen;
      if (prev === tab && wasOpen) {
        set({ drawerOpen: false });
      } else {
        set({ activeTab: tab, drawerOpen: true });
      }
    },
    setDrawerOpen: (open) => set({ drawerOpen: open }),
    setPhotoMode: (enabled) =>
      set({
        photoMode: enabled,
        drawerOpen: false,
        decorateMode: false,
        activeToy: enabled ? null : get().activeToy
      }),
    setShowSettings: (open) => set({ showSettings: open }),
    setShowProfileModal: (open) => set({ showProfileModal: open }),
    setShowAdoptFlow: (open) => set({ showAdoptFlow: open }),
    setShowAlbumModal: (open) => set({ showAlbumModal: open }),
    setShowTasksModal: (open) => set({ showTasksModal: open }),
    setShowEquipmentModal: (open) => set({ showEquipmentModal: open }),

    // --- SYNCHRONIZED VISIBLE-HAND CARE ACTIONS (ZERO COINS AWARDED!) ---

    feedCat: (foodId, immediate = false) => {
      const state = get();
      const lang = state.settings.language;
      const stock = state.foodInventory[foodId] ?? 0;

      if (stock <= 0) {
        soundManager.playSoftChime(280);
        state.showToast(
          lang === 'th'
            ? 'อาหารชนิดนี้หมดแล้ว! ไปซื้อเพิ่มที่ร้านค้า หรือเล่นมินิเกมเพื่อหาเหรียญนะ'
            : 'Out of stock! Buy more in the Shop or play Minigames to earn Coins.',
          'warn'
        );
        return false;
      }

      const foodBowl = state.placedFurniture.find((f) => f.catalogId === 'food_bowl_ceramic');
      return beginCareAction('feed', {
        durationMs: 1750,
        contactAtMs: 850,
        foodId,
        targetInstanceId: foodBowl?.instanceId,
        immediate
      });
    },

    giveWater: (immediate = false) => {
      const state = get();
      const fountain = hasPlacedEquipment(state.placedFurniture, 'auto_water_fountain');
      const bowl = state.placedFurniture.find((f) => f.catalogId === 'water_bowl_ceramic');
      return beginCareAction('water', {
        durationMs: 1650,
        contactAtMs: 800,
        targetInstanceId: (fountain ?? bowl)?.instanceId,
        immediate
      });
    },

    petCat: (immediate = false) => {
      return beginCareAction('pet', {
        durationMs: 1600,
        contactAtMs: 700,
        immediate
      });
    },

    respectCatSpace: (immediate = false) => {
      return beginCareAction('respect_space', {
        durationMs: 1200,
        contactAtMs: 520,
        immediate
      });
    },

    brushCat: (immediate = false) => {
      return beginCareAction('brush', {
        durationMs: 1850,
        contactAtMs: 860,
        immediate
      });
    },

    tuckCatToSleep: (immediate = false) => {
      return beginCareAction('sleep', {
        durationMs: 1350,
        contactAtMs: 600,
        immediate
      });
    },

    cleanLitterBox: (immediate = false) => {
      const state = get();
      const litter = state.placedFurniture.find(
        (f) => f.catalogId === 'litter_box_cozy' || f.catalogId === 'auto_litter_box'
      );
      return beginCareAction('clean_litter', {
        durationMs: 1700,
        contactAtMs: 820,
        targetInstanceId: litter?.instanceId,
        immediate
      });
    },

    cleanLivingArea: (immediate = false) => {
      return beginCareAction('clean_room', {
        durationMs: 1500,
        contactAtMs: 720,
        immediate
      });
    },

    refillWaterFountain: (immediate = false) => {
      const state = get();
      const fountain = hasPlacedEquipment(state.placedFurniture, 'auto_water_fountain');
      if (!fountain) return false;
      return beginCareAction('refill_fountain', {
        durationMs: 1650,
        contactAtMs: 800,
        targetInstanceId: fountain.instanceId,
        immediate
      });
    },

    cleanWaterFountain: (immediate = false) => {
      const state = get();
      const fountain = hasPlacedEquipment(state.placedFurniture, 'auto_water_fountain');
      if (!fountain) return false;
      return beginCareAction('clean_fountain', {
        durationMs: 1650,
        contactAtMs: 820,
        targetInstanceId: fountain.instanceId,
        immediate
      });
    },

    emptyAutoLitterWaste: (immediate = false) => {
      const state = get();
      const autoLitter = hasPlacedEquipment(state.placedFurniture, 'auto_litter_box');
      if (!autoLitter) return false;
      return beginCareAction('empty_auto_litter', {
        durationMs: 1650,
        contactAtMs: 800,
        targetInstanceId: autoLitter.instanceId,
        immediate
      });
    },

    commitActiveCareAction: () => {
      const state = get();
      const action = state.activeCareAction;
      if (!action || action.committed) return;

      const lang = state.settings.language;
      const nowUtc = Date.now();
      const panX = clamp(state.cat.position.x / 2.8, -0.85, 0.85);
      const markedCommitted: ActiveCareAction = { ...action, committed: true };

      if (action.type === 'feed' && action.foodId) {
        const foodId = action.foodId;
        const stock = state.foodInventory[foodId] ?? 0;
        if (stock <= 0) {
          set({ activeCareAction: markedCommitted });
          return;
        }
        const res = performFeedAction(state.cat, state.room, foodId);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);
        if (!res.success) {
          set({ cat: res.cat, activeCareAction: markedCommitted });
          state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warn');
          return;
        }
        const nextInv = { ...state.foodInventory, [foodId]: Math.max(0, stock - 1) };
        const foodBowl = state.placedFurniture.find((f) => f.catalogId === 'food_bowl_ceramic');
        const metrics = computeGrowthMetrics(res.cat.identity.breed, res.cat.ageDays);
        if (foodBowl && foodId !== 'kitten_milk' && metrics.canWalk) {
          res.cat.targetPosition = getInteractionPointForFurniture(foodBowl, res.cat.position);
          res.cat.targetFurnitureId = foodBowl.instanceId;
        }
        const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
        res.cat.level = lvl.level;
        res.cat.xp = lvl.xp;
        const nextStats = { ...state.stats, totalFeeds: state.stats.totalFeeds + 1 };
        const nextTasks = incrementDailyTask(state.dailyTasks, 'feed');
        const ach = evaluateAchievements({
          ...extractSavePayload(state),
          cat: res.cat,
          room: res.room,
          foodInventory: nextInv,
          stats: nextStats
        });
        set({
          cat: res.cat,
          room: res.room,
          foodInventory: nextInv,
          coins: ach.coins,
          claimedRewardIds: ach.claimedRewardIds,
          dailyTasks: nextTasks,
          achievements: ach.achievements,
          stats: nextStats,
          activeCareAction: markedCommitted,
          particleCue: { type: 'heart', seq: state.particleCue.seq + 1 }
        });
        state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'water' || action.type === 'refill_fountain') {
        const res = performWaterAction(state.cat, state.room);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);
        const fountain = hasPlacedEquipment(state.placedFurniture, 'auto_water_fountain');
        const bowl = state.placedFurniture.find((f) => f.catalogId === 'water_bowl_ceramic');
        const target = fountain ?? bowl;
        const metrics = computeGrowthMetrics(res.cat.identity.breed, res.cat.ageDays);
        if (target && metrics.canWalk) {
          res.cat.targetPosition = getInteractionPointForFurniture(target, res.cat.position);
          res.cat.targetFurnitureId = target.instanceId;
        }
        const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
        res.cat.level = lvl.level;
        res.cat.xp = lvl.xp;
        const nextEquip = fountain
          ? {
              ...state.equipment,
              waterFountain: {
                ...state.equipment.waterFountain,
                waterLevel: 100,
                isFlowing: true
              }
            }
          : state.equipment;
        set({
          cat: res.cat,
          room: res.room,
          equipment: nextEquip,
          activeCareAction: markedCommitted,
          particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
        });
        state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'clean_fountain') {
        soundManager.playVocalCue('clean', state.cat.ageDays, true, panX);
        set({
          equipment: {
            ...state.equipment,
            waterFountain: {
              ...state.equipment.waterFountain,
              cleanliness: 100
            }
          },
          activeCareAction: markedCommitted,
          particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
        });
        state.showToast(
          lang === 'th'
            ? 'ทำความสะอาดไส้กรองน้ำพุแมวเรียบร้อยแล้ว!'
            : 'Cleaned the Cat Water Fountain filter!',
          'info'
        );
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'pet') {
        const res = performPetAction(state.cat, state.room, nowUtc);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);

        if (!res.success) {
          const nextBiteSeq = res.triggeredBite
            ? { seq: state.biteFeedback.seq + 1, triggeredAtMs: nowUtc }
            : state.biteFeedback;
          const nextStats = res.triggeredBite
            ? { ...state.stats, defensiveBites: state.stats.defensiveBites + 1 }
            : state.stats;
          set({
            cat: res.cat,
            stats: nextStats,
            biteFeedback: nextBiteSeq,
            activeCareAction: { ...markedCommitted, bitten: Boolean(res.triggeredBite) }
          });
          state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warn');
          scheduleAutoSave(get, set);
          return;
        }

        const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
        res.cat.level = lvl.level;
        res.cat.xp = lvl.xp;
        const nextStats = { ...state.stats, totalPets: state.stats.totalPets + 1 };
        const nextTasks = incrementDailyTask(state.dailyTasks, 'bond');
        const ach = evaluateAchievements({
          ...extractSavePayload(state),
          cat: res.cat,
          stats: nextStats
        });
        set({
          cat: res.cat,
          coins: ach.coins,
          claimedRewardIds: ach.claimedRewardIds,
          dailyTasks: nextTasks,
          achievements: ach.achievements,
          stats: nextStats,
          activeCareAction: markedCommitted,
          particleCue: { type: 'heart', seq: state.particleCue.seq + 1 }
        });
        state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'respect_space') {
        const res = performRespectSpaceAction(state.cat, state.room);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);
        // STRICT ANTI-EXPLOIT: 0 Coins, 0 XP, never farms daily task or currency!
        set({
          cat: res.cat,
          activeCareAction: markedCommitted,
          particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
        });
        state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'brush') {
        const res = performBrushAction(state.cat, state.room, nowUtc);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);
        if (!res.success) {
          const nextBiteSeq = res.triggeredBite
            ? { seq: state.biteFeedback.seq + 1, triggeredAtMs: nowUtc }
            : state.biteFeedback;
          const nextStats = res.triggeredBite
            ? { ...state.stats, defensiveBites: state.stats.defensiveBites + 1 }
            : state.stats;
          set({
            cat: res.cat,
            stats: nextStats,
            biteFeedback: nextBiteSeq,
            activeCareAction: { ...markedCommitted, bitten: Boolean(res.triggeredBite) }
          });
          state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warn');
          scheduleAutoSave(get, set);
          return;
        }
        const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
        res.cat.level = lvl.level;
        res.cat.xp = lvl.xp;
        set({
          cat: res.cat,
          dailyTasks: incrementDailyTask(state.dailyTasks, 'bond'),
          activeCareAction: markedCommitted,
          particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
        });
        state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'sleep') {
        const res = performSleepAction(state.cat, state.room);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);
        if (!res.success) {
          set({ activeCareAction: markedCommitted });
          state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
          return;
        }
        const smartBed = hasPlacedEquipment(state.placedFurniture, 'smart_cat_bed');
        const bed =
          smartBed ??
          state.placedFurniture.find((f) => getCatalogItem(f.catalogId)?.category === 'bed');
        if (bed) {
          res.cat.targetPosition = { x: bed.x, z: bed.z };
          res.cat.targetFurnitureId = bed.instanceId;
        }
        const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
        res.cat.level = lvl.level;
        res.cat.xp = lvl.xp;
        set({
          cat: res.cat,
          activeCareAction: markedCommitted,
          particleCue: { type: 'zzz', seq: state.particleCue.seq + 1 }
        });
        state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'clean_litter' || action.type === 'empty_auto_litter') {
        const res = performCleanLitterAction(state.cat, state.room);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);
        const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
        res.cat.level = lvl.level;
        res.cat.xp = lvl.xp;
        set({
          cat: res.cat,
          room: res.room,
          equipment: {
            ...state.equipment,
            autoLitterBox: {
              ...state.equipment.autoLitterBox,
              wasteLevel: 0,
              litterCleanliness: 100,
              needsCleaning: false
            }
          },
          dailyTasks: incrementDailyTask(state.dailyTasks, 'clean'),
          stats: { ...state.stats, totalCleans: state.stats.totalCleans + 1 },
          activeCareAction: markedCommitted,
          particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
        });
        state.showToast(
          action.type === 'empty_auto_litter'
            ? lang === 'th'
              ? 'เทถังเก็บของเสียของห้องน้ำแมวอัตโนมัติเรียบร้อยแล้ว!'
              : 'Emptied the Automatic Litter Box waste bin!'
            : lang === 'th'
              ? res.messageTh
              : res.messageEn,
          'info'
        );
        scheduleAutoSave(get, set);
        return;
      }

      if (action.type === 'clean_room') {
        const res = performCleanRoomAction(state.cat, state.room);
        soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true, panX);
        const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
        res.cat.level = lvl.level;
        res.cat.xp = lvl.xp;
        set({
          cat: res.cat,
          room: res.room,
          dailyTasks: incrementDailyTask(state.dailyTasks, 'clean'),
          stats: { ...state.stats, totalCleans: state.stats.totalCleans + 1 },
          activeCareAction: markedCommitted,
          particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
        });
        state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
        scheduleAutoSave(get, set);
      }
    },

    finishActiveCareAction: () => {
      clearCareTimers();
      if (get().activeCareAction !== null) {
        set({ activeCareAction: null });
      }
    },

    // --- ADVANCED AUTOMATIC EQUIPMENT CONTROLS ---

    loadAutoFeeder: (foodId, servings = 1) => {
      const state = get();
      const lang = state.settings.language;
      const res = loadAutoFeederFromInventory(
        state.equipment,
        state.foodInventory,
        foodId,
        servings
      );
      if (!res.success) {
        soundManager.playSoftChime(280);
        const msg =
          res.reason === 'empty_inventory'
            ? lang === 'th'
              ? 'ไม่มีอาหารชนิดนี้ในคลัง กรุณาซื้ออาหารก่อนเติมลงเครื่อง'
              : 'No servings of this food in inventory. Buy food first!'
            : res.reason === 'hopper_full'
              ? lang === 'th'
                ? 'ถังอาหารในเครื่องเต็มแล้ว'
                : 'Feeder hopper is already full.'
              : lang === 'th'
                ? 'นมแพะไม่สามารถเก็บในเครื่องให้อาหารอัตโนมัติได้'
                : 'Kitten milk cannot be stored in the automatic feeder.';
        state.showToast(msg, 'warn');
        return false;
      }

      soundManager.playVocalCue('feeder_dispense', state.cat.ageDays, true, 0);
      set({
        equipment: res.equipment,
        foodInventory: res.foodInventory
      });
      state.showToast(
        lang === 'th'
          ? `เติมอาหารลงเครื่องให้อาหารอัตโนมัติ +${res.loadedServings} มื้อแล้ว (หักจากคลังอาหาร)`
          : `Loaded +${res.loadedServings} serving(s) into Automatic Feeder from inventory!`,
        'warm'
      );
      scheduleAutoSave(get, set, true);
      return true;
    },

    updateAutoFeederSettings: (patch) => {
      const state = get();
      set({
        equipment: {
          ...state.equipment,
          autoFeeder: {
            ...state.equipment.autoFeeder,
            ...(patch.scheduleHours ? { scheduleHours: patch.scheduleHours } : {}),
            ...(patch.portionSize ? { portionSize: patch.portionSize } : {})
          }
        }
      });
      scheduleAutoSave(get, set);
    },

    dispenseAutoFeederNow: () => {
      const state = get();
      const lang = state.settings.language;
      const feederFurn = hasPlacedEquipment(state.placedFurniture, 'auto_food_feeder');
      if (!feederFurn) return false;

      const res = dispenseFromAutoFeeder(state.equipment, state.cat.ageDays, Date.now());
      if (!res.dispensed) {
        soundManager.playSoftChime(280);
        const msg =
          res.reason === 'no_food_stored'
            ? lang === 'th'
              ? 'ถังอาหารในเครื่องว่างเปล่า กรุณาเติมอาหารจากคลังก่อนนะ'
              : 'Feeder hopper is empty! Load food from your inventory first.'
            : res.reason === 'age_unsafe'
              ? lang === 'th'
                ? 'อาหารในเครื่องยังไม่เหมาะกับช่วงวัยของน้องแมวตอนนี้'
                : 'Stored food is not suitable for your cat’s current age.'
              : lang === 'th'
                ? 'ถาดอาหารของเครื่องยังมีอาหารเต็มอยู่แล้ว'
                : 'Feeder tray is already full.';
        state.showToast(msg, 'warn');
        return false;
      }

      soundManager.playVocalCue('feeder_dispense', state.cat.ageDays, true, 0);
      const metrics = computeGrowthMetrics(state.cat.identity.breed, state.cat.ageDays);
      const nextCat = { ...state.cat };
      if (metrics.canWalk && state.cat.needs.hunger < 85) {
        nextCat.behavior = 'eat';
        nextCat.behaviorTimer = 5.0;
        nextCat.targetPosition = getInteractionPointForFurniture(feederFurn, state.cat.position);
        nextCat.targetFurnitureId = feederFurn.instanceId;
      }

      set({
        equipment: res.equipment,
        cat: nextCat
      });
      state.showToast(
        lang === 'th'
          ? `เครื่องให้อาหารจ่ายอาหาร ${res.servingsUsed} มื้อลงถาดแล้ว!`
          : `Automatic Feeder dispensed ${res.servingsUsed} serving(s)!`,
        'warm'
      );
      scheduleAutoSave(get, set, true);
      return true;
    },

    setSmartBedWarmth: (warmthLevel) => {
      const state = get();
      const clamped = clamp(Math.round(warmthLevel), 1, 3);
      set({
        equipment: {
          ...state.equipment,
          smartCatBed: { ...state.equipment.smartCatBed, warmthLevel: clamped }
        }
      });
      scheduleAutoSave(get, set);
    },

    toggleAutoCatToy: () => {
      const state = get();
      const lang = state.settings.language;
      const toyFurn = hasPlacedEquipment(state.placedFurniture, 'auto_cat_toy');
      if (!toyFurn) return false;

      const cur = state.equipment.autoCatToy;
      if (cur.enabled) {
        set({
          equipment: {
            ...state.equipment,
            autoCatToy: {
              ...cur,
              enabled: false,
              activeSecondsRemaining: 0,
              cooldownSecondsRemaining: Math.max(cur.cooldownSecondsRemaining, 25)
            }
          }
        });
        return true;
      }

      if (cur.cooldownSecondsRemaining > 0) {
        const secs = Math.ceil(cur.cooldownSecondsRemaining);
        state.showToast(
          lang === 'th'
            ? `ของเล่นอัตโนมัติกำลังพักมอเตอร์ (รออีก ${secs} วินาที)`
            : `Automatic Cat Toy is cooling down (${secs}s remaining).`,
          'info'
        );
        return false;
      }

      soundManager.playSoftChime(680);
      set({
        equipment: {
          ...state.equipment,
          autoCatToy: {
            ...cur,
            enabled: true,
            activeSecondsRemaining: ECONOMY_CONFIG.EQUIPMENT.AUTO_TOY_ACTIVE_SECONDS
          }
        }
      });
      state.showToast(
        lang === 'th'
          ? 'เปิดของเล่นแมวอัตโนมัติแล้ว! น้องแมวจะวิ่งมาไล่เล่นเอง'
          : 'Automatic Cat Toy activated! Your cat can autonomously chase it.',
        'warm'
      );
      scheduleAutoSave(get, set);
      return true;
    },

    // --- TOYS (ZERO COINS AWARDED!) ---

    activateToy: (toy) => {
      const state = get();
      const lang = state.settings.language;

      if (toy === null) {
        set({ activeToy: null });
        return;
      }

      const metrics = computeGrowthMetrics(state.cat.identity.breed, state.cat.ageDays);
      if (!metrics.canUseToys) {
        soundManager.playVocalCue('kitten_mew', state.cat.ageDays, true);
        state.showToast(
          lang === 'th'
            ? `${state.cat.identity.name} ยังเป็นลูกแมวแรกเกิด ตายังปิดอยู่ รอโตอีกนิด (18 วันขึ้นไป) นะ`
            : `${state.cat.identity.name} is still a newborn! Toys unlock at ~3 weeks old.`,
          'warn'
        );
        return;
      }

      if (state.cat.needs.energy < 16) {
        soundManager.playVocalCue('sleepy_sigh', state.cat.ageDays, true);
        state.showToast(
          lang === 'th'
            ? `${state.cat.identity.name} หาวง่วงแล้ว ลองปล่อยให้นอนพักก่อนนะ`
            : `${state.cat.identity.name} yawns sleepily—let them rest first.`,
          'warn'
        );
        return;
      }

      if (toy === 'scratching_post' || toy === 'cardboard_box') {
        const targetFurn = state.placedFurniture.find((f) =>
          toy === 'scratching_post'
            ? f.catalogId === 'scratching_post_sisal' || f.catalogId === 'cat_tower_oak'
            : f.catalogId === 'cardboard_box'
        );
        if (targetFurn) {
          const bond = addBondPoints(state.cat.bondLevel, state.cat.bondXp, 10);
          const nextTraits = evolvePersonality(state.cat.traits, 'play_session');
          const targetPt = getInteractionPointForFurniture(targetFurn, state.cat.position);
          const nextCat = {
            ...state.cat,
            traits: nextTraits,
            behavior: toy === 'scratching_post' ? ('play' as const) : ('box_ambush' as const),
            behaviorTimer: 5.5,
            targetPosition: targetPt,
            targetFurnitureId: targetFurn.instanceId,
            bondLevel: bond.bondLevel,
            bondXp: bond.bondXp,
            needs: {
              ...state.cat.needs,
              happiness: clamp(state.cat.needs.happiness + 12, 0, 100),
              energy: clamp(state.cat.needs.energy - 6, 0, 100),
              stress: clamp(state.cat.needs.stress - 14, 0, 100)
            }
          };
          nextCat.emotion = evaluateCatEmotion(nextCat);

          set({
            activeToy: null,
            drawerOpen: false,
            cat: nextCat,
            dailyTasks: incrementDailyTask(state.dailyTasks, 'play'),
            stats: { ...state.stats, totalPlays: state.stats.totalPlays + 1 },
            particleCue: { type: 'music', seq: state.particleCue.seq + 1 }
          });
          soundManager.playVocalCue('play_chirp', state.cat.ageDays, true);
          state.showToast(
            lang === 'th'
              ? toy === 'scratching_post'
                ? `${state.cat.identity.name} วิ่งไปลับเล็บคลายเครียดอย่างสนุกสนาน!`
                : `${state.cat.identity.name} มุดเข้ากล่องกระดาษเตรียมกระโจนเล่น!`
              : toy === 'scratching_post'
                ? `${state.cat.identity.name} stretches up to scratch the sisal post!`
                : `${state.cat.identity.name} dives into the cardboard box for a playful ambush!`,
            'warm'
          );
          scheduleAutoSave(get, set);
          return;
        }
      }

      soundManager.playSoftChime(660);
      set({ activeToy: toy, drawerOpen: false, decorateMode: false });
    },

    recordToyPlayReward: () => {
      const now = Date.now();
      if (now - lastToyRewardTime < 3200) return;
      lastToyRewardTime = now;

      const state = get();
      const bond = addBondPoints(state.cat.bondLevel, state.cat.bondXp, 12);
      const lvl = addXpAndCheckLevel(state.cat.level, state.cat.xp, 8);
      const nextTraits = evolvePersonality(state.cat.traits, 'play_session');
      const nextCat = {
        ...state.cat,
        traits: nextTraits,
        bondLevel: bond.bondLevel,
        bondXp: bond.bondXp,
        level: lvl.level,
        xp: lvl.xp,
        needs: {
          ...state.cat.needs,
          happiness: clamp(state.cat.needs.happiness + 12, 0, 100),
          energy: clamp(state.cat.needs.energy - 5, 0, 100),
          stress: clamp(state.cat.needs.stress - 10, 0, 100)
        },
        weight: {
          ...state.cat.weight,
          calorieBuffer: state.cat.weight.calorieBuffer - 8
        }
      };
      nextCat.emotion = evaluateCatEmotion(nextCat);

      // Zero Coins from ordinary toy play — prevents infinite coin loops!
      set({
        cat: nextCat,
        dailyTasks: incrementDailyTask(state.dailyTasks, 'play'),
        stats: { ...state.stats, totalPlays: state.stats.totalPlays + 1 },
        particleCue: { type: 'music', seq: state.particleCue.seq + 1 }
      });
      soundManager.playVocalCue('play_chirp', state.cat.ageDays, true);
      scheduleAutoSave(get, set);
    },

    // --- ENERGY-GATED 60-SECOND MINIGAMES ---

    startMinigame: (id, nowUtc = Date.now()) => {
      const state = get();
      const lang = state.settings.language;

      // Prevent simultaneous minigames or rapid double-tap deductions
      if (state.activeMinigameSession !== null) {
        return { started: false };
      }
      if (Math.abs(nowUtc - lastMinigameStartMs) < 450 && nowUtc >= lastMinigameStartMs) {
        return { started: false };
      }

      const energyRes = consumePlayerEnergyForMinigame(
        state.playerEnergy,
        nowUtc,
        ECONOMY_CONFIG.MINIGAME_ENERGY_COST
      );
      if (!energyRes.success) {
        set({ playerEnergy: energyRes.energy });
        soundManager.playSoftChime(280);
        const waitStr = formatCountdownMmSs(energyRes.msUntilPlayable);
        state.showToast(
          lang === 'th'
            ? `พลังงานไม่พอ! ต้องใช้ 5 พลังงาน (ตอนนี้ ${energyRes.energy.current}/${energyRes.energy.max}) • ฟื้นฟูครบใน ${waitStr}`
            : `Not enough Energy! Need 5 Energy (currently ${energyRes.energy.current}/${energyRes.energy.max}). Ready in ${waitStr}.`,
          'warn'
        );
        return { started: false };
      }

      lastMinigameStartMs = nowUtc;
      const sessionId = `${id}_${nowUtc}_${Math.floor(Math.random() * 1e6)}`;
      const session: MinigameSession = {
        sessionId,
        gameId: id,
        startedAtUtc: nowUtc,
        durationSec: ECONOMY_CONFIG.MINIGAME_DURATION_SECONDS,
        energyDeducted: true,
        claimed: false
      };

      set({
        playerEnergy: energyRes.energy,
        activeMinigameSession: session,
        drawerOpen: false,
        activeToy: null,
        decorateMode: false
      });

      // Immediately save energy deduction atomically so browser refresh cannot refund energy!
      scheduleAutoSave(get, set, true);
      return { started: true, sessionId };
    },

    cancelMinigame: () => {
      const state = get();
      if (!state.activeMinigameSession) return;
      const lang = state.settings.language;
      set({ activeMinigameSession: null });
      state.showToast(
        lang === 'th'
          ? 'ยกเลิกมินิเกมแล้ว (ไม่ได้รับเหรียญรางวัล)'
          : 'Minigame canceled — no Coins awarded.',
        'info'
      );
      scheduleAutoSave(get, set, true);
    },

    completeMinigame: (sessionId, score, nowUtc = Date.now()) => {
      const state = get();
      const session = state.activeMinigameSession;
      if (!session || session.sessionId !== sessionId || session.claimed) {
        return { claimed: false, coinsEarned: 0 };
      }

      const { tier, coins: rewardCoins } = evaluateMinigameReward(session.gameId, score);
      const claimId = buildMinigameClaimId(sessionId);
      const tx = applyIdempotentCoinReward(
        state.coins,
        state.claimedRewardIds,
        claimId,
        rewardCoins
      );

      if (!tx.applied) {
        set({ activeMinigameSession: null });
        return { claimed: false, coinsEarned: 0 };
      }

      const lvl = addXpAndCheckLevel(state.cat.level, state.cat.xp, 15);
      const entry: MinigameResultEntry = {
        sessionId,
        gameId: session.gameId,
        score: Math.max(0, Math.floor(score)),
        tier,
        coinsEarned: rewardCoins,
        completedAtUtc: nowUtc
      };

      set({
        activeMinigameSession: null,
        coins: tx.coins,
        claimedRewardIds: tx.claimedRewardIds,
        minigameHistory: [entry, ...state.minigameHistory].slice(0, 50),
        cat: { ...state.cat, level: lvl.level, xp: lvl.xp },
        stats: { ...state.stats, minigamesCompleted: state.stats.minigamesCompleted + 1 }
      });

      soundManager.playSoftChime(840);
      const lang = state.settings.language;
      state.showToast(
        lang === 'th'
          ? `🎉 จบมินิเกม! คะแนน ${entry.score} รับ +${rewardCoins} เหรียญ`
          : `🎉 Minigame complete! Score ${entry.score} → +${rewardCoins} Coins`,
        'celebrate'
      );
      scheduleAutoSave(get, set, true);
      return { claimed: true, coinsEarned: rewardCoins, tier };
    },

    // --- SHOP & IDEMPOTENT PURCHASES ---

    buyFood: (foodId) => {
      if (!canPurchaseNow()) return false;
      const state = get();
      const lang = state.settings.language;
      const item = FOOD_CATALOG.find((f) => f.id === foodId);
      if (!item) return false;

      const tx = applyIdempotentPurchase(
        state.coins,
        state.claimedRewardIds,
        '',
        item.priceCoins
      );
      if (!tx.success) {
        soundManager.playSoftChime(280);
        state.showToast(
          lang === 'th'
            ? 'เหรียญยังไม่พอ ลองเล่นมินิเกมเพื่อเก็บเหรียญนะ!'
            : 'Not enough Coins—play Minigames to earn more!',
          'warn'
        );
        return false;
      }

      const nextCount = (state.foodInventory[foodId] ?? 0) + item.packSize;
      set({
        coins: tx.coins,
        foodInventory: { ...state.foodInventory, [foodId]: nextCount }
      });
      soundManager.playSoftChime(740);
      state.showToast(
        lang === 'th'
          ? `ซื้อ ${item.nameTh} +${item.packSize} มื้อแล้ว (คงเหลือ ${nextCount})`
          : `Bought ${item.nameEn} (+${item.packSize})! Stock: ${nextCount}`,
        'celebrate'
      );
      scheduleAutoSave(get, set, true);
      return true;
    },

    buyAccessory: (accessoryId) => {
      if (!canPurchaseNow()) return false;
      const state = get();
      const lang = state.settings.language;
      const item = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
      if (!item || state.ownedAccessories.includes(accessoryId)) return false;

      const tx = applyIdempotentPurchase(
        state.coins,
        state.claimedRewardIds,
        `buy_acc_${accessoryId}`,
        item.priceCoins
      );
      if (!tx.success) {
        soundManager.playSoftChime(280);
        state.showToast(lang === 'th' ? 'เหรียญยังไม่พอ' : 'Not enough Coins yet.', 'warn');
        return false;
      }

      set({
        coins: tx.coins,
        claimedRewardIds: tx.claimedRewardIds,
        ownedAccessories: [...state.ownedAccessories, accessoryId],
        cat: {
          ...state.cat,
          identity: { ...state.cat.identity, equippedAccessory: accessoryId }
        }
      });
      soundManager.playSoftChime(780);
      state.showToast(
        lang === 'th'
          ? `ซื้อและสวมใส่ "${item.nameTh}" ให้ ${state.cat.identity.name} แล้ว!`
          : `Purchased and equipped "${item.nameEn}"!`,
        'celebrate'
      );
      scheduleAutoSave(get, set, true);
      return true;
    },

    equipAccessory: (accessoryId) => {
      const state = get();
      if (accessoryId !== 'none' && !state.ownedAccessories.includes(accessoryId)) return;
      set({
        cat: {
          ...state.cat,
          identity: { ...state.cat.identity, equippedAccessory: accessoryId }
        }
      });
      soundManager.playSoftChime(640);
      scheduleAutoSave(get, set);
    },

    setDecorateMode: (enabled) => {
      set({
        decorateMode: enabled,
        drawerOpen: false,
        activeToy: null,
        selectedFurnitureInstanceId: enabled ? get().selectedFurnitureInstanceId : null,
        placingCatalogId: null
      });
      if (!enabled) scheduleAutoSave(get, set);
    },

    selectFurniture: (instanceId) =>
      set({ selectedFurnitureInstanceId: instanceId, placingCatalogId: null }),

    startPlacingFurniture: (catalogId) =>
      set({
        decorateMode: true,
        drawerOpen: false,
        placingCatalogId: catalogId,
        selectedFurnitureInstanceId: null
      }),

    moveFurniture: (instanceId, x, z) => {
      const state = get();
      const target = state.placedFurniture.find((f) => f.instanceId === instanceId);
      if (!target) return false;
      const candidate: PlacedFurniture = { ...target, x, z };
      const check = validateFurniturePlacement(candidate, state.placedFurniture);
      if (!check.valid) return false;
      set({
        placedFurniture: state.placedFurniture.map((f) =>
          f.instanceId === instanceId ? candidate : f
        )
      });
      scheduleAutoSave(get, set);
      return true;
    },

    rotateFurniture: (instanceId, deltaRad = Math.PI / 4) => {
      const state = get();
      const target = state.placedFurniture.find((f) => f.instanceId === instanceId);
      if (!target) return false;
      const candidate: PlacedFurniture = {
        ...target,
        rotationY: (target.rotationY + deltaRad) % (Math.PI * 2)
      };
      const check = validateFurniturePlacement(candidate, state.placedFurniture);
      if (!check.valid) {
        const lang = state.settings.language;
        state.showToast(
          lang === 'th'
            ? 'หมุนตำแหน่งนี้ไม่ได้เพราะชนกับเฟอร์นิเจอร์หรือผนัง'
            : 'Cannot rotate here—collides with furniture or wall.',
          'warn'
        );
        return false;
      }
      set({
        placedFurniture: state.placedFurniture.map((f) =>
          f.instanceId === instanceId ? candidate : f
        )
      });
      soundManager.playSoftChime(580);
      scheduleAutoSave(get, set);
      return true;
    },

    placeNewFurniture: (catalogId, x, z) => {
      const state = get();
      const ownedCount = state.ownedFurniture[catalogId] ?? 0;
      const placedCount = state.placedFurniture.filter((f) => f.catalogId === catalogId).length;
      if (ownedCount <= placedCount) return false;

      const instance: PlacedFurniture = {
        instanceId: `f_${catalogId}_${Date.now()}`,
        catalogId,
        x,
        z,
        rotationY: 0
      };
      const check = validateFurniturePlacement(instance, state.placedFurniture);
      if (!check.valid) return false;
      set({
        placedFurniture: [...state.placedFurniture, instance],
        selectedFurnitureInstanceId: instance.instanceId,
        placingCatalogId: null
      });
      soundManager.playSoftChime(700);
      scheduleAutoSave(get, set, true);
      return true;
    },

    removePlacedFurniture: (instanceId) => {
      const state = get();
      const target = state.placedFurniture.find((f) => f.instanceId === instanceId);
      if (!target) return;
      const item = getCatalogItem(target.catalogId);
      const sameCatCount = state.placedFurniture.filter(
        (f) => getCatalogItem(f.catalogId)?.category === item?.category
      ).length;
      if (
        item &&
        ['bed', 'food_bowl', 'water_bowl', 'litter_box'].includes(item.category) &&
        sameCatCount <= 1
      ) {
        const lang = state.settings.language;
        state.showToast(
          lang === 'th'
            ? 'ต้องมีของใช้พื้นฐานชิ้นนี้อย่างน้อย 1 ชิ้นในห้องนะ'
            : 'Keep at least one essential care item in the room.',
          'warn'
        );
        return;
      }
      set({
        placedFurniture: state.placedFurniture.filter((f) => f.instanceId !== instanceId),
        selectedFurnitureInstanceId: null
      });
      scheduleAutoSave(get, set);
    },

    buyFurniture: (catalogId) => {
      if (!canPurchaseNow()) return false;
      const state = get();
      const lang = state.settings.language;
      const item = FURNITURE_CATALOG.find((i) => i.id === catalogId);
      if (!item) return false;

      // Automatic equipment items are unique per room — prevent buying accidental duplicates
      if (item.isAutoEquipment && (state.ownedFurniture[catalogId] ?? 0) >= 1) {
        state.showToast(
          lang === 'th'
            ? `คุณมี "${item.nameTh}" อยู่แล้ว`
            : `You already own "${item.nameEn}".`,
          'info'
        );
        return false;
      }

      const txId = item.isAutoEquipment ? `buy_equip_${catalogId}` : '';
      const tx = applyIdempotentPurchase(
        state.coins,
        state.claimedRewardIds,
        txId,
        item.priceCoins
      );
      if (!tx.success) {
        soundManager.playSoftChime(280);
        state.showToast(
          lang === 'th'
            ? 'เหรียญยังไม่พอ ลองเล่นมินิเกมเพื่อเก็บเหรียญนะ'
            : 'Not enough Coins—play Minigames to earn more!',
          'warn'
        );
        return false;
      }

      const nextCount = (state.ownedFurniture[catalogId] ?? 0) + 1;
      set({
        coins: tx.coins,
        claimedRewardIds: tx.claimedRewardIds,
        ownedFurniture: { ...state.ownedFurniture, [catalogId]: nextCount }
      });
      soundManager.playSoftChime(760);
      state.showToast(
        lang === 'th'
          ? `ซื้อ "${item.nameTh}" แล้ว! กด "วางในห้อง" เพื่อติดตั้งได้เลย`
          : `Purchased "${item.nameEn}"! Tap "Place" to install it in your room.`,
        'celebrate'
      );
      scheduleAutoSave(get, set, true);
      return true;
    },

    buyToy: (toyId) => {
      if (!canPurchaseNow()) return false;
      const state = get();
      const lang = state.settings.language;
      const toy = TOY_CATALOG.find((t) => t.id === toyId);
      if (!toy || state.ownedToys.includes(toyId)) return false;

      const tx = applyIdempotentPurchase(
        state.coins,
        state.claimedRewardIds,
        `buy_toy_${toyId}`,
        toy.priceCoins
      );
      if (!tx.success) {
        soundManager.playSoftChime(280);
        state.showToast(lang === 'th' ? 'เหรียญยังไม่พอ' : 'Not enough Coins yet.', 'warn');
        return false;
      }

      set({
        coins: tx.coins,
        claimedRewardIds: tx.claimedRewardIds,
        ownedToys: [...state.ownedToys, toyId]
      });
      soundManager.playSoftChime(760);
      state.showToast(
        lang === 'th' ? `ปลดล็อกของเล่น "${toy.nameTh}" แล้ว!` : `Unlocked "${toy.nameEn}"!`,
        'celebrate'
      );
      scheduleAutoSave(get, set, true);
      return true;
    },

    claimDailyTask: (taskId, nowUtc = Date.now()) => {
      const state = get();
      const utcDay = getUtcDayNumber(nowUtc);
      const task = state.dailyTasks.find((t) => t.id === taskId);
      if (!task || task.claimed || task.progress < task.target) return false;

      const claimId = buildDailyTaskClaimId(utcDay, taskId);
      const tx = applyIdempotentCoinReward(
        state.coins,
        state.claimedRewardIds,
        claimId,
        task.rewardCoins
      );
      if (!tx.applied) return false;

      const lvl = addXpAndCheckLevel(state.cat.level, state.cat.xp, task.rewardXp);
      set({
        coins: tx.coins,
        claimedRewardIds: tx.claimedRewardIds,
        cat: { ...state.cat, level: lvl.level, xp: lvl.xp },
        dailyTasks: state.dailyTasks.map((t) => (t.id === taskId ? { ...t, claimed: true } : t))
      });
      soundManager.playSoftChime(820);
      const lang = state.settings.language;
      state.showToast(
        lang === 'th'
          ? `รับรางวัล +${task.rewardCoins} เหรียญ และ +${task.rewardXp} XP แล้ว!`
          : `Claimed +${task.rewardCoins} Coins & +${task.rewardXp} XP!`,
        'celebrate'
      );
      scheduleAutoSave(get, set, true);
      return true;
    },

    savePhoto: (dataUrl) => {
      const state = get();
      soundManager.playShutter();

      const entry: PhotoEntry = {
        id: `photo_${Date.now()}`,
        dataUrl,
        takenAt: Date.now(),
        catName: state.cat.identity.name,
        ageDays: Math.floor(state.cat.ageDays),
        lifeStage: state.cat.lifeStage,
        behavior: state.cat.behavior
      };

      const nextStats = { ...state.stats, totalPhotos: state.stats.totalPhotos + 1 };
      const nextTasks = incrementDailyTask(state.dailyTasks, 'photo');
      const ach = evaluateAchievements({
        ...extractSavePayload(state),
        stats: nextStats
      });

      // Zero direct coins per photo tap (prevents photo spam farming; daily task & achievement reward once!)
      set({
        photos: [entry, ...state.photos].slice(0, 20),
        dailyTasks: nextTasks,
        stats: nextStats,
        achievements: ach.achievements,
        coins: ach.coins,
        claimedRewardIds: ach.claimedRewardIds
      });

      const lang = state.settings.language;
      state.showToast(
        lang === 'th' ? 'บันทึกภาพลงอัลบั้มเรียบร้อยแล้ว!' : 'Saved photo to album!',
        'celebrate'
      );
      scheduleAutoSave(get, set);
    },

    deletePhoto: (photoId) => {
      set({ photos: get().photos.filter((p) => p.id !== photoId) });
      scheduleAutoSave(get, set);
    },

    updateSettings: (patch) => {
      const next = { ...get().settings, ...patch };
      soundManager.setEnabled(next.soundEnabled);
      set({ settings: next });
      scheduleAutoSave(get, set);
    },

    renameCat: (newName) => {
      const trimmed = newName.trim().slice(0, 20);
      if (!trimmed) return;
      set({
        cat: {
          ...get().cat,
          identity: { ...get().cat.identity, name: trimmed }
        }
      });
      scheduleAutoSave(get, set);
    },

    adoptCustomizedKitten: ({ name, sex, breed, furColorId, furPattern, eyeColorId }) => {
      const nowUtc = Date.now();
      const def = getBreedDefinition(breed);
      const colors = resolveCoatHexColors(furColorId, furPattern);
      const eyeHex = EYE_COLOR_PALETTE[eyeColorId].hex;
      const bed = get().placedFurniture.find((f) => getCatalogItem(f.catalogId)?.category === 'bed');

      const identity: CatIdentity = {
        id: `cat_${nowUtc}`,
        name: name.trim() || def.defaultNameTh,
        sex,
        breed,
        furColorId,
        furColor: colors.primary,
        furSecondary: colors.secondary,
        eyeColorId,
        eyeColor: eyeHex,
        furPattern,
        equippedAccessory: 'none',
        adoptedAt: nowUtc
      };

      const traits = generateRandomPersonality();
      const weight = createInitialWeightState(breed, 2);
      const fresh = createInitialSaveData(breed, {
        hasAdoptedInitialCat: true,
        customIdentity: identity,
        nowUtc
      });

      const newCat: SaveDataV3['cat'] = {
        ...fresh.cat,
        identity,
        traits,
        weight,
        position: {
          x: bed ? bed.x : -1.45,
          y: 0.095,
          z: bed ? bed.z : 0.25
        }
      };
      newCat.emotion = evaluateCatEmotion(newCat);

      const currentMilk = get().foodInventory.kitten_milk ?? 0;
      const nextFoodInventory = {
        ...get().foodInventory,
        kitten_milk: Math.max(currentMilk, 6)
      };

      set({
        hasAdoptedInitialCat: true,
        showAdoptFlow: false,
        showProfileModal: false,
        activeToy: null,
        lastGrowthSyncAtUtc: nowUtc,
        cat: newCat,
        foodInventory: nextFoodInventory
      });

      soundManager.playVocalCue('kitten_mew', 2, true);
      const lang = get().settings.language;
      get().showToast(
        lang === 'th'
          ? `ยินดีต้อนรับ "${identity.name}" ลูกแมว${def.nameTh}ตัวน้อยสู่บ้านใหม่!`
          : `Welcome home, ${identity.name} the newborn ${def.nameEn}!`,
        'celebrate'
      );
      scheduleAutoSave(get, set, true);
    }
  };
});
