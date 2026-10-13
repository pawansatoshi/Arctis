import { NextRequest, NextResponse } from 'next/server';
import { getTreasuryLogs, aggregateTreasuryMetrics } from '@/lib/treasury/service';
import { verifyApiWallet } from '@/lib/auth/middleware';

// Treasury data exposes wallet addresses, transaction hashes, and revenue amounts.
// Require a valid wallet signature; only the authenticated wallet can query treasury logs.
export async function GET(req: NextRequest) {
  const auth = await verifyApiWallet(req, undefined, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason ?? 'Wallet signature required to access treasury data' }, { status: 401 });
  }
  try {
    const [logs, metrics] = await Promise.all([getTreasuryLogs(50), aggregateTreasuryMetrics()]);
    return NextResponse.json({ logs, metrics });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, logs: [], metrics: {} }, { status: 500 });
  }
}
