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
import {
  clearSavedGame,
  createInitialSaveData,
  loadGameData,
  saveGameData
} from '../persistence/saveManager';
import { addBondPoints } from '../simulation/bond';
import { stepCatAI } from '../simulation/catAI';
import { getInteractionPointForFurniture, validateFurniturePlacement } from '../simulation/collision';
import { evaluateCatEmotion } from '../simulation/emotions';
import { advanceAgeDays, clamp, computeGrowthMetrics, getLifeStageForAge } from '../simulation/growth';
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
  PhotoEntry,
  PlacedFurniture,
  SaveDataV2,
  ToyType,
  Vec2
} from '../types/game';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'warm' | 'info' | 'warn' | 'celebrate';
}

export interface GameStore extends SaveDataV2 {
  hydrated: boolean;
  activeTab: ActiveTab;
  drawerOpen: boolean;
  activeToy: ToyType | null;
  activeMinigame: MinigameId | null;
  decorateMode: boolean;
  selectedFurnitureInstanceId: string | null;
  placingCatalogId: string | null;
  photoMode: boolean;
  showSettings: boolean;
  showProfileModal: boolean;
  showAdoptFlow: boolean;
  showAlbumModal: boolean;
  showTasksModal: boolean;
  toast: ToastMessage | null;
  lastSavedAt: number;
  particleCue: { type: 'heart' | 'zzz' | 'sparkle' | 'music'; seq: number };

  // Lifecycle
  hydrateFromStorage: () => Promise<void>;
  persistNow: () => Promise<void>;
  resetGame: () => Promise<void>;

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
  showToast: (text: string, tone?: ToastMessage['tone']) => void;

  // Care & Food Economy
  feedCat: (foodId: FoodItemId) => void;
  giveWater: () => void;
  petCat: () => void;
  respectCatSpace: () => void;
  brushCat: () => void;
  tuckCatToSleep: () => void;
  cleanLitterBox: () => void;
  cleanLivingArea: () => void;

  // Toys & Minigames
  activateToy: (toy: ToyType | null) => void;
  recordToyPlayReward: () => void;
  openMinigame: (id: MinigameId | null) => void;
  completeMinigame: (id: MinigameId, coinsEarned: number, score: number) => void;

  // Shop, Inventory & Decoration
  buyFood: (foodId: FoodItemId) => void;
  buyAccessory: (accessoryId: Exclude<AccessoryId, 'none'>) => void;
  equipAccessory: (accessoryId: AccessoryId) => void;
  setDecorateMode: (enabled: boolean) => void;
  selectFurniture: (instanceId: string | null) => void;
  startPlacingFurniture: (catalogId: string | null) => void;
  moveFurniture: (instanceId: string, x: number, z: number) => boolean;
  rotateFurniture: (instanceId: string, deltaRad?: number) => boolean;
  placeNewFurniture: (catalogId: string, x: number, z: number) => boolean;
  removePlacedFurniture: (instanceId: string) => void;
  buyFurniture: (catalogId: string) => void;
  buyToy: (toyId: ToyType) => void;

  // Progression, Photos, Settings & Adoption
  claimDailyTask: (taskId: string) => void;
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
  skipAgeDays: (days: number) => void;
}

let toastCounter = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastToyRewardTime = 0;
let lastPurchaseMs = 0;

function extractSavePayload(state: GameStore): SaveDataV2 {
  return {
    version: 2,
    savedAt: Date.now(),
    hasAdoptedInitialCat: state.hasAdoptedInitialCat,
    cat: state.cat,
    room: state.room,
    coins: state.coins,
    gems: state.gems,
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
  set: (partial: Partial<GameStore>) => void
): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const ok = await saveGameData(extractSavePayload(get()));
    if (ok) {
      set({ lastSavedAt: Date.now() });
    }
  }, 900);
}

function addXpAndCheckLevel(
  level: number,
  xp: number,
  gain: number
): { level: number; xp: number; leveledUp: boolean } {
  let lvl = level;
  let totalXp = xp + gain;
  let leveledUp = false;
  while (totalXp >= lvl * 100) {
    totalXp -= lvl * 100;
    lvl += 1;
    leveledUp = true;
  }
  return { level: lvl, xp: totalXp, leveledUp };
}

function incrementDailyTask(
  tasks: SaveDataV2['dailyTasks'],
  type: SaveDataV2['dailyTasks'][number]['type']
): SaveDataV2['dailyTasks'] {
  return tasks.map((t) =>
    t.type === type && !t.claimed ? { ...t, progress: Math.min(t.target, t.progress + 1) } : t
  );
}

function evaluateAchievements(state: SaveDataV2): {
  achievements: SaveDataV2['achievements'];
  bonusCoins: number;
  newlyUnlockedTh: string[];
  newlyUnlockedEn: string[];
} {
  let bonusCoins = 0;
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
      bonusCoins += a.rewardCoins;
      newlyUnlockedTh.push(a.titleTh);
      newlyUnlockedEn.push(a.titleEn);
      return { ...a, unlocked: true, unlockedAt: Date.now() };
    }
    return a;
  });

  return { achievements, bonusCoins, newlyUnlockedTh, newlyUnlockedEn };
}

function canPurchaseNow(): boolean {
  const now = Date.now();
  if (now - lastPurchaseMs < 350) return false;
  lastPurchaseMs = now;
  return true;
}

const initial = createInitialSaveData('siamese', { hasAdoptedInitialCat: false });

export const useGameStore = create<GameStore>((set, get) => ({
  ...initial,
  hydrated: false,
  activeTab: 'care',
  drawerOpen: false,
  activeToy: null,
  activeMinigame: null,
  decorateMode: false,
  selectedFurnitureInstanceId: null,
  placingCatalogId: null,
  photoMode: false,
  showSettings: false,
  showProfileModal: false,
  showAdoptFlow: false,
  showAlbumModal: false,
  showTasksModal: false,
  toast: null,
  lastSavedAt: Date.now(),
  particleCue: { type: 'heart', seq: 0 },

  showToast: (text, tone = 'warm') => {
    const id = ++toastCounter;
    set({ toast: { id, text, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, 3800);
  },

  hydrateFromStorage: async () => {
    const loaded = await loadGameData();
    if (!loaded) {
      // Brand new game -> show Breed Selection & 3D Customization screen!
      set({ hydrated: true, showAdoptFlow: true, hasAdoptedInitialCat: false });
      soundManager.setEnabled(get().settings.soundEnabled);
      return;
    }

    const elapsedSeconds = Math.max(0, (Date.now() - loaded.savedAt) / 1000);
    const { cat, room } = applyOfflineElapsed(loaded.cat, loaded.room, elapsedSeconds);
    cat.lifeStage = getLifeStageForAge(cat.ageDays);

    const today = Math.floor(Date.now() / 86400000);
    const dailyTasks =
      loaded.lastDailyResetDay < today ? createDefaultDailyTasks() : loaded.dailyTasks;

    soundManager.setEnabled(loaded.settings.soundEnabled);

    set({
      ...loaded,
      cat,
      room,
      dailyTasks,
      lastDailyResetDay: today,
      hydrated: true,
      showAdoptFlow: !loaded.hasAdoptedInitialCat,
      lastSavedAt: loaded.savedAt
    });

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
      get().showToast(lang === 'th' ? 'บันทึกข้อมูลเกมเรียบร้อยแล้ว' : 'Game saved safely!', 'info');
    }
  },

  resetGame: async () => {
    await clearSavedGame();
    const fresh = createInitialSaveData('siamese', { hasAdoptedInitialCat: false });
    set({
      ...fresh,
      activeTab: 'care',
      drawerOpen: false,
      activeToy: null,
      activeMinigame: null,
      decorateMode: false,
      selectedFurnitureInstanceId: null,
      placingCatalogId: null,
      showSettings: false,
      showProfileModal: false,
      showAdoptFlow: true
    });
    soundManager.setEnabled(fresh.settings.soundEnabled);
  },

  stepSimulation: (dtSeconds, playerFocusPoint, activeToyTarget, soundEventPos) => {
    const state = get();
    if (!state.hydrated || !state.hasAdoptedInitialCat || state.activeMinigame) return;

    const prevStage = state.cat.lifeStage;
    const nextAgeDays = advanceAgeDays(state.cat.ageDays, dtSeconds, state.settings.timeScale);
    const nextStage = getLifeStageForAge(nextAgeDays);

    const { needs, room } = tickNeeds(state.cat, state.room, dtSeconds, state.settings.timeScale);
    const nextWeight = stepWeightSimulation(state.cat, dtSeconds, state.settings.timeScale);

    const catWithUpdates = {
      ...state.cat,
      ageDays: nextAgeDays,
      lifeStage: nextStage,
      needs,
      weight: nextWeight
    };

    const aiRes = stepCatAI(
      catWithUpdates,
      {
        furniture: state.placedFurniture,
        room,
        playerFocusPoint,
        activeToyTarget,
        soundEventPos
      },
      dtSeconds
    );

    if (aiRes.vocalCue) {
      soundManager.playVocalCue(aiRes.vocalCue, aiRes.cat.ageDays);
    }

    let nextRoom = room;
    let nextStats = state.stats;

    if (aiRes.roomEvent === 'consumed_food') {
      nextRoom = { ...nextRoom, foodBowlLevel: clamp(nextRoom.foodBowlLevel - dtSeconds * 6, 0, 100) };
      aiRes.cat.needs.hunger = clamp(aiRes.cat.needs.hunger + dtSeconds * 7, 0, 100);
    } else if (aiRes.roomEvent === 'consumed_water') {
      nextRoom = { ...nextRoom, waterBowlLevel: clamp(nextRoom.waterBowlLevel - dtSeconds * 7, 0, 100) };
      aiRes.cat.needs.thirst = clamp(aiRes.cat.needs.thirst + dtSeconds * 8, 0, 100);
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

    const updatedPayload: SaveDataV2 = {
      ...extractSavePayload(state),
      cat: aiRes.cat,
      room: nextRoom,
      stats: nextStats
    };
    const ach = evaluateAchievements(updatedPayload);

    set({
      cat: aiRes.cat,
      room: nextRoom,
      stats: nextStats,
      achievements: ach.achievements,
      coins: state.coins + ach.bonusCoins
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
      scheduleAutoSave(get, set);
    }

    if (ach.newlyUnlockedTh.length > 0) {
      const lang = state.settings.language;
      state.showToast(
        lang === 'th'
          ? `🏆 ปลดล็อกความสำเร็จ: ${ach.newlyUnlockedTh[0]}`
          : `🏆 Achievement unlocked: ${ach.newlyUnlockedEn[0]}`,
        'celebrate'
      );
      scheduleAutoSave(get, set);
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

  feedCat: (foodId) => {
    const state = get();
    const lang = state.settings.language;
    const stock = state.foodInventory[foodId] ?? 0;

    if (stock <= 0) {
      soundManager.playSoftChime(280);
      state.showToast(
        lang === 'th'
          ? 'อาหารชนิดนี้หมดแล้ว! ไปซื้อเพิ่มที่ร้านค้า หรือเล่นมินิเกมฟรีเพื่อหาเหรียญนะ'
          : 'Out of stock! Buy more in the Shop or play free Minigames to earn Coins.',
        'warn'
      );
      return;
    }

    const res = performFeedAction(state.cat, state.room, foodId);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);

    if (!res.success) {
      set({ cat: res.cat });
      state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warn');
      return;
    }

    // Consume 1 unit of food from inventory
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
      coins: state.coins + res.coinsEarned + ach.bonusCoins + (lvl.leveledUp ? 30 : 0),
      dailyTasks: nextTasks,
      achievements: ach.achievements,
      stats: nextStats,
      particleCue: { type: 'heart', seq: state.particleCue.seq + 1 }
    });

    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
    scheduleAutoSave(get, set);
  },

  giveWater: () => {
    const state = get();
    const res = performWaterAction(state.cat, state.room);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);

    const waterBowl = state.placedFurniture.find((f) => f.catalogId === 'water_bowl_ceramic');
    const metrics = computeGrowthMetrics(res.cat.identity.breed, res.cat.ageDays);
    if (waterBowl && metrics.canWalk) {
      res.cat.targetPosition = getInteractionPointForFurniture(waterBowl, res.cat.position);
      res.cat.targetFurnitureId = waterBowl.instanceId;
    }

    const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
    res.cat.level = lvl.level;
    res.cat.xp = lvl.xp;

    set({
      cat: res.cat,
      room: res.room,
      coins: state.coins + res.coinsEarned,
      particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
    });

    const lang = state.settings.language;
    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
    scheduleAutoSave(get, set);
  },

  petCat: () => {
    const state = get();
    const res = performPetAction(state.cat, state.room);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);
    const lang = state.settings.language;

    if (!res.success) {
      set({ cat: res.cat });
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
      coins: state.coins + res.coinsEarned + ach.bonusCoins,
      dailyTasks: nextTasks,
      achievements: ach.achievements,
      stats: nextStats,
      particleCue: { type: 'heart', seq: state.particleCue.seq + 1 }
    });

    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
    scheduleAutoSave(get, set);
  },

  respectCatSpace: () => {
    const state = get();
    const res = performRespectSpaceAction(state.cat, state.room);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);
    const lang = state.settings.language;

    const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
    res.cat.level = lvl.level;
    res.cat.xp = lvl.xp;

    set({
      cat: res.cat,
      coins: state.coins + res.coinsEarned,
      dailyTasks: incrementDailyTask(state.dailyTasks, 'bond'),
      particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
    });

    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
    scheduleAutoSave(get, set);
  },

  brushCat: () => {
    const state = get();
    const res = performBrushAction(state.cat, state.room);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);
    const lang = state.settings.language;

    if (!res.success) {
      state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warn');
      return;
    }

    const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
    res.cat.level = lvl.level;
    res.cat.xp = lvl.xp;

    set({
      cat: res.cat,
      coins: state.coins + res.coinsEarned,
      dailyTasks: incrementDailyTask(state.dailyTasks, 'bond'),
      particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
    });

    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
    scheduleAutoSave(get, set);
  },

  tuckCatToSleep: () => {
    const state = get();
    const res = performSleepAction(state.cat, state.room);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);
    const lang = state.settings.language;

    if (!res.success) {
      state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
      return;
    }

    const bed = state.placedFurniture.find((f) => getCatalogItem(f.catalogId)?.category === 'bed');
    if (bed) {
      res.cat.targetPosition = { x: bed.x, z: bed.z };
      res.cat.targetFurnitureId = bed.instanceId;
    }

    const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
    res.cat.level = lvl.level;
    res.cat.xp = lvl.xp;

    set({
      cat: res.cat,
      coins: state.coins + res.coinsEarned,
      particleCue: { type: 'zzz', seq: state.particleCue.seq + 1 }
    });

    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'warm');
    scheduleAutoSave(get, set);
  },

  cleanLitterBox: () => {
    const state = get();
    const res = performCleanLitterAction(state.cat, state.room);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);

    const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
    res.cat.level = lvl.level;
    res.cat.xp = lvl.xp;

    set({
      cat: res.cat,
      room: res.room,
      coins: state.coins + res.coinsEarned,
      dailyTasks: incrementDailyTask(state.dailyTasks, 'clean'),
      stats: { ...state.stats, totalCleans: state.stats.totalCleans + 1 },
      particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
    });

    const lang = state.settings.language;
    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
    scheduleAutoSave(get, set);
  },

  cleanLivingArea: () => {
    const state = get();
    const res = performCleanRoomAction(state.cat, state.room);
    soundManager.playVocalCue(res.vocalCue, state.cat.ageDays, true);

    const lvl = addXpAndCheckLevel(res.cat.level, res.cat.xp, res.xpEarned);
    res.cat.level = lvl.level;
    res.cat.xp = lvl.xp;

    set({
      cat: res.cat,
      room: res.room,
      coins: state.coins + res.coinsEarned,
      dailyTasks: incrementDailyTask(state.dailyTasks, 'clean'),
      stats: { ...state.stats, totalCleans: state.stats.totalCleans + 1 },
      particleCue: { type: 'sparkle', seq: state.particleCue.seq + 1 }
    });

    const lang = state.settings.language;
    state.showToast(lang === 'th' ? res.messageTh : res.messageEn, 'info');
    scheduleAutoSave(get, set);
  },

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
        const bond = addBondPoints(state.cat.bondLevel, state.cat.bondXp, 12);
        const nextTraits = evolvePersonality(state.cat.traits, 'play_session');
        const targetPt = getInteractionPointForFurniture(targetFurn, state.cat.position);
        const nextCat = {
          ...state.cat,
          traits: nextTraits,
          behavior: toy === 'scratching_post' ? ('play' as const) : ('hide' as const),
          behaviorTimer: 6.5,
          targetPosition: targetPt,
          targetFurnitureId: targetFurn.instanceId,
          bondLevel: bond.bondLevel,
          bondXp: bond.bondXp,
          needs: {
            ...state.cat.needs,
            happiness: clamp(state.cat.needs.happiness + 14, 0, 100),
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
          coins: state.coins + 8,
          particleCue: { type: 'music', seq: state.particleCue.seq + 1 }
        });
        soundManager.playVocalCue('play_chirp', state.cat.ageDays, true);
        state.showToast(
          lang === 'th'
            ? toy === 'scratching_post'
              ? `${state.cat.identity.name} วิ่งไปลับเล็บคลายเครียดอย่างสนุกสนาน!`
              : `${state.cat.identity.name} มุดเข้าไปซ่อนและเล่นในกล่องกระดาษ!`
            : toy === 'scratching_post'
              ? `${state.cat.identity.name} stretches up to scratch the sisal post!`
              : `${state.cat.identity.name} dives safely into the cardboard box!`,
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
    if (now - lastToyRewardTime < 2800) return;
    lastToyRewardTime = now;

    const state = get();
    const bond = addBondPoints(state.cat.bondLevel, state.cat.bondXp, 14);
    const lvl = addXpAndCheckLevel(state.cat.level, state.cat.xp, 12);
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
        calorieBuffer: state.cat.weight.calorieBuffer - 8 // Active play helps burn excess calories!
      }
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);

    set({
      cat: nextCat,
      coins: state.coins + 10,
      dailyTasks: incrementDailyTask(state.dailyTasks, 'play'),
      stats: { ...state.stats, totalPlays: state.stats.totalPlays + 1 },
      particleCue: { type: 'music', seq: state.particleCue.seq + 1 }
    });
    soundManager.playVocalCue('play_chirp', state.cat.ageDays, true);
    scheduleAutoSave(get, set);
  },

  openMinigame: (id) =>
    set({
      activeMinigame: id,
      drawerOpen: false,
      activeToy: null,
      decorateMode: false
    }),

  completeMinigame: (_id, coinsEarned, score) => {
    const state = get();
    const safeCoins = Math.max(0, Math.round(coinsEarned));
    const lvl = addXpAndCheckLevel(state.cat.level, state.cat.xp, 15);
    set({
      activeMinigame: null,
      coins: state.coins + safeCoins,
      cat: { ...state.cat, level: lvl.level, xp: lvl.xp },
      stats: { ...state.stats, minigamesCompleted: state.stats.minigamesCompleted + 1 }
    });
    soundManager.playSoftChime(840);
    const lang = state.settings.language;
    state.showToast(
      lang === 'th'
        ? `🎉 จบมินิเกม! คะแนน ${score} รับ +${safeCoins} เหรียญ`
        : `🎉 Minigame complete! Score ${score} → +${safeCoins} Coins`,
      'celebrate'
    );
    scheduleAutoSave(get, set);
  },

  buyFood: (foodId) => {
    if (!canPurchaseNow()) return;
    const state = get();
    const lang = state.settings.language;
    const item = FOOD_CATALOG.find((f) => f.id === foodId);
    if (!item) return;

    if (state.coins < item.priceCoins) {
      soundManager.playSoftChime(280);
      state.showToast(
        lang === 'th'
          ? 'เหรียญยังไม่พอ ลองเล่นมินิเกมฟรีเพื่อเก็บเหรียญนะ!'
          : 'Not enough Coins—play free Minigames to earn more!',
        'warn'
      );
      return;
    }

    const nextCount = (state.foodInventory[foodId] ?? 0) + item.packSize;
    set({
      coins: state.coins - item.priceCoins,
      foodInventory: { ...state.foodInventory, [foodId]: nextCount }
    });
    soundManager.playSoftChime(740);
    state.showToast(
      lang === 'th'
        ? `ซื้อ ${item.nameTh} +${item.packSize} มื้อแล้ว (คงเหลือ ${nextCount})`
        : `Bought ${item.nameEn} (+${item.packSize})! Stock: ${nextCount}`,
      'celebrate'
    );
    scheduleAutoSave(get, set);
  },

  buyAccessory: (accessoryId) => {
    if (!canPurchaseNow()) return;
    const state = get();
    const lang = state.settings.language;
    const item = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
    if (!item || state.ownedAccessories.includes(accessoryId)) return;

    if (state.coins < item.priceCoins) {
      soundManager.playSoftChime(280);
      state.showToast(lang === 'th' ? 'เหรียญยังไม่พอ' : 'Not enough Coins yet.', 'warn');
      return;
    }

    set({
      coins: state.coins - item.priceCoins,
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
    scheduleAutoSave(get, set);
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
    scheduleAutoSave(get, set);
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
    if (!canPurchaseNow()) return;
    const state = get();
    const lang = state.settings.language;
    const item = FURNITURE_CATALOG.find((i) => i.id === catalogId);
    if (!item) return;

    if (state.coins < item.priceCoins) {
      soundManager.playSoftChime(280);
      state.showToast(
        lang === 'th'
          ? 'เหรียญยังไม่พอ ลองเล่นมินิเกมฟรีเพื่อเก็บเหรียญนะ'
          : 'Not enough Coins—play free Minigames to earn more!',
        'warn'
      );
      return;
    }

    const nextCount = (state.ownedFurniture[catalogId] ?? 0) + 1;
    set({
      coins: state.coins - item.priceCoins,
      ownedFurniture: { ...state.ownedFurniture, [catalogId]: nextCount }
    });
    soundManager.playSoftChime(760);
    state.showToast(
      lang === 'th'
        ? `ซื้อ "${item.nameTh}" แล้ว! กด "วางในห้อง" เพื่อตกแต่งได้เลย`
        : `Purchased "${item.nameEn}"! Tap "Place" to decorate your room.`,
      'celebrate'
    );
    scheduleAutoSave(get, set);
  },

  buyToy: (toyId) => {
    if (!canPurchaseNow()) return;
    const state = get();
    const lang = state.settings.language;
    const toy = TOY_CATALOG.find((t) => t.id === toyId);
    if (!toy || state.ownedToys.includes(toyId)) return;

    if (state.coins < toy.priceCoins) {
      soundManager.playSoftChime(280);
      state.showToast(lang === 'th' ? 'เหรียญยังไม่พอ' : 'Not enough Coins yet.', 'warn');
      return;
    }

    set({
      coins: state.coins - toy.priceCoins,
      ownedToys: [...state.ownedToys, toyId]
    });
    soundManager.playSoftChime(760);
    state.showToast(
      lang === 'th' ? `ปลดล็อกของเล่น "${toy.nameTh}" แล้ว!` : `Unlocked "${toy.nameEn}"!`,
      'celebrate'
    );
    scheduleAutoSave(get, set);
  },

  claimDailyTask: (taskId) => {
    const state = get();
    const task = state.dailyTasks.find((t) => t.id === taskId);
    if (!task || task.claimed || task.progress < task.target) return;

    const lvl = addXpAndCheckLevel(state.cat.level, state.cat.xp, task.rewardXp);
    set({
      coins: state.coins + task.rewardCoins,
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
    scheduleAutoSave(get, set);
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

    set({
      photos: [entry, ...state.photos].slice(0, 20),
      dailyTasks: nextTasks,
      stats: nextStats,
      achievements: ach.achievements,
      coins: state.coins + 10 + ach.bonusCoins
    });

    const lang = state.settings.language;
    state.showToast(
      lang === 'th' ? 'บันทึกภาพลงอัลบั้มเรียบร้อยแล้ว! (+10 เหรียญ)' : 'Saved photo to album! (+10 Coins)',
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
    const def = getBreedDefinition(breed);
    const colors = resolveCoatHexColors(furColorId, furPattern);
    const eyeHex = EYE_COLOR_PALETTE[eyeColorId].hex;
    const bed = get().placedFurniture.find((f) => getCatalogItem(f.catalogId)?.category === 'bed');

    const identity: CatIdentity = {
      id: `cat_${Date.now()}`,
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
      adoptedAt: Date.now()
    };

    const traits = generateRandomPersonality();
    const weight = createInitialWeightState(breed, 2);
    const fresh = createInitialSaveData(breed, {
      hasAdoptedInitialCat: true,
      customIdentity: identity
    });

    const newCat: SaveDataV2['cat'] = {
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

    // Ensure starter milk formula is available when adopting a newborn
    const currentMilk = get().foodInventory.kitten_milk ?? 0;
    const nextFoodInventory = {
      ...get().foodInventory,
      kitten_milk: Math.max(currentMilk, 5)
    };

    set({
      hasAdoptedInitialCat: true,
      showAdoptFlow: false,
      showProfileModal: false,
      activeToy: null,
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
    scheduleAutoSave(get, set);
  },

  skipAgeDays: (days) => {
    const state = get();
    const nextAge = Math.max(0, state.cat.ageDays + days);
    const nextStage = getLifeStageForAge(nextAge);
    const nextMetrics = computeGrowthMetrics(state.cat.identity.breed, nextAge);
    const nextCat = {
      ...state.cat,
      ageDays: nextAge,
      lifeStage: nextStage,
      weight: {
        ...state.cat.weight,
        currentWeightKg: Number(
          (nextMetrics.idealWeightKg * (1 + state.cat.weight.bodyFatIndex * 0.28)).toFixed(2)
        )
      }
    };
    nextCat.emotion = evaluateCatEmotion(nextCat);

    const ach = evaluateAchievements({
      ...extractSavePayload(state),
      cat: nextCat
    });
    set({
      cat: nextCat,
      achievements: ach.achievements,
      coins: state.coins + ach.bonusCoins
    });
    const lang = state.settings.language;
    state.showToast(
      lang === 'th'
        ? `เร่งเวลา +${days} วัน (อายุตอนนี้ ${Math.floor(nextAge)} วัน)`
        : `Skipped +${days} days (now ${Math.floor(nextAge)} days old).`,
      'info'
    );
    scheduleAutoSave(get, set);
  }
}));
