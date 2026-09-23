'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccount } from 'wagmi';

type NetworkEnv = 'testnet' | 'mainnet';

const NETWORKS: Record<NetworkEnv, {
  label: string;
  sublabel: string;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
}> = {
  testnet: {
    label: 'Arc Testnet',
    sublabel: 'Demo & testing',
    chainId: 5042002,
    chainName: 'Arc Testnet',
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerUrl: 'https://explorer.testnet.arc.io',
  },
  mainnet: {
    label: 'Arc Mainnet',
    sublabel: 'Mainnet configuration',
    chainId: 5042,
    chainName: 'Arc Mainnet',
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
  },
};

export default function NetworkSelector() {
  const { isConnected } = useAccount();
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

  const addOrSwitchNetwork = async (network: NetworkEnv) => {
    if (!isConnected || !window.ethereum) return;

    const config = NETWORKS[network];
    const chainId = `0x${config.chainId.toString(16)}`;

    try {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        });
      } catch (err) {
        if ((err as { code?: number }).code !== 4902) throw err;

        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId,
            chainName: config.chainName,
            nativeCurrency: {
              name: 'USDC',
              symbol: 'USDC',
              decimals: 18,
            },
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.explorerUrl],
          }],
        });
      }
    } catch {
      // The dedicated "Switch Network" control will retry after reload.
    }
  };

  const choose = async (network: NetworkEnv) => {
    setOpen(false);
    if (network === selected) return;

    await addOrSwitchNetwork(network);

    try {
      window.localStorage.setItem('arctis-network-env', network);
    } catch {
      return;
    }

    // Full reload rebuilds the client-side chain/config modules against
    // the selected environment while preserving both network configurations.
    window.location.reload();
  };

  const option = NETWORKS[selected];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-surface-100/80 px-2 py-1.5 text-xs font-medium text-surface-800 hover:bg-surface-100 transition-colors"
      >
        {selected === 'testnet' ? (
          <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Globe2 className="w-3.5 h-3.5 text-blue-500" />
        )}
        <span className="hidden sm:inline">{option.label}</span>
        <span className="sm:hidden">{selected === 'testnet' ? 'Testnet' : 'Mainnet'}</span>
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

            {(Object.keys(NETWORKS) as NetworkEnv[]).map((id) => {
              const item = NETWORKS[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={id === selected}
                  onClick={() => void choose(id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors',
                    id === selected
                      ? 'bg-blue-500/8'
                      : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    id === 'testnet' ? 'bg-emerald-500/10' : 'bg-blue-500/10',
                  )}>
                    {id === 'testnet'
                      ? <FlaskConical className="w-4 h-4 text-emerald-500" />
                      : <Globe2 className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-surface-950">{item.label}</div>
                    <div className="text-[10px] text-surface-500">{item.sublabel}</div>
                  </div>
                  {id === selected && (
                    <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400">Active</span>
                  )}
                </button>
              );
            })}

            <div className="px-3 py-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[9px] leading-relaxed text-surface-500">
              Connected wallets automatically add and switch to the selected Arc network when supported.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
