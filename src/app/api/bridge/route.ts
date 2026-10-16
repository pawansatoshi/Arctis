import { NextRequest, NextResponse } from 'next/server';
import { CCTP_BRIDGE_CHAINS, CCTP_BRIDGE_CHAINS_MAINNET } from '@/lib/contracts';

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get('network') ?? 'testnet';

  if (network === 'mainnet') {
    const chains = Object.entries(CCTP_BRIDGE_CHAINS_MAINNET).map(([chainId, chain]) => ({
      chain: chain.name,
      chainId: Number(chainId),
      domain: chain.domain,
      usdc: chain.usdc,
      explorer: chain.explorer,
      appKitChain: chain.appKitChain,
      enabled: true,
    }));

    return NextResponse.json({
      available: true,
      mode: 'circle_app_kit',
      protocol: 'CCTP V2',
      direction: 'bidirectional',
      destination: null,
      chains,
      routes: chains.flatMap((source) =>
        chains
          .filter((destination) => destination.chainId !== source.chainId)
          .map((destination) => ({
            sourceChain: source.chain,
            sourceChainId: source.chainId,
            sourceDomain: source.domain,
            destinationChain: destination.chain,
            destinationChainId: destination.chainId,
            destinationDomain: destination.domain,
            enabled: true,
          })),
      ),
    });
  }

  // Testnet routes unchanged
  const chains = Object.entries(CCTP_BRIDGE_CHAINS).map(([chainId, chain]) => ({
    chain: chain.name,
    chainId: Number(chainId),
    domain: chain.domain,
    usdc: chain.usdc,
    explorer: chain.explorer,
    appKitChain: chain.appKitChain,
    enabled: true,
  }));

  return NextResponse.json({
    available: true,
    mode: 'circle_app_kit',
    protocol: 'CCTP V2',
    direction: 'bidirectional',
    destination: null,
    chains,
    routes: chains.flatMap((source) =>
      chains
        .filter((destination) => destination.chainId !== source.chainId)
        .map((destination) => ({
          sourceChain: source.chain,
          sourceChainId: source.chainId,
          sourceDomain: source.domain,
          destinationChain: destination.chain,
          destinationChainId: destination.chainId,
          destinationDomain: destination.domain,
          enabled: true,
        })),
    ),
  });
}
