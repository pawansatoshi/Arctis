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
// Brave provider safety wrapper
//
// ROOT CAUSE of the "'get' on proxy: property 'removeListener' is a
// read-only and non-configurable data property" error:
//
// Brave Android exposes window.ethereum as a JavaScript Proxy. The underlying
// target object has `removeListener` defined as a non-configurable,
// non-writable property. When wagmi's injected connector calls
//   provider.removeListener('connect', handler)
// the Proxy invariant check fires: the JS engine verifies that the Proxy's
// `get` result for a non-configurable, non-writable property matches the
// target's value. The connector then tries to use the returned function as a
// normal EventEmitter method, but because the Proxy has defined that property
// as invariant, subsequent operations fail with the above error.
//
// FIX: Before passing the Brave provider to the wagmi injected connector,
// wrap it in a safe shim that delegates all EventEmitter operations (on,
// off, removeListener, addListener, emit) through try/catch. The shim
// prevents the Proxy invariant error from propagating to wagmi's cleanup
// code. All other provider methods are forwarded unchanged.
//
// This shim is ONLY applied in WalletConnectionGuard's direct-connect path.
// Normal RainbowKit flows use the provider as-is (wagmi handles its own
// connector lifecycle). The shim addresses the specific case where we call
// connectAsync({ connector: injected() }) manually after eth_requestAccounts.
// ---------------------------------------------------------------------------

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: unknown) => unknown;
  off?: (event: string, handler: unknown) => unknown;
  removeListener?: (event: string, handler: unknown) => unknown;
  addListener?: (event: string, handler: unknown) => unknown;
  emit?: (event: string, ...args: unknown[]) => unknown;
  [key: string]: unknown;
};

function wrapBraveProvider(provider: EthereumProvider): EthereumProvider {
  const safe: EthereumProvider = {
    ...provider,
    // Override all EventEmitter methods with safe wrappers that catch the
    // Proxy invariant error and continue silently. wagmi's connector cleanup
    // calls removeListener during the connect/disconnect lifecycle — if this
    // throws, the entire connection attempt fails.
    on: (event: string, handler: unknown) => {
      try {
        return typeof provider.on === 'function' ? provider.on(event, handler) : undefined;
      } catch { return undefined; }
    },
    off: (event: string, handler: unknown) => {
      try {
        return typeof provider.off === 'function' ? provider.off(event, handler) : undefined;
      } catch { return undefined; }
    },
    removeListener: (event: string, handler: unknown) => {
      try {
        return typeof provider.removeListener === 'function'
          ? provider.removeListener(event, handler)
          : undefined;
      } catch { return undefined; }
    },
    addListener: (event: string, handler: unknown) => {
      try {
        return typeof provider.addListener === 'function'
          ? provider.addListener(event, handler)
          : undefined;
      } catch { return undefined; }
    },
    emit: (event: string, ...args: unknown[]) => {
      try {
        return typeof provider.emit === 'function' ? provider.emit(event, ...args) : undefined;
      } catch { return undefined; }
    },
    // request must be forwarded exactly — no wrapping that could swallow errors
    request: (args) => provider.request(args),
  };
  return safe;
}

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

      // Step 2: Apply the Brave provider safety wrapper to window.ethereum before
      // wagmi's injected connector sees it. This prevents the Proxy invariant
      // error ("'get' on proxy: property 'removeListener' is a read-only and
      // non-configurable data property") that fires when wagmi's connector calls
      // provider.removeListener() during its connect/disconnect lifecycle.
      //
      // We patch window.ethereum in place (the shim delegates everything to the
      // original) so that wagmi's injected() connector picks up the safe version.
      // The patch is temporary — the original value is restored after connectAsync
      // resolves or rejects. This avoids interfering with other wallet operations.
      const originalEthereum =
        typeof window !== 'undefined' ? (window.ethereum as EthereumProvider | undefined) : undefined;
      if (originalEthereum) {
        try {
          // Only patch if writable — some environments freeze window.ethereum.
          Object.defineProperty(window, 'ethereum', {
            value: wrapBraveProvider(originalEthereum),
            writable: true,
            configurable: true,
          });
        } catch {
          // window.ethereum is non-configurable in this environment — skip the patch.
          // The connection attempt will still proceed; it may throw the proxy error
          // on cleanup but the account state will already be set at that point.
        }
      }
      try {
        await connectAsync({ connector: injected() });
      } finally {
        // Restore the original provider regardless of outcome.
        if (originalEthereum) {
          try {
            Object.defineProperty(window, 'ethereum', {
              value: originalEthereum,
              writable: true,
              configurable: true,
            });
          } catch { /* non-configurable, leave as-is */ }
        }
      }

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
