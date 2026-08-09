'use client';

import { useReadContract, useAccount } from 'wagmi';
import { TARC_CONTRACT, ERC20_ABI, DECIMALS } from '@/lib/contracts';
import { formatUnits } from 'viem';

export function useTARCBalance(overrideAddress?: `0x${string}`) {
  const { address } = useAccount();
  const target = overrideAddress ?? address;

  const { data: raw, isLoading, refetch } = useReadContract({
    address: TARC_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: target ? [target] : undefined,
    query: { enabled: !!target, refetchInterval: 15_000, staleTime: 10_000 },
  });

  const balance = raw as bigint | undefined;
  const decimals = DECIMALS.tARC; // 18

  const formatted = balance !== undefined
    ? parseFloat(formatUnits(balance, decimals)).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : '0.0000';

  return { raw: balance ?? 0n, formatted, isLoading, refetch };
}
