import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      Boolean(window.matchMedia?.('(display-mode: standalone)').matches) ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install
  };
}

async function probeInternetReachability(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const probe = async (url: string, timeoutMs = 4500): Promise<boolean> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller?.signal
      });
      return true;
    } catch {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  if (Capacitor.isNativePlatform()) {
    const firstTry = await probe('https://clients3.google.com/generate_204');
    if (firstTry) return true;
    return probe('https://www.google.com/generate_204');
  }

  // In browser/PWA, verify same-origin server reachability when online
  return probe(`${window.location.origin}/?online_check=${Date.now()}`);
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isChecking, setIsChecking] = useState(false);

  const recheckConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const ok = await probeInternetReachability();
      setIsOnline(ok);
      return ok;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void recheckConnection();

    const handleOnline = () => {
      void recheckConnection();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void recheckConnection();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      void recheckConnection();
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [recheckConnection]);

  return { isOnline, isChecking, recheckConnection };
}
