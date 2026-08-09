import { NextRequest, NextResponse } from 'next/server';
import { getBridgeHistory } from '@/lib/bridge/service';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  const max = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const bridges = await getBridgeHistory(wallet, Math.min(max, 100));
  return NextResponse.json({ bridges });
}
