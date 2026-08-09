import { NextResponse } from 'next/server';
import { getTreasuryLogs, aggregateTreasuryMetrics } from '@/lib/treasury/service';

export async function GET() {
  try {
    const [logs, metrics] = await Promise.all([getTreasuryLogs(50), aggregateTreasuryMetrics()]);
    return NextResponse.json({ logs, metrics });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, logs: [], metrics: {} }, { status: 500 });
  }
}
