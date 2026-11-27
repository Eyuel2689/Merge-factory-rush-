import React, { useState } from 'react';
import { GameState } from '../types';
import { Trophy, CheckCircle, Target } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { triggerConfetti } from '../utils/confettiSafe';
import { DailyMissionsView } from './DailyMissionsView';

interface AchievementsViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onAddFloatingText?: (text: string, x: number, y: number, color?: string) => void;
  embeddedListOnly?: boolean;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  state,
  onUpdateState,
  onAddFloatingText,
  embeddedListOnly = false
}) => {
  const [subTab, setSubTab] = useState<'daily' | 'achievements'>(embeddedListOnly ? 'achievements' : 'daily');

  const unclaimedDailyCount = (state.dailyState?.missions || []).filter(
    m => m.completed && !m.claimed
  ).length;

  const unclaimedAchievementsCount = state.achievements.filter(
    a => !a.claimed && a.currentValue >= a.targetValue
  ).length;

  const handleClaimAchievement = (achievementId: string) => {
    const ach = state.achievements.find(a => a.id === achievementId);
    if (!ach || ach.claimed || ach.currentValue < ach.targetValue) return;

    soundManager.playSound('upgrade', state.settings.soundFx);
    triggerConfetti({ particleCount: 50, spread: 70, origin: { y: 0.5 } });

    onUpdateState(prev => {
      const nextAchievements = prev.achievements.map(a => (a.id === achievementId ? { ...a, claimed: true } : a));
      return {
        ...prev,
        coins: prev.coins + ach.coinReward,
        gems: prev.gems + ach.gemReward,
        achievements: nextAchievements
      };
    });
  };

  const milestonesList = (
    <div className="flex flex-col gap-2.5">
      <div className="bg-gradient-to-r from-sky-50 via-white to-indigo-50 border border-sky-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-sky-600" /> Facility Milestones
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">Long-term industrial achievements</p>
        </div>
      </div>

      {state.achievements.map(ach => {
        const isComplete = ach.currentValue >= ach.targetValue;
        const progressPct = Math.min(100, Math.floor((ach.currentValue / ach.targetValue) * 100));

        return (
          <div
            key={ach.id}
            className={`bg-white border rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm transition ${
              ach.claimed
                ? 'border-slate-200 opacity-65'
                : isComplete
                ? 'border-emerald-400 ring-1 ring-emerald-200'
                : 'border-indigo-200/80'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-xl shrink-0">
                {ach.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-extrabold text-slate-900 truncate">{ach.title}</span>
                <span className="text-[11px] text-slate-500 truncate">{ach.description}</span>

                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isComplete ? 'bg-emerald-500' : 'bg-sky-500'}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono-num text-slate-600 font-semibold">
                    {ach.currentValue}/{ach.targetValue}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="text-[11px] font-bold text-amber-700 tabular-nums">
                +{ach.coinReward}🪙 · +{ach.gemReward}💎
              </div>

              {ach.claimed ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> Claimed
                </span>
              ) : (
                <button
                  onClick={() => handleClaimAchievement(ach.id)}
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
  );

  if (embeddedListOnly) {
    return milestonesList;
  }

  return (
    <div className="flex flex-col gap-3 max-w-md mx-auto p-3 select-none pb-6 text-slate-900">
      {/* Top Segmented Selector */}
      <div className="bg-white p-1.5 rounded-2xl border border-indigo-200/80 grid grid-cols-2 gap-1 shadow-sm">
        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setSubTab('daily');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer ${
            subTab === 'daily'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Daily Tasks</span>
          {unclaimedDailyCount > 0 && (
            <span className="text-[10px] font-mono-num ml-0.5">({unclaimedDailyCount})</span>
          )}
        </button>

        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setSubTab('achievements');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer ${
            subTab === 'achievements'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Milestones</span>
          {unclaimedAchievementsCount > 0 && (
            <span className="text-[10px] font-mono-num ml-0.5">({unclaimedAchievementsCount})</span>
          )}
        </button>
      </div>

      {subTab === 'daily' ? (
        <DailyMissionsView
          state={state}
          onUpdateState={onUpdateState}
          onAddFloatingText={onAddFloatingText}
          embedded={true}
        />
      ) : (
        milestonesList
      )}
    </div>
  );
};
