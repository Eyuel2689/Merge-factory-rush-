import React, { useState, useEffect } from 'react';
import { GameState } from '../types';
import { Cpu, Users, ArrowUpCircle, Zap, ShieldCheck, AlertCircle, PlayCircle, Clock, Flame } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { recordDailyMissionProgress } from '../utils/dailyMissions';
import confetti from 'canvas-confetti';

interface MachinesViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onTriggerRewardedAd: (rewardType: 'energy' | 'coins' | 'double_earnings', onComplete: () => void) => void;
  onAddFloatingText?: (text: string, x: number, y: number, color?: string) => void;
}

export const MachinesView: React.FC<MachinesViewProps> = ({
  state,
  onUpdateState,
  onTriggerRewardedAd,
  onAddFloatingText
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const boostRemainingMs = Math.max(0, (state.doubleEarningsUntil || 0) - now);
  const surgeRemainingMs = Math.max(0, (state.productionSurgeUntil || 0) - now);
  const isBoostActive = boostRemainingMs > 0;
  const isSurgeActive = surgeRemainingMs > 0;

  useEffect(() => {
    if (!isBoostActive && !isSurgeActive) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isBoostActive, isSurgeActive, state.doubleEarningsUntil, state.productionSurgeUntil]);

  const formatCountdown = (ms: number) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleActivate2xBoost = () => {
    onTriggerRewardedAd('double_earnings', () => {
      const currentNow = Date.now();
      const baseTime = Math.max(currentNow, state.doubleEarningsUntil || 0);
      const nextUntil = Math.min(currentNow + 15 * 60 * 1000, baseTime + 5 * 60 * 1000);
      setNow(currentNow);
      onUpdateState(prev => ({
        ...prev,
        doubleEarningsUntil: nextUntil
      }));
      soundManager.playSound('upgrade', state.settings.soundFx);
      confetti({ particleCount: 55, spread: 70, origin: { y: 0.45 } });
      if (onAddFloatingText) {
        onAddFloatingText('2x Machine Output Active', window.innerWidth / 2, window.innerHeight / 2, '#D97706');
      }
    });
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 2500);
  };

  const computeTotalIncomePerSec = () => {
    let coinsPerSec = 0;
    state.machines.forEach(machine => {
      if (machine.unlocked && machine.level > 0) {
        let machineRate = (machine.baseProduction * machine.level) / machine.cycleTime;
        const worker = state.workers.find(w => w.targetMachineId === machine.id);
        if (worker && worker.unlocked && worker.level > 0) {
          machineRate *= 1 + worker.boostMultiplier * worker.level;
        }
        coinsPerSec += machineRate;
      }
    });
    coinsPerSec *= 1 + (state.factoryLevel - 1) * 0.15;
    if (isSurgeActive) coinsPerSec *= 1.5;
    if (isBoostActive) coinsPerSec *= 2;
    return coinsPerSec.toFixed(2);
  };

  const handleUpgradeMachine = (machineId: string) => {
    const machine = state.machines.find(m => m.id === machineId);
    if (!machine) return;

    if (state.coins < machine.upgradeCost) {
      soundManager.playSound('error', state.settings.soundFx);
      showError(`Requires ${machine.upgradeCost.toLocaleString()} coins to upgrade ${machine.name}.`);
      return;
    }

    onUpdateState(prev => {
      soundManager.playSound('upgrade', prev.settings.soundFx);
      const nextMachines = prev.machines.map(m => {
        if (m.id === machineId) {
          const nextLevel = m.level + 1;
          const nextCost = Math.round(m.upgradeCost * 1.75);
          return {
            ...m,
            level: nextLevel,
            unlocked: true,
            upgradeCost: nextCost
          };
        }
        return m;
      });
      const nextDaily = recordDailyMissionProgress(prev.dailyState, 'upgrade', 1);
      return {
        ...prev,
        coins: prev.coins - machine.upgradeCost,
        machines: nextMachines,
        dailyState: nextDaily
      };
    });
  };

  const handleUpgradeWorker = (workerId: string) => {
    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) return;

    if (state.coins < worker.upgradeCost) {
      soundManager.playSound('error', state.settings.soundFx);
      showError(`Requires ${worker.upgradeCost.toLocaleString()} coins for ${worker.name}.`);
      return;
    }

    onUpdateState(prev => {
      soundManager.playSound('upgrade', prev.settings.soundFx);
      const nextWorkers = prev.workers.map(w => {
        if (w.id === workerId) {
          const nextLevel = w.level + 1;
          const nextCost = Math.round(w.upgradeCost * 1.9);
          return {
            ...w,
            level: nextLevel,
            unlocked: true,
            upgradeCost: nextCost
          };
        }
        return w;
      });
      const nextDaily = recordDailyMissionProgress(prev.dailyState, 'upgrade', 1);
      return {
        ...prev,
        coins: prev.coins - worker.upgradeCost,
        workers: nextWorkers,
        dailyState: nextDaily
      };
    });
  };

  const factoryUpgradeCost = state.factoryLevel * 450;

  const handleUpgradeFactory = () => {
    if (state.coins < factoryUpgradeCost) {
      soundManager.playSound('error', state.settings.soundFx);
      showError(`Requires ${factoryUpgradeCost.toLocaleString()} coins to upgrade Facility Level.`);
      return;
    }

    onUpdateState(prev => {
      soundManager.playSound('upgrade', prev.settings.soundFx);
      const nextDaily = recordDailyMissionProgress(prev.dailyState, 'upgrade', 1);
      return {
        ...prev,
        coins: prev.coins - factoryUpgradeCost,
        factoryLevel: prev.factoryLevel + 1,
        dailyState: nextDaily
      };
    });
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-md mx-auto p-3 select-none text-slate-900 pb-6">
      {/* Total Passive Income Overview Header */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-sky-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 flex-wrap font-medium">
              <span>Plant Output</span>
              {isBoostActive && <span className="text-amber-700 font-bold">· 2x Ad</span>}
              {isSurgeActive && <span className="text-sky-700 font-bold">· +50% Tooling</span>}
            </div>
            <div className="text-lg font-extrabold text-slate-900 tabular-nums">
              +{computeTotalIncomePerSec()} <span className="text-xs text-slate-500 font-semibold">coins/sec</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleUpgradeFactory}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl shadow-sm active:scale-95 transition flex flex-col items-center cursor-pointer whitespace-nowrap"
        >
          <span className="flex items-center gap-1">
            <ArrowUpCircle className="w-3.5 h-3.5" /> Plant Lvl {state.factoryLevel + 1}
          </span>
          <span className="text-[10px] font-bold text-slate-900 tabular-nums">
            {factoryUpgradeCost.toLocaleString()} coins
          </span>
        </button>
      </div>

      {/* Active Metal Tooling Surge Indicator */}
      {isSurgeActive && (
        <div className="bg-sky-50 border border-sky-300 rounded-xl px-3 py-2 flex items-center justify-between text-xs shadow-sm">
          <span className="text-sky-800 font-bold flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-sky-500" /> Alloy Tooling Surge (+50% Output)
          </span>
          <span className="font-mono-num text-sky-900 font-extrabold">{formatCountdown(surgeRemainingMs)}</span>
        </div>
      )}

      {/* 2x Passive Earnings Ad Boost Banner */}
      <div className="bg-white border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-sm font-extrabold text-amber-700 shrink-0">
            2x
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold text-slate-900">
              {isBoostActive ? '2x Plant Output Active' : 'Double Plant Output'}
            </span>
            <span className="text-[11px] text-slate-600 flex items-center gap-1 tabular-nums">
              {isBoostActive ? (
                <>
                  <Clock className="w-3 h-3 text-emerald-600" />
                  <span>{formatCountdown(boostRemainingMs)} left · Watch ad for +5m</span>
                </>
              ) : (
                'Watch an ad for 2x machine coins for 5 mins'
              )}
            </span>
          </div>
        </div>

        <button
          onClick={handleActivate2xBoost}
          className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition shrink-0 cursor-pointer whitespace-nowrap"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>{isBoostActive ? '+5m Ad' : 'Watch Ad'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-700 text-xs px-3 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Automated Machines */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-extrabold text-sky-700 uppercase tracking-wider flex items-center gap-1.5 px-1">
          <Cpu className="w-3.5 h-3.5 text-sky-600" /> Automated Machinery
        </h3>

        {state.machines.map(machine => {
          const isUnlockedByLevel = state.level >= machine.unlockLevel;
          const worker = state.workers.find(w => w.targetMachineId === machine.id);
          const workerBoost = worker && worker.level > 0 ? 1 + worker.boostMultiplier * worker.level : 1;
          const currentRate =
            machine.level > 0 ? ((machine.baseProduction * machine.level * workerBoost) / machine.cycleTime).toFixed(2) : '0.00';

          return (
            <div
              key={machine.id}
              className={`bg-white border rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm ${
                isUnlockedByLevel ? 'border-indigo-200/80' : 'border-slate-200 opacity-65'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-2xl shrink-0">
                  {machine.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 truncate">{machine.name}</span>
                    <span className="text-[11px] text-amber-700 font-bold tabular-nums">
                      Lvl {machine.level}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 truncate">{machine.description}</span>
                  <span className="text-[11px] text-emerald-600 font-bold mt-0.5 tabular-nums">
                    +{currentRate} coins/s
                  </span>
                </div>
              </div>

              {isUnlockedByLevel ? (
                <button
                  onClick={() => handleUpgradeMachine(machine.id)}
                  className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition flex flex-col items-center shrink-0 cursor-pointer tabular-nums"
                >
                  <span>{machine.level === 0 ? 'Commission' : 'Upgrade'}</span>
                  <span className="text-[10px] text-amber-700 font-semibold">{machine.upgradeCost.toLocaleString()} coins</span>
                </button>
              ) : (
                <div className="text-[11px] text-slate-500 font-semibold px-2.5 py-1.5 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                  Lvl {machine.unlockLevel} req.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Plant Specialists */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 px-1">
          <Users className="w-3.5 h-3.5 text-emerald-600" /> Plant Specialists
        </h3>

        {state.workers.map(worker => {
          const targetMachine = state.machines.find(m => m.id === worker.targetMachineId);
          const isUnlocked = targetMachine && state.level >= targetMachine.unlockLevel && targetMachine.level > 0;
          const totalBonusPct = Math.round(worker.boostMultiplier * worker.level * 100);

          return (
            <div
              key={worker.id}
              className={`bg-white border rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm ${
                isUnlocked ? 'border-indigo-200/80' : 'border-slate-200 opacity-65'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shrink-0">
                  {worker.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 truncate">{worker.name}</span>
                    <span className="text-[11px] text-emerald-700 font-bold tabular-nums">
                      Lvl {worker.level}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 truncate">{worker.title}</span>
                  <span className="text-[11px] text-sky-600 font-bold flex items-center gap-1 mt-0.5 tabular-nums">
                    <ShieldCheck className="w-3 h-3" /> +{totalBonusPct}% output on {targetMachine?.name}
                  </span>
                </div>
              </div>

              {isUnlocked ? (
                <button
                  onClick={() => handleUpgradeWorker(worker.id)}
                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition flex flex-col items-center shrink-0 cursor-pointer tabular-nums"
                >
                  <span>{worker.level === 0 ? 'Hire' : 'Train'}</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">{worker.upgradeCost.toLocaleString()} coins</span>
                </button>
              ) : (
                <div className="text-[10px] text-slate-500 font-semibold px-2.5 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-center shrink-0">
                  Needs {targetMachine?.name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
