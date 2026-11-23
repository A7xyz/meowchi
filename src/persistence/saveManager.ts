import {
  createDefaultAchievements,
  createDefaultCatIdentity,
  createDefaultDailyTasks,
  createStarterFoodInventory,
  INITIAL_PLACED_FURNITURE
} from '../config/catalog';
import { ECONOMY_CONFIG } from '../config/economy';
import { evaluateCatEmotion } from '../simulation/emotions';
import { createInitialPlayerEnergy, reconcilePlayerEnergy } from '../simulation/energy';
import { createInitialEquipmentState } from '../simulation/equipment';
import { getUtcDayNumber } from '../simulation/economy';
import { generateRandomPersonality } from '../simulation/personality';
import { createInitialWeightState } from '../simulation/weight';
import { CatBreed, CatIdentity, SaveDataV3 } from '../types/game';

export const SAVE_VERSION = 3 as const;
const DB_NAME = 'my_little_cat_db';
const DB_STORE = 'saves';
const SAVE_KEY = 'primary_slot_v3';
const LEGACY_V2_KEY = 'primary_slot_v2';
const LEGACY_V1_KEY = 'primary_slot_v1';
const LOCAL_STORAGE_KEY = 'my_little_cat_save_v3';
const LEGACY_LOCAL_V2_KEY = 'my_little_cat_save_v2';
const LEGACY_LOCAL_V1_KEY = 'my_little_cat_save_v1';

export function createInitialSaveData(
  breed: CatBreed = 'siamese',
  options?: {
    hasAdoptedInitialCat?: boolean;
    customIdentity?: CatIdentity;
    rng?: () => number;
    nowUtc?: number;
  }
): SaveDataV3 {
  const nowUtc = options?.nowUtc ?? Date.now();
  const identity = options?.customIdentity ?? createDefaultCatIdentity(breed);
  const bed = INITIAL_PLACED_FURNITURE.find((f) => f.catalogId === 'bed_plush');
  const traits = generateRandomPersonality(options?.rng);
  const weight = createInitialWeightState(identity.breed, 2, options?.rng);

  const cat: SaveDataV3['cat'] = {
    identity,
    ageDays: 2,
    lifeStage: 'newborn',
    needs: {
      hunger: 72,
      thirst: 78,
      energy: 82,
      happiness: 76,
      hygiene: 88,
      health: 96,
      stress: 8
    },
    traits,
    emotion: 'sleepy',
    weight,
    bondLevel: 1,
    bondXp: 0,
    level: 1,
    xp: 0,
    behavior: 'sleep',
    behaviorTimer: 6,
    position: {
      x: bed ? bed.x : -1.45,
      y: 0.095,
      z: bed ? bed.z : 0.25
    },
    rotationY: 0.65,
    velocity: { x: 0, z: 0 },
    targetPosition: null,
    targetFurnitureId: bed ? bed.instanceId : null,
    jumpProgress: 0,
    jumpStartY: 0,
    jumpTargetY: 0,
    jumpPrepTimer: 0,
    jumpLandTimer: 0,
    zoomieWaypointsRemaining: 0,
    isPurring: false,
    mouthOpenAmount: 0,
    recentTouchCount: 0,
    recentTouchDecayTimer: 0,
    ignoredWarningsCount: 0,
    calmDownUntilUtc: 0,
    lastBiteAtUtc: 0,
    vocalizationCooldown: 3,
    moodRefusalCooldown: 0
  };
  cat.emotion = evaluateCatEmotion(cat);

  return {
    version: SAVE_VERSION,
    savedAt: nowUtc,
    lastGrowthSyncAtUtc: nowUtc,
    hasAdoptedInitialCat: options?.hasAdoptedInitialCat ?? false,
    cat,
    room: {
      foodBowlLevel: 40,
      foodBowlItemId: 'kitten_milk',
      waterBowlLevel: 75,
      litterCleanliness: 92,
      roomCleanliness: 95,
      tableMugKnocked: false
    },
    equipment: createInitialEquipmentState(nowUtc),
    coins: ECONOMY_CONFIG.STARTER_COINS,
    gems: 10,
    playerEnergy: createInitialPlayerEnergy(nowUtc),
    claimedRewardIds: [],
    actionCooldowns: {},
    minigameHistory: [],
    foodInventory: createStarterFoodInventory(),
    ownedAccessories: ['none'],
    ownedFurniture: {
      bed_plush: 1,
      food_bowl_ceramic: 1,
      water_bowl_ceramic: 1,
      litter_box_cozy: 1,
      scratching_post_sisal: 1,
      cardboard_box: 1,
      rug_linen: 1,
      sofa_linen: 1,
      table_oak: 1
    },
    ownedToys: ['feather_wand', 'ball', 'scratching_post', 'cardboard_box'],
    placedFurniture: INITIAL_PLACED_FURNITURE.map((f) => ({ ...f })),
    dailyTasks: createDefaultDailyTasks(),
    lastDailyResetDay: getUtcDayNumber(nowUtc),
    achievements: createDefaultAchievements(),
    photos: [],
    settings: {
      language: 'th',
      quality: 'medium',
      soundEnabled: true,
      followCat: true,
      reduceBiteVisuals: false
    },
    stats: {
      totalFeeds: 0,
      totalPets: 0,
      totalPlays: 0,
      totalCleans: 0,
      totalPhotos: 0,
      knocksCaused: 0,
      minigamesCompleted: 0,
      defensiveBites: 0
    }
  };
}

function mapLegacyBreed(rawBreed: unknown): CatBreed {
  const valid: CatBreed[] = [
    'persian',
    'british_shorthair',
    'scottish_straight',
    'maine_coon',
    'ragdoll',
    'siamese',
    'american_shorthair',
    'bengal',
    'munchkin',
    'thai_mixed'
  ];
  if (typeof rawBreed === 'string' && (valid as string[]).includes(rawBreed)) {
    return rawBreed as CatBreed;
  }
  if (rawBreed === 'wichienmaat') return 'siamese';
  if (rawBreed === 'korat') return 'british_shorthair';
  if (rawBreed === 'ginger_shorthair') return 'american_shorthair';
  if (rawBreed === 'calico_domestic') return 'thai_mixed';
  return 'siamese';
}

/**
 * Validates and migrates V1, V2, and V3 save payloads cleanly into SaveDataV3.
 * Preserves existing player progress, cat identity, breed, personality, coins, and inventory.
 */
export function validateAndMigrateSave(raw: unknown, nowUtc: number = Date.now()): SaveDataV3 | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.version !== 'number' || candidate.version > SAVE_VERSION || candidate.version < 1) {
    return null;
  }

  const rawCat = candidate.cat as Record<string, unknown> | undefined;
  if (!rawCat || !rawCat.identity || !rawCat.needs) {
    return null;
  }

  const rawIdentity = rawCat.identity as Record<string, unknown>;
  const breed = mapLegacyBreed(rawIdentity.breed);
  const savedAt = typeof candidate.savedAt === 'number' ? candidate.savedAt : nowUtc;
  const defaults = createInitialSaveData(breed, { hasAdoptedInitialCat: true, nowUtc: savedAt });

  const mergedNeeds = {
    ...defaults.cat.needs,
    ...(rawCat.needs as Record<string, number>)
  };

  const mergedTraits =
    rawCat.traits && typeof rawCat.traits === 'object'
      ? { ...defaults.cat.traits, ...(rawCat.traits as Record<string, number>) }
      : defaults.cat.traits;

  const mergedWeight =
    rawCat.weight && typeof rawCat.weight === 'object'
      ? { ...defaults.cat.weight, ...(rawCat.weight as Record<string, unknown>) }
      : createInitialWeightState(
          breed,
          typeof rawCat.ageDays === 'number' ? rawCat.ageDays : 2
        );

  const mergedCat: SaveDataV3['cat'] = {
    ...defaults.cat,
    ...(rawCat as Partial<SaveDataV3['cat']>),
    identity: {
      ...defaults.cat.identity,
      ...(rawIdentity as Partial<CatIdentity>),
      breed,
      furPattern:
        rawIdentity.furPattern === 'pointed'
          ? 'colorpoint'
          : rawIdentity.furPattern === 'tuxedo'
            ? 'bicolor'
            : ((rawIdentity.furPattern as CatIdentity['furPattern']) ?? defaults.cat.identity.furPattern)
    },
    needs: mergedNeeds,
    traits: mergedTraits,
    weight: mergedWeight as SaveDataV3['cat']['weight'],
    position: {
      ...defaults.cat.position,
      ...((rawCat.position as Record<string, number>) ?? {})
    },
    velocity: { x: 0, z: 0 },
    jumpPrepTimer: typeof rawCat.jumpPrepTimer === 'number' ? rawCat.jumpPrepTimer : 0,
    jumpLandTimer: typeof rawCat.jumpLandTimer === 'number' ? rawCat.jumpLandTimer : 0,
    zoomieWaypointsRemaining:
      typeof rawCat.zoomieWaypointsRemaining === 'number' ? rawCat.zoomieWaypointsRemaining : 0,
    ignoredWarningsCount:
      typeof rawCat.ignoredWarningsCount === 'number' ? rawCat.ignoredWarningsCount : 0,
    calmDownUntilUtc:
      typeof rawCat.calmDownUntilUtc === 'number' ? rawCat.calmDownUntilUtc : 0,
    lastBiteAtUtc: typeof rawCat.lastBiteAtUtc === 'number' ? rawCat.lastBiteAtUtc : 0
  };
  mergedCat.emotion = evaluateCatEmotion(mergedCat);

  const rawFoodInv = candidate.foodInventory as Partial<SaveDataV3['foodInventory']> | undefined;
  const rawEquip = candidate.equipment as Partial<SaveDataV3['equipment']> | undefined;
  const rawEnergy = candidate.playerEnergy as Partial<SaveDataV3['playerEnergy']> | undefined;
  const rawSettings = candidate.settings as Record<string, unknown> | undefined;

  const migratedEnergy = rawEnergy && typeof rawEnergy.current === 'number'
    ? reconcilePlayerEnergy(
        {
          current: rawEnergy.current,
          max: ECONOMY_CONFIG.PLAYER_ENERGY_MAX,
          lastRegenAtUtc:
            typeof rawEnergy.lastRegenAtUtc === 'number' ? rawEnergy.lastRegenAtUtc : savedAt,
          lastSeenUtc:
            typeof rawEnergy.lastSeenUtc === 'number' ? rawEnergy.lastSeenUtc : savedAt
        },
        nowUtc
      ).energy
    : createInitialPlayerEnergy(nowUtc);

  const migratedSettings: SaveDataV3['settings'] = {
    language: rawSettings?.language === 'en' ? 'en' : 'th',
    quality:
      rawSettings?.quality === 'low' || rawSettings?.quality === 'high'
        ? rawSettings.quality
        : 'medium',
    soundEnabled:
      typeof rawSettings?.soundEnabled === 'boolean' ? rawSettings.soundEnabled : true,
    followCat: typeof rawSettings?.followCat === 'boolean' ? rawSettings.followCat : true,
    reduceBiteVisuals:
      typeof rawSettings?.reduceBiteVisuals === 'boolean' ? rawSettings.reduceBiteVisuals : false
  };

  // Preserve previously unlocked achievement claim IDs so upgrading never re-awards them
  const rawAchievements = Array.isArray(candidate.achievements) && candidate.achievements.length > 0
    ? (candidate.achievements as SaveDataV3['achievements'])
    : defaults.achievements;
  const rawClaimedIds = Array.isArray(candidate.claimedRewardIds)
    ? (candidate.claimedRewardIds as string[]).filter((s) => typeof s === 'string')
    : [];
  const mergedClaimIds = new Set(rawClaimedIds);
  for (const a of rawAchievements) {
    if (a.unlocked) mergedClaimIds.add(`ach_${a.id}`);
  }
  const rawDailyTasks = Array.isArray(candidate.dailyTasks) && candidate.dailyTasks.length > 0
    ? (candidate.dailyTasks as SaveDataV3['dailyTasks'])
    : defaults.dailyTasks;
  const lastDailyResetDay =
    typeof candidate.lastDailyResetDay === 'number'
      ? candidate.lastDailyResetDay
      : getUtcDayNumber(savedAt);
  for (const t of rawDailyTasks) {
    if (t.claimed) mergedClaimIds.add(`daily_${lastDailyResetDay}_${t.id}`);
  }

  return {
    ...defaults,
    ...(candidate as Partial<SaveDataV3>),
    version: SAVE_VERSION,
    savedAt,
    lastGrowthSyncAtUtc:
      typeof candidate.lastGrowthSyncAtUtc === 'number' ? candidate.lastGrowthSyncAtUtc : savedAt,
    hasAdoptedInitialCat:
      typeof candidate.hasAdoptedInitialCat === 'boolean'
        ? candidate.hasAdoptedInitialCat
        : true,
    cat: mergedCat,
    room: {
      ...defaults.room,
      ...((candidate.room as Partial<SaveDataV3['room']>) ?? {})
    },
    equipment: {
      waterFountain: {
        ...defaults.equipment.waterFountain,
        ...(rawEquip?.waterFountain ?? {})
      },
      autoFeeder: {
        ...defaults.equipment.autoFeeder,
        ...(rawEquip?.autoFeeder ?? {})
      },
      autoLitterBox: {
        ...defaults.equipment.autoLitterBox,
        ...(rawEquip?.autoLitterBox ?? {})
      },
      smartCatBed: {
        ...defaults.equipment.smartCatBed,
        ...(rawEquip?.smartCatBed ?? {})
      },
      autoCatToy: {
        ...defaults.equipment.autoCatToy,
        ...(rawEquip?.autoCatToy ?? {})
      }
    },
    coins: typeof candidate.coins === 'number' && Number.isFinite(candidate.coins)
      ? Math.max(0, Math.floor(candidate.coins))
      : defaults.coins,
    playerEnergy: migratedEnergy,
    claimedRewardIds: Array.from(mergedClaimIds),
    actionCooldowns:
      candidate.actionCooldowns && typeof candidate.actionCooldowns === 'object'
        ? (candidate.actionCooldowns as Record<string, number>)
        : {},
    minigameHistory: Array.isArray(candidate.minigameHistory)
      ? (candidate.minigameHistory as SaveDataV3['minigameHistory']).slice(0, 50)
      : [],
    foodInventory: {
      ...defaults.foodInventory,
      ...(rawFoodInv ?? {})
    },
    ownedAccessories: Array.isArray(candidate.ownedAccessories)
      ? (candidate.ownedAccessories as SaveDataV3['ownedAccessories'])
      : defaults.ownedAccessories,
    ownedFurniture: {
      ...defaults.ownedFurniture,
      ...((candidate.ownedFurniture as Record<string, number>) ?? {})
    },
    ownedToys: Array.isArray(candidate.ownedToys)
      ? (candidate.ownedToys as SaveDataV3['ownedToys'])
      : defaults.ownedToys,
    settings: migratedSettings,
    stats: {
      ...defaults.stats,
      ...((candidate.stats as Partial<SaveDataV3['stats']>) ?? {})
    },
    placedFurniture:
      Array.isArray(candidate.placedFurniture) && candidate.placedFurniture.length > 0
        ? (candidate.placedFurniture as SaveDataV3['placedFurniture'])
        : defaults.placedFurniture,
    dailyTasks: rawDailyTasks,
    lastDailyResetDay,
    achievements: rawAchievements,
    photos: Array.isArray(candidate.photos)
      ? (candidate.photos as SaveDataV3['photos']).slice(0, 24)
      : []
  };
}

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let writeQueue: Promise<boolean> = Promise.resolve(true);

/**
 * Atomic serialized persistence to both localStorage (synchronous) and IndexedDB.
 * Serializing prevents race conditions or half-written state on rapid refreshes.
 */
export function saveGameData(data: SaveDataV3): Promise<boolean> {
  const payload: SaveDataV3 = {
    ...data,
    version: SAVE_VERSION,
    savedAt: Date.now()
  };

  // Synchronous localStorage commit immediately so page reloads never lose latest energy/claims
  let savedSync = false;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
      savedSync = true;
    } catch {
      try {
        const compact = { ...payload, photos: payload.photos.slice(0, 4) };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(compact));
        savedSync = true;
      } catch {
        // Ignore quota failure; IndexedDB below handles larger payloads
      }
    }
  }

  writeQueue = writeQueue.then(async () => {
    let savedIdb = false;
    const db = await openIndexedDB();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(DB_STORE, 'readwrite');
          tx.objectStore(DB_STORE).put(payload, SAVE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        savedIdb = true;
      } catch {
        // fallback
      } finally {
        db.close();
      }
    }
    return savedSync || savedIdb;
  });

  return writeQueue;
}

export async function loadGameData(nowUtc: number = Date.now()): Promise<SaveDataV3 | null> {
  let idbCandidate: SaveDataV3 | null = null;
  let lsCandidate: SaveDataV3 | null = null;

  if (typeof localStorage !== 'undefined') {
    try {
      const str =
        localStorage.getItem(LOCAL_STORAGE_KEY) ??
        localStorage.getItem(LEGACY_LOCAL_V2_KEY) ??
        localStorage.getItem(LEGACY_LOCAL_V1_KEY);
      if (str) {
        lsCandidate = validateAndMigrateSave(JSON.parse(str), nowUtc);
      }
    } catch {
      lsCandidate = null;
    }
  }

  const db = await openIndexedDB();
  if (db) {
    try {
      const idbRaw = await new Promise<unknown>((resolve) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const r3 = store.get(SAVE_KEY);
        r3.onsuccess = () => {
          if (r3.result) {
            resolve(r3.result);
            return;
          }
          const r2 = store.get(LEGACY_V2_KEY);
          r2.onsuccess = () => {
            if (r2.result) {
              resolve(r2.result);
              return;
            }
            const r1 = store.get(LEGACY_V1_KEY);
            r1.onsuccess = () => resolve(r1.result);
            r1.onerror = () => resolve(null);
          };
          r2.onerror = () => resolve(null);
        };
        r3.onerror = () => resolve(null);
      });
      db.close();
      idbCandidate = validateAndMigrateSave(idbRaw, nowUtc);
    } catch {
      db.close();
    }
  }

  // Pick whichever valid save has the newer savedAt timestamp (prevents stale IDB overwriting sync LS on quick reload)
  if (idbCandidate && lsCandidate) {
    return lsCandidate.savedAt >= idbCandidate.savedAt ? lsCandidate : idbCandidate;
  }
  return lsCandidate ?? idbCandidate;
}

export async function clearSavedGame(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LEGACY_LOCAL_V2_KEY);
      localStorage.removeItem(LEGACY_LOCAL_V1_KEY);
    } catch {
      // ignore
    }
  }

  const db = await openIndexedDB();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.delete(SAVE_KEY);
        store.delete(LEGACY_V2_KEY);
        store.delete(LEGACY_V1_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } finally {
      db.close();
    }
  }
}
