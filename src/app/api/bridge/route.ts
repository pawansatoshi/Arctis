import { NextRequest, NextResponse } from 'next/server';
import { CCTP_SOURCE_CHAINS, ARC_CCTP, CHAIN_ID } from '@/lib/contracts';

export async function GET(_req: NextRequest) {
  const routes = Object.entries(CCTP_SOURCE_CHAINS).map(([chainId, chain]) => ({
    sourceChain: chain.name,
    sourceChainId: Number(chainId),
    sourceDomain: chain.domain,
    usdc: chain.usdc,
    tokenMessengerV2: chain.tokenMessengerV2,
    explorer: chain.explorer,
    enabled: true,
  }));

  return NextResponse.json({
    available: true,
    mode: 'cctp_v2_forwarding_service',
    direction: 'inbound_only',
    destination: {
      chain: 'Arc Testnet',
      chainId: CHAIN_ID,
      domain: ARC_CCTP.domain,
      messageTransmitterV2: ARC_CCTP.messageTransmitterV2,
      tokenMessengerV2: ARC_CCTP.tokenMessengerV2,
    },
    routes,
  });
}
