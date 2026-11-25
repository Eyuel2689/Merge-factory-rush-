import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents
} from '@capacitor-community/admob';

export const ADMOB_CONFIG = {
  appId: 'ca-app-pub-7953133690157762~2151559499',
  rewardedAdUnitId:
    import.meta.env.VITE_ADMOB_REWARDED_ID || 'ca-app-pub-7953133690157762/9569517536',
  interstitialAdUnitId:
    import.meta.env.VITE_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-7953133690157762/5330889623'
} as const;

export interface NativeAdResult {
  completed: boolean;
  cancelled?: boolean;
  error?: string;
}

const IS_TEST_MODE = import.meta.env.VITE_ADMOB_TEST_MODE === 'true';

let initPromise: Promise<void> | null = null;
let rewardedReady = false;
let interstitialReady = false;

export function isNativeAdMob(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function initAdMob(): Promise<void> {
  if (!isNativeAdMob()) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await AdMob.initialize({
        initializeForTesting: IS_TEST_MODE
      });

      try {
        const consentInfo = await AdMob.requestConsentInfo();
        if (
          consentInfo.isConsentFormAvailable &&
          consentInfo.status === AdmobConsentStatus.REQUIRED
        ) {
          await AdMob.showConsentForm();
        }
      } catch (consentErr) {
        console.warn('AdMob UMP consent check skipped:', consentErr);
      }

      void preloadRewardedAd();
      void preloadInterstitialAd();
    } catch (err) {
      initPromise = null;
      console.warn('AdMob initialization error:', err);
    }
  })();

  return initPromise;
}

export async function preloadRewardedAd(): Promise<boolean> {
  if (!isNativeAdMob()) return false;
  try {
    await initAdMob();
    await AdMob.prepareRewardVideoAd({
      adId: ADMOB_CONFIG.rewardedAdUnitId,
      isTesting: IS_TEST_MODE,
      immersiveMode: true
    });
    rewardedReady = true;
    return true;
  } catch (err) {
    rewardedReady = false;
    console.warn('Rewarded ad preload failed:', err);
    return false;
  }
}

export async function preloadInterstitialAd(): Promise<boolean> {
  if (!isNativeAdMob()) return false;
  try {
    await initAdMob();
    await AdMob.prepareInterstitial({
      adId: ADMOB_CONFIG.interstitialAdUnitId,
      isTesting: IS_TEST_MODE,
      immersiveMode: true
    });
    interstitialReady = true;
    return true;
  } catch (err) {
    interstitialReady = false;
    console.warn('Interstitial ad preload failed:', err);
    return false;
  }
}

export async function showNativeRewardedAd(): Promise<NativeAdResult> {
  if (!isNativeAdMob()) {
    return { completed: false, error: 'Not running in native Android app' };
  }

  await initAdMob();

  if (!rewardedReady) {
    const loaded = await preloadRewardedAd();
    if (!loaded) {
      return {
        completed: false,
        error: 'Ad is still loading or unavailable right now. Please try again in a moment.'
      };
    }
  }

  rewardedReady = false;

  let dismissedHandle: PluginListenerHandle | null = null;
  let failedHandle: PluginListenerHandle | null = null;

  let dismissedPromiseResolve: (() => void) | null = null;
  const dismissedPromise = new Promise<void>(resolve => {
    dismissedPromiseResolve = resolve;
  });

  try {
    dismissedHandle = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      dismissedPromiseResolve?.();
    });
    failedHandle = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
      dismissedPromiseResolve?.();
    });

    await AdMob.showRewardVideoAd({
      adId: ADMOB_CONFIG.rewardedAdUnitId
    });

    // Wait briefly for the native fullscreen overlay dismissal animation so rewards animate visibly
    await Promise.race([
      dismissedPromise,
      new Promise<void>(resolve => setTimeout(resolve, 600))
    ]);

    void preloadRewardedAd();
    return { completed: true };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string } | undefined;
    const isCancelled =
      errObj?.code === 'REWARDED_AD_CANCELLED' ||
      (typeof errObj?.message === 'string' && errObj.message.toLowerCase().includes('dismissed'));

    void preloadRewardedAd();

    if (isCancelled) {
      return {
        completed: false,
        cancelled: true,
        error: 'Watch the full ad to claim your reward.'
      };
    }

    return {
      completed: false,
      error: errObj?.message || 'Unable to show ad right now. Please try again.'
    };
  } finally {
    await dismissedHandle?.remove().catch(() => {});
    await failedHandle?.remove().catch(() => {});
  }
}

export async function showNativeInterstitialAd(): Promise<NativeAdResult> {
  if (!isNativeAdMob()) {
    return { completed: true };
  }

  await initAdMob();

  if (!interstitialReady) {
    const loaded = await preloadInterstitialAd();
    if (!loaded) {
      // Never block order flow if an interstitial fails to fill or user is offline
      return { completed: true };
    }
  }

  interstitialReady = false;

  let dismissedHandle: PluginListenerHandle | null = null;
  let failedHandle: PluginListenerHandle | null = null;

  const waitForClose = new Promise<void>(resolve => {
    const finish = () => resolve();
    void AdMob.addListener(InterstitialAdPluginEvents.Dismissed, finish).then(h => {
      dismissedHandle = h;
    });
    void AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, finish).then(h => {
      failedHandle = h;
    });
    setTimeout(finish, 30000);
  });

  try {
    await AdMob.showInterstitial({
      adId: ADMOB_CONFIG.interstitialAdUnitId
    });
    await waitForClose;
    void preloadInterstitialAd();
    return { completed: true };
  } catch (err) {
    console.warn('Interstitial show skipped:', err);
    void preloadInterstitialAd();
    return { completed: true };
  } finally {
    await dismissedHandle?.remove().catch(() => {});
    await failedHandle?.remove().catch(() => {});
  }
}
