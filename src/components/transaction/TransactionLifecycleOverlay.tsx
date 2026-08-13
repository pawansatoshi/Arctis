'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export type LifecycleState = 'wallet_approval' | 'processing' | 'confirmed' | 'failed';

interface LifecycleEventDetail {
  state: LifecycleState;
  operation?: string;
  txHash?: string;
}

export default function TransactionLifecycleOverlay() {
  const [state, setState] = useState<LifecycleEventDetail | null>(null);
  const [walletBlurred, setWalletBlurred] = useState(false);
  const [returnedFromWallet, setReturnedFromWallet] = useState(false);

  useEffect(() => {
    const onLifecycle = (event: Event) => {
      const detail = (event as CustomEvent<LifecycleEventDetail>).detail;
      if (!detail?.state) return;
      if (detail.state === 'wallet_approval') {
        setState(detail);
        setWalletBlurred(false);
        setReturnedFromWallet(false);
        return;
      }
      setState(detail);
    };

    const onBlur = () => {
      if (state?.state === 'wallet_approval') setWalletBlurred(true);
    };

    const onFocus = () => {
      if (walletBlurred && state?.state === 'wallet_approval') {
        setReturnedFromWallet(true);
        setState((current) => current ? { ...current, state: 'processing' } : current);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && walletBlurred && state?.state === 'wallet_approval') {
        setReturnedFromWallet(true);
        setState((current) => current ? { ...current, state: 'processing' } : current);
      }
    };

    window.addEventListener('arctis:transaction-lifecycle', onLifecycle as EventListener);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('arctis:transaction-lifecycle', onLifecycle as EventListener);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state, walletBlurred, returnedFromWallet]);

  useEffect(() => {
    if (!state || (state.state !== 'confirmed' && state.state !== 'failed')) return;
    const timer = window.setTimeout(() => setState(null), 900);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (!state || state.state === 'confirmed' || state.state === 'failed') return null;

  const walletWaiting = state.state === 'wallet_approval' && !returnedFromWallet;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[140] flex justify-center px-4 pointer-events-none" aria-live="polite">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface-0/95 backdrop-blur-xl shadow-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
            {walletWaiting ? <Loader2 className="w-5 h-5 text-amber-600 animate-spin" /> : <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-surface-950">
              {walletWaiting ? 'Confirm in wallet' : 'Processing transaction'}
            </p>
            <p className="text-xs text-surface-600 mt-0.5">
              {walletWaiting ? 'Approve the transaction in your wallet to continue.' : 'Transaction submitted. Waiting for blockchain confirmation…'}
            </p>
          </div>
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
        </div>
      </div>
    </div>
  );
}
