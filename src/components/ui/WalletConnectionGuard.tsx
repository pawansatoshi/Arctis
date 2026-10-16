'use client';

/**
 * WalletConnectionGuard
 *
 * Detects Brave Browser on Android (and other mobile injected-provider
 * environments) and provides a direct eth_requestAccounts fallback when
 * RainbowKit's ConnectButton gets stuck on the "Opening Brave Wallet…
 * Confirm connection in the extension" screen.
 *
 * ROOT CAUSE RECAP:
 *   RainbowKit's braveWallet connector checks:
 *     installed: hasInjectedProvider({ flag: 'isBraveWallet' })
 *   On Brave Android, window.ethereum.isBraveWallet is often undefined at
 *   page-load time (Brave mobile exposes it lazily after provider init).
 *   installed=false triggers the desktop extension deep-link UI, which on
 *   mobile has no extension to open — connection permanently stalls.
 *
 * FIX:
 *   1. wagmi.ts now puts injectedWallet first and removes braveWallet from
 *      the explicit list. EIP-6963 auto-discovery detects Brave via RDNS.
 *   2. This component adds a direct fallback: if window.ethereum.isBraveWallet
 *      is true at render time OR the user-agent is Brave mobile, show a
 *      "Connect Brave Wallet" button that calls eth_requestAccounts directly,
 *      then uses wagmi's connect() to complete the handshake.
 *   3. The guard is transparent on non-Brave environments — it renders nothing.
 */

import { useEffect, useState, useCallback } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Shield, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/** True if running in Brave on Android or iOS (user-agent heuristic). */
function isBraveMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  // Brave on Android: "Brave/..." in UA or navigator.brave?.isBrave
  const hasBraveUA = /Brave/i.test(ua);
  // navigator.brave is the official synchronous Brave detection API
  const hasBraveNavigator =
    typeof (navigator as { brave?: { isBrave?: unknown } }).brave === 'object' &&
    typeof (navigator as { brave?: { isBrave?: unknown } }).brave?.isBrave !== 'undefined';
  // Mobile check
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  return isMobile && (hasBraveUA || hasBraveNavigator);
}

/** True if window.ethereum reports itself as Brave Wallet. */
function hasBraveProvider(): boolean {
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') return false;
  const eth = window.ethereum as Record<string, unknown>;
  if (eth.isBraveWallet === true) return true;
  // Brave may inject itself into a multi-provider array
  const providers = eth.providers as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(providers)) {
    return providers.some((p) => p.isBraveWallet === true);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type GuardState = 'idle' | 'connecting' | 'success' | 'error';

interface WalletConnectionGuardProps {
  /** Extra CSS classes for the outer container. */
  className?: string;
}

export default function WalletConnectionGuard({ className }: WalletConnectionGuardProps) {
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();

  const [shouldShow, setShouldShow] = useState(false);
  const [state, setState] = useState<GuardState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    // Only show on Brave mobile where RainbowKit's default flow stalls.
    // Also show if window.ethereum.isBraveWallet is true (desktop Brave
    // users who bypassed the RainbowKit flow) and they're not yet connected.
    const show = !isConnected && (isBraveMobile() || hasBraveProvider());
    setShouldShow(show);
  }, [isConnected]);

  const handleConnect = useCallback(async () => {
    setState('connecting');
    setErrorMsg('');
    try {
      // Step 1: Direct eth_requestAccounts to trigger Brave's native approval
      // dialog. This bypasses RainbowKit's extension-check gate entirely.
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }

      // Step 2: Complete the wagmi connection handshake via the injected connector.
      // This wires the approved provider into wagmi state so useAccount() works.
      await connectAsync({ connector: injected() });

      setState('success');
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 4001) {
        // User rejected — clear state silently
        setState('idle');
        return;
      }
      setState('error');
      setErrorMsg(
        e.message
          ? `Connection failed: ${e.message.slice(0, 80)}`
          : 'Connection failed. Please try again.',
      );
    }
  }, [connectAsync]);

  const handleRetry = useCallback(() => {
    setState('idle');
    setErrorMsg('');
    void handleConnect();
  }, [handleConnect]);

  // Already connected — nothing to show
  if (isConnected || !shouldShow) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 flex flex-col gap-3',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-surface-950 text-sm font-semibold leading-snug mb-0.5">
            Brave Wallet Detected
          </p>
          <p className="text-surface-500 text-xs leading-relaxed">
            Use the button below to connect directly — this bypasses the
            browser extension dialog that can stall on mobile.
          </p>
        </div>
      </div>

      {state === 'error' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span className="text-rose-600 dark:text-rose-400 text-xs">{errorMsg}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={state === 'error' ? handleRetry : handleConnect}
          disabled={state === 'connecting'}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            state === 'connecting'
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-500/90 text-white active:scale-95 shadow-sm',
          )}
          aria-busy={state === 'connecting'}
        >
          {state === 'connecting' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Connecting…
            </>
          ) : state === 'error' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </>
          ) : (
            'Connect Brave Wallet'
          )}
        </button>
      </div>

      <p className="text-surface-500 text-[10px] text-center leading-relaxed">
        Tap the button, then approve in Brave Wallet when prompted.
        Your wallet address and funds are never shared without your approval.
      </p>
    </div>
  );
}
