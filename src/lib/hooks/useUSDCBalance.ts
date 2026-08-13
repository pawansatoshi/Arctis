'use client';

import { useReadContract, useBalance, useAccount } from 'wagmi';
import { PRIMARY_CONTRACT, ERC20_ABI, CHAIN_ID } from '@/lib/contracts';
import { formatUSDC } from '@/lib/utils';

/**
 * Arc exposes one underlying USDC balance through two interfaces:
 * ERC-20 (6 decimals) and native gas (18 decimals). Prefer the ERC-20
 * interface for application balances, but fall back to the native balance
 * if the RPC temporarily fails so the UI never reports a false 0.00 USDC.
 */
export function useUSDCBalance(overrideAddress?: `0x${string}`) {
  const { address } = useAccount();
  const targetAddress = overrideAddress ?? address;

  const {
    data: rawBalance,
    isLoading: isTokenLoading,
    isError: isTokenError,
    refetch: refetchToken,
  } = useReadContract({
    address: PRIMARY_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    chainId: CHAIN_ID,
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: !!targetAddress,
      refetchInterval: 10_000,
      staleTime: 5_000,
    },
  });

  const {
    data: nativeBalance,
    isLoading: isNativeLoading,
    isError: isNativeError,
    refetch: refetchNative,
  } = useBalance({
    address: targetAddress,
    chainId: CHAIN_ID,
    query: {
      enabled: !!targetAddress,
      refetchInterval: 10_000,
      staleTime: 5_000,
    },
  });

  const tokenBalance = rawBalance as bigint | undefined;
  // Native Arc USDC uses 18 decimals; application USDC uses 6 decimals.
  const nativeAsUsdc = nativeBalance?.value !== undefined
    ? nativeBalance.value / 10n ** 12n
    : undefined;

  const balance = tokenBalance !== undefined ? tokenBalance : nativeAsUsdc;
  const isLoading = isTokenLoading && isNativeLoading;
  const isError = balance === undefined && isTokenError && isNativeError;

  const refetch = async () => {
    await Promise.allSettled([refetchToken(), refetchNative()]);
  };

  return {
    raw: balance ?? 0n,
    formatted: balance !== undefined ? formatUSDC(balance) : '0.00',
    isLoading,
    isError,
    refetch,
    hasBalance: balance !== undefined && balance > 0n,
  };
}
