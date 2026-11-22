import { GameState, ConsumableId } from '../types';
import { CONSUMABLE_DEFINITIONS, getItemDef, getMaxTierForCategory } from '../data/gameData';
import { recordDailyMissionProgress } from './dailyMissions';

export interface ConsumableUseResult {
  nextState: GameState;
  ok: boolean;
  message: string;
  floatingText?: { text: string; color: string };
  triggerConfetti?: boolean;
}

export function executeConsumableUse(prev: GameState, id: ConsumableId): ConsumableUseResult {
  const def = CONSUMABLE_DEFINITIONS[id];
  const currentStock = prev.consumables?.[id] || 0;

  if (currentStock <= 0) {
    return {
      nextState: prev,
      ok: false,
      message: `${def.name} is empty. Watch a short ad to refill +1 charge.`
    };
  }

  const nextConsumables = {
    ...prev.consumables,
    [id]: Math.max(0, currentStock - 1)
  };

  if (id === 'energy_cell') {
    if (prev.energy >= prev.maxEnergy) {
      return {
        nextState: prev,
        ok: false,
        message: 'Energy grid is already at full capacity.'
      };
    }

    const nextEnergy = Math.min(prev.maxEnergy, prev.energy + 15);
    const gained = nextEnergy - prev.energy;
    return {
      nextState: {
        ...prev,
        energy: nextEnergy,
        consumables: nextConsumables
      },
      ok: true,
      message: `Restored +${gained} Energy`,
      floatingText: { text: `+${gained} Energy`, color: '#059669' }
    };
  }

  if (id === 'tier_catalyst') {
    let targetIdx = -1;
    let highestTier = 0;

    prev.board.forEach((cell, idx) => {
      if (cell.item && cell.item.tier <= 5) {
        if (cell.item.tier > highestTier) {
          highestTier = cell.item.tier;
          targetIdx = idx;
        }
      }
    });

    if (targetIdx === -1) {
      return {
        nextState: prev,
        ok: false,
        message: 'Place a Tier 1–5 item on your Workshop Grid to promote.'
      };
    }

    const nextBoard = [...prev.board];
    const targetItem = nextBoard[targetIdx].item!;
    const promotedTier = targetItem.tier + 1;
    const promotedDef = getItemDef(targetItem.category, promotedTier);

    nextBoard[targetIdx] = {
      ...nextBoard[targetIdx],
      item: { ...targetItem, tier: promotedTier }
    };

    const nextDaily = recordDailyMissionProgress(prev.dailyState, 'craft_tier', 1, { tier: promotedTier });

    return {
      nextState: {
        ...prev,
        board: nextBoard,
        consumables: nextConsumables,
        dailyState: nextDaily,
        stats: {
          ...prev.stats,
          highestTierUnlocked: Math.max(prev.stats.highestTierUnlocked, promotedTier)
        }
      },
      ok: true,
      message: `Promoted ${promotedDef.name} to Tier ${promotedTier}`,
      floatingText: { text: `Promoted to T${promotedTier}!`, color: '#D97706' },
      triggerConfetti: true
    };
  }

  if (id === 'overclock_core') {
    let coinsPerSec = 0;
    prev.machines.forEach(m => {
      if (m.unlocked && m.level > 0) {
        let rate = (m.baseProduction * m.level) / m.cycleTime;
        const w = prev.workers.find(wk => wk.targetMachineId === m.id);
        if (w && w.unlocked && w.level > 0) {
          rate *= 1 + w.boostMultiplier * w.level;
        }
        coinsPerSec += rate;
      }
    });

    coinsPerSec *= 1 + (prev.factoryLevel - 1) * 0.15;
    const burstCoins = Math.max(250, Math.round(coinsPerSec * 600));
    const now = Date.now();
    const baseUntil = Math.max(now, prev.doubleEarningsUntil || 0);
    const nextBoostUntil = Math.min(now + 15 * 60 * 1000, baseUntil + 5 * 60 * 1000);
    const nextDaily = recordDailyMissionProgress(prev.dailyState, 'earn_coins', burstCoins);

    return {
      nextState: {
        ...prev,
        coins: prev.coins + burstCoins,
        doubleEarningsUntil: nextBoostUntil,
        consumables: nextConsumables,
        dailyState: nextDaily,
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + burstCoins
        }
      },
      ok: true,
      message: `+${burstCoins.toLocaleString()} Coins & 2x Output (5m)`,
      floatingText: { text: `+${burstCoins.toLocaleString()} Coins · 2x (5m)`, color: '#7C3AED' },
      triggerConfetti: true
    };
  }

  // merge_magnet: automatically merge up to 2 matching pairs on the board
  const nextBoard = prev.board.map(c => ({ ...c }));
  let mergesDone = 0;
  let totalCoins = 0;
  let totalXp = 0;
  let highestTier = prev.stats.highestTierUnlocked;

  for (let pass = 0; pass < 2; pass++) {
    let pairA = -1;
    let pairB = -1;

    for (let i = 0; i < nextBoard.length && pairA === -1; i++) {
      const itemA = nextBoard[i].item;
      if (!itemA) continue;
      const maxTier = getMaxTierForCategory(itemA.category);
      if (itemA.tier >= maxTier) continue;

      for (let j = i + 1; j < nextBoard.length; j++) {
        const itemB = nextBoard[j].item;
        if (itemB && itemB.category === itemA.category && itemB.tier === itemA.tier) {
          pairA = i;
          pairB = j;
          break;
        }
      }
    }

    if (pairA === -1 || pairB === -1) break;

    const mergedBase = nextBoard[pairA].item!;
    const newTier = mergedBase.tier + 1;
    const defNew = getItemDef(mergedBase.category, newTier);
    const rewardCoins = Math.max(4, Math.round(defNew.coinValue * 0.25));

    nextBoard[pairA] = { ...nextBoard[pairA], item: null };
    nextBoard[pairB] = {
      ...nextBoard[pairB],
      item: {
        id: `mag_${Date.now()}_${pass}_${Math.random().toString(36).slice(2, 6)}`,
        tier: newTier,
        category: mergedBase.category
      }
    };

    mergesDone += 1;
    totalCoins += rewardCoins;
    totalXp += newTier * 5;
    highestTier = Math.max(highestTier, newTier);
  }

  if (mergesDone === 0) {
    return {
      nextState: prev,
      ok: false,
      message: 'No matching component pairs on the grid to auto-merge.'
    };
  }

  const nextXP = prev.xp + totalXp;
  let nextLevel = prev.level;
  let nextXPToNext = prev.xpToNextLevel;
  if (nextXP >= nextXPToNext) {
    nextLevel += 1;
    nextXPToNext = Math.round(nextXPToNext * 1.55);
  }

  const nextMerges = prev.stats.totalMerges + mergesDone;
  const updatedAchievements = prev.achievements.map(ach => {
    if (ach.type === 'merges') return { ...ach, currentValue: nextMerges };
    if (ach.type === 'item_tier' && highestTier >= ach.targetValue) {
      return { ...ach, currentValue: Math.max(ach.currentValue, highestTier) };
    }
    return ach;
  });

  let nextDaily = recordDailyMissionProgress(prev.dailyState, 'merges', mergesDone);
  nextDaily = recordDailyMissionProgress(nextDaily, 'craft_tier', mergesDone, { tier: highestTier });
  nextDaily = recordDailyMissionProgress(nextDaily, 'earn_coins', totalCoins);

  return {
    nextState: {
      ...prev,
      coins: prev.coins + totalCoins,
      xp: nextXP,
      level: nextLevel,
      xpToNextLevel: nextXPToNext,
      board: nextBoard,
      consumables: nextConsumables,
      achievements: updatedAchievements,
      dailyState: nextDaily,
      stats: {
        ...prev.stats,
        totalMerges: nextMerges,
        highestTierUnlocked: highestTier,
        totalCoinsEarned: prev.stats.totalCoinsEarned + totalCoins
      }
    },
    ok: true,
    message: `Auto-merged ${mergesDone} pair${mergesDone > 1 ? 's' : ''} (+${totalCoins} Coins)`,
    floatingText: { text: `Merged ×${mergesDone} · +${totalCoins} Coins`, color: '#0284C7' },
    triggerConfetti: true
  };
}
