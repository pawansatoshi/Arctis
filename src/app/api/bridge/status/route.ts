import { NextRequest, NextResponse } from 'next/server';
import { getBridgePending } from '@/lib/bridge/service';

export async function GET(req: NextRequest) {
  const bridgeId = req.nextUrl.searchParams.get('bridgeId');
  if (!bridgeId) return NextResponse.json({ error: 'bridgeId required' }, { status: 400 });

  const record = await getBridgePending(bridgeId);
  if (!record) return NextResponse.json({ status: 'not_found' });

  return NextResponse.json({
    status: record.status,
    forwardTxHash: record.forwardTxHash,
    completedAt: record.completedAt,
    failureReason: record.failureReason,
  });
}
