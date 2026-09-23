'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { announceTransactionState } from '@/lib/transaction/voice';
import toast from 'react-hot-toast';
import { getSelectedNetworkEnv, getNetworkProfile, normalizeNetworkEnv, type NetworkEnv } from '@/lib/network/profile';


export function useChainSwitch() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [network, setNetwork] = useState<NetworkEnv>(() => getSelectedNetworkEnv());

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('arctis-network-env');
      setNetwork(normalizeNetworkEnv(saved));
    } catch {}
  }, []);

  const target = getNetworkProfile(network);
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
            toast.success(`Switched to ${target.networkName}`);
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
  }, [isCorrectChain, switchChainAsync, target.chainId, target.networkName]);

  return {
    isCorrectChain,
    switchToArc,
    isSwitching: isPending,
    currentChainId: chainId,
    targetChainId: target.chainId,
    targetNetworkName: target.networkName,
  };
}
