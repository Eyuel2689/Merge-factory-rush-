import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  GameState,
  Order,
  OrderRequirement,
  ItemDefinition,
  ConsumableDef,
  ConsumableId,
  ItemCategory
} from '../types';
import {
  getItemDef,
  generateRandomOrder,
  getOrderRequirements,
  getMarketplaceSpotSellPrice,
  resolveCustomerAvatar,
  isImageSource,
  CONSUMABLE_LIST,
  CONSUMABLE_DEFINITIONS
} from '../data/gameData';
import { executeConsumableUse } from '../utils/consumables';
import { getContractPayoutMultiplier } from '../utils/economy';
import {
  executeBoardTap,
  executeBoardDrop,
  findMatchingCellIndices,
  findAllMergeablePairs,
  generateSmartBoardItem,
  sortBoardCells,
  normalizeCategory,
  normalizeTier,
  canMergeItems,
  BoardActionResult
} from '../utils/mergeEngine';
import {
  Zap,
  Package,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Target,
  ArrowUpDown,
  X,
  Info,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Store,
  Archive,
  Tag,
  Check
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { triggerConfetti } from '../utils/confettiSafe';
import { recordDailyMissionProgress } from '../utils/dailyMissions';
import { DailyMissionsModal } from './DailyMissionsModal';
import { OrderRewardModal } from './OrderRewardModal';
import { InventoryView } from './InventoryView';
import { ItemDetailModal } from './ItemDetailModal';
import { AdRewardType } from './AdModal';

interface FactoryBoardProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onAddFloatingText: (text: string, x: number, y: number, color?: string) => void;
  onTriggerRewardedAd: (rewardType: AdRewardType, onComplete: () => void, adDetail?: string) => void;
  onGoToMarket?: (subTab?: 'marketplace' | 'consumables') => void;
}

const CATEGORY_META: Record<
  ItemCategory,
  {
    label: string;
    bottomLip: string;
    chipBg: string;
    chipText: string;
  }
> = {
  wood: {
    label: 'Timber',
    bottomLip: 'border-amber-700/60',
    chipBg: 'bg-amber-100',
    chipText: 'text-amber-900'
  },
  metal: {
    label: 'Alloy',
    bottomLip: 'border-sky-700/60',
    chipBg: 'bg-sky-100',
    chipText: 'text-sky-900'
  },
  tech: {
    label: 'Tech',
    bottomLip: 'border-indigo-800/60',
    chipBg: 'bg-indigo-100',
    chipText: 'text-indigo-900'
  },
  gem: {
    label: 'Mineral',
    bottomLip: 'border-emerald-700/60',
    chipBg: 'bg-emerald-100',
    chipText: 'text-emerald-900'
  }
};

const BOARD_THEME_FRAMES: Record<string, { shell: string; tray: string }> = {
  amber: {
    shell: 'border-amber-200/90 bg-white/95',
    tray: 'bg-gradient-to-b from-amber-100/75 to-orange-100/70 border-amber-200/90'
  },
  emerald: {
    shell: 'border-emerald-200/90 bg-white/95',
    tray: 'bg-gradient-to-b from-emerald-100/70 to-teal-100/65 border-emerald-200/90'
  },
  purple: {
    shell: 'border-violet-200/90 bg-white/95',
    tray: 'bg-gradient-to-b from-violet-100/70 to-indigo-100/65 border-violet-200/90'
  },
  ocean: {
    shell: 'border-sky-200/90 bg-white/95',
    tray: 'bg-gradient-to-b from-sky-100/75 to-cyan-100/70 border-sky-200/90'
  },
  obsidian: {
    shell: 'border-amber-400/90 bg-slate-900 text-white',
    tray: 'bg-gradient-to-b from-slate-800 to-slate-950 border-amber-400/70'
  }
};

interface DragState {
  fromIdx: number;
  x: number;
  y: number;
  hoverIdx: number | null;
}

export const FactoryBoard: React.FC<FactoryBoardProps> = ({
  state,
  onUpdateState,
  onAddFloatingText,
  onTriggerRewardedAd,
  onGoToMarket
}) => {
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(null);
  const [flashCellIndex, setFlashCellIndex] = useState<number | null>(null);
  const [flashKind, setFlashKind] = useState<'merge' | 'spawn' | 'move' | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showDailyModal, setShowDailyModal] = useState<boolean>(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [showVault, setShowVault] = useState<boolean>(false);
  const [showContracts, setShowContracts] = useState<boolean>(true);
  const [inspectedItem, setInspectedItem] = useState<ItemDefinition | null>(null);
  const [inspectedConsumable, setInspectedConsumable] = useState<ConsumableDef | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const noticeTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const pointerDownRef = useRef<{
    fromIdx: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef<boolean>(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const showNotice = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotice({ text, type });
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2600);
  }, []);

  const triggerCellFlash = useCallback((idx: number, kind: 'merge' | 'spawn' | 'move') => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    setFlashCellIndex(idx);
    setFlashKind(kind);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashCellIndex(null);
      setFlashKind(null);
    }, 320);
  }, []);

  const showMergeHighlights = state.settings?.showMergeHighlights !== false;
  const showOrderBadges = state.settings?.showOrderBadges !== false;
  const boardTheme = BOARD_THEME_FRAMES[state.settings?.boardTheme || 'amber'] || BOARD_THEME_FRAMES.amber;

  const readyPairs = useMemo(() => findAllMergeablePairs(state.board), [state.board]);

  const matchingIndices = useMemo(() => {
    const activeIdx = dragState ? dragState.fromIdx : selectedCellIndex;
    if (activeIdx === null) return [];
    return findMatchingCellIndices(state.board, activeIdx);
  }, [state.board, selectedCellIndex, dragState]);

  const matchingSet = useMemo(() => new Set(matchingIndices), [matchingIndices]);

  // Required order item keys for contract checkmark badges
  const neededOrderKeys = useMemo(() => {
    const keys = new Set<string>();
    state.orders.forEach(order => {
      getOrderRequirements(order).forEach(req => {
        keys.add(`${normalizeCategory(req.category)}_${req.itemTier}`);
      });
    });
    return keys;
  }, [state.orders]);

  const selectedCellItem =
    selectedCellIndex !== null && state.board[selectedCellIndex]?.item
      ? state.board[selectedCellIndex].item
      : null;

  const selectedItemDef = selectedCellItem
    ? getItemDef(normalizeCategory(selectedCellItem.category), normalizeTier(selectedCellItem.tier))
    : null;

  const nextTierDef =
    selectedItemDef && selectedItemDef.tier < 6
      ? getItemDef(selectedItemDef.category, selectedItemDef.tier + 1)
      : null;

  // Apply merge rewards cleanly outside state reducer for React StrictMode safety
  const applyMergeEffects = useCallback(
    (result: BoardActionResult, targetIdx: number, clientX?: number, clientY?: number) => {
      if (result.action !== 'merged' || !result.mergedItem) return;

      const currentState = stateRef.current;
      const willLevelUp = currentState.xp + result.xpReward >= currentState.xpToNextLevel;

      setSelectedCellIndex(null);
      triggerCellFlash(targetIdx, 'merge');
      soundManager.playSound('merge', currentState.settings.soundFx);
      if (willLevelUp) {
        soundManager.playSound('upgrade', currentState.settings.soundFx);
      }

      const fx = clientX ?? window.innerWidth / 2;
      const fy = clientY ?? window.innerHeight * 0.44;
      onAddFloatingText(`T${result.mergedItem.tier}! +${result.coinReward}`, fx, fy, '#059669');

      if (result.mergedItem.tier >= 5) {
        triggerConfetti({ particleCount: 38, spread: 52, origin: { y: 0.55 } });
      }
      showNotice(`${result.message} +${result.coinReward} Coins`, 'success');
    },
    [onAddFloatingText, showNotice, triggerCellFlash]
  );

  // Tap-to-Select / Tap-to-Merge / Tap-to-Move Handler
  const handleCellTap = useCallback(
    (tappedIdx: number, e?: React.MouseEvent<HTMLButtonElement>) => {
      const currentState = stateRef.current;
      const tapResult = executeBoardTap(currentState.board, selectedCellIndex, tappedIdx);

      if (tapResult.action === 'noop') return;

      if (tapResult.action === 'selected') {
        setSelectedCellIndex(tapResult.nextSelectedIdx);
        soundManager.playSound('click', currentState.settings.soundFx);
        return;
      }

      if (tapResult.action === 'switched') {
        setSelectedCellIndex(tapResult.nextSelectedIdx);
        soundManager.playSound('click', currentState.settings.soundFx);
        if (tapResult.message) {
          showNotice(tapResult.message, 'info');
        }
        return;
      }

      if (tapResult.action === 'deselected') {
        setSelectedCellIndex(null);
        soundManager.playSound('click', currentState.settings.soundFx);
        return;
      }

      if (tapResult.action === 'moved') {
        const originSelected = selectedCellIndex;
        onUpdateState(prev => {
          const res = executeBoardTap(prev.board, originSelected, tappedIdx);
          if (res.action !== 'moved') return prev;
          return { ...prev, board: res.nextBoard };
        });
        setSelectedCellIndex(null);
        triggerCellFlash(tappedIdx, 'move');
        soundManager.playSound('click', currentState.settings.soundFx);
        return;
      }

      if (tapResult.action === 'max_tier') {
        setSelectedCellIndex(tapResult.nextSelectedIdx);
        soundManager.playSound('error', currentState.settings.soundFx);
        showNotice(tapResult.message || 'Already Max Tier (T6).', 'info');
        return;
      }

      if (tapResult.action === 'merged' && tapResult.mergedItem) {
        const originSelected = selectedCellIndex;
        onUpdateState(prev => {
          const res = executeBoardTap(prev.board, originSelected, tappedIdx);
          if (res.action !== 'merged' || !res.mergedItem) return prev;

          const nextXP = prev.xp + res.xpReward;
          let nextLevel = prev.level;
          let nextXPToNext = prev.xpToNextLevel;
          if (nextXP >= nextXPToNext) {
            nextLevel += 1;
            nextXPToNext = Math.round(nextXPToNext * 1.55);
          }

          const totalMerges = prev.stats.totalMerges + 1;
          const highestTier = Math.max(prev.stats.highestTierUnlocked, res.highestTier);

          const updatedAchievements = prev.achievements.map(ach => {
            if (ach.type === 'merges') return { ...ach, currentValue: totalMerges };
            if (ach.type === 'item_tier' && highestTier >= ach.targetValue) {
              return { ...ach, currentValue: Math.max(ach.currentValue, highestTier) };
            }
            return ach;
          });

          let nextDaily = recordDailyMissionProgress(prev.dailyState, 'merges', 1);
          nextDaily = recordDailyMissionProgress(nextDaily, 'craft_tier', 1, { tier: res.highestTier });
          nextDaily = recordDailyMissionProgress(nextDaily, 'earn_coins', res.coinReward);

          return {
            ...prev,
            board: res.nextBoard,
            coins: prev.coins + res.coinReward,
            xp: nextXP,
            level: nextLevel,
            xpToNextLevel: nextXPToNext,
            achievements: updatedAchievements,
            dailyState: nextDaily,
            stats: {
              ...prev.stats,
              totalMerges,
              highestTierUnlocked: highestTier,
              totalCoinsEarned: prev.stats.totalCoinsEarned + res.coinReward
            }
          };
        });

        let fx: number | undefined;
        let fy: number | undefined;
        if (e) {
          const rect = e.currentTarget.getBoundingClientRect();
          fx = rect.left + rect.width / 2;
          fy = rect.top;
        }
        applyMergeEffects(tapResult, tappedIdx, fx, fy);
      }
    },
    [selectedCellIndex, onUpdateState, triggerCellFlash, showNotice, applyMergeEffects]
  );

  // Drag-and-Drop Handler (Merge / Move / Swap)
  const handleBoardDrop = useCallback(
    (fromIdx: number, toIdx: number, clientX: number, clientY: number) => {
      const currentState = stateRef.current;
      const dropResult = executeBoardDrop(currentState.board, fromIdx, toIdx);

      if (dropResult.action === 'noop') return;

      if (dropResult.action === 'moved' || dropResult.action === 'swapped') {
        onUpdateState(prev => {
          const res = executeBoardDrop(prev.board, fromIdx, toIdx);
          if (res.action !== 'moved' && res.action !== 'swapped') return prev;
          return { ...prev, board: res.nextBoard };
        });
        setSelectedCellIndex(null);
        triggerCellFlash(toIdx, 'move');
        soundManager.playSound('click', currentState.settings.soundFx);
        return;
      }

      if (dropResult.action === 'max_tier') {
        setSelectedCellIndex(toIdx);
        soundManager.playSound('error', currentState.settings.soundFx);
        showNotice(dropResult.message || 'Already Max Tier (T6).', 'info');
        return;
      }

      if (dropResult.action === 'merged' && dropResult.mergedItem) {
        onUpdateState(prev => {
          const res = executeBoardDrop(prev.board, fromIdx, toIdx);
          if (res.action !== 'merged' || !res.mergedItem) return prev;

          const nextXP = prev.xp + res.xpReward;
          let nextLevel = prev.level;
          let nextXPToNext = prev.xpToNextLevel;
          if (nextXP >= nextXPToNext) {
            nextLevel += 1;
            nextXPToNext = Math.round(nextXPToNext * 1.55);
          }

          const totalMerges = prev.stats.totalMerges + 1;
          const highestTier = Math.max(prev.stats.highestTierUnlocked, res.highestTier);

          const updatedAchievements = prev.achievements.map(ach => {
            if (ach.type === 'merges') return { ...ach, currentValue: totalMerges };
            if (ach.type === 'item_tier' && highestTier >= ach.targetValue) {
              return { ...ach, currentValue: Math.max(ach.currentValue, highestTier) };
            }
            return ach;
          });

          let nextDaily = recordDailyMissionProgress(prev.dailyState, 'merges', 1);
          nextDaily = recordDailyMissionProgress(nextDaily, 'craft_tier', 1, { tier: res.highestTier });
          nextDaily = recordDailyMissionProgress(nextDaily, 'earn_coins', res.coinReward);

          return {
            ...prev,
            board: res.nextBoard,
            coins: prev.coins + res.coinReward,
            xp: nextXP,
            level: nextLevel,
            xpToNextLevel: nextXPToNext,
            achievements: updatedAchievements,
            dailyState: nextDaily,
            stats: {
              ...prev.stats,
              totalMerges,
              highestTierUnlocked: highestTier,
              totalCoinsEarned: prev.stats.totalCoinsEarned + res.coinReward
            }
          };
        });

        applyMergeEffects(dropResult, toIdx, clientX, clientY);
      }
    },
    [onUpdateState, triggerCellFlash, showNotice, applyMergeEffects]
  );

  // Global pointer move/up listeners for smooth drag-to-merge without breaking taps
  useEffect(() => {
    const getHoveredCellIndex = (clientX: number, clientY: number): number | null => {
      const el = document.elementFromPoint(clientX, clientY);
      const cellEl = el?.closest('[data-cell-index]') as HTMLElement | null;
      if (!cellEl) return null;
      const parsed = Number(cellEl.dataset.cellIndex);
      return Number.isInteger(parsed) ? parsed : null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const pd = pointerDownRef.current;
      if (!pd) return;

      const dx = e.clientX - pd.startX;
      const dy = e.clientY - pd.startY;
      if (!pd.dragging && Math.hypot(dx, dy) > 10) {
        pd.dragging = true;
      }

      if (pd.dragging) {
        const hoverIdx = getHoveredCellIndex(e.clientX, e.clientY);
        setDragState({
          fromIdx: pd.fromIdx,
          x: e.clientX,
          y: e.clientY,
          hoverIdx
        });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const pd = pointerDownRef.current;
      if (!pd) return;
      pointerDownRef.current = null;

      if (pd.dragging) {
        suppressClickRef.current = true;
        window.requestAnimationFrame(() => {
          suppressClickRef.current = false;
        });

        const dropIdx = getHoveredCellIndex(e.clientX, e.clientY);
        setDragState(null);
        if (dropIdx !== null && dropIdx !== pd.fromIdx) {
          handleBoardDrop(pd.fromIdx, dropIdx, e.clientX, e.clientY);
        }
      } else {
        setDragState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [handleBoardDrop]);

  // Order Helpers
  const getRequirementAvailableCount = (req: OrderRequirement) => {
    const reqCat = normalizeCategory(req.category);
    const boardCount = state.board.filter(
      c =>
        c.item &&
        normalizeTier(c.item.tier) === req.itemTier &&
        normalizeCategory(c.item.category) === reqCat
    ).length;
    const invCount = state.inventory.filter(
      i => normalizeTier(i.tier) === req.itemTier && normalizeCategory(i.category) === reqCat
    ).length;
    return boardCount + invCount;
  };

  const isOrderReady = (order: Order) => {
    const reqs = getOrderRequirements(order);
    return reqs.every(req => getRequirementAvailableCount(req) >= req.quantity);
  };

  const handleOpenOrder = (orderId: string) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    if (!isOrderReady(order)) {
      soundManager.playSound('error', state.settings.soundFx);
      showNotice('Craft the required items on your table or Vault to ship.', 'error');
      return;
    }
    soundManager.playSound('click', state.settings.soundFx);
    setPendingOrder(order);
  };

  const vipMultiplier = getContractPayoutMultiplier(state);

  const executeOrderFulfillment = (order: Order, earningsMultiplier: 1 | 2) => {
    const totalCoinsEarned = Math.round(order.coinReward * vipMultiplier) * earningsMultiplier;
    const gemsEarned = (order.gemReward || 0) * earningsMultiplier;
    const willLevelUp = state.xp + order.xpReward >= state.xpToNextLevel;

    onUpdateState(prev => {
      const targetOrder = prev.orders.find(o => o.id === order.id);
      if (!targetOrder) return prev;

      const reqs = getOrderRequirements(targetOrder);
      let nextBoard = prev.board.map(c => ({ ...c }));
      let nextInventory = [...prev.inventory];

      reqs.forEach(req => {
        const reqCat = normalizeCategory(req.category);
        let needed = req.quantity;

        nextBoard = nextBoard.map(cell => {
          if (
            needed > 0 &&
            cell.item &&
            normalizeTier(cell.item.tier) === req.itemTier &&
            normalizeCategory(cell.item.category) === reqCat
          ) {
            needed--;
            return { ...cell, item: null };
          }
          return cell;
        });

        if (needed > 0) {
          nextInventory = nextInventory.filter(item => {
            if (
              needed > 0 &&
              normalizeTier(item.tier) === req.itemTier &&
              normalizeCategory(item.category) === reqCat
            ) {
              needed--;
              return false;
            }
            return true;
          });
        }
      });

      const prevVipMult = getContractPayoutMultiplier(prev);
      const orderCoins = Math.round(targetOrder.coinReward * prevVipMult) * earningsMultiplier;
      const orderXp = targetOrder.xpReward;
      const orderGems = (targetOrder.gemReward || 0) * earningsMultiplier;

      const newOrders = prev.orders.map(o =>
        o.id === targetOrder.id
          ? generateRandomOrder(`ord_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, prev.level)
          : o
      );

      const nextXP = prev.xp + orderXp;
      let nextLevel = prev.level;
      let nextXPToNext = prev.xpToNextLevel;
      if (nextXP >= nextXPToNext) {
        nextLevel += 1;
        nextXPToNext = Math.round(nextXPToNext * 1.55);
      }

      const totalOrders = prev.stats.totalOrdersCompleted + 1;
      const updatedAchievements = prev.achievements.map(ach =>
        ach.type === 'orders' ? { ...ach, currentValue: totalOrders } : ach
      );

      let nextDaily = recordDailyMissionProgress(prev.dailyState, 'orders', 1);
      nextDaily = recordDailyMissionProgress(nextDaily, 'earn_coins', orderCoins);

      return {
        ...prev,
        coins: prev.coins + orderCoins,
        gems: prev.gems + orderGems,
        xp: nextXP,
        level: nextLevel,
        xpToNextLevel: nextXPToNext,
        board: nextBoard,
        inventory: nextInventory,
        orders: newOrders,
        achievements: updatedAchievements,
        dailyState: nextDaily,
        stats: {
          ...prev.stats,
          totalOrdersCompleted: totalOrders,
          totalCoinsEarned: prev.stats.totalCoinsEarned + orderCoins
        }
      };
    });

    setSelectedCellIndex(null);
    soundManager.playSound('order', state.settings.soundFx);
    if (willLevelUp) {
      soundManager.playSound('upgrade', state.settings.soundFx);
    }
    triggerConfetti({ particleCount: 55, spread: 60, origin: { y: 0.6 } });
    onAddFloatingText(
      `+${totalCoinsEarned.toLocaleString()} Coins${gemsEarned ? ` +${gemsEarned} 💎` : ''}`,
      window.innerWidth / 2,
      window.innerHeight * 0.34,
      '#059669'
    );
    showNotice(`Contract shipped! +${totalCoinsEarned.toLocaleString()} Coins`, 'success');
  };

  const handleQuickMergeSelected = () => {
    if (selectedCellIndex === null || matchingIndices.length === 0) return;
    handleCellTap(matchingIndices[0]);
  };

  const handleSortGrid = () => {
    const occupiedCount = state.board.filter(c => c.item !== null).length;
    if (occupiedCount === 0) {
      showNotice('Table is empty. Tap Source Material to spawn parts.', 'info');
      return;
    }

    onUpdateState(prev => ({
      ...prev,
      board: sortBoardCells(prev.board)
    }));
    setSelectedCellIndex(null);
    soundManager.playSound('click', state.settings.soundFx);
    showNotice(
      readyPairs.length > 0
        ? `Sorted — ${readyPairs.length} ready pair${readyPairs.length > 1 ? 's' : ''} grouped side-by-side!`
        : 'Table organized by material & tier.',
      'success'
    );
  };

  const handleSpawnItem = () => {
    const emptyIndex = state.board.findIndex(cell => cell.item === null);
    if (emptyIndex === -1) {
      soundManager.playSound('error', state.settings.soundFx);
      showNotice('Table is full! Merge a pair, move to Vault, or Spot Sell.', 'error');
      return;
    }

    if (state.energy <= 0) {
      soundManager.playSound('error', state.settings.soundFx);
      if ((state.consumables?.energy_cell || 0) > 0) {
        handleUseConsumable('energy_cell');
      } else {
        onTriggerRewardedAd(
          'energy',
          () => {
            onUpdateState(prev => ({
              ...prev,
              energy: Math.min(prev.maxEnergy, prev.energy + 15)
            }));
            soundManager.playSound('coin', state.settings.soundFx);
            showNotice('Energy refilled +15 ⚡!', 'success');
          },
          'Quick Charge (+15 Energy)'
        );
      }
      return;
    }

    const newItem = generateSmartBoardItem(state.board, state.level);
    const itemDef = getItemDef(newItem.category, newItem.tier);

    onUpdateState(prev => {
      const idx = prev.board.findIndex(cell => cell.item === null);
      if (idx === -1 || prev.energy <= 0) return prev;
      const nextBoard = [...prev.board];
      nextBoard[idx] = { ...nextBoard[idx], item: newItem };
      const nextDaily = recordDailyMissionProgress(prev.dailyState, 'spawns', 1);
      return {
        ...prev,
        energy: prev.energy - 1,
        board: nextBoard,
        dailyState: nextDaily
      };
    });

    setSelectedCellIndex(null);
    triggerCellFlash(emptyIndex, 'spawn');
    soundManager.playSound('click', state.settings.soundFx);
    showNotice(`Sourced ${itemDef.name} (T${newItem.tier})`, 'info');
  };

  const handleVaultSelected = () => {
    if (selectedCellIndex === null || !selectedCellItem) return;
    if (state.inventory.length >= state.maxInventoryCapacity) {
      soundManager.playSound('error', state.settings.soundFx);
      showNotice(`Asset Vault is full (${state.inventory.length}/${state.maxInventoryCapacity}).`, 'error');
      setShowVault(true);
      return;
    }

    const itemName = selectedItemDef?.name || 'Item';
    const targetIdx = selectedCellIndex;

    onUpdateState(prev => {
      const cellItem = prev.board[targetIdx]?.item;
      if (!cellItem || prev.inventory.length >= prev.maxInventoryCapacity) return prev;
      const nextBoard = [...prev.board];
      nextBoard[targetIdx] = { ...nextBoard[targetIdx], item: null };
      return {
        ...prev,
        board: nextBoard,
        inventory: [...prev.inventory, cellItem]
      };
    });

    setSelectedCellIndex(null);
    setShowVault(true);
    soundManager.playSound('click', state.settings.soundFx);
    showNotice(`Stored ${itemName} in Asset Vault.`, 'success');
  };

  const handleSpotSellSelected = () => {
    if (selectedCellIndex === null || !selectedCellItem || !selectedItemDef) return;
    const sellPrice = getMarketplaceSpotSellPrice(selectedItemDef.category, selectedItemDef.tier);
    const targetIdx = selectedCellIndex;

    onUpdateState(prev => {
      const cellItem = prev.board[targetIdx]?.item;
      if (!cellItem) return prev;
      const def = getItemDef(normalizeCategory(cellItem.category), normalizeTier(cellItem.tier));
      const price = getMarketplaceSpotSellPrice(def.category, def.tier);
      const nextBoard = [...prev.board];
      nextBoard[targetIdx] = { ...nextBoard[targetIdx], item: null };
      const nextDaily = recordDailyMissionProgress(prev.dailyState, 'earn_coins', price);
      return {
        ...prev,
        coins: prev.coins + price,
        board: nextBoard,
        dailyState: nextDaily,
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + price
        }
      };
    });

    setSelectedCellIndex(null);
    soundManager.playSound('coin', state.settings.soundFx);
    onAddFloatingText(
      `+${sellPrice} Coins`,
      window.innerWidth / 2,
      window.innerHeight * 0.45,
      '#D97706'
    );
    showNotice(`Sold ${selectedItemDef.name} for +${sellPrice} Coins.`, 'success');
  };

  const handleUseSelectedAsset = () => {
    if (selectedCellIndex === null || !selectedCellItem || !selectedItemDef?.specialUse) return;
    const special = selectedItemDef.specialUse;
    const targetIdx = selectedCellIndex;

    onUpdateState(prev => {
      const cellItem = prev.board[targetIdx]?.item;
      if (!cellItem) return prev;
      const def = getItemDef(normalizeCategory(cellItem.category), normalizeTier(cellItem.tier));
      if (!def.specialUse) return prev;

      const nextBoard = [...prev.board];
      nextBoard[targetIdx] = { ...nextBoard[targetIdx], item: null };

      if (def.specialUse.actionType === 'tool_surge') {
        const now = Date.now();
        const currentUntil = prev.productionSurgeUntil || 0;
        const baseTime = currentUntil > now ? currentUntil : now;
        return {
          ...prev,
          board: nextBoard,
          productionSurgeUntil: Math.min(now + 900_000, baseTime + def.specialUse.powerValue * 1000)
        };
      }
      if (def.specialUse.actionType === 'recharge_energy') {
        return {
          ...prev,
          board: nextBoard,
          energy: Math.min(prev.maxEnergy, prev.energy + def.specialUse.powerValue)
        };
      }
      return {
        ...prev,
        board: nextBoard,
        gems: prev.gems + def.specialUse.powerValue
      };
    });

    setSelectedCellIndex(null);
    soundManager.playSound('upgrade', state.settings.soundFx);
    triggerConfetti({ particleCount: 28, spread: 45, origin: { y: 0.55 } });
    showNotice(`Activated ${special.label}!`, 'success');
  };

  const handleUseConsumable = (id: ConsumableId) => {
    const preview = executeConsumableUse(state, id);
    if (!preview.ok) {
      soundManager.playSound('error', state.settings.soundFx);
      showNotice(preview.message, 'error');
      return;
    }

    onUpdateState(prev => executeConsumableUse(prev, id).nextState);
    if (id === 'tier_catalyst' || id === 'merge_magnet') {
      setSelectedCellIndex(null);
    }
    soundManager.playSound('upgrade', state.settings.soundFx);
    if (preview.triggerConfetti) {
      triggerConfetti({ particleCount: 36, spread: 50, origin: { y: 0.58 } });
    }
    if (preview.floatingText) {
      onAddFloatingText(
        preview.floatingText.text,
        window.innerWidth / 2,
        window.innerHeight * 0.42,
        preview.floatingText.color
      );
    }
    showNotice(preview.message, 'success');
  };

  const handleRefillConsumableAd = (id: ConsumableId) => {
    const def = CONSUMABLE_DEFINITIONS[id];
    const current = state.consumables?.[id] || 0;
    if (current >= def.maxStock) {
      showNotice(`${def.name} is already at full capacity.`, 'info');
      return;
    }

    onTriggerRewardedAd(
      'consumable_refill',
      () => {
        onUpdateState(prev => {
          const prevStock = prev.consumables?.[id] || 0;
          return {
            ...prev,
            consumables: {
              ...prev.consumables,
              [id]: Math.min(def.maxStock, prevStock + 1)
            }
          };
        });
        soundManager.playSound('coin', state.settings.soundFx);
        showNotice(`Refilled +1 ${def.name}!`, 'success');
      },
      `${def.name} (${def.badge})`
    );
  };

  const dailyMissions = state.dailyState?.missions || [];
  const dailyDoneCount = dailyMissions.filter(m => m.completed).length;
  const dailyClaimableCount = dailyMissions.filter(m => m.completed && !m.claimed).length;
  const readyOrdersCount = state.orders.filter(isOrderReady).length;
  const occupiedCount = state.board.filter(c => c.item !== null).length;

  const draggedRawItem = dragState ? state.board[dragState.fromIdx]?.item : null;
  const draggedItemDef = draggedRawItem
    ? getItemDef(normalizeCategory(draggedRawItem.category), normalizeTier(draggedRawItem.tier))
    : null;

  return (
    <div className="flex flex-col gap-3 px-3 pb-5 max-w-md mx-auto select-none text-slate-900">
      {/* 1. Compact Tasks & Contracts Bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setShowDailyModal(true);
          }}
          className={`flex-1 flex items-center justify-between px-3 py-2 rounded-2xl border shadow-xs cursor-pointer transition ${
            dailyClaimableCount > 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-white border-indigo-200 text-slate-800 hover:bg-indigo-50/60'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Target
              className={`w-4 h-4 shrink-0 ${
                dailyClaimableCount > 0 ? 'text-emerald-600' : 'text-indigo-600'
              }`}
            />
            <span className="text-xs font-extrabold truncate">Daily Tasks</span>
          </span>
          <span
            className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full tabular-nums ${
              dailyClaimableCount > 0
                ? 'bg-emerald-600 text-white animate-pulse'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            {dailyClaimableCount > 0
              ? `${dailyClaimableCount} Ready`
              : `${dailyDoneCount}/${dailyMissions.length || 5}`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setShowContracts(v => !v);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border shadow-xs cursor-pointer transition ${
            readyOrdersCount > 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-white border-sky-200 text-slate-700 hover:bg-sky-50'
          }`}
        >
          <Package className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="text-xs font-extrabold tabular-nums">
            Orders ({readyOrdersCount}/{state.orders.length})
          </span>
          {showContracts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Compact Client Contracts Shelf */}
      {showContracts && (
        <div className="grid grid-cols-3 gap-1.5">
          {state.orders.map(order => {
            const reqs = getOrderRequirements(order);
            const primaryReq = reqs[0];
            const reqDef = getItemDef(normalizeCategory(primaryReq.category), primaryReq.itemTier);
            const ready = isOrderReady(order);
            const avail = getRequirementAvailableCount(primaryReq);
            const avatarSrc = resolveCustomerAvatar(order.customerAvatar);

            return (
              <button
                key={order.id}
                type="button"
                onClick={() => handleOpenOrder(order.id)}
                className={`rounded-2xl p-2 border text-left flex flex-col gap-1 transition cursor-pointer shadow-xs ${
                  ready
                    ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300/70'
                    : 'bg-white border-slate-200 hover:border-sky-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="w-6 h-6 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    {isImageSource(avatarSrc) ? (
                      <img src={avatarSrc} alt={order.customerName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs">{avatarSrc}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full tabular-nums">
                    +{Math.round(order.coinReward)}
                  </span>
                </div>

                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm shrink-0">{reqDef.icon}</span>
                  <span className="text-[10px] font-bold text-slate-800 truncate">
                    T{primaryReq.itemTier} {reqDef.name}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-extrabold tabular-nums">
                  <span className={avail >= primaryReq.quantity ? 'text-emerald-700' : 'text-slate-500'}>
                    {Math.min(avail, primaryReq.quantity)}/{primaryReq.quantity}
                    {reqs.length > 1 ? ` (+${reqs.length - 1})` : ''}
                  </span>
                  {ready && (
                    <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded-md text-[9px]">
                      Ship
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. TACTILE MERGE TABLE CARD */}
      <section
        aria-label="Merge Table"
        className={`rounded-3xl border-2 p-3 shadow-lg flex flex-col gap-2.5 ${boardTheme.shell}`}
      >
        {/* Table Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2
              className={`text-sm font-black tracking-tight ${
                state.settings?.boardTheme === 'obsidian' ? 'text-amber-200' : 'text-slate-900'
              }`}
            >
              Merge Table
            </h2>
            <span
              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full tabular-nums ${
                readyPairs.length > 0
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {readyPairs.length > 0
                ? `${readyPairs.length} pair${readyPairs.length > 1 ? 's' : ''} ready`
                : `${occupiedCount}/25`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {selectedCellIndex !== null && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playSound('click', state.settings.soundFx);
                  setSelectedCellIndex(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-[11px] font-extrabold cursor-pointer transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSortGrid}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[11px] font-extrabold cursor-pointer transition"
              title="Group matching items side-by-side"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort</span>
            </button>
          </div>
        </div>

        {/* Status / Instruction Pill */}
        {notice ? (
          <div
            className={`rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-2 border ${
              notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : notice.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notice.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span className="truncate">{notice.text}</span>
          </div>
        ) : (
          <div
            className={`rounded-xl px-3 py-1.5 text-[11px] font-bold border ${
              selectedItemDef
                ? matchingIndices.length > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <span className="block truncate">
              {selectedItemDef
                ? matchingIndices.length > 0
                  ? `Tap or drag onto a glowing MERGE tile to craft ${nextTierDef?.name || 'next tier'}!`
                  : `${selectedItemDef.name} (T${selectedItemDef.tier}) — tap any empty slot to move.`
                : 'Tap two identical tiles — or drag one onto another — to merge!'}
            </span>
          </div>
        )}

        {/* 5x5 Jewel-Like Tactile Board */}
        <div
          className={`grid grid-cols-5 gap-2 p-2.5 rounded-2xl border shadow-inner touch-none ${boardTheme.tray}`}
        >
          {state.board.map((cell, index) => {
            const rawItem = cell.item;
            const itemCat = rawItem ? normalizeCategory(rawItem.category) : null;
            const itemTier = rawItem && itemCat ? normalizeTier(rawItem.tier, itemCat) : null;
            const itemDef = itemCat && itemTier ? getItemDef(itemCat, itemTier) : null;
            const catMeta = itemCat ? CATEGORY_META[itemCat] : null;

            const isDragSource = dragState?.fromIdx === index;
            const isDragHover = dragState?.hoverIdx === index && dragState.fromIdx !== index;
            const dragWillMerge =
              isDragHover && draggedRawItem && rawItem && canMergeItems(draggedRawItem, rawItem);

            const isSelected = !dragState && selectedCellIndex === index;
            const isMatchTarget =
              showMergeHighlights &&
              (dragState ? dragState.fromIdx !== index : selectedCellIndex !== null) &&
              matchingSet.has(index);
            const isMoveTarget = selectedCellIndex !== null && !rawItem && !dragState;
            const isFlashing = flashCellIndex === index;
            const isNeededForOrder =
              showOrderBadges &&
              itemCat &&
              itemTier &&
              neededOrderKeys.has(`${itemCat}_${itemTier}`);

            if (!rawItem || !itemDef || !catMeta) {
              return (
                <button
                  key={cell.id || `slot_${index}`}
                  type="button"
                  data-cell-index={index}
                  onClick={e => {
                    if (suppressClickRef.current) return;
                    handleCellTap(index, e);
                  }}
                  aria-label={`Empty slot ${index + 1}`}
                  className={`aspect-square w-full min-h-[54px] rounded-2xl border-2 flex items-center justify-center transition-colors duration-150 ${
                    isDragHover
                      ? 'border-sky-500 bg-sky-200/80 shadow-inner'
                      : isMoveTarget
                      ? 'border-dashed border-sky-400 bg-sky-50/90 hover:bg-sky-100 cursor-pointer'
                      : 'border-white/80 bg-white/55 shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] cursor-default'
                  }`}
                >
                  {(isMoveTarget || isDragHover) && (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500/75 pointer-events-none" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={cell.id || `slot_${index}`}
                type="button"
                data-cell-index={index}
                onPointerDown={e => {
                  if (e.button !== 0 && e.pointerType === 'mouse') return;
                  pointerDownRef.current = {
                    fromIdx: index,
                    startX: e.clientX,
                    startY: e.clientY,
                    dragging: false
                  };
                }}
                onClick={e => {
                  if (suppressClickRef.current) return;
                  handleCellTap(index, e);
                }}
                aria-label={`${itemDef.name} Tier ${itemDef.tier}`}
                className={`relative aspect-square w-full min-h-[54px] rounded-2xl bg-gradient-to-br ${
                  itemDef.bgGradient
                } border border-white/60 border-b-[4px] ${
                  catMeta.bottomLip
                } shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_rgba(15,23,42,0.14)] p-1 flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-150 overflow-hidden ${
                  isDragSource
                    ? 'opacity-35 scale-95'
                    : dragWillMerge
                    ? 'ring-4 ring-emerald-400 scale-105 z-10'
                    : isDragHover
                    ? 'ring-3 ring-sky-300 z-10'
                    : isSelected
                    ? 'ring-4 ring-amber-300 brightness-105 z-10'
                    : isMatchTarget
                    ? 'ring-4 ring-emerald-400 z-10'
                    : isFlashing && flashKind === 'merge'
                    ? 'animate-merge-pop ring-4 ring-emerald-300'
                    : isFlashing && flashKind === 'spawn'
                    ? 'animate-merge-pop ring-2 ring-sky-200'
                    : 'hover:brightness-105'
                }`}
              >
                {/* Top-Left: Order Needed Checkmark or Utility Dot */}
                {isNeededForOrder ? (
                  <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-emerald-500 border border-white text-white flex items-center justify-center shadow-xs pointer-events-none z-10">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : itemDef.specialUse ? (
                  <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-yellow-300 ring-2 ring-white/90 pointer-events-none z-10" />
                ) : null}

                {/* Top-Right: Selection / Match Badge */}
                {isSelected ? (
                  <span className="absolute top-1 right-1 bg-amber-400 text-slate-950 border border-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shadow-xs pointer-events-none z-10 leading-none">
                    1st
                  </span>
                ) : isMatchTarget ? (
                  <span className="absolute top-1 right-1 bg-emerald-500 text-white border border-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shadow-xs animate-pulse pointer-events-none z-10 leading-none">
                    Merge
                  </span>
                ) : null}

                {/* Centered Clean Tile Artwork */}
                <div className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center pointer-events-none">
                  {itemDef.image ? (
                    <img
                      src={itemDef.image}
                      alt={itemDef.name}
                      className="w-full h-full object-cover rounded-xl border border-white/50 shadow-sm"
                      draggable={false}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-2xl sm:text-3xl leading-none drop-shadow-[0_2px_3px_rgba(15,23,42,0.28)]">
                      {itemDef.icon}
                    </span>
                  )}
                </div>

                {/* Crisp Bottom-Right Tier Pill */}
                <span className="absolute bottom-1 right-1 bg-slate-950/75 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none tabular-nums pointer-events-none">
                  T{itemDef.tier}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Item Inspector & Quick Actions */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-2.5 flex flex-col gap-2">
          {selectedItemDef && selectedCellItem ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedItemDef.bgGradient} border border-white/70 flex items-center justify-center shrink-0 overflow-hidden shadow-xs`}
                  >
                    {selectedItemDef.image ? (
                      <img
                        src={selectedItemDef.image}
                        alt={selectedItemDef.name}
                        className="w-8 h-8 object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-xl drop-shadow-xs">{selectedItemDef.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        {selectedItemDef.name}
                      </span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                          CATEGORY_META[selectedItemDef.category].chipBg
                        } ${CATEGORY_META[selectedItemDef.category].chipText}`}
                      >
                        {CATEGORY_META[selectedItemDef.category].label} · T{selectedItemDef.tier}/6
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {matchingIndices.length > 0
                        ? `${matchingIndices.length} identical match${matchingIndices.length > 1 ? 'es' : ''} on table`
                        : selectedItemDef.specialUse
                        ? selectedItemDef.specialUse.label
                        : `Asset value ${selectedItemDef.coinValue} Coins`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playSound('click', state.settings.soundFx);
                    setInspectedItem(selectedItemDef);
                  }}
                  className="p-2 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-sky-700 cursor-pointer shrink-0"
                  aria-label="Inspect selected item"
                  title="Full item details"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {matchingIndices.length > 0 && (
                  <button
                    type="button"
                    onClick={handleQuickMergeSelected}
                    className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Merge Twin</span>
                  </button>
                )}

                {selectedItemDef.specialUse && (
                  <button
                    type="button"
                    onClick={handleUseSelectedAsset}
                    className="flex-1 min-w-[100px] py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Use Asset</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleVaultSelected}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-sky-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Vault</span>
                </button>

                <button
                  type="button"
                  onClick={handleSpotSellSelected}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition tabular-nums"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>
                    Sell +{getMarketplaceSpotSellPrice(selectedItemDef.category, selectedItemDef.tier)}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-medium">
                Tap or drag any tile to merge, swap, Vault, or Spot Sell.
              </span>
              {onGoToMarket && (
                <button
                  type="button"
                  onClick={() => onGoToMarket('marketplace')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-sky-700 font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Market</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Primary Action Row: Source Material + Vault Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSpawnItem}
            className={`flex-1 py-3 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition tabular-nums ${
              state.energy > 0
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white'
            }`}
          >
            {state.energy > 0 ? (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Source Material (-1 ⚡)</span>
              </>
            ) : (state.consumables?.energy_cell || 0) > 0 ? (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Use Quick Charge (+15 ⚡)</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>Watch Ad (+15 ⚡)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playSound('click', state.settings.soundFx);
              setShowVault(v => !v);
            }}
            className={`py-3 px-3.5 rounded-2xl border font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition tabular-nums ${
              showVault
                ? 'bg-sky-600 border-sky-600 text-white'
                : 'bg-white hover:bg-sky-50 border-sky-200 text-sky-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>
              Vault ({state.inventory.length}/{state.maxInventoryCapacity})
            </span>
          </button>
        </div>
      </section>

      {/* 3. Ad-Refillable Workshop Boosters */}
      <section className="bg-white border border-violet-200 rounded-3xl p-3 shadow-xs flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span>Workshop Boosters</span>
          </h3>
          <span className="text-[10px] font-semibold text-slate-500">Tap card for info · Ad-refillable</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CONSUMABLE_LIST.map(con => {
            const stock = state.consumables?.[con.id] || 0;
            const hasStock = stock > 0;

            return (
              <div
                key={con.id}
                className={`rounded-2xl border p-2 flex items-center justify-between gap-2 ${
                  hasStock ? 'bg-slate-50/70 border-slate-200' : 'bg-violet-50/40 border-violet-200/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playSound('click', state.settings.soundFx);
                    setInspectedConsumable(con);
                  }}
                  className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                >
                  <span
                    className={`w-8 h-8 rounded-xl bg-gradient-to-br ${con.bgGradient} flex items-center justify-center text-base shrink-0 shadow-xs`}
                  >
                    {con.icon}
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[11px] font-extrabold text-slate-900 truncate">
                      {con.name.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-500 tabular-nums">
                      {stock}/{con.maxStock} · {con.badge}
                    </span>
                  </div>
                </button>

                {hasStock ? (
                  <button
                    type="button"
                    onClick={() => handleUseConsumable(con.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold shrink-0 cursor-pointer transition"
                  >
                    Use
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRefillConsumableAd(con.id)}
                    className="px-2 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer transition"
                  >
                    <PlayCircle className="w-3 h-3" />
                    <span>Ad</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Collapsible Asset Vault Drawer */}
      {showVault && (
        <section className="animate-scaleIn">
          <InventoryView state={state} onUpdateState={onUpdateState} embedded={true} />
        </section>
      )}

      {/* Floating Drag Ghost Preview */}
      {dragState && draggedItemDef && (
        <div
          className={`fixed z-50 w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-gradient-to-br ${draggedItemDef.bgGradient} border-2 border-white shadow-2xl flex items-center justify-center pointer-events-none scale-110`}
          style={{ left: dragState.x, top: dragState.y }}
        >
          {draggedItemDef.image ? (
            <img
              src={draggedItemDef.image}
              alt={draggedItemDef.name}
              className="w-10 h-10 object-cover rounded-xl"
            />
          ) : (
            <span className="text-3xl">{draggedItemDef.icon}</span>
          )}
          <span className="absolute bottom-0.5 right-0.5 bg-slate-950/80 text-white text-[9px] font-black px-1 rounded">
            T{draggedItemDef.tier}
          </span>
        </div>
      )}

      {/* Modals */}
      {showDailyModal && (
        <DailyMissionsModal
          state={state}
          onUpdateState={onUpdateState}
          onClose={() => setShowDailyModal(false)}
          onAddFloatingText={onAddFloatingText}
        />
      )}

      {pendingOrder && (
        <OrderRewardModal
          order={{
            ...pendingOrder,
            coinReward: Math.round(pendingOrder.coinReward * vipMultiplier)
          }}
          onClaimNormal={() => {
            const target = pendingOrder;
            setPendingOrder(null);
            executeOrderFulfillment(target, 1);
          }}
          onClaimDoubleWithAd={() => {
            const target = pendingOrder;
            setPendingOrder(null);
            onTriggerRewardedAd('double_earnings', () => executeOrderFulfillment(target, 2));
          }}
          onClose={() => setPendingOrder(null)}
        />
      )}

      {inspectedItem && (
        <ItemDetailModal item={inspectedItem} onClose={() => setInspectedItem(null)} />
      )}

      {inspectedConsumable && (
        <ItemDetailModal
          consumable={inspectedConsumable}
          consumableStock={state.consumables?.[inspectedConsumable.id] || 0}
          onUseConsumable={() => handleUseConsumable(inspectedConsumable.id)}
          onRefillConsumable={() => handleRefillConsumableAd(inspectedConsumable.id)}
          onClose={() => setInspectedConsumable(null)}
        />
      )}
    </div>
  );
};
