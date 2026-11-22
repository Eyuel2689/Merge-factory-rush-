import React from 'react';
import { ItemDefinition, ConsumableDef } from '../types';
import { X, Sparkles, BookOpen, Wrench, Layers, Coins, PlayCircle } from 'lucide-react';

interface ItemDetailModalProps {
  item?: ItemDefinition;
  consumable?: ConsumableDef;
  consumableStock?: number;
  onRefillConsumable?: () => void;
  onUseConsumable?: () => void;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  consumable,
  consumableStock = 0,
  onRefillConsumable,
  onUseConsumable,
  onClose
}) => {
  if (consumable) {
    const canRefill = consumableStock < consumable.maxStock;
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-scaleIn"
        onClick={onClose}
      >
        <div
          className="bg-white border-2 border-violet-300 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3.5 relative text-slate-900 max-h-[88vh] overflow-y-auto no-scrollbar"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition z-10"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5 pr-7">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${consumable.bgGradient} border-2 border-white shadow-md flex items-center justify-center shrink-0 text-3xl`}
            >
              {consumable.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-violet-700 flex items-center gap-1 uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span>Ad-Refillable Consumable</span>
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight mt-0.5">
                {consumable.name}
              </h3>
              <span className="text-xs text-slate-600 font-semibold mt-0.5 tabular-nums">
                Charges: {consumableStock} / {consumable.maxStock} · {consumable.badge}
              </span>
            </div>
          </div>

          <div className="bg-sky-50/75 border border-sky-200/80 rounded-2xl p-3.5 flex flex-col gap-1.5">
            <div className="text-[11px] font-bold text-sky-800 uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-sky-600" />
              <span>Effect & Description</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{consumable.fullDesc}</p>
          </div>

          <div className="bg-emerald-50/75 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col gap-1.5">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span>How to Use & Refill</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{consumable.usageGuide}</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {consumableStock > 0 && onUseConsumable && (
              <button
                onClick={() => {
                  onClose();
                  onUseConsumable();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs shadow-sm active:scale-95 transition cursor-pointer"
              >
                Use Charge
              </button>
            )}

            {canRefill && onRefillConsumable ? (
              <button
                onClick={() => {
                  onClose();
                  onRefillConsumable();
                }}
                className="flex-[1.3] py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Refill +1 · Watch Ad</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                {canRefill ? 'Close' : 'Full Capacity'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;
  const details = item.fullDetails;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-scaleIn"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-indigo-200 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3.5 relative text-slate-900 max-h-[88vh] overflow-y-auto no-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition z-10"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 pr-7">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.bgGradient} p-1.5 border border-indigo-200 shadow-md flex items-center justify-center shrink-0 overflow-hidden`}
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover rounded-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-4xl">{item.icon}</span>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                Workshop Asset · Tier {item.tier}
              </span>
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 leading-tight mt-0.5">
              {item.name}
            </h3>
            <span className="text-xs text-slate-500 font-medium capitalize mt-0.5">
              {item.rarity || 'Standard'} {item.specialUse ? '· Active Utility' : '· Craft Component'}
            </span>
          </div>
        </div>

        {item.specialUse && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-extrabold text-amber-900 leading-snug">
              {item.specialUse.label}
            </span>
          </div>
        )}

        <div className="bg-sky-50/75 border border-sky-200/80 rounded-2xl p-3.5 flex flex-col gap-1.5">
          <div className="text-[11px] font-bold text-sky-800 uppercase tracking-wide flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-sky-600" />
            <span>Full Description</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {details?.lore || item.description}
          </p>
        </div>

        <div className="bg-emerald-50/75 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col gap-2">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-emerald-600" />
            <span>Effects & How to Use</span>
          </div>
          <p className="text-xs text-slate-800 font-medium leading-relaxed">
            {details?.mechanics || item.specialUse?.description || item.description}
          </p>
          {details?.usageGuide && (
            <p className="text-xs text-slate-600 leading-relaxed border-t border-emerald-200/70 pt-2">
              {details.usageGuide}
            </p>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-violet-600" />
            <span>Valuation</span>
          </div>
          {details?.stackRule && (
            <p className="text-xs text-slate-600 leading-relaxed">{details.stackRule}</p>
          )}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80 tabular-nums">
            <span className="text-slate-600 flex items-center gap-1 font-medium">
              <Coins className="w-3.5 h-3.5 text-amber-500" /> Base Asset Value
            </span>
            <span className="font-bold text-slate-900">{item.coinValue.toLocaleString()} Coins</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-xs shadow-sm active:scale-95 transition cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
