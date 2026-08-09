import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_ROUTES } from '@/lib/swap/service';

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    available: true,
    mode: 'otc_settlement',
    routes: Object.values(DEFAULT_ROUTES).filter((r) => r.enabled),
  });
}
