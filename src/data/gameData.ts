import { ItemDefinition, Machine, Worker, Achievement, GameState, Order, ItemCategory, BoardItem, OrderRequirement, ConsumableId, ConsumableDef } from '../types';
import { createInitialDailyState } from '../utils/dailyMissions';

import imgTimberJoinery from '../assets/images/asset_timber_joinery_1795164661800.jpg';
import imgGeneratorBox from '../assets/images/item_generator_box_1788367065127.jpg';
import imgExecutiveChair from '../assets/images/asset_executive_chair_1795164662078.jpg';
import imgAlloyTurbine from '../assets/images/asset_alloy_turbine_1795164662235.jpg';
import imgBlueRotaryPhone from '../assets/images/item_blue_rotary_phone_1788367048064.jpg';
import imgHandheldConsole from '../assets/images/item_handheld_console_1788367004577.jpg';
import imgGamepadTwin from '../assets/images/item_gamepad_twin_1788366991707.jpg';
import imgDesktopPc from '../assets/images/item_desktop_pc_1788367081706.jpg';
import imgCashBundle from '../assets/images/item_cash_bundle_1788367019628.jpg';
import imgPinkGemStar from '../assets/images/item_pink_gem_star_1788367034022.jpg';
import imgMineralSapphire from '../assets/images/asset_mineral_sapphire_1795164663800.jpg';
import imgAvatarMia from '../assets/images/avatar_brunette_mia_1785111618094.jpg';
import imgAvatarScarlett from '../assets/images/avatar_redhead_scarlett_1785111630697.jpg';
import imgAvatarRichard from '../assets/images/avatar_gentleman_richard_1785111644836.jpg';

export const ALL_ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  // TIMBER & JOINERY (Structural Contracts)
  wood_1: {
    tier: 1,
    category: 'wood',
    name: 'Rough Timber',
    icon: '🪵',
    color: '#D97706',
    bgGradient: 'from-amber-400 via-orange-400 to-amber-500 border-amber-300',
    coinValue: 4,
    description: 'Raw milled hardwood stock for workshop assembly.',
    rarity: 'common'
  },
  wood_2: {
    tier: 2,
    category: 'wood',
    name: 'Braced Joinery',
    icon: '🪵',
    image: imgTimberJoinery,
    color: '#D97706',
    bgGradient: 'from-amber-400 via-orange-500 to-amber-600 border-amber-300',
    coinValue: 12,
    description: 'Precision-cut walnut planks bound with brushed brass.',
    rarity: 'common'
  },
  wood_3: {
    tier: 3,
    category: 'wood',
    name: 'Crafter Crate',
    icon: '📦',
    image: imgGeneratorBox,
    color: '#F59E0B',
    bgGradient: 'from-orange-400 via-amber-500 to-orange-600 border-amber-200',
    coinValue: 32,
    description: 'Reinforced industrial shipping and assembly crate.',
    rarity: 'uncommon'
  },
  wood_4: {
    tier: 4,
    category: 'wood',
    name: 'Executive Armchair',
    icon: '🪑',
    image: imgExecutiveChair,
    color: '#F59E0B',
    bgGradient: 'from-amber-500 via-orange-500 to-rose-500 border-amber-200',
    coinValue: 85,
    description: 'Hand-finished walnut and cognac leather lounge seating.',
    rarity: 'rare'
  },
  wood_5: {
    tier: 5,
    category: 'wood',
    name: 'Boardroom Suite',
    icon: '🛋️',
    color: '#FBBF24',
    bgGradient: 'from-amber-500 via-orange-600 to-amber-700 border-yellow-200',
    coinValue: 220,
    description: 'Custom architectural furnishings for executive offices.',
    rarity: 'epic'
  },
  wood_6: {
    tier: 6,
    category: 'wood',
    name: 'Heritage Pavilion',
    icon: '🏛️',
    color: '#FDE047',
    bgGradient: 'from-yellow-400 via-amber-500 to-orange-600 border-yellow-200',
    coinValue: 550,
    description: 'Masterwork timber structure built to architectural spec.',
    rarity: 'legendary'
  },

  // PRECISION ALLOY (Industrial Contracts + Machine Surge Utility on Tier 3+)
  metal_1: {
    tier: 1,
    category: 'metal',
    name: 'Copper Rivet',
    icon: '🔩',
    color: '#38BDF8',
    bgGradient: 'from-sky-400 via-cyan-500 to-blue-500 border-sky-200',
    coinValue: 5,
    description: 'Machined fastener for heavy industrial joints.',
    rarity: 'common'
  },
  metal_2: {
    tier: 2,
    category: 'metal',
    name: 'Steel Caliper',
    icon: '🔧',
    color: '#0EA5E9',
    bgGradient: 'from-cyan-400 via-sky-500 to-blue-600 border-cyan-200',
    coinValue: 16,
    description: 'Calibrated steel gauge and workshop wrench.',
    rarity: 'common'
  },
  metal_3: {
    tier: 3,
    category: 'metal',
    name: 'Precision Shears',
    icon: '✂️',
    color: '#38BDF8',
    bgGradient: 'from-sky-500 via-cyan-500 to-teal-500 border-sky-200',
    coinValue: 42,
    description: 'Hardened alloy cutter. Use to surge machine speed.',
    rarity: 'uncommon',
    specialUse: {
      actionType: 'tool_surge',
      label: 'Tool Machines (+50% · 60s)',
      description: 'Consume to boost all machine production by +50% for 60 seconds.',
      powerValue: 60
    }
  },
  metal_4: {
    tier: 4,
    category: 'metal',
    name: 'Hydraulic Actuator',
    icon: '⚙️',
    color: '#0EA5E9',
    bgGradient: 'from-cyan-500 via-blue-500 to-indigo-600 border-cyan-200',
    coinValue: 110,
    description: 'High-torque hydraulic drive unit for assembly lines.',
    rarity: 'rare',
    specialUse: {
      actionType: 'tool_surge',
      label: 'Tool Machines (+50% · 2m)',
      description: 'Consume to boost all machine production by +50% for 2 minutes.',
      powerValue: 120
    }
  },
  metal_5: {
    tier: 5,
    category: 'metal',
    name: 'Titanium Turbine',
    icon: '⚙️',
    image: imgAlloyTurbine,
    color: '#38BDF8',
    bgGradient: 'from-sky-500 via-indigo-500 to-blue-700 border-sky-200',
    coinValue: 280,
    description: 'CNC-milled titanium gearbox and turbine assembly.',
    rarity: 'epic',
    specialUse: {
      actionType: 'tool_surge',
      label: 'Tool Machines (+50% · 4m)',
      description: 'Consume to boost all machine production by +50% for 4 minutes.',
      powerValue: 240
    }
  },
  metal_6: {
    tier: 6,
    category: 'metal',
    name: 'Alloy Reactor Drive',
    icon: '🛡️',
    color: '#7DD3FC',
    bgGradient: 'from-cyan-400 via-blue-600 to-indigo-700 border-cyan-200',
    coinValue: 700,
    description: 'Flagship aerospace-grade propulsion core.',
    rarity: 'legendary',
    specialUse: {
      actionType: 'tool_surge',
      label: 'Tool Machines (+50% · 7m)',
      description: 'Consume to boost all machine production by +50% for 7 minutes.',
      powerValue: 420
    }
  },

  // ELECTRONICS & GRID (Tech Contracts + Energy Recharge Utility on Tier 3+)
  tech_1: {
    tier: 1,
    category: 'tech',
    name: 'Field Intercom',
    icon: '☎️',
    image: imgBlueRotaryPhone,
    color: '#60A5FA',
    bgGradient: 'from-blue-400 via-indigo-400 to-blue-600 border-blue-200',
    coinValue: 6,
    description: 'Analog factory floor dispatch handset.',
    rarity: 'common'
  },
  tech_2: {
    tier: 2,
    category: 'tech',
    name: 'Diagnostic Unit',
    icon: '🕹️',
    image: imgHandheldConsole,
    color: '#2DD4BF',
    bgGradient: 'from-indigo-400 via-violet-500 to-blue-600 border-indigo-200',
    coinValue: 18,
    description: 'Portable telemetry & handheld control module.',
    rarity: 'common'
  },
  tech_3: {
    tier: 3,
    category: 'tech',
    name: 'Dual Controller Rig',
    icon: '🎮',
    image: imgGamepadTwin,
    color: '#818CF8',
    bgGradient: 'from-violet-400 via-indigo-500 to-purple-600 border-violet-200',
    coinValue: 48,
    description: 'Synchronized twin operator controllers.',
    rarity: 'uncommon',
    specialUse: {
      actionType: 'recharge_energy',
      label: 'Recharge (+6 ⚡)',
      description: 'Consume to restore +6 Factory Energy immediately.',
      powerValue: 6
    }
  },
  tech_4: {
    tier: 4,
    category: 'tech',
    name: 'CAD Workstation',
    icon: '🖥️',
    image: imgDesktopPc,
    color: '#818CF8',
    bgGradient: 'from-indigo-500 via-purple-500 to-violet-700 border-indigo-200',
    coinValue: 125,
    description: 'High-output industrial CAD and compute terminal.',
    rarity: 'rare',
    specialUse: {
      actionType: 'recharge_energy',
      label: 'Recharge (+12 ⚡)',
      description: 'Consume to restore +12 Factory Energy immediately.',
      powerValue: 12
    }
  },
  tech_5: {
    tier: 5,
    category: 'tech',
    name: 'Autonomous Drone',
    icon: '🛸',
    color: '#A78BFA',
    bgGradient: 'from-purple-500 via-violet-600 to-indigo-700 border-purple-200',
    coinValue: 320,
    description: 'Automated logistics quad-rotor courier unit.',
    rarity: 'epic',
    specialUse: {
      actionType: 'recharge_energy',
      label: 'Recharge (+18 ⚡)',
      description: 'Consume to restore +18 Factory Energy immediately.',
      powerValue: 18
    }
  },
  tech_6: {
    tier: 6,
    category: 'tech',
    name: 'Quantum AI Core',
    icon: '🌌',
    color: '#E879F9',
    bgGradient: 'from-fuchsia-500 via-purple-600 to-indigo-700 border-fuchsia-200',
    coinValue: 820,
    description: 'Sub-zero quantum processor governing smart plants.',
    rarity: 'mythic',
    specialUse: {
      actionType: 'recharge_energy',
      label: 'Full Recharge (+25 ⚡)',
      description: 'Consume to restore +25 Factory Energy immediately.',
      powerValue: 25
    }
  },

  // RARE MINERALS (High-Value Contracts + Gem Refining Utility on Tier 4+)
  gem_1: {
    tier: 1,
    category: 'gem',
    name: 'Reserve Bond',
    icon: '💵',
    image: imgCashBundle,
    color: '#10B981',
    bgGradient: 'from-emerald-400 via-teal-400 to-emerald-600 border-emerald-200',
    coinValue: 8,
    description: 'Serialized commercial bullion voucher.',
    rarity: 'common'
  },
  gem_2: {
    tier: 2,
    category: 'gem',
    name: 'Cut Quartz Crystal',
    icon: '💠',
    image: imgPinkGemStar,
    color: '#F472B6',
    bgGradient: 'from-pink-400 via-rose-400 to-pink-600 border-rose-200',
    coinValue: 24,
    description: 'Precision-faceted optical quartz mineral.',
    rarity: 'uncommon'
  },
  gem_3: {
    tier: 3,
    category: 'gem',
    name: 'Cobalt Sapphire',
    icon: '🔹',
    image: imgMineralSapphire,
    color: '#38BDF8',
    bgGradient: 'from-teal-400 via-cyan-500 to-blue-600 border-cyan-200',
    coinValue: 65,
    description: 'Deep sapphire crystal mounted in anodized steel.',
    rarity: 'rare'
  },
  gem_4: {
    tier: 4,
    category: 'gem',
    name: 'Emerald Cluster',
    icon: '❇️',
    color: '#34D399',
    bgGradient: 'from-emerald-400 via-green-500 to-teal-600 border-emerald-200',
    coinValue: 170,
    description: 'Refined emerald deposit. Can be smelted into Gems.',
    rarity: 'rare',
    specialUse: {
      actionType: 'refine_gems',
      label: 'Refine (+1 💎)',
      description: 'Consume to refine +1 permanent Gem.',
      powerValue: 1
    }
  },
  gem_5: {
    tier: 5,
    category: 'gem',
    name: 'Industrial Diamond',
    icon: '💎',
    color: '#22D3EE',
    bgGradient: 'from-cyan-400 via-emerald-500 to-teal-600 border-cyan-200',
    coinValue: 420,
    description: 'Flawless optical diamond prism for laser tooling.',
    rarity: 'legendary',
    specialUse: {
      actionType: 'refine_gems',
      label: 'Refine (+3 💎)',
      description: 'Consume to refine +3 permanent Gems.',
      powerValue: 3
    }
  },
  gem_6: {
    tier: 6,
    category: 'gem',
    name: 'Sovereign Prism',
    icon: '✦',
    color: '#FDE047',
    bgGradient: 'from-emerald-400 via-teal-500 to-amber-500 border-amber-200',
    coinValue: 1050,
    description: 'Ultra-rare crystalline masterwork of immense value.',
    rarity: 'mythic',
    specialUse: {
      actionType: 'refine_gems',
      label: 'Refine (+6 💎)',
      description: 'Consume to refine +6 permanent Gems.',
      powerValue: 6
    }
  }
};

export const CONSUMABLE_DEFINITIONS: Record<ConsumableId, ConsumableDef> = {
  energy_cell: {
    id: 'energy_cell',
    name: 'Quick Charge Cell',
    icon: '🔋',
    shortDesc: 'Instantly restores +15 Energy to keep spawning parts.',
    fullDesc: 'A compact high-capacity workshop cell that bypasses normal cooldowns to restore +15 Energy immediately when your grid stalls.',
    usageGuide: 'Tap Use when your Energy bar runs low. Requires watching a short sponsored ad to refill each spent charge.',
    maxStock: 3,
    badge: '+15 Energy',
    bgGradient: 'from-emerald-400 to-teal-500',
    borderClass: 'border-emerald-300'
  },
  tier_catalyst: {
    id: 'tier_catalyst',
    name: 'Tier Promoter Kit',
    icon: '🛠️',
    shortDesc: 'Promotes your highest Tier 1–5 grid item by +1 Tier.',
    fullDesc: 'Precision calibration kit that upgrades your highest Tier 1–5 workshop component directly to the next engineering tier without needing a duplicate.',
    usageGuide: 'Keep a Tier 1–5 component on your Assembly Grid, then tap Use. Refill empty charges anytime by watching a rewarded ad.',
    maxStock: 2,
    badge: '+1 Tier Upgrade',
    bgGradient: 'from-amber-400 to-orange-500',
    borderClass: 'border-amber-300'
  },
  overclock_core: {
    id: 'overclock_core',
    name: 'Overclock Core',
    icon: '🚀',
    shortDesc: 'Harvests 10m Machine Coins + triggers 2x Plant Output (5m).',
    fullDesc: 'Supercharges automated plant machinery to deliver an instant 10-minute coin payout (minimum 250 Coins) plus a 5-minute 2x production boost.',
    usageGuide: 'Tap Use from the Workshop or Supply Hub for instant working capital. Watch a rewarded ad to recharge spent cores.',
    maxStock: 2,
    badge: '10m + 2x Output',
    bgGradient: 'from-violet-400 to-indigo-500',
    borderClass: 'border-violet-300'
  },
  merge_magnet: {
    id: 'merge_magnet',
    name: 'Smart Merge Magnet',
    icon: '🧲',
    shortDesc: 'Auto-merges up to 2 matching pairs on your grid (+25% Coins).',
    fullDesc: 'Sweeps the Assembly Grid to automatically combine up to 2 matching component pairs at once, clearing space and granting +25% bonus merge Coins.',
    usageGuide: 'Best used when your 5x5 grid is getting crowded. Refill depleted magnets by watching a rewarded ad.',
    maxStock: 2,
    badge: 'Auto-Merge ×2',
    bgGradient: 'from-sky-400 to-cyan-500',
    borderClass: 'border-sky-300'
  }
};

export const CONSUMABLE_LIST: ConsumableDef[] = [
  CONSUMABLE_DEFINITIONS.energy_cell,
  CONSUMABLE_DEFINITIONS.tier_catalyst,
  CONSUMABLE_DEFINITIONS.overclock_core,
  CONSUMABLE_DEFINITIONS.merge_magnet
];

export function getMaxTierForCategory(_category: ItemCategory = 'wood'): number {
  return 6;
}

// Helper lookup for retrieving definition by category and tier
export function getItemDef(category: ItemCategory = 'wood', tier: number = 1): ItemDefinition {
  const maxTier = getMaxTierForCategory(category);
  const safeTier = Math.min(maxTier, Math.max(1, tier));
  const key = `${category}_${safeTier}`;
  if (ALL_ITEM_DEFINITIONS[key]) {
    return ALL_ITEM_DEFINITIONS[key];
  }
  return ALL_ITEM_DEFINITIONS['wood_1'];
}

// Fallback dictionary map for legacy tier-only lookup
export const ITEM_DEFINITIONS: Record<number, ItemDefinition> = {
  1: getItemDef('wood', 1),
  2: getItemDef('wood', 2),
  3: getItemDef('wood', 3),
  4: getItemDef('wood', 4),
  5: getItemDef('wood', 5),
  6: getItemDef('wood', 6)
};

export const INITIAL_MACHINES: Machine[] = [
  {
    id: 'wood_cutter',
    name: 'Timber Mill',
    description: 'Automated milling line generating steady workshop revenue.',
    icon: '🪚',
    level: 1,
    baseProduction: 1,
    cycleTime: 4,
    upgradeCost: 75,
    unlocked: true,
    unlockLevel: 1
  },
  {
    id: 'assembler',
    name: 'CNC Assembler',
    description: 'Precision machining station for mid-stage assembly.',
    icon: '🏗️',
    level: 0,
    baseProduction: 6,
    cycleTime: 5,
    upgradeCost: 400,
    unlocked: false,
    unlockLevel: 2
  },
  {
    id: 'robot_factory',
    name: 'Robotics Line',
    description: 'Autonomous industrial production bay.',
    icon: '🤖',
    level: 0,
    baseProduction: 28,
    cycleTime: 6,
    upgradeCost: 1800,
    unlocked: false,
    unlockLevel: 4
  }
];

export const INITIAL_WORKERS: Worker[] = [
  {
    id: 'engineer',
    name: 'Lead Machinist',
    title: 'Timber Mill Operations',
    icon: '👷',
    level: 1,
    boostMultiplier: 0.15,
    targetMachineId: 'wood_cutter',
    upgradeCost: 120,
    unlocked: true
  },
  {
    id: 'manager',
    name: 'Operations Supervisor',
    title: 'CNC Line Optimization',
    icon: '🧑‍💼',
    level: 0,
    boostMultiplier: 0.2,
    targetMachineId: 'assembler',
    upgradeCost: 600,
    unlocked: false
  },
  {
    id: 'robot_assistant',
    name: 'Systems Engineer',
    title: 'Robotics Calibration',
    icon: '🦾',
    level: 0,
    boostMultiplier: 0.25,
    targetMachineId: 'robot_factory',
    upgradeCost: 2400,
    unlocked: false
  }
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_merge',
    title: 'First Assembly',
    description: 'Perform your first component merge.',
    icon: '🔧',
    currentValue: 0,
    targetValue: 1,
    coinReward: 60,
    gemReward: 2,
    claimed: false,
    type: 'merges'
  },
  {
    id: 'merges_50',
    title: 'Floor Technician',
    description: 'Perform 50 merges.',
    icon: '⚙️',
    currentValue: 0,
    targetValue: 50,
    coinReward: 300,
    gemReward: 5,
    claimed: false,
    type: 'merges'
  },
  {
    id: 'merges_200',
    title: 'Master Fabricator',
    description: 'Perform 200 merges.',
    icon: '🏭',
    currentValue: 0,
    targetValue: 200,
    coinReward: 1200,
    gemReward: 12,
    claimed: false,
    type: 'merges'
  },
  {
    id: 'merges_500',
    title: 'Industrial Architect',
    description: 'Perform 500 merges.',
    icon: '🏛️',
    currentValue: 0,
    targetValue: 500,
    coinReward: 4000,
    gemReward: 30,
    claimed: false,
    type: 'merges'
  },
  {
    id: 'orders_10',
    title: 'Reliable Contractor',
    description: 'Fulfill 10 client contracts.',
    icon: '📦',
    currentValue: 0,
    targetValue: 10,
    coinReward: 450,
    gemReward: 8,
    claimed: false,
    type: 'orders'
  },
  {
    id: 'tier_6',
    title: 'Apex Craftsmanship',
    description: 'Forge a Tier 6 asset.',
    icon: '💎',
    currentValue: 0,
    targetValue: 6,
    coinReward: 900,
    gemReward: 15,
    claimed: false,
    type: 'item_tier'
  }
];

const CUSTOMER_CHARACTERS = [
  {
    name: 'Mia · Architect',
    title: 'Interior Procurement',
    avatar: imgAvatarMia,
    badge: 'Standard Contract'
  },
  {
    name: 'Scarlett · Tech Buyer',
    title: 'Hardware Procurement',
    avatar: imgAvatarScarlett,
    badge: 'Priority Dispatch'
  },
  {
    name: 'Richard · Collector',
    title: 'Guild Acquisition',
    avatar: imgAvatarRichard,
    badge: 'Executive Order'
  }
];

export function resolveCustomerAvatar(avatar?: string): string {
  if (!avatar) return '👤';
  if (avatar.includes('avatar_brunette_mia')) return imgAvatarMia;
  if (avatar.includes('avatar_redhead_scarlett')) return imgAvatarScarlett;
  if (avatar.includes('avatar_gentleman_richard')) return imgAvatarRichard;
  return avatar;
}

export function isImageSource(src?: string): boolean {
  if (!src) return false;
  return src.startsWith('/') || src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:');
}

// Helper to normalize requirements across legacy and new orders
export function getOrderRequirements(order: Order): OrderRequirement[] {
  if (order.requirements && order.requirements.length > 0) {
    return order.requirements;
  }
  return [
    {
      itemTier: order.itemTier || 1,
      category: 'wood',
      quantity: order.quantity || 1
    }
  ];
}

// Marketplace Buy Price (convenience cost to purchase items directly without waiting for drops)
export function getMarketplaceBuyPrice(category: ItemCategory, tier: number): number {
  const def = getItemDef(category, tier);
  const markup = tier === 1 ? 2.2 : tier === 2 ? 2.0 : tier === 3 ? 1.9 : 1.85;
  return Math.max(8, Math.round(def.coinValue * markup));
}

// Marketplace Spot Sell Price (instant liquidation without a Client Contract; Orders pay ~2x+ more + XP + Gems)
export function getMarketplaceSpotSellPrice(category: ItemCategory, tier: number): number {
  const def = getItemDef(category, tier);
  return Math.max(1, Math.round(def.coinValue * 0.65));
}

export const MARKETPLACE_CATALOG: { category: ItemCategory; tier: number; unlockLevel: number }[] = [
  { category: 'wood', tier: 1, unlockLevel: 1 },
  { category: 'wood', tier: 2, unlockLevel: 1 },
  { category: 'wood', tier: 3, unlockLevel: 2 },
  { category: 'wood', tier: 4, unlockLevel: 4 },
  { category: 'metal', tier: 1, unlockLevel: 1 },
  { category: 'metal', tier: 2, unlockLevel: 1 },
  { category: 'metal', tier: 3, unlockLevel: 2 },
  { category: 'metal', tier: 4, unlockLevel: 4 },
  { category: 'tech', tier: 1, unlockLevel: 1 },
  { category: 'tech', tier: 2, unlockLevel: 1 },
  { category: 'tech', tier: 3, unlockLevel: 2 },
  { category: 'tech', tier: 4, unlockLevel: 4 },
  { category: 'gem', tier: 1, unlockLevel: 1 },
  { category: 'gem', tier: 2, unlockLevel: 2 },
  { category: 'gem', tier: 3, unlockLevel: 3 },
  { category: 'gem', tier: 4, unlockLevel: 5 }
];

// Free generator strictly spawns Tier 1 (90%) or Tier 2 (10%) standard materials
export function generateRandomItem(_playerLevel: number = 1): BoardItem {
  const roll = Math.random();
  let randomCategory: ItemCategory = 'wood';
  if (roll < 0.32) {
    randomCategory = 'wood';
  } else if (roll < 0.62) {
    randomCategory = 'metal';
  } else if (roll < 0.88) {
    randomCategory = 'tech';
  } else {
    randomCategory = 'gem'; // Rare Minerals (12%)
  }

  // Players must merge from Tier 1/2 up to higher tiers
  const tier = Math.random() < 0.90 ? 1 : 2;

  return {
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tier,
    category: randomCategory
  };
}

export function generateRandomOrder(id: string, playerLevel: number): Order {
  const customer = CUSTOMER_CHARACTERS[Math.floor(Math.random() * CUSTOMER_CHARACTERS.length)];
  const categories: ItemCategory[] = ['wood', 'metal', 'tech', 'gem'];

  const numRequirements = playerLevel >= 3 && Math.random() > 0.45 ? 2 : 1;
  const maxTier = Math.min(6, Math.max(2, Math.floor(playerLevel * 0.75) + 1));

  const requirements: OrderRequirement[] = [];
  let totalCoinValue = 0;
  let highestRequiredTier = 1;

  for (let i = 0; i < numRequirements; i++) {
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const minTier = Math.max(1, maxTier - 2);
    const itemTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
    const quantity = itemTier >= 4 ? 1 : Math.floor(Math.random() * 2) + 1;

    highestRequiredTier = Math.max(highestRequiredTier, itemTier);
    requirements.push({ category: cat, itemTier, quantity });
    const def = getItemDef(cat, itemTier);
    totalCoinValue += def.coinValue * quantity;
  }

  const isExpress = Math.random() > 0.6;
  const badge = isExpress ? 'Priority Contract' : customer.badge;
  const multiplier = isExpress ? 1.55 : 1.35;

  const coinReward = Math.max(12, Math.round(totalCoinValue * multiplier));
  const xpReward = Math.round(totalCoinValue * 0.25 + 15);

  // Gems are rare: only awarded for hard Tier 4+ or multi-item priority orders
  let gemReward: number | undefined = undefined;
  if (highestRequiredTier >= 5) {
    gemReward = 2;
  } else if (highestRequiredTier >= 4 || (numRequirements > 1 && isExpress)) {
    gemReward = 1;
  }

  return {
    id,
    customerName: customer.name,
    customerAvatar: customer.avatar,
    requirements,
    coinReward,
    xpReward,
    gemReward,
    badge,
    isExpress
  };
}

export function createInitialState(): GameState {
  // Clean 5x5 assembly grid with a ready-to-merge Timber pair + 1 Copper Rivet
  const board = Array.from({ length: 25 }, (_, i) => ({
    id: `cell_${i}`,
    item: null as BoardItem | null
  }));

  board[11].item = { id: `item_init_1`, tier: 1, category: 'wood' };
  board[12].item = { id: `item_init_2`, tier: 1, category: 'wood' };
  board[13].item = { id: `item_init_3`, tier: 1, category: 'metal' };

  const orders: Order[] = [
    generateRandomOrder('ord_1', 1),
    generateRandomOrder('ord_2', 1),
    generateRandomOrder('ord_3', 1)
  ];

  return {
    coins: 60,
    gems: 5,
    energy: 25,
    maxEnergy: 25,
    lastEnergyRefillTime: Date.now(),

    level: 1,
    xp: 0,
    xpToNextLevel: 120,

    factoryLevel: 1,

    board,
    inventory: [],
    maxInventoryCapacity: 8,

    machines: INITIAL_MACHINES,
    workers: INITIAL_WORKERS,
    orders,
    achievements: INITIAL_ACHIEVEMENTS,
    dailyState: createInitialDailyState(1),

    stats: {
      totalMerges: 0,
      totalOrdersCompleted: 0,
      highestTierUnlocked: 1,
      totalCoinsEarned: 60
    },

    consumables: {
      energy_cell: 1,
      tier_catalyst: 0,
      overclock_core: 0,
      merge_magnet: 0
    },
    doubleEarningsUntil: 0,
    productionSurgeUntil: 0,
    lastSavedTimestamp: Date.now(),

    settings: {
      soundFx: true,
      music: true,
      boardTheme: 'amber',
      playMode: 'standard',
      showMergeHighlights: true,
      turboMode: false,
      vibration: true,
      showFloatingRewards: true,
      showOrderBadges: true
    }
  };
}
