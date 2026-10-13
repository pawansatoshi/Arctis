'use client';
import { useCallback } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { getSelectedNetworkProfile } from '@/lib/network/profile';
import { announceTransactionState } from '@/lib/transaction/voice';
import toast from 'react-hot-toast';

/**
 * Network-aware chain switch hook.
 *
 * The target chain ID is derived at call-time from the user-selected network
 * profile (localStorage key 'arctis-network-env'). On Testnet this resolves
 * to 5042002; on Mainnet it resolves to 5042. No chain ID is ever hardcoded
 * here — adding a new network only requires updating contracts.ts.
 */
export function useChainSwitch() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();

  // Re-derived on every render so the hook reacts immediately when the user
  // switches networks without needing a page reload.
  const profile = getSelectedNetworkProfile();
  const targetChainId = profile.chainId;
  const networkName = profile.networkName;

  const isCorrectChain = chainId === targetChainId;

  const switchToArc = useCallback(async () => {
    // Re-read profile inside the callback so it is current at the moment of
    // the switch attempt, not at the time the callback was created.
    const currentProfile = getSelectedNetworkProfile();
    const currentTargetId = currentProfile.chainId;
    const currentNetworkName = currentProfile.networkName;

    if (chainId === currentTargetId) return true;

    announceTransactionState('network_required');
    try {
      announceTransactionState('switching_network');
      await switchChainAsync({ chainId: currentTargetId });

      // Poll briefly to let the wallet provider confirm the switch.
      for (let i = 0; i < 8; i++) {
        await new Promise<void>((r) => setTimeout(r, 250));
        if (window.ethereum) {
          const raw = await window.ethereum.request({ method: 'eth_chainId' });
          const actual = typeof raw === 'string' ? parseInt(raw, 16) : Number(raw);
          if (actual === currentTargetId) {
            announceTransactionState('network_switched');
            toast.success(`Switched to ${currentNetworkName}`);
            return true;
          }
        }
      }
      throw new Error('Wallet switch could not be verified');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(
        e.message?.toLowerCase().includes('reject')
          ? 'Chain switch rejected'
          : 'Failed to verify network switch',
      );
      return false;
    }
  }, [chainId, switchChainAsync]);

  return {
    isCorrectChain,
    switchToArc,
    isSwitching: isPending,
    currentChainId: chainId,
    targetChainId,
  };
}
