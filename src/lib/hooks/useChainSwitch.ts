'use client';

import { useCallback } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { CHAIN_ID, RPC_URL, EXPLORER_URL } from '@/lib/contracts';
import toast from 'react-hot-toast';

export function useChainSwitch() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const isCorrectChain = chainId === CHAIN_ID;

  const switchToArc = useCallback(async () => {
    if (isCorrectChain) return true;
    try {
      await switchChainAsync({ chainId: CHAIN_ID });
      toast.success('Switched to Arc Testnet');
      return true;
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message?.includes('rejected') ? 'Chain switch rejected' : 'Failed to switch network');
      return false;
    }
  }, [isCorrectChain, switchChainAsync]);

  return { isCorrectChain, switchToArc, isSwitching: isPending, currentChainId: chainId, targetChainId: CHAIN_ID };
}
