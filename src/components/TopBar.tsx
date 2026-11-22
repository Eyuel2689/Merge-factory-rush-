import React from 'react';
import { GameState } from '../types';
import { Zap, Coins, Gem, Volume2, VolumeX, Music, Plus, Star, Settings } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface TopBarProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onOpenEnergyRefill: () => void;
  onOpenSettings: () => void;
  isSettingsOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  state,
  onUpdateState,
  onOpenEnergyRefill,
  onOpenSettings,
  isSettingsOpen = false
}) => {
  const xpPercentage = Math.min(100, Math.floor((state.xp / state.xpToNextLevel) * 100));
  const now = Date.now();
  const is2xActive = Boolean(state.doubleEarningsUntil && state.doubleEarningsUntil > now);
  const isSurgeActive = Boolean(state.productionSurgeUntil && state.productionSurgeUntil > now);

  const toggleSound = () => {
    onUpdateState(prev => {
      const nextFx = !prev.settings.soundFx;
      soundManager.playSound('click', nextFx);
      return {
        ...prev,
        settings: { ...prev.settings, soundFx: nextFx }
      };
    });
  };

  const toggleMusic = () => {
    onUpdateState(prev => {
      const nextMusic = !prev.settings.music;
      soundManager.setMusicEnabled(nextMusic);
      return {
        ...prev,
        settings: { ...prev.settings, music: nextMusic }
      };
    });
  };

  return (
    <header className="bg-white/92 backdrop-blur-md text-slate-900 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-indigo-200/75 shadow-sm flex items-center justify-between gap-2 select-none sticky top-0 z-30 touch-manipulation">
      {/* Player Level Badge */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl shrink-0">
        <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-slate-900 leading-tight flex items-center gap-1 whitespace-nowrap">
            <span className="tabular-nums">Lvl {state.level}</span>
          </span>
          <div className="w-14 h-1.5 bg-amber-200/70 rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300"
              style={{ width: `${xpPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Currencies Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* Coins */}
        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl text-amber-900 font-bold text-xs shrink-0 tabular-nums">
          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{state.coins.toLocaleString()}</span>
          {is2xActive && (
            <span className="text-[10px] font-extrabold text-emerald-600 ml-0.5">2x</span>
          )}
          {isSurgeActive && (
            <span className="text-[10px] font-extrabold text-sky-600 ml-0.5">+50%</span>
          )}
        </div>

        {/* Gems */}
        <div className="flex items-center gap-1 bg-cyan-50 border border-cyan-200 px-2.5 py-1.5 rounded-xl text-cyan-900 font-bold text-xs shrink-0 tabular-nums">
          <Gem className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span>{state.gems.toLocaleString()}</span>
        </div>

        {/* Energy Button */}
        <button
          onClick={onOpenEnergyRefill}
          className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1.5 rounded-xl text-emerald-900 font-bold text-xs active:scale-95 transition shrink-0 cursor-pointer tabular-nums"
          title="Refill Energy in Market"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            {state.energy}/{state.maxEnergy}
          </span>
          <Plus className="w-3 h-3 text-emerald-600 ml-0.5" />
        </button>
      </div>

      {/* Audio & Prominent Settings Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={toggleSound}
          className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer hidden sm:flex ${
            state.settings.soundFx
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-slate-100 border-slate-200 text-slate-400'
          }`}
          title="Toggle Sound Effects"
        >
          {state.settings.soundFx ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleMusic}
          className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer hidden sm:flex ${
            state.settings.music
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-slate-100 border-slate-200 text-slate-400'
          }`}
          title="Toggle Music"
        >
          <Music className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
            isSettingsOpen
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800'
          }`}
          title="Open Game Modes & Settings"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xs:inline sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
};
