import React, { useState, useRef, useEffect } from 'react';
import { GameState, ItemCategory } from '../types';
import {
  Dices,
  Coins,
  PlayCircle,
  Sparkles,
  Trophy,
  RotateCw,
  LockOpen,
  ShieldCheck,
  Ticket
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { triggerConfetti } from '../utils/confettiSafe';
import { recordDailyMissionProgress } from '../utils/dailyMissions';
import { getLocalTodayString } from '../utils/economy';
import { CONSUMABLE_DEFINITIONS, getItemDef } from '../data/gameData';
import { AdRewardType } from './AdModal';

interface ArcadeViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onTriggerRewardedAd: (rewardType: AdRewardType, onComplete: () => void, adDetail?: string) => void;
  onAddFloatingText?: (text: string, x: number, y: number, color?: string) => void;
}

type ArcadeGameTab = 'wheel' | 'slots' | 'scratch' | 'dice' | 'safes';

interface WheelSlice {
  id: string;
  label: string;
  short: string;
  color: string;
  textColor: string;
  rewardType: 'coins' | 'gems' | 'energy' | 'consumable' | 'part';
  amount: number;
}

const WHEEL_SLICES: WheelSlice[] = [
  { id: 'c120', label: '+120 Coins', short: '120🪙', color: '#FEF3C7', textColor: '#92400E', rewardType: 'coins', amount: 120 },
  { id: 'g1', label: '+1 Scarce Gem', short: '+1💎', color: '#CFFAFE', textColor: '#155E75', rewardType: 'gems', amount: 1 },
  { id: 'c350', label: '+350 Coins', short: '350🪙', color: '#FDE68A', textColor: '#78350F', rewardType: 'coins', amount: 350 },
  { id: 'e12', label: '+12 Energy', short: '+12⚡', color: '#D1FAE5', textColor: '#065F46', rewardType: 'energy', amount: 12 },
  { id: 'c700', label: '+700 Coins', short: '700🪙', color: '#FDBA74', textColor: '#7C2D12', rewardType: 'coins', amount: 700 },
  { id: 'cell', label: '+1 Charge Cell', short: '🔋+1', color: '#EDE9FE', textColor: '#5B21B6', rewardType: 'consumable', amount: 1 },
  { id: 'part3', label: 'Tier 3 Workshop Part', short: 'T3📦', color: '#E0F2FE', textColor: '#075985', rewardType: 'part', amount: 3 },
  { id: 'jackpot', label: 'JACKPOT +1,500 Coins', short: '1.5K👑', color: '#F59E0B', textColor: '#FFFFFF', rewardType: 'coins', amount: 1500 }
];

const WHEEL_WEIGHTS = [26, 10, 19, 17, 10, 8, 7, 3];

const SLOT_SYMBOLS = [
  { icon: '⚙️', name: 'Gear', mult3: 4 },
  { icon: '🪵', name: 'Timber', mult3: 4 },
  { icon: '⚡', name: 'Spark', mult3: 6 },
  { icon: '👑', name: 'Crown', mult3: 10 },
  { icon: '💎', name: 'Diamond', mult3: 14 },
  { icon: '7️⃣', name: 'Lucky 7', mult3: 24 }
];

interface ScratchTier {
  icon: string;
  label: string;
  coins: number;
  gems: number;
}

const SCRATCH_SYMBOLS: ScratchTier[] = [
  { icon: '⚙️', label: 'Gear Set', coins: 400, gems: 0 },
  { icon: '🪵', label: 'Timber Lot', coins: 550, gems: 0 },
  { icon: '⚡', label: 'Surge Cell', coins: 850, gems: 0 },
  { icon: '💎', label: 'Rare Crystal', coins: 1200, gems: 1 },
  { icon: '👑', label: 'Crown Bullion', coins: 2000, gems: 0 }
];

interface ScratchCardState {
  cost: number;
  cells: string[];
  revealed: boolean[];
  winTier: ScratchTier | null;
  settled: boolean;
}

function createScratchTicket(): ScratchCardState {
  const roll = Math.random();
  let winTier: ScratchTier | null = null;
  if (roll < 0.04) winTier = SCRATCH_SYMBOLS[4]; // Crown 2000
  else if (roll < 0.11) winTier = SCRATCH_SYMBOLS[3]; // Diamond 1200 + 1 Gem
  else if (roll < 0.24) winTier = SCRATCH_SYMBOLS[2]; // Spark 850
  else if (roll < 0.44) winTier = SCRATCH_SYMBOLS[1]; // Timber 550
  else if (roll < 0.68) winTier = SCRATCH_SYMBOLS[0]; // Gear 400

  const cells: string[] = [];
  if (winTier) {
    cells.push(winTier.icon, winTier.icon, winTier.icon);
    const others = SCRATCH_SYMBOLS.filter(s => s.icon !== winTier!.icon);
    const counts: Record<string, number> = {};
    while (cells.length < 9) {
      const candidate = others[Math.floor(Math.random() * others.length)].icon;
      if ((counts[candidate] || 0) < 2) {
        counts[candidate] = (counts[candidate] || 0) + 1;
        cells.push(candidate);
      }
    }
  } else {
    // Near-miss exciting layout (max 2 of any icon)
    const counts: Record<string, number> = {};
    while (cells.length < 9) {
      const candidate = SCRATCH_SYMBOLS[Math.floor(Math.random() * SCRATCH_SYMBOLS.length)].icon;
      if ((counts[candidate] || 0) < 2) {
        counts[candidate] = (counts[candidate] || 0) + 1;
        cells.push(candidate);
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return {
    cost: 250,
    cells,
    revealed: Array(9).fill(false),
    winTier,
    settled: false
  };
}

interface SafePrize {
  label: string;
  tier: 'grand' | 'solid' | 'starter';
  coins: number;
  gems: number;
  energy: number;
  consumable?: boolean;
}

const SAFE_POOLS: SafePrize[] = [
  { label: '+750 Coins & +1 Gem', tier: 'grand', coins: 750, gems: 1, energy: 0 },
  { label: '+280 Coins & +8 Energy', tier: 'solid', coins: 280, gems: 0, energy: 8 },
  { label: '+120 Coins & +1 Promoter', tier: 'starter', coins: 120, gems: 0, energy: 0, consumable: true }
];

const DieFace: React.FC<{ value: number; rolling?: boolean }> = ({ value, rolling }) => {
  const pipsMap: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  const active = pipsMap[value] || [4];

  return (
    <div
      className={`w-16 h-16 rounded-2xl bg-white border-2 border-indigo-200 shadow-md p-2.5 grid grid-cols-3 grid-rows-3 gap-1 place-items-center transition-transform duration-150 ${
        rolling ? 'animate-spin' : ''
      }`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <span
          key={idx}
          className={`w-2.5 h-2.5 rounded-full ${
            active.includes(idx)
              ? value === 1 || value === 6
                ? 'bg-rose-600'
                : 'bg-slate-900'
              : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
};

export const ArcadeView: React.FC<ArcadeViewProps> = ({
  state,
  onUpdateState,
  onTriggerRewardedAd,
  onAddFloatingText
}) => {
  const [gameTab, setGameTab] = useState<ArcadeGameTab>('wheel');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'win' | 'info' | 'error'; text: string } | null>(null);

  // Lucky Wheel state
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [isWheelSpinning, setIsWheelSpinning] = useState<boolean>(false);

  // Slots state
  const [slotStake, setSlotStake] = useState<number>(150);
  const [reels, setReels] = useState<number[]>([5, 4, 5]);
  const [isSlotSpinning, setIsSlotSpinning] = useState<boolean>(false);
  const [slotLastResult, setSlotLastResult] = useState<string>('Match 2 or 3 symbols to win up to 24x!');

  // Scratch Ticket state
  const [scratchTicket, setScratchTicket] = useState<ScratchCardState | null>(null);

  // Dice state
  const [diceStake, setDiceStake] = useState<number>(150);
  const [diceValues, setDiceValues] = useState<[number, number]>([4, 3]);
  const [isDiceRolling, setIsDiceRolling] = useState<boolean>(false);
  const [diceLastResult, setDiceLastResult] = useState<string>('Predict Under 7, Exact 7, or Over 7!');

  // Mystery Safes state
  const [safeRoundId, setSafeRoundId] = useState<number>(1);
  const [shuffledSafes, setShuffledSafes] = useState<SafePrize[]>(() =>
    [...SAFE_POOLS].sort(() => Math.random() - 0.5)
  );
  const [openedSafeIdx, setOpenedSafeIdx] = useState<number | null>(null);

  const timersRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const scheduleTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  const notify = (text: string, type: 'win' | 'info' | 'error' = 'win') => {
    setBannerMsg({ type, text });
  };

  const todayStr = getLocalTodayString();
  const isNewSpinDay = (state.arcade?.lastSpinResetDate || '') !== todayStr;
  const nonAdSpinsLeft = isNewSpinDay ? 3 : Math.max(0, state.arcade?.dailyCasinoSpinsLeft ?? 3);
  const hasFreeDailySpin = (state.arcade?.lastFreeSpinDate || '') !== todayStr;

  const handleWatchAdForSpins = () => {
    onTriggerRewardedAd(
      'arcade_spins',
      () => {
        onUpdateState(prev => {
          const prevArcade = prev.arcade || {
            lastFreeSpinDate: '',
            dailyCasinoSpinsLeft: 3,
            lastSpinResetDate: todayStr,
            totalSpins: 0,
            totalGamesPlayed: 0,
            totalArcadeCoinsWon: 0,
            biggestWin: 0
          };
          const baseLeft =
            prevArcade.lastSpinResetDate !== todayStr
              ? 3
              : Math.max(0, prevArcade.dailyCasinoSpinsLeft ?? 0);
          return {
            ...prev,
            arcade: {
              ...prevArcade,
              dailyCasinoSpinsLeft: baseLeft + 3,
              lastSpinResetDate: todayStr
            }
          };
        });
        soundManager.playSound('upgrade', state.settings.soundFx);
        triggerConfetti({ particleCount: 40, spread: 55, origin: { y: 0.45 } });
        notify('+3 Casino Spins unlocked!', 'win');
        onAddFloatingText?.('+3 Casino Spins', window.innerWidth / 2, window.innerHeight * 0.36, '#7C3AED');
      },
      'Unlock +3 Casino Spins'
    );
  };

  const recordArcadeWin = (coinsWon: number, isSpin = false) => {
    onUpdateState(prev => {
      const prevArcade = prev.arcade || {
        lastFreeSpinDate: '',
        dailyCasinoSpinsLeft: 3,
        lastSpinResetDate: todayStr,
        totalSpins: 0,
        totalGamesPlayed: 0,
        totalArcadeCoinsWon: 0,
        biggestWin: 0
      };
      const nextDaily = coinsWon > 0 ? recordDailyMissionProgress(prev.dailyState, 'earn_coins', coinsWon) : prev.dailyState;
      return {
        ...prev,
        coins: prev.coins + coinsWon,
        dailyState: nextDaily,
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + coinsWon
        },
        arcade: {
          ...prevArcade,
          totalSpins: prevArcade.totalSpins + (isSpin ? 1 : 0),
          totalGamesPlayed: prevArcade.totalGamesPlayed + 1,
          totalArcadeCoinsWon: prevArcade.totalArcadeCoinsWon + coinsWon,
          biggestWin: Math.max(prevArcade.biggestWin || 0, coinsWon)
        }
      };
    });
  };

  // 1. LUCKY DRAW WHEEL (Respects 3 non-ad spin limit)
  const pickWeightedSliceIndex = () => {
    const total = WHEEL_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < WHEEL_WEIGHTS.length; i++) {
      r -= WHEEL_WEIGHTS[i];
      if (r <= 0) return i;
    }
    return 0;
  };

  const executeWheelSpin = (mode: 'free_daily' | 'coins' | 'ad') => {
    if (isWheelSpinning) return;

    if (mode !== 'ad' && nonAdSpinsLeft <= 0) {
      soundManager.playSound('error', state.settings.soundFx);
      notify('0 Casino spins left without ads! Watch an ad to unlock +3 Spins.', 'error');
      handleWatchAdForSpins();
      return;
    }

    const coinCost = 150;
    if (mode === 'coins' && state.coins < coinCost) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`Needs ${coinCost} Coins for a spin, or watch a short ad for a free spin!`, 'error');
      return;
    }

    if (mode === 'coins') {
      onUpdateState(prev => {
        const curSpins =
          prev.arcade?.lastSpinResetDate !== todayStr
            ? 3
            : Math.max(0, prev.arcade?.dailyCasinoSpinsLeft ?? 0);
        if (prev.coins < coinCost || curSpins <= 0) return prev;
        return {
          ...prev,
          coins: prev.coins - coinCost,
          arcade: {
            ...prev.arcade,
            dailyCasinoSpinsLeft: curSpins - 1,
            lastSpinResetDate: todayStr
          }
        };
      });
    } else if (mode === 'free_daily') {
      onUpdateState(prev => {
        const curSpins =
          prev.arcade?.lastSpinResetDate !== todayStr
            ? 3
            : Math.max(0, prev.arcade?.dailyCasinoSpinsLeft ?? 0);
        if (curSpins <= 0) return prev;
        return {
          ...prev,
          arcade: {
            ...prev.arcade,
            lastFreeSpinDate: todayStr,
            dailyCasinoSpinsLeft: curSpins - 1,
            lastSpinResetDate: todayStr
          }
        };
      });
    }

    setIsWheelSpinning(true);
    soundManager.playSound('click', state.settings.soundFx);
    notify('Spinning the Lucky Draw Wheel...', 'info');

    const winIndex = pickWeightedSliceIndex();
    const slice = WHEEL_SLICES[winIndex];
    const sliceAngle = 360 / WHEEL_SLICES.length;
    const centerOfSlice = winIndex * sliceAngle + sliceAngle / 2;
    const targetMod = (360 - centerOfSlice) % 360;
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const deltaMod = (targetMod - currentMod + 360) % 360;
    const nextRot = wheelRotation + 5 * 360 + deltaMod;
    setWheelRotation(nextRot);

    scheduleTimer(() => {
      setIsWheelSpinning(false);

      if (slice.rewardType === 'coins') {
        recordArcadeWin(slice.amount, true);
        soundManager.playSound(slice.amount >= 700 ? 'upgrade' : 'coin', state.settings.soundFx);
        triggerConfetti({ particleCount: slice.amount >= 700 ? 75 : 40, spread: 70, origin: { y: 0.45 } });
        notify(`Wheel Won: ${slice.label}!`, 'win');
        onAddFloatingText?.(slice.label, window.innerWidth / 2, window.innerHeight * 0.42, '#D97706');
      } else if (slice.rewardType === 'gems') {
        onUpdateState(prev => ({
          ...prev,
          gems: prev.gems + slice.amount,
          arcade: {
            ...prev.arcade,
            totalSpins: (prev.arcade?.totalSpins || 0) + 1,
            totalGamesPlayed: (prev.arcade?.totalGamesPlayed || 0) + 1
          }
        }));
        soundManager.playSound('upgrade', state.settings.soundFx);
        triggerConfetti({ particleCount: 50, spread: 60, origin: { y: 0.45 } });
        notify(`Wheel Won: ${slice.label}!`, 'win');
        onAddFloatingText?.(slice.label, window.innerWidth / 2, window.innerHeight * 0.42, '#0284C7');
      } else if (slice.rewardType === 'energy') {
        onUpdateState(prev => ({
          ...prev,
          energy: Math.min(prev.maxEnergy, prev.energy + slice.amount),
          arcade: {
            ...prev.arcade,
            totalSpins: (prev.arcade?.totalSpins || 0) + 1,
            totalGamesPlayed: (prev.arcade?.totalGamesPlayed || 0) + 1
          }
        }));
        soundManager.playSound('coin', state.settings.soundFx);
        triggerConfetti({ particleCount: 35, spread: 50, origin: { y: 0.45 } });
        notify(`Wheel Won: ${slice.label}!`, 'win');
        onAddFloatingText?.(slice.label, window.innerWidth / 2, window.innerHeight * 0.42, '#059669');
      } else if (slice.rewardType === 'consumable') {
        onUpdateState(prev => {
          const def = CONSUMABLE_DEFINITIONS.energy_cell;
          const cur = prev.consumables?.energy_cell || 0;
          return {
            ...prev,
            consumables: {
              ...prev.consumables,
              energy_cell: Math.min(def.maxStock, cur + 1)
            },
            arcade: {
              ...prev.arcade,
              totalSpins: (prev.arcade?.totalSpins || 0) + 1,
              totalGamesPlayed: (prev.arcade?.totalGamesPlayed || 0) + 1
            }
          };
        });
        soundManager.playSound('upgrade', state.settings.soundFx);
        triggerConfetti({ particleCount: 40, spread: 55, origin: { y: 0.45 } });
        notify(`Wheel Won: ${slice.label}!`, 'win');
      } else if (slice.rewardType === 'part') {
        const cats: ItemCategory[] = ['wood', 'metal', 'tech', 'gem'];
        const cat = cats[Math.floor(Math.random() * cats.length)];
        const partDef = getItemDef(cat, 3);
        onUpdateState(prev => {
          const nextBoard = [...prev.board];
          const nextInv = [...prev.inventory];
          const newItem = {
            id: `whl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tier: 3,
            category: cat
          };
          const emptyIdx = nextBoard.findIndex(c => c.item === null);
          if (emptyIdx !== -1) {
            nextBoard[emptyIdx] = { ...nextBoard[emptyIdx], item: newItem };
          } else if (nextInv.length < prev.maxInventoryCapacity) {
            nextInv.push(newItem);
          } else {
            return {
              ...prev,
              coins: prev.coins + 200,
              arcade: {
                ...prev.arcade,
                totalSpins: (prev.arcade?.totalSpins || 0) + 1,
                totalGamesPlayed: (prev.arcade?.totalGamesPlayed || 0) + 1
              }
            };
          }
          return {
            ...prev,
            board: nextBoard,
            inventory: nextInv,
            arcade: {
              ...prev.arcade,
              totalSpins: (prev.arcade?.totalSpins || 0) + 1,
              totalGamesPlayed: (prev.arcade?.totalGamesPlayed || 0) + 1
            }
          };
        });
        soundManager.playSound('upgrade', state.settings.soundFx);
        triggerConfetti({ particleCount: 45, spread: 60, origin: { y: 0.45 } });
        notify(`Wheel Won: T3 ${partDef.name}!`, 'win');
      }
    }, 3100);
  };

  // 2. FACTORY SLOTS (Respects 3 non-ad spin limit)
  const handleSpinSlots = () => {
    if (isSlotSpinning) return;

    if (nonAdSpinsLeft <= 0) {
      soundManager.playSound('error', state.settings.soundFx);
      notify('0 Casino spins left without ads! Watch an ad to unlock +3 Spins.', 'error');
      handleWatchAdForSpins();
      return;
    }

    if (state.coins < slotStake) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`Needs ${slotStake.toLocaleString()} Coins to spin.`, 'error');
      return;
    }

    onUpdateState(prev => {
      const curSpins =
        prev.arcade?.lastSpinResetDate !== todayStr
          ? 3
          : Math.max(0, prev.arcade?.dailyCasinoSpinsLeft ?? 0);
      if (prev.coins < slotStake || curSpins <= 0) return prev;
      return {
        ...prev,
        coins: prev.coins - slotStake,
        arcade: {
          ...prev.arcade,
          dailyCasinoSpinsLeft: curSpins - 1,
          lastSpinResetDate: todayStr
        }
      };
    });

    soundManager.playSound('click', state.settings.soundFx);
    setIsSlotSpinning(true);
    setSlotLastResult('Reels spinning...');

    const rollReel = () => {
      const weights = [27, 27, 20, 13, 8, 5];
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
      }
      return 0;
    };

    const finalReels = [rollReel(), rollReel(), rollReel()];

    const spinTick = window.setInterval(() => {
      setReels([
        Math.floor(Math.random() * SLOT_SYMBOLS.length),
        Math.floor(Math.random() * SLOT_SYMBOLS.length),
        Math.floor(Math.random() * SLOT_SYMBOLS.length)
      ]);
    }, 90);

    scheduleTimer(() => {
      window.clearInterval(spinTick);
      setReels(finalReels);
      setIsSlotSpinning(false);

      const [a, b, c] = finalReels;
      let winCoins = 0;
      let bonusGems = 0;
      let msg = 'No match this spin — try again!';

      if (a === b && b === c) {
        const sym = SLOT_SYMBOLS[a];
        winCoins = slotStake * sym.mult3;
        if (a === 4) bonusGems = 1;
        if (a === 5) bonusGems = 2;
        msg = `JACKPOT! 3× ${sym.icon} paid +${winCoins.toLocaleString()} Coins${
          bonusGems > 0 ? ` & +${bonusGems} Scarce Gem${bonusGems > 1 ? 's' : ''}` : ''
        }!`;
      } else if (a === b || b === c || a === c) {
        winCoins = Math.round(slotStake * 1.6);
        msg = `Double Match! Paid +${winCoins.toLocaleString()} Coins`;
      }

      if (winCoins > 0) {
        recordArcadeWin(winCoins, true);
        if (bonusGems > 0) {
          onUpdateState(prev => ({ ...prev, gems: prev.gems + bonusGems }));
        }
        soundManager.playSound(a === b && b === c ? 'upgrade' : 'coin', state.settings.soundFx);
        triggerConfetti({ particleCount: a === b && b === c ? 70 : 30, spread: 60, origin: { y: 0.5 } });
        notify(msg, 'win');
        onAddFloatingText?.(`+${winCoins.toLocaleString()} Coins`, window.innerWidth / 2, window.innerHeight * 0.45, '#D97706');
      } else {
        onUpdateState(prev => ({
          ...prev,
          arcade: {
            ...prev.arcade,
            totalSpins: (prev.arcade?.totalSpins || 0) + 1,
            totalGamesPlayed: (prev.arcade?.totalGamesPlayed || 0) + 1
          }
        }));
        notify(msg, 'info');
      }
      setSlotLastResult(msg);
    }, 950);
  };

  // 3. SCRATCH & WIN FACTORY TICKET (Creative Coin-Spending Game)
  const settleScratchTicket = (ticket: ScratchCardState) => {
    if (ticket.settled) return;
    const updatedTicket: ScratchCardState = { ...ticket, revealed: Array(9).fill(true), settled: true };
    setScratchTicket(updatedTicket);

    if (ticket.winTier) {
      recordArcadeWin(ticket.winTier.coins);
      if (ticket.winTier.gems > 0) {
        onUpdateState(prev => ({ ...prev, gems: prev.gems + ticket.winTier!.gems }));
      }
      soundManager.playSound('upgrade', state.settings.soundFx);
      triggerConfetti({ particleCount: 60, spread: 65, origin: { y: 0.5 } });
      const msg = `3× ${ticket.winTier.icon} ${ticket.winTier.label}! Won +${ticket.winTier.coins.toLocaleString()} Coins${
        ticket.winTier.gems > 0 ? ` +${ticket.winTier.gems} Gem` : ''
      }!`;
      notify(msg, 'win');
      onAddFloatingText?.(`+${ticket.winTier.coins} Coins`, window.innerWidth / 2, window.innerHeight * 0.45, '#059669');
    } else {
      // 100 Coin Cashback consolation so players keep having fun
      recordArcadeWin(100);
      soundManager.playSound('coin', state.settings.soundFx);
      notify('No triple match — Salvage Cashback +100 Coins!', 'info');
    }
  };

  const handleBuyScratchTicket = () => {
    const cost = 250;
    if (state.coins < cost) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`Needs ${cost} Coins for a Scratch & Win Ticket.`, 'error');
      return;
    }

    onUpdateState(prev => (prev.coins < cost ? prev : { ...prev, coins: prev.coins - cost }));
    soundManager.playSound('click', state.settings.soundFx);
    setScratchTicket(createScratchTicket());
    notify('Tap foil tiles to scratch & match 3 identical symbols!', 'info');
  };

  const handleScratchCell = (idx: number) => {
    if (!scratchTicket || scratchTicket.settled || scratchTicket.revealed[idx]) return;
    soundManager.playSound('click', state.settings.soundFx);
    const nextRevealed = [...scratchTicket.revealed];
    nextRevealed[idx] = true;
    const nextTicket: ScratchCardState = { ...scratchTicket, revealed: nextRevealed };
    setScratchTicket(nextTicket);

    if (nextRevealed.every(Boolean)) {
      settleScratchTicket(nextTicket);
    }
  };

  // 4. LUCKY DICE HIGH-LOW
  const handleRollDice = (choice: 'under' | 'exact' | 'over') => {
    if (isDiceRolling) return;
    if (state.coins < diceStake) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`Needs ${diceStake.toLocaleString()} Coins to bet.`, 'error');
      return;
    }

    onUpdateState(prev => (prev.coins < diceStake ? prev : { ...prev, coins: prev.coins - diceStake }));
    soundManager.playSound('click', state.settings.soundFx);
    setIsDiceRolling(true);
    setDiceLastResult('Rolling the dice...');

    scheduleTimer(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      setDiceValues([d1, d2]);
      setIsDiceRolling(false);

      const won =
        (choice === 'under' && sum < 7) ||
        (choice === 'exact' && sum === 7) ||
        (choice === 'over' && sum > 7);

      if (won) {
        const mult = choice === 'exact' ? 4.5 : 2.1;
        const winCoins = Math.round(diceStake * mult);
        recordArcadeWin(winCoins);
        soundManager.playSound(choice === 'exact' ? 'upgrade' : 'coin', state.settings.soundFx);
        triggerConfetti({ particleCount: choice === 'exact' ? 60 : 30, spread: 55, origin: { y: 0.5 } });
        const msg = `Rolled ${sum} (${d1}+${d2})! Won +${winCoins.toLocaleString()} Coins`;
        setDiceLastResult(msg);
        notify(msg, 'win');
        onAddFloatingText?.(`+${winCoins.toLocaleString()} Coins`, window.innerWidth / 2, window.innerHeight * 0.45, '#059669');
      } else {
        onUpdateState(prev => ({
          ...prev,
          arcade: {
            ...prev.arcade,
            totalGamesPlayed: (prev.arcade?.totalGamesPlayed || 0) + 1
          }
        }));
        const msg = `Rolled ${sum} (${d1}+${d2}) — missed! Try another roll.`;
        setDiceLastResult(msg);
        notify(msg, 'info');
      }
    }, 550);
  };

  // 5. MYSTERY SAFES
  const handlePickSafe = (idx: number, useFreeAd = false) => {
    if (openedSafeIdx !== null) return;
    const entryCost = 200;

    if (!useFreeAd && state.coins < entryCost) {
      soundManager.playSound('error', state.settings.soundFx);
      notify(`Needs ${entryCost} Coins or watch an ad for a free Safe crack!`, 'error');
      return;
    }

    if (!useFreeAd) {
      onUpdateState(prev => (prev.coins < entryCost ? prev : { ...prev, coins: prev.coins - entryCost }));
    }

    const prize = shuffledSafes[idx];
    setOpenedSafeIdx(idx);

    if (prize.coins > 0) {
      recordArcadeWin(prize.coins);
    }

    if (prize.gems > 0 || prize.energy > 0 || prize.consumable) {
      onUpdateState(prev => {
        const nextConsumables = { ...prev.consumables };
        if (prize.consumable) {
          const def = CONSUMABLE_DEFINITIONS.tier_catalyst;
          nextConsumables.tier_catalyst = Math.min(
            def.maxStock,
            (nextConsumables.tier_catalyst || 0) + 1
          );
        }
        return {
          ...prev,
          gems: prev.gems + prize.gems,
          energy: Math.min(prev.maxEnergy, prev.energy + prize.energy),
          consumables: nextConsumables
        };
      });
    }

    soundManager.playSound(prize.tier === 'grand' ? 'upgrade' : 'coin', state.settings.soundFx);
    triggerConfetti({ particleCount: prize.tier === 'grand' ? 65 : 30, spread: 60, origin: { y: 0.5 } });
    notify(`Safe #${idx + 1} cracked: ${prize.label}!`, 'win');
    onAddFloatingText?.(prize.label, window.innerWidth / 2, window.innerHeight * 0.45, '#7C3AED');
  };

  const handleResetSafes = () => {
    setShuffledSafes([...SAFE_POOLS].sort(() => Math.random() - 0.5));
    setOpenedSafeIdx(null);
    setSafeRoundId(r => r + 1);
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-md mx-auto p-3 select-none text-slate-900 pb-14">
      {/* Arcade Header & Bankroll */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-rose-50 border border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Dices className="w-4 h-4 text-rose-600" />
              <span>Factory Arcade & Casino</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Spend earned Coins on Wheel, Slots, Scratch Cards, Dice & Safes!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
          <div className="bg-white border border-amber-200 rounded-xl p-2">
            <div className="text-xs font-extrabold text-amber-700 flex items-center justify-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>{state.coins.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold">Your Coins</div>
          </div>

          <div className="bg-white border border-rose-200 rounded-xl p-2">
            <div className="text-xs font-extrabold text-rose-700 flex items-center justify-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-rose-500" />
              <span>{(state.arcade?.biggestWin || 0).toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold">Best Win</div>
          </div>

          <div className="bg-white border border-indigo-200 rounded-xl p-2">
            <div className="text-xs font-extrabold text-indigo-700">
              {(state.arcade?.totalGamesPlayed || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold">Plays</div>
          </div>
        </div>

        {/* Non-Ad Spin Pass Limit Bar (3 Free/Coin Spins -> Watch Ad for +3 More) */}
        <div
          className={`rounded-xl p-2.5 border flex items-center justify-between gap-2 ${
            nonAdSpinsLeft > 0
              ? 'bg-emerald-50/80 border-emerald-200'
              : 'bg-rose-50 border-rose-300'
          }`}
        >
          <div className="flex flex-col gap-1">
            <div className="text-[11px] font-extrabold text-slate-900 flex items-center gap-1.5 tabular-nums">
              <span>Casino Spins Left:</span>
              <span className={nonAdSpinsLeft > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {nonAdSpinsLeft} / 3
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[0, 1, 2].map(idx => (
                <span
                  key={idx}
                  className={`w-4 h-2 rounded-full ${
                    idx < nonAdSpinsLeft ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              ))}
              {nonAdSpinsLeft > 3 && (
                <span className="text-[10px] font-extrabold text-violet-700 ml-1">
                  +{nonAdSpinsLeft - 3} Ad Bonus
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleWatchAdForSpins}
            className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer active:scale-95 transition shrink-0"
          >
            <PlayCircle className="w-3.5 h-3.5 shrink-0" />
            <span>+3 Spins · Ad</span>
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div
          className={`text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 border shadow-sm ${
            bannerMsg.type === 'win'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : bannerMsg.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
          <span>{bannerMsg.text}</span>
        </div>
      )}

      {/* 5-Game Switcher */}
      <div className="grid grid-cols-5 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        {([
          { id: 'wheel', label: hasFreeDailySpin && nonAdSpinsLeft > 0 ? 'Wheel!' : 'Wheel' },
          { id: 'slots', label: 'Slots' },
          { id: 'scratch', label: 'Scratch' },
          { id: 'dice', label: 'Dice' },
          { id: 'safes', label: 'Safes' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              soundManager.playSound('click', state.settings.soundFx);
              setGameTab(tab.id);
            }}
            className={`py-2 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap truncate ${
              gameTab === tab.id
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. LUCKY DRAW WHEEL */}
      {gameTab === 'wheel' && (
        <div className="bg-white border border-amber-200 rounded-3xl p-4 shadow-sm flex flex-col items-center gap-4">
          <div className="text-center">
            <h3 className="text-sm font-extrabold text-slate-900">Lucky Draw Prize Wheel</h3>
            <p className="text-[11px] text-slate-500">
              Uses 1 Casino Spin (limit 3 without ads) · Watch Ad anytime to spin or add +3 Spins
            </p>
          </div>

          {/* Wheel Container */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            <div className="absolute -top-2 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-rose-600 drop-shadow-md" />

            <div
              className="w-60 h-60 rounded-full border-4 border-amber-400 shadow-xl overflow-hidden"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: 'transform 3000ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {WHEEL_SLICES.map((slice, idx) => {
                  const angle = 360 / WHEEL_SLICES.length;
                  const startDeg = idx * angle - 90;
                  const endDeg = startDeg + angle;
                  const startRad = (startDeg * Math.PI) / 180;
                  const endRad = (endDeg * Math.PI) / 180;
                  const x1 = 100 + 100 * Math.cos(startRad);
                  const y1 = 100 + 100 * Math.sin(startRad);
                  const x2 = 100 + 100 * Math.cos(endRad);
                  const y2 = 100 + 100 * Math.sin(endRad);
                  const midDeg = idx * angle + angle / 2;

                  return (
                    <g key={slice.id}>
                      <path
                        d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
                        fill={slice.color}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      <text
                        x="100"
                        y="28"
                        fill={slice.textColor}
                        fontSize="10"
                        fontWeight="800"
                        textAnchor="middle"
                        transform={`rotate(${midDeg} 100 100)`}
                      >
                        {slice.short}
                      </text>
                    </g>
                  );
                })}
                <circle cx="100" cy="100" r="18" fill="#0F172A" stroke="#FBBF24" strokeWidth="3" />
                <text x="100" y="104" fill="#FFFFFF" fontSize="9" fontWeight="800" textAnchor="middle">
                  SPIN
                </text>
              </svg>
            </div>
          </div>

          {/* Wheel Actions */}
          <div className="flex flex-col gap-2 w-full">
            {hasFreeDailySpin && nonAdSpinsLeft > 0 && (
              <button
                onClick={() => executeWheelSpin('free_daily')}
                disabled={isWheelSpinning}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 transition disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isWheelSpinning ? 'Spinning...' : 'Claim Free Daily Spin (1 Spin)'}</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              {nonAdSpinsLeft > 0 ? (
                <button
                  onClick={() => executeWheelSpin('coins')}
                  disabled={isWheelSpinning}
                  className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition tabular-nums disabled:opacity-60"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Spin · 150 Coins</span>
                </button>
              ) : (
                <button
                  onClick={handleWatchAdForSpins}
                  disabled={isWheelSpinning}
                  className="py-2.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-sm cursor-pointer active:scale-95 transition disabled:opacity-60"
                >
                  <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>0 Left · +3 Spins Ad</span>
                </button>
              )}

              <button
                onClick={() =>
                  onTriggerRewardedAd(
                    'arcade_spin',
                    () => executeWheelSpin('ad'),
                    'Free Lucky Wheel Spin'
                  )
                }
                disabled={isWheelSpinning}
                className="py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition disabled:opacity-60"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Spin · Watch Ad</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. FACTORY JACKPOT SLOTS */}
      {gameTab === 'slots' && (
        <div className="bg-white border border-indigo-200 rounded-3xl p-4 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Factory Jackpot Slots</h3>
              <p className="text-[11px] text-slate-500">
                Uses 1 Casino Spin · Triple 7️⃣ pays 24x + 2 Scarce Gems
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-b from-slate-900 to-indigo-950 border-4 border-amber-400 rounded-2xl p-4 shadow-inner">
            <div className="grid grid-cols-3 gap-2.5">
              {reels.map((symbolIdx, i) => {
                const sym = SLOT_SYMBOLS[symbolIdx] || SLOT_SYMBOLS[0];
                return (
                  <div
                    key={i}
                    className={`h-20 rounded-xl bg-white border-2 border-amber-200 flex flex-col items-center justify-center shadow-md ${
                      isSlotSpinning ? 'animate-pulse' : ''
                    }`}
                  >
                    <span className="text-3xl leading-none">{sym.icon}</span>
                    <span className="text-[10px] font-bold text-slate-500 mt-1">{sym.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-xs font-bold text-amber-300 mt-3 tabular-nums">
              {slotLastResult}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-600">Select Coin Stake</span>
            <div className="grid grid-cols-4 gap-1.5">
              {[50, 150, 500, 1500].map(amt => (
                <button
                  key={amt}
                  onClick={() => {
                    soundManager.playSound('click', state.settings.soundFx);
                    setSlotStake(amt);
                  }}
                  disabled={isSlotSpinning}
                  className={`py-2 rounded-xl font-extrabold text-xs border transition cursor-pointer tabular-nums ${
                    slotStake === amt
                      ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {nonAdSpinsLeft > 0 ? (
            <button
              onClick={handleSpinSlots}
              disabled={isSlotSpinning}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 transition tabular-nums disabled:opacity-60"
            >
              <Coins className="w-4 h-4" />
              <span>
                {isSlotSpinning
                  ? 'Spinning...'
                  : `Spin Slots (${slotStake.toLocaleString()} Coins · ${nonAdSpinsLeft} left)`}
              </span>
            </button>
          ) : (
            <button
              onClick={handleWatchAdForSpins}
              disabled={isSlotSpinning}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-rose-600 hover:from-violet-500 hover:to-rose-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 transition"
            >
              <PlayCircle className="w-4 h-4" />
              <span>0 Spins Left · Watch Ad (+3 Spins)</span>
            </button>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 grid grid-cols-3 gap-2 text-[11px] text-center tabular-nums">
            <div><strong className="text-slate-900">7️⃣7️⃣7️⃣</strong><div className="text-amber-700 font-bold">24x + 2💎</div></div>
            <div><strong className="text-slate-900">💎💎💎</strong><div className="text-cyan-700 font-bold">14x + 1💎</div></div>
            <div><strong className="text-slate-900">Any 2×</strong><div className="text-emerald-700 font-bold">1.6x Coins</div></div>
          </div>
        </div>
      )}

      {/* 3. SCRATCH & WIN FACTORY TICKET */}
      {gameTab === 'scratch' && (
        <div className="bg-white border border-emerald-200 rounded-3xl p-4 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-emerald-600" />
                <span>Scratch & Win Factory Card</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                250 Coins per ticket · Match 3 icons to win up to 2,000 Coins or 1 Scarce Gem!
              </p>
            </div>
          </div>

          {!scratchTicket ? (
            <div className="bg-gradient-to-br from-emerald-50 to-amber-50 border-2 border-dashed border-emerald-300 rounded-2xl p-5 flex flex-col items-center gap-3 text-center">
              <div className="text-4xl">🎫</div>
              <div className="text-xs font-bold text-slate-700">
                Ready for a lucky shift ticket? Every non-matching ticket returns +100 Coins salvage!
              </div>
              <button
                onClick={handleBuyScratchTicket}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 transition tabular-nums"
              >
                <Coins className="w-4 h-4" />
                <span>Buy Scratch Ticket (250 Coins)</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2.5 bg-gradient-to-br from-amber-50 to-indigo-50 border-2 border-amber-300 rounded-2xl p-3">
                {scratchTicket.cells.map((icon, idx) => {
                  const isRevealed = scratchTicket.revealed[idx];
                  const isWinningIcon =
                    scratchTicket.settled && scratchTicket.winTier?.icon === icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleScratchCell(idx)}
                      disabled={isRevealed || scratchTicket.settled}
                      className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center transition ${
                        isRevealed
                          ? isWinningIcon
                            ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 shadow-sm'
                            : 'bg-white border-slate-200'
                          : 'bg-gradient-to-br from-slate-300 via-slate-200 to-slate-400 border-slate-400 hover:brightness-105 cursor-pointer active:scale-95 shadow-inner'
                      }`}
                    >
                      {isRevealed ? (
                        <span className="text-3xl leading-none">{icon}</span>
                      ) : (
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                          Scratch
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!scratchTicket.settled ? (
                <button
                  onClick={() => settleScratchTicket(scratchTicket)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs cursor-pointer active:scale-95 transition shadow-sm"
                >
                  Reveal All Tiles
                </button>
              ) : (
                <button
                  onClick={handleBuyScratchTicket}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition tabular-nums"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Buy Next Ticket (250 Coins)</span>
                </button>
              )}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 grid grid-cols-3 gap-2 text-[10px] text-center tabular-nums">
            <div><strong>3× 👑</strong><div className="text-amber-700 font-bold">+2,000🪙</div></div>
            <div><strong>3× 💎</strong><div className="text-cyan-700 font-bold">+1,200🪙 +1💎</div></div>
            <div><strong>3× ⚡ / 🪵 / ⚙️</strong><div className="text-emerald-700 font-bold">400–850🪙</div></div>
          </div>
        </div>
      )}

      {/* 4. LUCKY DICE HIGH-LOW */}
      {gameTab === 'dice' && (
        <div className="bg-white border border-sky-200 rounded-3xl p-4 shadow-sm flex flex-col gap-4">
          <div className="text-center">
            <h3 className="text-sm font-extrabold text-slate-900">Lucky Dice High-Low</h3>
            <p className="text-[11px] text-slate-500">Pick Under 7 (2.1x), Lucky 7 (4.5x), or Over 7 (2.1x)</p>
          </div>

          <div className="bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5 flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-5">
              <DieFace value={diceValues[0]} rolling={isDiceRolling} />
              <DieFace value={diceValues[1]} rolling={isDiceRolling} />
            </div>
            <div className="text-xs font-extrabold text-indigo-900 tabular-nums">
              Total: {diceValues[0] + diceValues[1]} · {diceLastResult}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-600">Select Coin Bet</span>
            <div className="grid grid-cols-4 gap-1.5">
              {[50, 150, 500, 1000].map(amt => (
                <button
                  key={amt}
                  onClick={() => {
                    soundManager.playSound('click', state.settings.soundFx);
                    setDiceStake(amt);
                  }}
                  disabled={isDiceRolling}
                  className={`py-2 rounded-xl font-extrabold text-xs border transition cursor-pointer tabular-nums ${
                    diceStake === amt
                      ? 'bg-sky-500 border-sky-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleRollDice('under')}
              disabled={isDiceRolling}
              className="py-3 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs flex flex-col items-center cursor-pointer active:scale-95 transition disabled:opacity-60"
            >
              <span>Under 7</span>
              <span className="text-[10px] opacity-90">Pays 2.1x</span>
            </button>

            <button
              onClick={() => handleRollDice('exact')}
              disabled={isDiceRolling}
              className="py-3 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex flex-col items-center cursor-pointer active:scale-95 transition disabled:opacity-60"
            >
              <span>Lucky 7</span>
              <span className="text-[10px]">Pays 4.5x</span>
            </button>

            <button
              onClick={() => handleRollDice('over')}
              disabled={isDiceRolling}
              className="py-3 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex flex-col items-center cursor-pointer active:scale-95 transition disabled:opacity-60"
            >
              <span>Over 7</span>
              <span className="text-[10px] opacity-90">Pays 2.1x</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. VAULT BREAKER MYSTERY SAFES */}
      {gameTab === 'safes' && (
        <div className="bg-white border border-violet-200 rounded-3xl p-4 shadow-sm flex flex-col gap-4">
          <div className="text-center">
            <h3 className="text-sm font-extrabold text-slate-900">Vault Breaker Mystery Safes</h3>
            <p className="text-[11px] text-slate-500">
              Pick 1 of 3 armored safes (200 Coins) — every safe holds Coins, Gems, Energy, or Boosters!
            </p>
          </div>

          <div key={safeRoundId} className="grid grid-cols-3 gap-2.5">
            {shuffledSafes.map((prize, idx) => {
              const isRevealed = openedSafeIdx !== null;
              const isPicked = openedSafeIdx === idx;

              return (
                <button
                  key={idx}
                  onClick={() => handlePickSafe(idx, false)}
                  disabled={isRevealed}
                  className={`rounded-2xl p-3 border-2 flex flex-col items-center justify-center gap-2 min-h-[124px] text-center transition ${
                    !isRevealed
                      ? 'bg-gradient-to-b from-slate-50 to-indigo-50 border-indigo-200 hover:border-amber-400 cursor-pointer active:scale-95 shadow-sm'
                      : isPicked
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  {isRevealed ? (
                    <>
                      <LockOpen
                        className={`w-6 h-6 ${
                          prize.tier === 'grand' ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      />
                      <span className="text-[11px] font-extrabold text-slate-900 leading-tight">
                        {prize.label}
                      </span>
                      {isPicked && (
                        <span className="text-[10px] font-bold text-amber-700">Your Pick</span>
                      )}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-8 h-8 text-indigo-600" />
                      <span className="text-xs font-extrabold text-slate-900">Safe #{idx + 1}</span>
                      <span className="text-[10px] font-bold text-amber-700">200 Coins</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {openedSafeIdx === null ? (
            <button
              onClick={() =>
                onTriggerRewardedAd(
                  'arcade_safe',
                  () => {
                    const randomPick = Math.floor(Math.random() * 3);
                    handlePickSafe(randomPick, true);
                  },
                  'Free Mystery Safe Crack'
                )
              }
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Crack a Random Safe Free · Watch Ad</span>
            </button>
          ) : (
            <button
              onClick={handleResetSafes}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>Play Next Round</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
