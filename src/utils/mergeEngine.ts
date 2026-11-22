import { BoardCell, BoardItem, ItemCategory } from '../types';
import { getItemDef, getMaxTierForCategory, generateRandomItem } from '../data/gameData';

const VALID_CATEGORIES = new Set<ItemCategory>(['wood', 'metal', 'tech', 'gem']);

export function normalizeCategory(category: unknown): ItemCategory {
  if (typeof category === 'string' && VALID_CATEGORIES.has(category as ItemCategory)) {
    return category as ItemCategory;
  }
  return 'wood';
}

export function normalizeTier(tier: unknown, category: ItemCategory = 'wood'): number {
  const maxTier = getMaxTierForCategory(category);
  const parsed = Number(tier);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(maxTier, Math.max(1, Math.round(parsed)));
}

export function normalizeBoardItem(item: BoardItem | null | undefined): BoardItem | null {
  if (!item) return null;
  const category = normalizeCategory(item.category);
  const tier = normalizeTier(item.tier, category);
  return {
    id: item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    category,
    tier
  };
}

export function canMergeItems(a: BoardItem | null | undefined, b: BoardItem | null | undefined): boolean {
  if (!a || !b) return false;
  const catA = normalizeCategory(a.category);
  const catB = normalizeCategory(b.category);
  if (catA !== catB) return false;

  const tierA = normalizeTier(a.tier, catA);
  const tierB = normalizeTier(b.tier, catB);
  if (tierA !== tierB) return false;

  const maxTier = getMaxTierForCategory(catA);
  return tierA < maxTier;
}

export function isSameTypeAndTier(a: BoardItem | null | undefined, b: BoardItem | null | undefined): boolean {
  if (!a || !b) return false;
  const catA = normalizeCategory(a.category);
  const catB = normalizeCategory(b.category);
  return catA === catB && normalizeTier(a.tier, catA) === normalizeTier(b.tier, catB);
}

export function findMatchingCellIndices(board: BoardCell[], sourceIdx: number): number[] {
  const sourceItem = board[sourceIdx]?.item;
  if (!sourceItem) return [];

  const matches: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (i === sourceIdx) continue;
    if (canMergeItems(sourceItem, board[i]?.item)) {
      matches.push(i);
    }
  }
  return matches;
}

export function findAllMergeablePairs(board: BoardCell[]): [number, number][] {
  const paired = new Set<number>();
  const pairs: [number, number][] = [];

  for (let i = 0; i < board.length; i++) {
    if (paired.has(i)) continue;
    const itemA = board[i]?.item;
    if (!itemA) continue;

    for (let j = i + 1; j < board.length; j++) {
      if (paired.has(j)) continue;
      if (canMergeItems(itemA, board[j]?.item)) {
        paired.add(i);
        paired.add(j);
        pairs.push([i, j]);
        break;
      }
    }
  }

  return pairs;
}

export type TapActionKind =
  | 'noop'
  | 'selected'
  | 'deselected'
  | 'switched'
  | 'moved'
  | 'swapped'
  | 'merged'
  | 'max_tier';

export interface BoardActionResult {
  action: TapActionKind;
  nextBoard: BoardCell[];
  nextSelectedIdx: number | null;
  mergedItem?: BoardItem;
  targetIdx?: number;
  coinReward: number;
  xpReward: number;
  highestTier: number;
  message?: string;
}

function buildMergeResult(
  board: BoardCell[],
  fromIdx: number,
  toIdx: number,
  sourceItem: BoardItem
): BoardActionResult {
  const category = sourceItem.category;
  const newTier = sourceItem.tier + 1;
  const mergedDef = getItemDef(category, newTier);
  const coinReward = Math.max(4, Math.round(mergedDef.coinValue * 0.25));
  const xpReward = newTier * 5;
  const mergedItem: BoardItem = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    category,
    tier: newTier
  };

  const nextBoard = board.map((cell, idx) => {
    if (idx === fromIdx) return { ...cell, item: null };
    if (idx === toIdx) return { ...cell, item: mergedItem };
    return cell;
  });

  return {
    action: 'merged',
    nextBoard,
    nextSelectedIdx: null,
    mergedItem,
    targetIdx: toIdx,
    coinReward,
    xpReward,
    highestTier: newTier,
    message: `Merged into ${mergedDef.name} (T${newTier})!`
  };
}

export function executeBoardTap(
  board: BoardCell[],
  selectedIdx: number | null,
  tappedIdx: number
): BoardActionResult {
  if (!Array.isArray(board) || tappedIdx < 0 || tappedIdx >= board.length) {
    return {
      action: 'noop',
      nextBoard: board,
      nextSelectedIdx: selectedIdx,
      coinReward: 0,
      xpReward: 0,
      highestTier: 1
    };
  }

  const tappedItem = normalizeBoardItem(board[tappedIdx]?.item);

  // Case 1: Nothing currently selected
  if (selectedIdx === null || selectedIdx < 0 || selectedIdx >= board.length) {
    if (!tappedItem) {
      return {
        action: 'noop',
        nextBoard: board,
        nextSelectedIdx: null,
        coinReward: 0,
        xpReward: 0,
        highestTier: 1
      };
    }

    return {
      action: 'selected',
      nextBoard: board,
      nextSelectedIdx: tappedIdx,
      coinReward: 0,
      xpReward: 0,
      highestTier: tappedItem.tier
    };
  }

  // Case 2: Tapped the already-selected slot -> Deselect
  if (selectedIdx === tappedIdx) {
    return {
      action: 'deselected',
      nextBoard: board,
      nextSelectedIdx: null,
      coinReward: 0,
      xpReward: 0,
      highestTier: 1
    };
  }

  const sourceItem = normalizeBoardItem(board[selectedIdx]?.item);

  // Guard: If source became empty somehow, fall back to selecting tapped item
  if (!sourceItem) {
    return {
      action: tappedItem ? 'selected' : 'noop',
      nextBoard: board,
      nextSelectedIdx: tappedItem ? tappedIdx : null,
      coinReward: 0,
      xpReward: 0,
      highestTier: tappedItem ? tappedItem.tier : 1
    };
  }

  // Case 3: Tapped an empty slot -> Move item there cleanly
  if (!tappedItem) {
    const nextBoard = board.map((cell, idx) => {
      if (idx === selectedIdx) return { ...cell, item: null };
      if (idx === tappedIdx) return { ...cell, item: sourceItem };
      return cell;
    });

    return {
      action: 'moved',
      nextBoard,
      nextSelectedIdx: null,
      targetIdx: tappedIdx,
      coinReward: 0,
      xpReward: 0,
      highestTier: sourceItem.tier
    };
  }

  // Case 4: Tapped an identical item below max tier -> MERGE into tappedIdx!
  if (canMergeItems(sourceItem, tappedItem)) {
    return buildMergeResult(board, selectedIdx, tappedIdx, sourceItem);
  }

  // Case 5: Matching category & tier, already at max tier
  if (isSameTypeAndTier(sourceItem, tappedItem)) {
    const def = getItemDef(sourceItem.category, sourceItem.tier);
    return {
      action: 'max_tier',
      nextBoard: board,
      nextSelectedIdx: tappedIdx,
      coinReward: 0,
      xpReward: 0,
      highestTier: sourceItem.tier,
      message: `${def.name} is already Max Tier (T${sourceItem.tier}).`
    };
  }

  // Case 6: Different item -> smoothly switch selection and inform why it didn't merge
  const sourceDef = getItemDef(sourceItem.category, sourceItem.tier);
  const tappedDef = getItemDef(tappedItem.category, tappedItem.tier);
  return {
    action: 'switched',
    nextBoard: board,
    nextSelectedIdx: tappedIdx,
    coinReward: 0,
    xpReward: 0,
    highestTier: tappedItem.tier,
    message: `Selected ${tappedDef.name} (T${tappedItem.tier}) — needs another ${tappedDef.name} (not ${sourceDef.name}) to merge.`
  };
}

export function executeBoardDrop(
  board: BoardCell[],
  fromIdx: number,
  toIdx: number
): BoardActionResult {
  if (
    !Array.isArray(board) ||
    fromIdx < 0 ||
    fromIdx >= board.length ||
    toIdx < 0 ||
    toIdx >= board.length ||
    fromIdx === toIdx
  ) {
    return {
      action: 'noop',
      nextBoard: board,
      nextSelectedIdx: null,
      coinReward: 0,
      xpReward: 0,
      highestTier: 1
    };
  }

  const sourceItem = normalizeBoardItem(board[fromIdx]?.item);
  const targetItem = normalizeBoardItem(board[toIdx]?.item);

  if (!sourceItem) {
    return {
      action: 'noop',
      nextBoard: board,
      nextSelectedIdx: null,
      coinReward: 0,
      xpReward: 0,
      highestTier: 1
    };
  }

  // Empty target -> Move
  if (!targetItem) {
    const nextBoard = board.map((cell, idx) => {
      if (idx === fromIdx) return { ...cell, item: null };
      if (idx === toIdx) return { ...cell, item: sourceItem };
      return cell;
    });

    return {
      action: 'moved',
      nextBoard,
      nextSelectedIdx: null,
      targetIdx: toIdx,
      coinReward: 0,
      xpReward: 0,
      highestTier: sourceItem.tier
    };
  }

  // Identical item -> Merge
  if (canMergeItems(sourceItem, targetItem)) {
    return buildMergeResult(board, fromIdx, toIdx, sourceItem);
  }

  // Max tier identical -> Reject with hint
  if (isSameTypeAndTier(sourceItem, targetItem)) {
    const def = getItemDef(sourceItem.category, sourceItem.tier);
    return {
      action: 'max_tier',
      nextBoard: board,
      nextSelectedIdx: toIdx,
      coinReward: 0,
      xpReward: 0,
      highestTier: sourceItem.tier,
      message: `${def.name} is already Max Tier (T${sourceItem.tier}).`
    };
  }

  // Non-matching item -> Swap positions cleanly
  const nextBoard = board.map((cell, idx) => {
    if (idx === fromIdx) return { ...cell, item: targetItem };
    if (idx === toIdx) return { ...cell, item: sourceItem };
    return cell;
  });

  return {
    action: 'swapped',
    nextBoard,
    nextSelectedIdx: null,
    targetIdx: toIdx,
    coinReward: 0,
    xpReward: 0,
    highestTier: Math.max(sourceItem.tier, targetItem.tier)
  };
}

/**
 * Generates a balanced Tier 1-2 spawn item with a gentle bias toward completing
 * lonely Tier 1-2 items already waiting on the player's board so boards stay mergeable.
 */
export function generateSmartBoardItem(board: BoardCell[], playerLevel: number): BoardItem {
  const counts = new Map<string, { category: ItemCategory; tier: number; count: number }>();

  for (const cell of board) {
    const item = normalizeBoardItem(cell.item);
    if (!item || item.tier > 2) continue;
    const key = `${item.category}_${item.tier}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { category: item.category, tier: item.tier, count: 1 });
    }
  }

  const singletons = Array.from(counts.values()).filter(entry => entry.count % 2 === 1);
  if (singletons.length > 0 && Math.random() < 0.48) {
    const pick = singletons[Math.floor(Math.random() * singletons.length)];
    return {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      category: pick.category,
      tier: pick.tier
    };
  }

  return generateRandomItem(playerLevel);
}

const CATEGORY_SORT_ORDER: Record<ItemCategory, number> = {
  wood: 0,
  metal: 1,
  tech: 2,
  gem: 3
};

export function sortBoardCells(board: BoardCell[]): BoardCell[] {
  const items: BoardItem[] = [];
  for (const cell of board) {
    const normalized = normalizeBoardItem(cell.item);
    if (normalized) items.push(normalized);
  }

  items.sort((a, b) => {
    const catDiff = CATEGORY_SORT_ORDER[a.category] - CATEGORY_SORT_ORDER[b.category];
    if (catDiff !== 0) return catDiff;
    return b.tier - a.tier;
  });

  return board.map((cell, idx) => ({
    ...cell,
    item: items[idx] || null
  }));
}
