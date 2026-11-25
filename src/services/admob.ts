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
let rewardedLoadPromise: Promise<string | null> | null = null;
let interstitialLoadPromise: Promise<string | null> | null = null;
let preparedRewardedUnitId: string | null = null;
let preparedInterstitialUnitId: string | null = null;

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

      // Run UMP consent with a short timeout so slow network responses do not delay ad preloading
      try {
        const consentInfo = await Promise.race([
          AdMob.requestConsentInfo(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 3000))
        ]);
        if (
          consentInfo &&
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

let lastRewardedLoadError: string | null = null;

export async function preloadRewardedAd(): Promise<string | null> {
  if (!isNativeAdMob()) return null;
  if (preparedRewardedUnitId) return preparedRewardedUnitId;
  if (rewardedLoadPromise) return rewardedLoadPromise;

  rewardedLoadPromise = (async () => {
    try {
      await initAdMob();
      const info = await AdMob.prepareRewardVideoAd({
        adId: ADMOB_CONFIG.rewardedAdUnitId,
        isTesting: IS_TEST_MODE,
        immersiveMode: true
      });
      preparedRewardedUnitId = info?.adUnitId || ADMOB_CONFIG.rewardedAdUnitId;
      lastRewardedLoadError = null;
      return preparedRewardedUnitId;
    } catch (err: unknown) {
      preparedRewardedUnitId = null;
      const errObj = err as { message?: string } | undefined;
      lastRewardedLoadError = errObj?.message || 'Unable to load ad from AdMob.';
      console.warn('Rewarded ad preload failed:', err);
      return null;
    } finally {
      rewardedLoadPromise = null;
    }
  })();

  return rewardedLoadPromise;
}

export async function preloadInterstitialAd(): Promise<string | null> {
  if (!isNativeAdMob()) return null;
  if (preparedInterstitialUnitId) return preparedInterstitialUnitId;
  if (interstitialLoadPromise) return interstitialLoadPromise;

  interstitialLoadPromise = (async () => {
    try {
      await initAdMob();
      const info = await AdMob.prepareInterstitial({
        adId: ADMOB_CONFIG.interstitialAdUnitId,
        isTesting: IS_TEST_MODE,
        immersiveMode: true
      });
      preparedInterstitialUnitId = info?.adUnitId || ADMOB_CONFIG.interstitialAdUnitId;
      return preparedInterstitialUnitId;
    } catch (err) {
      preparedInterstitialUnitId = null;
      console.warn('Interstitial ad preload failed:', err);
      return null;
    } finally {
      interstitialLoadPromise = null;
    }
  })();

  return interstitialLoadPromise;
}

export async function showNativeRewardedAd(): Promise<NativeAdResult> {
  if (!isNativeAdMob()) {
    return { completed: false, error: 'Not running in native Android app' };
  }

  await initAdMob();

  let unitIdToShow = preparedRewardedUnitId;
  if (!unitIdToShow) {
    unitIdToShow = await preloadRewardedAd();
    if (!unitIdToShow) {
      return {
        completed: false,
        error:
          lastRewardedLoadError ||
          'Ad could not be loaded yet. Check your internet connection and tap Try Again.'
      };
    }
  }

  preparedRewardedUnitId = null;

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
      adId: unitIdToShow
    });

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

  let unitIdToShow = preparedInterstitialUnitId;
  if (!unitIdToShow) {
    unitIdToShow = await preloadInterstitialAd();
    if (!unitIdToShow) {
      return { completed: true };
    }
  }

  preparedInterstitialUnitId = null;

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
      adId: unitIdToShow
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
