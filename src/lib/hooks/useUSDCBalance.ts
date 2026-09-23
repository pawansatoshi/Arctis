'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { CHAIN_ID } from '@/lib/contracts';

type BalanceState = {
  raw: bigint;
  formatted: string;
  isLoading: boolean;
  isError: boolean;
};

async function readNativeUsdc(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  address: `0x${string}`,
): Promise<bigint> {
  const rawChain = await provider.request({ method: 'eth_chainId' });
  const chainId = typeof rawChain === 'string' ? parseInt(rawChain, 16) : Number(rawChain);
  if (chainId !== CHAIN_ID) throw new Error('Wallet is on the wrong Arc network');

  const raw = await provider.request({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  });

  if (typeof raw !== 'string') throw new Error('Wallet did not return a native balance');
  return BigInt(raw);
}

export function useUSDCBalance(overrideAddress?: `0x${string}`) {
  const { address, connector } = useAccount();
  const targetAddress = overrideAddress ?? address;
  const [state, setState] = useState<BalanceState>({
    raw: 0n,
    formatted: '0.00',
    isLoading: !!targetAddress,
    isError: false,
  });

  const refetch = useCallback(async () => {
    if (!targetAddress || !connector) {
      setState({ raw: 0n, formatted: '0.00', isLoading: false, isError: false });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, isError: false }));

    try {
      const provider = await connector.getProvider();
      const native18 = await readNativeUsdc(
        provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
        targetAddress,
      );

      // Arc's native USDC balance uses 18-decimal EVM units.
      // It is the same balance represented by Arc's 6-decimal ERC-20 mirror.
      setState({
        raw: native18,
        formatted: formatUnits(native18, 18),
        isLoading: false,
        isError: false,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
      }));
    }
  }, [targetAddress, connector]);

  useEffect(() => {
    void refetch();
    const timer = window.setInterval(() => void refetch(), 10_000);
    return () => window.clearInterval(timer);
  }, [refetch]);

  return {
    raw: state.raw,
    formatted: state.formatted,
    isLoading: state.isLoading,
    isError: state.isError,
    refetch,
    hasBalance: state.raw > 0n,
  };
}
