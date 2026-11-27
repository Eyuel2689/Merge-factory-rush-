import { GameState } from '../types';

export const IAP_SKU_GOLDEN_TURBINE = 'com.mergefactory.game.vip_golden_turbine';
export const IAP_SKU_CONTRACT_SEAL = 'com.mergefactory.game.vip_contract_seal';

/**
 * Shared multiplier for automated machines & offline earnings.
 * Combines Factory Level, Gem-upgraded Golden Turbine, and IAP Golden Turbine Charter.
 */
export function getPlantIncomeMultiplier(state: Pick<GameState, 'factoryLevel' | 'premiumPerks' | 'ownedIapIds'>): number {
  let mult = 1 + (Math.max(1, state.factoryLevel || 1) - 1) * 0.15;
  const turbineLvl = Math.max(0, Number(state.premiumPerks?.goldenTurbineLevel) || 0);
  if (turbineLvl > 0) {
    mult *= 1 + turbineLvl * 0.25;
  }
  if (state.ownedIapIds?.includes(IAP_SKU_GOLDEN_TURBINE)) {
    mult *= 2; // Permanent +100% Golden Turbine Charter
  }
  return mult;
}

/**
 * Shared multiplier for Client Contract Coin payouts.
 * Combines Gem-upgraded Golden Contract Seal and IAP Master Contract Charter.
 */
export function getContractPayoutMultiplier(state: Pick<GameState, 'premiumPerks' | 'ownedIapIds'>): number {
  const vipLvl = Math.max(0, Number(state.premiumPerks?.vipContractLevel) || 0);
  let mult = 1 + vipLvl * 0.15;
  if (state.ownedIapIds?.includes(IAP_SKU_CONTRACT_SEAL)) {
    mult *= 1.5; // Permanent +50% Master Contract Charter
  }
  return mult;
}

/**
 * Checks calendar date string (YYYY-MM-DD in local time) for daily Casino spin resets.
 */
export function getLocalTodayString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
