import React, { useState, useEffect } from 'react';
import { GameState, ConsumableDef, ConsumableId } from '../types';
import {
  Store,
  Zap,
  Gem,
  Coins,
  PlayCircle,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  Info,
  Clock
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { CONSUMABLE_LIST, CONSUMABLE_DEFINITIONS } from '../data/gameData';
import { executeConsumableUse } from '../utils/consumables';
import { MarketplacePanel } from './MarketplacePanel';
import { ItemDetailModal } from './ItemDetailModal';
import { AdRewardType } from './AdModal';
import confetti from 'canvas-confetti';

export type MarketSubTab = 'marketplace' | 'consumables' | 'currency' | 'daily';

interface ShopViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onTriggerRewardedAd: (rewardType: AdRewardType, onComplete: () => void, adDetail?: string) => void;
  onAddFloatingText?: (text: string, x: number, y: number, color?: string) => void;
  onGoToWorkshop?: () => void;
  initialSubTab?: MarketSubTab;
}

interface RewardModalData {
  title: string;
  subtitle: string;
  coins?: number;
  gems?: number;
  energy?: number;
}

export const ShopView: React.FC<ShopViewProps> = ({
  state,
  onUpdateState,
  onTriggerRewardedAd,
  onAddFloatingText,
  onGoToWorkshop,
  initialSubTab = 'marketplace'
}) => {
  const [activeTab, setActiveTab] = useState<MarketSubTab>(initialSubTab);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rewardModal, setRewardModal] = useState<RewardModalData | null>(null);
  const [inspectedConsumable, setInspectedConsumable] = useState<ConsumableDef | null>(null);

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  const [dailyGiftClaimed, setDailyGiftClaimed] = useState<boolean>(() => {
    try {
      const savedDate = localStorage.getItem('idle_factory_shop_daily_gift');
      const today = new Date().toISOString().slice(0, 10);
      return savedDate === today;
    } catch {
      return false;
    }
  });

  const [timeUntilMidnight, setTimeUntilMidnight] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeUntilMidnight(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3200);
  };

  const openCelebration = (data: RewardModalData) => {
    soundManager.playSound('upgrade', state.settings.soundFx);
    confetti({ particleCount: 55, spread: 70, origin: { y: 0.45 } });
    setRewardModal(data);
  };

  const handleUseConsumable = (id: ConsumableId) => {
    const result = executeConsumableUse(state, id);
    if (!result.ok) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(result.message, 'error');
      return;
    }

    onUpdateState(prev => {
      const fresh = executeConsumableUse(prev, id);
      return fresh.nextState;
    });

    soundManager.playSound('upgrade', state.settings.soundFx);
    if (result.triggerConfetti) {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.5 } });
    }
    notify(result.message, 'success');
    if (result.floatingText && onAddFloatingText) {
      onAddFloatingText(result.floatingText.text, window.innerWidth / 2, window.innerHeight / 2, result.floatingText.color);
    }
  };

  const handleRefillConsumableWithAd = (id: ConsumableId) => {
    const def = CONSUMABLE_DEFINITIONS[id];
    const current = state.consumables?.[id] || 0;
    if (current >= def.maxStock) {
      notify(`${def.name} is already at max stock (${def.maxStock}).`, 'error');
      return;
    }

    onTriggerRewardedAd(
      'consumable_refill',
      () => {
        onUpdateState(prev => {
          const cur = prev.consumables?.[id] || 0;
          return {
            ...prev,
            consumables: {
              ...prev.consumables,
              [id]: Math.min(def.maxStock, cur + 1)
            }
          };
        });
        soundManager.playSound('upgrade', state.settings.soundFx);
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.5 } });
        notify(`Refilled +1 ${def.name}`, 'success');
        if (onAddFloatingText) {
          onAddFloatingText(`+1 ${def.name}`, window.innerWidth / 2, window.innerHeight / 2, '#7C3AED');
        }
      },
      `Refill +1 ${def.name}`
    );
  };

  const handleBuyCoinsWithGems = (gemCost: number, coinGain: number, tierLabel: string) => {
    if (state.gems < gemCost) {
      soundManager.playSound('error', state.settings.soundFx);
      notify('Insufficient Gems for this exchange.', 'error');
      return;
    }

    onUpdateState(prev => {
      soundManager.playSound('coin', prev.settings.soundFx);
      return {
        ...prev,
        gems: prev.gems - gemCost,
        coins: prev.coins + coinGain,
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + coinGain
        }
      };
    });

    if (onAddFloatingText) {
      onAddFloatingText(`+${coinGain.toLocaleString()} Coins`, window.innerWidth / 2, window.innerHeight / 2, '#D97706');
    }

    openCelebration({
      title: `${tierLabel} Completed`,
      subtitle: `Converted ${gemCost} Gems into ${coinGain.toLocaleString()} Coins`,
      coins: coinGain
    });
  };

  const handleClaimDailyGift = () => {
    if (dailyGiftClaimed) {
      notify(`Daily Ration claimed. Resets in ${timeUntilMidnight}`, 'success');
      return;
    }

    const freeCoins = 80;
    const freeEnergy = 6;

    onUpdateState(prev => ({
      ...prev,
      coins: prev.coins + freeCoins,
      energy: Math.min(prev.maxEnergy, prev.energy + freeEnergy),
      stats: {
        ...prev.stats,
        totalCoinsEarned: prev.stats.totalCoinsEarned + freeCoins
      }
    }));

    try {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('idle_factory_shop_daily_gift', today);
    } catch {
      // Ignore storage errors
    }

    setDailyGiftClaimed(true);

    if (onAddFloatingText) {
      onAddFloatingText('+80 Coins · +6 Energy', window.innerWidth / 2, window.innerHeight / 2, '#059669');
    }

    openCelebration({
      title: 'Daily Shift Ration',
      subtitle: 'Supply stipend for active plant operators.',
      coins: freeCoins,
      energy: freeEnergy
    });
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-md mx-auto p-3 select-none text-slate-900 pb-14">
      {/* Header */}
      <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-violet-600" />
            <span>Marketplace & Supply Hub</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Trade workshop items freely, refill tactical consumables via ads, or exchange Gems.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 border shadow-sm ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <CheckCircle2
            className={`w-4 h-4 shrink-0 ${
              feedbackMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* 4-Tab Navigation */}
      <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        {([
          { id: 'marketplace', label: 'Trade' },
          { id: 'consumables', label: 'Consumables' },
          { id: 'currency', label: 'Exchange' },
          { id: 'daily', label: dailyGiftClaimed ? 'Daily' : 'Daily (1)' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              soundManager.playSound('click', state.settings.soundFx);
              setActiveTab(tab.id);
            }}
            className={`py-2 px-1 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TRADE MARKETPLACE TAB */}
      {activeTab === 'marketplace' && (
        <MarketplacePanel
          state={state}
          onUpdateState={onUpdateState}
          onAddFloatingText={onAddFloatingText}
        />
      )}

      {/* AD-REFILLABLE CONSUMABLES TAB */}
      {activeTab === 'consumables' && (
        <div className="flex flex-col gap-3">
          <div className="bg-gradient-to-r from-violet-50 via-white to-sky-50 border border-violet-200 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-300 flex items-center justify-center text-violet-700 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">Ad-Refillable Consumables</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    100% free — watch a short sponsored ad to refill any consumable charge.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {CONSUMABLE_LIST.map(con => {
              const stock = state.consumables?.[con.id] || 0;
              const isFull = stock >= con.maxStock;
              const hasCharge = stock > 0;

              return (
                <div
                  key={con.id}
                  onClick={() => {
                    soundManager.playSound('click', state.settings.soundFx);
                    setInspectedConsumable(con);
                  }}
                  className={`bg-white border-2 ${con.borderClass} rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm cursor-pointer hover:shadow-md transition`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${con.bgGradient} border border-white shadow-sm flex items-center justify-center text-2xl shrink-0`}
                      >
                        {con.icon}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-extrabold text-slate-900 truncate">{con.name}</h4>
                          <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        </div>
                        <span className="text-[11px] font-bold text-violet-700">{con.badge}</span>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{con.shortDesc}</p>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-extrabold font-mono-num px-2.5 py-1 rounded-xl border shrink-0 tabular-nums ${
                        hasCharge
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                    >
                      {stock}/{con.maxStock}
                    </span>
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleUseConsumable(con.id)}
                      disabled={!hasCharge}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs transition active:scale-95 ${
                        hasCharge
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      {hasCharge ? 'Use Now' : 'Empty'}
                    </button>

                    <button
                      onClick={() => handleRefillConsumableWithAd(con.id)}
                      disabled={isFull}
                      className={`flex-[1.35] py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        isFull
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm cursor-pointer'
                      }`}
                    >
                      <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{isFull ? 'Max Stock' : 'Refill +1 · Watch Ad'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EXCHANGE & SPONSORED BOOSTS TAB */}
      {activeTab === 'currency' && (
        <div className="flex flex-col gap-4">
          {/* Ad Boosts */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-violet-800">Sponsored Video Boosts</span>
              <span className="text-[11px] text-slate-500 font-medium">Watch ad to earn</span>
            </div>

            <div className="bg-white border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-2.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-sm font-extrabold text-amber-700 shrink-0">
                  2x
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-slate-900">2x Plant Output (5m)</span>
                  <span className="text-[11px] text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" /> Double all machine coins for 5 mins
                  </span>
                </div>
              </div>

              <button
                onClick={() =>
                  onTriggerRewardedAd('double_earnings', () => {
                    const now = Date.now();
                    onUpdateState(prev => {
                      const base = Math.max(now, prev.doubleEarningsUntil || 0);
                      return {
                        ...prev,
                        doubleEarningsUntil: Math.min(now + 15 * 60 * 1000, base + 5 * 60 * 1000)
                      };
                    });
                    notify('2x Machine Output active for +5 minutes!', 'success');
                    if (onAddFloatingText) {
                      onAddFloatingText('2x Plant Output (5m)', window.innerWidth / 2, window.innerHeight / 2, '#D97706');
                    }
                  })
                }
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition shrink-0 cursor-pointer whitespace-nowrap"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Watch Ad</span>
              </button>
            </div>
          </div>

          {/* Gem-to-Coin Exchange */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-amber-800">Gem-to-Coin Exchange</span>
              <span className="text-[11px] text-slate-500 font-medium">Spend earned Gems</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { gems: 10, coins: 600, label: 'Working Capital' },
                { gems: 30, coins: 2000, label: 'Operating Fund' },
                { gems: 75, coins: 5500, label: 'Plant Reserve' },
                { gems: 140, coins: 12000, label: 'Capital Ledger' }
              ].map(tier => (
                <div
                  key={tier.label}
                  className="bg-white border border-amber-200 rounded-2xl p-3 flex flex-col justify-between gap-2.5 shadow-sm"
                >
                  <div>
                    <div className="text-sm font-extrabold text-amber-700 tabular-nums flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span>{tier.coins.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{tier.label}</div>
                  </div>
                  <button
                    onClick={() => handleBuyCoinsWithGems(tier.gems, tier.coins, tier.label)}
                    className="w-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 rounded-xl py-2 font-bold text-xs active:scale-95 transition cursor-pointer tabular-nums flex items-center justify-center gap-1"
                  >
                    <Gem className="w-3.5 h-3.5 text-cyan-600" />
                    <span>{tier.gems} Gems</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DAILY & ADS TAB */}
      {activeTab === 'daily' && (
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-slate-900">Daily Supply Ration</span>
              <span className="text-[11px] text-slate-600 tabular-nums mt-0.5">
                +80 Coins · +6 Energy {dailyGiftClaimed ? `· Resets ${timeUntilMidnight}` : '· Available now'}
              </span>
            </div>

            <button
              onClick={handleClaimDailyGift}
              disabled={dailyGiftClaimed}
              className={`px-3 py-2 rounded-xl font-bold text-xs transition shrink-0 ${
                dailyGiftClaimed
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer active:scale-95 shadow-sm'
              }`}
            >
              {dailyGiftClaimed ? 'Claimed' : 'Collect'}
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold text-slate-800">Sponsored Video Stipends</span>
            <span className="text-[11px] text-slate-500">Watch ad to claim</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() =>
                onTriggerRewardedAd('energy', () => {
                  onUpdateState(prev => ({
                    ...prev,
                    energy: Math.min(prev.maxEnergy, prev.energy + 12)
                  }));
                  notify('+12 Energy restored.', 'success');
                  if (onAddFloatingText) {
                    onAddFloatingText('+12 Energy', window.innerWidth / 2, window.innerHeight / 2, '#059669');
                  }
                })
              }
              className="bg-white border border-emerald-200 hover:border-emerald-400 rounded-2xl p-3.5 flex flex-col items-center gap-2 active:scale-95 transition text-center cursor-pointer shadow-sm"
            >
              <Zap className="w-6 h-6 text-emerald-500" />
              <span className="text-xs font-extrabold text-slate-900">+12 Energy</span>
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                <PlayCircle className="w-3.5 h-3.5" /> Watch Ad
              </span>
            </button>

            <button
              onClick={() =>
                onTriggerRewardedAd('coins', () => {
                  onUpdateState(prev => ({
                    ...prev,
                    coins: prev.coins + 180,
                    stats: {
                      ...prev.stats,
                      totalCoinsEarned: prev.stats.totalCoinsEarned + 180
                    }
                  }));
                  notify('+180 Coins credited.', 'success');
                  if (onAddFloatingText) {
                    onAddFloatingText('+180 Coins', window.innerWidth / 2, window.innerHeight / 2, '#D97706');
                  }
                })
              }
              className="bg-white border border-amber-200 hover:border-amber-400 rounded-2xl p-3.5 flex flex-col items-center gap-2 active:scale-95 transition text-center cursor-pointer shadow-sm"
            >
              <Coins className="w-6 h-6 text-amber-500" />
              <span className="text-xs font-extrabold text-slate-900">+180 Coins</span>
              <span className="text-[11px] text-amber-600 flex items-center gap-1 font-bold">
                <PlayCircle className="w-3.5 h-3.5" /> Watch Ad
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Full Consumable Description Modal */}
      {inspectedConsumable && (
        <ItemDetailModal
          consumable={inspectedConsumable}
          consumableStock={state.consumables?.[inspectedConsumable.id] || 0}
          onUseConsumable={() => handleUseConsumable(inspectedConsumable.id)}
          onRefillConsumable={() => handleRefillConsumableWithAd(inspectedConsumable.id)}
          onClose={() => setInspectedConsumable(null)}
        />
      )}

      {/* Claim Confirmation Modal */}
      {rewardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-scaleIn">
          <div className="bg-white border-2 border-amber-300 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative text-slate-900">
            <button
              onClick={() => setRewardModal(null)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-extrabold text-slate-900 mt-1">{rewardModal.title}</h3>
            <p className="text-xs text-slate-600 mt-1 mb-4">{rewardModal.subtitle}</p>

            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 mb-4 text-left">
              <div className="grid grid-cols-2 gap-2">
                {rewardModal.coins !== undefined && rewardModal.coins > 0 && (
                  <div className="bg-white border border-amber-200 rounded-xl p-2 flex items-center gap-2 tabular-nums">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-extrabold text-amber-800">+{rewardModal.coins.toLocaleString()}</span>
                  </div>
                )}

                {rewardModal.gems !== undefined && rewardModal.gems > 0 && (
                  <div className="bg-white border border-cyan-200 rounded-xl p-2 flex items-center gap-2 tabular-nums">
                    <Gem className="w-4 h-4 text-cyan-500" />
                    <span className="text-xs font-extrabold text-cyan-800">+{rewardModal.gems}</span>
                  </div>
                )}

                {rewardModal.energy !== undefined && rewardModal.energy > 0 && (
                  <div className="bg-white border border-emerald-200 rounded-xl p-2 flex items-center gap-2 tabular-nums">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-extrabold text-emerald-800">+{rewardModal.energy} Energy</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              {onGoToWorkshop && (
                <button
                  onClick={() => {
                    soundManager.playSound('click', state.settings.soundFx);
                    setRewardModal(null);
                    onGoToWorkshop();
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer shadow-sm"
                >
                  <span>Go to Workshop</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => {
                  soundManager.playSound('click', state.settings.soundFx);
                  setRewardModal(null);
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition cursor-pointer ${
                  onGoToWorkshop
                    ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
