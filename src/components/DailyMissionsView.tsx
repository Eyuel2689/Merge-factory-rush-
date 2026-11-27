import React, { useState, useEffect } from 'react';
import { GameState, DailyMission } from '../types';
import { getTimeUntilNextDailyReset, checkAndResetDailyState } from '../utils/dailyMissions';
import { Flame, Clock, CheckCircle2, Gift, RefreshCw, Target } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { triggerConfetti } from '../utils/confettiSafe';

interface DailyMissionsViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onAddFloatingText?: (text: string, x: number, y: number, color?: string) => void;
  isModal?: boolean;
  embedded?: boolean;
  onClose?: () => void;
}

export const DailyMissionsView: React.FC<DailyMissionsViewProps> = ({
  state,
  onUpdateState,
  onAddFloatingText,
  embedded = false
}) => {
  const [countdown, setCountdown] = useState(getTimeUntilNextDailyReset().formatted);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getTimeUntilNextDailyReset().formatted);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const daily = state.dailyState;
  const missions = daily?.missions || [];

  const completedCount = missions.filter(m => m.completed).length;
  const totalMissions = missions.length || 5;
  const allMissionsFinished = completedCount >= totalMissions;
  const canClaimGrandReward = allMissionsFinished && !daily?.grandRewardClaimed;

  const handleClaimMission = (mission: DailyMission) => {
    if (!mission.completed || mission.claimed) return;

    soundManager.playSound('upgrade', state.settings.soundFx);
    triggerConfetti({ particleCount: 40, spread: 60, origin: { y: 0.5 } });

    onUpdateState(prev => {
      const nextMissions = prev.dailyState.missions.map(m =>
        m.id === mission.id ? { ...m, claimed: true } : m
      );

      const addedCoins = mission.coinReward;
      const addedGems = mission.gemReward;
      const addedEnergy = mission.energyReward || 0;

      return {
        ...prev,
        coins: prev.coins + addedCoins,
        gems: prev.gems + addedGems,
        energy: Math.min(prev.maxEnergy, prev.energy + addedEnergy),
        dailyState: {
          ...prev.dailyState,
          missions: nextMissions
        },
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + addedCoins
        }
      };
    });

    if (onAddFloatingText) {
      onAddFloatingText(
        `+${mission.coinReward} Coins · +${mission.gemReward} Gems`,
        window.innerWidth / 2,
        window.innerHeight / 2 - 20,
        '#D97706'
      );
    }
  };

  const grandCoins = 240 + state.level * 30;
  const grandGems = 3;
  const grandEnergy = 15;

  const handleClaimGrandChest = () => {
    if (!canClaimGrandReward) return;

    soundManager.playSound('upgrade', state.settings.soundFx);
    triggerConfetti({ particleCount: 70, spread: 80, origin: { y: 0.45 } });

    onUpdateState(prev => ({
      ...prev,
      coins: prev.coins + grandCoins,
      gems: prev.gems + grandGems,
      energy: Math.min(prev.maxEnergy, prev.energy + grandEnergy),
      dailyState: {
        ...prev.dailyState,
        grandRewardClaimed: true
      },
      stats: {
        ...prev.stats,
        totalCoinsEarned: prev.stats.totalCoinsEarned + grandCoins
      }
    }));

    if (onAddFloatingText) {
      onAddFloatingText(
        `Daily Bonus Claimed · +${grandCoins} Coins · +${grandGems} Gems`,
        window.innerWidth / 2,
        window.innerHeight / 2,
        '#D97706'
      );
    }
  };

  const handleForceReset = () => {
    soundManager.playSound('click', state.settings.soundFx);
    onUpdateState(prev => {
      const { dailyState: newDaily } = checkAndResetDailyState(prev.dailyState, prev.level, true);
      return {
        ...prev,
        dailyState: newDaily
      };
    });

    if (onAddFloatingText) {
      onAddFloatingText('Daily Tasks Reset', window.innerWidth / 2, window.innerHeight / 2, '#0284C7');
    }
  };

  return (
    <div className={`flex flex-col gap-3 select-none text-slate-900 ${embedded ? '' : 'max-w-md mx-auto p-3'}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-sky-50 border border-amber-200 rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Daily Operations</h2>
              <p className="text-xs text-slate-600">Complete full shift tasks to earn bonuses</p>
            </div>
          </div>

          <button
            onClick={handleForceReset}
            className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 active:scale-95 transition cursor-pointer shadow-xs"
            title="Reset daily tasks"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] text-slate-700 tabular-nums font-semibold">
              Streak: <strong className="text-amber-700">{daily?.streak || 1} day{(daily?.streak || 1) > 1 ? 's' : ''}</strong>
            </span>
          </div>

          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-sky-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] text-slate-700 truncate font-mono-num font-semibold">
              {countdown}
            </span>
          </div>
        </div>
      </div>

      {/* Daily Grand Completion Chest */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                <span>Daily Completion Bonus</span>
                <span className="text-amber-700 tabular-nums">{completedCount}/{totalMissions}</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 tabular-nums font-medium">
                Finish all {totalMissions} tasks: +{grandCoins} Coins · +{grandGems} Gems · +{grandEnergy} Energy
              </p>
            </div>
          </div>

          {daily?.grandRewardClaimed ? (
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Claimed
            </div>
          ) : (
            <button
              onClick={handleClaimGrandChest}
              disabled={!canClaimGrandReward}
              className={`px-3 py-2 rounded-xl font-bold text-xs transition active:scale-95 shrink-0 ${
                canClaimGrandReward
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm cursor-pointer'
                  : 'bg-white text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              Claim
            </button>
          )}
        </div>

        <div className="w-full h-2 bg-white border border-amber-200 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.floor((completedCount / totalMissions) * 100))}%` }}
          />
        </div>
      </div>

      {/* Missions List */}
      <div className="flex flex-col gap-2">
        {missions.map(mission => {
          const isComplete = mission.current >= mission.target;
          const progressPct = Math.min(100, Math.floor((mission.current / mission.target) * 100));

          return (
            <div
              key={mission.id}
              className={`bg-white border rounded-2xl p-3 flex items-center justify-between gap-2.5 shadow-sm transition ${
                mission.claimed
                  ? 'border-slate-200 opacity-65'
                  : isComplete
                  ? 'border-emerald-400 ring-1 ring-emerald-200'
                  : 'border-indigo-200/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-lg shrink-0">
                  {mission.icon}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-extrabold truncate ${mission.claimed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {mission.title}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">{mission.description}</span>

                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="w-24 sm:w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono-num text-slate-600 font-semibold">
                      {mission.current}/{mission.target}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="text-[11px] font-bold text-amber-700 tabular-nums">
                  +{mission.coinReward}🪙 · +{mission.gemReward}💎
                </div>

                {mission.claimed ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                  </span>
                ) : (
                  <button
                    onClick={() => handleClaimMission(mission)}
                    disabled={!isComplete}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 ${
                      isComplete
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    Claim
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
