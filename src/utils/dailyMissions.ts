import { DailyMission, DailyMissionType, DailyState } from '../types';

export function getTodayDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(date: Date = new Date()): string {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return getTodayDateString(yesterday);
}

/**
 * Calculates remaining time until midnight of the next day.
 */
export function getTimeUntilNextDailyReset(): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const diffMs = Math.max(0, tomorrow.getTime() - now.getTime());

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  return { hours, minutes, seconds, formatted };
}

/**
 * Generates balanced daily missions based on player level.
 */
export function generateDailyMissions(playerLevel: number, dateStr?: string): DailyMission[] {
  const targetTier = playerLevel >= 3 ? 4 : 3;
  const mergeTarget = 24 + Math.min(20, (playerLevel - 1) * 4);
  const spawnTarget = 25 + Math.min(15, (playerLevel - 1) * 3);
  const orderTarget = 4;
  const upgradeTarget = 2;

  return [
    {
      id: `daily_merges_${dateStr || Date.now()}`,
      type: 'merges',
      title: 'Precision Assembly',
      description: `Combine matching components on the floor ${mergeTarget} times`,
      icon: '⚙️',
      target: mergeTarget,
      current: 0,
      coinReward: 95 + playerLevel * 15,
      gemReward: 2,
      energyReward: 6,
      completed: false,
      claimed: false
    },
    {
      id: `daily_orders_${dateStr || Date.now()}`,
      type: 'orders',
      title: 'Contract Fulfillment',
      description: `Complete and dispatch ${orderTarget} client contracts`,
      icon: '📦',
      target: orderTarget,
      current: 0,
      coinReward: 140 + playerLevel * 20,
      gemReward: 3,
      energyReward: 8,
      completed: false,
      claimed: false
    },
    {
      id: `daily_spawns_${dateStr || Date.now()}`,
      type: 'spawns',
      title: 'Material Sourcing',
      description: `Source ${spawnTarget} base materials onto the assembly grid`,
      icon: '🔧',
      target: spawnTarget,
      current: 0,
      coinReward: 80 + playerLevel * 10,
      gemReward: 1,
      energyReward: 10,
      completed: false,
      claimed: false
    },
    {
      id: `daily_craft_tier_${dateStr || Date.now()}`,
      type: 'craft_tier',
      title: `Craft Tier ${targetTier}+ Asset`,
      description: `Forge a Tier ${targetTier} or higher asset through merging`,
      icon: '💠',
      target: 1,
      targetTier: targetTier,
      current: 0,
      coinReward: 120 + playerLevel * 20,
      gemReward: 3,
      completed: false,
      claimed: false
    },
    {
      id: `daily_upgrade_${dateStr || Date.now()}`,
      type: 'upgrade',
      title: 'Facility Expansion',
      description: `Upgrade ${upgradeTarget} machines, technicians, or facility levels`,
      icon: '🏭',
      target: upgradeTarget,
      current: 0,
      coinReward: 115 + playerLevel * 18,
      gemReward: 2,
      completed: false,
      claimed: false
    }
  ];
}

export function createInitialDailyState(playerLevel: number = 1): DailyState {
  const today = getTodayDateString();
  const missions = generateDailyMissions(playerLevel, today);

  return {
    lastResetDate: today,
    lastResetTimestamp: Date.now(),
    streak: 1,
    missions,
    grandRewardClaimed: false,
    grandRewardGoal: missions.length
  };
}

/**
 * Checks whether a new calendar day has started and resets missions accordingly,
 * updating the login streak.
 */
export function checkAndResetDailyState(
  currentDaily: DailyState | undefined,
  playerLevel: number,
  forceReset: boolean = false
): { dailyState: DailyState; wasReset: boolean } {
  const today = getTodayDateString();

  if (!currentDaily) {
    return {
      dailyState: createInitialDailyState(playerLevel),
      wasReset: true
    };
  }

  // If already reset today with valid missions and not forcing reset, return existing
  if (
    currentDaily.lastResetDate === today &&
    Array.isArray(currentDaily.missions) &&
    currentDaily.missions.length > 0 &&
    !forceReset
  ) {
    return { dailyState: currentDaily, wasReset: false };
  }

  // Calculate streak: if yesterday was the last reset date, keep streak going
  const yesterday = getYesterdayDateString();
  let nextStreak = currentDaily.streak || 1;

  if (currentDaily.lastResetDate === yesterday) {
    nextStreak += 1;
  } else if (currentDaily.lastResetDate !== today) {
    // Missed one or more days
    nextStreak = 1;
  }

  const newMissions = generateDailyMissions(playerLevel, today);

  return {
    dailyState: {
      lastResetDate: today,
      lastResetTimestamp: Date.now(),
      streak: nextStreak,
      missions: newMissions,
      grandRewardClaimed: false,
      grandRewardGoal: newMissions.length
    },
    wasReset: true
  };
}

/**
 * Records progress towards daily missions immutably.
 */
export function recordDailyMissionProgress(
  dailyState: DailyState,
  type: DailyMissionType,
  amount: number = 1,
  extra?: { tier?: number }
): DailyState {
  if (!dailyState || !Array.isArray(dailyState.missions)) {
    return dailyState;
  }

  let hasChanged = false;

  const nextMissions = dailyState.missions.map(mission => {
    if (mission.claimed) return mission;
    if (mission.type !== type) return mission;

    // Check tier condition for craft_tier
    if (type === 'craft_tier') {
      const achievedTier = extra?.tier || 0;
      const targetTier = mission.targetTier || 3;
      if (achievedTier < targetTier) {
        return mission;
      }
    }

    const nextCurrent = Math.min(mission.target, mission.current + amount);
    if (nextCurrent !== mission.current) {
      hasChanged = true;
      const isCompleted = nextCurrent >= mission.target;
      return {
        ...mission,
        current: nextCurrent,
        completed: isCompleted
      };
    }

    return mission;
  });

  if (!hasChanged) return dailyState;

  return {
    ...dailyState,
    missions: nextMissions
  };
}
