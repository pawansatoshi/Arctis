import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_ROUTES } from '@/lib/swap/service';
import { CHAIN_ID } from '@/lib/contracts';

export async function GET(_req: NextRequest) {
  if (CHAIN_ID === 5042) {
    return NextResponse.json({
      available: false,
      mode: null,
      routes: [],
      reason: 'ARCTIS OTC test-asset swap routes are disabled on Arc Mainnet until a production liquidity and settlement rail is verified.',
    });
  }

  return NextResponse.json({
    available: true,
    mode: 'otc_settlement',
    routes: Object.values(DEFAULT_ROUTES).filter((r) => r.enabled),
  });
}
