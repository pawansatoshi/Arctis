'use client';

import { useCallback } from 'react';
import { useConnectorClient } from 'wagmi';
import { ARC_USDC_ADDRESS, ARC_USDC_DECIMALS, ARC_USDC_SYMBOL } from '@/lib/chain/config';
import toast from 'react-hot-toast';

// ============================================================
// useWalletAsset — Add USDC to wallet via wallet_watchAsset
// ============================================================

export function useWalletAsset() {
  const { data: client } = useConnectorClient();

  const addUSDCToWallet = useCallback(async () => {
    if (!client) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      // wallet_watchAsset is a standard EIP-747 method
      await (client.transport as { request: (args: unknown) => Promise<unknown> }).request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: ARC_USDC_ADDRESS,
            symbol: ARC_USDC_SYMBOL,
            decimals: ARC_USDC_DECIMALS,
            image: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
          },
        },
      });
      toast.success('USDC added to wallet');
    } catch (err) {
      const e = err as { message?: string };
      if (e.message?.includes('rejected')) {
        toast.error('Cancelled by user');
      } else {
        toast.error('Failed to add token');
      }
    }
  }, [client]);

  return { addUSDCToWallet };
}
