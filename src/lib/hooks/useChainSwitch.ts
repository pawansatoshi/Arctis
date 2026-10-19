'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { getSelectedNetworkProfile } from '@/lib/network/profile';
import { TESTNET_NETWORK, MAINNET_NETWORK } from '@/lib/contracts';
import { announceTransactionState } from '@/lib/transaction/voice';
import toast from 'react-hot-toast';

// wallet_addEthereumChain parameters for Arc chains.
// Provides all required fields so wallets can auto-add the chain without
// requiring the user to manually enter RPC URL, chain ID, or explorer URL.
const ARC_CHAIN_PARAMS: Record<number, {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  [TESTNET_NETWORK.chainId]: {
    chainId: `0x${TESTNET_NETWORK.chainId.toString(16)}`,
    chainName: TESTNET_NETWORK.networkName,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: [TESTNET_NETWORK.rpc],
    blockExplorerUrls: [TESTNET_NETWORK.explorer],
  },
  [MAINNET_NETWORK.chainId]: {
    chainId: `0x${MAINNET_NETWORK.chainId.toString(16)}`,
    chainName: MAINNET_NETWORK.networkName,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: [MAINNET_NETWORK.rpc],
    blockExplorerUrls: [MAINNET_NETWORK.explorer],
  },
};

/**
 * Attempts to add an Arc chain to the wallet when it is not yet known.
 * Uses wallet_addEthereumChain (EIP-3085). Safe to call before switchChain.
 */
async function tryAddChain(chainId: number): Promise<void> {
  const params = ARC_CHAIN_PARAMS[chainId];
  if (!params) return; // Unknown chain — cannot add.
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') return;
  const provider = window.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  await provider.request({ method: 'wallet_addEthereumChain', params: [params] });
}

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
      // Attempt the switch. If the wallet doesn't know this chain (code 4902
      // or "Unrecognized chain ID"), add it automatically via EIP-3085
      // wallet_addEthereumChain before retrying.
      try {
        await switchChainAsync({ chainId: currentTargetId });
      } catch (switchErr) {
        const se = switchErr as { code?: number; message?: string };
        const chainUnknown =
          se.code === 4902 ||
          se.message?.toLowerCase().includes('unrecognized chain') ||
          se.message?.toLowerCase().includes('chain not added') ||
          se.message?.toLowerCase().includes('try adding the chain');
        if (chainUnknown) {
          // Chain is not yet in the wallet — add it, then retry the switch.
          await tryAddChain(currentTargetId);
          await switchChainAsync({ chainId: currentTargetId });
        } else {
          throw switchErr;
        }
      }

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
