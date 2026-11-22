import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, X, CheckCircle2, PlayCircle, Lock, Zap, Coins, Film, Sparkles } from 'lucide-react';

export type AdRewardType = 'energy' | 'coins' | 'double_earnings' | 'consumable_refill' | 'interstitial';

interface AdModalProps {
  rewardType: AdRewardType;
  adDetail?: string;
  onComplete: () => void;
  onClose: () => void;
}

const AD_DURATION_SECONDS = 4;

export const AdModal: React.FC<AdModalProps> = ({ rewardType, adDetail, onComplete, onClose }) => {
  const totalSeconds = rewardType === 'interstitial' ? 3 : AD_DURATION_SECONDS;
  const [countdown, setCountdown] = useState(totalSeconds);
  const [adLoaded, setAdLoaded] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Check for real AdMob / Web Ad integration in window
  useEffect(() => {
    const win = window as any;
    if (win.admob || win.googletag || win.google) {
      setAdLoaded(true);
      try {
        if (win.admob?.showRewardedAd) {
          win.admob.showRewardedAd({
            onRewarded: () => handleClaimReward()
          });
        }
      } catch (e) {
        console.warn('AdMob SDK call attempted:', e);
      }
    }
  }, []);

  // Countdown timer: players watch the ad until countdown reaches 0
  useEffect(() => {
    if (hasClaimed) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      handleClaimReward();
    }
  }, [countdown, hasClaimed]);

  const handleClaimReward = () => {
    if (hasClaimed) return;
    setHasClaimed(true);
    setTimeout(() => {
      onCompleteRef.current();
    }, 150);
  };

  const isInterstitial = rewardType === 'interstitial';
  const isDoubleEarnings = rewardType === 'double_earnings';
  const isConsumableRefill = rewardType === 'consumable_refill';
  const canClaimEarly = isInterstitial;
  const progressPct = Math.min(100, Math.round(((totalSeconds - countdown) / totalSeconds) * 100));

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div
        className={`bg-white border rounded-2xl p-6 max-w-sm w-full text-slate-900 text-center shadow-2xl flex flex-col items-center gap-4 animate-scaleIn relative overflow-hidden ${
          isDoubleEarnings
            ? 'border-amber-400'
            : isConsumableRefill
            ? 'border-violet-300'
            : 'border-indigo-200'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg p-1.5 transition cursor-pointer z-20 border border-slate-200"
          title={countdown > 0 && !isInterstitial ? 'Cancel Ad (No Reward)' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{adLoaded ? 'Verified Ad Network' : 'Sponsored Partner Brief'}</span>
        </div>

        <div
          className={`w-14 h-14 rounded-xl flex items-center justify-center border shadow-xs ${
            isDoubleEarnings
              ? 'bg-amber-100 border-amber-300 text-amber-700 font-mono-num font-extrabold text-xl'
              : isConsumableRefill
              ? 'bg-violet-100 border-violet-300 text-violet-600'
              : 'bg-emerald-100 border-emerald-300 text-emerald-600'
          }`}
        >
          {rewardType === 'energy' ? (
            <Zap className="w-6 h-6" />
          ) : rewardType === 'coins' ? (
            <Coins className="w-6 h-6 text-amber-500" />
          ) : rewardType === 'double_earnings' ? (
            '2x'
          ) : rewardType === 'consumable_refill' ? (
            <Sparkles className="w-6 h-6" />
          ) : (
            <Film className="w-6 h-6" />
          )}
        </div>

        <div>
          <h3
            className={`text-base font-extrabold uppercase tracking-wider ${
              isDoubleEarnings
                ? 'text-amber-700'
                : isConsumableRefill
                ? 'text-violet-700'
                : 'text-slate-900'
            }`}
          >
            {isInterstitial
              ? 'Operational Transition'
              : isDoubleEarnings
              ? '2x Revenue Sponsor Ad'
              : isConsumableRefill
              ? adDetail || 'Consumable Refill Ad'
              : 'Sponsored Grant'}
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            {isInterstitial
              ? 'Brief logistics sync between contract batches.'
              : isDoubleEarnings
              ? 'Complete the full brief to unlock the 2x payout multiplier.'
              : isConsumableRefill
              ? 'Watch the short sponsor brief to refill +1 consumable charge.'
              : 'Complete the full brief to receive your supply grant.'}
          </p>
        </div>

        {!isInterstitial && (
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <PlayCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-900 truncate">
                Industrial Logistics Showcase
              </span>
              <span className="text-[10px] text-slate-500">
                Sponsored preview • Refill unlocks at 0s
              </span>
            </div>
          </div>
        )}

        <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-center gap-2.5">
          <div className="text-2xl font-mono-num tabular-nums font-extrabold text-amber-600">
            {countdown > 0 ? `${countdown}s` : 'Ready'}
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                isDoubleEarnings
                  ? 'bg-amber-400'
                  : isConsumableRefill
                  ? 'bg-violet-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <button
          onClick={handleClaimReward}
          disabled={!canClaimEarly && countdown > 0}
          className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${
            !canClaimEarly && countdown > 0
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : isDoubleEarnings
              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm cursor-pointer'
              : isConsumableRefill
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm cursor-pointer'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer'
          }`}
        >
          {!canClaimEarly && countdown > 0 ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span className="tabular-nums">Wait ({countdown}s)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isInterstitial
                  ? countdown > 0
                    ? 'Skip Transition'
                    : 'Continue'
                  : isDoubleEarnings
                  ? 'Claim 2x Payout'
                  : isConsumableRefill
                  ? 'Claim +1 Charge'
                  : 'Claim Grant'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
