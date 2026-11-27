import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isIframePreview = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
})();

let isNativeApp = false;
try {
  isNativeApp = Capacitor.isNativePlatform();
} catch {
  isNativeApp = false;
}

if (import.meta.env.PROD && !isNativeApp && !isIframePreview) {
  try {
    registerSW({ immediate: true });
  } catch {
    // Ignore SW registration failure in restricted frames
  }
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .catch(() => {});
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  declare state: ErrorBoundaryState;
  declare readonly props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Unexpected render error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F2F6FF] flex items-center justify-center p-4 text-slate-900">
          <div className="bg-white border border-indigo-200 rounded-2xl p-5 max-w-sm w-full shadow-lg text-center flex flex-col gap-3">
            <h2 className="text-base font-extrabold text-slate-900">Workshop Recovery</h2>
            <p className="text-xs text-slate-600">{this.state.errorMessage}</p>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Resume Workshop
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('merge_factory_2d_save_v1');
                  } catch {
                    // Ignore storage failure
                  }
                  window.location.reload();
                }}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Reset Local Save & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
