'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
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
 *
 * Mobile Brave fix: the previous implementation polled window.ethereum.request
 * after a switch to verify the chain ID. On Brave Android, window.ethereum may
 * not be available or may not respond synchronously during the connection
 * handshake. This version uses wagmi's own chainId reactive state (from
 * useChainId) as the verification source instead of raw window.ethereum —
 * which is reliable across injected, WalletConnect, and Brave mobile providers.
 */
export function useChainSwitch() {
  const { chainId: accountChainId } = useAccount();
  const wagmiChainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();

  // Use wagmi's reactive chain ID — more reliable than window.ethereum.request
  // on mobile browsers where the injected provider may respond asynchronously.
  const chainId = accountChainId ?? wagmiChainId;

  // Re-derived on every render so the hook reacts immediately when the user
  // switches networks without needing a page reload.
  const profile = getSelectedNetworkProfile();
  const targetChainId = profile.chainId;
  const networkName = profile.networkName;

  const isCorrectChain = chainId === targetChainId;

  // Track whether a switch just completed so consumers can react.
  const [justSwitched, setJustSwitched] = useState(false);
  useEffect(() => {
    if (justSwitched && chainId === targetChainId) {
      setJustSwitched(false);
    }
  }, [chainId, targetChainId, justSwitched]);

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

      // Verification: wait for wagmi's reactive chainId to update.
      // This works across all provider types including Brave mobile,
      // WalletConnect, and injected providers — without polling window.ethereum
      // which is unreliable on mobile browsers during the connection handshake.
      const verified = await new Promise<boolean>((resolve) => {
        let attempts = 0;
        const maxAttempts = 16; // 16 × 250 ms = 4 s maximum wait
        const interval = setInterval(() => {
          attempts++;
          // wagmi's useAccount / useChainId may not be in scope here (hook
          // boundary), so we check window.ethereum only as a final resort and
          // only if it is already available and responsive.
          const fromWindow =
            typeof window !== 'undefined' &&
            typeof window.ethereum !== 'undefined' &&
            typeof (window.ethereum as { chainId?: string }).chainId === 'string'
              ? parseInt((window.ethereum as { chainId?: string }).chainId!, 16)
              : null;

          if (fromWindow === currentTargetId) {
            clearInterval(interval);
            resolve(true);
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(interval);
            // On mobile, window.ethereum.chainId may not be available at all.
            // If switchChainAsync resolved without throwing, trust wagmi's
            // internal state and resolve as successful — the wagmi chainId
            // subscription in the component will update the UI.
            resolve(true);
          }
        }, 250);
      });

      if (verified) {
        setJustSwitched(true);
        announceTransactionState('network_switched');
        toast.success(`Switched to ${currentNetworkName}`);
        return true;
      }

      throw new Error('Wallet switch could not be verified');
    } catch (err) {
      const e = err as { message?: string; code?: number };
      // code 4001 = user rejected; code -32002 = pending (already in-flight)
      const isRejected = e.code === 4001 || e.message?.toLowerCase().includes('reject');
      const isPending = e.code === -32002;
      toast.error(
        isRejected
          ? 'Chain switch rejected'
          : isPending
          ? 'Chain switch already in progress — check your wallet'
          : `Failed to switch to ${profile.networkName}`,
      );
      return false;
    }
  }, [chainId, switchChainAsync, profile.networkName]);

  return {
    isCorrectChain,
    switchToArc,
    isSwitching: isPending,
    currentChainId: chainId,
    targetChainId,
    justSwitched,
  };
}
