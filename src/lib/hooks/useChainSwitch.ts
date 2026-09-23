'use client';

import { useCallback } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { CHAIN_ID, NETWORK_NAME, RPC_URL, EXPLORER_URL } from '@/lib/contracts';
import { announceTransactionState } from '@/lib/transaction/voice';
import toast from 'react-hot-toast';

function hexChainId(id: number) {
  return `0x${id.toString(16)}`;
}

async function addArcNetwork() {
  if (!window.ethereum) throw new Error('No browser wallet detected');

  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: hexChainId(CHAIN_ID),
      chainName: NETWORK_NAME,
      nativeCurrency: {
        name: 'USDC',
        symbol: 'USDC',
        decimals: 18,
      },
      rpcUrls: [RPC_URL],
      blockExplorerUrls: [EXPLORER_URL],
    }],
  });
}

export function useChainSwitch() {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const isCorrectChain = chainId === CHAIN_ID;

  const switchToArc = useCallback(async () => {
    if (isCorrectChain) return true;

    announceTransactionState('network_required');

    try {
      announceTransactionState('switching_network');

      try {
        await switchChainAsync({ chainId: CHAIN_ID });
      } catch (err) {
        const code = (err as { code?: number }).code;
        // Wallets such as MetaMask return 4902 when the selected Arc
        // network is not yet configured. Add the currently selected
        // Testnet/Mainnet network, then retry the switch.
        if (code === 4902) {
          await addArcNetwork();
          await switchChainAsync({ chainId: CHAIN_ID });
        } else {
          throw err;
        }
      }

      for (let i = 0; i < 8; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));

        if (window.ethereum) {
          const raw = await window.ethereum.request({ method: 'eth_chainId' });
          const actual = typeof raw === 'string' ? parseInt(raw, 16) : Number(raw);

          if (actual === CHAIN_ID) {
            announceTransactionState('network_switched');
            toast.success(`Switched to ${NETWORK_NAME}`);
            return true;
          }
        }
      }

      throw new Error('Wallet switch could not be verified');
    } catch (err) {
      const message = (err as { message?: string }).message?.toLowerCase() ?? '';

      if (message.includes('reject') || message.includes('denied')) {
        toast.error('Network switch rejected');
      } else if (message.includes('already added')) {
        toast.error('Network is already added. Please switch to it in your wallet.');
      } else {
        toast.error(`Could not add or switch to ${NETWORK_NAME}`);
      }

      return false;
    }
  }, [isCorrectChain, switchChainAsync]);

  return {
    isCorrectChain,
    switchToArc,
    isSwitching: isPending,
    currentChainId: chainId,
    targetChainId: CHAIN_ID,
  };
}
