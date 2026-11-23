import { MinigameId, MinigamePerformanceTier } from '../types/game';

/**
 * Centralized Economy, Progression & Balance Configuration for Meowchi.
 * All prices, energy rates, minigame rewards, and cooldowns live here for clean tuning.
 */
export const ECONOMY_CONFIG = {
  // Real-time cat age progression: 1 real day = 1 in-game cat day
  REAL_SECONDS_PER_GAME_DAY: 86_400,
  GAME_TIME_SCALE: 1.0,

  // Human Player Energy System (used ONLY for minigames)
  PLAYER_ENERGY_START: 20,
  PLAYER_ENERGY_MAX: 20,
  MINIGAME_ENERGY_COST: 5,
  PLAYER_ENERGY_REGEN_MINUTES: 20,
  PLAYER_ENERGY_REGEN_MS: 20 * 60 * 1000, // 1,200,000 ms (+1 every 20 min = 72/24h max efficiency)

  // Minigame Session Rules
  MINIGAME_DURATION_SECONDS: 60,
  MINIGAME_REWARD_COINS: {
    low: 15,
    normal: 25,
    excellent: 35,
    exceptional: 45
  } as Record<MinigamePerformanceTier, number>,
  MINIGAME_MAX_REWARD_COINS: 45,

  // Starter Economy
  STARTER_COINS: 120,

  // Food Item Prices & Servings
  PRICES: {
    kitten_milk: { priceCoins: 20, packSize: 5 },
    kitten_wet: { priceCoins: 20, packSize: 1 },
    kitten_dry: { priceCoins: 30, packSize: 5 },
    adult_dry: { priceCoins: 30, packSize: 5 },
    adult_wet: { priceCoins: 20, packSize: 1 },
    premium_wet: { priceCoins: 35, packSize: 1 },
    cat_treat: { priceCoins: 25, packSize: 3 },

    // Advanced Automatic Cat-Care Equipment
    auto_water_fountain: 350,
    auto_food_feeder: 650,
    auto_litter_box: 900,
    smart_cat_bed: 400,
    auto_cat_toy: 500
  },

  // Care Action Cooldowns (milliseconds) to prevent spam & overlapping requests
  ACTION_COOLDOWNS_MS: {
    pet: 2600,
    feed: 2600,
    brush: 3200,
    water: 2600,
    pickup: 3500,
    play_toy: 2600,
    clean_litter: 3200,
    clean_room: 3200,
    respect_space: 3500,
    sleep: 3500,
    refill_fountain: 2800,
    clean_fountain: 3200,
    empty_auto_litter: 3200
  } as Record<string, number>,

  // Balanced Survival & Welfare Thresholds (never instant/unfair)
  SURVIVAL: {
    DEFAULT_OFFLINE_GRACE_HOURS: 24,
    MILD_WARNING_THIRST: 42,
    MILD_WARNING_HUNGER: 38,
    ESCALATING_THIRST: 24,
    ESCALATING_HUNGER: 20,
    CRITICAL_HEALTH_THRESHOLD: 18,
    CRITICAL_HOURS_BEFORE_DEATH: 36, // Sustained critical neglect hours required after grace period
    NEWBORN_CRITICAL_HOURS_BEFORE_DEATH: 24
  },

  // Purchase debounce guard (ms)
  PURCHASE_DEBOUNCE_MS: 400,

  // Bite calm-down duration (ms)
  POST_BITE_CALM_DOWN_MS: 20_000,

  // Automatic Equipment Parameters
  EQUIPMENT: {
    AUTO_FEEDER_MAX_STORAGE: 10,
    AUTO_TOY_ACTIVE_SECONDS: 35,
    AUTO_TOY_COOLDOWN_SECONDS: 90,
    AUTO_LITTER_CLEAN_DELAY_SEC: 4,
    AUTO_LITTER_CLEAN_DURATION_SEC: 6,
    AUTO_LITTER_KITTEN_MIN_AGE_DAYS: 57
  }
} as const;

/**
 * Score thresholds per minigame mapping raw performance to balanced Coin tiers:
 * Low: 15 | Normal: 25 | Excellent: 35 | Exceptional: 45 (hard max).
 */
const MINIGAME_SCORE_THRESHOLDS: Record<
  MinigameId,
  { normal: number; excellent: number; exceptional: number }
> = {
  fishing: { normal: 90, excellent: 190, exceptional: 300 },
  matching: { normal: 120, excellent: 240, exceptional: 380 },
  toy_challenge: { normal: 100, excellent: 210, exceptional: 340 },
  delivery: { normal: 100, excellent: 200, exceptional: 320 },
  clean_room: { normal: 100, excellent: 200, exceptional: 320 }
};

export function evaluateMinigameReward(
  gameId: MinigameId,
  rawScore: number
): { tier: MinigamePerformanceTier; coins: number } {
  const score = Math.max(0, Math.floor(rawScore));
  const th = MINIGAME_SCORE_THRESHOLDS[gameId];

  let tier: MinigamePerformanceTier = 'low';
  if (score >= th.exceptional) tier = 'exceptional';
  else if (score >= th.excellent) tier = 'excellent';
  else if (score >= th.normal) tier = 'normal';

  const coins = Math.min(
    ECONOMY_CONFIG.MINIGAME_MAX_REWARD_COINS,
    ECONOMY_CONFIG.MINIGAME_REWARD_COINS[tier]
  );

  return { tier, coins };
}
