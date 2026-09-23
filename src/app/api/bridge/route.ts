import { NextRequest, NextResponse } from 'next/server';
import { CCTP_BRIDGE_CHAINS, CHAIN_ID } from '@/lib/contracts';

export async function GET(_req: NextRequest) {
  const requestedNetwork = _req.nextUrl.searchParams.get('network');
  if (requestedNetwork === 'mainnet' || CHAIN_ID === 5042) {
    return NextResponse.json({
      available: false,
      mode: null,
      protocol: null,
      direction: null,
      destination: null,
      chains: [],
      routes: [],
      reason: 'Circle CCTP routes are not enabled for ARCTIS Arc Mainnet until mainnet route identifiers and production verification are complete.',
    });
  }

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
