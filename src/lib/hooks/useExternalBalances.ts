'use client';

import { useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { baseSepolia, arbitrumSepolia } from '@/lib/chain/wagmi';
import { CCTP_BRIDGE_CHAINS, ERC20_ABI } from '@/lib/contracts';

const BASE_USDC = CCTP_BRIDGE_CHAINS['84532'].usdc as `0x${string}`;
const ARB_USDC = CCTP_BRIDGE_CHAINS['421614'].usdc as `0x${string}`;

function formatToken(value: bigint | undefined, decimals: number, max = 6) {
  if (value === undefined) return '—';
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ''] = formatted.split('.');
  const trimmed = fraction.slice(0, max).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function useExternalBalances(address?: `0x${string}`) {
  const baseEth = useBalance({ address, chainId: baseSepolia.id, query: { enabled: !!address, refetchInterval: 15_000 } });
  const arbEth = useBalance({ address, chainId: arbitrumSepolia.id, query: { enabled: !!address, refetchInterval: 15_000 } });

  const baseUsdc = useReadContract({
    address: BASE_USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const arbUsdc = useReadContract({
    address: ARB_USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  return {
    baseSepolia: {
      eth: baseEth.data ? formatToken(baseEth.data.value, 18, 6) : '—',
      usdc: formatToken(baseUsdc.data as bigint | undefined, 6, 6),
      loading: baseEth.isLoading || baseUsdc.isLoading,
    },
    arbitrumSepolia: {
      eth: arbEth.data ? formatToken(arbEth.data.value, 18, 6) : '—',
      usdc: formatToken(arbUsdc.data as bigint | undefined, 6, 6),
      loading: arbEth.isLoading || arbUsdc.isLoading,
    },
    refresh: () => {
      void baseEth.refetch();
      void arbEth.refetch();
      void baseUsdc.refetch();
      void arbUsdc.refetch();
    },
  };
}
