import {
  createDefaultAchievements,
  createDefaultCatIdentity,
  createDefaultDailyTasks,
  createStarterFoodInventory,
  INITIAL_PLACED_FURNITURE
} from '../config/catalog';
import { evaluateCatEmotion } from '../simulation/emotions';
import { generateRandomPersonality } from '../simulation/personality';
import { createInitialWeightState } from '../simulation/weight';
import { CatBreed, CatIdentity, SaveDataV2 } from '../types/game';

export const SAVE_VERSION = 2 as const;
const DB_NAME = 'my_little_cat_db';
const DB_STORE = 'saves';
const SAVE_KEY = 'primary_slot_v2';
const LEGACY_SAVE_KEY = 'primary_slot_v1';
const LOCAL_STORAGE_KEY = 'my_little_cat_save_v2';
const LEGACY_LOCAL_KEY = 'my_little_cat_save_v1';

export function createInitialSaveData(
  breed: CatBreed = 'siamese',
  options?: {
    hasAdoptedInitialCat?: boolean;
    customIdentity?: CatIdentity;
    rng?: () => number;
  }
): SaveDataV2 {
  const identity = options?.customIdentity ?? createDefaultCatIdentity(breed);
  const bed = INITIAL_PLACED_FURNITURE.find((f) => f.catalogId === 'bed_plush');
  const traits = generateRandomPersonality(options?.rng);
  const weight = createInitialWeightState(identity.breed, 2, options?.rng);

  const cat: SaveDataV2['cat'] = {
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
    isPurring: false,
    mouthOpenAmount: 0,
    recentTouchCount: 0,
    recentTouchDecayTimer: 0,
    vocalizationCooldown: 3,
    moodRefusalCooldown: 0
  };
  cat.emotion = evaluateCatEmotion(cat);

  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
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
    coins: 90,
    gems: 10,
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
    lastDailyResetDay: Math.floor(Date.now() / 86400000),
    achievements: createDefaultAchievements(),
    photos: [],
    settings: {
      language: 'th',
      quality: 'medium',
      soundEnabled: true,
      timeScale: 1,
      followCat: true
    },
    stats: {
      totalFeeds: 0,
      totalPets: 0,
      totalPlays: 0,
      totalCleans: 0,
      totalPhotos: 0,
      knocksCaused: 0,
      minigamesCompleted: 0
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
 * Validates and migrates both v1 and v2 save payloads cleanly into SaveDataV2.
 */
export function validateAndMigrateSave(raw: unknown): SaveDataV2 | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.version !== 'number' || candidate.version > SAVE_VERSION) {
    return null;
  }

  const rawCat = candidate.cat as Record<string, unknown> | undefined;
  if (!rawCat || !rawCat.identity || !rawCat.needs) {
    return null;
  }

  const rawIdentity = rawCat.identity as Record<string, unknown>;
  const breed = mapLegacyBreed(rawIdentity.breed);
  const defaults = createInitialSaveData(breed, { hasAdoptedInitialCat: true });

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

  const mergedCat: SaveDataV2['cat'] = {
    ...defaults.cat,
    ...(rawCat as Partial<SaveDataV2['cat']>),
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
    weight: mergedWeight as SaveDataV2['cat']['weight'],
    position: {
      ...defaults.cat.position,
      ...((rawCat.position as Record<string, number>) ?? {})
    },
    velocity: { x: 0, z: 0 }
  };
  mergedCat.emotion = evaluateCatEmotion(mergedCat);

  const rawFoodInv = candidate.foodInventory as Partial<SaveDataV2['foodInventory']> | undefined;

  return {
    ...defaults,
    ...(candidate as Partial<SaveDataV2>),
    version: SAVE_VERSION,
    savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : Date.now(),
    hasAdoptedInitialCat:
      typeof candidate.hasAdoptedInitialCat === 'boolean'
        ? candidate.hasAdoptedInitialCat
        : true,
    cat: mergedCat,
    room: {
      ...defaults.room,
      ...((candidate.room as Partial<SaveDataV2['room']>) ?? {})
    },
    foodInventory: {
      ...defaults.foodInventory,
      ...(rawFoodInv ?? {})
    },
    ownedAccessories: Array.isArray(candidate.ownedAccessories)
      ? (candidate.ownedAccessories as SaveDataV2['ownedAccessories'])
      : defaults.ownedAccessories,
    settings: {
      ...defaults.settings,
      ...((candidate.settings as Partial<SaveDataV2['settings']>) ?? {})
    },
    stats: {
      ...defaults.stats,
      ...((candidate.stats as Partial<SaveDataV2['stats']>) ?? {})
    },
    placedFurniture:
      Array.isArray(candidate.placedFurniture) && candidate.placedFurniture.length > 0
        ? (candidate.placedFurniture as SaveDataV2['placedFurniture'])
        : defaults.placedFurniture,
    dailyTasks:
      Array.isArray(candidate.dailyTasks) && candidate.dailyTasks.length > 0
        ? (candidate.dailyTasks as SaveDataV2['dailyTasks'])
        : defaults.dailyTasks,
    achievements:
      Array.isArray(candidate.achievements) && candidate.achievements.length > 0
        ? (candidate.achievements as SaveDataV2['achievements'])
        : defaults.achievements,
    photos: Array.isArray(candidate.photos)
      ? (candidate.photos as SaveDataV2['photos']).slice(0, 24)
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

export async function saveGameData(data: SaveDataV2): Promise<boolean> {
  const payload: SaveDataV2 = {
    ...data,
    version: SAVE_VERSION,
    savedAt: Date.now()
  };

  let savedToAny = false;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
      savedToAny = true;
    } catch {
      try {
        const compact = { ...payload, photos: payload.photos.slice(0, 4) };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(compact));
        savedToAny = true;
      } catch {
        // Ignore quota failure; IndexedDB below handles larger payloads
      }
    }
  }

  const db = await openIndexedDB();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(payload, SAVE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      savedToAny = true;
    } catch {
      // fallback
    } finally {
      db.close();
    }
  }

  return savedToAny;
}

export async function loadGameData(): Promise<SaveDataV2 | null> {
  const db = await openIndexedDB();
  if (db) {
    try {
      const idbRaw = await new Promise<unknown>((resolve) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const req = store.get(SAVE_KEY);
        req.onsuccess = () => {
          if (req.result) {
            resolve(req.result);
          } else {
            const legacy = store.get(LEGACY_SAVE_KEY);
            legacy.onsuccess = () => resolve(legacy.result);
            legacy.onerror = () => resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
      db.close();
      const validated = validateAndMigrateSave(idbRaw);
      if (validated) return validated;
    } catch {
      db.close();
    }
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const str =
        localStorage.getItem(LOCAL_STORAGE_KEY) ?? localStorage.getItem(LEGACY_LOCAL_KEY);
      if (!str) return null;
      return validateAndMigrateSave(JSON.parse(str));
    } catch {
      return null;
    }
  }

  return null;
}

export async function clearSavedGame(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LEGACY_LOCAL_KEY);
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
        store.delete(LEGACY_SAVE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } finally {
      db.close();
    }
  }
}
