'use client';

import { useReadContract, useAccount } from 'wagmi';
import { PRIMARY_CONTRACT, ERC20_ABI } from '@/lib/contracts';
import { formatUSDC } from '@/lib/utils';

export function useUSDCBalance(overrideAddress?: `0x${string}`) {
  const { address } = useAccount();
  const targetAddress = overrideAddress ?? address;

  const { data: rawBalance, isLoading, isError, refetch } = useReadContract({
    address: PRIMARY_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
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
