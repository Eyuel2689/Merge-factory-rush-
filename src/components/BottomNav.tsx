import React from 'react';
import { Factory, ClipboardCheck, Cpu, Store, Dices } from 'lucide-react';

export type TabType = 'factory' | 'orders' | 'machines' | 'shop' | 'arcade' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unclaimedAchievementsCount: number;
  unfulfilledOrdersCount: number;
  unclaimedDailyCount?: number;
  hasFreeWheelSpin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  unclaimedAchievementsCount,
  unfulfilledOrdersCount,
  unclaimedDailyCount = 0,
  hasFreeWheelSpin = false
}) => {
  const goalsBadge = unclaimedAchievementsCount + unclaimedDailyCount + unfulfilledOrdersCount;

  const tabs: {
    id: Exclude<TabType, 'settings'>;
    label: string;
    Icon: React.FC<{ className?: string }>;
    badge?: number;
    activeClass: string;
  }[] = [
    {
      id: 'factory',
      label: 'Workshop',
      Icon: Factory,
      activeClass: 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm'
    },
    {
      id: 'orders',
      label: 'Orders',
      Icon: ClipboardCheck,
      badge: goalsBadge,
      activeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm'
    },
    {
      id: 'machines',
      label: 'Plant',
      Icon: Cpu,
      activeClass: 'bg-sky-100 text-sky-900 border-sky-300 shadow-sm'
    },
    {
      id: 'shop',
      label: 'Shop',
      Icon: Store,
      activeClass: 'bg-violet-100 text-violet-900 border-violet-300 shadow-sm'
    },
    {
      id: 'arcade',
      label: 'Casino',
      Icon: Dices,
      badge: hasFreeWheelSpin ? 1 : 0,
      activeClass: 'bg-rose-100 text-rose-900 border-rose-300 shadow-sm'
    }
  ];

  return (
    <nav className="bg-white/95 backdrop-blur-md border-t border-indigo-200/75 text-slate-600 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] sticky bottom-0 z-30 select-none shadow-[0_-4px_20px_rgba(15,23,42,0.06)] touch-manipulation">
      <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const IconComponent = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[44px] ${
                isActive
                  ? `${tab.activeClass} font-bold`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border-transparent'
              }`}
            >
              <IconComponent className="w-4 h-4 shrink-0" />
              <span className="text-[10px] tracking-tight leading-none mt-1 font-semibold truncate max-w-full">
                {tab.label}
              </span>

              {tab.badge && tab.badge > 0 ? (
                <span className="absolute top-1 right-1.5 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[9px] flex items-center justify-center tabular-nums shadow-sm">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
