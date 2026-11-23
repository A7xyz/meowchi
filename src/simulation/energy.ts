import { ECONOMY_CONFIG } from '../config/economy';
import { PlayerEnergyState } from '../types/game';

export function createInitialPlayerEnergy(nowUtc: number = Date.now()): PlayerEnergyState {
  return {
    current: ECONOMY_CONFIG.PLAYER_ENERGY_START,
    max: ECONOMY_CONFIG.PLAYER_ENERGY_MAX,
    lastRegenAtUtc: nowUtc,
    lastSeenUtc: nowUtc
  };
}

/**
 * Reconciles player energy strictly from elapsed UTC time.
 * - +1 energy every 20 minutes (1,200,000 ms)
 * - Works while game is closed
 * - Never exceeds max (20)
 * - Never duplicates on repeated refreshes
 * - Guards against simple client clock rollback
 */
export function reconcilePlayerEnergy(
  energy: PlayerEnergyState,
  nowUtc: number = Date.now()
): { energy: PlayerEnergyState; gained: number } {
  const max = ECONOMY_CONFIG.PLAYER_ENERGY_MAX;
  const intervalMs = ECONOMY_CONFIG.PLAYER_ENERGY_REGEN_MS;
  const clampedCurrent = Math.max(0, Math.min(max, Math.floor(energy.current)));

  // Protect against client clock rollback (treat backwards jump as 0 elapsed)
  const effectiveNow = Math.max(nowUtc, energy.lastSeenUtc || 0);

  if (clampedCurrent >= max) {
    return {
      energy: {
        current: max,
        max,
        lastRegenAtUtc: effectiveNow,
        lastSeenUtc: effectiveNow
      },
      gained: 0
    };
  }

  const anchor = Math.min(energy.lastRegenAtUtc || effectiveNow, effectiveNow);
  const elapsedMs = Math.max(0, effectiveNow - anchor);
  const ticks = Math.floor(elapsedMs / intervalMs);

  if (ticks <= 0) {
    return {
      energy: {
        current: clampedCurrent,
        max,
        lastRegenAtUtc: anchor,
        lastSeenUtc: effectiveNow
      },
      gained: 0
    };
  }

  const nextCurrent = Math.min(max, clampedCurrent + ticks);
  const gained = nextCurrent - clampedCurrent;
  const nextLastRegenAtUtc =
    nextCurrent >= max ? effectiveNow : anchor + ticks * intervalMs;

  return {
    energy: {
      current: nextCurrent,
      max,
      lastRegenAtUtc: nextLastRegenAtUtc,
      lastSeenUtc: effectiveNow
    },
    gained
  };
}

/**
 * Attempts to deduct minigame energy cost (5) once per valid minigame start.
 */
export function consumePlayerEnergyForMinigame(
  energy: PlayerEnergyState,
  nowUtc: number = Date.now(),
  cost: number = ECONOMY_CONFIG.MINIGAME_ENERGY_COST
): {
  success: boolean;
  energy: PlayerEnergyState;
  msUntilNextEnergy: number;
  msUntilPlayable: number;
} {
  const { energy: synced } = reconcilePlayerEnergy(energy, nowUtc);
  const effectiveNow = synced.lastSeenUtc;

  if (synced.current < cost) {
    const info = getEnergyRegenInfo(synced, effectiveNow);
    return {
      success: false,
      energy: synced,
      msUntilNextEnergy: info.msUntilNextEnergy,
      msUntilPlayable: info.msUntilEnoughForMinigame
    };
  }

  const wasAtMax = synced.current >= synced.max;
  const nextCurrent = synced.current - cost;
  const nextLastRegenAtUtc = wasAtMax ? effectiveNow : synced.lastRegenAtUtc;

  const updated: PlayerEnergyState = {
    current: nextCurrent,
    max: synced.max,
    lastRegenAtUtc: nextLastRegenAtUtc,
    lastSeenUtc: effectiveNow
  };

  const info = getEnergyRegenInfo(updated, effectiveNow);
  return {
    success: true,
    energy: updated,
    msUntilNextEnergy: info.msUntilNextEnergy,
    msUntilPlayable: info.msUntilEnoughForMinigame
  };
}

export interface EnergyRegenInfo {
  current: number;
  max: number;
  isFull: boolean;
  msUntilNextEnergy: number;
  nextEnergyAtUtc: number | null;
  msUntilFull: number;
  msUntilEnoughForMinigame: number;
}

export function getEnergyRegenInfo(
  energy: PlayerEnergyState,
  nowUtc: number = Date.now()
): EnergyRegenInfo {
  const { energy: synced } = reconcilePlayerEnergy(energy, nowUtc);
  const effectiveNow = synced.lastSeenUtc;
  const intervalMs = ECONOMY_CONFIG.PLAYER_ENERGY_REGEN_MS;
  const cost = ECONOMY_CONFIG.MINIGAME_ENERGY_COST;

  if (synced.current >= synced.max) {
    return {
      current: synced.current,
      max: synced.max,
      isFull: true,
      msUntilNextEnergy: 0,
      nextEnergyAtUtc: null,
      msUntilFull: 0,
      msUntilEnoughForMinigame: 0
    };
  }

  const elapsedSinceAnchor = Math.max(0, effectiveNow - synced.lastRegenAtUtc);
  const msUntilNextEnergy = Math.max(0, intervalMs - elapsedSinceAnchor);
  const nextEnergyAtUtc = effectiveNow + msUntilNextEnergy;
  const missingToMax = synced.max - synced.current;
  const msUntilFull = msUntilNextEnergy + Math.max(0, missingToMax - 1) * intervalMs;

  const missingToPlay = Math.max(0, cost - synced.current);
  const msUntilEnoughForMinigame =
    missingToPlay === 0
      ? 0
      : msUntilNextEnergy + Math.max(0, missingToPlay - 1) * intervalMs;

  return {
    current: synced.current,
    max: synced.max,
    isFull: false,
    msUntilNextEnergy,
    nextEnergyAtUtc,
    msUntilFull,
    msUntilEnoughForMinigame
  };
}

export function formatCountdownMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatClockTime(utcMs: number): string {
  const d = new Date(utcMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
