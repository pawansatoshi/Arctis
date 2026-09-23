'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, Globe2 } from 'lucide-react';

type NetworkEnv = 'testnet' | 'mainnet';

const OPTIONS: Array<{ value: NetworkEnv; label: string; detail: string }> = [
  { value: 'testnet', label: 'Arc Testnet', detail: 'Original working environment' },
  { value: 'mainnet', label: 'Arc Mainnet', detail: 'Mainnet configuration' },
];

export default function NetworkSelector() {
  const [network, setNetwork] = useState<NetworkEnv>('testnet');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('arctis-network-env');
      if (saved === 'mainnet' || saved === 'testnet') setNetwork(saved);
    } catch {}
  }, []);

  function switchNetwork(value: NetworkEnv) {
    if (value === network) return;
    try {
      window.localStorage.setItem('arctis-network-env', value);
      document.cookie = `arctis-network-env=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {}
    window.dispatchEvent(new Event('arctis-network-changed'));
    window.location.reload();
  }

  const current = OPTIONS.find((o) => o.value === network) ?? OPTIONS[0];

  return (
    <label className="relative inline-flex items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-3 py-2 text-xs shadow-sm">
      {network === 'testnet' ? <FlaskConical className="w-3.5 h-3.5 text-blue-500" /> : <Globe2 className="w-3.5 h-3.5 text-emerald-500" />}
      <select
        value={network}
        onChange={(e) => switchNetwork(e.target.value as NetworkEnv)}
        aria-label="Select Arc network"
        className="appearance-none bg-transparent pr-4 font-semibold text-surface-950 outline-none cursor-pointer"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 w-3 h-3 text-surface-500" />
      <span className="sr-only">{current.detail}</span>
    </label>
  );
}
