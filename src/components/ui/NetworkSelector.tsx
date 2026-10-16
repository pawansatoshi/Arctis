'use client';

/**
 * NetworkSelector — persistent Testnet / Mainnet switcher.
 *
 * Rendered in the dashboard header so it is always reachable without
 * navigating to Settings. On change it:
 *   1. Writes the selection to localStorage ('arctis-network-env').
 *   2. Sets a cookie so Next.js SSR reads the same value on first load.
 *   3. Dispatches 'arctis-network-changed' for any in-page listeners.
 *   4. Reloads the page so wagmi transports, contract addresses, balance
 *      hooks and the payment verifier all reinitialise consistently.
 *
 * Testnet is the default. Mainnet is only available when the user
 * explicitly selects it — no silent network switching ever happens.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, Globe2 } from 'lucide-react';
import { getSelectedNetworkEnv } from '@/lib/network/profile';

type NetworkEnv = 'testnet' | 'mainnet';

const OPTIONS: Array<{
  value: NetworkEnv;
  label: string;
  shortLabel: string;
  chainId: number;
}> = [
  { value: 'testnet', label: 'Arc Testnet',  shortLabel: 'Testnet', chainId: 5042002 },
  { value: 'mainnet', label: 'Arc Mainnet',  shortLabel: 'Mainnet', chainId: 5042    },
];

export default function NetworkSelector() {
  const [network, setNetwork] = useState<NetworkEnv>('testnet');
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount — avoids SSR mismatch.
  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem('arctis-network-env');
      if (saved === 'mainnet' || saved === 'testnet') setNetwork(saved);
      else setNetwork(getSelectedNetworkEnv());
    } catch {
      setNetwork('testnet');
    }
  }, []);

  function switchNetwork(value: NetworkEnv) {
    if (value === network) return;
    try {
      window.localStorage.setItem('arctis-network-env', value);
      // Cookie so SSR middleware and server components read the same value.
      document.cookie = `arctis-network-env=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch { /* storage blocked — proceed to reload anyway */ }
    // Notify any in-page subscribers before the reload.
    window.dispatchEvent(new Event('arctis-network-changed'));
    window.location.reload();
  }

  const current = OPTIONS.find((o) => o.value === network) ?? OPTIONS[0];
  const isMainnet = network === 'mainnet';

  // Render a stable placeholder before hydration to avoid layout shift.
  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-3 py-2 text-xs shadow-sm opacity-60 select-none">
        <FlaskConical className="w-3.5 h-3.5 text-blue-500" />
        <span className="font-semibold text-surface-950">Testnet</span>
      </div>
    );
  }

  return (
    <label
      className="relative inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-3 py-2 text-xs shadow-sm cursor-pointer hover:border-black/[0.14] dark:hover:border-white/[0.14] transition-colors"
      aria-label={`Network: ${current.label} (chain ID ${current.chainId}). Click to change.`}
      title={`${current.label} · Chain ID ${current.chainId}`}
    >
      {isMainnet
        ? <Globe2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        : <FlaskConical className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      }

      <select
        value={network}
        onChange={(e) => switchNetwork(e.target.value as NetworkEnv)}
        aria-label="Select Arc network"
        className="appearance-none bg-transparent pr-4 font-semibold text-surface-950 outline-none cursor-pointer"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-2.5 w-3 h-3 text-surface-500" />

      {/* Chain ID badge — visible on sm+ so mobile header stays compact */}
      <span className="hidden sm:inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-mono font-medium
        border-black/[0.08] dark:border-white/[0.08] text-surface-500 ml-0.5">
        {current.chainId}
      </span>
    </label>
  );
}
