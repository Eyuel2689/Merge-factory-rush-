import React, { useState } from 'react';
import { GameState, BoardTheme, PlayMode } from '../types';
import {
  Volume2,
  VolumeX,
  Music,
  Check,
  Palette,
  Sparkles,
  Zap,
  RotateCcw,
  ArrowLeft,
  Sliders,
  Gauge,
  Coffee,
  Rocket,
  CheckCircle2,
  Smartphone,
  BarChart3,
  ShieldCheck,
  X,
  Coins,
  Lock
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { resetGameSave } from '../utils/storage';
import { BOARD_THEME_CATALOG } from '../data/gameData';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onResetGame?: () => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ state, onUpdateState, onResetGame, onBack }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const toggleSetting = (
    key: 'soundFx' | 'music' | 'showMergeHighlights' | 'turboMode' | 'vibration' | 'showFloatingRewards' | 'showOrderBadges'
  ) => {
    onUpdateState(prev => {
      const nextVal = !prev.settings[key];
      if (key === 'music') {
        soundManager.setMusicEnabled(nextVal);
      } else {
        soundManager.playSound('click', key === 'soundFx' ? nextVal : prev.settings.soundFx);
      }
      return {
        ...prev,
        settings: { ...prev.settings, [key]: nextVal }
      };
    });
  };

  const [themeNotice, setThemeNotice] = useState<string | null>(null);
  const unlockedThemes = state.unlockedThemes || ['amber', 'emerald'];

  const handleSelectOrBuyTheme = (boardTheme: BoardTheme, unlockCoins: number, name: string) => {
    const isUnlocked = unlockCoins === 0 || unlockedThemes.includes(boardTheme);
    if (isUnlocked) {
      onUpdateState(prev => {
        soundManager.playSound('click', prev.settings.soundFx);
        return {
          ...prev,
          settings: { ...prev.settings, boardTheme }
        };
      });
      setThemeNotice(null);
      return;
    }

    if (state.coins < unlockCoins) {
      soundManager.playSound('error', state.settings.soundFx);
      setThemeNotice(`Needs ${unlockCoins.toLocaleString()} Coins to unlock ${name}.`);
      setTimeout(() => setThemeNotice(null), 2600);
      return;
    }

    onUpdateState(prev => {
      if (prev.coins < unlockCoins) return prev;
      const curUnlocked = prev.unlockedThemes || ['amber', 'emerald'];
      if (curUnlocked.includes(boardTheme)) return prev;
      soundManager.playSound('upgrade', prev.settings.soundFx);
      return {
        ...prev,
        coins: prev.coins - unlockCoins,
        unlockedThemes: [...curUnlocked, boardTheme],
        settings: { ...prev.settings, boardTheme }
      };
    });
    setThemeNotice(`Unlocked & equipped ${name}!`);
    setTimeout(() => setThemeNotice(null), 2600);
  };

  const setPlayMode = (playMode: PlayMode) => {
    onUpdateState(prev => {
      soundManager.playSound('upgrade', prev.settings.soundFx);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          playMode,
          turboMode: playMode === 'express' ? true : prev.settings.turboMode,
          showMergeHighlights: playMode === 'relaxed' ? true : prev.settings.showMergeHighlights
        }
      };
    });
  };

  const playModes: {
    id: PlayMode;
    name: string;
    detail: string;
    badge: string;
    Icon: React.FC<{ className?: string }>;
    activeStyle: string;
  }[] = [
    {
      id: 'standard',
      name: 'Standard',
      detail: 'Balanced 8s energy recovery and classic workshop tempo.',
      badge: 'Balanced',
      Icon: Gauge,
      activeStyle: 'border-sky-400 bg-sky-50 text-sky-950'
    },
    {
      id: 'relaxed',
      name: 'Relaxed Cozy',
      detail: 'Faster 5s energy recovery with assisted pair highlights.',
      badge: '5s Regen',
      Icon: Coffee,
      activeStyle: 'border-emerald-400 bg-emerald-50 text-emerald-950'
    },
    {
      id: 'express',
      name: 'Express Speed',
      detail: '6s energy recovery + instant rapid material dispatch enabled.',
      badge: 'Fast Pace',
      Icon: Rocket,
      activeStyle: 'border-amber-400 bg-amber-50 text-amber-950'
    }
  ];

  const currentMode = state.settings?.playMode || 'standard';

  return (
    <div className="flex flex-col gap-3.5 max-w-md mx-auto p-3 select-none text-slate-900 pb-12">
      {/* Header */}
      <div className="bg-white border border-indigo-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Game Modes & Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Customize gameplay speed, assists, audio & board style</p>
          </div>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        )}
      </div>

      {/* Play Mode Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm">
        <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-sky-600" /> Game Mode
        </h3>

        <div className="flex flex-col gap-2">
          {playModes.map(mode => {
            const isSelected = currentMode === mode.id;
            const ModeIcon = mode.Icon;
            return (
              <button
                key={mode.id}
                onClick={() => setPlayMode(mode.id)}
                className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2.5 transition cursor-pointer ${
                  isSelected
                    ? `${mode.activeStyle} shadow-sm`
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <ModeIcon className="w-4 h-4 text-slate-800" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span>{mode.name}</span>
                      <span className="text-[10px] font-bold text-slate-500">· {mode.badge}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{mode.detail}</p>
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Accent Theme (Unlockable with Earned Coins) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-amber-500" /> Workshop Board Theme
          </h3>
          <span className="text-[11px] font-bold text-amber-700 tabular-nums flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            {state.coins.toLocaleString()}
          </span>
        </div>

        {themeNotice && (
          <div className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            {themeNotice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {BOARD_THEME_CATALOG.map(theme => {
            const isUnlocked = theme.unlockCoins === 0 || unlockedThemes.includes(theme.id);
            const isSelected = (state.settings?.boardTheme || 'amber') === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelectOrBuyTheme(theme.id, theme.unlockCoins, theme.name)}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-sm'
                    : isUnlocked
                    ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    : 'border-indigo-200 bg-indigo-50/40 text-slate-800 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full ${theme.swatch} border border-white shadow-sm`} />
                  <div className="text-left">
                    <div>{theme.name}</div>
                    <div className="text-[10px] font-medium text-slate-500">{theme.tagline}</div>
                  </div>
                </div>
                {isSelected ? (
                  <Check className="w-4 h-4 text-amber-600" />
                ) : isUnlocked ? (
                  <span className="text-[11px] text-slate-500 font-semibold">Equip</span>
                ) : (
                  <span className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 tabular-nums">
                    <Lock className="w-3 h-3" />
                    {theme.unlockCoins.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gameplay & Interface Features */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
        <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-600" /> Workshop Features & Assists
        </h3>

        {[
          {
            key: 'showMergeHighlights' as const,
            title: 'Merge Pair Highlights',
            desc: 'Glow matching tier & category components when tapped',
            value: state.settings?.showMergeHighlights !== false
          },
          {
            key: 'turboMode' as const,
            title: 'Rapid Material Dispatch',
            desc: 'Zero-delay spawning when sourcing items',
            value: Boolean(state.settings?.turboMode)
          },
          {
            key: 'showOrderBadges' as const,
            title: 'Contract Match Checkmarks',
            desc: 'Show green ✓ marker on items needed by active orders',
            value: state.settings?.showOrderBadges !== false
          },
          {
            key: 'showFloatingRewards' as const,
            title: 'Floating Reward Popups',
            desc: 'Animate +Coin and +Gem popups on the screen',
            value: state.settings?.showFloatingRewards !== false
          },
          {
            key: 'vibration' as const,
            title: 'Haptic Touch Feedback',
            desc: 'Subtle vibration feedback on supported devices',
            value: state.settings?.vibration !== false,
            icon: <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
          }
        ].map((item, idx) => (
          <div
            key={item.key}
            className={`flex items-center justify-between gap-2 ${
              idx > 0 ? 'border-t border-slate-100 pt-3' : ''
            }`}
          >
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                {item.key === 'turboMode' && <Zap className="w-3.5 h-3.5 text-amber-500" />}
                {item.icon}
                <span>{item.title}</span>
              </span>
              <span className="text-[11px] text-slate-500">{item.desc}</span>
            </div>
            <button
              onClick={() => toggleSetting(item.key)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
                item.value
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {item.value ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      {/* Audio Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
        <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-sky-600" /> Audio
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {state.settings.soundFx ? (
              <Volume2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-xs font-bold text-slate-900">Sound Effects</span>
          </div>
          <button
            onClick={() => toggleSetting('soundFx')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
              state.settings.soundFx
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {state.settings.soundFx ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <Music className={`w-4 h-4 ${state.settings.music ? 'text-amber-500' : 'text-slate-400'}`} />
            <span className="text-xs font-bold text-slate-900">Ambient Score</span>
          </div>
          <button
            onClick={() => toggleSetting('music')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
              state.settings.music
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {state.settings.music ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Facility Record */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm">
        <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-violet-600" /> Facility Statistics
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
            <div className="text-sm font-extrabold text-slate-900">{state.stats.totalMerges.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 font-semibold">Merges</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
            <div className="text-sm font-extrabold text-emerald-700">{state.stats.totalOrdersCompleted.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 font-semibold">Orders</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
            <div className="text-sm font-extrabold text-amber-600">Tier {state.stats.highestTierUnlocked}</div>
            <div className="text-[10px] text-slate-500 font-semibold">Max Tier</div>
          </div>
        </div>
      </div>

      {/* Install as Standalone App */}
      <PWAInstallButton />

      {/* Privacy, Ads & Build Disclosure */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-slate-900">Privacy & Ad Disclosure</div>
            <div className="text-[11px] text-slate-500 truncate">Online required · Local saves · Ad-supported</div>
          </div>
        </div>
        <button
          onClick={() => {
            soundManager.playSound('click', state.settings.soundFx);
            setShowPrivacyModal(true);
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer shrink-0 transition"
        >
          View Policy
        </button>
      </div>

      {onResetGame && (
        confirmReset ? (
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-rose-800">Erase all factory progress?</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetGameSave();
                  try {
                    localStorage.removeItem('idle_factory_shop_daily_gift');
                  } catch {
                    // Ignore storage failures
                  }
                  setConfirmReset(false);
                  onResetGame();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Facility Progress</span>
          </button>
        )
      )}

      {/* Privacy & Ad Policy Modal */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-scaleIn"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="bg-white border border-indigo-200 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3 relative text-slate-900 max-h-[85vh] overflow-y-auto no-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              aria-label="Close privacy policy"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 pr-8">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <h3 className="text-base font-extrabold text-slate-900">Privacy & Ad Policy</h3>
            </div>

            <div className="text-xs text-slate-700 space-y-2.5 leading-relaxed">
              <p>
                <strong>Local Storage Only:</strong> Merge Factory 2D saves your workshop grid, currencies, settings, and daily tasks strictly on your device using browser/device local storage. No personal account, email, or server upload is used.
              </p>
              <p>
                <strong>Ad-Supported Gameplay:</strong> Consumable refills, optional 2x contract/plant boosts, and periodic contract transitions use rewarded or interstitial ad placements. When packaged for Google Play with Google AdMob SDK, ad identifiers may be processed by Google Mobile Ads subject to your regional consent choice (UMP).
              </p>
              <p>
                <strong>Data Deletion:</strong> You can erase all locally stored game data anytime using the Reset Facility Progress button in Settings.
              </p>
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
