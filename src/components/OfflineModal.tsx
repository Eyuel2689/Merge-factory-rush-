import React from 'react';
import { Coins, PlayCircle, Clock, Factory } from 'lucide-react';
import { triggerConfetti } from '../utils/confettiSafe';

interface OfflineModalProps {
  coins: number;
  seconds: number;
  onClaim: (doubleReward: boolean) => void;
  onTriggerRewardedAd: (rewardType: 'energy' | 'coins' | 'double_earnings', onComplete: () => void) => void;
}

export const OfflineModal: React.FC<OfflineModalProps> = ({
  coins,
  seconds,
  onClaim,
  onTriggerRewardedAd
}) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const handleDoubleReward = () => {
    onTriggerRewardedAd('double_earnings', () => {
      triggerConfetti({ particleCount: 55, spread: 70, origin: { y: 0.5 } });
      onClaim(true);
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-indigo-200 rounded-2xl p-5 max-w-sm w-full text-slate-900 text-center shadow-2xl flex flex-col items-center gap-4 animate-scaleIn">
        <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center">
          <Factory className="w-6 h-6 text-amber-600" />
        </div>

        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Shift Summary</h2>
          <p className="text-xs text-slate-600 mt-1 flex items-center justify-center gap-1 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>
              Plant operated offline for {hours > 0 ? `${hours}h ` : ''}
              {minutes}m
            </span>
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full flex flex-col items-center gap-1">
          <span className="text-[11px] font-bold text-amber-800">Net Output</span>
          <div className="text-2xl font-extrabold text-amber-700 flex items-center gap-2 tabular-nums">
            <Coins className="w-6 h-6 text-amber-500" />
            <span>+{coins.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={handleDoubleReward}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-95 transition cursor-pointer tabular-nums"
          >
            <PlayCircle className="w-4 h-4 shrink-0" />
            <span>Watch Ad · 2x ({(coins * 2).toLocaleString()} Coins)</span>
          </button>

          <button
            onClick={() => onClaim(false)}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs active:scale-95 transition cursor-pointer tabular-nums"
          >
            Collect 1x (+{coins.toLocaleString()})
          </button>
        </div>
      </div>
    </div>
  );
};
