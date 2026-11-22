import { GameState } from '../types';
import { createInitialState } from '../data/gameData';
import { checkAndResetDailyState } from './dailyMissions';

const SAVE_KEY = 'merge_factory_2d_save_v1';

export function loadGame(): { state: GameState; offlineCoins: number; offlineSeconds: number } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return { state: createInitialState(), offlineCoins: 0, offlineSeconds: 0 };
    }

    const savedState = JSON.parse(raw) as (GameState & {
      isVip?: boolean;
      adsRemoved?: boolean;
    }) | null;
    if (!savedState || typeof savedState !== 'object') {
      return { state: createInitialState(), offlineCoins: 0, offlineSeconds: 0 };
    }
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - (savedState.lastSavedTimestamp || now)) / 1000);

    // Calculate offline production if elapsed > 10 seconds
    let offlineCoins = 0;
    let cappedSeconds = 0;

    if (elapsedSeconds > 10) {
      // Max offline duration 8 hours = 28,800 seconds
      cappedSeconds = Math.min(28800, elapsedSeconds);

      let coinsPerSec = 0;
      (savedState.machines || []).forEach(machine => {
        if (machine.unlocked && machine.level > 0) {
          let machineRate = (machine.baseProduction * machine.level) / machine.cycleTime;
          const worker = (savedState.workers || []).find(w => w.targetMachineId === machine.id);
          if (worker && worker.unlocked && worker.level > 0) {
            machineRate *= 1 + worker.boostMultiplier * worker.level;
          }
          coinsPerSec += machineRate;
        }
      });

      // Apply factory level boost (+15% per factory level)
      coinsPerSec *= 1 + ((savedState.factoryLevel || 1) - 1) * 0.15;
      offlineCoins = Math.floor(coinsPerSec * cappedSeconds);
    }

    const initialState = createInitialState();

    // Sanitize workers to ensure job names only
    const sanitizedWorkers = (Array.isArray(savedState.workers) ? savedState.workers : initialState.workers)
      .filter(w => w && typeof w === 'object')
      .map(savedWorker => {
        const defaultWorker = initialState.workers.find(w => w.id === savedWorker.id);
        return {
          ...savedWorker,
          name: defaultWorker ? defaultWorker.name : savedWorker.name,
          title: defaultWorker ? defaultWorker.title : savedWorker.title
        };
      });

    const validCats = new Set(['wood', 'metal', 'tech', 'gem']);
    const normalizeItem = (item: { id?: string; tier?: unknown; category?: unknown }) => {
      const cat = typeof item.category === 'string' && validCats.has(item.category)
        ? (item.category as 'wood' | 'metal' | 'tech' | 'gem')
        : 'wood';
      const numTier = Math.min(6, Math.max(1, Number(item.tier) || 1));
      return {
        id: item.id || `norm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tier: numTier,
        category: cat
      };
    };

    // Sanitize orders (including legacy requirements & invalid categories)
    const personalNames = ['Boss Bob', 'Engineer Emma', 'Gamer Guy', 'Mayor May', 'Tech Tim', 'Courier Carl'];
    const rawOrders = Array.isArray(savedState.orders) ? savedState.orders : initialState.orders;
    const sanitizedOrders = rawOrders
      .filter(order => order && typeof order === 'object')
      .map((order, idx) => {
        const fallbackLabels = ['Priority Order', 'Express Delivery', 'Factory Contract'];
        const customerName = personalNames.includes(order.customerName)
          ? fallbackLabels[idx % fallbackLabels.length] || 'Customer Order'
          : order.customerName || 'Customer Order';

        const rawReqs = Array.isArray(order.requirements) && order.requirements.length > 0
          ? order.requirements
          : [{ itemTier: order.itemTier || 1, category: 'wood' as const, quantity: order.quantity || 1 }];

        const cleanReqs = rawReqs
          .filter(r => r && typeof r === 'object')
          .map(r => ({
            category: (typeof r.category === 'string' && validCats.has(r.category)
              ? r.category
              : 'wood') as 'wood' | 'metal' | 'tech' | 'gem',
            itemTier: Math.min(6, Math.max(1, Number(r.itemTier) || 1)),
            quantity: Math.max(1, Number(r.quantity) || 1)
          }));

        return {
          ...order,
          id: order.id || `ord_s_${idx}`,
          customerName,
          requirements: cleanReqs.length > 0 ? cleanReqs : [{ category: 'wood' as const, itemTier: 1, quantity: 1 }],
          coinReward: Math.max(10, Math.round(Number(order.coinReward) || 25)),
          xpReward: Math.max(5, Math.round(Number(order.xpReward) || 15))
        };
      });

    // Strip any removed legacy prestige items safely from board & inventory
    const sanitizedBoard =
      Array.isArray(savedState.board) && savedState.board.length === 25
        ? savedState.board.map((cell, idx) => {
            if (!cell || !cell.item || (cell.item.category as string) === 'prestige') {
              return { id: cell?.id || `cell_${idx}`, item: null };
            }
            return {
              id: cell.id || `cell_${idx}`,
              item: normalizeItem(cell.item)
            };
          })
        : initialState.board;

    const sanitizedInventory = Array.isArray(savedState.inventory)
      ? savedState.inventory
          .filter(item => item && typeof item === 'object' && (item.category as string) !== 'prestige')
          .map(item => normalizeItem(item))
      : [];

    const playerLevel = Math.max(1, Number(savedState.level) || initialState.level || 1);
    const { dailyState: checkedDaily } = checkAndResetDailyState(
      savedState.dailyState || initialState.dailyState,
      playerLevel
    );

    const sanitizedMachines =
      Array.isArray(savedState.machines) && savedState.machines.length > 0
        ? savedState.machines.filter(m => m && typeof m === 'object')
        : initialState.machines;

    const sanitizedAchievements =
      Array.isArray(savedState.achievements) && savedState.achievements.length > 0
        ? savedState.achievements.filter(a => a && typeof a === 'object')
        : initialState.achievements;

    const finalOrders =
      sanitizedOrders.length > 0
        ? sanitizedOrders
        : initialState.orders;

    const { isVip: _ignoredVip, adsRemoved: _ignoredAds, ...cleanSaved } = savedState;

    const mergedState: GameState = {
      ...initialState,
      ...cleanSaved,
      coins: Number.isFinite(Number(savedState.coins)) ? Math.max(0, Number(savedState.coins)) : initialState.coins,
      gems: Number.isFinite(Number(savedState.gems)) ? Math.max(0, Number(savedState.gems)) : initialState.gems,
      maxEnergy: Math.max(10, Number(savedState.maxEnergy) || initialState.maxEnergy),
      energy: Math.max(0, Math.min(Number(savedState.maxEnergy) || initialState.maxEnergy, Number(savedState.energy ?? initialState.energy))),
      level: Math.max(1, Number(savedState.level) || initialState.level),
      xp: Math.max(0, Number(savedState.xp) || 0),
      xpToNextLevel: Math.max(50, Number(savedState.xpToNextLevel) || initialState.xpToNextLevel),
      factoryLevel: Math.max(1, Number(savedState.factoryLevel) || initialState.factoryLevel),
      maxInventoryCapacity: Math.max(4, Number(savedState.maxInventoryCapacity) || initialState.maxInventoryCapacity),
      board: sanitizedBoard,
      inventory: sanitizedInventory,
      machines: sanitizedMachines,
      workers: Array.isArray(sanitizedWorkers) && sanitizedWorkers.length > 0 ? sanitizedWorkers : initialState.workers,
      orders: finalOrders,
      achievements: sanitizedAchievements,
      dailyState: checkedDaily,
      consumables: {
        ...initialState.consumables,
        ...(savedState.consumables || {})
      },
      lastSavedTimestamp: now,
      stats: {
        ...initialState.stats,
        ...(savedState.stats || {})
      },
      settings: {
        ...initialState.settings,
        ...(savedState.settings || {}),
        playMode: savedState.settings?.playMode || initialState.settings.playMode,
        showFloatingRewards:
          savedState.settings?.showFloatingRewards ?? initialState.settings.showFloatingRewards,
        showOrderBadges:
          savedState.settings?.showOrderBadges ?? initialState.settings.showOrderBadges
      }
    };

    return {
      state: mergedState,
      offlineCoins,
      offlineSeconds: cappedSeconds
    };
  } catch (err) {
    console.error('Failed to load game save, starting fresh', err);
    return { state: createInitialState(), offlineCoins: 0, offlineSeconds: 0 };
  }
}

export function saveGame(state: GameState): void {
  try {
    const stateToSave: GameState = {
      ...state,
      lastSavedTimestamp: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
  } catch (err) {
    console.error('Failed to save game', err);
  }
}

export function resetGameSave(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return createInitialState();
}
