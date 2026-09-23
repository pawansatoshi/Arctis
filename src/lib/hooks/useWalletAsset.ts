'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnectorClient } from 'wagmi';
import { getNetworkProfile, getSelectedNetworkEnv, type NetworkEnv } from '@/lib/network/profile';
import toast from 'react-hot-toast';

// ============================================================
// useWalletAsset — Add USDC to wallet via wallet_watchAsset
// ============================================================

export function useWalletAsset() {
  const { data: client } = useConnectorClient();
  const [networkEnv, setNetworkEnv] = useState<NetworkEnv>('testnet');
  useEffect(() => {
    const sync = () => setNetworkEnv(getSelectedNetworkEnv());
    sync();
    window.addEventListener('arctis-network-changed', sync);
    return () => window.removeEventListener('arctis-network-changed', sync);
  }, []);
  const network = getNetworkProfile(networkEnv);

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
            address: network.contracts.USDC,
            symbol: 'USDC',
            decimals: network.decimals.USDC,
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
  }, [client, network.contracts.USDC, network.decimals.USDC]);

  return { addUSDCToWallet };
}
