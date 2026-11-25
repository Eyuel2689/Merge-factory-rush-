import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Smartphone, X, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (Capacitor.isNativePlatform() || isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition active:scale-95"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install Merge Factory App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="w-full py-2.5 px-4 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
      >
        <Smartphone className="w-4 h-4 shrink-0 text-sky-600" />
        <span>{isIOS ? 'Install on iPhone / iPad' : 'Install App on Device'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-scaleIn"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-white border border-sky-200 rounded-3xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3 relative text-slate-900"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              aria-label="Close install guide"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-extrabold text-slate-900 pr-8">
              {isIOS ? 'Install on iPhone / iPad' : 'Install as Standalone App'}
            </h3>

            {isIOS ? (
              <p className="text-xs text-slate-700 leading-relaxed">
                1. Open this app directly in <strong>Safari</strong>.<br />
                2. Tap the <strong>Share</strong> button in the browser bar.<br />
                3. Select <strong>Add to Home Screen</strong>.
              </p>
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed">
                Open this app directly in Chrome or Edge (outside the editor frame) and choose{' '}
                <strong>Install App</strong> or <strong>Add to Home screen</strong> from the browser menu.
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface OnlineRequiredOverlayProps {
  isOnline: boolean;
  isChecking: boolean;
  onRetry: () => void;
}

export const OnlineRequiredOverlay: React.FC<OnlineRequiredOverlayProps> = ({
  isOnline,
  isChecking,
  onRetry
}) => {
  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-5 select-none">
      <div className="bg-white border-2 border-amber-300 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4 animate-scaleIn text-slate-900">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
          <WifiOff className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Internet Connection Required</h2>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Merge Factory 2D requires an active internet connection to play, sync factory rewards, and load sponsored boosts.
          </p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          disabled={isChecking}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-70 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer"
        >
          {isChecking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking Connection...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
