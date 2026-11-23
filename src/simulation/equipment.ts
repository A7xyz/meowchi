import { ECONOMY_CONFIG } from '../config/economy';
import {
  CatRuntimeState,
  EquipmentStateMap,
  FoodItemId,
  PlacedFurniture,
  RoomStatus
} from '../types/game';
import { clamp, isFoodSafeForAge } from './growth';

export function createInitialEquipmentState(nowUtc: number = Date.now()): EquipmentStateMap {
  return {
    waterFountain: {
      waterLevel: 100,
      cleanliness: 100,
      isFlowing: true
    },
    autoFeeder: {
      storedFoodId: 'adult_dry',
      storedServings: 0, // Must be loaded from player's foodInventory — never free food!
      maxStorage: ECONOMY_CONFIG.EQUIPMENT.AUTO_FEEDER_MAX_STORAGE,
      portionSize: 1,
      scheduleHours: 6,
      bowlServingsLevel: 0,
      lastDispensedAtUtc: nowUtc,
      dispensingAnimTimer: 0
    },
    autoLitterBox: {
      wasteLevel: 0,
      litterCleanliness: 100,
      catInside: false,
      needsCleaning: false,
      cleaningProgress: 0,
      isCleaning: false,
      kittenSafeLock: false,
      pendingCleanDelaySec: 0
    },
    smartCatBed: {
      warmthLevel: 2,
      occupied: false
    },
    autoCatToy: {
      enabled: false,
      activeSecondsRemaining: 0,
      cooldownSecondsRemaining: 0,
      armAngle: 0
    }
  };
}

export function hasPlacedEquipment(
  placedFurniture: PlacedFurniture[],
  catalogId: string
): PlacedFurniture | undefined {
  return placedFurniture.find((f) => f.catalogId === catalogId);
}

/**
 * Loads food servings from the player's foodInventory into the Automatic Food Feeder hopper.
 * Strictly deducts from foodInventory so the feeder can NEVER generate unlimited free food.
 */
export function loadAutoFeederFromInventory(
  equipment: EquipmentStateMap,
  foodInventory: Record<FoodItemId, number>,
  foodId: FoodItemId,
  servingsRequested: number
): {
  success: boolean;
  loadedServings: number;
  equipment: EquipmentStateMap;
  foodInventory: Record<FoodItemId, number>;
  reason?: 'empty_inventory' | 'hopper_full' | 'incompatible_food';
} {
  // Dry or wet servings can be stored (milk formula cannot be stored in dry/auto hopper)
  if (foodId === 'kitten_milk') {
    return {
      success: false,
      loadedServings: 0,
      equipment,
      foodInventory,
      reason: 'incompatible_food'
    };
  }

  const available = Math.max(0, Math.floor(foodInventory[foodId] ?? 0));
  if (available <= 0) {
    return {
      success: false,
      loadedServings: 0,
      equipment,
      foodInventory,
      reason: 'empty_inventory'
    };
  }

  const feeder = equipment.autoFeeder;
  const freeSpace = Math.max(0, feeder.maxStorage - feeder.storedServings);
  if (freeSpace <= 0) {
    return {
      success: false,
      loadedServings: 0,
      equipment,
      foodInventory,
      reason: 'hopper_full'
    };
  }

  const toLoad = Math.min(available, freeSpace, Math.max(1, Math.floor(servingsRequested)));
  if (toLoad <= 0) {
    return {
      success: false,
      loadedServings: 0,
      equipment,
      foodInventory,
      reason: 'hopper_full'
    };
  }

  return {
    success: true,
    loadedServings: toLoad,
    equipment: {
      ...equipment,
      autoFeeder: {
        ...feeder,
        storedFoodId: foodId,
        storedServings: feeder.storedServings + toLoad
      }
    },
    foodInventory: {
      ...foodInventory,
      [foodId]: available - toLoad
    }
  };
}

/**
 * Dispenses a portion from the Automatic Food Feeder hopper into its tray.
 * Only works if hopper has stored food and food is safe for cat's current age.
 */
export function dispenseFromAutoFeeder(
  equipment: EquipmentStateMap,
  catAgeDays: number,
  nowUtc: number = Date.now()
): {
  dispensed: boolean;
  servingsUsed: number;
  equipment: EquipmentStateMap;
  reason?: 'no_food_stored' | 'age_unsafe' | 'bowl_already_full';
} {
  const feeder = equipment.autoFeeder;
  if (feeder.storedServings <= 0) {
    return { dispensed: false, servingsUsed: 0, equipment, reason: 'no_food_stored' };
  }
  if (feeder.bowlServingsLevel >= 85) {
    return { dispensed: false, servingsUsed: 0, equipment, reason: 'bowl_already_full' };
  }
  const safety = isFoodSafeForAge(feeder.storedFoodId, catAgeDays);
  if (!safety.allowed) {
    return { dispensed: false, servingsUsed: 0, equipment, reason: 'age_unsafe' };
  }

  const servingsUsed = Math.min(feeder.portionSize, feeder.storedServings);
  const trayGain = servingsUsed * 50;

  return {
    dispensed: true,
    servingsUsed,
    equipment: {
      ...equipment,
      autoFeeder: {
        ...feeder,
        storedServings: feeder.storedServings - servingsUsed,
        bowlServingsLevel: clamp(feeder.bowlServingsLevel + trayGain, 0, 100),
        lastDispensedAtUtc: nowUtc,
        dispensingAnimTimer: 2.5
      }
    }
  };
}

/**
 * Live per-frame simulation for all placed automatic equipment.
 * Strictly enforces safety rules (e.g., auto litter box NEVER cleans while cat is inside!).
 */
export function stepEquipmentSimulation(
  equipment: EquipmentStateMap,
  cat: CatRuntimeState,
  room: RoomStatus,
  placedFurniture: PlacedFurniture[],
  dtSeconds: number,
  nowUtc: number = Date.now()
): {
  equipment: EquipmentStateMap;
  room: RoomStatus;
  events: ('feeder_dispensed' | 'litter_clean_started' | 'litter_clean_done' | 'auto_toy_stopped')[];
} {
  const dt = clamp(dtSeconds, 0, 0.2);
  const events: ('feeder_dispensed' | 'litter_clean_started' | 'litter_clean_done' | 'auto_toy_stopped')[] = [];

  const next: EquipmentStateMap = {
    waterFountain: { ...equipment.waterFountain },
    autoFeeder: { ...equipment.autoFeeder },
    autoLitterBox: { ...equipment.autoLitterBox },
    smartCatBed: { ...equipment.smartCatBed },
    autoCatToy: { ...equipment.autoCatToy }
  };
  const nextRoom = { ...room };

  // 1. Cat Water Fountain
  const fountainFurn = hasPlacedEquipment(placedFurniture, 'auto_water_fountain');
  if (fountainFurn) {
    next.waterFountain.waterLevel = clamp(next.waterFountain.waterLevel - dt * 0.004, 0, 100);
    next.waterFountain.cleanliness = clamp(next.waterFountain.cleanliness - dt * 0.002, 10, 100);
    next.waterFountain.isFlowing = next.waterFountain.waterLevel > 5;
  }

  // 2. Automatic Food Feeder (scheduled dispense from stored servings only)
  const feederFurn = hasPlacedEquipment(placedFurniture, 'auto_food_feeder');
  if (feederFurn) {
    if (next.autoFeeder.dispensingAnimTimer > 0) {
      next.autoFeeder.dispensingAnimTimer = Math.max(0, next.autoFeeder.dispensingAnimTimer - dt);
    }
    const scheduleMs = next.autoFeeder.scheduleHours * 3600 * 1000;
    const due = nowUtc - next.autoFeeder.lastDispensedAtUtc >= scheduleMs;
    if (due && next.autoFeeder.storedServings > 0 && next.autoFeeder.bowlServingsLevel < 40) {
      const disp = dispenseFromAutoFeeder(next, cat.ageDays, nowUtc);
      if (disp.dispensed) {
        next.autoFeeder = disp.equipment.autoFeeder;
        events.push('feeder_dispensed');
      }
    }
  }

  // 3. Automatic Litter Box — SAFETY FIRST: never operates while cat is inside or kitten-locked!
  const litterFurn = hasPlacedEquipment(placedFurniture, 'auto_litter_box');
  if (litterFurn) {
    const distToLitter = Math.hypot(cat.position.x - litterFurn.x, cat.position.z - litterFurn.z);
    const catInside = distToLitter < 0.44 || (cat.behavior === 'use_litter' && cat.targetFurnitureId === litterFurn.instanceId);
    const isKitten = cat.ageDays < ECONOMY_CONFIG.EQUIPMENT.AUTO_LITTER_KITTEN_MIN_AGE_DAYS;

    next.autoLitterBox.catInside = catInside;
    next.autoLitterBox.kittenSafeLock = isKitten;

    if (catInside) {
      // Immediately pause/abort any cleaning rotation if cat enters or approaches closely!
      next.autoLitterBox.isCleaning = false;
      next.autoLitterBox.cleaningProgress = 0;
      next.autoLitterBox.pendingCleanDelaySec = ECONOMY_CONFIG.EQUIPMENT.AUTO_LITTER_CLEAN_DELAY_SEC;
    } else if (next.autoLitterBox.isCleaning) {
      const cleanSpeed = 1 / ECONOMY_CONFIG.EQUIPMENT.AUTO_LITTER_CLEAN_DURATION_SEC;
      next.autoLitterBox.cleaningProgress = clamp(
        next.autoLitterBox.cleaningProgress + dt * cleanSpeed,
        0,
        1
      );
      if (next.autoLitterBox.cleaningProgress >= 1) {
        next.autoLitterBox.isCleaning = false;
        next.autoLitterBox.cleaningProgress = 0;
        next.autoLitterBox.needsCleaning = false;
        next.autoLitterBox.litterCleanliness = 100;
        next.autoLitterBox.wasteLevel = clamp(next.autoLitterBox.wasteLevel + 18, 0, 100);
        nextRoom.litterCleanliness = 100;
        events.push('litter_clean_done');
      }
    } else if (
      next.autoLitterBox.needsCleaning &&
      !isKitten &&
      next.autoLitterBox.wasteLevel < 95
    ) {
      next.autoLitterBox.pendingCleanDelaySec = Math.max(
        0,
        next.autoLitterBox.pendingCleanDelaySec - dt
      );
      if (next.autoLitterBox.pendingCleanDelaySec <= 0) {
        next.autoLitterBox.isCleaning = true;
        next.autoLitterBox.cleaningProgress = 0;
        events.push('litter_clean_started');
      }
    }
  }

  // 4. Smart Cat Bed occupancy
  const smartBed = hasPlacedEquipment(placedFurniture, 'smart_cat_bed');
  if (smartBed) {
    const distToBed = Math.hypot(cat.position.x - smartBed.x, cat.position.z - smartBed.z);
    next.smartCatBed.occupied = distToBed < 0.42 && cat.behavior === 'sleep';
  }

  // 5. Automatic Cat Toy rotation & cooldowns
  const autoToy = hasPlacedEquipment(placedFurniture, 'auto_cat_toy');
  if (autoToy) {
    if (next.autoCatToy.enabled && next.autoCatToy.activeSecondsRemaining > 0) {
      next.autoCatToy.activeSecondsRemaining = Math.max(
        0,
        next.autoCatToy.activeSecondsRemaining - dt
      );
      next.autoCatToy.armAngle = (next.autoCatToy.armAngle + dt * 2.4) % (Math.PI * 2);
      if (next.autoCatToy.activeSecondsRemaining <= 0) {
        next.autoCatToy.enabled = false;
        next.autoCatToy.cooldownSecondsRemaining =
          ECONOMY_CONFIG.EQUIPMENT.AUTO_TOY_COOLDOWN_SECONDS;
        events.push('auto_toy_stopped');
      }
    } else if (next.autoCatToy.cooldownSecondsRemaining > 0) {
      next.autoCatToy.cooldownSecondsRemaining = Math.max(
        0,
        next.autoCatToy.cooldownSecondsRemaining - dt
      );
    }
  }

  return { equipment: next, room: nextRoom, events };
}

/**
 * Offline equipment catch-up:
 * - Water fountain hydrates cat while water remains (drains water level)
 * - Auto feeder dispenses scheduled meals strictly from stored hopper servings
 * - Auto litter box cleans safely if adult cat and waste drawer has capacity
 * - Auto toy cooldown expires naturally
 */
export function applyOfflineEquipmentSimulation(
  equipment: EquipmentStateMap,
  cat: CatRuntimeState,
  room: RoomStatus,
  placedFurniture: PlacedFurniture[],
  elapsedSeconds: number,
  nowUtc: number = Date.now()
): { equipment: EquipmentStateMap; cat: CatRuntimeState; room: RoomStatus } {
  const cappedHours = clamp(elapsedSeconds / 3600, 0, 24);
  if (cappedHours < 0.05) return { equipment, cat, room };

  const nextEquip: EquipmentStateMap = {
    waterFountain: { ...equipment.waterFountain },
    autoFeeder: { ...equipment.autoFeeder },
    autoLitterBox: { ...equipment.autoLitterBox },
    smartCatBed: { ...equipment.smartCatBed },
    autoCatToy: { ...equipment.autoCatToy }
  };
  const nextNeeds = { ...cat.needs };
  const nextRoom = { ...room };

  // Water fountain offline hydration
  if (hasPlacedEquipment(placedFurniture, 'auto_water_fountain')) {
    if (nextEquip.waterFountain.waterLevel > 10) {
      const drain = Math.min(nextEquip.waterFountain.waterLevel, cappedHours * 3.8);
      nextEquip.waterFountain.waterLevel = clamp(nextEquip.waterFountain.waterLevel - drain, 0, 100);
      nextEquip.waterFountain.cleanliness = clamp(
        nextEquip.waterFountain.cleanliness - cappedHours * 1.4,
        15,
        100
      );
      nextEquip.waterFountain.isFlowing = nextEquip.waterFountain.waterLevel > 5;
      nextNeeds.thirst = clamp(nextNeeds.thirst + drain * 0.9, 0, 100);
    }
  }

  // Automatic food feeder offline scheduled meals (strictly from storedServings!)
  if (hasPlacedEquipment(placedFurniture, 'auto_food_feeder')) {
    const scheduleHours = nextEquip.autoFeeder.scheduleHours;
    const dueCycles = Math.floor(cappedHours / scheduleHours);
    const safety = isFoodSafeForAge(nextEquip.autoFeeder.storedFoodId, cat.ageDays);

    if (dueCycles > 0 && safety.allowed && nextEquip.autoFeeder.storedServings > 0) {
      let mealsServed = 0;
      for (let i = 0; i < dueCycles; i++) {
        if (nextEquip.autoFeeder.storedServings <= 0) break;
        const used = Math.min(
          nextEquip.autoFeeder.portionSize,
          nextEquip.autoFeeder.storedServings
        );
        nextEquip.autoFeeder.storedServings -= used;
        mealsServed += used;
      }
      if (mealsServed > 0) {
        nextEquip.autoFeeder.lastDispensedAtUtc = nowUtc;
        nextNeeds.hunger = clamp(nextNeeds.hunger + mealsServed * 26, 0, 100);
        nextEquip.autoFeeder.bowlServingsLevel = clamp(
          nextEquip.autoFeeder.bowlServingsLevel + 25,
          0,
          100
        );
      }
    }
  }

  // Automatic litter box offline cleaning (adult/adolescent only, respects waste capacity)
  if (hasPlacedEquipment(placedFurniture, 'auto_litter_box')) {
    const isKitten = cat.ageDays < ECONOMY_CONFIG.EQUIPMENT.AUTO_LITTER_KITTEN_MIN_AGE_DAYS;
    nextEquip.autoLitterBox.catInside = false;
    nextEquip.autoLitterBox.isCleaning = false;
    nextEquip.autoLitterBox.kittenSafeLock = isKitten;

    if (!isKitten && nextEquip.autoLitterBox.wasteLevel < 90) {
      const wasteAdded = Math.min(95 - nextEquip.autoLitterBox.wasteLevel, cappedHours * 3.5);
      nextEquip.autoLitterBox.wasteLevel = clamp(
        nextEquip.autoLitterBox.wasteLevel + wasteAdded,
        0,
        100
      );
      nextEquip.autoLitterBox.litterCleanliness = 94;
      nextRoom.litterCleanliness = Math.max(nextRoom.litterCleanliness, 92);
    }
  }

  // Smart cat bed comfort bonus offline
  if (hasPlacedEquipment(placedFurniture, 'smart_cat_bed')) {
    nextNeeds.energy = clamp(nextNeeds.energy + cappedHours * 6, 0, 100);
    nextNeeds.stress = clamp(nextNeeds.stress - cappedHours * 6, 0, 100);
    nextNeeds.happiness = clamp(nextNeeds.happiness + Math.min(12, cappedHours * 2), 0, 100);
  }

  // Automatic cat toy cooldown naturally clears offline
  nextEquip.autoCatToy.enabled = false;
  nextEquip.autoCatToy.activeSecondsRemaining = 0;
  nextEquip.autoCatToy.cooldownSecondsRemaining = Math.max(
    0,
    nextEquip.autoCatToy.cooldownSecondsRemaining - elapsedSeconds
  );

  return {
    equipment: nextEquip,
    cat: { ...cat, needs: nextNeeds },
    room: nextRoom
  };
}
