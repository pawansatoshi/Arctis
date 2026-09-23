import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_ROUTES } from '@/lib/swap/service';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('network') === 'mainnet') {
    return NextResponse.json({ available: false, mode: null, routes: [], reason: 'ARCTIS OTC test-asset swap routes are not enabled on Arc Mainnet yet.' });
  }
  return NextResponse.json({
    available: true,
    mode: 'otc_settlement',
    routes: Object.values(DEFAULT_ROUTES).filter((r) => r.enabled),
  });
}
