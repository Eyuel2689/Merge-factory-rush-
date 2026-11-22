import React from 'react';
import { Order } from '../types';
import { resolveCustomerAvatar, isImageSource } from '../data/gameData';
import { PlayCircle, Coins, Gem, Sparkles, X, CheckCircle2 } from 'lucide-react';

interface OrderRewardModalProps {
  order: Order;
  onClaimNormal: () => void;
  onClaimDoubleWithAd: () => void;
  onClose: () => void;
}

export const OrderRewardModal: React.FC<OrderRewardModalProps> = ({
  order,
  onClaimNormal,
  onClaimDoubleWithAd,
  onClose
}) => {
  const normalCoins = Math.round(order.coinReward);
  const doubleCoins = normalCoins * 2;
  const normalGems = order.gemReward || 0;
  const doubleGems = normalGems * 2;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-indigo-200 rounded-2xl p-5 max-w-sm w-full text-slate-900 text-center shadow-2xl flex flex-col items-center gap-4 animate-scaleIn relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full p-1.5 transition cursor-pointer border border-slate-200"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Client Avatar */}
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-amber-50 border-2 border-amber-400 flex items-center justify-center text-2xl shrink-0">
          {(() => {
            const avatarSrc = resolveCustomerAvatar(order.customerAvatar);
            return isImageSource(avatarSrc) ? (
              <img
                src={avatarSrc}
                alt={order.customerName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{avatarSrc || '👤'}</span>
            );
          })()}
        </div>

        <div>
          {order.badge && (
            <span className="block text-[11px] font-bold text-amber-700 tracking-wide mb-0.5">
              {order.badge}
            </span>
          )}
          <h2 className="text-base font-extrabold text-slate-900">
            {order.customerName}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Watch a sponsored ad to double this contract payout.
          </p>
        </div>

        {/* Comparison Cards: 1x vs 2x */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-600">
              Standard (1x)
            </span>
            <div className="text-base font-extrabold text-slate-900 flex items-center gap-1 tabular-nums">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>+{normalCoins.toLocaleString()}</span>
            </div>
            {normalGems > 0 && (
              <div className="text-xs font-bold text-sky-700 flex items-center gap-1 tabular-nums">
                <Gem className="w-3.5 h-3.5 text-sky-500" />
                <span>+{normalGems}</span>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex flex-col items-center gap-1">
            <span className="text-[11px] font-bold text-amber-800">
              Ad Bonus (2x)
            </span>
            <div className="text-base font-extrabold text-amber-700 flex items-center gap-1 tabular-nums">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>+{doubleCoins.toLocaleString()}</span>
            </div>
            {doubleGems > 0 && (
              <div className="text-xs font-bold text-sky-700 flex items-center gap-1 tabular-nums">
                <Gem className="w-3.5 h-3.5 text-sky-500" />
                <span>+{doubleGems}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onClaimDoubleWithAd}
            className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-sm active:scale-95 transition cursor-pointer tabular-nums"
          >
            <PlayCircle className="w-4 h-4 shrink-0" />
            <span>
              Watch Ad · Claim 2x (+{doubleCoins.toLocaleString()} coins
              {doubleGems > 0 ? ` · +${doubleGems} gems` : ''})
            </span>
          </button>

          <button
            onClick={onClaimNormal}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer tabular-nums"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Deliver 1x (+{normalCoins.toLocaleString()} coins)</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium tabular-nums">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Includes +{order.xpReward} XP toward next facility rank</span>
        </div>
      </div>
    </div>
  );
};
