'use client';

import { useEffect, useState } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { TESTNET_NETWORK, MAINNET_NETWORK, ERC20_ABI } from '@/lib/contracts';
import { formatUSDC } from '@/lib/utils';
import { getSelectedNetworkEnv, type NetworkEnv } from '@/lib/network/profile';

type NetworkEnv = 'testnet' | 'mainnet';

export function useUSDCBalance(overrideAddress?: `0x${string}`) {
  const { address } = useAccount();
  const targetAddress = overrideAddress ?? address;
  const [network, setNetwork] = useState<NetworkEnv>('testnet');

  useEffect(() => {
    const sync = () => setNetwork(getSelectedNetworkEnv());
    sync();
    window.addEventListener('arctis-network-changed', sync);
    return () => window.removeEventListener('arctis-network-changed', sync);
  }, []);

  const profile = network === 'mainnet' ? MAINNET_NETWORK : TESTNET_NETWORK;
  const { data: rawBalance, isLoading, isError, refetch } = useReadContract({
    address: profile.contracts.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    chainId: profile.chainId,
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: !!targetAddress,
      refetchInterval: 10_000,
      staleTime: 5_000,
    },
  });

  const balance = rawBalance as bigint | undefined;
  return {
    raw: balance ?? 0n,
    formatted: balance !== undefined ? formatUSDC(balance) : '0.00',
    isLoading,
    isError,
    refetch,
    hasBalance: balance !== undefined && balance > 0n,
  };
}
