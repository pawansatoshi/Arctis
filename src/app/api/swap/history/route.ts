import { NextRequest, NextResponse } from 'next/server';
import { getSwapHistory } from '@/lib/swap/service';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  const swaps = await getSwapHistory(wallet, 50);
  return NextResponse.json({ swaps });
}
