'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { announceTransactionState } from '@/lib/transaction/voice';
import toast from 'react-hot-toast';

type NetworkEnv = 'testnet' | 'mainnet';

const TARGETS = {
  testnet: { chainId: 5042002, name: 'Arc Testnet' },
  mainnet: { chainId: 5042, name: 'Arc Mainnet' },
} as const;

export function useChainSwitch() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [network, setNetwork] = useState<NetworkEnv>('testnet');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('arctis-network-env');
      if (saved === 'mainnet' || saved === 'testnet') setNetwork(saved);
    } catch {}
  }, []);

  const target = TARGETS[network];
  const isCorrectChain = chainId === target.chainId;

  const switchToArc = useCallback(async () => {
    if (isCorrectChain) return true;
    announceTransactionState('network_required');
    try {
      announceTransactionState('switching_network');
      await switchChainAsync({ chainId: target.chainId });
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 250));
        if (window.ethereum) {
          const raw = await window.ethereum.request({ method: 'eth_chainId' });
          const actual = typeof raw === 'string' ? parseInt(raw, 16) : Number(raw);
          if (actual === target.chainId) {
            announceTransactionState('network_switched');
            toast.success(`Switched to ${target.name}`);
            return true;
          }
        }
      }
      throw new Error('Wallet switch could not be verified');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message?.toLowerCase().includes('reject') ? 'Chain switch rejected' : 'Failed to verify network switch');
      return false;
    }
  }, [isCorrectChain, switchChainAsync, target.chainId, target.name]);

  return {
    isCorrectChain,
    switchToArc,
    isSwitching: isPending,
    currentChainId: chainId,
    targetChainId: target.chainId,
    targetNetworkName: target.name,
  };
}
