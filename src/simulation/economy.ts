import { ECONOMY_CONFIG } from '../config/economy';

export interface IdempotentRewardResult {
  applied: boolean;
  coins: number;
  claimedRewardIds: string[];
  reason?: 'already_claimed' | 'invalid_amount';
}

const MAX_STORED_CLAIM_IDS = 400;

/**
 * Idempotent coin grant: guarantees the exact same event/claimId
 * can NEVER award Coins more than once, even across refreshes or rapid clicks.
 */
export function applyIdempotentCoinReward(
  currentCoins: number,
  claimedRewardIds: string[],
  claimId: string,
  amount: number
): IdempotentRewardResult {
  const safeAmount = Math.floor(amount);
  if (!claimId || safeAmount <= 0 || !Number.isFinite(safeAmount)) {
    return {
      applied: false,
      coins: currentCoins,
      claimedRewardIds,
      reason: 'invalid_amount'
    };
  }

  if (claimedRewardIds.includes(claimId)) {
    return {
      applied: false,
      coins: currentCoins,
      claimedRewardIds,
      reason: 'already_claimed'
    };
  }

  const nextClaimed = [...claimedRewardIds, claimId];
  const trimmed =
    nextClaimed.length > MAX_STORED_CLAIM_IDS
      ? nextClaimed.slice(nextClaimed.length - MAX_STORED_CLAIM_IDS)
      : nextClaimed;

  return {
    applied: true,
    coins: currentCoins + safeAmount,
    claimedRewardIds: trimmed
  };
}

/**
 * Idempotent purchase deduction with balance validation and transaction ID tracking.
 */
export function applyIdempotentPurchase(
  currentCoins: number,
  claimedRewardIds: string[],
  transactionId: string,
  cost: number
): {
  success: boolean;
  coins: number;
  claimedRewardIds: string[];
  reason?: 'duplicate_tx' | 'insufficient_coins' | 'invalid_cost';
} {
  const safeCost = Math.floor(cost);
  if (safeCost < 0 || !Number.isFinite(safeCost)) {
    return {
      success: false,
      coins: currentCoins,
      claimedRewardIds,
      reason: 'invalid_cost'
    };
  }

  if (transactionId && claimedRewardIds.includes(transactionId)) {
    return {
      success: false,
      coins: currentCoins,
      claimedRewardIds,
      reason: 'duplicate_tx'
    };
  }

  if (currentCoins < safeCost) {
    return {
      success: false,
      coins: currentCoins,
      claimedRewardIds,
      reason: 'insufficient_coins'
    };
  }

  const nextClaimed = transactionId
    ? [...claimedRewardIds, transactionId].slice(-MAX_STORED_CLAIM_IDS)
    : claimedRewardIds;

  return {
    success: true,
    coins: currentCoins - safeCost,
    claimedRewardIds: nextClaimed
  };
}

export function getUtcDayNumber(nowUtc: number = Date.now()): number {
  return Math.floor(nowUtc / 86_400_000);
}

export function buildDailyTaskClaimId(utcDay: number, taskId: string): string {
  return `daily_${utcDay}_${taskId}`;
}

export function buildAchievementClaimId(achievementId: string): string {
  return `ach_${achievementId}`;
}

export function buildMinigameClaimId(sessionId: string): string {
  return `mg_${sessionId}`;
}

export function isActionOnCooldown(
  actionCooldowns: Record<string, number>,
  actionKey: string,
  nowUtc: number = Date.now()
): { onCooldown: boolean; remainingMs: number } {
  const expiresAt = actionCooldowns[actionKey] ?? 0;
  const remainingMs = Math.max(0, expiresAt - nowUtc);
  return { onCooldown: remainingMs > 0, remainingMs };
}

export function setActionCooldown(
  actionCooldowns: Record<string, number>,
  actionKey: string,
  nowUtc: number = Date.now(),
  customDurationMs?: number
): Record<string, number> {
  const duration = customDurationMs ?? ECONOMY_CONFIG.ACTION_COOLDOWNS_MS[actionKey] ?? 2500;
  return {
    ...actionCooldowns,
    [actionKey]: nowUtc + duration
  };
}
