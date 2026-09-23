'use client';

import { useEffect, useState } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { TESTNET_NETWORK, MAINNET_NETWORK, ERC20_ABI } from '@/lib/contracts';
import { getSelectedNetworkEnv, type NetworkEnv } from '@/lib/network/profile';
import { formatUnits } from 'viem';

export function useTARCBalance(overrideAddress?: `0x${string}`) {
  const { address } = useAccount();
  const target = overrideAddress ?? address;
  const [network, setNetwork] = useState<NetworkEnv>('testnet');

  useEffect(() => {
    const sync = () => setNetwork(getSelectedNetworkEnv());
    sync();
    window.addEventListener('arctis-network-changed', sync);
    return () => window.removeEventListener('arctis-network-changed', sync);
  }, []);

  // tARC is an ARCTIS Testnet-only asset. Never query a test asset on Mainnet.
  const profile = network === 'testnet' ? TESTNET_NETWORK : MAINNET_NETWORK;
  const enabled = !!target && network === 'testnet';

  const { data: raw, isLoading, refetch } = useReadContract({
    address: profile.contracts.tARC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    chainId: profile.chainId,
    args: enabled ? [target] : undefined,
    query: { enabled, refetchInterval: 15_000, staleTime: 10_000 },
  });

  const balance = raw as bigint | undefined;
  const decimals = profile.decimals.tARC;
  const formatted = network === 'testnet' && balance !== undefined
    ? parseFloat(formatUnits(balance, decimals)).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : '0.0000';

  return { raw: network === 'testnet' ? (balance ?? 0n) : 0n, formatted, isLoading, refetch };
}
