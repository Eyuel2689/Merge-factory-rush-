import React, { useState, useEffect } from 'react';
import { GameState, ConsumableDef, ConsumableId, ItemCategory } from '../types';
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
  Clock,
  Crown,
  Package,
  ShoppingBag,
  ShieldCheck,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import {
  CONSUMABLE_LIST,
  CONSUMABLE_DEFINITIONS,
  PREMIUM_PERK_DEFS,
  PREMIUM_CRATE_DEFS,
  PremiumPerkDef,
  PremiumCrateDef,
  getItemDef
} from '../data/gameData';
import { executeConsumableUse } from '../utils/consumables';
import { MarketplacePanel } from './MarketplacePanel';
import { ItemDetailModal } from './ItemDetailModal';
import { AdRewardType } from './AdModal';
import { triggerConfetti } from '../utils/confettiSafe';
import {
  IAP_CATALOG,
  IapProductCatalogItem,
  fetchStoreProductsMap,
  purchaseIapProduct,
  restoreOwnedNonConsumableIds,
  isNativeBillingPlatform
} from '../services/iap';
import { IAP_SKU_CONTRACT_SEAL, IAP_SKU_GOLDEN_TURBINE } from '../utils/economy';
import type { Product } from '@capgo/native-purchases';

export type MarketSubTab = 'marketplace' | 'consumables' | 'premium' | 'currency' | 'daily';

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
  badgeText?: string;
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
  const [storeProducts, setStoreProducts] = useState<Record<string, Product>>({});
  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  const isNative = isNativeBillingPlatform();

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    let active = true;
    void fetchStoreProductsMap().then(map => {
      if (active) setStoreProducts(map);
    });
    return () => {
      active = false;
    };
  }, []);

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
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const openCelebration = (data: RewardModalData) => {
    soundManager.playSound('upgrade', state.settings.soundFx);
    triggerConfetti({ particleCount: 55, spread: 70, origin: { y: 0.45 } });
    setRewardModal(data);
  };

  // Grant rewards after verified Google Play IAP completion
  const grantIapEntitlement = (item: IapProductCatalogItem) => {
    const categories: ItemCategory[] = ['wood', 'metal', 'tech', 'gem'];
    const crateRange = item.reward.crateTierRange;
    const rolledCat = categories[Math.floor(Math.random() * categories.length)];
    const rolledTier = crateRange
      ? crateRange[0] + Math.floor(Math.random() * (crateRange[1] - crateRange[0] + 1))
      : 5;

    onUpdateState(prev => {
      const nextConsumables = { ...prev.consumables };
      if (item.reward.consumablesEach) {
        CONSUMABLE_LIST.forEach(c => {
          // Mega bundles can overflow normal stock up to maxStock + 3 so IAP bundles feel truly generous
          nextConsumables[c.id] = Math.min(c.maxStock + 3, (nextConsumables[c.id] || 0) + item.reward.consumablesEach!);
        });
      }
      if (item.reward.specificConsumable) {
        const cDef = CONSUMABLE_DEFINITIONS[item.reward.specificConsumable];
        nextConsumables[item.reward.specificConsumable] = Math.min(
          cDef.maxStock + 3,
          (nextConsumables[item.reward.specificConsumable] || 0) + 1
        );
      }

      const nextBoard = [...prev.board];
      const nextInv = [...prev.inventory];
      if (crateRange) {
        const newItem = {
          id: `iap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          tier: rolledTier,
          category: rolledCat
        };
        const emptyIdx = nextBoard.findIndex(c => c.item === null);
        if (emptyIdx !== -1) {
          nextBoard[emptyIdx] = { ...nextBoard[emptyIdx], item: newItem };
        } else {
          nextInv.push(newItem);
        }
      }

      const prevOwned = prev.ownedIapIds || [];
      const alreadyOwned = prevOwned.includes(item.productId);
      const nextOwned =
        item.kind === 'non_consumable' && !alreadyOwned
          ? [...prevOwned, item.productId]
          : prevOwned;

      const addMaxEnergy =
        item.productId === IAP_SKU_GOLDEN_TURBINE && !alreadyOwned ? 10 : 0;
      const addVaultSlots =
        item.productId === IAP_SKU_CONTRACT_SEAL && !alreadyOwned ? 8 : 0;

      const nextMaxEnergy = prev.maxEnergy + addMaxEnergy;
      const nextEnergy = Math.min(
        nextMaxEnergy,
        prev.energy + (item.reward.energy || 0) + addMaxEnergy
      );

      return {
        ...prev,
        gems: prev.gems + (item.reward.gems || 0),
        maxEnergy: nextMaxEnergy,
        energy: nextEnergy,
        maxInventoryCapacity: prev.maxInventoryCapacity + addVaultSlots,
        board: nextBoard,
        inventory: nextInv,
        consumables: nextConsumables,
        ownedIapIds: nextOwned,
        stats: {
          ...prev.stats,
          highestTierUnlocked: crateRange
            ? Math.max(prev.stats.highestTierUnlocked, rolledTier)
            : prev.stats.highestTierUnlocked
        }
      };
    });

    openCelebration({
      title: `${item.title} Unlocked!`,
      subtitle: item.subtitle,
      gems: item.reward.gems,
      energy: item.reward.energy,
      badgeText: crateRange
        ? `Delivered T${rolledTier} ${getItemDef(rolledCat, rolledTier).name}`
        : item.badge
    });
  };

  const handlePurchaseIap = async (item: IapProductCatalogItem) => {
    const owned = (state.ownedIapIds || []).includes(item.productId);
    if (item.kind === 'non_consumable' && owned) {
      notify(`${item.title} is already permanently active on your workshop.`, 'success');
      return;
    }

    if (purchasingSku) return;
    setPurchasingSku(item.productId);

    const storeProd = storeProducts[item.productId];
    const result = await purchaseIapProduct(item, storeProd?.offerToken);
    setPurchasingSku(null);

    if (result.ok) {
      grantIapEntitlement(item);
    } else {
      soundManager.playSound('error', state.settings.soundFx);
      notify(result.message, 'error');
    }
  };

  const handleRestorePurchases = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    const res = await restoreOwnedNonConsumableIds();
    setIsRestoring(false);

    if (!res.ok) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(res.message, 'error');
      return;
    }

    if (res.ownedIds.length > 0) {
      onUpdateState(prev => {
        const curOwned = prev.ownedIapIds || [];
        const newlyRestored = res.ownedIds.filter(id => !curOwned.includes(id));
        if (newlyRestored.length === 0) return prev;
        const addMaxEnergy = newlyRestored.includes(IAP_SKU_GOLDEN_TURBINE) ? 10 : 0;
        const addVault = newlyRestored.includes(IAP_SKU_CONTRACT_SEAL) ? 8 : 0;
        return {
          ...prev,
          ownedIapIds: Array.from(new Set([...curOwned, ...newlyRestored])),
          maxEnergy: prev.maxEnergy + addMaxEnergy,
          energy: Math.min(prev.maxEnergy + addMaxEnergy, prev.energy + addMaxEnergy),
          maxInventoryCapacity: prev.maxInventoryCapacity + addVault
        };
      });
      soundManager.playSound('upgrade', state.settings.soundFx);
    }

    notify(res.message, 'success');
  };

  const handleUseConsumable = (id: ConsumableId) => {
    const result = executeConsumableUse(state, id);
    if (!result.ok) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(result.message, 'error');
      return;
    }

    onUpdateState(prev => executeConsumableUse(prev, id).nextState);
    soundManager.playSound('upgrade', state.settings.soundFx);
    if (result.triggerConfetti) {
      triggerConfetti({ particleCount: 50, spread: 70, origin: { y: 0.5 } });
    }
    notify(result.message, 'success');
    if (result.floatingText && onAddFloatingText) {
      onAddFloatingText(result.floatingText.text, window.innerWidth / 2, window.innerHeight / 2, result.floatingText.color);
    }
  };

  const handleBuyConsumableCoins = (id: ConsumableId) => {
    const def = CONSUMABLE_DEFINITIONS[id];
    const current = state.consumables?.[id] || 0;
    if (current >= def.maxStock) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`${def.name} is already at max stock (${def.maxStock}).`, 'error');
      return;
    }

    if (state.coins < def.coinPrice) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`Needs ${def.coinPrice.toLocaleString()} Coins or watch an Ad for +1 Free!`, 'error');
      return;
    }

    onUpdateState(prev => {
      const cur = prev.consumables?.[id] || 0;
      if (cur >= def.maxStock || prev.coins < def.coinPrice) return prev;
      return {
        ...prev,
        coins: prev.coins - def.coinPrice,
        consumables: {
          ...prev.consumables,
          [id]: Math.min(def.maxStock, cur + 1)
        }
      };
    });

    soundManager.playSound('coin', state.settings.soundFx);
    triggerConfetti({ particleCount: 28, spread: 50, origin: { y: 0.55 } });
    notify(`Bought +1 ${def.name}!`, 'success');
    onAddFloatingText?.(`+1 ${def.name}`, window.innerWidth / 2, window.innerHeight / 2, '#059669');
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
        triggerConfetti({ particleCount: 40, spread: 60, origin: { y: 0.5 } });
        notify(`Refilled +1 ${def.name} via Ad!`, 'success');
        onAddFloatingText?.(`+1 ${def.name}`, window.innerWidth / 2, window.innerHeight / 2, '#7C3AED');
      },
      `Refill +1 ${def.name}`
    );
  };

  const handleBuyPremiumPerk = (perk: PremiumPerkDef) => {
    const currentLevel = state.premiumPerks?.[perk.id] || 0;
    if (currentLevel >= perk.maxLevel) {
      notify(`${perk.name} is already at max level!`, 'error');
      return;
    }

    const gemCost = perk.baseGemCost + currentLevel * perk.gemStep;
    if (state.gems < gemCost) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`Needs ${gemCost} scarce Gems for ${perk.name}. Earn Gems from Contracts/Daily or Google Play!`, 'error');
      return;
    }

    onUpdateState(prev => {
      const curLvl = prev.premiumPerks?.[perk.id] || 0;
      if (curLvl >= perk.maxLevel) return prev;
      const gCost = perk.baseGemCost + curLvl * perk.gemStep;
      if (prev.gems < gCost) return prev;

      const nextPerks = {
        ...(prev.premiumPerks || {
          goldenTurbineLevel: 0,
          energyCoreUpgrades: 0,
          vaultExpansions: 0,
          vipContractLevel: 0
        }),
        [perk.id]: curLvl + 1
      };

      const nextMaxEnergy = perk.id === 'energyCoreUpgrades' ? prev.maxEnergy + 5 : prev.maxEnergy;
      const nextEnergy = perk.id === 'energyCoreUpgrades' ? Math.min(nextMaxEnergy, prev.energy + 5) : prev.energy;
      const nextVaultCap = perk.id === 'vaultExpansions' ? prev.maxInventoryCapacity + 4 : prev.maxInventoryCapacity;

      return {
        ...prev,
        gems: prev.gems - gCost,
        maxEnergy: nextMaxEnergy,
        energy: nextEnergy,
        maxInventoryCapacity: nextVaultCap,
        premiumPerks: nextPerks
      };
    });

    openCelebration({
      title: `${perk.name} · Lvl ${currentLevel + 1}`,
      subtitle: `${perk.effectPerLevel} permanently unlocked!`,
      energy: perk.id === 'energyCoreUpgrades' ? 5 : undefined,
      badgeText: `Scarce Upgrade Active`
    });
  };

  const handleBuyPremiumCrate = (crate: PremiumCrateDef, currency: 'coins' | 'gems') => {
    if (currency === 'coins' && !crate.coinPrice) return;
    const cost = currency === 'coins' ? crate.coinPrice! : crate.gemPrice;
    if ((currency === 'coins' ? state.coins : state.gems) < cost) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(
        `Needs ${cost.toLocaleString()} ${currency === 'coins' ? 'Coins' : 'Gems'} for ${crate.name}.`,
        'error'
      );
      return;
    }

    const freeGrid = state.board.some(c => c.item === null);
    const freeVault = state.inventory.length < state.maxInventoryCapacity;
    if (!freeGrid && !freeVault) {
      soundManager.playSound('error', state.settings.soundFx);
      notify('Workshop Grid and Asset Vault are full. Make 1 slot free before opening a crate.', 'error');
      return;
    }

    const categories: ItemCategory[] = ['wood', 'metal', 'tech', 'gem'];
    const rolledCat = categories[Math.floor(Math.random() * categories.length)];
    const rolledTier =
      crate.minTier + Math.floor(Math.random() * (crate.maxTier - crate.minTier + 1));
    const rolledDef = getItemDef(rolledCat, rolledTier);

    onUpdateState(prev => {
      if (currency === 'coins' && (!crate.coinPrice || prev.coins < crate.coinPrice)) return prev;
      if (currency === 'gems' && prev.gems < crate.gemPrice) return prev;

      const nextBoard = [...prev.board];
      const nextInventory = [...prev.inventory];
      const newItem = {
        id: `crate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tier: rolledTier,
        category: rolledCat
      };

      const emptyIdx = nextBoard.findIndex(c => c.item === null);
      if (emptyIdx !== -1) {
        nextBoard[emptyIdx] = { ...nextBoard[emptyIdx], item: newItem };
      } else if (nextInventory.length < prev.maxInventoryCapacity) {
        nextInventory.push(newItem);
      } else {
        return prev;
      }

      const nextConsumables = { ...prev.consumables };
      if (crate.bonusConsumable) {
        const cDef = CONSUMABLE_DEFINITIONS[crate.bonusConsumable];
        nextConsumables[crate.bonusConsumable] = Math.min(
          cDef.maxStock + 2,
          (nextConsumables[crate.bonusConsumable] || 0) + 1
        );
      }

      return {
        ...prev,
        coins: currency === 'coins' ? prev.coins - crate.coinPrice! : prev.coins,
        gems: currency === 'gems' ? prev.gems - crate.gemPrice : prev.gems,
        energy: Math.min(prev.maxEnergy, prev.energy + crate.bonusEnergy),
        board: nextBoard,
        inventory: nextInventory,
        consumables: nextConsumables,
        stats: {
          ...prev.stats,
          highestTierUnlocked: Math.max(prev.stats.highestTierUnlocked, rolledTier)
        }
      };
    });

    openCelebration({
      title: `${crate.name} Opened!`,
      subtitle: `Received T${rolledTier} ${rolledDef.name}${
        crate.bonusConsumable
          ? ` + 1 ${CONSUMABLE_DEFINITIONS[crate.bonusConsumable].name}`
          : ''
      }`,
      energy: crate.bonusEnergy,
      badgeText: `T${rolledTier} ${rolledDef.name}`
    });
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

    onAddFloatingText?.(`+${coinGain.toLocaleString()} Coins`, window.innerWidth / 2, window.innerHeight / 2, '#D97706');
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

    const freeCoins = 100;
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
    onAddFloatingText?.('+100 Coins · +6 Energy', window.innerWidth / 2, window.innerHeight / 2, '#059669');
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
            Ad-powered medium boosters, Coin trade market, and scarce Google Play IAP gear.
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

      {/* 5-Tab Navigation */}
      <div className="grid grid-cols-5 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        {([
          { id: 'marketplace', label: 'Trade' },
          { id: 'consumables', label: 'Boosts' },
          { id: 'premium', label: 'Play IAP' },
          { id: 'currency', label: 'Exchange' },
          { id: 'daily', label: dailyGiftClaimed ? 'Daily' : 'Daily!' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              soundManager.playSound('click', state.settings.soundFx);
              setActiveTab(tab.id);
            }}
            className={`py-2 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap truncate ${
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

      {/* MEDIUM-VALUE CONSUMABLES TAB (AD REFILLS + COINS + IAP BUNDLE LINK) */}
      {activeTab === 'consumables' && (
        <div className="flex flex-col gap-3">
          {/* Promo link to Scarce IAP Mega Bundle */}
          <div className="bg-gradient-to-r from-violet-50 via-white to-amber-50 border-2 border-violet-300 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold text-slate-900 truncate">
                  Need Mega Booster Bundles?
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Refill single Boosters free via Ads or Coins, or get Tactical Mega Bundles in Play IAP!
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('premium')}
              className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shrink-0 cursor-pointer active:scale-95 transition shadow-sm"
            >
              View IAP
            </button>
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
                        <span className="text-[11px] font-bold text-violet-700">
                          {con.badge} · Medium Booster
                        </span>
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

                  {/* Use / Watch Ad Free / Coin Buy */}
                  <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleRefillConsumableWithAd(con.id)}
                        disabled={isFull}
                        className={`py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
                          isFull
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm cursor-pointer'
                        }`}
                      >
                        <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{isFull ? 'Max Stock' : 'Free +1 · Ad'}</span>
                      </button>

                      <button
                        onClick={() => handleBuyConsumableCoins(con.id)}
                        disabled={isFull}
                        className={`py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 tabular-nums ${
                          isFull
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 cursor-pointer'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{isFull ? 'Maxed' : `Buy · ${con.coinPrice}`}</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleUseConsumable(con.id)}
                      disabled={!hasCharge}
                      className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs transition active:scale-95 ${
                        hasCharge
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      {hasCharge ? `Use ${con.name}` : 'Empty — Watch Ad or Buy Above'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GOOGLE PLAY IAP STORE & SCARCE GEM GEAR TAB */}
      {activeTab === 'premium' && (
        <div className="flex flex-col gap-4">
          {/* Google Play Billing Header & Restore */}
          <div className="bg-gradient-to-r from-amber-50 via-white to-violet-50 border border-amber-300 rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">Google Play Premium Store</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {isNative
                      ? 'Official Google Play Billing checkout for scarce Gems, Mega Bundles & Permanent Charters.'
                      : 'Google Play Billing items (checkout opens inside the Android Play app).'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => void handleRestorePurchases()}
              disabled={isRestoring}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
            >
              {isRestoring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>{isRestoring ? 'Checking Google Play...' : 'Restore Google Play Purchases'}</span>
            </button>
          </div>

          {/* Google Play IAP Catalog */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-extrabold text-slate-800 px-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Scarce Bundles, Gems & Charters (IAP)
            </span>

            {IAP_CATALOG.map(item => {
              const storeProd = storeProducts[item.productId];
              const priceLabel = storeProd?.priceString || item.fallbackPrice;
              const isOwned =
                item.kind === 'non_consumable' &&
                (state.ownedIapIds || []).includes(item.productId);
              const isBusy = purchasingSku === item.productId;

              return (
                <div
                  key={item.productId}
                  className={`bg-white border-2 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm ${
                    isOwned ? 'border-emerald-300 bg-emerald-50/30' : 'border-indigo-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.gradient} text-white flex items-center justify-center text-2xl shrink-0 shadow-xs`}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-extrabold text-slate-900">{item.title}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-800">
                            {item.badge}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                          {item.subtitle}
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isOwned ? (
                    <div className="py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Charter Active Permanently</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => void handlePurchaseIap(item)}
                      disabled={isBusy}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs flex items-center justify-between shadow-sm cursor-pointer active:scale-95 transition disabled:opacity-60"
                    >
                      <span className="text-[10px] font-semibold opacity-90 truncate max-w-[65%]">
                        Google Play · {item.productId.split('.').pop()}
                      </span>
                      <span className="bg-white/20 px-2.5 py-1 rounded-lg font-extrabold tabular-nums">
                        {isBusy ? 'Processing...' : priceLabel}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scarce Gem-Only Workshop Upgrades */}
          <div className="flex flex-col gap-2.5 pt-1">
            <span className="text-xs font-extrabold text-slate-800 px-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" /> Scarce Gem Workshop Upgrades
            </span>

            {PREMIUM_PERK_DEFS.map(perk => {
              const currentLevel = state.premiumPerks?.[perk.id] || 0;
              const isMax = currentLevel >= perk.maxLevel;
              const gemCost = perk.baseGemCost + currentLevel * perk.gemStep;

              return (
                <div
                  key={perk.id}
                  className="bg-white border border-cyan-200 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${perk.accentGradient} text-white flex items-center justify-center text-2xl shrink-0 shadow-xs`}
                      >
                        {perk.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">{perk.name}</h4>
                        <span className="text-[11px] font-bold text-emerald-700 block">
                          {perk.effectPerLevel}
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{perk.shortDesc}</p>
                      </div>
                    </div>

                    <span className="text-[11px] font-extrabold font-mono-num px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 shrink-0 tabular-nums">
                      Lvl {currentLevel}/{perk.maxLevel}
                    </span>
                  </div>

                  {isMax ? (
                    <div className="py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold text-center">
                      Max Level Reached
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyPremiumPerk(perk)}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition tabular-nums shadow-sm"
                    >
                      <Gem className="w-3.5 h-3.5" />
                      <span>Upgrade · {gemCost} Scarce Gems</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supply Crates (Artisan accepts Coins or Gems; Executive & Sovereign are scarce Gem Crates) */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-extrabold text-slate-800 px-1 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-violet-600" /> Scarce Supply Crates
            </span>

            {PREMIUM_CRATE_DEFS.map(crate => (
              <div
                key={crate.id}
                className="bg-white border border-amber-200 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${crate.gradient} text-white flex items-center justify-center text-2xl shrink-0 shadow-xs`}
                  >
                    {crate.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">{crate.name}</h4>
                    <span className="text-[11px] font-bold text-amber-700">{crate.badge}</span>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{crate.description}</p>
                  </div>
                </div>

                <div className={`grid ${crate.coinPrice ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  {crate.coinPrice && (
                    <button
                      onClick={() => handleBuyPremiumCrate(crate, 'coins')}
                      className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition tabular-nums shadow-sm"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>{crate.coinPrice.toLocaleString()} Coins</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleBuyPremiumCrate(crate, 'gems')}
                    className="py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition tabular-nums shadow-sm"
                  >
                    <Gem className="w-3.5 h-3.5" />
                    <span>{crate.gemPrice} Scarce Gems</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXCHANGE & SPONSORED BOOSTS TAB */}
      {activeTab === 'currency' && (
        <div className="flex flex-col gap-4">
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
                    onAddFloatingText?.('2x Plant Output (5m)', window.innerWidth / 2, window.innerHeight / 2, '#D97706');
                  })
                }
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition shrink-0 cursor-pointer whitespace-nowrap"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Watch Ad</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-amber-800">Gem-to-Coin Exchange</span>
              <span className="text-[11px] text-slate-500 font-medium">Convert scarce Gems</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { gems: 5, coins: 450, label: 'Working Capital' },
                { gems: 15, coins: 1500, label: 'Operating Fund' },
                { gems: 35, coins: 4000, label: 'Plant Reserve' },
                { gems: 75, coins: 10000, label: 'Capital Ledger' }
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
                +100 Coins · +6 Energy {dailyGiftClaimed ? `· Resets ${timeUntilMidnight}` : '· Available now'}
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
                  onAddFloatingText?.('+12 Energy', window.innerWidth / 2, window.innerHeight / 2, '#059669');
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
                  onAddFloatingText?.('+180 Coins', window.innerWidth / 2, window.innerHeight / 2, '#D97706');
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
          onBuyConsumableCoins={() => handleBuyConsumableCoins(inspectedConsumable.id)}
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

                {rewardModal.badgeText && (
                  <div className="col-span-2 bg-white border border-violet-200 rounded-xl p-2 flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span className="text-xs font-extrabold text-violet-800">{rewardModal.badgeText}</span>
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
