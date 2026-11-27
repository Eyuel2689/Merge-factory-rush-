import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE, Product } from '@capgo/native-purchases';
import { ConsumableId } from '../types';
import { IAP_SKU_CONTRACT_SEAL, IAP_SKU_GOLDEN_TURBINE } from '../utils/economy';

export type IapProductKind = 'consumable' | 'non_consumable';

export interface IapProductCatalogItem {
  productId: string;
  title: string;
  subtitle: string;
  description: string;
  fallbackPrice: string;
  kind: IapProductKind;
  badge: string;
  icon: string;
  gradient: string;
  reward: {
    gems?: number;
    energy?: number;
    consumablesEach?: number;
    specificConsumable?: ConsumableId;
    crateTierRange?: [number, number];
    perkDescription?: string;
  };
}

export const IAP_CATALOG: IapProductCatalogItem[] = [
  {
    productId: 'com.mergefactory.game.gems_starter',
    title: 'Gem Pouch',
    subtitle: '+25 Scarce Gems',
    description: 'Compact reserve of 25 rare Gems for scarce workshop upgrades & Sovereign Crates.',
    fallbackPrice: '$0.99',
    kind: 'consumable',
    badge: 'Scarce Gems',
    icon: '💎',
    gradient: 'from-cyan-400 to-sky-600',
    reward: { gems: 25 }
  },
  {
    productId: 'com.mergefactory.game.gems_vault',
    title: 'Gem Reserve Vault',
    subtitle: '+80 Scarce Gems',
    description: 'High-capacity reserve of 80 rare Gems (+15% bonus yield) for elite expansions.',
    fallbackPrice: '$2.99',
    kind: 'consumable',
    badge: 'Best Gem Value',
    icon: '💠',
    gradient: 'from-sky-500 to-indigo-600',
    reward: { gems: 80 }
  },
  {
    productId: 'com.mergefactory.game.bundle_boosters',
    title: 'Tactical Booster Bundle',
    subtitle: '+2 All Consumables · +25 Energy',
    description: 'Scarce mega supply drop: +2 Quick Charge, +2 Tier Promoter, +2 Overclock, +2 Magnet, and +25 Energy.',
    fallbackPrice: '$1.99',
    kind: 'consumable',
    badge: 'Mega Supply Pack',
    icon: '🧰',
    gradient: 'from-violet-500 to-fuchsia-600',
    reward: { consumablesEach: 2, energy: 25 }
  },
  {
    productId: 'com.mergefactory.game.crate_sovereign',
    title: 'Sovereign Apex Crate',
    subtitle: 'Tier 5–6 Part · Overclock · +10 Gems',
    description: 'Flagship delivery: guaranteed Tier 5–6 part on your table, +1 Overclock Core, +20 Energy, and +10 Gems.',
    fallbackPrice: '$3.99',
    kind: 'consumable',
    badge: 'Scarce Apex Drop',
    icon: '👑',
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
    reward: {
      crateTierRange: [5, 6],
      specificConsumable: 'overclock_core',
      energy: 20,
      gems: 10
    }
  },
  {
    productId: IAP_SKU_GOLDEN_TURBINE,
    title: 'Golden Turbine Charter',
    subtitle: 'Permanent +100% Plant Output · +10 Max Energy',
    description: 'One-time permanent license doubling all automated machine & offline Coin generation plus +10 Max Energy.',
    fallbackPrice: '$4.99',
    kind: 'non_consumable',
    badge: 'Permanent Charter',
    icon: '⚡',
    gradient: 'from-amber-500 to-yellow-500',
    reward: {
      perkDescription: 'Permanent 2x Plant Income & +10 Max Energy'
    }
  },
  {
    productId: IAP_SKU_CONTRACT_SEAL,
    title: 'Master Contract Charter',
    subtitle: 'Permanent +50% Contract Coins · +8 Vault Slots',
    description: 'One-time permanent license increasing all Client Contract Coin payouts by +50% and adding +8 Asset Vault slots.',
    fallbackPrice: '$4.99',
    kind: 'non_consumable',
    badge: 'Permanent Charter',
    icon: '🏛️',
    gradient: 'from-emerald-500 to-teal-600',
    reward: {
      perkDescription: 'Permanent +50% Contract Payouts & +8 Vault Slots'
    }
  }
];

export const ALL_IAP_PRODUCT_IDS = IAP_CATALOG.map(p => p.productId);

export function isNativeBillingPlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function checkBillingSupported(): Promise<boolean> {
  if (!isNativeBillingPlatform()) return false;
  try {
    const res = await NativePurchases.isBillingSupported();
    return Boolean(res.isBillingSupported);
  } catch {
    return false;
  }
}

export async function fetchStoreProductsMap(): Promise<Record<string, Product>> {
  const map: Record<string, Product> = {};
  if (!isNativeBillingPlatform()) return map;
  try {
    const supported = await checkBillingSupported();
    if (!supported) return map;
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: ALL_IAP_PRODUCT_IDS,
      productType: PURCHASE_TYPE.INAPP
    });
    for (const p of products || []) {
      map[p.identifier] = p;
    }
  } catch (err) {
    console.warn('[IAP] Failed to fetch store products:', err);
  }
  return map;
}

export interface PurchaseResult {
  ok: boolean;
  cancelled?: boolean;
  webPreview?: boolean;
  productId: string;
  transactionId?: string;
  message: string;
}

export async function purchaseIapProduct(
  item: IapProductCatalogItem,
  offerToken?: string
): Promise<PurchaseResult> {
  if (!isNativeBillingPlatform()) {
    return {
      ok: false,
      webPreview: true,
      productId: item.productId,
      message: `Google Play Billing (${item.productId}) is active inside the Android Play app.`
    };
  }

  try {
    const supported = await checkBillingSupported();
    if (!supported) {
      return {
        ok: false,
        productId: item.productId,
        message: 'Google Play Billing is unavailable on this device.'
      };
    }

    const tx = await NativePurchases.purchaseProduct({
      productIdentifier: item.productId,
      productType: PURCHASE_TYPE.INAPP,
      isConsumable: item.kind === 'consumable',
      offerToken
    });

    const state = (tx.purchaseState || '').toUpperCase();
    if (state === 'PENDING') {
      return {
        ok: false,
        productId: item.productId,
        transactionId: tx.transactionId,
        message: 'Purchase is pending Google Play confirmation.'
      };
    }

    return {
      ok: true,
      productId: item.productId,
      transactionId: tx.transactionId,
      message: `${item.title} purchased via Google Play!`
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err || 'Purchase failed');
    const lower = msg.toLowerCase();
    const cancelled = lower.includes('cancel') || lower.includes('user_canceled');
    return {
      ok: false,
      cancelled,
      productId: item.productId,
      message: cancelled
        ? 'Purchase cancelled.'
        : msg || 'Could not complete Google Play purchase.'
    };
  }
}

export async function restoreOwnedNonConsumableIds(): Promise<{
  ok: boolean;
  ownedIds: string[];
  message: string;
}> {
  if (!isNativeBillingPlatform()) {
    return {
      ok: false,
      ownedIds: [],
      message: 'Restore Purchases connects to Google Play inside the Android app.'
    };
  }

  try {
    const nonConsumables = new Set(
      IAP_CATALOG.filter(p => p.kind === 'non_consumable').map(p => p.productId)
    );
    const { purchases } = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.INAPP
    });

    const ownedIds = Array.from(
      new Set(
        (purchases || [])
          .filter(p => nonConsumables.has(p.productIdentifier))
          .map(p => p.productIdentifier)
      )
    );

    return {
      ok: true,
      ownedIds,
      message:
        ownedIds.length > 0
          ? `Restored ${ownedIds.length} permanent charter(s) from Google Play.`
          : 'No unconsumed Google Play charters found for this account.'
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err || 'Restore failed');
    return {
      ok: false,
      ownedIds: [],
      message: msg
    };
  }
}
