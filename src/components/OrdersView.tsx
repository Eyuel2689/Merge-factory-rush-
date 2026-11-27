import React, { useState } from 'react';
import { GameState, Order, OrderRequirement } from '../types';
import {
  getItemDef,
  generateRandomOrder,
  getOrderRequirements,
  resolveCustomerAvatar,
  isImageSource
} from '../data/gameData';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Gem,
  PlayCircle,
  Coins,
  ClipboardCheck,
  Target,
  Trophy,
  RefreshCw
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { triggerConfetti } from '../utils/confettiSafe';
import { isInterstitialReady, showNativeInterstitialAd } from '../services/admob';
import { recordDailyMissionProgress } from '../utils/dailyMissions';
import { getContractPayoutMultiplier } from '../utils/economy';
import { DailyMissionsView } from './DailyMissionsView';
import { AchievementsView } from './AchievementsView';

interface OrdersViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onTriggerInterstitialAd: (onComplete: () => void) => void;
  onTriggerRewardedAd: (rewardType: 'energy' | 'coins' | 'double_earnings', onComplete: () => void) => void;
  onAddFloatingText: (text: string, x: number, y: number, color?: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  state,
  onUpdateState,
  onTriggerInterstitialAd,
  onTriggerRewardedAd,
  onAddFloatingText
}) => {
  const [section, setSection] = useState<'contracts' | 'daily' | 'milestones'>('contracts');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 2500);
  };

  const getRequirementAvailableCount = (req: OrderRequirement) => {
    const reqCat = req.category || 'wood';
    const boardCount = state.board.filter(
      c => c.item && c.item.tier === req.itemTier && (c.item.category || 'wood') === reqCat
    ).length;
    const invCount = state.inventory.filter(
      i => i.tier === req.itemTier && (i.category || 'wood') === reqCat
    ).length;
    return boardCount + invCount;
  };

  const isOrderReady = (order: Order) => {
    const reqs = getOrderRequirements(order);
    return reqs.every(req => getRequirementAvailableCount(req) >= req.quantity);
  };

  const unclaimedDailyCount = (state.dailyState?.missions || []).filter(
    m => m.completed && !m.claimed
  ).length;
  const unclaimedMilestonesCount = state.achievements.filter(
    a => !a.claimed && a.currentValue >= a.targetValue
  ).length;

  const vipMultiplier = getContractPayoutMultiplier(state);

  const getContractCoinReward = (order: Order) =>
    Math.round(Math.max(10, order.coinReward) * vipMultiplier);

  const REFRESH_CONTRACT_COST = 100;

  const handleRefreshContract = (orderId: string) => {
    if (state.coins < REFRESH_CONTRACT_COST) {
      soundManager.playSound('error', state.settings.soundFx);
      showError(`Needs ${REFRESH_CONTRACT_COST} Coins to refresh this contract.`);
      return;
    }

    onUpdateState(prev => {
      if (prev.coins < REFRESH_CONTRACT_COST) return prev;
      return {
        ...prev,
        coins: prev.coins - REFRESH_CONTRACT_COST,
        orders: prev.orders.map(o =>
          o.id === orderId
            ? generateRandomOrder(`ord_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, prev.level)
            : o
        )
      };
    });

    soundManager.playSound('click', state.settings.soundFx);
    onAddFloatingText('-100 Coins · New Contract', window.innerWidth / 2, window.innerHeight * 0.45, '#0284C7');
  };

  const handleFulfillOrder = (orderId: string, earningsMultiplier: 1 | 2 = 1) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    if (!isOrderReady(order)) {
      soundManager.playSound('error', state.settings.soundFx);
      showError('Contract requirements not met yet.');
      return;
    }

    const fulfillAction = () => {
      let didFulfill = false;
      let shippedCoins = getContractCoinReward(order) * earningsMultiplier;
      let shippedGems = (order.gemReward || 0) * earningsMultiplier;
      let leveledUp = false;

      onUpdateState(prev => {
        const targetOrder = prev.orders.find(o => o.id === orderId);
        if (!targetOrder) return prev;

        const reqs = getOrderRequirements(targetOrder);

        // Verify inside functional updater to prevent rapid double-tap races
        const canStillFulfill = reqs.every(req => {
          const reqCat = req.category || 'wood';
          const bCount = prev.board.filter(
            c => c.item && c.item.tier === req.itemTier && (c.item.category || 'wood') === reqCat
          ).length;
          const iCount = prev.inventory.filter(
            i => i.tier === req.itemTier && (i.category || 'wood') === reqCat
          ).length;
          return bCount + iCount >= req.quantity;
        });

        if (!canStillFulfill) return prev;

        let nextBoard = [...prev.board];
        let nextInventory = [...prev.inventory];

        reqs.forEach(req => {
          const reqCat = req.category || 'wood';
          let needed = req.quantity;

          nextBoard = nextBoard.map(cell => {
            if (needed > 0 && cell.item && cell.item.tier === req.itemTier && (cell.item.category || 'wood') === reqCat) {
              needed--;
              return { ...cell, item: null };
            }
            return cell;
          });

          if (needed > 0) {
            nextInventory = nextInventory.filter(item => {
              if (needed > 0 && item.tier === req.itemTier && (item.category || 'wood') === reqCat) {
                needed--;
                return false;
              }
              return true;
            });
          }
        });

        const prevVipMult = getContractPayoutMultiplier(prev);
        const orderCoins = Math.round(Math.max(10, targetOrder.coinReward) * prevVipMult) * earningsMultiplier;
        const orderXp = targetOrder.xpReward;
        const orderGems = (targetOrder.gemReward || 0) * earningsMultiplier;

        shippedCoins = orderCoins;
        shippedGems = orderGems;

        const newOrders = prev.orders.map(o =>
          o.id === orderId ? generateRandomOrder(`ord_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, prev.level) : o
        );

        const nextXP = prev.xp + orderXp;
        let nextLevel = prev.level;
        let nextXPToNext = prev.xpToNextLevel;

        if (nextXP >= nextXPToNext) {
          nextLevel += 1;
          nextXPToNext = Math.round(nextXPToNext * 1.55);
          leveledUp = true;
        }

        const totalOrders = prev.stats.totalOrdersCompleted + 1;
        const updatedAchievements = prev.achievements.map(ach => {
          if (ach.type === 'orders') {
            return { ...ach, currentValue: totalOrders };
          }
          return ach;
        });

        let nextDaily = recordDailyMissionProgress(prev.dailyState, 'orders', 1);
        nextDaily = recordDailyMissionProgress(nextDaily, 'earn_coins', orderCoins);

        didFulfill = true;

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

      if (!didFulfill) {
        // State updater handles actual validation asynchronously on React commit; trigger audio/feedback immediately for responsive UX
        soundManager.playSound(earningsMultiplier === 2 ? 'upgrade' : 'order', state.settings.soundFx);
      } else {
        soundManager.playSound(leveledUp || earningsMultiplier === 2 ? 'upgrade' : 'order', state.settings.soundFx);
      }

      triggerConfetti({ particleCount: earningsMultiplier === 2 ? 75 : 45, spread: 70, origin: { y: 0.5 } });
      onAddFloatingText(
        earningsMultiplier === 2
          ? `2x · +${shippedCoins.toLocaleString()} Coins${shippedGems > 0 ? ` +${shippedGems} Gems` : ''}`
          : `+${shippedCoins.toLocaleString()} Coins${shippedGems > 0 ? ` +${shippedGems} Gems` : ''}`,
        window.innerWidth / 2,
        window.innerHeight / 2,
        '#D97706'
      );
    };

    if (earningsMultiplier === 2) {
      onTriggerRewardedAd('double_earnings', fulfillAction);
    } else {
      // Always ship orders immediately face-to-face without trapping the user behind a loading overlay
      fulfillAction();
      const nextCount = state.stats.totalOrdersCompleted + 1;
      if (nextCount > 0 && nextCount % 4 === 0 && isInterstitialReady()) {
        setTimeout(() => {
          void showNativeInterstitialAd();
        }, 350);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-md mx-auto p-3 select-none text-slate-900 pb-6">
      {/* Unified Contracts & Tasks Switcher */}
      <div className="bg-white p-1.5 rounded-2xl border border-indigo-200/80 grid grid-cols-3 gap-1 shadow-sm">
        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setSection('contracts');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-bold text-xs transition cursor-pointer ${
            section === 'contracts'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Contracts</span>
        </button>

        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setSection('daily');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-bold text-xs transition cursor-pointer ${
            section === 'daily'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Daily</span>
          {unclaimedDailyCount > 0 && (
            <span className="text-[10px] font-mono-num">({unclaimedDailyCount})</span>
          )}
        </button>

        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setSection('milestones');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-bold text-xs transition cursor-pointer ${
            section === 'milestones'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Milestones</span>
          {unclaimedMilestonesCount > 0 && (
            <span className="text-[10px] font-mono-num">({unclaimedMilestonesCount})</span>
          )}
        </button>
      </div>

      {section === 'daily' && (
        <DailyMissionsView
          state={state}
          onUpdateState={onUpdateState}
          onAddFloatingText={onAddFloatingText}
          embedded={true}
        />
      )}

      {section === 'milestones' && (
        <AchievementsView
          state={state}
          onUpdateState={onUpdateState}
          onAddFloatingText={onAddFloatingText}
          embeddedListOnly={true}
        />
      )}

      {section === 'contracts' && (
        <>
          <div className="bg-gradient-to-r from-emerald-50 via-white to-amber-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> Client Contracts
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Deliver required components for top prices, or watch an ad for 2x payout.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-700 text-xs px-3 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {state.orders.map(order => {
              const reqs = getOrderRequirements(order);
              const ready = isOrderReady(order);
              const baseCoins = getContractCoinReward(order);
              const baseGems = order.gemReward || 0;

              return (
                <div
                  key={order.id}
                  className={`bg-white border rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm transition ${
                    ready ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-indigo-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl overflow-hidden border border-indigo-200 bg-indigo-50 flex items-center justify-center text-xl shrink-0">
                        {(() => {
                          const avatarSrc = resolveCustomerAvatar(order.customerAvatar);
                          return isImageSource(avatarSrc) ? (
                            <img src={avatarSrc} alt={order.customerName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{avatarSrc || '👤'}</span>
                          );
                        })()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {order.customerName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {order.badge || 'Standard Contract'} · #{String(order.id || '0000').slice(-4)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-extrabold tabular-nums shrink-0 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                      <span className="text-amber-700 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-amber-500" /> +{baseCoins}
                      </span>
                      {baseGems > 0 && (
                        <span className="text-sky-700 flex items-center gap-0.5">
                          <Gem className="w-3.5 h-3.5 text-sky-500" /> +{baseGems}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-slate-600">Required Assets</span>
                    <div className="grid grid-cols-2 gap-2">
                      {reqs.map((req, idx) => {
                        const itemDef = getItemDef(req.category, req.itemTier);
                        const avail = getRequirementAvailableCount(req);
                        const isReqMet = avail >= req.quantity;

                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 p-1.5 rounded-lg border ${
                              isReqMet
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                              {itemDef.image ? (
                                <img src={itemDef.image} alt={itemDef.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-lg">{itemDef.icon}</span>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold leading-tight truncate">
                                T{itemDef.tier} {itemDef.name}
                              </span>
                              <span className="text-[10px] text-slate-500 tabular-nums">
                                Stock: <strong className={isReqMet ? 'text-emerald-600' : 'text-amber-600'}>{avail}</strong>/{req.quantity}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRefreshContract(order.id)}
                      title={`Replace contract for ${REFRESH_CONTRACT_COST} Coins`}
                      className="py-2.5 px-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition shrink-0 tabular-nums"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{REFRESH_CONTRACT_COST}</span>
                    </button>

                    <button
                      onClick={() => handleFulfillOrder(order.id, 1)}
                      disabled={!ready}
                      className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 ${
                        ready
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Deliver</span>
                    </button>

                    <button
                      onClick={() => handleFulfillOrder(order.id, 2)}
                      disabled={!ready}
                      className={`flex-[1.3] py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 tabular-nums ${
                        ready
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>2x Ad (+{baseCoins * 2})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
