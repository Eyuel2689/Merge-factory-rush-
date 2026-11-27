export type ItemCategory = 'wood' | 'metal' | 'tech' | 'gem';

export type ItemSpecialAction =
  | 'tool_surge'
  | 'recharge_energy'
  | 'refine_gems';

export interface ItemSpecialUse {
  actionType: ItemSpecialAction;
  label: string;
  description: string;
  powerValue: number;
}

export interface ItemFullDetails {
  lore: string;
  mechanics: string;
  usageGuide: string;
  stackRule: string;
}

export interface ItemDefinition {
  tier: number;
  category: ItemCategory;
  name: string;
  icon: string; // Fallback icon if image fails
  image?: string; // High-res 3D rendered game asset image
  color: string;
  bgGradient: string;
  coinValue: number;
  description: string;
  fullDetails?: ItemFullDetails;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  specialUse?: ItemSpecialUse;
}

export type ConsumableId = 'energy_cell' | 'tier_catalyst' | 'overclock_core' | 'merge_magnet';

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  icon: string;
  shortDesc: string;
  fullDesc: string;
  usageGuide: string;
  maxStock: number;
  coinPrice: number;
  gemPrice: number;
  badge: string;
  bgGradient: string;
  borderClass: string;
}

export type PremiumPerkId =
  | 'goldenTurbineLevel'
  | 'energyCoreUpgrades'
  | 'vaultExpansions'
  | 'vipContractLevel';

export interface PremiumPerks {
  goldenTurbineLevel: number;
  energyCoreUpgrades: number;
  vaultExpansions: number;
  vipContractLevel: number;
}

export interface ArcadeState {
  lastFreeSpinDate: string;
  dailyCasinoSpinsLeft: number;
  lastSpinResetDate: string;
  totalSpins: number;
  totalGamesPlayed: number;
  totalArcadeCoinsWon: number;
  biggestWin: number;
}

export interface BoardItem {
  id: string; // unique instance id
  tier: number;
  category: ItemCategory;
}

export interface BoardCell {
  id: string; // index 0..24
  item: BoardItem | null;
}

export interface Machine {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: number;
  baseProduction: number; // Coins generated per cycle
  cycleTime: number; // in seconds
  upgradeCost: number;
  unlocked: boolean;
  unlockLevel: number;
}

export interface Worker {
  id: string;
  name: string;
  title: string;
  icon: string;
  level: number;
  boostMultiplier: number; // e.g. 0.20 (+20% boost per level)
  targetMachineId: string;
  upgradeCost: number;
  unlocked: boolean;
}

export interface OrderRequirement {
  itemTier: number;
  category: ItemCategory;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerAvatar: string;
  requirements: OrderRequirement[];
  coinReward: number;
  xpReward: number;
  gemReward?: number;
  badge?: string;
  isExpress?: boolean;
  // Legacy fields for backward compatibility
  itemTier?: number;
  quantity?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  currentValue: number;
  targetValue: number;
  coinReward: number;
  gemReward: number;
  claimed: boolean;
  type: 'merges' | 'factory_level' | 'orders' | 'item_tier' | 'machines';
}

export interface FloatingTextData {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export type BoardTheme = 'amber' | 'emerald' | 'purple' | 'ocean' | 'obsidian';
export type PlayMode = 'standard' | 'relaxed' | 'express';

export type DailyMissionType =
  | 'merges'
  | 'orders'
  | 'spawns'
  | 'upgrade'
  | 'craft_tier'
  | 'earn_coins';

export interface DailyMission {
  id: string;
  type: DailyMissionType;
  title: string;
  description: string;
  icon: string;
  target: number;
  current: number;
  coinReward: number;
  gemReward: number;
  energyReward?: number;
  targetTier?: number;
  completed: boolean;
  claimed: boolean;
}

export interface DailyState {
  lastResetDate: string; // Format: "YYYY-MM-DD"
  lastResetTimestamp: number;
  streak: number;
  missions: DailyMission[];
  grandRewardClaimed: boolean;
  grandRewardGoal: number;
}

export interface GameSettings {
  soundFx: boolean;
  music: boolean;
  boardTheme: BoardTheme;
  playMode: PlayMode;
  showMergeHighlights: boolean;
  turboMode: boolean;
  vibration: boolean;
  showFloatingRewards: boolean;
  showOrderBadges: boolean;
}

export interface GameState {
  coins: number;
  gems: number;
  energy: number;
  maxEnergy: number;
  lastEnergyRefillTime: number;
  
  level: number;
  xp: number;
  xpToNextLevel: number;
  
  factoryLevel: number;
  
  board: BoardCell[];
  inventory: BoardItem[];
  maxInventoryCapacity: number;
  
  machines: Machine[];
  workers: Worker[];
  orders: Order[];
  achievements: Achievement[];
  dailyState: DailyState;
  
  stats: {
    totalMerges: number;
    totalOrdersCompleted: number;
    highestTierUnlocked: number;
    totalCoinsEarned: number;
  };
  
  consumables: Record<ConsumableId, number>;
  premiumPerks: PremiumPerks;
  ownedIapIds: string[];
  unlockedThemes: BoardTheme[];
  arcade: ArcadeState;
  doubleEarningsUntil?: number;
  productionSurgeUntil?: number;
  lastSavedTimestamp: number;
  
  settings: GameSettings;
}
