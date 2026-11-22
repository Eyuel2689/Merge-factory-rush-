import React, { useState, useEffect, useCallback } from 'react';
import { GameState, FloatingTextData } from './types';
import { createInitialState } from './data/gameData';
import { loadGame, saveGame } from './utils/storage';
import { soundManager } from './utils/audio';
import { checkAndResetDailyState } from './utils/dailyMissions';

import { TopBar } from './components/TopBar';
import { BottomNav, TabType } from './components/BottomNav';
import { FactoryBoard } from './components/FactoryBoard';
import { OrdersView } from './components/OrdersView';
import { MachinesView } from './components/MachinesView';
import { ShopView, MarketSubTab } from './components/ShopView';
import { SettingsView } from './components/SettingsView';
import { OfflineModal } from './components/OfflineModal';
import { AdModal, AdRewardType } from './components/AdModal';
import { FloatingText } from './components/FloatingText';
import { OfflineIndicator } from './components/PWAInstallButton';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [activeTab, setActiveTab] = useState<TabType>('factory');
  const [marketSubTab, setMarketSubTab] = useState<MarketSubTab>('marketplace');

  // Modal States
  const [offlineData, setOfflineData] = useState<{ coins: number; seconds: number } | null>(null);
  const [activeAd, setActiveAd] = useState<{
    rewardType: AdRewardType;
    adDetail?: string;
    onComplete: () => void;
  } | null>(null);

  const [floatingTexts, setFloatingTexts] = useState<FloatingTextData[]>([]);

  // Maintain latest game state ref for robust auto-saving
  const gameStateRef = React.useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load saved state on mount
  useEffect(() => {
    const { state, offlineCoins, offlineSeconds } = loadGame();
    setGameState(state);

    if (state.settings.music) {
      soundManager.setMusicEnabled(true);
    }

    if (offlineCoins > 0 && offlineSeconds > 10) {
      setOfflineData({ coins: offlineCoins, seconds: offlineSeconds });
    }
  }, []);

  // Periodic Auto-Save (every 2s) & On Window Unload
  useEffect(() => {
    const timer = setInterval(() => {
      saveGame(gameStateRef.current);
    }, 2000);

    const handleBeforeUnload = () => {
      saveGame(gameStateRef.current);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Passive Machine Earnings Tick (every 1 sec)
  useEffect(() => {
    const timer = setInterval(() => {
      setGameState(prev => {
        let incomeThisSecond = 0;
        prev.machines.forEach(machine => {
          if (machine.unlocked && machine.level > 0) {
            let machineRate = (machine.baseProduction * machine.level) / machine.cycleTime;
            const worker = prev.workers.find(w => w.targetMachineId === machine.id);
            if (worker && worker.unlocked && worker.level > 0) {
              machineRate *= 1 + worker.boostMultiplier * worker.level;
            }
            incomeThisSecond += machineRate;
          }
        });

        if (incomeThisSecond <= 0) return prev;

        incomeThisSecond *= 1 + (prev.factoryLevel - 1) * 0.15;
        if (prev.productionSurgeUntil && prev.productionSurgeUntil > Date.now()) {
          incomeThisSecond *= 1.5;
        }
        if (prev.doubleEarningsUntil && prev.doubleEarningsUntil > Date.now()) {
          incomeThisSecond *= 2;
        }

        const nextCoins = Math.round(prev.coins + incomeThisSecond);

        return {
          ...prev,
          coins: nextCoins,
          stats: {
            ...prev.stats,
            totalCoinsEarned: prev.stats.totalCoinsEarned + Math.round(incomeThisSecond)
          }
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Energy Regeneration Tick driven by chosen Play Mode (Relaxed 5s / Express 6s / Standard 8s)
  const playMode = gameState.settings?.playMode || 'standard';
  const energyIntervalMs = playMode === 'relaxed' ? 5000 : playMode === 'express' ? 6000 : 8000;

  useEffect(() => {
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.energy >= prev.maxEnergy) return prev;
        return {
          ...prev,
          energy: Math.min(prev.maxEnergy, prev.energy + 1)
        };
      });
    }, energyIntervalMs);

    return () => clearInterval(timer);
  }, [energyIntervalMs]);

  // Periodic Calendar Midnight Daily Reset Check (every 10 sec)
  useEffect(() => {
    const timer = setInterval(() => {
      setGameState(prev => {
        const { dailyState: newDaily, wasReset } = checkAndResetDailyState(prev.dailyState, prev.level);
        if (!wasReset) return prev;
        return {
          ...prev,
          dailyState: newDaily
        };
      });
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  // Handle floating text additions (respects user toggle)
  const addFloatingText = useCallback((text: string, x: number, y: number, color = '#F59E0B') => {
    if (gameStateRef.current.settings?.showFloatingRewards === false) return;
    setFloatingTexts(prev => [
      ...prev,
      { id: `ft_${Date.now()}_${Math.random()}`, text, x, y, color }
    ]);
  }, []);

  const removeFloatingText = useCallback((id: string) => {
    setFloatingTexts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Handle offline rewards claim
  const handleClaimOfflineRewards = (doubleReward: boolean) => {
    if (!offlineData) return;
    const finalCoins = doubleReward ? offlineData.coins * 2 : offlineData.coins;

    setGameState(prev => ({
      ...prev,
      coins: prev.coins + finalCoins
    }));

    soundManager.playSound('coin', gameState.settings.soundFx);
    setOfflineData(null);
  };

  const unclaimedAchievementsCount = gameState.achievements.filter(
    a => !a.claimed && a.currentValue >= a.targetValue
  ).length;

  const unclaimedDailyCount = (gameState.dailyState?.missions || []).filter(
    m => m.completed && !m.claimed
  ).length;

  const unfulfilledOrdersCount = gameState.orders.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F2F6FF] via-[#FFFDF7] to-[#EFFAF6] text-slate-900 flex flex-col font-sans select-none relative overflow-x-hidden">
      {/* Top Bar Status */}
      <TopBar
        state={gameState}
        onUpdateState={setGameState}
        onOpenEnergyRefill={() => {
          setMarketSubTab('consumables');
          setActiveTab('shop');
        }}
        onOpenSettings={() =>
          setActiveTab(prev => (prev === 'settings' ? 'factory' : 'settings'))
        }
        isSettingsOpen={activeTab === 'settings'}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16 pt-2">
        {activeTab === 'factory' && (
          <FactoryBoard
            state={gameState}
            onUpdateState={setGameState}
            onAddFloatingText={addFloatingText}
            onTriggerRewardedAd={(rewardType, onComplete, adDetail) =>
              setActiveAd({ rewardType, onComplete, adDetail })
            }
            onGoToMarket={(subTab = 'marketplace') => {
              setMarketSubTab(subTab);
              setActiveTab('shop');
            }}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersView
            state={gameState}
            onUpdateState={setGameState}
            onTriggerInterstitialAd={onComplete =>
              setActiveAd({ rewardType: 'interstitial', onComplete })
            }
            onTriggerRewardedAd={(rewardType, onComplete) =>
              setActiveAd({ rewardType, onComplete })
            }
            onAddFloatingText={addFloatingText}
          />
        )}

        {activeTab === 'machines' && (
          <MachinesView
            state={gameState}
            onUpdateState={setGameState}
            onTriggerRewardedAd={(rewardType, onComplete) =>
              setActiveAd({ rewardType, onComplete })
            }
            onAddFloatingText={addFloatingText}
          />
        )}

        {activeTab === 'shop' && (
          <ShopView
            state={gameState}
            onUpdateState={setGameState}
            onTriggerRewardedAd={(rewardType, onComplete, adDetail) =>
              setActiveAd({ rewardType, onComplete, adDetail })
            }
            onAddFloatingText={addFloatingText}
            onGoToWorkshop={() => setActiveTab('factory')}
            initialSubTab={marketSubTab}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            state={gameState}
            onUpdateState={setGameState}
            onResetGame={() => setGameState(createInitialState())}
            onBack={() => setActiveTab('factory')}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={tab => {
          soundManager.playSound('click', gameState.settings.soundFx);
          if (tab === 'shop') {
            setMarketSubTab('marketplace');
          }
          setActiveTab(tab);
        }}
        unclaimedAchievementsCount={unclaimedAchievementsCount}
        unfulfilledOrdersCount={unfulfilledOrdersCount}
        unclaimedDailyCount={unclaimedDailyCount}
      />

      {/* Offline Rewards Modal */}
      {offlineData && (
        <OfflineModal
          coins={offlineData.coins}
          seconds={offlineData.seconds}
          onClaim={handleClaimOfflineRewards}
          onTriggerRewardedAd={(rewardType, onComplete) =>
            setActiveAd({ rewardType, onComplete })
          }
        />
      )}

      {/* Rewarded & Interstitial Ad Modal */}
      {activeAd && (
        <AdModal
          rewardType={activeAd.rewardType}
          adDetail={activeAd.adDetail}
          onComplete={() => {
            const cb = activeAd.onComplete;
            setActiveAd(null);
            if (cb) cb();
          }}
          onClose={() => setActiveAd(null)}
        />
      )}

      {/* Floating Animated Reward Text */}
      <FloatingText items={floatingTexts} onRemoveItem={removeFloatingText} />
      <OfflineIndicator />
    </div>
  );
}
