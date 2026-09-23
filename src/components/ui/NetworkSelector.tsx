'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type NetworkEnv = 'testnet' | 'mainnet';

const OPTIONS: Array<{ id: NetworkEnv; label: string; sublabel: string }> = [
  { id: 'testnet', label: 'Arc Testnet', sublabel: 'Demo & testing' },
  { id: 'mainnet', label: 'Arc Mainnet', sublabel: 'Mainnet configuration' },
];

export default function NetworkSelector() {
  const [selected, setSelected] = useState<NetworkEnv>('testnet');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('arctis-network-env');
      if (stored === 'mainnet' || stored === 'testnet') setSelected(stored);
    } catch {
      // Testnet remains the safe default.
    }
  }, []);

  const choose = (network: NetworkEnv) => {
    setOpen(false);
    if (network === selected) return;
    try {
      window.localStorage.setItem('arctis-network-env', network);
    } catch {
      return;
    }
    // A full reload is intentional: chain/contracts are module-level config,
    // so every client hook must be rebuilt against the selected network.
    window.location.reload();
  };

  const option = OPTIONS.find((item) => item.id === selected) ?? OPTIONS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="hidden sm:flex items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-surface-100/80 px-2.5 py-1.5 text-xs font-medium text-surface-800 hover:bg-surface-100 transition-colors"
      >
        {selected === 'testnet' ? (
          <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Globe2 className="w-3.5 h-3.5 text-blue-500" />
        )}
        <span>{option.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close network menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label="Select ARCTIS network"
            className="absolute right-0 top-full mt-2 z-50 w-56 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-surface-50 shadow-2xl"
          >
            <div className="px-3 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-surface-500">Network</div>
              <div className="text-xs text-surface-700 mt-0.5">Choose the ARCTIS environment</div>
            </div>
            {OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === selected}
                onClick={() => choose(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors',
                  item.id === selected
                    ? 'bg-blue-500/8'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  item.id === 'testnet' ? 'bg-emerald-500/10' : 'bg-blue-500/10',
                )}>
                  {item.id === 'testnet'
                    ? <FlaskConical className="w-4 h-4 text-emerald-500" />
                    : <Globe2 className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-surface-950">{item.label}</div>
                  <div className="text-[10px] text-surface-500">{item.sublabel}</div>
                </div>
                {item.id === selected && (
                  <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400">Active</span>
                )}
              </button>
            ))}
            <div className="px-3 py-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[9px] leading-relaxed text-surface-500">
              Switching networks reloads ARCTIS so chain, RPC and contract configuration stay aligned.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
