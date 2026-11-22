import React, { useState } from 'react';
import { GameState, ItemCategory } from '../types';
import {
  getItemDef,
  getMarketplaceBuyPrice,
  getMarketplaceSpotSellPrice,
  MARKETPLACE_CATALOG,
  getOrderRequirements
} from '../data/gameData';
import {
  Store,
  Coins,
  ArrowUpRight,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Package,
  Lock
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { recordDailyMissionProgress } from '../utils/dailyMissions';

interface MarketplacePanelProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onAddFloatingText?: (text: string, x: number, y: number, color?: string) => void;
}

type CategoryFilter = 'all' | 'wood' | 'metal' | 'tech' | 'gem';

export const MarketplacePanel: React.FC<MarketplacePanelProps> = ({
  state,
  onUpdateState,
  onAddFloatingText
}) => {
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 2600);
  };

  const freeBoardSlots = state.board.filter(c => c.item === null).length;
  const freeVaultSlots = Math.max(0, state.maxInventoryCapacity - state.inventory.length);

  // Check whether an item is currently needed by an active Contract
  const isNeededForOrder = (category: ItemCategory, tier: number) => {
    return state.orders.some(order =>
      getOrderRequirements(order).some(
        req => (req.category || 'wood') === category && req.itemTier === tier
      )
    );
  };

  const handleBuyItem = (category: ItemCategory, tier: number) => {
    const price = getMarketplaceBuyPrice(category, tier);
    const def = getItemDef(category, tier);

    if (state.coins < price) {
      soundManager.playSound('error', state.settings.soundFx);
      showFeedback('error', `Needs ${price.toLocaleString()} Coins to buy ${def.name}.`);
      return;
    }

    if (freeBoardSlots === 0 && freeVaultSlots === 0) {
      soundManager.playSound('error', state.settings.soundFx);
      showFeedback('error', 'Workshop Grid and Asset Vault are full. Merge or sell an item first.');
      return;
    }

    let destination = 'Workshop Grid';

    onUpdateState(prev => {
      const nextBoard = [...prev.board];
      const nextInv = [...prev.inventory];
      const newItem = {
        id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tier,
        category
      };

      const emptyCellIdx = nextBoard.findIndex(c => c.item === null);
      if (emptyCellIdx !== -1) {
        nextBoard[emptyCellIdx] = { ...nextBoard[emptyCellIdx], item: newItem };
        destination = 'Workshop Grid';
      } else if (nextInv.length < prev.maxInventoryCapacity) {
        nextInv.push(newItem);
        destination = 'Asset Vault';
      } else {
        return prev;
      }

      soundManager.playSound('coin', prev.settings.soundFx);
      return {
        ...prev,
        coins: prev.coins - price,
        board: nextBoard,
        inventory: nextInv
      };
    });

    showFeedback('success', `Bought T${tier} ${def.name} · Placed in ${destination}`);
    if (onAddFloatingText && state.settings.showFloatingRewards !== false) {
      onAddFloatingText(`-${price} Coins · +${def.name}`, window.innerWidth / 2, window.innerHeight / 2, '#0EA5E9');
    }
  };

  // Aggregate sellable items (Board + Vault)
  const sellableGroups = React.useMemo(() => {
    const map = new Map<
      string,
      {
        category: ItemCategory;
        tier: number;
        boardCount: number;
        vaultCount: number;
      }
    >();

    state.board.forEach(cell => {
      if (!cell.item) return;
      const cat = (cell.item.category || 'wood') as ItemCategory;
      const key = `${cat}_${cell.item.tier}`;
      const existing = map.get(key) || { category: cat, tier: cell.item.tier, boardCount: 0, vaultCount: 0 };
      existing.boardCount += 1;
      map.set(key, existing);
    });

    state.inventory.forEach(item => {
      const cat = (item.category || 'wood') as ItemCategory;
      const key = `${cat}_${item.tier}`;
      const existing = map.get(key) || { category: cat, tier: item.tier, boardCount: 0, vaultCount: 0 };
      existing.vaultCount += 1;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.tier - a.tier || a.category.localeCompare(b.category));
  }, [state.board, state.inventory]);

  const handleSellStock = (category: ItemCategory, tier: number, quantityToSell: number) => {
    const unitPrice = getMarketplaceSpotSellPrice(category, tier);
    const def = getItemDef(category, tier);

    let soldActual = 0;
    onUpdateState(prev => {
      let remaining = quantityToSell;
      // Prefer selling from Asset Vault first, then Board so active workspace stays intact when possible
      const nextInv = prev.inventory.filter(item => {
        if (remaining > 0 && (item.category || 'wood') === category && item.tier === tier) {
          remaining--;
          soldActual++;
          return false;
        }
        return true;
      });

      const nextBoard = prev.board.map(cell => {
        if (remaining > 0 && cell.item && (cell.item.category || 'wood') === category && cell.item.tier === tier) {
          remaining--;
          soldActual++;
          return { ...cell, item: null };
        }
        return cell;
      });

      if (soldActual === 0) return prev;

      const totalEarned = unitPrice * soldActual;
      soundManager.playSound('coin', prev.settings.soundFx);
      const nextDaily = recordDailyMissionProgress(prev.dailyState, 'earn_coins', totalEarned);

      return {
        ...prev,
        coins: prev.coins + totalEarned,
        board: nextBoard,
        inventory: nextInv,
        dailyState: nextDaily,
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + totalEarned
        }
      };
    });

    const earned = unitPrice * quantityToSell;
    showFeedback('success', `Sold ${quantityToSell}x ${def.name} for +${earned.toLocaleString()} Coins`);
    if (onAddFloatingText && state.settings.showFloatingRewards !== false) {
      onAddFloatingText(`+${earned.toLocaleString()} Coins`, window.innerWidth / 2, window.innerHeight / 2, '#10B981');
    }
  };

  const filteredCatalog = MARKETPLACE_CATALOG.filter(
    entry => categoryFilter === 'all' || entry.category === categoryFilter
  );

  const filteredSellGroups = sellableGroups.filter(
    entry => categoryFilter === 'all' || entry.category === categoryFilter
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Market Comparison & Storage Capacity Banner */}
      <div className="bg-gradient-to-br from-sky-50 via-white to-amber-50 border border-sky-200 rounded-2xl p-3.5 shadow-sm flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">Open Item Marketplace</h3>
              <p className="text-[11px] text-slate-600">
                Buy missing parts or sell extra items anytime without an order.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 text-[11px]">
          <span className="text-amber-900 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Spot Sell pays ~65% · Client Contracts pay 135%–155%+ + XP & Gems</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-600 px-0.5 tabular-nums">
          <span className="flex items-center gap-1 font-semibold">
            <Package className="w-3.5 h-3.5 text-sky-600" /> Free Grid Slots: <strong className="text-slate-900">{freeBoardSlots}</strong>
          </span>
          <span className="font-semibold">
            Free Vault Slots: <strong className="text-slate-900">{freeVaultSlots}</strong>
          </span>
        </div>
      </div>

      {/* Buy / Sell Mode Toggle */}
      <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setTradeMode('buy');
          }}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            tradeMode === 'buy'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Buy Supplies</span>
        </button>

        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setTradeMode('sell');
          }}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer tabular-nums ${
            tradeMode === 'sell'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Sell Stock ({sellableGroups.reduce((acc, g) => acc + g.boardCount + g.vaultCount, 0)})</span>
        </button>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar shadow-sm">
        {([
          { id: 'all', label: 'All' },
          { id: 'wood', label: 'Timber' },
          { id: 'metal', label: 'Alloy' },
          { id: 'tech', label: 'Tech' },
          { id: 'gem', label: 'Minerals' }
        ] as const).map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              soundManager.playSound('click', state.settings.soundFx);
              setCategoryFilter(cat.id);
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
              categoryFilter === cat.id
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* BUY SUPPLIES CATALOG */}
      {tradeMode === 'buy' && (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredCatalog.map(entry => {
            const def = getItemDef(entry.category, entry.tier);
            const price = getMarketplaceBuyPrice(entry.category, entry.tier);
            const isUnlocked = state.level >= entry.unlockLevel;
            const needed = isNeededForOrder(entry.category, entry.tier);

            return (
              <div
                key={`${entry.category}_${entry.tier}`}
                className={`bg-white border rounded-2xl p-3 flex flex-col justify-between gap-2.5 shadow-sm transition ${
                  needed
                    ? 'border-emerald-400 ring-1 ring-emerald-200'
                    : isUnlocked
                    ? 'border-slate-200'
                    : 'border-slate-200 opacity-65'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${def.bgGradient} border flex items-center justify-center shrink-0 overflow-hidden shadow-sm`}
                  >
                    {def.image ? (
                      <img src={def.image} alt={def.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xl">{def.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                      Tier {def.tier} · {def.category}
                    </span>
                    <h4 className="text-xs font-extrabold text-slate-900 leading-tight truncate">{def.name}</h4>
                    {needed && (
                      <span className="text-[10px] font-bold text-emerald-600 block">Needed for Order</span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">{def.description}</p>

                {isUnlocked ? (
                  <button
                    onClick={() => handleBuyItem(entry.category, entry.tier)}
                    className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer tabular-nums"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-200" />
                    <span>Buy · {price.toLocaleString()}</span>
                  </button>
                ) : (
                  <div className="w-full py-2 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 font-bold text-[11px] text-center flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Unlocks Lvl {entry.unlockLevel}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SELL STOCK (WITHOUT ORDERS) */}
      {tradeMode === 'sell' && (
        <div className="flex flex-col gap-2.5">
          {filteredSellGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col items-center gap-2 shadow-sm">
              <Package className="w-8 h-8 text-slate-400 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-800">No standard items ready to sell</p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Craft components in the Workshop or move items to your Vault to sell them here anytime—even without a matching order.
              </p>
            </div>
          ) : (
            filteredSellGroups.map(group => {
              const def = getItemDef(group.category, group.tier);
              const totalCount = group.boardCount + group.vaultCount;
              const spotPrice = getMarketplaceSpotSellPrice(group.category, group.tier);
              const orderEstimate = Math.round(def.coinValue * 1.45);
              const needed = isNeededForOrder(group.category, group.tier);

              return (
                <div
                  key={`${group.category}_${group.tier}`}
                  className={`bg-white border rounded-2xl p-3 flex items-center justify-between gap-2.5 shadow-sm ${
                    needed ? 'border-amber-300' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${def.bgGradient} border flex items-center justify-center shrink-0 overflow-hidden shadow-sm`}
                    >
                      {def.image ? (
                        <img src={def.image} alt={def.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-xl">{def.icon}</span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          T{def.tier} {def.name}
                        </span>
                        <span className="text-[11px] font-bold text-sky-700 tabular-nums">×{totalCount}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        Grid: {group.boardCount} · Vault: {group.vaultCount}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-700 tabular-nums">
                        {needed ? 'Active Contract pays ~' : 'Orders pay ~'}
                        {orderEstimate.toLocaleString()} (+XP)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      onClick={() => handleSellStock(group.category, group.tier, 1)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-sm active:scale-95 transition cursor-pointer tabular-nums whitespace-nowrap"
                    >
                      Sell 1 · +{spotPrice}
                    </button>

                    {totalCount > 1 && (
                      <button
                        onClick={() => handleSellStock(group.category, group.tier, totalCount)}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold text-[10px] active:scale-95 transition cursor-pointer tabular-nums whitespace-nowrap"
                      >
                        Sell All ({totalCount}) · +{(spotPrice * totalCount).toLocaleString()}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
